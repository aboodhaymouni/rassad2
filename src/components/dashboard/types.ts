export type Verification = {
  id: string;
  user_id: string;
  input_text: string;
  input_url: string | null;
  image_url: string | null;
  kind: "text" | "url" | "image" | "batch";
  verdict: "trusted" | "suspicious" | "fake" | "uncertain";
  confidence: number;
  explanation: string | null;
  sources: { title: string; note?: string }[];
  model: string | null;
  created_at: string;
};

export type Collection = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type KeywordAlert = {
  id: string;
  user_id: string;
  keyword: string;
  active: boolean;
  match_verdicts: string[];
  created_at: string;
};

export const verdictArabic: Record<string, string> = {
  trusted: "موثوق",
  suspicious: "مشكوك",
  fake: "مزيّف",
  uncertain: "غير مؤكد",
};
