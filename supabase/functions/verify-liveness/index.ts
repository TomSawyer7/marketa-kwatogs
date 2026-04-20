import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  action: "blink" | "turn_head" | "smile";
  frames: string[]; // 3 base64/dataURL frames
};

function dataUrlToParts(d: string): { mime: string; b64: string } {
  const m = d.match(/^data:([^;]+);base64,(.+)$/);
  if (m) return { mime: m[1], b64: m[2] };
  return { mime: "image/jpeg", b64: d };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = (await req.json()) as Body;
    if (!body?.action || !Array.isArray(body.frames) || body.frames.length < 2) {
      return new Response(JSON.stringify({ error: "action and at least 2 frames required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Load verification row + ID front image
    const { data: verif, error: vErr } = await admin
      .from("verifications")
      .select("status, id_front_path")
      .eq("user_id", user.id)
      .maybeSingle();

    if (vErr || !verif) {
      return new Response(JSON.stringify({ error: "No verification submission found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (verif.status !== "id_approved") {
      return new Response(JSON.stringify({ error: "ID not yet approved by admin." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download ID front for face match
    const dl = await admin.storage.from("id-documents").download(verif.id_front_path);
    if (dl.error || !dl.data) {
      return new Response(JSON.stringify({ error: "Could not load reference ID image." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const idBuf = new Uint8Array(await dl.data.arrayBuffer());
    let bin = "";
    for (let i = 0; i < idBuf.length; i++) bin += String.fromCharCode(idBuf[i]);
    const idB64 = btoa(bin);

    const frames = body.frames.map(dataUrlToParts);

    const actionLabel =
      body.action === "blink" ? "blink (eyes closing then opening)" :
      body.action === "turn_head" ? "head turn (face changing yaw angle)" :
      "smile (mouth shape changing to smile)";

    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text:
        `Frame 1 = reference photo on a Philippine National ID. Frames 2..N = sequential live webcam captures of a real person who was asked to perform: ${actionLabel}.\n` +
        `Tasks:\n1) Liveness: Across the live frames, do you observe the requested action and natural human variation (not a static photo of a photo)? Beware of replay attacks (a phone screen, a printed photo).\n` +
        `2) Face match: Is the person in the live frames the same person as on the ID? Provide a 0-100 confidence.\n` +
        `Return ONLY via the tool.`
      },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${idB64}` } },
      ...frames.map((f) => ({ type: "image_url", image_url: { url: `data:${f.mime};base64,${f.b64}` } })),
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a strict biometric verifier. Be conservative — when in doubt, fail." },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_liveness_and_match",
            description: "Report liveness check + face match result.",
            parameters: {
              type: "object",
              properties: {
                liveness_passed: { type: "boolean", description: "True if requested action observed AND person looks live (not a replay)." },
                liveness_reason: { type: "string" },
                face_match_score: { type: "number", description: "0-100 confidence the live person matches the ID photo." },
                face_match_reason: { type: "string" },
              },
              required: ["liveness_passed", "face_match_score"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_liveness_and_match" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Liveness analysis failed. Please retry." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = JSON.parse(toolCall.function.arguments);

    const passed = result.liveness_passed === true && Number(result.face_match_score) >= 90;

    const newStatus = passed ? "verified" : "id_approved"; // remain at id_approved on fail so user can retry
    await admin.from("verifications").update({
      liveness_passed: result.liveness_passed === true,
      face_match_score: Number(result.face_match_score) || 0,
      status: newStatus,
      verified_at: passed ? new Date().toISOString() : null,
    }).eq("user_id", user.id);

    if (passed) {
      await admin.from("profiles").update({ is_verified: true }).eq("id", user.id);
    }

    return new Response(JSON.stringify({
      ok: true,
      passed,
      liveness_passed: result.liveness_passed === true,
      face_match_score: Number(result.face_match_score) || 0,
      reason: passed
        ? "Identity verified."
        : (result.liveness_reason || result.face_match_reason || "Verification did not meet the threshold. Please retry."),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("verify-liveness error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
