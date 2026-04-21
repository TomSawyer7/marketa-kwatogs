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

function pick<T = unknown>(obj: Record<string, unknown> | undefined | null, ...keys: string[]): T | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return null;
}

function toIsoDate(input: unknown): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // mm/dd/yyyy or dd/mm/yyyy — IDAnalyzer typically returns yyyy-mm-dd, fall back to Date parse
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

    // ---- Call IDAnalyzer Core API (Scan) ----
    // Docs: https://developer.idanalyzer.com/coreapi.html
    const idaResp = await fetch("https://api2.idanalyzer.com/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": IDANALYZER_API_KEY,
      },
      body: JSON.stringify({
        profile: "security_low",
        document: front.b64,
        document_back: back.b64,
      }),
    });

    if (!idaResp.ok) {
      const t = await idaResp.text();
      console.error("IDAnalyzer error", idaResp.status, t);
      return new Response(JSON.stringify({
        error: `IDAnalyzer request failed (${idaResp.status}). Please retake the photos and try again.`,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idaJson = await idaResp.json() as Record<string, unknown>;

    // IDAnalyzer returns either { success: true, data: {...} } or top-level fields. Handle both.
    const apiError = idaJson.error as { message?: string } | undefined;
    if (apiError?.message) {
      console.error("IDAnalyzer api error", apiError);
      return new Response(JSON.stringify({ error: apiError.message }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = (idaJson.data as Record<string, unknown>) ?? idaJson;

    const firstName = pick<string>(data, "firstName", "first_name", "givenName");
    const middleName = pick<string>(data, "middleName", "middle_name");
    const lastName = pick<string>(data, "lastName", "last_name", "surname", "familyName");
    const fullName = pick<string>(data, "fullName", "full_name") ||
      [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || null;
    const documentNumber = pick<string>(data, "documentNumber", "document_number", "documentNo");
    const dob = toIsoDate(pick(data, "dob", "dateOfBirth", "date_of_birth"));
    const sex = pick<string>(data, "sex", "gender");
    const nationality = pick<string>(data, "nationality");
    const address = pick<string>(data, "address1", "address");
    const placeOfBirth = pick<string>(data, "placeOfBirth", "place_of_birth");
    const bloodType = pick<string>(data, "bloodType", "blood_type");
    const maritalStatus = pick<string>(data, "maritalStatus", "marital_status");
    const dateOfIssue = toIsoDate(pick(data, "issued", "dateOfIssue", "date_of_issue"));
    const documentType = String(pick(data, "documentType", "document_type") ?? "").toLowerCase();

    if (!fullName && !documentNumber) {
      return new Response(JSON.stringify({
        error: "We couldn't read your ID. Please retake clearer photos in good lighting.",
        retry: true,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Soft check — warn but don't block if it doesn't look like a national ID
    const looksLikePhilId = documentType.includes("national") || documentType.includes("identity") || !!documentNumber;
    if (!looksLikePhilId) {
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
