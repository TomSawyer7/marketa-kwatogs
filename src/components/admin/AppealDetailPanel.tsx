import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Unlock, Eye, Gavel, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatRelative } from "@/lib/format";
import { RatingStars } from "@/components/reviews/RatingStars";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { EvidenceLightbox } from "./EvidenceLightbox";
import { AppealChatViewer } from "./AppealChatViewer";
import type { AppealRow } from "./AppealsWorkspace";

type Outcome = "approved_removed_entirely" | "approved_comment_only" | "rejected";

function Thumb({ path, onClick }: { path: string; onClick: () => void }) {
  const url = useSignedUrl("appeal-evidence", path);
  return (
    <button onClick={onClick} className="h-20 w-20 rounded border overflow-hidden bg-muted shrink-0">
      {url ? <img src={url} alt="evidence" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse" />}
    </button>
  );
}

export function AppealDetailPanel({ appeal, onChanged }: { appeal: AppealRow; onChanged: () => void }) {
  const [outcome, setOutcome] = useState<Outcome>("approved_removed_entirely");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => { setOutcome("approved_removed_entirely"); setNotes(""); }, [appeal.id]);

  const consented = appeal.buyer_chat_consent && appeal.seller_chat_consent;
  const inAuditWindow = consented && ["Under Review", "Waiting for Additional Evidence"].includes(appeal.status);
  const active = !["Approved", "Rejected", "Resolved"].includes(appeal.status);
  const evidence = appeal.evidence_urls ?? [];

  const submit = async () => {
    if (notes.trim().length < 10) return toast.error("Please add an explanation (min 10 characters).");
    setSubmitting(true);
    const payload =
      outcome === "approved_removed_entirely" ? { status: "Approved", resolution_kind: "removed_entirely", admin_notes: notes.trim() }
      : outcome === "approved_comment_only" ? { status: "Approved", resolution_kind: "removed_review_only", admin_notes: notes.trim() }
      : { status: "Rejected", resolution_kind: null, admin_notes: notes.trim() };
    const { error } = await (supabase.from("review_appeals") as any).update(payload).eq("id", appeal.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Decision submitted. Both parties notified.");
    onChanged();
  };

  const moveStatus = async (s: string) => {
    const { error } = await (supabase.from("review_appeals") as any).update({ status: s }).eq("id", appeal.id);
    if (error) return toast.error(error.message);
    toast.success(`Moved to ${s}`); onChanged();
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-muted-foreground">Appeal · {formatRelative(new Date(appeal.created_at).getTime())}</div>
          <div className="text-sm font-medium mt-0.5">
            {appeal.sellerName ?? "Seller"} <span className="text-muted-foreground">vs</span> {appeal.buyerName ?? "Buyer"}
          </div>
          {appeal.listingTitle && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Listing: {appeal.listingTitle}{appeal.listingPrice != null ? ` · ₱${appeal.listingPrice}` : ""}
            </div>
          )}
        </div>
        <Badge variant="secondary" className="gap-1"><ShieldAlert className="h-3 w-3" />{appeal.status}</Badge>
      </div>

      {/* Disputed review */}
      <section className="border rounded-md p-3 bg-muted/30">
        <div className="text-xs font-medium text-muted-foreground mb-2">Disputed review</div>
        {appeal.reviews ? (
          <>
            <RatingStars value={appeal.reviews.rating} />
            <p className="text-sm mt-1 whitespace-pre-line">{appeal.reviews.comment ?? <em className="text-muted-foreground">no comment</em>}</p>
            <div className="text-[11px] text-muted-foreground mt-1">by {appeal.buyerName ?? "buyer"}</div>
          </>
        ) : <div className="text-xs text-muted-foreground">Review not found.</div>}
      </section>

      {/* Seller appeal + evidence */}
      <section className="border rounded-md p-3">
        <div className="text-xs font-medium text-muted-foreground mb-2">Seller's appeal reason</div>
        <p className="text-sm whitespace-pre-line">{appeal.reason}</p>
        {evidence.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Evidence ({evidence.length})</div>
            <div className="flex flex-wrap gap-2">
              {evidence.map((p, i) => <Thumb key={p} path={p} onClick={() => setLightboxIdx(i)} />)}
            </div>
          </div>
        )}
      </section>

      {/* Privacy & Chat Audit box */}
      <section className={`border rounded-md p-3 ${inAuditWindow ? "border-emerald-500/40 bg-emerald-500/5" : "bg-muted/30"}`}>
        <div className="flex items-center gap-2">
          {inAuditWindow ? <Unlock className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
          <div className="text-sm font-medium">
            {inAuditWindow ? "Temporary Chat Access Granted" : "Chat Locked — Waiting for Dual Consent"}
          </div>
        </div>
        <div className="flex gap-2 mt-2 text-xs">
          <Badge variant={appeal.buyer_chat_consent ? "default" : "outline"} className="gap-1">
            {appeal.buyer_chat_consent ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Buyer
          </Badge>
          <Badge variant={appeal.seller_chat_consent ? "default" : "outline"} className="gap-1">
            {appeal.seller_chat_consent ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Seller
          </Badge>
        </div>
        {inAuditWindow && (
          <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => setChatOpen(true)}>
            <Eye className="h-3.5 w-3.5" /> Open transcript
          </Button>
        )}
        {consented && !active && (
          <p className="text-[11px] text-muted-foreground mt-2">Audit window closed (appeal resolved).</p>
        )}
      </section>

      {/* Resolution panel */}
      {active ? (
        <section className="border rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">Admin resolution</div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Move to</span>
              <Select value={appeal.status} onValueChange={moveStatus}>
                <SelectTrigger className="h-7 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Waiting for Consent">Waiting for Consent</SelectItem>
                  <SelectItem value="Under Review">Under Review</SelectItem>
                  <SelectItem value="Waiting for Additional Evidence">Waiting for Evidence</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as Outcome)} className="space-y-2">
            <label className="flex gap-3 items-start border rounded-md p-2.5 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="rejected" id="d-reject" className="mt-0.5" />
              <div>
                <Label htmlFor="d-reject" className="text-sm font-medium cursor-pointer">Retain original rating & review</Label>
                <p className="text-[11px] text-muted-foreground">Dismiss appeal — review is legitimate.</p>
              </div>
            </label>
            <label className="flex gap-3 items-start border rounded-md p-2.5 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="approved_removed_entirely" id="d-entire" className="mt-0.5" />
              <div>
                <Label htmlFor="d-entire" className="text-sm font-medium cursor-pointer">Remove entire rating & review</Label>
                <p className="text-[11px] text-muted-foreground">Approve appeal — rating and comment removed.</p>
              </div>
            </label>
            <label className="flex gap-3 items-start border rounded-md p-2.5 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="approved_comment_only" id="d-text" className="mt-0.5" />
              <div>
                <Label htmlFor="d-text" className="text-sm font-medium cursor-pointer">Remove review text only (keep star rating)</Label>
                <p className="text-[11px] text-muted-foreground">Guideline violation on written content only.</p>
              </div>
            </label>
          </RadioGroup>

          <div>
            <Label htmlFor="admin-notes" className="text-xs">Admin notes (sent to both parties)</Label>
            <Textarea id="admin-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Justify the decision…" rows={3} className="mt-1" />
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full gap-1">
            <Gavel className="h-4 w-4" /> Submit Decision & Notify Both Parties
          </Button>
        </section>
      ) : (
        <section className="border rounded-md p-3 bg-muted/30">
          <div className="text-xs text-muted-foreground">Resolution</div>
          <div className="text-sm mt-1">{appeal.status}{appeal.admin_notes ? ` — ${appeal.admin_notes}` : ""}</div>
        </section>
      )}

      <EvidenceLightbox
        paths={evidence}
        index={lightboxIdx ?? 0}
        onIndexChange={setLightboxIdx}
        open={lightboxIdx !== null}
        onOpenChange={(v) => { if (!v) setLightboxIdx(null); }}
      />
      <AppealChatViewer
        open={chatOpen}
        onOpenChange={setChatOpen}
        transactionId={appeal.transaction_id}
        appealStatus={appeal.status}
        bothConsented={consented}
      />
    </div>
  );
}
