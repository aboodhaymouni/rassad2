import { Layout } from "@/components/rasad/Layout";
import { SectionHeader } from "@/components/rasad/SectionHeader";
import { VerdictBadge } from "@/components/rasad/Badge";
import { ConfidenceRing } from "@/components/rasad/ConfidenceRing";
import { Skeleton } from "@/components/ui/skeleton";
import { useArticles } from "@/hooks/useArticles";
import { GenerateButton, EmptyState } from "@/components/rasad/AdminGenerate";
import { Seo } from "@/components/seo/Seo";
import { Twitter, Instagram, Facebook, Send, MessageCircle, Music2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const Social = () => {
  const { items, loading, generate } = useArticles("social", 18);

  return (
    <Layout>
      <Seo title="وكيل السوشال ميديا | رصد" description="منشورات سوشيال ميديا متداولة جرى التحقق منها." path="/social" />

      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div className="container py-20">
          <div className="chip mb-4"><span className="mono text-[11px] tracking-widest">SOCIAL · AGENT</span></div>
          <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">وكيل السوشال ميديا</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">منشورات متداولة على المنصات الاجتماعية تم التحقق منها.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {[Twitter, Instagram, Music2, Facebook, MessageCircle, Send].map((I, i) => (
              <div key={i} className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                <I className="h-5 w-5 text-foreground/80" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-12">
        <div className="mb-6 flex items-center justify-between">
          <SectionHeader align="right" eyebrow="آخر التحقيقات" title="منشورات تم التحقق منها" />
          <GenerateButton onGenerate={generate} loading={loading} />
        </div>

        {loading && items.length === 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState message="لا توجد منشورات سوشيال ميديا بعد." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {items.map((p) => {
              const eng = (p.metadata as any)?.engagement as string | undefined;
              const sources = (p.metadata as any)?.sources as string[] | undefined;
              return (
                <article key={p.id} className="glass-panel p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex items-center gap-2">
                        {p.category && <span className="chip mono">{p.category}</span>}
                        {eng && <span className="mono text-[11px] text-muted-foreground">{eng} تفاعل</span>}
                      </div>
                      <h3 className="text-base font-bold leading-7">{p.title}</h3>
                      {p.summary && <p className="mt-2 text-sm leading-7 text-muted-foreground">{p.summary}</p>}
                      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                        {p.verdict && <VerdictBadge verdict={p.verdict === "uncertain" ? "suspicious" : p.verdict} />}
                        {sources && <span className="mono">{sources.length} مصدر</span>}
                        <span>{formatDistanceToNow(new Date(p.published_at), { addSuffix: true, locale: ar })}</span>
                      </div>
                    </div>
                    {p.confidence !== null && <ConfidenceRing value={p.confidence} size={64} />}
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

export default Social;
