import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAccountStatus } from "@/hooks/use-account-status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Appeal = { id: string; status: "pending" | "approved" | "denied"; created_at: string; admin_note: string | null };

export function RestrictionBanner() {
  const { user } = useAuth();
  const { status, reason } = useAccountStatus();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [latest, setLatest] = useState<Appeal | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || status === "active") return;
    (async () => {
      const { data } = await supabase
        .from("account_appeals")
        .select("id, status, created_at, admin_note")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLatest((data as Appeal) ?? null);
    })();
  }, [user, status, open]);

  if (!user || status === "active") return null;

  const submit = async () => {
    if (message.trim().length < 20) { toast.error("Please write at least 20 characters"); return; }
    setBusy(true);
    const { error } = await supabase.from("account_appeals").insert({
      user_id: user.id, message: message.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Appeal submitted — admins will review it");
    setMessage(""); setOpen(false);
  };

  const isSuspended = status === "suspended";
  const canAppeal = !latest || latest.status !== "pending";

  return (
    <>
      <div className={`border-b ${isSuspended ? "bg-destructive/10 border-destructive/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm">
          {isSuspended ? <ShieldAlert className="h-4 w-4 text-destructive shrink-0" /> : <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />}
          <div className="flex-1 min-w-0">
            <span className="font-medium">
              {isSuspended ? "Your account is suspended." : "Your account has been restricted."}
            </span>{" "}
            <span className="text-muted-foreground">
              You can browse but can't list items or leave reviews
              {reason ? ` (${reason.replace(/^auto:/, "reason: ")})` : ""}.
              {latest?.status === "pending" && " Your appeal is pending admin review."}
              {latest?.status === "denied" && latest.admin_note && ` Last appeal denied: ${latest.admin_note}`}
            </span>
          </div>
          <Button size="sm" variant={isSuspended ? "destructive" : "default"} onClick={() => setOpen(true)} disabled={!canAppeal}>
            {latest?.status === "pending" ? "Appeal pending" : "Submit appeal"}
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appeal account restriction</DialogTitle>
            <DialogDescription>Explain what happened. An admin will review your appeal and decide.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            placeholder="Describe the situation and why the restriction should be lifted…"
          />
          <div className="text-right text-xs text-muted-foreground">{message.length}/1000</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !canAppeal}>{busy ? "Submitting…" : "Submit appeal"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
