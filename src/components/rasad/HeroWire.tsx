import { useEffect, useState } from "react";
import { getLiveFeed, type LiveItem } from "@/lib/rasad-api";

/**
 * Single-row marquee-style wire showing the most recent live items.
 * Replaces the fake "LIVE SIGNAL" demo panel — what's on the wire is real.
 */
export const HeroWire = ({ className = "" }: { className?: string }) => {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await getLiveFeed({ limit: 12 });
        if (cancelled) return;
        setItems(data.items);
        setHasError(false);
      } catch {
        if (!cancelled) setHasError(true);
      }
    };
    tick();
    const t = window.setInterval(tick, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  if (hasError && items.length === 0) return null;

  const visible = items.length > 0 ? items : [];
  const dup = [...visible, ...visible]; // duplicate for seamless loop

  return (
    <div className={`relative overflow-hidden border-y border-white/[0.06] bg-background/60 ${className}`}>
      <div className="container flex items-center gap-6 py-3">
        <div className="hidden shrink-0 items-center gap-2 border-e border-white/[0.06] pe-6 sm:flex">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="mono text-[10px] uppercase tracking-[0.25em] text-primary">
            على السلك
          </span>
        </div>
        <div className="relative flex-1 overflow-hidden">
          {visible.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              يجمع رصد أحدث الأخبار العربية ويحدّث نتائجه كل بضع دقائق…
            </div>
          ) : (
            <div className="flex animate-wire-scroll gap-12 whitespace-nowrap text-sm" dir="rtl">
              {dup.map((it, i) => (
                <a
                  key={`${it.id}-${i}`}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-3 hover:text-primary"
                >
                  <span className={`mono inline-block text-[10px] uppercase tracking-widest ${
                    it.risk_label === "verified"
                      ? "text-verified"
                      : it.risk_label === "suspicious"
                        ? "text-warning"
                        : it.risk_label === "risky"
                          ? "text-primary"
                          : "text-muted-foreground"
                  }`}>
                    [{labelOf(it.risk_label)}]
                  </span>
                  <span className="text-foreground/90">{it.title.slice(0, 110)}</span>
                  <span className="text-muted-foreground">— {it.source_name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const labelOf = (r: string): string => {
  switch (r) {
    case "verified":
      return "موثوق";
    case "suspicious":
      return "مشكوك";
    case "risky":
      return "خطر";
    default:
      return "محايد";
  }
};
