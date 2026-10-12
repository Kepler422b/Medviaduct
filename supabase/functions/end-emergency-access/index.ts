
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

    const eventId = (body as Record<string, unknown>).eventId;

    if (typeof eventId !== "string" || !UUID_REGEX.test(eventId)) {
      return json({ error: "Invalid emergency event ID" }, 400);
    }

    const { data, error } = await supabase.rpc(
      "end_emergency_access",
      { p_event_id: eventId },
    );

    if (error) {
      console.error("Emergency termination failed:", {
        code: error.code,
        message: error.message,
      });

      if (error.code === "42501") {
        return json(
          { error: "Event not found or not authorized to end it" },
          403,
        );
      }

      if (error.code === "28000") {
        return json({ error: "Authentication required" }, 401);
      }

      return json({ error: "Unable to end emergency access" }, 500);
    }

    if (data !== true) {
      return json({ error: "Emergency termination was not confirmed" }, 500);
    }

    return json({
      success: true,
      ended: true,
      eventId,
    });
  } catch (error) {
    console.error("end-emergency-access error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
