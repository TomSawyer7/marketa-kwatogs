import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { REVIEW_WINDOW_DAYS } from "@/lib/reviews";

export type ReviewEligibility =
  | { status: "loading" }
  | { status: "self" }
  | { status: "signed-out" }
  | { status: "no-transaction" }
  | { status: "expired" }
  | { status: "already-reviewed" }
  | {
      status: "eligible";
      transactionId: string;
      role: "buyer" | "seller";
    };

export function useReviewEligibility(profileOwnerId: string | undefined, refreshKey = 0): ReviewEligibility {
  const { user } = useAuth();
  const [state, setState] = useState<ReviewEligibility>({ status: "loading" });

  useEffect(() => {
    if (!profileOwnerId) return;
    if (!user) { setState({ status: "signed-out" }); return; }
    if (user.id === profileOwnerId) { setState({ status: "self" }); return; }

    let cancelled = false;
    (async () => {
      setState({ status: "loading" });

      const { data: txs } = await supabase
        .from("transactions")
        .select("id, buyer_id, seller_id, status, confirmed_at, created_at")
        .eq("status", "completed")
        .or(
          `and(buyer_id.eq.${user.id},seller_id.eq.${profileOwnerId}),and(seller_id.eq.${user.id},buyer_id.eq.${profileOwnerId})`,
        )
        .order("confirmed_at", { ascending: false });

      if (cancelled) return;

      if (!txs || txs.length === 0) {
        setState({ status: "no-transaction" });
        return;
      }

      const windowMs = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const inWindow = txs.filter((t) => {
        const ts = t.confirmed_at ? new Date(t.confirmed_at).getTime() : new Date(t.created_at).getTime();
        return now - ts <= windowMs;
      });

      if (inWindow.length === 0) {
        setState({ status: "expired" });
        return;
      }

      const ids = inWindow.map((t) => t.id);
      const { data: mine } = await supabase
        .from("reviews")
        .select("transaction_id")
        .eq("reviewer_id", user.id)
        .in("transaction_id", ids);

      if (cancelled) return;
      const reviewed = new Set((mine ?? []).map((r) => r.transaction_id));
      const unreviewed = inWindow.find((t) => !reviewed.has(t.id));
      if (!unreviewed) {
        setState({ status: "already-reviewed" });
        return;
      }

      setState({
        status: "eligible",
        transactionId: unreviewed.id,
        role: unreviewed.buyer_id === user.id ? "buyer" : "seller",
      });
    })();

    return () => { cancelled = true; };
  }, [profileOwnerId, user, refreshKey]);

  return state;
}
