import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Body = {
  frontImage: string;
  backImage: string;
};

function dataUrlToParts(d: string): { mime: string; b64: string } {
  const m = d.match(/^data:([^;]+);base64,(.+)$/);
  if (m) return { mime: m[1], b64: m[2] };
  return { mime: "image/jpeg", b64: d };
}

function b64ToBlob(b64: string, mime: string): Blob {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

/**
 * IDAnalyzer responses can come in three shapes depending on API version/profile:
 *   - plain string                                 (v1 result.firstName)
 *   - { value, confidence, source }                (v2 single)
 *   - [ { value, confidence, source }, ... ]       (v2 multi-source)
 * Unwrap to a plain string, picking the highest-confidence entry when applicable.
 */
function valueOf(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    const sorted = [...v].sort((a, b) => {
      const ca = typeof a === "object" && a && "confidence" in a ? Number((a as Record<string, unknown>).confidence) || 0 : 0;
      const cb = typeof b === "object" && b && "confidence" in b ? Number((b as Record<string, unknown>).confidence) || 0 : 0;
      return cb - ca;
    });
    return valueOf(sorted[0]);
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("value" in o) return valueOf(o.value);
  }
  return null;
}

function pick(obj: Record<string, unknown> | undefined | null, ...keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const r = valueOf(obj[k]);
    if (r) return r;
  }
  return null;
}

function toIsoDate(input: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd/mm/yyyy or mm/dd/yyyy — try Date.parse fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const IDANALYZER_API_KEY = Deno.env.get("IDANALYZER_API_KEY");

    if (!SUPABASE_URL || !ANON || !SERVICE) {
      return new Response(JSON.stringify({ error: "Missing function environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!IDANALYZER_API_KEY) {
      return new Response(JSON.stringify({ error: "IDANALYZER_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.frontImage || !body?.backImage) {
      return new Response(JSON.stringify({ error: "Both front and back images are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    const front = dataUrlToParts(body.frontImage);
    const back = dataUrlToParts(body.backImage);

    // ---- Call IDAnalyzer v1 Core API (multipart) ----
    // verbose=2 returns the full field set (middleName, sex, placeOfBirth,
    // bloodType, maritalStatus, dateOfIssue) but each field becomes an array
    // of {value,confidence,source} entries — valueOf() unwraps them.
    const form = new FormData();
    form.append("apikey", IDANALYZER_API_KEY);
    form.append("file", b64ToBlob(front.b64, front.mime), "front.jpg");
    form.append("file_back", b64ToBlob(back.b64, back.mime), "back.jpg");
    form.append("accuracy", "2");
    form.append("verbose", "2");
    form.append("authenticate", "false");

    const idaResp = await fetch("https://api.idanalyzer.com/", {
      method: "POST",
      body: form,
    });

    if (!idaResp.ok) {
      const t = await idaResp.text();
      console.error("IDAnalyzer http error", idaResp.status, t.slice(0, 500));
      return new Response(JSON.stringify({
        error: `IDAnalyzer request failed (${idaResp.status}). Please retake the photos and try again.`,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idaJson = await idaResp.json() as Record<string, unknown>;
    console.log("IDAnalyzer raw response keys:", Object.keys(idaJson));
    // Log the full result so we can see every field IDAnalyzer returned.
    const resultStr = JSON.stringify(idaJson.result ?? idaJson);
    console.log("IDAnalyzer result length:", resultStr.length);
    for (let i = 0; i < resultStr.length; i += 1500) {
      console.log(`IDAnalyzer result chunk ${i / 1500}:`, resultStr.slice(i, i + 1500));
    }

    // v1: { error, result: {...} }; v2: { data: {...}, error }
    const apiError = idaJson.error as { message?: string } | string | undefined;
    if (apiError && typeof apiError === "object" && apiError.message) {
      console.error("IDAnalyzer api error", apiError);
      return new Response(JSON.stringify({ error: apiError.message }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = ((idaJson.result as Record<string, unknown>) ??
                  (idaJson.data as Record<string, unknown>) ??
                  idaJson) as Record<string, unknown>;

    // Field extraction — covers v1 verbose response keys for PhilSys IDs
    const firstName = pick(data, "firstName", "first_name", "givenName", "given_name", "given_names");
    const middleName = pick(data, "middleName", "middle_name", "middlename");
    const lastName = pick(data, "lastName", "last_name", "surname", "familyName", "family_name", "lastname");
    const fullName =
      pick(data, "fullName", "full_name", "name") ||
      [firstName, middleName, lastName].filter(Boolean).join(" ").trim() ||
      null;
    const documentNumber = pick(data, "documentNumber", "document_number", "documentNo", "docNumber", "id_number");
    const dob = toIsoDate(pick(data, "dob", "birthDate", "dateOfBirth", "date_of_birth"));
    const sex = pick(data, "sex", "gender");
    const nationality = pick(data, "nationality_full", "nationality", "nationality_iso3");
    const address = pick(data, "address1", "address", "fullAddress", "full_address");
    const placeOfBirth = pick(data, "placeOfBirth", "place_of_birth", "birthPlace", "birth_place", "pob");
    const bloodType = pick(data, "bloodType", "blood_type", "blood");
    const maritalStatus = pick(data, "maritalStatus", "marital_status", "civilStatus", "civil_status");
    const dateOfIssue = toIsoDate(pick(data, "issued", "dateOfIssue", "date_of_issue", "issueDate", "issue_date"));
    const documentType = (pick(data, "documentType", "document_type", "type", "documentName", "document_name") ?? "").toLowerCase();

    if (!fullName && !documentNumber) {
      return new Response(JSON.stringify({
        error: "We couldn't read your ID. Please retake clearer photos in good lighting.",
        retry: true,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const looksLikeId = documentType.includes("national") || documentType.includes("identity") || !!documentNumber;
    if (!looksLikeId) {
      return new Response(JSON.stringify({
        error: "This does not appear to be a valid government ID.",
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Persist images + draft verification row ----
    const admin = createClient(SUPABASE_URL, SERVICE);
    const ts = Date.now();
    const frontPath = `${user.id}/${ts}-front.jpg`;
    const backPath = `${user.id}/${ts}-back.jpg`;
    const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    const [up1, up2] = await Promise.all([
      admin.storage.from("id-documents").upload(frontPath, decode(front.b64), {
        contentType: front.mime,
        upsert: true,
      }),
      admin.storage.from("id-documents").upload(backPath, decode(back.b64), {
        contentType: back.mime,
        upsert: true,
      }),
    ]);

    if (up1.error || up2.error) {
      console.error("upload err", up1.error, up2.error);
      return new Response(JSON.stringify({ error: "Failed to store ID images." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: vErr } = await admin.from("verifications").upsert({
      user_id: user.id,
      status: "pending",
      id_front_path: frontPath,
      id_back_path: backPath,
      // Legacy summary columns (kept for admin queue compatibility)
      ocr_full_name: fullName,
      ocr_date_of_birth: dob,
      ocr_gender: sex,
      ocr_psn: documentNumber,
      ocr_address: address,
      // Rich IDAnalyzer fields
      ocr_first_name: firstName,
      ocr_middle_name: middleName,
      ocr_last_name: lastName,
      ocr_document_number: documentNumber,
      ocr_nationality: nationality,
      ocr_place_of_birth: placeOfBirth,
      ocr_blood_type: bloodType,
      ocr_marital_status: maritalStatus,
      ocr_date_of_issue: dateOfIssue,
      ocr_sex: sex,
      liveness_passed: false,
      face_match_score: null,
      admin_notes: null,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (vErr) {
      console.error("db err", vErr);
      return new Response(JSON.stringify({ error: `Failed to save submission: ${vErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      extracted: {
        full_name: fullName,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        document_number: documentNumber,
        date_of_birth: dob,
        sex,
        nationality,
        address,
        place_of_birth: placeOfBirth,
        blood_type: bloodType,
        marital_status: maritalStatus,
        date_of_issue: dateOfIssue,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-id-ocr error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
