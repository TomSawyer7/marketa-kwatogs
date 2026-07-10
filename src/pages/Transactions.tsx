import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/marketa/EmptyState";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { toast } from "sonner";
import { CheckCircle2, PackageCheck, ShoppingBag, Store } from "lucide-react";
import { formatRelative } from "@/lib/format";

type Row = {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  status: "pending_confirmation" | "completed" | "cancelled";
  confirmed_at: string | null;
  created_at: string;
  listings: { id: string; title: string; images: string[]; price: number } | null;
  seller: { id: string; name: string | null; avatar_url: string | null } | null;
  buyer: { id: string; name: string | null; avatar_url: string | null } | null;
};

const Transactions = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reviewFor, setReviewFor] = useState<{ tx: Row; role: "buyer" | "seller" } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: base, error } = await supabase
      .from("transactions")
      .select("id, listing_id, seller_id, buyer_id, status, confirmed_at, created_at")
      .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }

    const ids = (base ?? []).map((t) => t.listing_id);
    const uids = Array.from(new Set((base ?? []).flatMap((t) => [t.seller_id, t.buyer_id])));
    const [{ data: listings }, { data: profiles }] = await Promise.all([
      supabase.from("listings").select("id, title, images, price").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("profiles").select("id, name, avatar_url").in("id", uids.length ? uids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const lMap = new Map((listings ?? []).map((l) => [l.id, l]));
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setRows((base ?? []).map((t) => ({
      ...t,
      listings: lMap.get(t.listing_id) ?? null,
      seller: pMap.get(t.seller_id) ?? null,
      buyer: pMap.get(t.buyer_id) ?? null,
    })) as Row[]);

    const { data: myReviews } = await supabase
      .from("reviews")
      .select("transaction_id")
      .eq("reviewer_id", user.id);
    setReviewed(new Set((myReviews ?? []).map((r) => r.transaction_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const asBuyer = useMemo(() => rows.filter((r) => r.buyer_id === user?.id), [rows, user]);
  const asSeller = useMemo(() => rows.filter((r) => r.seller_id === user?.id), [rows, user]);

  const confirm = async (id: string) => {
    const { error } = await supabase
      .from("transactions")
      .update({ status: "completed", confirmed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Purchase confirmed — you can now leave a review");
    load();
  };

  const cancel = async (id: string) => {
    const { error } = await supabase
      .from("transactions")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Transaction cancelled");
    load();
  };

  const renderRow = (t: Row, role: "buyer" | "seller") => {
    const counterparty = role === "buyer" ? t.seller : t.buyer;
    const canConfirm = role === "buyer" && t.status === "pending_confirmation";
    const canReview = t.status === "completed" && !reviewed.has(t.id);
    return (
      <li key={t.id} className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex gap-3 flex-1 min-w-0">
          <div className="h-16 w-16 rounded-md overflow-hidden bg-secondary shrink-0">
            {t.listings?.images?.[0] && <img src={t.listings.images[0]} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0">
            <Link to={`/item/${t.listing_id}`} className="font-medium hover:underline block truncate">
              {t.listings?.title ?? "Listing"}
            </Link>
            <div className="text-xs text-muted-foreground mt-0.5">
              {role === "buyer" ? "Seller" : "Buyer"}: {counterparty?.name ?? "—"} · {formatRelative(new Date(t.created_at).getTime())}
            </div>
            <div className="mt-1.5">
              {t.status === "pending_confirmation" && <Badge variant="secondary">Awaiting buyer confirmation</Badge>}
              {t.status === "completed" && <Badge className="bg-success text-success-foreground">Completed</Badge>}
              {t.status === "cancelled" && <Badge variant="outline">Cancelled</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {canConfirm && (
            <>
              <Button size="sm" variant="outline" onClick={() => cancel(t.id)}>Cancel</Button>
              <Button size="sm" onClick={() => confirm(t.id)} className="gap-1">
                <CheckCircle2 className="h-4 w-4" /> Confirm purchase
              </Button>
            </>
          )}
          {t.status === "pending_confirmation" && role === "seller" && (
            <Button size="sm" variant="outline" onClick={() => cancel(t.id)}>Cancel</Button>
          )}
          {canReview && counterparty && (
            <Button size="sm" onClick={() => setReviewFor({ tx: t, role })} className="gap-1">
              <PackageCheck className="h-4 w-4" /> Leave review
            </Button>
          )}
          {!canReview && t.status === "completed" && reviewed.has(t.id) && (
            <span className="text-xs text-muted-foreground self-center">Review submitted</span>
          )}
        </div>
      </li>
    );
  };

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-1">Confirm purchases and review the people you've traded with.</p>

        <Tabs defaultValue="buying" className="mt-5">
          <TabsList>
            <TabsTrigger value="buying" className="gap-1.5"><ShoppingBag className="h-4 w-4" />Buying ({asBuyer.length})</TabsTrigger>
            <TabsTrigger value="selling" className="gap-1.5"><Store className="h-4 w-4" />Selling ({asSeller.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="buying" className="mt-4">
            {loading ? <div className="text-sm text-muted-foreground py-6">Loading…</div>
              : asBuyer.length === 0 ? <EmptyState icon={ShoppingBag} title="No purchases yet" description="When a seller marks something as sold to you, it'll show up here." />
              : <ul className="space-y-3">{asBuyer.map((t) => renderRow(t, "buyer"))}</ul>}
          </TabsContent>

          <TabsContent value="selling" className="mt-4">
            {loading ? <div className="text-sm text-muted-foreground py-6">Loading…</div>
              : asSeller.length === 0 ? <EmptyState icon={Store} title="No sales yet" description="Mark a listing as sold from its page to record a transaction." />
              : <ul className="space-y-3">{asSeller.map((t) => renderRow(t, "seller"))}</ul>}
          </TabsContent>
        </Tabs>
      </div>

      {reviewFor && (
        <ReviewForm
          open={!!reviewFor}
          onOpenChange={(v) => !v && setReviewFor(null)}
          transactionId={reviewFor.tx.id}
          revieweeId={reviewFor.role === "buyer" ? reviewFor.tx.seller_id : reviewFor.tx.buyer_id}
          role={reviewFor.role}
          revieweeName={(reviewFor.role === "buyer" ? reviewFor.tx.seller?.name : reviewFor.tx.buyer?.name) ?? "user"}
          onSubmitted={() => { setReviewFor(null); load(); }}
        />
      )}
    </AppShell>
  );
};

export default Transactions;
