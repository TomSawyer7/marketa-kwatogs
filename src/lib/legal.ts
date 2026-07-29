import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/audit";
import { LEGAL_VERSIONS, type LegalDocument } from "@/lib/legal-version";

export type AcceptanceContext = "registration" | "kyc" | "settings";

/** Fire-and-forget acceptance record. Never throws — legal capture must not break UX. */
export async function recordAcceptance(
  document: LegalDocument,
  context: AcceptanceContext,
  userId?: string | null,
): Promise<void> {
  const version = LEGAL_VERSIONS[document];
  try {
    let uid = userId ?? null;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id ?? null;
    }
    if (!uid) return;
    const user_agent =
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;
    await supabase.from("legal_acceptances").insert({
      user_id: uid,
      document,
      version,
      context,
      user_agent,
    });
    logEvent({
      category: "legal",
      action: `accept_${document}`,
      metadata: { version, context },
    });
  } catch {
    /* swallow — legal capture is best-effort */
  }
}

export async function fetchLatestAcceptances(userId: string) {
  const { data } = await supabase
    .from("legal_acceptances")
    .select("document, version, accepted_at")
    .eq("user_id", userId)
    .order("accepted_at", { ascending: false });
  const latest: Record<string, { version: string; accepted_at: string }> = {};
  (data ?? []).forEach((row) => {
    if (!latest[row.document]) {
      latest[row.document] = { version: row.version, accepted_at: row.accepted_at };
    }
  });
  return latest;
}
