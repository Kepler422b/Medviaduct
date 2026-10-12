
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-access-grant-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_SCOPES = new Set([
  "patient_summary",
  "visits",
  "diagnoses",
  "prescriptions",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization");

    if (!url || !key) {
      console.error("Missing Supabase configuration");
      return json({ error: "Server configuration error" }, 500);
    }

    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }

    const grantId =
      req.headers.get("x-access-grant-id") ||
      req.headers.get("X-Access-Grant-Id");

    if (!grantId) {
      return json({ error: "Access grant required" }, 403);
    }

    if (!UUID_REGEX.test(grantId)) {
      return json({ error: "Invalid access grant format" }, 403);
    }

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json({ error: "Invalid or expired session" }, 401);
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json({ error: "Invalid request body" }, 400);
    }

    const { patientId, scope } = body as Record<string, unknown>;

    if (
      typeof patientId !== "string" ||
      !UUID_REGEX.test(patientId) ||
      typeof scope !== "string" ||
      !ALLOWED_SCOPES.has(scope)
    ) {
      return json({ error: "Invalid patient ID or scope" }, 400);
    }

    // Validate access grant against access_grants and emergency_access_grants
    let isGrantValid = false;
    let grantErrorReason = "Access grant denied";

    // 1. Try RPC verify_access_grant first
    const { data: rpcResult, error: grantRpcError } = await supabase.rpc(
      "verify_access_grant",
      {
        p_grant_id: grantId,
        p_patient_id: patientId,
        p_clinician_id: user.id,
        p_scope: scope,
      },
    );

    if (!grantRpcError && rpcResult && typeof rpcResult === "object") {
      const res = rpcResult as { valid?: boolean; reason?: string };
      if (res.valid === true) {
        isGrantValid = true;
      } else {
        grantErrorReason = res.reason || "Invalid or expired access grant";
      }
    } else {
      // 2. Direct table fallback if RPC unavailable
      const now = new Date();
      const { data: regularGrant } = await supabase
        .from("access_grants")
        .select('id, "patientId", "clinicianId", "expiresAt", "revokedAt"')
        .eq("id", grantId)
        .maybeSingle();

      if (regularGrant) {
        const matchesPatient = regularGrant.patientId === patientId;
        const matchesClinician = regularGrant.clinicianId === user.id;
        const notExpired = new Date(regularGrant.expiresAt) > now;
        const notRevoked = !regularGrant.revokedAt;
        if (matchesPatient && matchesClinician && notExpired && notRevoked) {
          isGrantValid = true;
        } else {
          grantErrorReason = !notExpired ? "grant_expired" : (!notRevoked ? "grant_revoked" : "grant_mismatch");
        }
      } else {
        const { data: emergencyGrant } = await supabase
          .from("emergency_access_grants")
          .select('id, "patientId", "clinicianId", "expiresAt", "revokedAt"')
          .eq("id", grantId)
          .maybeSingle();

        if (emergencyGrant) {
          const matchesPatient = emergencyGrant.patientId === patientId;
          const matchesClinician = emergencyGrant.clinicianId === user.id;
          const notExpired = new Date(emergencyGrant.expiresAt) > now;
          const notRevoked = !emergencyGrant.revokedAt;
          if (matchesPatient && matchesClinician && notExpired && notRevoked) {
            isGrantValid = true;
          } else {
            grantErrorReason = !notExpired ? "emergency_grant_expired" : (!notRevoked ? "emergency_grant_revoked" : "emergency_grant_mismatch");
          }
        }
      }
    }

    if (!isGrantValid) {
      return json({ error: "Access grant invalid or expired", details: grantErrorReason }, 403);
    }

    // Atomically evaluate authorization and persist the distinct read audit event.
    // Server-side derives actor from auth.uid() and outcome from can_access_patient.
    interface AuditResult {
      audit_recorded: boolean;
      audit_id: number | null;
      authorized: boolean;
      scope: string;
      patient_id: string;
      action: string;
      created_at: string | null;
      reason?: string | null;
      rate_limited?: boolean;
    }

    const { data: auditData, error: auditError } = await supabase.rpc(
      "record_patient_access_audit",
      {
        p_patient_id: patientId,
        p_scope: scope,
        p_action: "read",
      },
    );

    if (auditError) {
      console.error("Audit RPC execution failed:", {
        code: auditError.code,
        message: auditError.message,
      });
      return json({ error: "Unable to verify or audit patient access" }, 500);
    }

    const auditResult = auditData as AuditResult | null;

    // Fail-closed guard: do not proceed if audit row could not be recorded
    if (!auditResult || (!auditResult.audit_recorded && !auditResult.rate_limited)) {
      console.error("Audit persistence unconfirmed");
      return json({ error: "Unable to record access audit" }, 500);
    }

    if (!auditResult.authorized) {
      if (auditResult.rate_limited) {
        return json({ error: "Too many denied requests. Please retry later." }, 429);
      }
      if (auditResult.reason === "clinician_role_required") {
        return json({ error: "Clinical access denied" }, 403);
      }
      return json({ error: "Patient access denied" }, 403);
    }

    // Clinical data retrieval: executed strictly after authorization & audit confirmation
    let record: unknown;

    if (scope === "patient_summary") {
      const { data, error } = await supabase
        .from("patients")
        .select("id, patient_code, full_name, date_of_birth, sex")
        .eq("id", patientId)
        .maybeSingle();

      if (error) {
        console.error("Patient summary query failed:", {
          code: error.code,
          message: error.message,
        });
        return json({ error: "Unable to retrieve patient summary" }, 500);
      }

      if (!data) {
        return json({ error: "Patient record unavailable" }, 404);
      }

      record = data;
    } else if (scope === "visits") {
      const { data, error } = await supabase
        .from("visits")
        .select("id, visit_date, diagnosis, location_code")
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });

      if (error) {
        console.error("Visits query failed:", {
          code: error.code,
          message: error.message,
        });
        return json({ error: "Unable to retrieve clinical records" }, 500);
      }

      record = data ?? [];
    } else if (scope === "diagnoses") {
      const { data, error } = await supabase
        .from("visits")
        .select("id, visit_date, diagnosis, location_code")
        .eq("patient_id", patientId)
        .not("diagnosis", "is", null)
        .order("visit_date", { ascending: false });

      if (error) {
        console.error("Diagnoses query failed:", {
          code: error.code,
          message: error.message,
        });
        return json({ error: "Unable to retrieve clinical records" }, 500);
      }

      record = data ?? [];
    } else {
      // prescriptions table links to patients via visits(patient_id)
      const { data, error } = await supabase
        .from("prescriptions")
        .select("id, medication_name, dosage, instructions, prescribed_at, visits!inner(patient_id)")
        .eq("visits.patient_id", patientId)
        .order("prescribed_at", { ascending: false });

      if (error) {
        console.error("Prescriptions query failed:", {
          code: error.code,
          message: error.message,
        });
        return json({ error: "Unable to retrieve clinical records" }, 500);
      }

      record = (data ?? []).map(({ visits: _v, ...rx }: any) => rx);
    }

    return json({
      authorized: true,
      scope,
      ...(scope === "patient_summary"
        ? { record }
        : { records: record }),
    });
  } catch (error) {
    console.error("get-patient-record error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
