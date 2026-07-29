import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldCheck, Video, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { compressImageToDataUrl } from "@/lib/image-quality";
import { IDVerification } from "@/components/verify/IDVerification";

type VerifRow = {
  status: "awaiting_liveness" | "pending" | "id_approved" | "verified" | "rejected" | null;
  ocr_full_name: string | null;
  ocr_first_name: string | null;
  ocr_middle_name: string | null;
  ocr_last_name: string | null;
  ocr_date_of_birth: string | null;
  ocr_gender: string | null;
  ocr_sex: string | null;
  ocr_psn: string | null;
  ocr_document_number: string | null;
  ocr_nationality: string | null;
  ocr_address: string | null;
  ocr_place_of_birth: string | null;
  ocr_blood_type: string | null;
  ocr_marital_status: string | null;
  ocr_date_of_issue: string | null;
  admin_notes: string | null;
  face_match_score: number | null;
};

const Verify = () => {
  const navigate = useNavigate();
  const { user, isVerified, isAdmin, signOut, refreshStatus } = useAuth();
  const [verif, setVerif] = useState<VerifRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Verify identity · Marketa"; }, []);

  useEffect(() => {
    if (!user) navigate("/auth", { state: { from: "/verify" }, replace: true });
    else if (isAdmin) navigate("/admin", { replace: true });
  }, [user, isAdmin, navigate]);

  const loadStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("verifications")
      .select("status, ocr_full_name, ocr_first_name, ocr_middle_name, ocr_last_name, ocr_date_of_birth, ocr_gender, ocr_sex, ocr_psn, ocr_document_number, ocr_nationality, ocr_address, ocr_place_of_birth, ocr_blood_type, ocr_marital_status, ocr_date_of_issue, admin_notes, face_match_score")
      .eq("user_id", user.id)
      .maybeSingle();
    setVerif((data as VerifRow) ?? {
      status: null, ocr_full_name: null, ocr_first_name: null, ocr_middle_name: null, ocr_last_name: null,
      ocr_date_of_birth: null, ocr_gender: null, ocr_sex: null, ocr_psn: null, ocr_document_number: null,
      ocr_nationality: null, ocr_address: null, ocr_place_of_birth: null, ocr_blood_type: null,
      ocr_marital_status: null, ocr_date_of_issue: null, admin_notes: null, face_match_score: null,
    });
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
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
            Marketa requires verified identities to keep transactions safe. Upload your ID, complete the liveness check,
            then an admin reviews everything before you get marketplace access.
          </p>
        </header>

        <Stepper status={status} />

        <div className="mt-6 space-y-6">
          {(status === null || status === "rejected") && (
            <IDVerification onSubmitted={loadStatus} />
          )}

          {(status === "awaiting_liveness" || status === "id_approved") && (
            <Step2Liveness onPassed={async () => { await refreshStatus(); await loadStatus(); }} />
          )}

          {status === "pending" && (
            <PendingPanel verif={verif!} />
          )}

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
    { key: "live", label: "Liveness" },
    { key: "approval", label: "Admin Review" },
    { key: "done", label: "Verified" },
  ];
  const activeIdx =
    status === "verified" ? 3 :
    status === "pending" ? 2 :
    (status === "awaiting_liveness" || status === "id_approved") ? 1 : 0;
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

/* --------------------------- Pending Approval ---------------------------- */
function PendingPanel({ verif }: { verif: VerifRow }) {
  return (
    <section className="bg-card border border-border rounded-xl p-6 md:p-8">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 grid place-items-center mb-3">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h2 className="font-semibold">Pending admin review</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Your ID details and liveness recording have been submitted. An admin will review the full package —
          this page refreshes automatically once they decide.
        </p>
      </div>

      <div className="mt-5 text-left bg-secondary/50 rounded-lg p-4 text-sm space-y-1.5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Submitted details</p>
        <Field label="Full name" value={verif.ocr_full_name} />
        <Field label="First name" value={verif.ocr_first_name} />
        <Field label="Middle name" value={verif.ocr_middle_name} />
        <Field label="Last name" value={verif.ocr_last_name} />
        <Field label="Document number" value={verif.ocr_document_number ?? verif.ocr_psn} />
        <Field label="Date of birth" value={verif.ocr_date_of_birth} />
        <Field label="Sex" value={verif.ocr_sex ?? verif.ocr_gender} />
        <Field label="Nationality" value={verif.ocr_nationality} />
        <Field label="Place of birth" value={verif.ocr_place_of_birth} />
        <Field label="Address" value={verif.ocr_address} />
        <Field label="Blood type" value={verif.ocr_blood_type} />
        <Field label="Marital status" value={verif.ocr_marital_status} />
        <Field label="Date of issue" value={verif.ocr_date_of_issue} />
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  const display = value && String(value).trim() ? String(value) : "—";
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words">{display}</span>
    </div>
  );
}

/* ----------------------------- STEP 2: Liveness --------------------------- */
type ChallengeKey = "blink" | "smile" | "turn_left" | "turn_right" | "look_up" | "look_down";
type Challenge = { key: ChallengeKey; label: string; instruction: string };

const CHALLENGE_POOL: Challenge[] = [
  { key: "blink", label: "Blink twice", instruction: "Look at the camera and blink your eyes twice." },
  { key: "smile", label: "Smile", instruction: "Give a big, natural smile." },
  { key: "turn_left", label: "Turn left", instruction: "Slowly turn your head to the left." },
  { key: "turn_right", label: "Turn right", instruction: "Slowly turn your head to the right." },
  { key: "look_up", label: "Look up", instruction: "Slowly tilt your head upward." },
  { key: "look_down", label: "Look down", instruction: "Slowly tilt your head downward." },
];

const CDN_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
];

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.head.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if ((existing as any).__loaded) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.async = true;
    s.onload = () => { (s as any).__loaded = true; resolve(); };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(lm: any[], idx: number[]) {
  // idx: [p1, p2, p3, p4, p5, p6] where p1-p4 horizontal, p2-p6 & p3-p5 vertical
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => lm[i]);
  const vertical = dist(p2, p6) + dist(p3, p5);
  const horizontal = 2 * dist(p1, p4);
  return horizontal === 0 ? 1 : vertical / horizontal;
}

function actionKeyFor(c: ChallengeKey): "blink" | "turn_head" | "smile" {
  if (c === "blink") return "blink";
  if (c === "smile") return "smile";
  return "turn_head";
}

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function Step2Liveness({ onPassed }: { onPassed: () => void }) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const framesRef = useRef<string[]>([]);
  const frameTimerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const currentIdxRef = useRef(0);
  const blinkStateRef = useRef({ below: false, count: 0 });
  const holdRef = useRef(0);
  const advancingRef = useRef(false);
  const submittedRef = useRef(false);

  const [challenges] = useState<Challenge[]>(() => shuffle(CHALLENGE_POOL).slice(0, 4));
  const [phase, setPhase] = useState<"loading" | "ready" | "running" | "submitting" | "result">("loading");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [passedFlash, setPassedFlash] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score: number; reason: string } | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("Loading face detection…");

  const captureFrame = (): string | null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, 640, 480);
    return c.toDataURL("image/jpeg", 0.82);
  };

  const stopRecording = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") { resolve(null); return; }
      rec.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" })
          : null;
        recorderRef.current = null;
        resolve(blob);
      };
      try { rec.stop(); } catch { resolve(null); }
    });

  const stopAll = () => {
    if (frameTimerRef.current) {
      window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    try { recorderRef.current?.state !== "inactive" && recorderRef.current?.stop(); } catch { /* ignore */ }
    recorderRef.current = null;
    try { cameraRef.current?.stop?.(); } catch { /* ignore */ }
    cameraRef.current = null;
    try { faceMeshRef.current?.close?.(); } catch { /* ignore */ }
    faceMeshRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopAll(), []);

  const evaluateChallenge = (lm: any[]) => {
    const idx = currentIdxRef.current;
    const ch = challenges[idx];
    if (!ch || advancingRef.current) return;

    const noseX = lm[1].x;
    const cheekL = lm[234];
    const cheekR = lm[454];
    const centerX = (cheekL.x + cheekR.x) / 2;
    const forehead = lm[10];
    const chin = lm[152];
    const nose = lm[1];

    let condition = false;

    if (ch.key === "blink") {
      const leftEAR = eyeAspectRatio(lm, [362, 385, 387, 263, 373, 380]);
      const rightEAR = eyeAspectRatio(lm, [33, 160, 158, 133, 153, 144]);
      const ear = (leftEAR + rightEAR) / 2;
      const st = blinkStateRef.current;
      if (ear < 0.2 && !st.below) st.below = true;
      else if (ear > 0.25 && st.below) { st.below = false; st.count += 1; }
      condition = st.count >= 2;
    } else if (ch.key === "smile") {
      const mouthW = dist(lm[61], lm[291]);
      const faceW = dist(cheekL, cheekR);
      condition = faceW > 0 && mouthW / faceW > 0.48;
    } else if (ch.key === "turn_left") {
      condition = noseX - centerX < -0.07;
    } else if (ch.key === "turn_right") {
      condition = noseX - centerX > 0.07;
    } else if (ch.key === "look_up" || ch.key === "look_down") {
      const denom = chin.y - forehead.y;
      const ratio = denom === 0 ? 0.5 : (nose.y - forehead.y) / denom;
      condition = ch.key === "look_up" ? ratio < 0.4 : ratio > 0.6;
    }

    // Blink counts across frames; others need to hold ~3 frames to avoid flicker
    if (ch.key === "blink") {
      if (!condition) return;
    } else {
      if (condition) holdRef.current += 1;
      else holdRef.current = 0;
      if (holdRef.current < 3) return;
    }

    advancingRef.current = true;
    holdRef.current = 0;
    setPassedFlash(true);
    window.setTimeout(() => {
      setPassedFlash(false);
      const next = currentIdxRef.current + 1;
      if (next >= challenges.length) {
        void finalizeAndSubmit();
      } else {
        currentIdxRef.current = next;
        blinkStateRef.current = { below: false, count: 0 };
        setCurrentIdx(next);
        advancingRef.current = false;
      }
    }, 1000);
  };

  const finalizeAndSubmit = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    if (frameTimerRef.current) {
      window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }

    const finalFrame = captureFrame();
    if (finalFrame) {
      if (framesRef.current.length >= 10) framesRef.current.shift();
      framesRef.current.push(finalFrame);
    }

    setPhase("submitting");

    const firstKey = challenges[0].key;
    const actionKey = actionKeyFor(firstKey);
    const frames = framesRef.current.slice();

    // Stop and upload the recording + frames so the admin can review the footage.
    const videoBlob = await stopRecording();
    let videoPath: string | null = null;
    const framePaths: string[] = [];

    if (user) {
      const ts = Date.now();
      try {
        if (videoBlob && videoBlob.size > 0) {
          const ext = (videoBlob.type || "").includes("mp4") ? "mp4" : "webm";
          const path = `${user.id}/${ts}-liveness.${ext}`;
          const up = await supabase.storage.from("liveness-media").upload(path, videoBlob, {
            contentType: videoBlob.type || "video/webm",
            upsert: true,
          });
          if (!up.error) videoPath = path;
          else console.error("liveness video upload failed", up.error);
        }

        const uploads = await Promise.all(
          frames.map(async (f, i) => {
            const path = `${user.id}/${ts}-frame-${String(i).padStart(2, "0")}.jpg`;
            const { error } = await supabase.storage.from("liveness-media").upload(path, dataUrlToBlob(f), {
              contentType: "image/jpeg",
              upsert: true,
            });
            return error ? null : path;
          }),
        );
        uploads.forEach((p) => { if (p) framePaths.push(p); });
      } catch (e) {
        console.error("liveness media upload error", e);
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke("verify-liveness", {
        body: { action: actionKey, frames, video_path: videoPath, frame_paths: framePaths },
      });
      if (error) {
        const msg = (data as { error?: string } | undefined)?.error ?? error.message ?? "Verification failed.";
        toast.error(msg);
        setResult({ passed: false, score: 0, reason: msg });
        setPhase("result");
        return;
      }
      const r = data as { passed: boolean; face_match_score: number; reason: string };
      setResult({ passed: r.passed, score: r.face_match_score, reason: r.reason });
      setPhase("result");
      if (r.passed) {
        stopAll();
        setTimeout(() => onPassed(), 1500);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Verification failed.";
      toast.error(msg);
      setResult({ passed: false, score: 0, reason: msg });
      setPhase("result");
    }
  };

  const startSession = async () => {
    setLoadingMsg("Loading face detection…");
    setPhase("loading");

    try {
      for (const src of CDN_SCRIPTS) await loadScriptOnce(src);
    } catch {
      toast.error("Failed to load face detection library.");
      setPhase("ready");
      return;
    }

    const w = window as any;
    if (!w.FaceMesh || !w.Camera) {
      toast.error("Face detection library unavailable.");
      setPhase("ready");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      toast.error("Camera access denied. Please enable it in your browser settings.");
      setPhase("ready");
      return;
    }

    // Reset state
    framesRef.current = [];
    currentIdxRef.current = 0;
    blinkStateRef.current = { below: false, count: 0 };
    holdRef.current = 0;
    advancingRef.current = false;
    submittedRef.current = false;
    setCurrentIdx(0);
    setResult(null);

    const faceMesh = new w.FaceMesh({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMesh.onResults((results: any) => {
      const lm = results?.multiFaceLandmarks?.[0];
      if (lm && lm.length) evaluateChallenge(lm);
    });
    faceMeshRef.current = faceMesh;

    const camera = new w.Camera(videoRef.current!, {
      onFrame: async () => {
        if (faceMeshRef.current && videoRef.current) {
          await faceMeshRef.current.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });
    cameraRef.current = camera;
    camera.start();

    // Frame collection every 800ms, max 10
    frameTimerRef.current = window.setInterval(() => {
      if (framesRef.current.length >= 10) return;
      const f = captureFrame();
      if (f) framesRef.current.push(f);
    }, 800);

    setPhase("running");
  };

  const resetAll = () => {
    stopAll();
    framesRef.current = [];
    currentIdxRef.current = 0;
    blinkStateRef.current = { below: false, count: 0 };
    holdRef.current = 0;
    advancingRef.current = false;
    submittedRef.current = false;
    setCurrentIdx(0);
    setResult(null);
    setPhase("ready");
  };

  // Initial ready state (no camera / no library loaded yet)
  useEffect(() => {
    setPhase("ready");
  }, []);

  const active = challenges[currentIdx];

  return (
    <section className="bg-card border border-border rounded-xl p-6 md:p-8">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center"><Video className="h-4 w-4" /></div>
        <div>
          <h2 className="font-semibold">Step 2 · Active liveness check</h2>
          <p className="text-sm text-muted-foreground">Complete 4 quick face challenges to prove you're a real person.</p>
        </div>
      </div>

      {phase === "running" && active && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium">Action: {active.label}</p>
            <span className="text-xs text-muted-foreground">Challenge {currentIdx + 1} of {challenges.length}</span>
          </div>
          <p className="text-muted-foreground">{active.instruction}</p>
          <Progress value={((currentIdx) / challenges.length) * 100} className="mt-3 h-1.5" />
        </div>
      )}

      <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-black grid place-items-center">
        <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        {phase === "ready" && (
          <div className="relative z-10 text-center text-white/80 px-6">
            <Camera className="h-8 w-8 mx-auto mb-2 opacity-70" />
            <p className="text-sm">Camera is off</p>
          </div>
        )}
        {phase === "loading" && (
          <div className="absolute inset-0 bg-black/60 grid place-items-center text-white text-sm gap-2">
            <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> {loadingMsg}</div>
          </div>
        )}
        {passedFlash && phase === "running" && (
          <div className="absolute inset-0 bg-emerald-500/30 grid place-items-center text-white text-2xl font-bold">
            ✓ Passed
          </div>
        )}
        {phase === "submitting" && (
          <div className="absolute inset-0 bg-black/60 grid place-items-center text-white text-sm gap-2">
            <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Analyzing…</div>
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
        {phase === "ready" && (
          <Button className="flex-1" onClick={startSession}>
            <Camera className="h-4 w-4 mr-2" /> Start liveness check
          </Button>
        )}
        {phase === "loading" && (
          <Button className="flex-1" disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
          </Button>
        )}
        {phase === "running" && (
          <Button className="flex-1" disabled>
            Follow the on-screen prompt…
          </Button>
        )}
        {phase === "submitting" && (
          <Button className="flex-1" disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…
          </Button>
        )}
        {phase === "result" && (
          <Button className="flex-1" variant={result?.passed ? "default" : "outline"} onClick={resetAll}>
            {result?.passed ? "Continue" : "Try again"}
          </Button>
        )}
        {(phase === "running" || phase === "loading") && (
          <Button variant="outline" onClick={resetAll}>Cancel</Button>
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
