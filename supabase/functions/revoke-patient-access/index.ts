
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

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
      return json({ error: "Invalid request body" }, 400);
    }

    const grantId = (body as Record<string, unknown>).grantId;

    if (
      typeof grantId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(grantId)
    ) {
      return json({ error: "Invalid grant ID" }, 400);
    }

    // This RPC performs ownership validation, revocation and auditing
    // atomically. It is implemented in the next database step.
    const { data, error } = await supabase.rpc(
      "revoke_patient_access",
      { p_grant_id: grantId },
    );

    if (error) {
      console.error("Consent revocation failed:", {
        code: error.code,
        message: error.message,
      });

      if (error.code === "42501") {
        return json({ error: "Not authorized to revoke this grant" }, 403);
      }

      return json({ error: "Unable to revoke consent" }, 500);
    }

    return json({ success: true, revoked: data === true }, 200);
  } catch (error) {
    console.error("revoke-patient-access error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
