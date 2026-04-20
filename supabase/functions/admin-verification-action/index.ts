import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  user_id: string;
  action: "approve_id" | "reject" | "list" | "signed_urls";
  notes?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE);

    // Verify caller has admin role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;

    if (body.action === "list") {
      const { data, error } = await admin
        .from("verifications")
        .select("user_id, status, ocr_full_name, ocr_date_of_birth, ocr_gender, ocr_psn, ocr_address, id_front_path, id_back_path, face_match_score, liveness_passed, admin_notes, submitted_at, verified_at")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, items: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "signed_urls") {
      const { data: row } = await admin
        .from("verifications")
        .select("id_front_path, id_back_path")
        .eq("user_id", body.user_id)
        .maybeSingle();
      if (!row) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const f = await admin.storage.from("id-documents").createSignedUrl(row.id_front_path, 60 * 10);
      const b = await admin.storage.from("id-documents").createSignedUrl(row.id_back_path, 60 * 10);
      return new Response(JSON.stringify({ ok: true, front: f.data?.signedUrl, back: b.data?.signedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "approve_id") {
      const { error } = await admin.from("verifications").update({
        status: "id_approved",
        admin_notes: body.notes ?? null,
        id_approved_at: new Date().toISOString(),
        id_approved_by: userData.user.id,
      }).eq("user_id", body.user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "reject") {
      const { error } = await admin.from("verifications").update({
        status: "rejected",
        admin_notes: body.notes ?? null,
      }).eq("user_id", body.user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-verification-action error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
