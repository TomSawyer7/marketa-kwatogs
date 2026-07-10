import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RatingStars } from "./RatingStars";
import { ALL_TAGS, MAX_COMMENT, MAX_TAGS, ReviewTag } from "@/lib/reviews";
import { cn } from "@/lib/utils";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.enum(ALL_TAGS)).max(MAX_TAGS),
  comment: z.string().max(MAX_COMMENT).optional(),
});

export function ReviewForm({
  open, onOpenChange, transactionId, revieweeId, role, revieweeName, onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transactionId: string;
  revieweeId: string;
  role: "buyer" | "seller";
  revieweeName: string;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (t: ReviewTag) => {
    setTags((prev) =>
      prev.includes(t)
        ? prev.filter((x) => x !== t)
        : prev.length >= MAX_TAGS ? prev : [...prev, t],
    );
  };

  const submit = async () => {
    const parsed = schema.safeParse({ rating, tags, comment: comment.trim() || undefined });
    if (!parsed.success) {
      toast.error("Please give a star rating");
      return;
    }
    setSubmitting(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setSubmitting(false); return; }
    const { error } = await supabase.from("reviews").insert({
      transaction_id: transactionId,
      reviewer_id: auth.user.id,
      reviewee_id: revieweeId,
      role,
      rating: parsed.data.rating,
      tags: parsed.data.tags,
      comment: parsed.data.comment ?? null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Review submitted");
    onOpenChange(false);
    setRating(0); setTags([]); setComment("");
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave a review for {revieweeName}</DialogTitle>
          <DialogDescription>Your feedback helps keep the marketplace trustworthy.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Rating</label>
            <div className="mt-1"><RatingStars value={rating} onChange={setRating} size={28} /></div>
          </div>

          <div>
            <label className="text-sm font-medium">Tags <span className="text-xs text-muted-foreground">(pick up to {MAX_TAGS})</span></label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ALL_TAGS.map((t) => {
                const active = tags.includes(t);
                return (
                  <Badge
                    key={t}
                    variant={active ? "default" : "outline"}
                    onClick={() => toggleTag(t)}
                    className={cn("cursor-pointer select-none", active && "bg-primary")}
                  >
                    {t}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Comment <span className="text-xs text-muted-foreground">(optional)</span></label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
              placeholder="Share the details of your experience"
              rows={4}
              className="mt-1"
            />
            <div className="text-right text-xs text-muted-foreground mt-1">{comment.length}/{MAX_COMMENT}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || rating === 0}>
            {submitting ? "Submitting…" : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
