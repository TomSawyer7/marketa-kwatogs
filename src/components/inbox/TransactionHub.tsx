import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ProposalDialog } from "./ProposalDialog";
import { CheckCircle2, Circle, Handshake, MessageSquareText, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TxRow } from "@/hooks/use-thread-transaction";
import { useAuth } from "@/hooks/use-auth";

const STAGES = [
  { key: "discussion", label: "In Discussion" },
  { key: "marked_done", label: "Marked Done" },
  { key: "completed", label: "Completed" },
] as const;

function stageIndex(tx: TxRow | null): number {
  if (!tx) return 0;
  if (tx.status === "completed") return 2;
  if (tx.status === "seller_completed") return 1;
  return 0;
}

function Stepper({ idx }: { idx: number }) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2 w-full">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.key} className="flex items-center flex-1 min-w-0 last:flex-none">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "grid place-items-center h-5 w-5 rounded-full border shrink-0 transition-colors",
                  done && "bg-primary border-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-muted-foreground/30 text-muted-foreground/60",
                )}
                aria-hidden
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : active ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium truncate hidden sm:inline",
                  active ? "text-foreground" : done ? "text-foreground/80" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-2 sm:mx-3 transition-colors",
                  i < idx ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function TransactionHub({
  threadId,
  otherId,
  tx,
  onRate,
  canRate,
}: {
  threadId: string;
  otherId: string;
  tx: TxRow | null;
  onRate: () => void;
  canRate: boolean;
}) {
  const { user } = useAuth();
  const [propOpen, setPropOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const idx = stageIndex(tx);

  const myRole: "buyer" | "seller" | null =
    tx && user ? (tx.buyer_id === user.id ? "buyer" : tx.seller_id === user.id ? "seller" : null) : null;

  const markAsDone = async () => {
    if (!tx || myRole !== "seller") return;
    setBusy(true);
    const { error } = await supabase
      .from("transactions")
      .update({ status: "seller_completed" })
      .eq("id", tx.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as done. Waiting for buyer confirmation.");
  };

  const confirmComplete = async () => {
    if (!tx || myRole !== "buyer") return;
    setBusy(true);
    const { error } = await supabase
      .from("transactions")
      .update({ status: "completed" })
      .eq("id", tx.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Transaction confirmed!");
    onRate();
  };

  // Contextual action row — a single primary action per state.
  const renderAction = () => {
    if (!tx) {
      return (
        <Button size="sm" className="rounded-full gap-1.5" onClick={() => setPropOpen(true)}>
          <MessageSquareText className="h-4 w-4" /> Create Proposal
        </Button>
      );
    }
    if (tx.status === "completed") {
      return canRate ? (
        <Button size="sm" className="rounded-full gap-1.5" onClick={onRate}>
          <Star className="h-4 w-4" /> Write a Review
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Transaction completed.</span>
      );
    }
    if (tx.status === "seller_completed") {
      return myRole === "buyer" ? (
        <Button size="sm" className="rounded-full gap-1.5" disabled={busy} onClick={confirmComplete}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirm &amp; Rate Seller
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Waiting for buyer confirmation…</span>
      );
    }
    // proposed / agreed / discussion
    return myRole === "seller" ? (
      <Button size="sm" className="rounded-full gap-1.5" disabled={busy} onClick={markAsDone}>
        <Handshake className="h-4 w-4" />
        {busy ? "Marking…" : "Mark as Done"}
      </Button>
    ) : (
      <span className="text-xs text-muted-foreground">Waiting for seller to mark as done…</span>
    );
  };

  return (
    <div className="border-b border-border bg-card/60 backdrop-blur px-3 md:px-4 py-2.5">
      <Stepper idx={idx} />
      <div className="mt-2.5 flex items-center justify-end gap-2 min-h-[32px]">
        {renderAction()}
      </div>

      <ProposalDialog
        open={propOpen}
        onOpenChange={setPropOpen}
        threadId={threadId}
        otherId={otherId}
        onCreated={() => { /* realtime refresh */ }}
      />
    </div>
  );
}
