import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RatingStars } from "./RatingStars";
import { ReviewForm } from "./ReviewForm";
import { useAuth } from "@/hooks/use-auth";
import { useReviewEligibility } from "@/hooks/use-review-eligibility";
import { cn } from "@/lib/utils";

/*
  RatingsSummary
  ├── AggregateHeader  { avg, count }
  ├── DistributionBars { counts[1..5] }
  ├── TapToRate        { locked, onRate }
  └── WriteReviewCTA   { locked, lockReason, onOpenForm }
*/

export function RatingsSummary({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<number[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const eligibility = useReviewEligibility(userId, refreshKey);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("rating")
        .eq("reviewee_id", userId);
      if (cancelled) return;
      setRatings((data ?? []).map((r) => r.rating));
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  const count = ratings?.length ?? 0;
  const avg = count > 0 ? ratings!.reduce((s, n) => s + n, 0) / count : 0;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: ratings?.filter((r) => r === star).length ?? 0,
  }));
  const max = Math.max(1, ...dist.map((d) => d.n));

  const locked = eligibility.status !== "eligible";
  const lockReason: Record<Exclude<typeof eligibility.status, "eligible">, string> = {
    loading: "Checking eligibility…",
    self: "You can't review your own profile.",
    "signed-out": "Sign in to leave a review.",
    "no-transaction": "You can only rate users you have successfully transacted with.",
    expired: "The review window for your transaction has closed.",
    "already-reviewed": "You've already reviewed this user.",
  };

  const openForm = (initial?: number) => {
    if (eligibility.status !== "eligible") return;
    if (initial) setHoverRating(initial);
    setFormOpen(true);
  };

  const formattedCount = new Intl.NumberFormat().format(count);

  return (
    <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
      <h3 className="text-xl md:text-2xl font-bold tracking-tight">Ratings &amp; Reviews</h3>

      <div className="mt-5 grid grid-cols-[auto_1fr] gap-6 md:gap-10 items-center">
        <div>
          <div className="text-5xl md:text-6xl font-bold leading-none">
            {count > 0 ? avg.toFixed(1) : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">out of 5</div>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-end gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={cn("text-sm", n <= Math.round(avg) ? "text-foreground" : "text-muted-foreground/40")}>★</span>
            ))}
          </div>
          {dist.map(({ star, n }) => (
            <div key={star} className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all"
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-3 text-right">{star}</span>
            </div>
          ))}
          <div className="text-xs text-muted-foreground text-right mt-1">{formattedCount} Ratings</div>
        </div>
      </div>

      <div className="mt-8 border-t border-border pt-6 flex flex-col items-center gap-4">
        <div className="text-sm font-medium">{locked ? "Rating locked" : "Tap to Rate"}</div>
        <div className={cn("flex items-center gap-2", locked && "opacity-40")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={locked}
              onClick={() => openForm(n)}
              onMouseEnter={() => !locked && setHoverRating(n)}
              onMouseLeave={() => !locked && setHoverRating(0)}
              className={cn(
                "text-3xl transition-transform",
                !locked && "hover:scale-110 cursor-pointer",
                locked && "cursor-not-allowed",
                n <= hoverRating ? "text-primary" : "text-primary/40",
              )}
              aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
            >
              ☆
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            variant="secondary"
            className="rounded-full min-w-[160px] gap-2"
            disabled={locked}
            onClick={() => openForm()}
          >
            {locked && <Lock className="h-3.5 w-3.5" />}
            Write a Review
          </Button>
        </div>
        {locked && eligibility.status !== "loading" && (
          <p className="text-xs text-muted-foreground text-center max-w-md">
            {lockReason[eligibility.status]}
          </p>
        )}
      </div>

      {eligibility.status === "eligible" && user && (
        <ReviewForm
          open={formOpen}
          onOpenChange={setFormOpen}
          transactionId={eligibility.transactionId}
          revieweeId={userId}
          role={eligibility.role}
          revieweeName={userName}
          onSubmitted={() => { setFormOpen(false); setRefreshKey((k) => k + 1); }}
        />
      )}
    </section>
  );
}
