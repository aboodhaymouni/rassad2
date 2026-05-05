import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, ExternalLink, Radio, RefreshCw, Shield, ShieldAlert } from "lucide-react";
import { getLiveFeed, type LiveItem } from "@/lib/rasad-api";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const POLL_INTERVAL_MS = 12000;
const COMPACT_LIMIT = 7;

const riskMeta: Record<string, { label: string; classes: string; Icon: typeof Shield }> = {
  verified: { label: "موثوق", classes: "text-verified border-verified/30 bg-verified/10", Icon: Shield },
  suspicious: { label: "مشكوك", classes: "text-warning border-warning/30 bg-warning/10", Icon: AlertTriangle },
  risky: { label: "خطر", classes: "text-primary border-primary/30 bg-primary/10", Icon: ShieldAlert },
  neutral: { label: "محايد", classes: "text-muted-foreground border-muted-foreground/30 bg-muted/30", Icon: Activity },
};

const faviconUrl = (domain: string): string => {
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
};

interface Props {
  /** "compact" = single column for landing pages, "full" = grid for /live page */
  variant?: "compact" | "full";
  limit?: number;
  pollIntervalMs?: number;
  initialItems?: LiveItem[];
  riskFilter?: string;
  className?: string;
}

export const LiveTicker = ({
  variant = "compact",
  limit,
  pollIntervalMs = POLL_INTERVAL_MS,
  initialItems = [],
  riskFilter,
  className = "",
}: Props) => {
  const effectiveLimit = limit ?? (variant === "compact" ? COMPACT_LIMIT : 24);
  const [items, setItems] = useState<LiveItem[]>(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const data = await getLiveFeed({
          limit: effectiveLimit,
          risk: riskFilter || undefined,
        });
        if (cancelled.current) return;
        setItems(data.items);
        setLastUpdated(new Date());
        setError(null);
      } catch (e) {
        if (!cancelled.current) {
          setError(e instanceof Error ? e.message : "تعذّر تحديث البث");
        }
      } finally {
        if (!cancelled.current) setLoading(false);
      }
      if (!cancelled.current && isPolling) {
        timer = window.setTimeout(tick, pollIntervalMs);
      }
    };

    tick();
    return () => {
      cancelled.current = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [effectiveLimit, isPolling, pollIntervalMs, riskFilter]);

  // High-contrast container: solid dark card with strong border + drop shadow
  // (replaces the semi-transparent glass-panel so the ticker is always
  //  legible even on top of hero gradients).
  const panelClasses =
    "relative overflow-hidden rounded-2xl border border-white/[0.12] bg-[hsl(215_30%_8%)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl";

  if (loading) {
    return (
      <div className={`${panelClasses} p-5 ${className}`}>
        <Header lastUpdated={null} isPolling={isPolling} setIsPolling={setIsPolling} />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-white/[0.05]" />
          ))}
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className={`${panelClasses} p-5 ${className}`}>
        <Header lastUpdated={lastUpdated} isPolling={isPolling} setIsPolling={setIsPolling} />
        <p className="mt-4 text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div className={className}>
        <Header lastUpdated={lastUpdated} isPolling={isPolling} setIsPolling={setIsPolling} />
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <FullCard key={it.id} item={it} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${panelClasses} p-5 ${className}`}>
      <Header lastUpdated={lastUpdated} isPolling={isPolling} setIsPolling={setIsPolling} />
      <ul className="mt-4 space-y-2">
        {items.slice(0, effectiveLimit).map((it, idx) => (
          <CompactRow key={it.id} item={it} highlight={idx === 0} />
        ))}
      </ul>
    </div>
  );
};

const Header = ({
  lastUpdated,
  isPolling,
  setIsPolling,
}: {
  lastUpdated: Date | null;
  isPolling: boolean;
  setIsPolling: (b: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <span className="mono text-xs uppercase tracking-widest text-primary">
        <Radio className="inline h-3.5 w-3.5 -translate-y-px" /> LIVE FEED
      </span>
    </div>
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      {lastUpdated && (
        <span className="mono">
          آخر تحديث {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: ar })}
        </span>
      )}
      <button
        onClick={() => setIsPolling(!isPolling)}
        className={`grid h-6 w-6 place-items-center rounded-md border transition ${
          isPolling
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-white/[0.08] bg-white/[0.03] text-muted-foreground"
        }`}
        title={isPolling ? "إيقاف التحديث المباشر" : "استئناف التحديث المباشر"}
      >
        <RefreshCw className={`h-3 w-3 ${isPolling ? "animate-spin-slow" : ""}`} />
      </button>
    </div>
  </div>
);

const CompactRow = ({ item, highlight }: { item: LiveItem; highlight?: boolean }) => {
  const meta = riskMeta[item.risk_label] ?? riskMeta.neutral;
  return (
    <li
      className={`flex items-start gap-3 rounded-lg border p-3 transition ${
        highlight
          ? "border-primary/40 bg-[hsl(215_30%_11%)] ring-1 ring-primary/25"
          : "border-white/[0.10] bg-[hsl(215_30%_10%)] hover:border-primary/30 hover:bg-[hsl(215_30%_12%)]"
      }`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-white/[0.10] bg-[hsl(215_30%_13%)]">
        {item.source_domain ? (
          <img
            src={faviconUrl(item.source_domain)}
            alt=""
            className="h-4 w-4"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${meta.classes}`}
          >
            <meta.Icon className="h-2.5 w-2.5" /> {meta.label}
          </span>
          <span className="font-semibold text-foreground">{item.source_name}</span>
          <span className="text-muted-foreground" aria-hidden>·</span>
          <span className="mono text-muted-foreground">
            {item.pub_date
              ? formatDistanceToNow(new Date(item.pub_date), { addSuffix: true, locale: ar })
              : "الآن"}
          </span>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-7 text-foreground hover:text-primary"
          dir="auto"
        >
          {item.title}
        </a>
      </div>
    </li>
  );
};

const FullCard = ({ item }: { item: LiveItem }) => {
  const meta = riskMeta[item.risk_label] ?? riskMeta.neutral;
  return (
    <article className="glass-panel flex h-full flex-col p-5 transition hover:border-primary/30">
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.classes}`}>
          <meta.Icon className="h-3 w-3" /> {meta.label}
        </span>
        <span className="mono text-[10px] text-muted-foreground">
          {item.pub_date
            ? formatDistanceToNow(new Date(item.pub_date), { addSuffix: true, locale: ar })
            : "الآن"}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        {item.source_domain && (
          <img src={faviconUrl(item.source_domain)} alt="" className="h-4 w-4" />
        )}
        <span className="font-semibold text-foreground/80">{item.source_name}</span>
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 line-clamp-3 text-sm font-bold leading-7 text-foreground hover:text-primary"
        dir="auto"
      >
        {item.title}
      </a>
      {item.summary && (
        <p className="mt-2 line-clamp-3 text-xs leading-7 text-muted-foreground" dir="auto">
          {item.summary}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between border-t border-white/[0.05] pt-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="mono">عاطفة {Math.round(item.emotion_score * 100)}%</span>
          <span className="mono">تزييف {Math.round(item.fake_score * 100)}%</span>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          dir="ltr"
        >
          المصدر <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </article>
  );
};
