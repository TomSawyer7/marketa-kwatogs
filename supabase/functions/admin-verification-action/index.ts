import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Body = {
  user_id?: string;
  action?: "approve_id" | "reject" | "list" | "signed_urls" | "mark_everify";
  notes?: string;
  everify_result?: "passed" | "failed";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !ANON || !SERVICE) {
      return new Response(JSON.stringify({ error: "Missing function environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr) throw roleErr;

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    if (body.action === "list") {
      const { data, error } = await admin
        .from("verifications")
        .select("user_id, status, ocr_full_name, ocr_date_of_birth, ocr_gender, ocr_psn, ocr_address, id_front_path, id_back_path, face_match_score, liveness_passed, admin_notes, submitted_at, verified_at, qr_payload, everify_status, everify_checked_at, everify_notes")
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, items: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "signed_urls") {
      if (!body.user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: row, error } = await admin
        .from("verifications")
        .select("id_front_path, id_back_path")
        .eq("user_id", body.user_id)
        .maybeSingle();

      if (error) throw error;

      if (!row) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [frontResult, backResult] = await Promise.all([
        admin.storage.from("id-documents").createSignedUrl(row.id_front_path, 60 * 10),
        admin.storage.from("id-documents").createSignedUrl(row.id_back_path, 60 * 10),
      ]);

      if (frontResult.error) throw frontResult.error;
      if (backResult.error) throw backResult.error;

      return new Response(JSON.stringify({
        ok: true,
        front: frontResult.data?.signedUrl,
        back: backResult.data?.signedUrl,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "mark_everify") {
      if (!body.user_id || !body.everify_result) {
        return new Response(JSON.stringify({ error: "user_id and everify_result are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (body.everify_result !== "passed" && body.everify_result !== "failed") {
        return new Response(JSON.stringify({ error: "everify_result must be 'passed' or 'failed'" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin
        .from("verifications")
        .update({
          everify_status: body.everify_result,
          everify_checked_at: new Date().toISOString(),
          everify_checked_by: userData.user.id,
          everify_notes: body.notes ?? null,
        })
        .eq("user_id", body.user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "approve_id") {
      if (!body.user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Require eVerify pass before allowing approval
      const { data: gate, error: gateErr } = await admin
        .from("verifications")
        .select("everify_status")
        .eq("user_id", body.user_id)
        .maybeSingle();
      if (gateErr) throw gateErr;
      if (!gate || gate.everify_status !== "passed") {
        return new Response(JSON.stringify({ error: "Mark eVerify as passed before approving the ID." }), {
          status: 412,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Pull all OCR fields so we can populate verified_users
      const { data: vrow, error: vrowErr } = await admin
        .from("verifications")
        .select("ocr_full_name, ocr_first_name, ocr_middle_name, ocr_last_name, ocr_document_number, ocr_psn, ocr_date_of_birth, ocr_address, ocr_sex, ocr_gender, ocr_nationality, ocr_place_of_birth, ocr_blood_type, ocr_marital_status, ocr_date_of_issue")
        .eq("user_id", body.user_id)
        .maybeSingle();
      if (vrowErr) throw vrowErr;
      if (!vrow) {
        return new Response(JSON.stringify({ error: "Verification not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fullName = vrow.ocr_full_name
        || [vrow.ocr_first_name, vrow.ocr_middle_name, vrow.ocr_last_name].filter(Boolean).join(" ").trim()
        || "Verified user";

      const { error: upsertErr } = await admin.from("verified_users").upsert({
        user_id: body.user_id,
        full_name: fullName,
        first_name: vrow.ocr_first_name,
        middle_name: vrow.ocr_middle_name,
        last_name: vrow.ocr_last_name,
        document_number: vrow.ocr_document_number ?? vrow.ocr_psn,
        date_of_birth: vrow.ocr_date_of_birth,
        address: vrow.ocr_address,
        sex: vrow.ocr_sex ?? vrow.ocr_gender,
        nationality: vrow.ocr_nationality,
        place_of_birth: vrow.ocr_place_of_birth,
        blood_type: vrow.ocr_blood_type,
        marital_status: vrow.ocr_marital_status,
        date_of_issue: vrow.ocr_date_of_issue,
        verified_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (upsertErr) throw upsertErr;

      // Mirror the verified full name onto the public profile so the header shows it
      await admin.from("profiles").update({ name: fullName }).eq("id", body.user_id);

      const { error } = await admin
        .from("verifications")
        .update({
          status: "id_approved",
          admin_notes: body.notes ?? null,
          id_approved_at: new Date().toISOString(),
          id_approved_by: userData.user.id,
        })
        .eq("user_id", body.user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "reject") {
      if (!body.user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin
        .from("verifications")
        .update({
          status: "rejected",
          admin_notes: body.notes ?? null,
        })
        .eq("user_id", body.user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-verification-action error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});