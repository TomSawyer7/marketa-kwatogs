import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKETS = ["id-documents", "liveness-media", "avatars", "appeal-evidence"];

async function purgeUserFiles(admin: ReturnType<typeof createClient>, userId: string) {
  for (const bucket of BUCKETS) {
    // Files are stored under a `<user_id>/...` prefix in every bucket.
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    if (error || !data?.length) continue;
    const paths = data.map((f) => `${userId}/${f.name}`);
    await admin.storage.from(bucket).remove(paths);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secrets = [Deno.env.get("CRON_TRIGGER_TOKEN"), Deno.env.get("CRON_SECRET")].filter(
    Boolean,
  ) as string[];
  const provided = req.headers.get("x-cron-secret");
  if (!secrets.length || !provided || !secrets.includes(provided)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nowIso = new Date().toISOString();
  const result = { reactivated: 0, deleted: 0, errors: [] as string[] };

  try {
    // 1. Auto-reactivate expired deactivations
    const { data: due } = await admin
      .from("account_lifecycle")
      .select("user_id")
      .eq("state", "deactivated")
      .not("reactivate_at", "is", null)
      .lte("reactivate_at", nowIso);

    for (const row of due ?? []) {
      const { error } = await admin
        .from("account_lifecycle")
        .update({
          state: "active",
          deactivated_at: null,
          reactivate_at: null,
          deactivation_days: null,
        })
        .eq("user_id", row.user_id);
      if (error) result.errors.push(`reactivate ${row.user_id}: ${error.message}`);
      else result.reactivated++;
    }

    // 2. Finalize deletions whose grace period expired
    const { data: toDelete } = await admin
      .from("account_lifecycle")
      .select("user_id, deletion_requested_at")
      .eq("state", "pending_deletion")
      .lte("delete_after", nowIso);

    for (const row of toDelete ?? []) {
      const uid = row.user_id as string;
      try {
        const { data: kyc } = await admin
          .from("verifications")
          .select("user_id")
          .eq("user_id", uid)
          .maybeSingle();

        // Anonymize the public profile — history stays attributed to it.
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

        // Drop all extracted KYC / liveness / credential records.
        await admin.from("verified_users").delete().eq("user_id", uid);
        await admin.from("verifications").delete().eq("user_id", uid);
        await admin.from("user_mpins").delete().eq("user_id", uid);

        // Permanently remove raw sensitive files.
        await purgeUserFiles(admin, uid);

        // Anonymize the auth identity but KEEP the row so every foreign key
        // on transactions / reviews / threads stays intact.
        await admin.auth.admin.updateUserById(uid, {
          email: `deleted+${uid}@deleted.invalid`,
          phone: undefined,
          user_metadata: { name: "Deleted User", deleted: true },
          ban_duration: "876000h",
        });

        await admin
          .from("account_lifecycle")
          .update({ state: "deleted", delete_after: null })
          .eq("user_id", uid);

        // Audit log: no personal data, only that a deletion occurred.
        await admin.from("account_deletion_log").insert({
          grace_started_at: row.deletion_requested_at,
          deleted_at: nowIso,
          had_kyc: Boolean(kyc),
        });

        result.deleted++;
      } catch (e) {
        result.errors.push(`delete ${uid}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("account-lifecycle-cron failed", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
