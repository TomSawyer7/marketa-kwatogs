import { useEffect, useState } from "react";
import { Flag, Star } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingStars } from "./RatingStars";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/marketa/EmptyState";
import { MessageSquare } from "lucide-react";

type Row = {
  id: string;
  rating: number;
  tags: string[] | null;
  comment: string | null;
  role: "buyer" | "seller";
  reviewer_id: string;
  created_at: string;
};

export function UserReviewList({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, tags, comment, role, reviewer_id, created_at")
        .eq("reviewee_id", userId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) { setRows([]); return; }
      setRows(data as Row[]);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const submitReport = async () => {
    if (!user || !reportOpen) return;
    if (reason.trim().length < 5) { toast.error("Please describe the issue"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("review_reports").insert({
      review_id: reportOpen, reporter_id: user.id, reason: reason.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Report submitted for admin review");
    setReportOpen(null); setReason("");
  };

  if (rows === null) return <div className="text-sm text-muted-foreground py-6">Loading reviews…</div>;
  if (rows.length === 0) {
    return <EmptyState icon={MessageSquare} title="No reviews yet" description="Reviews from completed transactions will appear here." />;
  }

  return (
    <>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <RatingStars value={r.rating} />
                  <span className="text-xs text-muted-foreground">from a {r.role} · {formatRelative(new Date(r.created_at).getTime())}</span>
                </div>
                {r.tags && r.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                )}
                {r.comment && <p className="text-sm mt-2 whitespace-pre-line">{r.comment}</p>}
              </div>
              {user && user.id !== r.reviewer_id && (
                <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => setReportOpen(r.id)}>
                  <Flag className="h-3.5 w-3.5" /> Report
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!reportOpen} onOpenChange={(v) => !v && setReportOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this review</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={4}
            placeholder="Why is this review fraudulent or abusive?"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(null)}>Cancel</Button>
            <Button onClick={submitReport} disabled={submitting}>{submitting ? "Submitting…" : "Submit report"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function useUserRating(userId: string | undefined) {
  const [stats, setStats] = useState<{ avg: number | null; count: number }>({ avg: null, count: 0 });
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_rating_stats")
        .select("avg_rating, review_count")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      setStats({
        avg: data?.avg_rating != null ? Number(data.avg_rating) : null,
        count: data?.review_count ?? 0,
      });
    })();
    return () => { cancelled = true; };
  }, [userId]);
  return stats;
}
