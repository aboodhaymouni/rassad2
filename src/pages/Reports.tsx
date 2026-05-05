import { Layout } from "@/components/rasad/Layout";
import { SectionHeader } from "@/components/rasad/SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useArticles } from "@/hooks/useArticles";
import { GenerateButton, EmptyState } from "@/components/rasad/AdminGenerate";
import { Seo } from "@/components/seo/Seo";
import { Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const Reports = () => {
  const { items, loading, generate } = useArticles("report", 18);

  return (
    <Layout>
      <Seo title="تقارير وتحليلات | رصد" description="تقارير معمّقة وتحليلات حول التضليل ومنهجيات التحقق." path="/reports" />

      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div className="container py-20">
          <div className="chip mb-4"><span className="mono text-[11px] tracking-widest">REPORTS · ANALYSIS</span></div>
          <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">تقارير وتحليلات رصد</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">تقارير معمّقة، تحقيقات استقصائية، ودراسات حول التضليل والذكاء الاصطناعي.</p>
        </div>
      </section>

      <section className="container py-12">
        <div className="mb-6 flex items-center justify-between">
          <SectionHeader align="right" eyebrow="الأرشيف" title="أحدث التقارير" />
          <GenerateButton onGenerate={generate} loading={loading} />
        </div>

        {loading && items.length === 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState message="لا توجد تقارير منشورة بعد." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((r, i) => {
              const img = (r.metadata as any)?.image_url as string | undefined;
              const sources = (r.metadata as any)?.sources as string[] | undefined;
              return (
                <article key={r.id} className="glass-panel overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/30">
                  {img && (
                    <div className="relative h-40 overflow-hidden">
                      <img src={img} alt={r.title} className="h-full w-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      {r.category && <span className="chip mono">{r.category}</span>}
                      <span className="mono text-[11px] text-muted-foreground">#{String(i + 1).padStart(3, "0")}</span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold leading-8">{r.title}</h3>
                    {r.summary && <p className="mt-3 line-clamp-4 text-sm leading-7 text-muted-foreground">{r.summary}</p>}
                    <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(r.published_at), "d MMM yyyy", { locale: ar })}
                      </span>
                      <div className="flex items-center gap-3">
                        {sources && <span className="mono">{sources.length} مصدر</span>}
                        {r.body && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {Math.max(1, Math.round(r.body.length / 600))} د
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </Layout>
  );
};

export default Reports;
