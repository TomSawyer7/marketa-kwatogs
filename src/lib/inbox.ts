import { supabase } from "@/integrations/supabase/client";

export type Thread = {
  id: string;
  user_a: string;
  user_b: string;
  listing_id: string | null;
  transaction_id: string | null;
  last_message_at: string;
  created_at: string;
};

export type Message = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string;
  kind: "text" | "system" | "proposal" | "completion_request";
  meta: Record<string, unknown>;
  read_at: string | null;
  image_url: string | null;
  created_at: string;
};

export function pairIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getOrCreateThread(
  meId: string,
  otherId: string,
  listingId?: string | null,
): Promise<string> {
  const [ua, ub] = pairIds(meId, otherId);

  const findExisting = async () => {
    const q = supabase.from("threads").select("id").eq("user_a", ua).eq("user_b", ub);
    const { data } = listingId
      ? await q.eq("listing_id", listingId).maybeSingle()
      : await q.is("listing_id", null).maybeSingle();
    return data?.id ?? null;
  };

  const existing = await findExisting();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("threads")
    .insert({ user_a: ua, user_b: ub, listing_id: listingId ?? null })
    .select("id")
    .single();

  if (error) {
    // Race: another tab created it — pick up the existing row via the unique index.
    if ((error as { code?: string }).code === "23505") {
      const again = await findExisting();
      if (again) return again;
    }
    throw error;
  }
  return data.id;
}

export function otherParticipant(t: Pick<Thread, "user_a" | "user_b">, meId: string) {
  return t.user_a === meId ? t.user_b : t.user_a;
}
