import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ShieldAlert, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type RiskRow = {
  user_id: string;
  score: number;
  risk_level: "low" | "medium" | "high";
  alerts_count: number;
  last_event_at: string | null;
  under_review: boolean;
  updated_at: string;
  profile?: { name: string | null; email: string | null } | null;
  latest_category?: string | null;
  latest_event?: string | null;
};

type BehaviorEvent = {
  id: string;
  user_id: string | null;
  category: string;
  event_type: string;
  severity: string;
  score_delta: number;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type BehaviorAlert = {
  id: string;
  user_id: string;
  category: string;
  event_type: string;
  status: string;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  notes: string | null;
};

const LEVEL_COLOR: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  high: "bg-red-500/10 text-red-600 border-red-500/30",
};

const CATEGORIES = ["all","login","mpin","reporting","messaging","listings","transactions"] as const;
type CategoryFilter = typeof CATEGORIES[number];
type LevelFilter = "all" | "low" | "medium" | "high";

export function BehaviorMonitoringWorkspace() {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<LevelFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<BehaviorEvent[]>([]);
  const [alerts, setAlerts] = useState<BehaviorAlert[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: scores, error } = await supabase
      .from("user_risk_scores")
      .select("*")
      .order("score", { ascending: false })
      .limit(500);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const ids = (scores ?? []).map((s) => s.user_id);
    const [{ data: profs }, { data: latest }] = await Promise.all([
      ids.length ? supabase.from("profiles").select("id,name,email").in("id", ids) : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null }[] }),
      ids.length ? supabase.from("behavior_events").select("user_id,category,event_type,created_at").in("user_id", ids).order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] as { user_id: string; category: string; event_type: string; created_at: string }[] }),
    ]);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const latestMap = new Map<string, { category: string; event_type: string }>();
    for (const e of latest ?? []) {
      if (!latestMap.has(e.user_id)) latestMap.set(e.user_id, { category: e.category, event_type: e.event_type });
    }
    setRows(
      (scores ?? []).map((s) => ({
        ...(s as RiskRow),
        profile: profMap.get(s.user_id) ?? null,
        latest_category: latestMap.get(s.user_id)?.category ?? null,
        latest_event: latestMap.get(s.user_id)?.event_type ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (level !== "all" && r.risk_level !== level) return false;
      if (category !== "all" && r.latest_category !== category) return false;
      if (query) {
        const hay = `${r.profile?.name ?? ""} ${r.profile?.email ?? ""} ${r.user_id}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, level, category, q]);

  const loadDetail = async (userId: string) => {
    setDetailLoading(true);
    setSelectedId(userId);
    const [{ data: ev }, { data: al }] = await Promise.all([
      supabase.from("behavior_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supabase.from("behavior_alerts").select("*").eq("user_id", userId).order("last_seen_at", { ascending: false }),
    ]);
    setEvents((ev ?? []) as BehaviorEvent[]);
    setAlerts((al ?? []) as BehaviorAlert[]);
    setDetailLoading(false);
  };

  const updateAlert = async (id: string, status: string) => {
    const { error } = await supabase.from("behavior_alerts").update({ status, resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Alert marked ${status}`);
    if (selectedId) loadDetail(selectedId);
  };

  const selected = rows.find((r) => r.user_id === selectedId) ?? null;
  const stats = useMemo(() => ({
    high: rows.filter((r) => r.risk_level === "high").length,
    medium: rows.filter((r) => r.risk_level === "medium").length,
    low: rows.filter((r) => r.risk_level === "low").length,
    review: rows.filter((r) => r.under_review).length,
  }), [rows]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Behavior monitoring</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "High risk", value: stats.high, tone: "text-red-600" },
          { label: "Medium risk", value: stats.medium, tone: "text-amber-600" },
          { label: "Low risk", value: stats.low, tone: "text-emerald-600" },
          { label: "Under review", value: stats.review, tone: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="border border-border rounded-lg bg-card px-3 py-2">
            <div className="text-[11px] uppercase text-muted-foreground">{s.label}</div>
            <div className={`text-lg font-semibold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, or user id" className="pl-7 h-8" />
        </div>
        <Select value={level} onValueChange={(v) => setLevel(v as LevelFilter)}>
          <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="high">High risk</SelectItem>
            <SelectItem value="medium">Medium risk</SelectItem>
            <SelectItem value="low">Low risk</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
          <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c === "all" ? "All categories" : c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-3">
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">User</th>
                  <th className="text-left px-3 py-2 font-medium">Score</th>
                  <th className="text-left px-3 py-2 font-medium">Level</th>
                  <th className="text-left px-3 py-2 font-medium">Alerts</th>
                  <th className="text-left px-3 py-2 font-medium">Latest</th>
                  <th className="text-left px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-xs">No users match these filters.</td></tr>
                ) : filtered.map((r) => (
                  <tr key={r.user_id}
                      onClick={() => loadDetail(r.user_id)}
                      className={`border-t border-border cursor-pointer hover:bg-muted/40 ${selectedId === r.user_id ? "bg-muted/60" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium truncate max-w-[220px]">{r.profile?.name ?? "Unknown"}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{r.profile?.email ?? r.user_id.slice(0,8)}</div>
                    </td>
                    <td className="px-3 py-2 font-mono">{r.score}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={LEVEL_COLOR[r.risk_level]}>{r.risk_level}</Badge>
                    </td>
                    <td className="px-3 py-2">{r.alerts_count}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.latest_event ? <span className="text-foreground">{r.latest_event}</span> : <span className="text-muted-foreground">—</span>}
                      {r.latest_category ? <div className="text-[11px] text-muted-foreground">{r.latest_category}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.last_event_at ? formatDistanceToNow(new Date(r.last_event_at), { addSuffix: true }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-border rounded-lg bg-card p-3 min-h-[400px]">
          {!selected ? (
            <div className="grid place-items-center h-full text-xs text-muted-foreground">
              Select a user to see their behavioral history.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold truncate">{selected.profile?.name ?? "Unknown"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{selected.profile?.email ?? selected.user_id}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className={LEVEL_COLOR[selected.risk_level]}>{selected.risk_level} · {selected.score}</Badge>
                  {selected.under_review && <Badge variant="outline" className="border-primary/50 text-primary">Under review</Badge>}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold mb-1">Open alerts</div>
                {alerts.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">No alerts.</div>
                ) : (
                  <div className="space-y-1">
                    {alerts.map((a) => (
                      <div key={a.id} className="border border-border rounded p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{a.event_type}</div>
                          <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                        </div>
                        <div className="text-muted-foreground text-[11px]">{a.category} · {a.occurrences}× · {formatDistanceToNow(new Date(a.last_seen_at), { addSuffix: true })}</div>
                        {a.status === "open" && (
                          <div className="flex gap-1 mt-1">
                            <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => updateAlert(a.id, "reviewing")}>Reviewing</Button>
                            <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => updateAlert(a.id, "dismissed")}>Dismiss</Button>
                            <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => updateAlert(a.id, "actioned")}>Actioned</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold mb-1">Recent events</div>
                {detailLoading ? (
                  <div className="text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline" /> Loading…</div>
                ) : events.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">No events.</div>
                ) : (
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {events.map((e) => (
                      <div key={e.id} className="border border-border rounded p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{e.event_type}</div>
                          <span className="text-[10px] text-muted-foreground">+{e.score_delta}</span>
                        </div>
                        <div className="text-muted-foreground text-[11px]">{e.category} · {e.severity} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</div>
                        {e.description && <div className="mt-1">{e.description}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
