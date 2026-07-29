// Public audit-log ingestion endpoint.
// Accepts a batch of client-emitted events, enriches with IP/UA/session,
// sanitizes sensitive keys, and appends via append_audit_log().
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SENSITIVE_KEYS = new Set([
  "password", "pass", "mpin", "otp", "code",
  "token", "access_token", "refresh_token", "id_token",
  "authorization", "cookie", "secret", "api_key", "apikey",
]);

function sanitize(v: unknown, depth = 0): unknown {
  if (depth > 6 || v == null) return v;
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => sanitize(x, depth + 1));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) { out[k] = "[REDACTED]"; continue; }
      out[k] = sanitize(val, depth + 1);
    }
    return out;
  }
  if (typeof v === "string") {
    // strip control chars, cap length
    return v.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 2000);
  }
  return v;
}

function parseUA(ua: string) {
  const browserMatch = ua.match(/(Firefox|Chrome|Safari|Edg|OPR|MSIE|Trident)[\/ ]?([\d.]+)?/i);
  const osMatch =
    /Windows NT [\d.]+/.exec(ua)?.[0] ||
    /Mac OS X [\d_\.]+/.exec(ua)?.[0] ||
    /Android [\d.]+/.exec(ua)?.[0] ||
    /iPhone OS [\d_]+/.exec(ua)?.[0] ||
    /Linux/.exec(ua)?.[0] ||
    "Unknown";
  const device = /Mobile|Android|iPhone|iPad/.test(ua) ? "Mobile" : "Desktop";
  return {
    browser: browserMatch ? `${browserMatch[1]} ${browserMatch[2] ?? ""}`.trim() : "Unknown",
    operating_system: osMatch,
    device,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const events: unknown[] = Array.isArray(body?.events) ? body.events : [body];
    if (events.length === 0) {
      return new Response(JSON.stringify({ ok: true, count: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (events.length > 50) {
      return new Response(JSON.stringify({ error: "Too many events" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    let userId: string | null = null;
    let userRole = "anonymous";
    let sessionId: string | null = null;

    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data } = await anon.auth.getClaims(token);
      const claims = data?.claims as Record<string, unknown> | undefined;
      if (claims?.sub) {
        userId = String(claims.sub);
        sessionId = (claims.session_id as string) ?? null;
        try {
          const { data: roles } = await anon.from("user_roles").select("role").eq("user_id", userId);
          userRole = roles?.some((r: { role: string }) => r.role === "admin") ? "admin" : "user";
        } catch { /* ignore */ }
      }
    }

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const ua = req.headers.get("user-agent") ?? "";
    const parsed = parseUA(ua);

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let inserted = 0;
    for (const raw of events) {
      const e = (raw ?? {}) as Record<string, unknown>;
      const category = String(e.category ?? "unknown").slice(0, 60);
      const action = String(e.action ?? "unknown").slice(0, 80);
      const payload = {
        user_id: userId,
        user_role: userRole,
        session_id: sessionId,
        correlation_id: (e.correlation_id as string) ?? null,
        category,
        action,
        description: e.description ? String(e.description).slice(0, 500) : null,
        entity_type: e.entity_type ? String(e.entity_type).slice(0, 60) : null,
        entity_id: e.entity_id ? String(e.entity_id).slice(0, 120) : null,
        ip_address: ip,
        device: parsed.device,
        browser: parsed.browser,
        operating_system: parsed.operating_system,
        endpoint: e.endpoint ? String(e.endpoint).slice(0, 200) : null,
        http_method: e.http_method ? String(e.http_method).slice(0, 10) : null,
        status_code: typeof e.status_code === "number" ? e.status_code : null,
        success: e.success === false ? false : true,
        failure_reason: e.failure_reason ? String(e.failure_reason).slice(0, 400) : null,
        metadata: sanitize(e.metadata ?? {}) as Record<string, unknown>,
      };
      const { error } = await service.rpc("append_audit_log", { _payload: payload });
      if (!error) inserted += 1;
    }

    return new Response(JSON.stringify({ ok: true, count: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
