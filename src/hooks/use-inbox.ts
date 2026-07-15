import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Thread } from "@/lib/inbox";

export type InboxRow = {
  thread: Thread;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  lastBody: string;
  lastFromMe: boolean;
  unread: number;
  hasActiveTx: boolean;
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

      const [{ data: profiles }, { data: lastMsgs }, { data: unread }, { data: activeTx }] =
        await Promise.all([
          supabase.from("profiles").select("id, name, avatar_url").in("id", otherIds),
          supabase
            .from("messages")
            .select("thread_id, body, sender_id, created_at, kind")
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
        ]);

      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const lastByThread = new Map<string, { body: string; sender_id: string | null; kind: string }>();
      for (const m of lastMsgs ?? []) {
        if (!lastByThread.has(m.thread_id))
          lastByThread.set(m.thread_id, { body: m.body, sender_id: m.sender_id, kind: m.kind });
      }
      const unreadCount = new Map<string, number>();
      for (const u of unread ?? [])
        unreadCount.set(u.thread_id, (unreadCount.get(u.thread_id) ?? 0) + 1);
      const activeSet = new Set((activeTx ?? []).map((t) => t.thread_id));

      const out: InboxRow[] = threads.map((t) => {
        const otherId = t.user_a === user.id ? t.user_b : t.user_a;
        const p = pMap.get(otherId);
        const last = lastByThread.get(t.id);
        return {
          thread: t as Thread,
          otherId,
          otherName: (p?.name as string) ?? "Unknown",
          otherAvatar: (p?.avatar_url as string) ?? null,
          lastBody: last
            ? last.kind === "system"
              ? last.body
              : last.body
            : "No messages yet",
          lastFromMe: last?.sender_id === user.id,
          unread: unreadCount.get(t.id) ?? 0,
          hasActiveTx: activeSet.has(t.id),
        };
      });
      if (!cancelled) setRows(out);
    })();

    return () => { cancelled = true; };
  }, [user, refresh]);

  // Realtime: refresh on any new message
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
