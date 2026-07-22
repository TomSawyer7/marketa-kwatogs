import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Message, Thread } from "@/lib/inbox";

export type ChatState = {
  thread: Thread | null;
  messages: Message[];
  loading: boolean;
  otherId: string | null;
  otherProfile: { id: string; name: string; avatar_url: string | null } | null;
  typing: boolean;
  online: boolean;
  send: (body: string) => Promise<void>;
  sendImage: (file: File, caption?: string) => Promise<void>;
  sendTyping: () => void;
};

export function useThread(threadId: string | undefined): ChatState {
  const { user } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [otherProfile, setOtherProfile] = useState<ChatState["otherProfile"]>(null);
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<number | null>(null);

  const otherId =
    thread && user ? (thread.user_a === user.id ? thread.user_b : thread.user_a) : null;

  // Fetch thread + messages + other profile
  useEffect(() => {
    if (!threadId || !user) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data: t } = await supabase
        .from("threads")
        .select("*")
        .eq("id", threadId)
        .maybeSingle();
      if (cancelled || !t) { setLoading(false); return; }
      setThread(t as Thread);

      const other = t.user_a === user.id ? t.user_b : t.user_a;
      const [{ data: msgs }, { data: prof }] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("id, name, avatar_url").eq("id", other).maybeSingle(),
      ]);

      if (cancelled) return;
      setMessages((msgs ?? []) as Message[]);
      setOtherProfile(prof as ChatState["otherProfile"]);
      setLoading(false);

      // mark unread messages read
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("thread_id", threadId)
        .neq("sender_id", user.id)
        .is("read_at", null);
    })();

    return () => { cancelled = true; };
  }, [threadId, user]);

  // Realtime + presence
  useEffect(() => {
    if (!threadId || !user || !otherId) return;

    const ch = supabase.channel(`thread:${threadId}`, {
      config: { presence: { key: user.id } },
    });

    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
      (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id && m.sender_id !== user.id) {
          supabase
            .from("messages")
            .update({ read_at: new Date().toISOString() })
            .eq("id", m.id)
            .then(() => {});
        }
      },
    );
    ch.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
      (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      },
    );
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.userId && payload.userId !== user.id) {
        setTyping(true);
        if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
        typingTimeout.current = window.setTimeout(() => setTyping(false), 2500);
      }
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, unknown[]>;
      setOnline(Boolean(state[otherId]?.length));
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ userId: user.id, at: Date.now() });
    });
    channelRef.current = ch;

    return () => {
      if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [threadId, user, otherId]);

  const send = useCallback(
    async (body: string) => {
      if (!threadId || !user || !body.trim()) return;
      const { error } = await supabase.from("messages").insert({
        thread_id: threadId,
        sender_id: user.id,
        body: body.trim(),
        kind: "text",
      });
      if (error) throw error;
    },
    [threadId, user],
  );

  const sendImage = useCallback(
    async (file: File, caption?: string) => {
      if (!threadId || !user) return;
      if (!file.type.startsWith("image/")) throw new Error("Only image files are supported.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${threadId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("messages").insert({
        thread_id: threadId,
        sender_id: user.id,
        body: caption?.trim() ?? "",
        kind: "text",
        image_url: path,
      });
      if (error) throw error;
    },
    [threadId, user],
  );

  const sendTyping = useCallback(() => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: user.id } });
  }, [user]);

  return {
    thread,
    messages,
    loading,
    otherId,
    otherProfile,
    typing,
    online,
    send,
    sendImage,
    sendTyping,
  };
}
