import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Article = {
  id: string;
  type: "news" | "report" | "agent" | "social";
  title: string;
  summary: string | null;
  body: string | null;
  verdict: "trusted" | "suspicious" | "fake" | "uncertain" | null;
  confidence: number | null;
  source_url: string | null;
  category: string | null;
  metadata: Record<string, unknown>;
  published_at: string;
};

export const useArticles = (type: Article["type"], limit = 24) => {
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("articles")
      .select("*")
      .eq("type", type)
      .order("published_at", { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(error.message);
        setItems((data ?? []) as Article[]);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [type, limit]);

  const generate = async () => {
    setLoading(true);
    const { error } = await supabase.functions.invoke("generate-content", { body: { type } });
    if (error) setError(error.message);
    const { data } = await supabase
      .from("articles").select("*").eq("type", type)
      .order("published_at", { ascending: false }).limit(limit);
    setItems((data ?? []) as Article[]);
    setLoading(false);
    return !error;
  };

  return { items, loading, error, generate };
};
