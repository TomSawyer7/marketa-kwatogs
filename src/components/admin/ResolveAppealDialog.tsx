import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Outcome = "approved_removed_entirely" | "approved_comment_only" | "rejected";

export function ResolveAppealDialog({
  appealId, open, onOpenChange, onResolved,
}: {
  appealId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResolved: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome>("approved_removed_entirely");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!appealId) return;
    if (notes.trim().length < 10) {
      toast.error("Please add an explanation (min 10 characters). It will be shown to both parties.");
      return;
    }
    setSubmitting(true);
    const payload =
      outcome === "approved_removed_entirely"
        ? { status: "Approved", resolution_kind: "removed_entirely", admin_notes: notes.trim() }
        : outcome === "approved_comment_only"
        ? { status: "Approved", resolution_kind: "removed_review_only", admin_notes: notes.trim() }
        : { status: "Rejected", resolution_kind: null, admin_notes: notes.trim() };

    const { error } = await (supabase.from("review_appeals") as any)
      .update(payload).eq("id", appealId);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Appeal resolved. Both parties have been notified.");
    setNotes(""); setOutcome("approved_removed_entirely");
    onOpenChange(false);
    onResolved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve appeal</DialogTitle>
          <DialogDescription>
            Choose the final outcome. Your explanation is sent to both the buyer and the seller.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as Outcome)} className="space-y-2">
          <label className="flex gap-3 items-start border rounded-md p-3 cursor-pointer hover:bg-muted/40">
            <RadioGroupItem value="approved_removed_entirely" id="opt-entire" className="mt-1" />
            <div>
              <Label htmlFor="opt-entire" className="font-medium cursor-pointer">Uphold — remove rating and review entirely</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Rating and comment are removed from the seller's profile and no longer count toward aggregate score.</p>
            </div>
          </label>
          <label className="flex gap-3 items-start border rounded-md p-3 cursor-pointer hover:bg-muted/40">
            <RadioGroupItem value="approved_comment_only" id="opt-text" className="mt-1" />
            <div>
              <Label htmlFor="opt-text" className="font-medium cursor-pointer">Uphold — remove written comment only</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Star rating remains; the written comment is cleared (use for abusive text with a valid rating).</p>
            </div>
          </label>
          <label className="flex gap-3 items-start border rounded-md p-3 cursor-pointer hover:bg-muted/40">
            <RadioGroupItem value="rejected" id="opt-reject" className="mt-1" />
            <div>
              <Label htmlFor="opt-reject" className="font-medium cursor-pointer">Dismiss — review is legitimate</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Original rating and review remain intact on the seller's profile.</p>
            </div>
          </label>
        </RadioGroup>

        <div>
          <Label htmlFor="admin-notes" className="text-sm">Explanation (sent to both parties)</Label>
          <Textarea id="admin-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Summarize the reasoning behind this decision…" rows={4} className="mt-1" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>Submit decision</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
