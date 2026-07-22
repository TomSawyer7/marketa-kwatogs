import { useEffect, useMemo, useState } from "react";
import { Flag, MessageSquare, ShieldAlert } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { RatingStars } from "./RatingStars";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/marketa/EmptyState";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { POSITIVE_TAGS } from "@/lib/reviews";
import { AppealReviewDialog } from "./AppealReviewDialog";

type Row = {
  id: string;
  rating: number;
  tags: string[] | null;
  comment: string | null;
  role: "buyer" | "seller";
  reviewer_id: string;
  reviewee_id: string;
  reviewer_name: string | null;
  created_at: string;
  status: "active" | "removed_review_only" | "removed_entirely";
};

type Sort = "recent" | "helpful" | "highest" | "lowest";
const TRUNCATE = 180;

function ReviewCard({ r, onReport, canReport }: { r: Row; onReport: () => void; canReport: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const comment = r.comment ?? "";
  const long = comment.length > TRUNCATE;
  const shown = expanded || !long ? comment : comment.slice(0, TRUNCATE).trimEnd() + "…";
  const title = r.tags?.[0] ?? (r.rating >= 4 ? "Great experience" : r.rating >= 3 ? "Okay" : "Needs improvement");
  const positive = r.tags?.some((t) => (POSITIVE_TAGS as readonly string[]).includes(t)) ?? r.rating >= 4;

  return (
    <li className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-base leading-tight">{title}</h4>
          <div className="mt-1.5 flex items-center gap-2">
            <RatingStars value={r.rating} size={14} />
            <span className="text-xs text-muted-foreground">
              {formatRelative(new Date(r.created_at).getTime())} · {r.reviewer_name ?? "Anonymous"}
            </span>
          </div>
        </div>
        {canReport && (
          <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground -mr-2" onClick={onReport}>
            <Flag className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {comment && (
        <div className="mt-3">
          <p className="text-sm whitespace-pre-line text-foreground/90">{shown}</p>
          {long && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? "Read less" : "Read more"}
            </button>
          )}
        </div>
      )}
      {r.tags && r.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.tags.map((t) => (
            <span
              key={t}
              className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

export function UserReviewList({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");

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
      const reviewerIds = Array.from(new Set((data ?? []).map((d) => d.reviewer_id)));
      const { data: profiles } = reviewerIds.length
        ? await supabase.from("profiles").select("id, name").in("id", reviewerIds)
        : { data: [] as { id: string; name: string | null }[] };
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));
      if (cancelled) return;
      setRows((data ?? []).map((r) => ({ ...r, reviewer_name: nameMap.get(r.reviewer_id) ?? null })) as Row[]);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const sorted = useMemo(() => {
    if (!rows) return rows;
    const copy = [...rows];
    switch (sort) {
      case "helpful":
        copy.sort((a, b) => b.rating - a.rating || (b.comment?.length ?? 0) - (a.comment?.length ?? 0));
        break;
      case "highest": copy.sort((a, b) => b.rating - a.rating); break;
      case "lowest": copy.sort((a, b) => a.rating - b.rating); break;
      case "recent":
      default:
        copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return copy;
  }, [rows, sort]);

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
      <div className="flex items-center justify-end mb-3">
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="helpful">Most Helpful</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="highest">Highest Rated</SelectItem>
            <SelectItem value="lowest">Lowest Rated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ul className="space-y-3">
        {sorted!.map((r) => (
          <ReviewCard
            key={r.id}
            r={r}
            canReport={!!user && user.id !== r.reviewer_id}
            onReport={() => setReportOpen(r.id)}
          />
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
