import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, ArrowLeft, AlertTriangle } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { VerdictBadge, type Verdict } from "./Badge";
import { ConfidenceRing } from "./ConfidenceRing";
import { supabase } from "@/integrations/supabase/client";

type FakeCase = {
  title: string;
  summary: string;
  verdict: Verdict;
  confidence: number;
  category: string;
  year: string;
  sources: { label: string; url: string }[];
};

// Curated documented fakes — fallback when DB has no `fake` articles yet.
const FALLBACK: FakeCase[] = [
  {
    title: "صورة \"البابا فرنسيس بمعطف منتفخ أبيض\" المُولّدة بالذكاء الاصطناعي",
    summary:
      "انتشرت في مارس 2023 صورة للبابا بمعطف عصري، وتبيّن أنها مولّدة عبر Midjourney ولا أصل لها.",
    verdict: "fake",
    confidence: 99,
    category: "صورة مفبركة",
    year: "2023",
    sources: [
      { label: "BBC News", url: "https://www.bbc.com/news/world-65069316" },
      { label: "Reuters Fact Check", url: "https://www.reuters.com/article/factcheck-pope-puffer-idUSL1N35Y26S" },
    ],
  },
  {
    title: "ادعاء \"بلع علكة يبقى في المعدة 7 سنوات\"",
    summary:
      "خرافة شائعة منذ عقود — العلكة تمر عبر الجهاز الهضمي وتُطرح خلال أيام كباقي الأطعمة غير المهضومة.",
    verdict: "fake",
    confidence: 97,
    category: "خرافة صحية",
    year: "متكرر",
    sources: [
      { label: "Scientific American", url: "https://www.scientificamerican.com/article/fact-or-fiction-chewing-gum-takes-seven-years-to-digest/" },
      { label: "Mayo Clinic", url: "https://www.mayoclinic.org/healthy-lifestyle/childrens-health/expert-answers/swallowing-gum/faq-20058446" },
    ],
  },
  {
    title: "فيديو \"زيلينسكي يدعو الجنود للاستسلام\" Deepfake",
    summary:
      "فيديو مزيف نُشر في مارس 2022 يُظهر الرئيس الأوكراني يدعو للاستسلام، وأكدت المنصات وحكومة أوكرانيا أنه deepfake.",
    verdict: "fake",
    confidence: 98,
    category: "Deepfake",
    year: "2022",
    sources: [
      { label: "NPR", url: "https://www.npr.org/2022/03/16/1087062648/deepfake-video-zelenskyy-experts-war-manipulation-ukraine-russia" },
      { label: "The Verge", url: "https://www.theverge.com/2022/3/16/22981056/deepfake-video-zelenskyy-surrender-ukraine-russia-disinformation" },
    ],
  },
  {
    title: "ادعاء أن \"لقاحات كوفيد-19 تحتوي على شرائح تتبع\"",
    summary:
      "ادعاء واسع الانتشار عام 2020-2021 لا أساس علمي له. فحوصات مستقلة لمكوّنات اللقاحات نفت ذلك تماماً.",
    verdict: "fake",
    confidence: 100,
    category: "تضليل صحي",
    year: "2020",
    sources: [
      { label: "AP Fact Check", url: "https://apnews.com/article/fact-checking-9214336567" },
      { label: "Reuters", url: "https://www.reuters.com/article/factcheck-coronavirus-microchip-idUSL1N2L01H2" },
    ],
  },
  {
    title: "صور \"أسد هارب في شوارع موسكو\" خلال جائحة كوفيد",
    summary:
      "تداولت صورة أسد في شارع فارغ كدليل على إجراءات الإغلاق في روسيا — الصورة من فيلم أمريكي عام 2016.",
    verdict: "fake",
    confidence: 96,
    category: "صورة خارج سياقها",
    year: "2020",
    sources: [
      { label: "AFP Fact Check", url: "https://factcheck.afp.com/photo-shows-lion-film-set-not-russian-streets-during-coronavirus-lockdown" },
      { label: "Snopes", url: "https://www.snopes.com/fact-check/lion-russia-coronavirus/" },
    ],
  },
  {
    title: "ادعاء \"شرب الماء الساخن يقتل فيروس كورونا\"",
    summary:
      "رسالة منتشرة على واتساب في 2020. منظمة الصحة العالمية أكدت أن لا الماء الساخن ولا الغرغرة يمنعان العدوى.",
    verdict: "fake",
    confidence: 99,
    category: "تضليل صحي",
    year: "2020",
    sources: [
      { label: "WHO Mythbusters", url: "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters" },
      { label: "BBC Arabic", url: "https://www.bbc.com/arabic/trending-51920354" },
    ],
  },
];

export const DocumentedFakes = () => {
  const [items, setItems] = useState<FakeCase[]>(FALLBACK);

  useEffect(() => {
    let alive = true;
    supabase
      .from("articles")
      .select("title,summary,verdict,confidence,category,published_at,metadata")
      .eq("type", "news")
      .eq("verdict", "fake")
      .order("published_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (!alive || !data || data.length === 0) return;
        const mapped: FakeCase[] = data.map((d) => {
          const meta = (d.metadata ?? {}) as Record<string, unknown>;
          const rawSources = Array.isArray(meta.sources) ? (meta.sources as Array<{ label?: string; url?: string }>) : [];
          const sources = rawSources
            .filter((s) => typeof s?.url === "string")
            .map((s) => ({ label: String(s.label ?? "مصدر"), url: String(s.url) }));
          return {
            title: d.title,
            summary: d.summary ?? "",
            verdict: "fake",
            confidence: typeof d.confidence === "number" ? d.confidence : 95,
            category: d.category ?? "تضليل",
            year: d.published_at ? new Date(d.published_at).getFullYear().toString() : "—",
            sources,
          };
        });
        setItems(mapped);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="container py-20">
      <SectionHeader
        eyebrow="أمثلة موثّقة"
        title="أخبار كاذبة شهيرة — مع المصدر والحكم"
        subtitle="حالات حقيقية تم التحقق منها من جهات تدقيق دولية. شاهد كيف تنكشف الأكاذيب بالأدلة."
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((c, i) => (
          <article
            key={i}
            className="glass-panel group flex h-full flex-col overflow-hidden p-6 transition hover:-translate-y-0.5 hover:border-destructive/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip mono text-[10px]">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  {c.category}
                </span>
                <span className="mono text-[10px] text-muted-foreground">{c.year}</span>
              </div>
              <ConfidenceRing value={c.confidence} size={44} />
            </div>

            <h3 className="mt-4 line-clamp-3 text-base font-bold leading-7">{c.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">{c.summary}</p>

            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <VerdictBadge verdict={c.verdict} />
                <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.sources.length} مصدر
                </span>
              </div>

              {c.sources.length > 0 && (
                <ul className="space-y-1.5">
                  {c.sources.map((s, j) => (
                    <li key={j}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-primary"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          to="/news"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          استعرض جميع التحققات <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
};
