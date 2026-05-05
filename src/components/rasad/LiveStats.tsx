import { useEffect, useState } from "react";
import { getLiveStats, type LiveStatsResponse } from "@/lib/rasad-api";

/**
 * Real numbers, real time. No "+10,000 verifications since 2024" theater —
 * just whatever the running monitor has actually checked + how fresh it is.
 */
export const LiveStats = ({ className = "" }: { className?: string }) => {
  const [stats, setStats] = useState<LiveStatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await getLiveStats();
        if (!cancelled) setStats(s);
      } catch {
        // ignore — keep previous values
      }
    };
    tick();
    const t = window.setInterval(tick, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const total = stats?.total ?? 0;
  const verified = stats?.by_risk?.verified ?? 0;
  const cycles = stats?.cycles_completed ?? 0;
  const lastRun = stats?.last_run_at;

  const items: Array<{ value: string | number; label: string; tone?: string }> = [
    { value: total, label: "خبر فحصناه" },
    { value: verified, label: "حكم: موثوق" },
    { value: cycles, label: "دورة سحب" },
    {
      value: lastRun ? formatRelative(lastRun) : "—",
      label: "آخر تحديث",
    },
  ];

  return (
    <dl className={`grid grid-cols-2 gap-y-8 sm:grid-cols-4 ${className}`}>
      {items.map((it, i) => (
        <div key={i} className="border-s-2 border-primary/30 ps-4">
          <dt className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {it.label}
          </dt>
          <dd className="mt-2 font-extrabold leading-none">
            <span className="text-3xl tabular-nums md:text-4xl">{it.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
};

const formatRelative = (iso: string): string => {
  try {
    const date = new Date(iso);
    const ms = Date.now() - date.getTime();
    if (ms < 60_000) return "الآن";
    const min = Math.floor(ms / 60_000);
    if (min < 60) return `${min}د`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}س`;
    return `${Math.floor(hr / 24)}ي`;
  } catch {
    return "—";
  }
};
