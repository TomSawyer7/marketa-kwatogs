import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Thread } from "@/lib/inbox";

export type InboxListing = {
  id: string;
  title: string;
  price: number;
  image: string | null;
};

export type InboxRow = {
  thread: Thread;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  lastBody: string;
  lastFromMe: boolean;
  unread: number;
  hasActiveTx: boolean;
  listing: InboxListing | null;
};

export function useInbox() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data: threads } = await supabase
        .from("threads")
        .select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

      if (!threads || threads.length === 0) {
        if (!cancelled) setRows([]);
        return;
      }

      const otherIds = Array.from(
        new Set(threads.map((t) => (t.user_a === user.id ? t.user_b : t.user_a))),
      );
      const threadIds = threads.map((t) => t.id);
      const listingIds = Array.from(
        new Set(threads.map((t) => t.listing_id).filter(Boolean) as string[]),
      );

      const [{ data: profiles }, { data: lastMsgs }, { data: unread }, { data: activeTx }, { data: listings }] =
        await Promise.all([
          supabase.from("profiles").select("id, name, avatar_url").in("id", otherIds),
          supabase
            .from("messages")
            .select("thread_id, body, sender_id, created_at, kind, image_url")
            .in("thread_id", threadIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("messages")
            .select("thread_id")
            .in("thread_id", threadIds)
            .is("read_at", null)
            .neq("sender_id", user.id),
          supabase
            .from("transactions")
            .select("thread_id, status")
            .in("thread_id", threadIds)
            .in("status", ["proposed", "agreed", "pending"]),
          listingIds.length
            ? supabase.from("listings").select("id, title, price, images").in("id", listingIds)
            : Promise.resolve({ data: [] as { id: string; title: string; price: number; images: string[] }[] }),
        ]);

      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const lMap = new Map(
        (listings ?? []).map((l) => [
          l.id,
          { id: l.id, title: l.title, price: l.price, image: l.images?.[0] ?? null } as InboxListing,
        ]),
      );
      const lastByThread = new Map<
        string,
        { body: string; sender_id: string | null; kind: string; image_url: string | null }
      >();
      for (const m of lastMsgs ?? []) {
        if (!lastByThread.has(m.thread_id))
          lastByThread.set(m.thread_id, {
            body: m.body,
            sender_id: m.sender_id,
            kind: m.kind,
            image_url: (m as { image_url: string | null }).image_url ?? null,
          });
      }
      const unreadCount = new Map<string, number>();
      for (const u of unread ?? [])
        unreadCount.set(u.thread_id, (unreadCount.get(u.thread_id) ?? 0) + 1);
      const activeSet = new Set((activeTx ?? []).map((t) => t.thread_id));

      const out: InboxRow[] = threads.map((t) => {
        const otherId = t.user_a === user.id ? t.user_b : t.user_a;
        const p = pMap.get(otherId);
        const last = lastByThread.get(t.id);
        const preview = last
          ? last.image_url
            ? last.body?.trim() || "📷 Photo"
            : last.body
          : "No messages yet";
        return {
          thread: t as Thread,
          otherId,
          otherName: (p?.name as string) ?? "Unknown",
          otherAvatar: (p?.avatar_url as string) ?? null,
          lastBody: preview,
          lastFromMe: last?.sender_id === user.id,
          unread: unreadCount.get(t.id) ?? 0,
          hasActiveTx: activeSet.has(t.id),
          listing: t.listing_id ? lMap.get(t.listing_id) ?? null : null,
        };
      });
      if (!cancelled) setRows(out);
    })();

    return () => { cancelled = true; };
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () =>
        setRefresh((k) => k + 1),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "threads" }, () =>
        setRefresh((k) => k + 1),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return rows;
}
