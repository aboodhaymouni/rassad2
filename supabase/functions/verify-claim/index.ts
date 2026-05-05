// Edge function: verify-claim
// Multi-mode verification (text / url / image) using Lovable AI Gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `أنت محلل تحقق رقمي محترف باللغة العربية في منصة "رصد".
مهمتك: تقييم ادعاء/رابط/صورة وإصدار حكم موثوق.
- استخدم تفكيرًا تحليليًا وتجنّب الانحياز.
- إذا لم تتوفر معلومات كافية، اختر "uncertain" بثقة منخفضة.
- اكتب باللغة العربية الفصحى المختصرة.
- للصور: حلّل العلامات البصرية (تشوّهات، إضاءة غير منطقية، ميتاداتا ظاهرة، أنماط AI).
- أعد الإجابة دائمًا عبر استدعاء الأداة "submit_verdict" فقط.`;

const TOOL = {
  type: "function",
  function: {
    name: "submit_verdict",
    description: "Submit a verification verdict.",
    parameters: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["trusted", "suspicious", "fake", "uncertain"] },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        explanation: { type: "string", description: "تفسير عربي 50-180 كلمة." },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, note: { type: "string" } },
            required: ["title"],
            additionalProperties: false,
          },
        },
      },
      required: ["verdict", "confidence", "explanation", "sources"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const kind = (body.kind as string) || "text";
    const input = String(body.input ?? "").trim();
    const imageUrl = body.image_url ? String(body.image_url) : null;

    if (kind === "image") {
      if (!imageUrl) return json({ error: "image_url required" }, 400);
    } else {
      if (!input || input.length > 2000) return json({ error: "Invalid input (1-2000 chars)" }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI not configured" }, 500);

    const isUrl = kind === "url" || /^https?:\/\//i.test(input);
    let userContent: unknown;
    if (kind === "image" && imageUrl) {
      userContent = [
        { type: "text", text: `حلّل هذه الصورة وحدد ما إذا كانت أصلية، معدّلة، أو مولّدة بالذكاء الاصطناعي. ${input ? `سياق: ${input}` : ""}` },
        { type: "image_url", image_url: { url: imageUrl } },
      ];
    } else if (isUrl) {
      userContent = `الرابط المراد التحقق منه: ${input}\nقيّم محتواه واحكم على مصداقيته.`;
    } else {
      userContent = `الادعاء المراد التحقق منه: "${input}"\nقيّم مصداقيته بناءً على معرفتك.`;
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: kind === "image" ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "submit_verdict" } },
      }),
    });

    if (aiRes.status === 429) return json({ error: "تم تجاوز الحد. حاول لاحقًا." }, 429);
    if (aiRes.status === 402) return json({ error: "نفدت أرصدة الذكاء الاصطناعي." }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return json({ error: "AI gateway error" }, 502);
    }

    const data = await aiRes.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "No verdict returned" }, 502);

    const args = JSON.parse(toolCall.function.arguments);
    const verdict = args.verdict as string;
    const confidence = Math.max(0, Math.min(100, Number(args.confidence) | 0));
    const explanation = String(args.explanation ?? "");
    const sources = Array.isArray(args.sources) ? args.sources.slice(0, 5) : [];

    const { data: row, error: insErr } = await supabase
      .from("verifications")
      .insert({
        user_id: userId,
        input_text: input || (imageUrl ? "[صورة مرفوعة]" : ""),
        input_url: isUrl ? input : null,
        image_url: imageUrl,
        kind,
        verdict,
        confidence,
        explanation,
        sources,
        model: "google/gemini-2.5-flash",
      })
      .select()
      .single();

    if (insErr) {
      console.error("Insert error", insErr);
      return json({ error: "Failed to save verification" }, 500);
    }

    return json({ verification: row }, 200);
  } catch (e) {
    console.error("verify-claim error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
