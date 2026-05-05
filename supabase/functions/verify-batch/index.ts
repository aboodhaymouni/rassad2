// Edge function: verify-batch
// Process multiple claims in a single call (max 10).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) return j({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const items: string[] = Array.isArray(body.items) ? body.items.map(String).slice(0, 10) : [];
    if (items.length === 0) return j({ error: "items[] required (max 10)" }, 400);

    const results: unknown[] = [];
    for (const input of items) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/verify-claim`, {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/json", apikey: anonKey },
          body: JSON.stringify({ input: input.slice(0, 2000), kind: "text" }),
        });
        const d = await r.json();
        results.push(d.verification ?? { error: d.error });
      } catch (e) {
        results.push({ error: String(e) });
      }
    }

    return j({ results }, 200);
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "err" }, 500);
  }
});

function j(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
