import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/* ============================================================================
 * EXACT scanID logic — DO NOT MODIFY
 * ========================================================================== */
const API_KEY = "XX1ItmlS4XqPOcaxaCeCmh4uQraXZdx6"

async function scanID(frontFile: File, backFile: File) {
  const toBase64 = (file: File): Promise<string> => new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = e => resolve((e.target?.result as string).split(',')[1])
    reader.readAsDataURL(file)
  })

  const frontBase64 = await toBase64(frontFile)
  const backBase64  = await toBase64(backFile)

  const response = await fetch('https://api2.idanalyzer.com/scan', {
    method: 'POST',
    headers: {
      'X-API-KEY':    API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      document:     frontBase64,
      documentBack: backBase64,
      outputImage:  true,
      outputFace:   true
    })
  })

  const data = await response.json()
  console.log("RAW API RESPONSE:", JSON.stringify(data, null, 2))

  if (data.error) throw new Error(data.error.message)

  const d = data.data

  // Capture raw QR payload from the back of the ID (used later for eVerify.gov.ph)
  let qrPayload = ""
  try {
    const barcodes = d.barcode
    if (barcodes && Array.isArray(barcodes)) {
      for (const bc of barcodes) {
        const raw = bc?.value
        if (raw && String(raw).trim() !== "") { qrPayload = String(raw); break }
      }
    }
  } catch { /* noop */ }

  let firstName      = d.firstName?.[0]?.value      || ""
  let middleName     = d.middleName?.[0]?.value     || ""
  let lastName       = d.lastName?.[0]?.value       || ""
  let fullName       = d.fullName?.[0]?.value       || ""
  let dateOfBirth    = d.dob?.[0]?.value            || ""
  let age            = d.age?.[0]?.value            || ""
  let address        = d.address1?.[0]?.value       || ""
  let gender         = d.gender?.[0]?.value         || ""
  let nationality    = d.nationality?.[0]?.value    || ""
  let documentNumber = d.documentNumber?.[0]?.value || ""
  let documentName   = d.documentName?.[0]?.value   || ""
  let maritalStatus  = d.maritalStatus?.[0]?.value  || ""
  let bloodType      = d.bloodType?.[0]?.value      || ""
  let placeOfBirth   = d.placeOfBirth?.[0]?.value   || ""
  let dateOfIssue    = d.issued?.[0]?.value         || ""
  let dateOfExpiry   = d.expiry?.[0]?.value         || ""

  try {
    const barcodes = d.barcode
    if (barcodes && Array.isArray(barcodes)) {
      for (const bc of barcodes) {
        const raw = bc?.value
        if (!raw || raw.trim() === "") continue
        const qr      = JSON.parse(raw)
        const subject = qr?.subject || {}
        if (!firstName)      firstName      = subject.fName || ""
        if (!middleName)     middleName     = subject.mName || ""
        if (!lastName)       lastName       = subject.lName || ""
        if (!gender)         gender         = subject.sex   || ""
        if (!placeOfBirth)   placeOfBirth   = subject.POB   || ""
        if (!dateOfBirth)    dateOfBirth    = subject.DOB   || ""
        if (!documentNumber) documentNumber = subject.PCN   || ""
        if (!dateOfIssue)    dateOfIssue    = qr.DateIssued || ""
        if (!bloodType) {
          const bf = subject.BF
          bloodType = Array.isArray(bf) ? bf.join("") : (bf || "")
        }
        break
      }
    }
  } catch (err) {
    console.warn("QR parse failed:", err)
  }

  if (!fullName) {
    fullName = [firstName, middleName, lastName].filter(Boolean).join(" ")
  }

  return {
    full_name:       fullName,
    first_name:      firstName,
    middle_name:     middleName,
    last_name:       lastName,
    document_number: documentNumber,
    document_name:   documentName,
    date_of_birth:   dateOfBirth,
    age:             age,
    address:         address,
    gender:          gender,
    nationality:     nationality,
    place_of_birth:  placeOfBirth,
    blood_type:      bloodType,
    marital_status:  maritalStatus,
    date_of_issue:   dateOfIssue,
    date_of_expiry:  dateOfExpiry,
    face_image:      data.face || "",
    qr_payload:      qrPayload,
  }
}
/* ========================================================================== */

type Extracted = Awaited<ReturnType<typeof scanID>>;

const toIsoDate = (s: string): string | null => {
  const t = (s || "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export function IDVerification({ onSubmitted }: { onSubmitted: () => void }) {
  const { user } = useAuth();
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = (side: "front" | "back", file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    if (side === "front") { setFront(file); setFrontPreview(url); }
    else { setBack(file); setBackPreview(url); }
    setExtracted(null);
    setError(null);
  };

  const handleScan = async () => {
    if (!front || !back) return;
    setScanning(true); setError(null); setExtracted(null);
    try {
      const result = await scanID(front, back);
      setExtracted(result);
      toast.success("ID scanned. Please review your details.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  };

  const handleRetry = () => {
    setFront(null); setBack(null);
    setFrontPreview(null); setBackPreview(null);
    setExtracted(null); setError(null);
  };

  const handleConfirm = async () => {
    if (!extracted || !user || !front || !back) return;
    setConfirming(true);
    try {
      const ts = Date.now();
      const frontPath = `${user.id}/${ts}-front.jpg`;
      const backPath = `${user.id}/${ts}-back.jpg`;

      const [up1, up2] = await Promise.all([
        supabase.storage.from("id-documents").upload(frontPath, front, {
          contentType: front.type || "image/jpeg",
          upsert: true,
        }),
        supabase.storage.from("id-documents").upload(backPath, back, {
          contentType: back.type || "image/jpeg",
          upsert: true,
        }),
      ]);
      if (up1.error) throw up1.error;
      if (up2.error) throw up2.error;

      const { error: vErr } = await supabase.from("verifications").upsert({
        user_id: user.id,
        status: "pending",
        id_front_path: frontPath,
        id_back_path: backPath,
        ocr_full_name: extracted.full_name || null,
        ocr_first_name: extracted.first_name || null,
        ocr_middle_name: extracted.middle_name || null,
        ocr_last_name: extracted.last_name || null,
        ocr_document_number: extracted.document_number || null,
        ocr_psn: extracted.document_number || null,
        ocr_date_of_birth: extracted.date_of_birth || null,
        ocr_sex: extracted.gender || null,
        ocr_gender: extracted.gender || null,
        ocr_nationality: extracted.nationality || null,
        ocr_address: extracted.address || null,
        ocr_place_of_birth: extracted.place_of_birth || null,
        ocr_blood_type: extracted.blood_type || null,
        ocr_marital_status: extracted.marital_status || null,
        ocr_date_of_issue: toIsoDate(extracted.date_of_issue),
        liveness_passed: false,
        face_match_score: null,
        admin_notes: null,
        submitted_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (vErr) throw vErr;

      // Profile stays is_verified: false until admin approves.
      toast.success("Submitted! Awaiting admin approval.");
      onSubmitted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not submit.";
      setError(msg);
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  };

  // ---------- RENDER ----------
  if (extracted) {
    return (
      <section className="bg-card border border-border rounded-xl p-6 md:p-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-semibold">Review your extracted details</h2>
            <p className="text-sm text-muted-foreground">Confirm everything is correct before sending to the admin.</p>
          </div>
        </div>

        <div className="bg-secondary/50 rounded-lg p-4 text-sm space-y-1.5">
          <Field label="Full name" value={extracted.full_name} />
          <Field label="First name" value={extracted.first_name} />
          <Field label="Middle name" value={extracted.middle_name} />
          <Field label="Last name" value={extracted.last_name} />
          <Field label="Document name" value={extracted.document_name} />
          <Field label="Document number" value={extracted.document_number} />
          <Field label="Date of birth" value={extracted.date_of_birth} />
          <Field label="Age" value={extracted.age} />
          <Field label="Gender" value={extracted.gender} />
          <Field label="Nationality" value={extracted.nationality} />
          <Field label="Place of birth" value={extracted.place_of_birth} />
          <Field label="Address" value={extracted.address} />
          <Field label="Blood type" value={extracted.blood_type} />
          <Field label="Marital status" value={extracted.marital_status} />
          <Field label="Date of issue" value={extracted.date_of_issue} />
          <Field label="Date of expiry" value={extracted.date_of_expiry} />
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex-1" disabled={confirming} onClick={handleRetry}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry upload
          </Button>
          <Button className="flex-1" disabled={confirming} onClick={handleConfirm}>
            {confirming
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</>
              : <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirm details</>}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card border border-border rounded-xl p-6 md:p-8">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center">
          <Upload className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-semibold">Step 1 · Upload your Philippine National ID</h2>
          <p className="text-sm text-muted-foreground">Take clear, well-lit photos of the front and back of your ID.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <UploadSlot label="Front of ID" preview={frontPreview} onPick={(f) => handlePick("front", f)} />
        <UploadSlot label="Back of ID" preview={backPreview} onPick={(f) => handlePick("back", f)} />
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <Button className="w-full mt-5" disabled={!front || !back || scanning} onClick={handleScan}>
        {scanning
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning ID…</>
          : <>Submit <ArrowRight className="h-4 w-4 ml-2" /></>}
      </Button>
    </section>
  );
}

function UploadSlot({ label, preview, onPick }: { label: string; preview: string | null; onPick: (f: File) => void }) {
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
          <img src={preview} alt={label} className="absolute inset-0 w-full h-full object-contain" />
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
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const display = value && String(value).trim() ? String(value) : "—";
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words">{display}</span>
    </div>
  );
}
