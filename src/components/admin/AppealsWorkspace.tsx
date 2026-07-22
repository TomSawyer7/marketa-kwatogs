import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Clock, Gavel, CheckCircle2, Inbox, Search, Star } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { AppealDetailPanel } from "./AppealDetailPanel";

export type AppealRow = {
  id: string; review_id: string; transaction_id: string; seller_id: string; buyer_id: string;
  reason: string; evidence_urls: string[] | null;
  buyer_chat_consent: boolean; seller_chat_consent: boolean;
  status: "Pending" | "Waiting for Consent" | "Under Review" | "Waiting for Additional Evidence" | "Approved" | "Rejected" | "Resolved";
  admin_notes: string | null; created_at: string; resolved_at?: string | null;
  reviews?: { id: string; rating: number; comment: string | null } | null;
  sellerName?: string | null; buyerName?: string | null;
  listingTitle?: string | null; listingPrice?: number | null;
};

type Filter = "all" | "waiting_consent" | "under_review" | "resolved";

const TERMINAL = ["Approved", "Rejected", "Resolved"];

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: string }) {
  return (
    <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-md grid place-items-center ${tone ?? "bg-muted"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold leading-tight">{value}</div>
      </div>
    </div>
  );
}

export function AppealsWorkspace() {
  const [rows, setRows] = useState<AppealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("review_appeals") as any)
      .select("id, review_id, transaction_id, seller_id, buyer_id, reason, evidence_urls, buyer_chat_consent, seller_chat_consent, status, admin_notes, created_at, resolved_at, reviews:review_id(id, rating, comment)")
      .order("created_at", { ascending: false });
    const base = (data as AppealRow[]) ?? [];

    const userIds = Array.from(new Set(base.flatMap((r) => [r.seller_id, r.buyer_id]).filter(Boolean)));
    const txIds = Array.from(new Set(base.map((r) => r.transaction_id).filter(Boolean)));

    const [{ data: profs }, { data: txs }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id, name").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
      txIds.length ? (supabase.from("transactions") as any).select("id, listing_id, listings:listing_id(title, price)").in("id", txIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const profMap = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.name]));
    const txMap = new Map<string, any>((txs ?? []).map((t: any) => [t.id, t]));

    const enriched = base.map((r) => {
      const tx = txMap.get(r.transaction_id);
      return {
        ...r,
        sellerName: profMap.get(r.seller_id) ?? null,
        buyerName: profMap.get(r.buyer_id) ?? null,
        listingTitle: tx?.listings?.title ?? null,
        listingPrice: tx?.listings?.price ?? null,
      };
    });
    setRows(enriched);
    setSelectedId((prev) => prev && enriched.some((r) => r.id === prev) ? prev : (enriched[0]?.id ?? null));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const active = rows.filter((r) => !TERMINAL.includes(r.status));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      active: active.length,
      waitingConsent: rows.filter((r) => r.status === "Waiting for Consent" || (r.status === "Pending" && !(r.buyer_chat_consent && r.seller_chat_consent))).length,
      underReview: rows.filter((r) => r.status === "Under Review" || r.status === "Waiting for Additional Evidence").length,
      resolvedToday: rows.filter((r) => TERMINAL.includes(r.status) && r.resolved_at && new Date(r.resolved_at) >= today).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "waiting_consent" && !(r.status === "Waiting for Consent" || (r.status === "Pending" && !(r.buyer_chat_consent && r.seller_chat_consent)))) return false;
      if (filter === "under_review" && !(r.status === "Under Review" || r.status === "Waiting for Additional Evidence")) return false;
      if (filter === "resolved" && !TERMINAL.includes(r.status)) return false;
      if (!q) return true;
      return (r.sellerName ?? "").toLowerCase().includes(q)
        || (r.buyerName ?? "").toLowerCase().includes(q)
        || (r.listingTitle ?? "").toLowerCase().includes(q)
        || r.reason.toLowerCase().includes(q);
    });
  }, [rows, filter, search]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard icon={ShieldAlert} label="Active appeals" value={kpis.active} tone="bg-amber-500/10 text-amber-600" />
        <KpiCard icon={Clock} label="Waiting for consent" value={kpis.waitingConsent} tone="bg-blue-500/10 text-blue-600" />
        <KpiCard icon={Gavel} label="Under review" value={kpis.underReview} tone="bg-violet-500/10 text-violet-600" />
        <KpiCard icon={CheckCircle2} label="Resolved today" value={kpis.resolvedToday} tone="bg-emerald-500/10 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-3 h-[calc(100vh-340px)] min-h-[520px]">
        {/* Queue */}
        <div className="bg-card border rounded-lg flex flex-col min-h-0">
          <div className="p-2.5 border-b space-y-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList className="grid grid-cols-4 h-8">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="waiting_consent" className="text-xs">Consent</TabsTrigger>
                <TabsTrigger value="under_review" className="text-xs">Review</TabsTrigger>
                <TabsTrigger value="resolved" className="text-xs">Resolved</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search seller, buyer, listing…" className="h-8 pl-7 text-xs" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
            {loading && <div className="text-xs text-muted-foreground text-center py-6">Loading…</div>}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-10 text-xs text-muted-foreground">
                <Inbox className="h-6 w-6 mx-auto mb-2 opacity-50" />
                No appeals match this filter.
              </div>
            )}
            {filtered.map((r) => {
              const isSel = r.id === selectedId;
              return (
                <button key={r.id} onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left border rounded-md p-2.5 transition ${isSel ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium truncate">
                      {r.sellerName ?? "Seller"} <span className="text-muted-foreground">↔</span> {r.buyerName ?? "Buyer"}
                    </div>
                    <Badge variant={TERMINAL.includes(r.status) ? "outline" : "secondary"} className="text-[10px] shrink-0">{r.status}</Badge>
                  </div>
                  {r.listingTitle && (
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {r.listingTitle}{r.listingPrice != null ? ` · ₱${r.listingPrice}` : ""}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                    {r.reviews && (
                      <span className="inline-flex items-center gap-0.5 text-amber-600">
                        <Star className="h-3 w-3 fill-current" />{r.reviews.rating.toFixed(1)}
                      </span>
                    )}
                    <span className="text-muted-foreground">B {r.buyer_chat_consent ? "✓" : "✕"} · S {r.seller_chat_consent ? "✓" : "✕"}</span>
                    <span className="text-muted-foreground ml-auto">{formatRelative(new Date(r.created_at).getTime())}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="min-h-0">
          {selected ? (
            <AppealDetailPanel appeal={selected} onChanged={load} />
          ) : (
            <div className="bg-card border rounded-lg h-full grid place-items-center">
              <div className="text-center px-6 py-12">
                <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Select an appeal</p>
                <p className="text-xs text-muted-foreground mt-1">Pick an item from the queue to review it.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
