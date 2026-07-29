import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { StatsHeader } from "@/components/admin/StatsHeader";
import { SubmissionList, type FilterKey, type ListItem } from "@/components/admin/SubmissionList";
import { SubmissionDetail, type DetailItem } from "@/components/admin/SubmissionDetail";
import { TrustPanel } from "@/components/admin/TrustPanel";
import { AuditLogsWorkspace } from "@/components/admin/audit/AuditLogsWorkspace";

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [items, setItems] = useState<DetailItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  useEffect(() => { document.title = "Admin · Marketa"; }, []);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Admin access required");
      navigate("/", { replace: true });
    }
  }, [loading, isAdmin, navigate]);

  const load = async () => {
    setLoadingItems(true);
    const { data, error } = await supabase.functions.invoke("admin-verification-action", { body: { action: "list" } });
    if (error) { toast.error(error.message); setLoadingItems(false); return; }
    const next = ((data as { items: DetailItem[] }).items ?? []);
    setItems(next);
    setSelectedId((prev) => prev && next.some((i) => i.user_id === prev) ? prev : (next[0]?.user_id ?? null));
    setLoadingItems(false);
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isAdmin]);

  const stats = useMemo(() => ({
    pending: items.filter((i) => i.status === "pending").length,
    awaiting_liveness: items.filter((i) => i.status === "awaiting_liveness" || i.status === "id_approved").length,
    verified: items.filter((i) => i.status === "verified").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  }), [items]);

  const filtered: ListItem[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => filter === "all" || i.status === filter)
      .filter((i) => {
        if (!q) return true;
        return (i.ocr_full_name ?? "").toLowerCase().includes(q) || i.user_id.toLowerCase().includes(q);
      })
      .map((i) => ({
        user_id: i.user_id,
        status: i.status,
        everify_status: i.everify_status,
        ocr_full_name: i.ocr_full_name,
        submitted_at: i.submitted_at,
      }));
  }, [items, filter, search]);

  const selected = items.find((i) => i.user_id === selectedId) ?? null;

  if (loading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-card">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" /> Marketplace
            </Button>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h1 className="text-sm font-semibold tracking-tight">Verification queue</h1>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loadingItems}>
            <RefreshCw className={`h-3.5 w-3.5 ${loadingItems ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>

      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-4 flex flex-col min-h-0">
        <Tabs defaultValue="verifications" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-fit">
            <TabsTrigger value="verifications">Verifications</TabsTrigger>
            <TabsTrigger value="trust">Trust & safety</TabsTrigger>
          </TabsList>

          <TabsContent value="verifications" className="flex-1 flex flex-col min-h-0 mt-3">
            <StatsHeader stats={stats} />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 min-h-0 h-[calc(100vh-260px)]">
              <SubmissionList
                items={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
                filter={filter}
                onFilterChange={setFilter}
                search={search}
                onSearchChange={setSearch}
              />

              {selected ? (
                <SubmissionDetail item={selected} onChanged={load} />
              ) : (
                <div className="bg-card border border-border rounded-lg grid place-items-center h-full">
                  <div className="text-center px-6 py-12">
                    <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-muted grid place-items-center">
                      <Inbox className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      {loadingItems ? "Loading submissions…" : "No submission selected"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {loadingItems ? "" : "Pick a submission from the list to review it."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="trust" className="mt-3">
            <TrustPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
