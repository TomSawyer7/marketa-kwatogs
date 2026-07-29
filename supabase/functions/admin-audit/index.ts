// Admin-only audit log operations: list / get / verify / export
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.slice(7);
  const { data: claimData, error: claimErr } = await anon.auth.getClaims(token);
  if (claimErr || !claimData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userId = String(claimData.claims.sub);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: roles } = await service.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* GET-style */ }
  const action = String(body.action ?? "list");

  if (action === "list") {
    const {
      from_ts, to_ts, user_id, category, event_action, success, search,
      page = 1, page_size = 50,
    } = body as Record<string, string | number | boolean | undefined>;
    let q = service.from("audit_logs").select("*", { count: "exact" });
    if (from_ts) q = q.gte("timestamp", String(from_ts));
    if (to_ts) q = q.lte("timestamp", String(to_ts));
    if (user_id) q = q.eq("user_id", String(user_id));
    if (category) q = q.eq("category", String(category));
    if (event_action) q = q.eq("action", String(event_action));
    if (typeof success === "boolean") q = q.eq("success", success);
    if (search) q = q.or(`description.ilike.%${search}%,action.ilike.%${search}%,entity_id.ilike.%${search}%`);
    const p = Math.max(1, Number(page));
    const ps = Math.min(200, Math.max(1, Number(page_size)));
    q = q.order("seq", { ascending: false }).range((p - 1) * ps, p * ps - 1);
    const { data, count, error } = await q;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ rows: data ?? [], total: count ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "get") {
    const { data, error } = await service.from("audit_logs").select("*").eq("id", String(body.id)).maybeSingle();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ row: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "verify") {
    const { data, error } = await anon.rpc("verify_audit_chain", {
      _from_seq: body.from_seq ?? null,
      _to_seq: body.to_seq ?? null,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ result: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "export") {
    const format = String(body.format ?? "csv");
    let q = service.from("audit_logs").select("*").order("seq", { ascending: true });
    if (body.from_ts) q = q.gte("timestamp", String(body.from_ts));
    if (body.to_ts) q = q.lte("timestamp", String(body.to_ts));
    if (body.user_id) q = q.eq("user_id", String(body.user_id));
    if (body.category) q = q.eq("category", String(body.category));
    if (body.event_action) q = q.eq("action", String(body.event_action));
    if (typeof body.success === "boolean") q = q.eq("success", body.success as boolean);
    const { data, error } = await q.limit(10000);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const rows = data ?? [];

    if (format === "csv" || format === "excel") {
      const cols = [
        "seq","timestamp","user_id","user_role","category","action","description",
        "entity_type","entity_id","ip_address","device","browser","operating_system",
        "endpoint","http_method","status_code","success","failure_reason",
        "session_id","correlation_id","previous_hash","current_hash",
      ];
      const esc = (v: unknown) => {
        if (v == null) return "";
        const s = typeof v === "object" ? JSON.stringify(v) : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","))].join("\n");
      const mime = format === "excel" ? "application/vnd.ms-excel" : "text/csv";
      return new Response(csv, { headers: { ...corsHeaders, "Content-Type": mime } });
    }

    if (format === "pdf") {
      // Minimal, dependency-free PDF: one page, monospaced summary text.
      const lines = [
        "Marketa Audit Log Export",
        `Generated: ${new Date().toISOString()}`,
        `Records: ${rows.length}`,
        "",
        ...rows.slice(0, 400).map((r: Record<string, unknown>) =>
          `#${r.seq} ${r.timestamp} ${r.category}/${r.action} user=${r.user_id ?? "-"} success=${r.success} hash=${String(r.current_hash).slice(0,12)}…`
        ),
      ];
      const text = lines.map(l => l.replace(/[()\\]/g, "")).join("\n");
      const streamLines = lines.map((l, i) => `BT /F1 8 Tf 40 ${800 - i * 10} Td (${l.replace(/[()\\]/g, "")}) Tj ET`).join("\n");
      const content = `<< /Length ${streamLines.length} >>\nstream\n${streamLines}\nendstream`;
      const pdf =
        `%PDF-1.4\n` +
        `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n` +
        `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n` +
        `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n` +
        `4 0 obj ${content} endobj\n` +
        `5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj\n` +
        `trailer << /Root 1 0 R /Size 6 >>\n%%EOF`;
      return new Response(pdf, { headers: { ...corsHeaders, "Content-Type": "application/pdf" } });
    }

    return new Response(JSON.stringify({ rows }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
