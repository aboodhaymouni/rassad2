// Edge function: generate-content
// Generates Arabic verification content (news/reports/agents/social) into public.articles.
// Triggered manually or via scheduled cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `أنت محرّر محتوى عربي في منصة "رصد" للتحقق الرقمي.
ستُنشئ محتوى تجريبيًا واقعي الأسلوب لعرض المنصة فقط (مع الإشارة الواضحة في metadata.demo=true).
الأسلوب: عربية فصحى مختصرة، عناوين قوية، تجنّب الإثارة المضللة.`;

type ContentType = "news" | "report" | "agent" | "social";

const PROMPTS: Record<ContentType, string> = {
  news: "أنشئ 4 بطاقات أخبار تحقق متنوعة (سياسة/صحة/تقنية/اقتصاد) لكل واحدة حكم وثقة وملخص.",
  report: "أنشئ 3 تقارير تحليلية معمّقة (250-400 كلمة لكل تقرير) عن ظواهر معلوماتية حديثة.",
  agent: "أنشئ 4 وكلاء تحقق متخصصين (مثلاً: وكيل التحقق من الصور، وكيل تتبع الإشاعات...). كل وكيل: اسم + وصف + تخصص.",
  social: "أنشئ 4 منشورات سوشيال ميديا متداولة تحتاج تحققًا، مع حكم وثقة لكل منشور.",
};

const TOOL = {
  type: "function",
  function: {
    name: "submit_articles",
    description: "Submit generated articles for the platform.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              body: { type: "string" },
              verdict: {
                type: "string",
                enum: ["trusted", "suspicious", "fake", "uncertain"],
              },
              confidence: { type: "integer", minimum: 0, maximum: 100 },
              category: { type: "string" },
            },
            required: ["title", "summary"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const type = (body.type ?? "news") as ContentType;
    if (!["news", "report", "agent", "social"].includes(type)) {
      return json({ error: "Invalid type" }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI not configured" }, 500);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: PROMPTS[type] },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "submit_articles" } },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
    if (aiRes.status === 402) return json({ error: "Credits exhausted" }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return json({ error: "AI gateway error" }, 502);
    }
    const data = await aiRes.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "No content returned" }, 502);
    const args = JSON.parse(toolCall.function.arguments);
    const items = Array.isArray(args.items) ? args.items : [];
    if (!items.length) return json({ error: "Empty content" }, 502);

    // Service role client to bypass RLS for system inserts
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, serviceKey);

    const rows = items.slice(0, 12).map((it: any) => ({
      type,
      title: String(it.title ?? "").slice(0, 240),
      summary: it.summary ? String(it.summary).slice(0, 600) : null,
      body: it.body ? String(it.body).slice(0, 4000) : null,
      verdict: it.verdict ?? null,
      confidence: typeof it.confidence === "number" ? Math.max(0, Math.min(100, it.confidence | 0)) : null,
      category: it.category ? String(it.category).slice(0, 80) : null,
      metadata: { demo: true, generated_by: "google/gemini-2.5-flash" },
    }));

    const { error: insErr } = await admin.from("articles").insert(rows);
    if (insErr) {
      console.error("Insert error", insErr);
      return json({ error: "Failed to insert" }, 500);
    }

    return json({ inserted: rows.length, type }, 200);
  } catch (e) {
    console.error("generate-content error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
