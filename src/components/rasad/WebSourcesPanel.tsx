import { ExternalLink, Globe, Newspaper, Rss, Search } from "lucide-react";
import type { WebSourceMatch } from "@/lib/rasad-api";

const SHIELD_DOMAINS: Record<string, string> = {
  "petra.gov.jo": "موثوق رسمي",
  "bbc.co.uk": "موثوق",
  "bbci.co.uk": "موثوق",
  "bbc.com": "موثوق",
  "aljazeera.net": "موثوق",
  "aljazeera.com": "موثوق",
  "reuters.com": "موثوق دولي",
  "afp.com": "موثوق دولي",
  "apnews.com": "موثوق دولي",
  "alarabiya.net": "موثوق",
  "skynewsarabia.com": "موثوق",
  "france24.com": "موثوق",
  "dw.com": "موثوق",
  "alhurra.com": "موثوق",
  "alghad.com": "محلي",
  "alrai.com": "محلي",
  "asharq.com": "إقليمي",
  "rt.com": "بحذر",
  "arabic.rt.com": "بحذر",
  "ar.wikipedia.org": "ويكيبيديا",
  "en.wikipedia.org": "Wikipedia",
};

interface Props {
  matches: WebSourceMatch[];
  webResults?: WebSourceMatch[];
  contradictions?: WebSourceMatch[];
  queries?: string[];
  engines?: Record<string, boolean>;
  rssCount?: number;
  webHitsSeen?: number;
  webScraped?: number;
  className?: string;
}

const formatDate = (iso?: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.toString().slice(0, 10);
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
  }).format(date);
};

const faviconUrl = (domain: string): string => {
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
};

const KindIcon = ({ kind }: { kind: string }) => {
  const Icon = kind === "rss" ? Rss : kind === "web" ? Globe : Newspaper;
  return <Icon className="h-3.5 w-3.5" />;
};

export const WebSourcesPanel = ({
  matches,
  webResults = [],
  contradictions = [],
  queries = [],
  engines = {},
  rssCount = 0,
  webHitsSeen = 0,
  webScraped = 0,
  className = "",
}: Props) => {
  // Combine matches and webResults, deduplicating by URL, prefer matches
  const seen = new Set<string>();
  const all: WebSourceMatch[] = [];
  for (const m of matches) {
    if (!m.url || seen.has(m.url)) continue;
    seen.add(m.url);
    all.push(m);
  }
  for (const m of webResults) {
    if (!m.url || seen.has(m.url)) continue;
    seen.add(m.url);
    all.push(m);
  }

  if (all.length === 0 && contradictions.length === 0) {
    return (
      <div className={`glass-panel p-5 ${className}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4 text-primary" />
          مصادر الإنترنت
        </div>
        <p className="mt-3 text-xs leading-7 text-muted-foreground">
          لم نجد أي مصدر يذكر هذا الادعاء بعد البحث في {webHitsSeen} نتيجة من الإنترنت و {rssCount} مقالة من خلاصات RSS.
        </p>
        {queries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            {queries.map((q, i) => (
              <span key={i} className="chip">
                <Search className="h-3 w-3" />
                {q.length > 40 ? q.slice(0, 40) + "…" : q}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  const activeEngines = Object.entries(engines)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4 text-primary" />
          مصادر الإنترنت ({all.length})
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {webScraped > 0 && (
            <span className="mono">SCRAPED {webScraped}</span>
          )}
          {webHitsSeen > 0 && (
            <span className="mono">HITS {webHitsSeen}</span>
          )}
          {rssCount > 0 && (
            <span className="mono">RSS {rssCount}</span>
          )}
        </div>
      </div>

      {activeEngines.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>محركات نشطة:</span>
          {activeEngines.map((e) => (
            <span key={e} className="mono rounded-full border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5">
              {e}
            </span>
          ))}
        </div>
      )}

      <ul className="space-y-2.5">
        {all.map((m, i) => {
          const domain = m.domain || m.source_name || "";
          const trust = SHIELD_DOMAINS[domain] || SHIELD_DOMAINS[domain.replace(/^www\./, "")];
          const simPct = Math.round((m.similarity ?? 0) * 100);
          return (
            <li
              key={`${m.url}-${i}`}
              className="glass-panel flex items-start gap-3 p-4 transition hover:border-primary/30"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.03]">
                {domain ? (
                  <img
                    src={faviconUrl(domain)}
                    alt=""
                    className="h-5 w-5"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <Globe className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground/80">{domain || m.source_name}</span>
                  {trust && (
                    <span className="rounded-full bg-verified/10 px-1.5 py-0.5 text-[10px] text-verified">
                      {trust}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px]">
                    <KindIcon kind={m.kind} />
                    {m.kind === "rss" ? "RSS" : "ويب"}
                  </span>
                  {m.pub_date && <span className="mono">{formatDate(m.pub_date)}</span>}
                  <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {simPct}% تطابق
                  </span>
                </div>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1.5 line-clamp-2 text-sm font-bold leading-7 text-foreground hover:text-primary hover:underline"
                  dir="auto"
                >
                  {m.title || m.url}
                </a>
                {m.summary && (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-7 text-muted-foreground" dir="auto">
                    {m.summary}
                  </p>
                )}
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  dir="ltr"
                >
                  <ExternalLink className="h-3 w-3" /> {m.url.length > 70 ? m.url.slice(0, 70) + "…" : m.url}
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      {contradictions.length > 0 && (
        <details className="glass-panel mt-2 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-warning">
            تطابقات ضعيفة أو محتمل تناقضها ({contradictions.length})
          </summary>
          <ul className="mt-3 space-y-2 text-xs leading-7 text-muted-foreground">
            {contradictions.map((c, i) => (
              <li key={i}>
                <span className="text-foreground/80">{c.source_name}</span>
                {" — "}
                <a href={c.url} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline" dir="auto">
                  {c.title}
                </a>
                {" "}
                <span className="mono text-[10px]">{Math.round((c.similarity ?? 0) * 100)}%</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
