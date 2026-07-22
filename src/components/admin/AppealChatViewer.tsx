import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useSignedUrl } from "@/hooks/use-signed-url";

type Msg = {
  id: string;
  sender_id: string | null;
  body: string | null;
  image_url: string | null;
  kind: string;
  created_at: string;
  is_unsent: boolean;
};

type Profile = { id: string; name: string | null; avatar_url: string | null };

function ChatImage({ path }: { path: string }) {
  const url = useSignedUrl("chat-attachments", path);
  if (!url) return <div className="h-40 w-56 rounded bg-muted animate-pulse" />;
  return <img src={url} alt="attachment" className="max-h-64 rounded border" />;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

export function AppealChatViewer({
  open,
  onOpenChange,
  transactionId,
  appealStatus,
  bothConsented,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transactionId: string | null;
  appealStatus: string;
  bothConsented: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [error, setError] = useState<string | null>(null);

  const inAuditWindow = bothConsented && ["Under Review", "Waiting for Additional Evidence"].includes(appealStatus);

  const load = useCallback(async () => {
    if (!transactionId) return;
    setLoading(true); setError(null);
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("thread_id, buyer_id, seller_id")
      .eq("id", transactionId)
      .maybeSingle();
    if (txErr || !tx) { setError(txErr?.message ?? "Transaction not found"); setLoading(false); return; }
    setThreadId(tx.thread_id); setBuyerId(tx.buyer_id); setSellerId(tx.seller_id);

    if (!tx.thread_id) { setMessages([]); setLoading(false); return; }

    const { data: msgs, error: mErr } = await supabase
      .from("messages")
      .select("id, sender_id, body, image_url, kind, created_at, is_unsent")
      .eq("thread_id", tx.thread_id)
      .order("created_at", { ascending: true });
    if (mErr) { setError(mErr.message); setLoading(false); return; }
    setMessages((msgs as Msg[]) ?? []);

    const ids = [tx.buyer_id, tx.seller_id].filter(Boolean) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, name, avatar_url").in("id", ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  }, [transactionId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Chat audit
          </DialogTitle>
          <DialogDescription>
            Read-only transcript. Access is granted only while both parties consent and the appeal is under review.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Badge variant={bothConsented ? "default" : "outline"}>
            Consent: {bothConsented ? "granted by both" : "incomplete"}
          </Badge>
          <Badge variant="secondary">{appealStatus}</Badge>
          <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {!inAuditWindow && (
          <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/40">
            {bothConsented
              ? "The appeal must be set to 'Under Review' (or 'Waiting for Additional Evidence') to unlock chat access."
              : "Waiting for both buyer and seller to grant consent."}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto space-y-2 border rounded-md p-3 bg-background">
          {loading && <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>}
          {error && <div className="text-sm text-destructive py-3">{error}</div>}
          {!loading && !error && messages.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              {inAuditWindow ? "No messages in this conversation." : "No messages visible."}
            </div>
          )}
          {messages.map((m) => {
            if (m.kind === "system") {
              return (
                <div key={m.id} className="text-center text-[11px] text-muted-foreground py-1">
                  {m.body} · {fmt(m.created_at)}
                </div>
              );
            }
            const isBuyer = m.sender_id === buyerId;
            const profile = m.sender_id ? profiles[m.sender_id] : undefined;
            const name = profile?.name ?? (isBuyer ? "Buyer" : m.sender_id === sellerId ? "Seller" : "User");
            const roleLabel = isBuyer ? "Buyer" : m.sender_id === sellerId ? "Seller" : "";
            return (
              <div key={m.id} className={`flex gap-2 ${isBuyer ? "" : "flex-row-reverse"}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback>{name[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] ${isBuyer ? "" : "items-end"} flex flex-col`}>
                  <div className="text-[10px] text-muted-foreground mb-0.5">
                    {name} <span className="opacity-70">· {roleLabel} · {fmt(m.created_at)}</span>
                  </div>
                  <div className={`rounded-2xl px-3 py-2 text-sm ${isBuyer ? "bg-muted rounded-bl-sm" : "bg-primary/10 rounded-br-sm"}`}>
                    {m.is_unsent ? (
                      <em className="text-muted-foreground">Message unsent</em>
                    ) : m.image_url ? (
                      <div className="space-y-1">
                        <ChatImage path={m.image_url} />
                        {m.body && <div>{m.body}</div>}
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap break-words">{m.body}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
