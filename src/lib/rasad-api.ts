/**
 * RASAD FastAPI client.
 *
 * The backend (Python FastAPI) lives separately from Supabase. Auth is still
 * handled by Supabase; only verification calls flow through this adapter.
 *
 * If VITE_RASAD_API_URL is unset or the request fails, the caller can fall
 * back to the legacy `supabase.functions.invoke('verify-claim')` path.
 */

export const RASAD_API_BASE: string =
  (import.meta as any).env?.VITE_RASAD_API_URL ?? "http://localhost:8000/api/v1";

export type AgentMode = "real" | "demo" | "fallback" | "mixed";
export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient_data" | "timeout";

export type VerdictLabel =
  | "VERIFIED"
  | "FALSE"
  | "MISLEADING"
  | "AI_GENERATED"
  | "MANIPULATED"
  | "OLD_NEWS"
  | "UNVERIFIED"
  | "DUPLICATE"
  | "HIGH_RISK";

export interface AgentResult {
  agent: string;
  score: number;
  confidence: ConfidenceLevel;
  evidence: string[];
  raw: Record<string, unknown>;
  elapsed_ms: number;
  mode: AgentMode;
}

export interface FinalVerdict {
  id: string;
  verdict: VerdictLabel;
  confidence: number;
  arabic_explanation: string;
  english_explanation?: string;
  agent_breakdown: Record<string, AgentResult>;
  sources: string[];
  processing_time_ms: number;
  content_type: string;
  content_hash?: string;
  weighted_score?: number;
  mode: AgentMode;
  cached?: boolean;
  created_at: string;
}

export interface WebSourceMatch {
  title: string;
  summary: string;
  url: string;
  source_name: string;
  domain: string;
  pub_date?: string | null;
  kind: "rss" | "web" | string;
  engine?: string;
  similarity: number;
}

export interface WebSearchHit {
  title: string;
  url: string;
  snippet: string;
  source_domain: string;
  language: string;
  pub_date?: string | null;
  engine: string;
  score: number;
  scraped?: {
    title: string;
    summary: string;
    word_count: number;
    language: string;
    method: string;
    pub_date?: string | null;
  };
}

export interface SearchResponse {
  query: string;
  language: string;
  comprehensive: boolean;
  scraped: boolean;
  engines: Record<string, boolean>;
  count: number;
  results: WebSearchHit[];
}

export interface LiveItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source_name: string;
  source_domain: string;
  pub_date: string | null;
  seen_at: string;
  emotion_score: number;
  fake_score: number;
  risk_label: "verified" | "suspicious" | "risky" | "neutral" | string;
  flags: string[];
  topic: string;
}

export interface LiveFeedResponse {
  items: LiveItem[];
  watermark: string | null;
  monitor: "live" | "disabled" | string;
}

export interface LiveStatsResponse {
  total: number;
  max: number;
  by_risk: Record<string, number>;
  by_source: Record<string, number>;
  cycles_completed: number;
  last_run_at: string | null;
  last_added_count: number;
  interval_seconds: number;
  errors_total: number;
  monitor: "live" | "disabled" | string;
}

export interface MonitorItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source_name: string;
  verdict?: VerdictLabel;
  confidence: number;
  published_at: string;
  flagged: boolean;
}

export interface RasadHealth {
  status: string;
  agents: number;
  version: string;
  services: Record<string, string>;
  environment: string;
}

export class RasadApiError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "RasadApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${RASAD_API_BASE}${path}`;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const resp = await fetch(url, { ...init, headers });
  if (!resp.ok) {
    let detail: string | undefined;
    try {
      const body = await resp.json();
      detail = body?.detail || body?.message || JSON.stringify(body).slice(0, 200);
    } catch {
      detail = await resp.text().catch(() => undefined);
    }
    throw new RasadApiError(
      `RASAD API ${resp.status}: ${resp.statusText}`,
      resp.status,
      detail,
    );
  }
  return (await resp.json()) as T;
}

export async function verifyText(
  text: string,
  options: { language?: "ar" | "en" | "auto"; signal?: AbortSignal } = {},
): Promise<FinalVerdict> {
  return request<FinalVerdict>("/verify/text", {
    method: "POST",
    body: JSON.stringify({
      text,
      language: options.language ?? "auto",
      include_breakdown: true,
    }),
    signal: options.signal,
  });
}

export async function verifyUrl(
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<FinalVerdict> {
  return request<FinalVerdict>("/verify/url", {
    method: "POST",
    body: JSON.stringify({ url, language: "auto", include_breakdown: true }),
    signal: options.signal,
  });
}

export async function verifyMedia(
  file: File,
  options: { contextText?: string; mediaType?: "image" | "video" | "audio"; signal?: AbortSignal } = {},
): Promise<FinalVerdict> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("media_type", options.mediaType ?? "image");
  if (options.contextText) fd.append("context_text", options.contextText);
  return request<FinalVerdict>("/verify/media", {
    method: "POST",
    body: fd,
    signal: options.signal,
  });
}

export async function getLiveFeed(
  options: {
    limit?: number;
    since?: string | null;
    risk?: string;
    domain?: string;
    topic?: string;
    signal?: AbortSignal;
  } = {},
): Promise<LiveFeedResponse> {
  const params = new URLSearchParams({ limit: String(options.limit ?? 30) });
  if (options.since) params.set("since", options.since);
  if (options.risk) params.set("risk", options.risk);
  if (options.domain) params.set("domain", options.domain);
  if (options.topic) params.set("topic", options.topic);
  return request<LiveFeedResponse>(`/live/feed?${params.toString()}`, { signal: options.signal });
}

export async function getLiveStats(): Promise<LiveStatsResponse> {
  return request<LiveStatsResponse>("/live/stats");
}

export async function refreshLive(): Promise<{ ok: boolean; kicked_at: string }> {
  return request<{ ok: boolean; kicked_at: string }>("/live/refresh", { method: "POST" });
}

export async function searchWeb(
  query: string,
  options: { limit?: number; language?: "ar" | "en"; comprehensive?: boolean; scrape?: boolean } = {},
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(options.limit ?? 10),
    language: options.language ?? "ar",
    comprehensive: String(options.comprehensive ?? false),
    scrape: String(options.scrape ?? false),
  });
  return request<SearchResponse>(`/search?${params.toString()}`);
}

export async function getMonitorFeed(limit = 20): Promise<{ items: MonitorItem[]; sources: string[] }> {
  return request<{ items: MonitorItem[]; sources: string[] }>(
    `/monitor/feed?limit=${limit}`,
  );
}

export async function getTrending(limit = 10): Promise<{ items: any[] }> {
  return request<{ items: any[] }>(`/monitor/trending?limit=${limit}`);
}

export async function getHealth(): Promise<RasadHealth> {
  return request<RasadHealth>("/health");
}

export async function pingRasad(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const resp = await fetch(`${RASAD_API_BASE}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return resp.ok;
  } catch {
    return false;
  }
}
