import { Layout } from "@/components/rasad/Layout";
import { SectionHeader } from "@/components/rasad/SectionHeader";
import { VerdictBadge } from "@/components/rasad/Badge";
import { ConfidenceRing } from "@/components/rasad/ConfidenceRing";
import { Skeleton } from "@/components/ui/skeleton";
import { useArticles } from "@/hooks/useArticles";
import { GenerateButton, EmptyState } from "@/components/rasad/AdminGenerate";
import { Seo } from "@/components/seo/Seo";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const News = () => {
  const { items, loading, generate } = useArticles("news", 24);
  const featured = items[0];
  const rest = items.slice(1);

  return (
    <Layout>
      <Seo title="مركز الأخبار المتحقق منها | رصد" description="قاعدة معرفية حية للقصص التي تم التحقق منها." path="/news" />

      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div className="container py-20">
          <div className="chip mb-4"><span className="mono text-[11px] tracking-widest">NEWS · VERIFIED</span></div>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">مركز الأخبار المتحقق منها</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">قاعدة معرفية حية للقصص التي تم التحقق منها عبر منظومة وكلاء رصد.</p>
        </div>
      </section>

      <section className="container py-10">
        <div className="mb-6 flex items-center justify-between">
          <SectionHeader align="right" eyebrow="القضايا الأخيرة" title="آخر التحقيقات" />
          <GenerateButton onGenerate={generate} loading={loading} />
        </div>

        {loading && items.length === 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState message="لا توجد أخبار منشورة بعد." />
        ) : (
          <>
            {featured && (
              <article className="glass-panel mb-8 grid overflow-hidden md:grid-cols-2">
                <div className="relative min-h-[280px] bg-gradient-to-br from-surface-2 to-background">
                  {(featured.metadata as any)?.image_url ? (
                    <img src={(featured.metadata as any).image_url} alt={featured.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <>
                      <div className="absolute inset-0 grid-bg opacity-30" />
                      <div className="absolute inset-0 radar-bg" />
                    </>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
                  {featured.category && <div className="absolute end-4 top-4 chip mono">{featured.category}</div>}
                </div>
                <div className="p-8">
                  {featured.verdict && <VerdictBadge verdict={featured.verdict === "uncertain" ? "suspicious" : featured.verdict} />}
                  <h2 className="mt-4 text-2xl font-extrabold leading-9 md:text-3xl">{featured.title}</h2>
                  {featured.summary && <p className="mt-3 text-sm leading-7 text-muted-foreground">{featured.summary}</p>}
                  <div className="mt-6 flex items-center gap-6">
                    {featured.confidence !== null && <ConfidenceRing value={featured.confidence} size={68} label="ثقة" />}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>{formatDistanceToNow(new Date(featured.published_at), { addSuffix: true, locale: ar })}</div>
                      {Array.isArray((featured.metadata as any)?.sources) && (
                        <div className="mono">{(featured.metadata as any).sources.length} مصادر</div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )}

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((n) => {
                const img = (n.metadata as any)?.image_url as string | undefined;
                const sources = (n.metadata as any)?.sources as string[] | undefined;
                return (
                  <article key={n.id} className="glass-panel overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/30">
                    <div className="relative h-44 overflow-hidden bg-surface-2">
                      {img ? (
                        <img src={img} alt={n.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                      ) : (
                        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#16213e,#0f1722)" }} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                      {n.verdict && <div className="absolute end-3 top-3"><VerdictBadge verdict={n.verdict === "uncertain" ? "suspicious" : n.verdict} /></div>}
                      {n.category && <span className="absolute start-3 top-3 chip mono">{n.category}</span>}
                    </div>
                    <div className="p-5">
                      <h3 className="text-base font-bold leading-7 line-clamp-2">{n.title}</h3>
                      {n.summary && <p className="mt-2 line-clamp-3 text-xs leading-6 text-muted-foreground">{n.summary}</p>}
                      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          {n.confidence !== null && <span className="mono">CONF {n.confidence}%</span>}
                          {sources && <span className="mono">{sources.length} مصدر</span>}
                        </div>
                        <span>{formatDistanceToNow(new Date(n.published_at), { addSuffix: true, locale: ar })}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </Layout>
  );
};

export default News;
