
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
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
      reason,
      scopes,
      durationMinutes,
    } = body as Record<string, unknown>;

    if (
      typeof patientId !== "string" ||
      !UUID_REGEX.test(patientId)
    ) {
      return json({ error: "Invalid patient ID" }, 400);
    }

    if (
      typeof reason !== "string" ||
      reason.trim().length < 10 ||
      reason.trim().length > 1000
    ) {
      return json(
        { error: "Reason must contain 10–1000 characters" },
        400,
      );
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
      return json({ error: "Invalid or duplicate scopes" }, 400);
    }

    if (
      typeof durationMinutes !== "number" ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 60
    ) {
      return json(
        { error: "Duration must be between 1 and 60 minutes" },
        400,
      );
    }

    const { data: eventId, error: rpcError } = await supabase.rpc(
      "request_emergency_access",
      {
        p_patient_id: patientId,
        p_reason: reason.trim(),
        p_scopes: scopes,
        p_duration_minutes: durationMinutes,
      },
    );

    if (rpcError) {
      console.error("Emergency access request failed:", {
        code: rpcError.code,
        message: rpcError.message,
      });

      if (rpcError.code === "42501") {
        return json(
          { error: "Clinician authorization failed" },
          403,
        );
      }

      if (rpcError.code === "28000") {
        return json({ error: "Authentication required" }, 401);
      }

      if (rpcError.code === "22023") {
        return json(
          { error: "Invalid emergency-access details" },
          400,
        );
      }

      return json(
        { error: "Unable to create emergency-access event" },
        500,
      );
    }

    if (typeof eventId !== "string") {
      console.error("Emergency-access RPC returned no event ID");
      return json({ error: "Unable to confirm emergency request" }, 500);
    }

    return json(
      {
        success: true,
        emergencyEventId: eventId,
        scopes,
        durationMinutes,
        message: "Emergency-access event recorded",
      },
      201,
    );
  } catch (error) {
    console.error("request-emergency-access error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
