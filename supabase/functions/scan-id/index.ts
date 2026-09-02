import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Body = {
  front?: string;
  back?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    const IDANALYZER_API_KEY = Deno.env.get("IDANALYZER_API_KEY");

    if (!SUPABASE_URL || !ANON) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase function environment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!IDANALYZER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ID analyzer key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.front || !body.back) {
      return new Response(
        JSON.stringify({ error: "front and back images are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch("https://api2.idanalyzer.com/scan", {
      method: "POST",
      headers: {
        "X-API-KEY": IDANALYZER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document: body.front,
        documentBack: body.back,
        outputImage: true,
        outputFace: true,
      }),
    });

    const data = await response.json();
    console.log("RAW API RESPONSE:", JSON.stringify(data, null, 2));

    if (data.error) {
      throw new Error(data.error.message ?? "ID scan failed");
    }

    const d = data.data;

    let qrPayload = "";
    try {
      const barcodes = d.barcode;
      if (barcodes && Array.isArray(barcodes)) {
        for (const bc of barcodes) {
          const raw = bc?.value;
          if (raw && String(raw).trim() !== "") {
            qrPayload = String(raw);
            break;
          }
        }
      }
    } catch { /* noop */ }

    let firstName = d.firstName?.[0]?.value || "";
    let middleName = d.middleName?.[0]?.value || "";
    let lastName = d.lastName?.[0]?.value || "";
    let fullName = d.fullName?.[0]?.value || "";
    let dateOfBirth = d.dob?.[0]?.value || "";
    let age = d.age?.[0]?.value || "";
    let address = d.address1?.[0]?.value || "";
    let gender = d.gender?.[0]?.value || "";
    let nationality = d.nationality?.[0]?.value || "";
    let documentNumber = d.documentNumber?.[0]?.value || "";
    let documentName = d.documentName?.[0]?.value || "";
    let maritalStatus = d.maritalStatus?.[0]?.value || "";
    let bloodType = d.bloodType?.[0]?.value || "";
    let placeOfBirth = d.placeOfBirth?.[0]?.value || "";
    let dateOfIssue = d.issued?.[0]?.value || "";
    let dateOfExpiry = d.expiry?.[0]?.value || "";

    try {
      const barcodes = d.barcode;
      if (barcodes && Array.isArray(barcodes)) {
        for (const bc of barcodes) {
          const raw = bc?.value;
          if (!raw || raw.trim() === "") continue;
          const qr = JSON.parse(raw);
          const subject = qr?.subject || {};
          if (!firstName) firstName = subject.fName || "";
          if (!middleName) middleName = subject.mName || "";
          if (!lastName) lastName = subject.lName || "";
          if (!gender) gender = subject.sex || "";
          if (!placeOfBirth) placeOfBirth = subject.POB || "";
          if (!dateOfBirth) dateOfBirth = subject.DOB || "";
          if (!documentNumber) documentNumber = subject.PCN || "";
          if (!dateOfIssue) dateOfIssue = qr.DateIssued || "";
          if (!bloodType) {
            const bf = subject.BF;
            bloodType = Array.isArray(bf) ? bf.join("") : (bf || "");
          }
          break;
        }
      }
    } catch (err) {
      console.warn("QR parse failed:", err);
    }

    if (!fullName) {
      fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
    }

    return new Response(
      JSON.stringify({
        full_name: fullName,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        document_number: documentNumber,
        document_name: documentName,
        date_of_birth: dateOfBirth,
        age: age,
        address: address,
        gender: gender,
        nationality: nationality,
        place_of_birth: placeOfBirth,
        blood_type: bloodType,
        marital_status: maritalStatus,
        date_of_issue: dateOfIssue,
        date_of_expiry: dateOfExpiry,
        face_image: data.face || "",
        qr_payload: qrPayload,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Scan failed.";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
