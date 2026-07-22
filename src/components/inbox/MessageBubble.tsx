import { useState } from "react";
import { formatRelative } from "@/lib/format";
import { Check, CheckCheck, CheckCircle2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSignedUrl } from "@/hooks/use-signed-url";
import type { Message } from "@/lib/inbox";
import type { TxRow } from "@/hooks/use-thread-transaction";

type Props = {
  m: Message;
  mine: boolean;
  tx?: TxRow | null;
  viewerRole?: "buyer" | "seller" | null;
  onConfirmed?: () => void;
};

export function MessageBubble({ m, mine, tx, viewerRole, onConfirmed }: Props) {
  const [busy, setBusy] = useState<"confirm" | "dispute" | null>(null);

  if (m.kind === "system") {
    const event = (m.meta as { event?: string; transaction_id?: string } | undefined)?.event;
    const metaTxId = (m.meta as { transaction_id?: string } | undefined)?.transaction_id;
    const isCurrentTx = tx && metaTxId === tx.id;

    // Buyer confirmation card
    if (event === "seller_completed" && viewerRole === "buyer" && isCurrentTx && tx?.status === "seller_completed") {
      const act = async (kind: "confirm" | "dispute") => {
        if (!tx) return;
        setBusy(kind);
        const { error } = await supabase
          .from("transactions")
          .update({ status: kind === "confirm" ? "completed" : "discussion" })
          .eq("id", tx.id);
        setBusy(null);
        if (error) { toast.error(error.message); return; }
        if (kind === "confirm") { toast.success("Transaction confirmed."); onConfirmed?.(); }
        else toast("Marked as not yet complete.");
      };
      return (
        <div className="my-3 flex justify-center">
          <div className="w-full max-w-md rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-center shadow-sm">
            <div className="text-sm font-medium text-foreground">
              The seller has marked this transaction as completed.
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Did you receive your item/service?
            </div>
            <div className="mt-3 flex justify-center gap-2">
              <Button size="sm" className="rounded-full gap-1.5" disabled={!!busy} onClick={() => act("confirm")}>
                <CheckCircle2 className="h-4 w-4" />
                {busy === "confirm" ? "Confirming…" : "Confirm & Rate"}
              </Button>
              <Button size="sm" variant="outline" className="rounded-full gap-1.5" disabled={!!busy} onClick={() => act("dispute")}>
                <ShieldAlert className="h-4 w-4" />
                {busy === "dispute" ? "…" : "Dispute / Not Yet"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Seller sees a slightly richer pill for their own mark-as-done event
    if (event === "seller_completed" && viewerRole === "seller") {
      return (
        <div className="my-3 flex justify-center">
          <div className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-center max-w-md">
            You marked this transaction as done. Waiting for the buyer to confirm.
          </div>
        </div>
      );
    }

    return (
      <div className="my-3 flex justify-center">
        <div className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-center max-w-md">
          {m.body}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className="max-w-[75%]">
        {m.image_url ? <ImageBubble path={m.image_url} caption={m.body} mine={mine} /> : (
          <div
            className={cn(
              "px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words",
              mine
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm",
            )}
          >
            {m.body}
          </div>
        )}
        <div className={cn("mt-1 flex items-center gap-1 text-[10px] text-muted-foreground", mine ? "justify-end" : "justify-start")}>
          <span>{formatRelative(new Date(m.created_at).getTime())}</span>
          {mine && (m.read_at ? <CheckCheck className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3" />)}
        </div>
      </div>
    </div>
  );
}

function ImageBubble({ path, caption, mine }: { path: string; caption: string; mine: boolean }) {
  const url = useSignedUrl("chat-attachments", path);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl",
        mine ? "rounded-br-sm" : "rounded-bl-sm",
      )}
    >
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img src={url} alt={caption || "attachment"} className="max-h-72 w-auto object-cover" />
        </a>
      ) : (
        <div className="h-40 w-56 bg-muted animate-pulse" />
      )}
      {caption?.trim() && (
        <div
          className={cn(
            "px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
            mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
