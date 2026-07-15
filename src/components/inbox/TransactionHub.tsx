import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProposalDialog } from "./ProposalDialog";
import { CheckCircle2, Handshake, MessageSquareText, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TxRow } from "@/hooks/use-thread-transaction";
import { useAuth } from "@/hooks/use-auth";

const STAGES: { key: string; label: string }[] = [
  { key: "discussion", label: "In Discussion" },
  { key: "agreed", label: "Agreement Made" },
  { key: "completed", label: "Completed" },
];

function stageIndex(tx: TxRow | null): number {
  if (!tx) return 0;
  if (tx.status === "completed") return 2;
  if (tx.status === "agreed" || tx.buyer_confirmed_at || tx.seller_confirmed_at) return 1;
  return 0;
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
  const markComplete = async () => {
    if (!tx || myRole !== "seller") return;
    setBusy(true);
    const { error } = await supabase
      .from("transactions")
      .update({ status: "completed", confirmed_at: new Date().toISOString() })
      .eq("id", tx.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Transaction marked as completed.");
  };

  return (
    <div className="border-b border-border bg-card/60 backdrop-blur px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <Badge
              variant={i <= idx ? "default" : "outline"}
              className={cn("rounded-full text-[10px] uppercase tracking-wide", i === idx && "ring-2 ring-primary/40")}
            >
              {i === 2 && idx === 2 ? <CheckCircle2 className="h-3 w-3 mr-1" /> : null}
              {s.label}
            </Badge>
            {i < STAGES.length - 1 && <span className="text-muted-foreground text-xs">›</span>}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!tx && (
          <Button size="sm" variant="secondary" className="rounded-full gap-1.5" onClick={() => setPropOpen(true)}>
            <MessageSquareText className="h-4 w-4" /> Create Proposal
          </Button>
        )}
        {tx && tx.status !== "completed" && myRole === "seller" && (
          <Button size="sm" className="rounded-full gap-1.5" disabled={busy} onClick={markComplete}>
            <Handshake className="h-4 w-4" />
            {busy ? "Marking…" : "Mark Transaction as Done"}
          </Button>
        )}
        {tx && tx.status !== "completed" && myRole === "buyer" && (
          <span className="text-xs text-muted-foreground self-center">Waiting for seller to mark as done…</span>
        )}
        {tx?.status === "completed" && canRate && (
          <Button size="sm" variant="default" className="rounded-full gap-1.5" onClick={onRate}>
            <Star className="h-4 w-4" /> Rate them
          </Button>
        )}
      </div>

      <ProposalDialog
        open={propOpen}
        onOpenChange={setPropOpen}
        threadId={threadId}
        otherId={otherId}
        onCreated={() => { /* realtime will refresh */ }}
      />
    </div>
  );
}
