import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKETS = ["id-documents", "liveness-media", "avatars", "appeal-evidence"];

async function purgeUserFiles(admin: ReturnType<typeof createClient>, userId: string) {
  for (const bucket of BUCKETS) {
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    if (error || !data?.length) continue;
    await admin.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const asUser = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    const uid = userData?.user?.id;
    if (userErr || !uid) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json().catch(() => ({}))) as { mpin?: string };
    if (!body.mpin || !/^[0-9]{6}$/.test(body.mpin)) {
      return json({ error: "MPIN required" }, 400);
    }

    // Re-verify the MPIN server-side as the caller's identity.
    const { data: check, error: checkErr } = await asUser.rpc("verify_mpin", { _mpin: body.mpin });
    if (checkErr || !(check as { ok?: boolean } | null)?.ok) {
      return json({ error: "Incorrect MPIN." }, 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const nowIso = new Date().toISOString();
    const { data: kyc } = await admin
      .from("verifications")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();

    await admin
      .from("profiles")
      .update({
        name: "Deleted User",
        first_name: null,
        last_name: null,
        email: null,
        bio: null,
        location: null,
        avatar_url: null,
        is_verified: false,
        visibility: "private",
      })
      .eq("id", uid);

    await admin.from("listings").update({ archived_at: nowIso }).eq("seller_id", uid);
    await admin.from("verified_users").delete().eq("user_id", uid);
    await admin.from("verifications").delete().eq("user_id", uid);
    await admin.from("user_mpins").delete().eq("user_id", uid);
    await purgeUserFiles(admin, uid);

    await admin.auth.admin.updateUserById(uid, {
      email: `deleted+${uid}@deleted.invalid`,
      user_metadata: { name: "Deleted User", deleted: true },
      ban_duration: "876000h",
    });

    await admin
      .from("account_lifecycle")
      .upsert(
        {
          user_id: uid,
          state: "deleted",
          deletion_requested_at: nowIso,
          delete_after: null,
          updated_at: nowIso,
        },
        { onConflict: "user_id" },
      );

    await admin.from("account_deletion_log").insert({
      grace_started_at: nowIso,
      deleted_at: nowIso,
      had_kyc: Boolean(kyc),
    });

    // Revoke every active session for this user.
    await admin.auth.admin.signOut(authHeader.replace("Bearer ", ""), "global").catch(() => {});

    return json({ ok: true });
  } catch (e) {
    console.error("account-delete-now failed", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
