import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, ExternalLink, Copy, QrCode, ShieldCheck, User, FileText, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, EverifyBadge, type VerificationStatus, type EverifyStatus } from "./StatusBadges";

const EVERIFY_URL = "https://everify.gov.ph/";

export type DetailItem = {
  user_id: string;
  status: VerificationStatus;
  ocr_full_name: string | null;
  ocr_first_name: string | null;
  ocr_middle_name: string | null;
  ocr_last_name: string | null;
  ocr_date_of_birth: string | null;
  ocr_gender: string | null;
  ocr_sex: string | null;
  ocr_psn: string | null;
  ocr_document_number: string | null;
  ocr_address: string | null;
  ocr_nationality: string | null;
  ocr_place_of_birth: string | null;
  ocr_blood_type: string | null;
  ocr_marital_status: string | null;
  ocr_date_of_issue: string | null;
  face_match_score: number | null;
  liveness_passed: boolean | null;
  liveness_video_path: string | null;
  liveness_frame_paths: string[] | null;
  liveness_checked_at: string | null;
  admin_notes: string | null;
  submitted_at: string;
  verified_at: string | null;
  qr_payload: string | null;
  everify_status: EverifyStatus;
  everify_checked_at: string | null;
  everify_notes: string | null;
};

export function SubmissionDetail({
  item,
  onChanged,
}: {
  item: DetailItem;
  onChanged: () => void;
}) {
  const [signed, setSigned] = useState<{ front?: string; back?: string; liveness_video?: string | null; liveness_frames?: string[] }>({});
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(item.admin_notes ?? "");

  useEffect(() => { setNotes(item.admin_notes ?? ""); }, [item.user_id, item.admin_notes]);

  useEffect(() => {
    let cancelled = false;
    setSigned({});
    (async () => {
      const { data, error } = await supabase.functions.invoke("admin-verification-action", {
        body: { action: "signed_urls", user_id: item.user_id },
      });
      if (cancelled) return;
      if (error) { toast.error(error.message); return; }
      const d = data as { front: string; back: string; liveness_video: string | null; liveness_frames: string[] };
      setSigned({ front: d.front, back: d.back, liveness_video: d.liveness_video, liveness_frames: d.liveness_frames ?? [] });
    })();
    return () => { cancelled = true; };
  }, [item.user_id]);

  const act = async (action: "approve_id" | "reject") => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("admin-verification-action", {
      body: { action, user_id: item.user_id, notes: notes || null },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(action === "approve_id" ? "User verified" : "Submission rejected");
    onChanged();
  };

  const markEverify = async (result: "passed" | "failed") => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("admin-verification-action", {
      body: { action: "mark_everify", user_id: item.user_id, everify_result: result, notes: notes || null },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(result === "passed" ? "eVerify marked as passed" : "eVerify marked as failed");
    onChanged();
  };

  const copyPayload = async (payload: string) => {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("QR payload copied");
    } catch { toast.error("Could not copy"); }
  };

  const isPending = item.status === "pending";

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">{item.ocr_full_name || "Unknown"}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
              {item.user_id.slice(0, 8)}… · submitted {new Date(item.submitted_at).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-1.5">
            <StatusBadge status={item.status} />
            <EverifyBadge status={item.everify_status} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-5">
        {/* OCR data — full breakdown */}
        <Section icon={User} title="Extracted information">
          <div className="space-y-4">
            <FieldGroup label="Identity">
              <Info label="Full name" value={item.ocr_full_name} wide />
              <Info label="First name" value={item.ocr_first_name} />
              <Info label="Middle name" value={item.ocr_middle_name} />
              <Info label="Last name" value={item.ocr_last_name} />
            </FieldGroup>

            <FieldGroup label="Personal">
              <Info label="Date of birth" value={item.ocr_date_of_birth} />
              <Info label="Sex" value={item.ocr_sex ?? item.ocr_gender} />
              <Info label="Nationality" value={item.ocr_nationality} />
              <Info label="Place of birth" value={item.ocr_place_of_birth} />
              <Info label="Blood type" value={item.ocr_blood_type} />
              <Info label="Marital status" value={item.ocr_marital_status} />
            </FieldGroup>

            <FieldGroup label="Document">
              <Info label="Document №" value={item.ocr_document_number} />
              <Info label="PSN" value={item.ocr_psn} />
              <Info label="Date of issue" value={item.ocr_date_of_issue} />
            </FieldGroup>

            <FieldGroup label="Address">
              <Info label="Address" value={item.ocr_address} wide />
            </FieldGroup>
          </div>

          {item.face_match_score !== null && (
            <p className="text-[11px] mt-4 text-muted-foreground">
              Liveness {item.liveness_passed ? "passed" : "failed"} · face match {Math.round(item.face_match_score)}%
            </p>
          )}
        </Section>

        {/* ID images side by side for face comparison */}
        <Section icon={FileText} title="ID document">
          {signed.front && signed.back ? (
            <div className="grid grid-cols-2 gap-2.5">
              <a href={signed.front} target="_blank" rel="noreferrer" className="block">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Front</div>
                <img src={signed.front} alt="ID front" className="w-full aspect-[1.6] object-cover rounded-md border border-border" />
              </a>
              <a href={signed.back} target="_blank" rel="noreferrer" className="block">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Back</div>
                <img src={signed.back} alt="ID back" className="w-full aspect-[1.6] object-cover rounded-md border border-border" />
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="aspect-[1.6] rounded-md bg-muted animate-pulse" />
              <div className="aspect-[1.6] rounded-md bg-muted animate-pulse" />
            </div>
          )}
        </Section>

        {/* Liveness recording + captured frames */}
        <Section icon={Video} title="Liveness check">
          {item.liveness_checked_at ? (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${item.liveness_passed ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                  {item.liveness_passed ? "Liveness passed" : "Liveness failed"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Face match confidence: <span className="font-semibold text-foreground">{Math.round(item.face_match_score ?? 0)}%</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  · captured {new Date(item.liveness_checked_at).toLocaleString()}
                </span>
              </div>

              {signed.liveness_video ? (
                <video
                  src={signed.liveness_video}
                  controls
                  playsInline
                  className="w-full max-w-md rounded-md border border-border bg-black aspect-[4/3] object-cover"
                />
              ) : (
                <p className="text-[11px] text-muted-foreground italic">No video recording available for this session.</p>
              )}

              {signed.liveness_frames && signed.liveness_frames.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Captured frames</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {signed.liveness_frames.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                        <img
                          src={url}
                          alt={`Liveness frame ${i + 1}`}
                          className="h-20 w-20 object-cover rounded-md border border-border"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              The user has not completed the liveness check yet.
            </p>
          )}
        </Section>


        {/* eVerify step */}
        {isPending && (
          <Section icon={QrCode} title="Step 1 · Verify on eVerify.gov.ph" badge="Required">
            <p className="text-[11px] text-muted-foreground mb-3">
              Open eVerify on your phone, scan the QR on the back of the ID, then mark the result.
            </p>

            {item.qr_payload ? (
              <div className="bg-secondary/60 rounded-md p-2.5 mb-3">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">QR payload</p>
                <p className="text-[11px] font-mono break-all line-clamp-3">{item.qr_payload}</p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground mb-3 italic">No QR payload decoded.</p>
            )}

            <div className="flex flex-wrap gap-1.5 mb-2">
              <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                <a href={EVERIFY_URL} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" /> Open eVerify
                </a>
              </Button>
              {item.qr_payload && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => copyPayload(item.qr_payload!)}>
                  <Copy className="h-3 w-3" /> Copy QR
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                disabled={busy}
                onClick={() => markEverify("passed")}
              >
                <CheckCircle2 className="h-3 w-3" /> Mark passed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={busy}
                onClick={() => markEverify("failed")}
              >
                <XCircle className="h-3 w-3" /> Mark failed
              </Button>
            </div>

            {item.everify_checked_at && (
              <p className="text-[10px] text-muted-foreground">
                Last checked {new Date(item.everify_checked_at).toLocaleString()}
              </p>
            )}
          </Section>
        )}

        {/* Decision step */}
        {isPending && (
          <Section icon={ShieldCheck} title="Step 2 · Approve marketplace access">
            <p className="text-[11px] text-muted-foreground mb-2">
              Approving grants the user marketplace access. Requires eVerify passed and a completed liveness check.
            </p>
            <Textarea
              placeholder="Optional notes (shown to user if rejected)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm mb-2.5"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || item.everify_status !== "passed" || !item.liveness_checked_at}
                onClick={() => act("approve_id")}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Approve & verify
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => act("reject")}>
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          </Section>
        )}

        {item.status === "rejected" && item.admin_notes && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
            <p className="text-[10px] uppercase tracking-wide text-destructive mb-1">Rejection notes</p>
            <p className="text-sm text-foreground/80">{item.admin_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="h-6 w-6 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
        {badge && <span className="text-[9px] uppercase tracking-wide bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">{badge}</span>}
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium mb-1.5">{label}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm bg-secondary/30 border border-border/60 rounded-md p-2.5">
        {children}
      </dl>
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium truncate">{value || "—"}</dd>
    </div>
  );
}
