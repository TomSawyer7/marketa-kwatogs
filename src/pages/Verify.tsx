import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldCheck, Upload, Video, AlertTriangle, ArrowRight, RefreshCw, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { estimateBlurScore, compressImageToDataUrl } from "@/lib/image-quality";

type VerifRow = {
  status: "pending" | "id_approved" | "verified" | "rejected" | null;
  ocr_full_name: string | null;
  ocr_date_of_birth: string | null;
  ocr_gender: string | null;
  ocr_psn: string | null;
  admin_notes: string | null;
  face_match_score: number | null;
};

const BLUR_THRESHOLD = 60;

const Verify = () => {
  const navigate = useNavigate();
  const { user, isVerified, isAdmin, signOut, refreshStatus } = useAuth();
  const [verif, setVerif] = useState<VerifRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Verify identity · Marketa";
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/auth", { state: { from: "/verify" }, replace: true });
    } else if (isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [user, isAdmin, navigate]);

  const loadStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("verifications")
      .select("status, ocr_full_name, ocr_date_of_birth, ocr_gender, ocr_psn, admin_notes, face_match_score")
      .eq("user_id", user.id)
      .maybeSingle();
    setVerif((data as VerifRow) ?? { status: null, ocr_full_name: null, ocr_date_of_birth: null, ocr_gender: null, ocr_psn: null, admin_notes: null, face_match_score: null });
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
    // poll while pending so admin approval auto-unlocks Step 2
    const id = setInterval(() => {
      setVerif((prev) => {
        if (prev?.status === "pending") loadStatus();
        return prev;
      });
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  // Already verified -> redirect into marketplace
  if (isVerified) {
    navigate("/", { replace: true });
    return null;
  }

  const status = verif?.status ?? null;

  return (
    <div className="min-h-screen bg-secondary/40 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Verify your identity</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Marketa requires verified identities to keep transactions safe. Complete both steps to access the marketplace.
          </p>
        </header>

        <Stepper status={status} />

        <div className="mt-6 space-y-6">
          {/* STEP 1 */}
          {(status === null || status === "rejected") && (
            <Step1Upload
              onSubmitted={loadStatus}
              previousNotes={status === "rejected" ? verif?.admin_notes ?? null : null}
            />
          )}

          {status === "pending" && <PendingPanel verif={verif!} />}

          {/* STEP 2 */}
          {status === "id_approved" && (
            <Step2Liveness
              onPassed={async () => {
                await refreshStatus();
                await loadStatus();
              }}
            />
          )}

          {/* STEP 3 — verified handled by redirect, but show success briefly if status flips */}
          {status === "verified" && <SuccessPanel score={verif?.face_match_score ?? 100} />}
        </div>

        <div className="text-center mt-8">
          <button onClick={async () => { await signOut(); navigate("/auth"); }} className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Verify;

/* -------------------------------- Stepper --------------------------------- */

function Stepper({ status }: { status: VerifRow["status"] }) {
  const steps = [
    { key: "id", label: "ID Upload" },
    { key: "approval", label: "Admin Review" },
    { key: "live", label: "Liveness" },
    { key: "done", label: "Verified" },
  ];
  const activeIdx =
    status === "verified" ? 3 :
    status === "id_approved" ? 2 :
    status === "pending" ? 1 : 0;
  return (
    <ol className="flex items-center justify-between gap-2 px-1">
      {steps.map((s, i) => {
        const active = i === activeIdx;
        const done = i < activeIdx || status === "verified";
        return (
          <li key={s.key} className="flex-1 flex items-center gap-2 min-w-0">
            <div className={`shrink-0 h-7 w-7 rounded-full grid place-items-center text-xs font-semibold border ${
              done ? "bg-primary text-primary-foreground border-primary" :
              active ? "bg-card text-foreground border-primary" :
              "bg-card text-muted-foreground border-border"
            }`}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs truncate ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            {i < steps.length - 1 && <span className="hidden sm:block flex-1 h-px bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------ STEP 1: Upload ---------------------------- */

function Step1Upload({ onSubmitted, previousNotes }: { onSubmitted: () => void; previousNotes: string | null }) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [frontBlur, setFrontBlur] = useState<number | null>(null);
  const [backBlur, setBackBlur] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handlePick = async (side: "front" | "back", file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    if (side === "front") {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFront(file); setFrontPreview(url);
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBack(file); setBackPreview(url);
    }
    try {
      const score = await estimateBlurScore(file);
      if (side === "front") setFrontBlur(score);
      else setBackBlur(score);
    } catch {
      // ignore
    }
  };

  const frontBlurry = frontBlur !== null && frontBlur < BLUR_THRESHOLD;
  const backBlurry = backBlur !== null && backBlur < BLUR_THRESHOLD;
  const ready = front && back && !frontBlurry && !backBlurry;

  const submit = async () => {
    if (!front || !back) return;
    setSubmitting(true); setServerError(null);
    try {
      const [frontData, backData] = await Promise.all([
        compressImageToDataUrl(front, { maxDim: 960, quality: 0.72, maxBytes: 180 * 1024 }),
        compressImageToDataUrl(back, { maxDim: 960, quality: 0.72, maxBytes: 180 * 1024 }),
      ]);
      const { data, error } = await supabase.functions.invoke("verify-id-ocr", {
        body: { frontImage: frontData, backImage: backData },
      });
      if (error) {
        const msg = (data as { error?: string } | undefined)?.error ?? error.message ?? "Submission failed.";
        setServerError(msg);
        toast.error(msg);
        return;
      }
      toast.success("ID submitted. Awaiting admin review.");
      onSubmitted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submission failed.";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl p-6 md:p-8">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center"><Upload className="h-4 w-4" /></div>
        <div>
          <h2 className="font-semibold">Step 1 · Upload your Philippine National ID</h2>
          <p className="text-sm text-muted-foreground">Take clear, well-lit photos of the front and back. We'll extract your details automatically.</p>
        </div>
      </div>

      {previousNotes && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm mb-4">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-destructive">Previous submission was rejected</p>
            <p className="text-muted-foreground">{previousNotes}</p>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <UploadSlot label="Front of ID" preview={frontPreview} blurScore={frontBlur} onPick={(f) => handlePick("front", f)} />
        <UploadSlot label="Back of ID" preview={backPreview} blurScore={backBlur} onPick={(f) => handlePick("back", f)} />
      </div>

      {(frontBlurry || backBlurry) && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Image too blurred</p>
            <p className="text-muted-foreground">Re-take the {frontBlurry && backBlurry ? "front and back" : frontBlurry ? "front" : "back"} in better lighting and hold the camera steady.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setFront(null); setFrontPreview(null); setFrontBlur(null); setBack(null); setBackPreview(null); setBackBlur(null); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
          </Button>
        </div>
      )}

      {serverError && (
        <p className="mt-3 text-sm text-destructive">{serverError}</p>
      )}

      <Button className="w-full mt-5" disabled={!ready || submitting} onClick={submit}>
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing ID…</> : <>Submit for review <ArrowRight className="h-4 w-4 ml-2" /></>}
      </Button>
    </section>
  );
}

function UploadSlot({ label, preview, blurScore, onPick }: { label: string; preview: string | null; blurScore: number | null; onPick: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative w-full aspect-[1.6] rounded-lg border-2 border-dashed border-border bg-secondary/40 hover:border-primary hover:bg-secondary transition overflow-hidden grid place-items-center text-xs text-muted-foreground"
      >
        {preview ? (
          <img src={preview} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="h-5 w-5" />
            <span>Click to upload</span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
      />
      {blurScore !== null && (
        <p className={`text-xs mt-1.5 ${blurScore < BLUR_THRESHOLD ? "text-destructive" : "text-muted-foreground"}`}>
          Sharpness: {Math.round(blurScore)} {blurScore < BLUR_THRESHOLD ? "· too blurry" : "· OK"}
        </p>
      )}
    </div>
  );
}

/* --------------------------- Pending Approval ---------------------------- */

function PendingPanel({ verif }: { verif: VerifRow }) {
  return (
    <section className="bg-card border border-border rounded-xl p-6 md:p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 grid place-items-center mb-3">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <h2 className="font-semibold">Pending admin approval</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        We've received your ID. An administrator will review it shortly. This page will refresh automatically.
      </p>
      <div className="mt-5 text-left bg-secondary/50 rounded-lg p-4 text-sm space-y-1.5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Extracted details</p>
        <Field label="Full name" value={verif.ocr_full_name} />
        <Field label="Date of birth" value={verif.ocr_date_of_birth} />
        <Field label="Gender" value={verif.ocr_gender} />
        <Field label="PSN" value={verif.ocr_psn} />
      </div>
    </section>
  );
}
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value || "—"}</span>
    </div>
  );
}

/* ----------------------------- STEP 2: Liveness --------------------------- */

const ACTIONS: Array<{ key: "blink" | "turn_head" | "smile"; label: string; instruction: string }> = [
  { key: "blink", label: "Blink", instruction: "Look at the camera and blink slowly twice." },
  { key: "turn_head", label: "Turn head", instruction: "Slowly turn your head left, then right." },
  { key: "smile", label: "Smile", instruction: "Look at the camera and smile." },
];

function Step2Liveness({ onPassed }: { onPassed: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streamOn, setStreamOn] = useState(false);
  const [action] = useState(() => ACTIONS[Math.floor(Math.random() * ACTIONS.length)]);
  const [phase, setPhase] = useState<"idle" | "recording" | "submitting" | "result">("idle");
  const [countdown, setCountdown] = useState(0);
  const [result, setResult] = useState<{ passed: boolean; score: number; reason: string } | null>(null);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setStreamOn(true);
    } catch {
      toast.error("Camera access denied. Please enable it in your browser settings.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamOn(false);
  };

  useEffect(() => () => stopCamera(), []);

  const captureFrame = async (): Promise<string | null> => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, 0, 0);
    return compressImageToDataUrl(c.toDataURL("image/jpeg", 0.82), {
      maxDim: 640,
      quality: 0.62,
      maxBytes: 90 * 1024,
      minDim: 420,
      minQuality: 0.4,
    });
  };

  const runCapture = async () => {
    if (!streamOn) { await startCamera(); return; }
    setPhase("recording"); setResult(null);
    // capture 3 frames, ~1.2s apart
    const frames: string[] = [];
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 1200));
      const f = await captureFrame();
      if (f) frames.push(f);
    }
    setCountdown(0);
    if (frames.length < 2) {
      toast.error("Could not capture frames. Please retry.");
      setPhase("idle"); return;
    }

    setPhase("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("verify-liveness", {
        body: { action: action.key, frames },
      });
      if (error) {
        const msg = (data as { error?: string } | undefined)?.error ?? error.message ?? "Verification failed.";
        toast.error(msg);
        setPhase("idle");
        return;
      }
      const r = data as { passed: boolean; face_match_score: number; reason: string };
      setResult({ passed: r.passed, score: r.face_match_score, reason: r.reason });
      setPhase("result");
      if (r.passed) {
        stopCamera();
        setTimeout(() => onPassed(), 1500);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed.");
      setPhase("idle");
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl p-6 md:p-8">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center"><Video className="h-4 w-4" /></div>
        <div>
          <h2 className="font-semibold">Step 2 · Liveness check &amp; face match</h2>
          <p className="text-sm text-muted-foreground">We'll match your live capture against your ID photo.</p>
        </div>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm mb-4">
        <p className="font-medium">Action: {action.label}</p>
        <p className="text-muted-foreground">{action.instruction}</p>
      </div>

      <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-black grid place-items-center">
        <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        {!streamOn && (
          <div className="relative z-10 text-center text-white/80 px-6">
            <Camera className="h-8 w-8 mx-auto mb-2 opacity-70" />
            <p className="text-sm">Camera is off</p>
          </div>
        )}
        {phase === "recording" && countdown > 0 && (
          <div className="relative z-10 text-white text-6xl font-bold drop-shadow-lg">{countdown}</div>
        )}
        {phase === "submitting" && (
          <div className="absolute inset-0 bg-black/50 grid place-items-center text-white text-sm gap-2">
            <Loader2 className="h-6 w-6 animate-spin" /> Analyzing…
          </div>
        )}
      </div>

      {result && (
        <div className={`mt-4 rounded-lg border p-3 text-sm ${result.passed ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
          <p className="font-medium">{result.passed ? "Match confirmed" : "Verification failed"}</p>
          <p className="text-muted-foreground">Confidence: {Math.round(result.score)}% — {result.reason}</p>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        {!streamOn ? (
          <Button className="flex-1" onClick={startCamera}><Camera className="h-4 w-4 mr-2" /> Enable camera</Button>
        ) : (
          <Button className="flex-1" disabled={phase === "recording" || phase === "submitting"} onClick={runCapture}>
            {phase === "recording" ? "Capturing…" : phase === "submitting" ? "Analyzing…" : "Start liveness check"}
          </Button>
        )}
        {streamOn && (
          <Button variant="outline" onClick={stopCamera}>Stop camera</Button>
        )}
      </div>
    </section>
  );
}

/* -------------------------------- Success --------------------------------- */

function SuccessPanel({ score }: { score: number }) {
  return (
    <section className="bg-card border border-emerald-500/30 rounded-xl p-8 text-center animate-scale-in">
      <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center mb-3">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h2 className="text-xl font-bold">Identity Verified!</h2>
      <p className="text-sm text-muted-foreground mt-1">Match confidence: {Math.round(score)}%. Redirecting you to the marketplace…</p>
      <Progress value={100} className="mt-4 h-1.5" />
    </section>
  );
}
