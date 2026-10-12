
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-access-grant-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401, headers: corsHeaders },
      );
    }

    const grantId =
      req.headers.get("x-access-grant-id") ||
      req.headers.get("X-Access-Grant-Id");

    if (!grantId) {
      return Response.json(
        { error: "Access grant required" },
        { status: 403, headers: corsHeaders },
      );
    }

    if (!UUID_REGEX.test(grantId)) {
      return Response.json(
        { error: "Invalid access grant format" },
        { status: 403, headers: corsHeaders },
      );
    }

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401, headers: corsHeaders },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const patientId = body.patientId;
    const scope = body.scope;

    const allowedScopes = [
      "patient_summary",
      "visits",
      "diagnoses",
      "prescriptions",
    ];

    if (
      typeof patientId !== "string" ||
      !UUID_REGEX.test(patientId) ||
      typeof scope !== "string" ||
      !allowedScopes.includes(scope)
    ) {
      return Response.json(
        { error: "Invalid patient ID or scope" },
        { status: 400, headers: corsHeaders },
      );
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
      return Response.json(
        { authorized: false, message: "Access grant invalid or expired", details: grantErrorReason },
        { status: 403, headers: corsHeaders },
      );
    }

    // Atomically evaluate authorization and record the validation audit event
    interface AuditResult {
      audit_recorded: boolean;
      audit_id: number | null;
      authorized: boolean;
      rate_limited?: boolean;
    }

    const { data: auditData, error: auditError } = await supabase.rpc(
      "record_patient_access_audit",
      {
        p_patient_id: patientId,
        p_scope: scope,
        p_action: "validate",
      },
    );

    if (auditError) {
      console.error("Validation audit check failed:", auditError.message);
      return Response.json(
        { error: "Authorization check unavailable" },
        { status: 500, headers: corsHeaders },
      );
    }

    const auditResult = auditData as AuditResult | null;

    if (!auditResult || (!auditResult.audit_recorded && !auditResult.rate_limited)) {
      console.error("Validation audit persistence unconfirmed");
      return Response.json(
        { error: "Authorization check unavailable" },
        { status: 500, headers: corsHeaders },
      );
    }

    if (!auditResult.authorized) {
      if (auditResult.rate_limited) {
        return Response.json(
          { authorized: false, message: "Rate limit exceeded" },
          { status: 429, headers: corsHeaders },
        );
      }
      return Response.json(
        { authorized: false, message: "Access denied" },
        { status: 403, headers: corsHeaders },
      );
    }

    return Response.json(
      { authorized: true, patientId, scope },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("validate-patient-access error:", error);
    return Response.json(
      { error: "Invalid request or internal server error" },
      { status: 400, headers: corsHeaders },
    );
  }
});
