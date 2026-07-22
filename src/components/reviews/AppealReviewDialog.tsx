import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

export function AppealReviewDialog({
  open, onOpenChange, reviewId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reviewId: string;
  onCreated?: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (reason.trim().length < 20) { toast.error("Please describe the issue in at least 20 characters"); return; }
    setSubmitting(true);
    try {
      // fetch review to derive transaction/buyer
      const { data: rev, error: rerr } = await supabase
        .from("reviews")
        .select("id, transaction_id, reviewer_id, reviewee_id")
        .eq("id", reviewId)
        .maybeSingle();
      if (rerr || !rev) throw new Error(rerr?.message ?? "Review not found");
      if (rev.reviewee_id !== user.id) throw new Error("Only the reviewee can appeal");

      // upload evidence
      const urls: string[] = [];
      for (const f of files) {
        const key = `${user.id}/${reviewId}/${Date.now()}-${f.name}`;
        const { error: uerr } = await supabase.storage.from("appeal-evidence").upload(key, f, { upsert: false });
        if (uerr) throw uerr;
        urls.push(key);
      }

      const { error: ierr } = await (supabase.from("review_appeals") as any).insert({
        review_id: reviewId,
        transaction_id: rev.transaction_id,
        seller_id: user.id,
        buyer_id: rev.reviewer_id,
        reason: reason.trim(),
        evidence_urls: urls,
      });
      if (ierr) throw ierr;

      // notify buyer via system message in the thread linked to this transaction
      const { data: tx } = await supabase.from("transactions").select("thread_id").eq("id", rev.transaction_id).maybeSingle();
      if (tx?.thread_id) {
        await supabase.from("messages").insert({
          thread_id: tx.thread_id,
          sender_id: user.id,
          kind: "text",
          body: "The seller has filed an appeal against a review on this transaction. Please review the consent request in your Appeals center.",
        } as any);
      }

      toast.success("Appeal submitted for admin review");
      onOpenChange(false);
      setReason(""); setFiles([]);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message ?? "Could not file appeal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Appeal this review</DialogTitle>
          <DialogDescription>
            Explain why this review is unfair or malicious. Admins will review your appeal and may request the buyer's consent to audit the chat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="appeal-reason">Reason</Label>
            <Textarea
              id="appeal-reason"
              rows={5}
              placeholder="Describe what's inaccurate or misleading…"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 2000))}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">{reason.length}/2000</p>
          </div>
          <div>
            <Label>Evidence (optional)</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-dashed cursor-pointer hover:bg-accent">
                <Upload className="h-3.5 w-3.5" />
                Attach files
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 6))}
                />
              </label>
              <span className="text-xs text-muted-foreground">Up to 6 files</span>
            </div>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="text-xs flex items-center justify-between gap-2 bg-muted rounded px-2 py-1">
                    <span className="truncate">{f.name}</span>
                    <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit appeal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
