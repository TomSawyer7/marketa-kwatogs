import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, ShieldCheck, ShieldAlert, Download, Search, FileSpreadsheet, FileText, FileType2 } from "lucide-react";

type AuditRow = {
  id: string;
  seq: number;
  timestamp: string;
  user_id: string | null;
  user_role: string | null;
  session_id: string | null;
  correlation_id: string | null;
  category: string;
  action: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  device: string | null;
  browser: string | null;
  operating_system: string | null;
  endpoint: string | null;
  http_method: string | null;
  status_code: number | null;
  success: boolean;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  previous_hash: string;
  current_hash: string;
  created_at: string;
};

const CATEGORIES = ["auth", "identity", "marketplace", "trust", "messaging", "admin", "account", "security"];
const PAGE_SIZE = 50;

export function AuditLogsWorkspace() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [success, setSuccess] = useState<string>("all");
  const [fromTs, setFromTs] = useState<string>("");
  const [toTs, setToTs] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    ok: boolean;
    checked: number;
    first_broken_seq: number | null;
    broken_seqs: number[];
    missing_seqs: number[];
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      category: category === "all" ? undefined : category,
      success: success === "all" ? undefined : success === "success",
      from_ts: fromTs ? new Date(fromTs).toISOString() : undefined,
      to_ts: toTs ? new Date(toTs).toISOString() : undefined,
      user_id: userId.trim() || undefined,
    }),
    [search, category, success, fromTs, toTs, userId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-audit", {
      body: { action: "list", ...filters, page, page_size: PAGE_SIZE },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const payload = data as { rows: AuditRow[]; total: number };
    setRows(payload.rows ?? []);
    setTotal(payload.total ?? 0);
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const runVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    const { data, error } = await supabase.functions.invoke("admin-audit", { body: { action: "verify" } });
    setVerifying(false);
    if (error) { toast.error(error.message); return; }
    setVerifyResult((data as { result: typeof verifyResult }).result);
  };

  const exportAs = async (format: "csv" | "excel" | "pdf") => {
    const { data, error } = await supabase.functions.invoke("admin-audit", {
      body: { action: "export", format, ...filters },
    });
    if (error) { toast.error(error.message); return; }
    const mime = format === "pdf" ? "application/pdf" : format === "excel" ? "application/vnd.ms-excel" : "text/csv";
    const ext = format === "excel" ? "xls" : format;
    const blob = data instanceof Blob ? data : new Blob([typeof data === "string" ? data : JSON.stringify(data)], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${Date.now()}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-[11px] text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Action, description, entity id…" className="pl-7 h-9" />
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Category</label>
          <Select value={category} onValueChange={(v) => { setPage(1); setCategory(v); }}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Status</label>
          <Select value={success} onValueChange={(v) => { setPage(1); setSuccess(v); }}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">From</label>
          <Input type="datetime-local" value={fromTs} onChange={(e) => { setPage(1); setFromTs(e.target.value); }} className="h-9 w-52" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">To</label>
          <Input type="datetime-local" value={toTs} onChange={(e) => { setPage(1); setToTs(e.target.value); }} className="h-9 w-52" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">User ID</label>
          <Input value={userId} onChange={(e) => { setPage(1); setUserId(e.target.value); }} placeholder="uuid" className="h-9 w-64" />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => setVerifyOpen(true)}>
            <ShieldCheck className="h-3.5 w-3.5" /> Verify integrity
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm"><Download className="h-3.5 w-3.5" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportAs("csv")}><FileText className="h-3.5 w-3.5 mr-2" /> CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAs("excel")}><FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAs("pdf")}><FileType2 className="h-3.5 w-3.5 mr-2" /> PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">Timestamp</th>
                <th className="text-left px-3 py-2 font-medium">User</th>
                <th className="text-left px-3 py-2 font-medium">Event</th>
                <th className="text-left px-3 py-2 font-medium">Category</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">IP</th>
                <th className="text-left px-3 py-2 font-medium">Device</th>
                <th className="text-left px-3 py-2 font-medium">Resource</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No logs match these filters.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{r.seq}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono">{r.user_id ? r.user_id.slice(0, 8) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 font-medium">{r.action}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{r.category}</Badge></td>
                    <td className="px-3 py-2">
                      {r.success ? <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]">success</Badge>
                                 : <Badge className="bg-red-500/15 text-red-700 border-red-500/30 text-[10px]">failure</Badge>}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{r.ip_address ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{[r.browser, r.operating_system].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.entity_type ? `${r.entity_type}${r.entity_id ? ` · ${r.entity_id.slice(0,8)}` : ""}` : "—"}</td>
                    <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => setSelected(r)}>Details</Button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs">
          <span className="text-muted-foreground">{total.toLocaleString()} entries</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="text-muted-foreground">Page {page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log entry #{selected?.seq}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-2 text-xs">
              {Object.entries(selected).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[160px_1fr] gap-3 border-b border-border pb-1">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono break-all">
                    {v == null ? "—" : typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Verify dialog */}
      <Dialog open={verifyOpen} onOpenChange={(o) => { setVerifyOpen(o); if (!o) setVerifyResult(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verify audit log integrity</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Recomputes every hash in chronological order and compares them against what's stored.</p>
            <Button onClick={runVerify} disabled={verifying}>
              {verifying ? "Verifying…" : "Run verification"}
            </Button>
            {verifyResult && (
              verifyResult.ok ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-emerald-700">Audit Log Integrity Verified</p>
                    <p className="text-xs text-muted-foreground">Checked {verifyResult.checked} entries. No tampering detected.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-red-700">Audit Log Integrity Failed</p>
                    <p className="text-muted-foreground">Checked {verifyResult.checked} entries.</p>
                    {verifyResult.first_broken_seq != null && <p>First broken entry: #{verifyResult.first_broken_seq}</p>}
                    {verifyResult.broken_seqs?.length > 0 && <p>Broken entries: {verifyResult.broken_seqs.join(", ")}</p>}
                    {verifyResult.missing_seqs?.length > 0 && <p>Missing entries: {verifyResult.missing_seqs.join(", ")}</p>}
                  </div>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
