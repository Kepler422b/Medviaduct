
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: corsHeaders,
  });

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !publishableKey) {
      console.error("Missing Supabase environment configuration");
      return json({ error: "Server configuration error" }, 500);
    }

    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }

    // Preserve the caller's JWT so auth.uid() reflects the patient.
    // Do not use a service-role key for this operation.
    const supabase = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: { Authorization: authorization },
      },
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
      return json({ error: "Request body must be an object" }, 400);
    }

    const {
      patientId,
      clinicianId,
      scopes,
      durationMinutes,
    } = body as Record<string, unknown>;

    if (
      typeof patientId !== "string" ||
      !UUID_REGEX.test(patientId) ||
      typeof clinicianId !== "string" ||
      !UUID_REGEX.test(clinicianId)
    ) {
      return json({ error: "Invalid patient or clinician ID" }, 400);
    }

    if (
      !Array.isArray(scopes) ||
      scopes.length === 0 ||
      !scopes.every(
        (scope: unknown) =>
          typeof scope === "string" &&
          ALLOWED_SCOPES.has(scope),
      ) ||
      new Set(scopes).size !== scopes.length
    ) {
      return json({ error: "Invalid or duplicate access scopes" }, 400);
    }

    if (
      typeof durationMinutes !== "number" ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 1440
    ) {
      return json(
        { error: "Duration must be between 1 and 1440 minutes" },
        400,
      );
    }

    // The database function verifies patient ownership, clinician role,
    // permitted scopes and duration, and writes the grant and audit log
    // in the same transaction.
    //
    // No separate patients-table lookup is performed here because
    // patient RLS correctly restricts direct patient-record reads.
    const { data: grantId, error: grantError } = await supabase.rpc(
      "grant_patient_access",
      {
        p_patient_id: patientId,
        p_clinician_id: clinicianId,
        p_scopes: scopes,
        p_duration_minutes: durationMinutes,
      },
    );

    if (grantError) {
      // Log technical details server-side, never return SQL details.
      console.error("Consent grant failed:", {
        code: grantError.code,
        message: grantError.message,
      });

      if (grantError.code === "42501") {
        return json(
          { error: "Patient ownership or authorization check failed" },
          403,
        );
      }

      if (grantError.code === "28000") {
        return json({ error: "Authentication required" }, 401);
      }

      if (grantError.code === "22023") {
        return json({ error: "Invalid consent grant details" }, 400);
      }

      return json({ error: "Unable to create consent grant" }, 500);
    }

    if (typeof grantId !== "string") {
      console.error("Consent grant RPC returned no grant ID");
      return json({ error: "Unable to confirm consent grant" }, 500);
    }

    return json(
      {
        success: true,
        grantId,
        scopes,
        durationMinutes,
      },
      201,
    );
  } catch (error) {
    console.error("grant-patient-access unexpected error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
