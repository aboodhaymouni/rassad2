// Edge function: scan-keywords
// Scans recent articles against active keyword_alerts and inserts notifications.
// Designed to be invoked by cron OR manually by an admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, serviceKey);

    // Last 24h articles
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: articles } = await supabase
      .from("articles")
      .select("id, title, summary, verdict")
      .gte("published_at", since);

    const { data: alerts } = await supabase
      .from("keyword_alerts")
      .select("id, user_id, keyword, match_verdicts, active")
      .eq("active", true);

    if (!articles?.length || !alerts?.length) {
      return j({ scanned: articles?.length ?? 0, alerts: alerts?.length ?? 0, created: 0 });
    }

    let created = 0;
    const inserts: Array<Record<string, unknown>> = [];

    for (const a of alerts) {
      const kw = a.keyword.toLowerCase().trim();
      if (!kw) continue;
      for (const art of articles) {
        const text = `${art.title ?? ""} ${art.summary ?? ""}`.toLowerCase();
        const verdictMatch = !a.match_verdicts?.length || a.match_verdicts.includes(art.verdict ?? "");
        if (text.includes(kw) && verdictMatch) {
          inserts.push({
            user_id: a.user_id,
            alert_id: a.id,
            article_id: art.id,
            matched_keyword: a.keyword,
          });
        }
      }
    }

    if (inserts.length) {
      const { error } = await supabase.from("alert_notifications").insert(inserts);
      if (error) console.error(error);
      else created = inserts.length;
    }

    return j({ scanned: articles.length, alerts: alerts.length, created });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "err" }, 500);
  }
});

function j(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
