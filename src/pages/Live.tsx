import { useEffect, useState } from "react";
import { Layout } from "@/components/rasad/Layout";
import { LiveTicker } from "@/components/rasad/LiveTicker";
import { Seo } from "@/components/seo/Seo";
import { getLiveStats, refreshLive, type LiveStatsResponse } from "@/lib/rasad-api";
import { Activity, AlertTriangle, RefreshCw, Shield, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const RISK_FILTERS: Array<{ key: string; label: string; Icon: typeof Shield; classes: string }> = [
  { key: "", label: "الكل", Icon: Activity, classes: "text-foreground" },
  { key: "verified", label: "موثوق", Icon: Shield, classes: "text-verified" },
  { key: "suspicious", label: "مشكوك", Icon: AlertTriangle, classes: "text-warning" },
  { key: "risky", label: "خطر", Icon: ShieldAlert, classes: "text-primary" },
];

const LivePage = () => {
  const [stats, setStats] = useState<LiveStatsResponse | null>(null);
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await getLiveStats();
        if (!cancelled) setStats(s);
      } catch {
        // ignore
      }
    };
    tick();
    const t = window.setInterval(tick, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const onRefreshNow = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshLive();
      toast.success("تم استدعاء دورة جديدة من البحث");
    } catch (e) {
      toast.error("تعذّر استدعاء دورة جديدة");
    } finally {
      setTimeout(() => setRefreshing(false), 2500);
    }
  };

  return (
    <Layout>
      <Seo
        title="رصد | البث المباشر للأخبار العربية المُتحقَّقة"
        description="نراقب 10 مصادر إخبارية عربية ونحلل كل خبر جديد بالذكاء الاصطناعي خلال ثوانٍ. تحديث مباشر، تصنيف مخاطر، وروابط للمصادر الأصلية."
        path="/live"
      />

      <section className="border-b border-white/[0.06]">
        <div className="container py-12 md:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="chip mb-4">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="mono text-[11px] uppercase tracking-widest text-primary">LIVE</span>
              </div>
              <h1 className="text-3xl font-extrabold leading-[1.4] md:text-5xl md:leading-[1.3]">
                البث المباشر <span className="text-primary">للأخبار</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-[2] text-muted-foreground md:text-lg md:leading-[2.1]">
                نسحب أحدث الأخبار من 10 مصادر عربية كل بضع دقائق ونحللها فورياً
                بمحركَي A1 (تحليل لغوي) و A4 (كشف التضليل) — كل شيء حقيقي ومجاني.
              </p>
            </div>
            <button
              onClick={onRefreshNow}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              تحديث الآن
            </button>
          </div>
        </div>
      </section>

      <section className="container py-10">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="إجمالي الأخبار"
            value={stats?.total ?? 0}
            sub={`${stats?.cycles_completed ?? 0} دورات`}
          />
          <StatCard
            label="موثوق"
            value={stats?.by_risk?.verified ?? 0}
            tone="verified"
          />
          <StatCard
            label="مشكوك / خطر"
            value={(stats?.by_risk?.suspicious ?? 0) + (stats?.by_risk?.risky ?? 0)}
            tone="warning"
          />
          <StatCard
            label="آخر تحديث"
            value={stats?.last_added_count ?? 0}
            sub={stats?.last_run_at ? formatRelative(stats.last_run_at) : "—"}
            sublabel="عناصر جديدة"
          />
        </div>
      </section>

      <section className="container pb-16">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {RISK_FILTERS.map((f) => {
            const active = riskFilter === f.key;
            return (
              <button
                key={f.key || "all"}
                onClick={() => setRiskFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground"
                }`}
              >
                <f.Icon className={`h-3.5 w-3.5 ${active ? "" : f.classes}`} />
                {f.label}
              </button>
            );
          })}
        </div>

        <LiveTicker
          variant="full"
          limit={36}
          pollIntervalMs={15000}
          riskFilter={riskFilter}
        />
      </section>
    </Layout>
  );
};

const StatCard = ({
  label,
  value,
  sub,
  sublabel,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  sublabel?: string;
  tone?: "verified" | "warning" | "primary";
}) => {
  const toneClass =
    tone === "verified"
      ? "text-verified"
      : tone === "warning"
        ? "text-warning"
        : tone === "primary"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="glass-panel p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-2 display text-3xl font-extrabold leading-none ${toneClass}`}>{value}</div>
      {sub && (
        <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {sublabel ? <span className="font-semibold">{sublabel}: </span> : null}
          {sub}
        </div>
      )}
    </div>
  );
};

const formatRelative = (iso: string): string => {
  try {
    const date = new Date(iso);
    const ms = Date.now() - date.getTime();
    if (ms < 60_000) return "الآن";
    const min = Math.floor(ms / 60_000);
    if (min < 60) return `قبل ${min} د`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `قبل ${hr} س`;
    return `قبل ${Math.floor(hr / 24)} يوم`;
  } catch {
    return "—";
  }
};

export default LivePage;
