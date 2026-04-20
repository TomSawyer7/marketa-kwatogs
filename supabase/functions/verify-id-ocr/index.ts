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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !ANON || !SERVICE) {
      return new Response(JSON.stringify({ error: "Missing function environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
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

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a Philippine National ID (PhilSys) OCR and quality verifier. Inspect both front and back images. Extract data exactly as printed. Return ONLY via the provided tool. If text is not legible, set quality_ok=false and provide quality_issue.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract Philippine National ID details from these two images (front + back)." },
              { type: "image_url", image_url: { url: `data:${front.mime};base64,${front.b64}` } },
              { type: "image_url", image_url: { url: `data:${back.mime};base64,${back.b64}` } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_id_extraction",
            description: "Report extracted Philippine National ID data and image quality assessment.",
            parameters: {
              type: "object",
              properties: {
                quality_ok: { type: "boolean", description: "True if both images are sharp and readable." },
                quality_issue: { type: "string", description: "If quality_ok=false, describe the issue (e.g. 'Front image is blurry')." },
                full_name: { type: "string" },
                date_of_birth: { type: "string", description: "ISO YYYY-MM-DD if possible." },
                gender: { type: "string" },
                psn: { type: "string", description: "PhilSys Number (PCN/PSN) as printed." },
                address: { type: "string" },
                looks_like_philid: { type: "boolean", description: "True if the front image is clearly a Philippine National ID." },
              },
              required: ["quality_ok", "looks_like_philid"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_id_extraction" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Failed to parse ID. Please retake clearer photos." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    if (!extracted.looks_like_philid) {
      return new Response(JSON.stringify({ error: "This does not appear to be a Philippine National ID." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!extracted.quality_ok) {
      return new Response(JSON.stringify({
        error: extracted.quality_issue || "Image too blurred. Please retake.",
        retry: true,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      ocr_full_name: extracted.full_name ?? null,
      ocr_date_of_birth: extracted.date_of_birth ?? null,
      ocr_gender: extracted.gender ?? null,
      ocr_psn: extracted.psn ?? null,
      ocr_address: extracted.address ?? null,
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
        full_name: extracted.full_name,
        date_of_birth: extracted.date_of_birth,
        gender: extracted.gender,
        psn: extracted.psn,
        address: extracted.address,
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