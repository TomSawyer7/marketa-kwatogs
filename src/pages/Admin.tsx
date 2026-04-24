import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, CheckCircle2, XCircle, Loader2, Eye, ArrowLeft, ExternalLink, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type EverifyStatus = "not_checked" | "passed" | "failed";

type Item = {
  user_id: string;
  status: "pending" | "id_approved" | "verified" | "rejected";
  ocr_full_name: string | null;
  ocr_date_of_birth: string | null;
  ocr_gender: string | null;
  ocr_psn: string | null;
  ocr_address: string | null;
  id_front_path: string;
  id_back_path: string;
  face_match_score: number | null;
  liveness_passed: boolean | null;
  admin_notes: string | null;
  submitted_at: string;
  verified_at: string | null;
  qr_payload: string | null;
  everify_status: EverifyStatus;
  everify_checked_at: string | null;
  everify_notes: string | null;
};

const EVERIFY_URL = "https://everify.gov.ph/";

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, { front?: string; back?: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

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
    setItems((data as { items: Item[] }).items ?? []);
    setLoadingItems(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const openSignedUrls = async (uid: string) => {
    if (signedUrls[uid]) { setOpenUserId(openUserId === uid ? null : uid); return; }
    const { data, error } = await supabase.functions.invoke("admin-verification-action", { body: { action: "signed_urls", user_id: uid } });
    if (error) { toast.error(error.message); return; }
    const d = data as { front: string; back: string };
    setSignedUrls((prev) => ({ ...prev, [uid]: { front: d.front, back: d.back } }));
    setOpenUserId(uid);
  };

  const act = async (uid: string, action: "approve_id" | "reject") => {
    setBusy(uid);
    const { error } = await supabase.functions.invoke("admin-verification-action", {
      body: { action, user_id: uid, notes: notes[uid] ?? null },
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(action === "approve_id" ? "ID approved" : "Submission rejected");
    load();
  };

  const markEverify = async (uid: string, result: "passed" | "failed") => {
    setBusy(uid);
    const { error } = await supabase.functions.invoke("admin-verification-action", {
      body: { action: "mark_everify", user_id: uid, everify_result: result, notes: notes[uid] ?? null },
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(result === "passed" ? "eVerify marked as passed" : "eVerify marked as failed");
    load();
  };

  const copyPayload = async (payload: string) => {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("QR payload copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  if (loading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4 mr-1" /> Marketplace</Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Verification queue</h1>
          </div>
        </div>

        {loadingItems ? (
          <div className="text-sm text-muted-foreground">Loading submissions…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">No submissions yet.</div>
        ) : (
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.user_id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold truncate">{it.ocr_full_name || "Unknown"}</h2>
                      <StatusBadge status={it.status} />
                      <EverifyBadge status={it.everify_status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submitted {new Date(it.submitted_at).toLocaleString()} · user {it.user_id.slice(0, 8)}…
                    </p>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
                      <Info label="DOB" value={it.ocr_date_of_birth} />
                      <Info label="Gender" value={it.ocr_gender} />
                      <Info label="PSN" value={it.ocr_psn} />
                      <Info label="Address" value={it.ocr_address} />
                    </dl>
                    {it.face_match_score !== null && (
                      <p className="text-xs mt-2 text-muted-foreground">
                        Liveness: {it.liveness_passed ? "passed" : "failed"} · Face match {Math.round(it.face_match_score)}%
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openSignedUrls(it.user_id)}>
                      <Eye className="h-4 w-4 mr-1" /> {openUserId === it.user_id ? "Hide" : "View"} ID
                    </Button>
                  </div>
                </div>

                {openUserId === it.user_id && signedUrls[it.user_id] && (
                  <div className="grid sm:grid-cols-2 gap-3 mt-4">
                    <a href={signedUrls[it.user_id].front} target="_blank" rel="noreferrer">
                      <img src={signedUrls[it.user_id].front} alt="ID front" className="w-full aspect-[1.6] object-cover rounded-lg border border-border" />
                    </a>
                    <a href={signedUrls[it.user_id].back} target="_blank" rel="noreferrer">
                      <img src={signedUrls[it.user_id].back} alt="ID back" className="w-full aspect-[1.6] object-cover rounded-lg border border-border" />
                    </a>
                  </div>
                )}

                {/* eVerify.gov.ph panel */}
                {it.status === "pending" && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                        <QrCode className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm">Step 1 · Verify on eVerify.gov.ph</h3>
                        <p className="text-xs text-muted-foreground">
                          Use the QR payload from the back of the ID to verify with PSA, then mark the result below.
                        </p>
                      </div>
                    </div>

                    {it.qr_payload ? (
                      <div className="bg-secondary/50 rounded-lg p-3 mb-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">QR payload</p>
                        <p className="text-xs font-mono break-all line-clamp-3">{it.qr_payload}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mb-3 italic">No QR payload was decoded from this ID.</p>
                    )}

                    <div className="flex flex-wrap gap-2 mb-3">
                      <Button size="sm" variant="outline" asChild>
                        <a href={EVERIFY_URL} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" /> Open eVerify.gov.ph
                        </a>
                      </Button>
                      {it.qr_payload && (
                        <Button size="sm" variant="ghost" onClick={() => copyPayload(it.qr_payload!)}>
                          <Copy className="h-4 w-4 mr-1" /> Copy QR payload
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy === it.user_id}
                        onClick={() => markEverify(it.user_id, "passed")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Mark eVerify passed
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === it.user_id}
                        onClick={() => markEverify(it.user_id, "failed")}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Mark eVerify failed
                      </Button>
                    </div>

                    {it.everify_checked_at && (
                      <p className="text-[11px] text-muted-foreground mb-3">
                        Last checked {new Date(it.everify_checked_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {it.status === "pending" && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div className="flex items-start gap-3 mb-1">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm">Step 2 · Decide</h3>
                        <p className="text-xs text-muted-foreground">
                          Approval requires eVerify to be marked as passed.
                        </p>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Optional notes (shown to user if rejected)…"
                      value={notes[it.user_id] ?? ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [it.user_id]: e.target.value }))}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={busy === it.user_id || it.everify_status !== "passed"}
                        onClick={() => act(it.user_id, "approve_id")}
                      >
                        {busy === it.user_id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                        Approve ID
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busy === it.user_id} onClick={() => act(it.user_id, "reject")}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
                {it.status === "rejected" && it.admin_notes && (
                  <p className="mt-3 text-sm text-muted-foreground"><strong>Notes:</strong> {it.admin_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium truncate">{value || "—"}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: Item["status"] }) {
  const map = {
    pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
    id_approved: { label: "ID approved", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" },
    verified: { label: "Verified", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
    rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  } as const;
  const m = map[status];
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function EverifyBadge({ status }: { status: EverifyStatus }) {
  if (status === "not_checked") {
    return <Badge variant="outline" className="bg-muted text-muted-foreground border-border">eVerify: not checked</Badge>;
  }
  if (status === "passed") {
    return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">eVerify ✓</Badge>;
  }
  return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">eVerify ✗</Badge>;
}

export default Admin;
