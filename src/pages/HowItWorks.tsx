import { Layout } from "@/components/rasad/Layout";
import { SectionHeader } from "@/components/rasad/SectionHeader";
import { Breadcrumbs } from "@/components/rasad/Breadcrumbs";
import { Seo } from "@/components/seo/Seo";
import { JsonLd, buildBreadcrumbSchema } from "@/components/seo/JsonLd";
import { Link } from "react-router-dom";
import {
  Radio, Layers, Globe, GitCompareArrows, ScanSearch, Gavel,
  Database, Filter, ArrowLeft, ShieldCheck,
} from "lucide-react";

const STEPS = [
  { Icon: Radio, t: "استقبال الإشارة", d: "نلتقط الادعاء أو المحتوى لحظة وروده، سواء كان نصاً، صورة، فيديو، أو صوتاً." },
  { Icon: Layers, t: "معالجة لغوية عربية", d: "نموذج لغوي عربي يفهم اللهجات والسياق والإحالات الثقافية." },
  { Icon: Database, t: "تجميع المصادر", d: "نجمع كل ذِكْرٍ للادعاء عبر المنصات وقواعد البيانات الموثوقة." },
  { Icon: Filter, t: "الفرز والترتيب", d: "نرتّب المصادر حسب موثوقيتها وحداثتها وقربها من الحدث." },
  { Icon: Globe, t: "تتبّع المصدر الأصلي", d: "نقتفي أثر أول ظهور للادعاء ونبني سلسلة الاستناد كاملة." },
  { Icon: GitCompareArrows, t: "المقارنة المتقاطعة", d: "نقارن الادعاء بمراجع موثقة ومحتوى مطابق سابق." },
  { Icon: ScanSearch, t: "كشف التلاعب", d: "نكشف التعديل البصري، الصوتي، ومحتوى الذكاء الاصطناعي المولّد." },
  { Icon: Gavel, t: "إصدار الحكم", d: "حكم نهائي بدرجة ثقة وسلسلة أدلة كاملة قابلة للتدقيق." },
];

const HowItWorks = () => (
  <Layout>
    <Seo
      title="كيف يعمل رصد | المنهجية والمراحل"
      description="شرح تفصيلي لمنهجية رصد في التحقق من الأخبار: من الإشارة الأولى إلى الحكم النهائي عبر ثمانية مراحل."
      path="/how-it-works"
    />
    <JsonLd data={buildBreadcrumbSchema([{ name: "الرئيسية", path: "/" }, { name: "كيف يعمل", path: "/how-it-works" }])} />
    <Breadcrumbs items={[{ name: "كيف يعمل" }]} />

    <section className="relative overflow-hidden border-b border-white/[0.06]">
      <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
      <div className="container py-16 md:py-20">
        <div className="chip mb-4"><span className="mono text-[11px] tracking-widest">METHODOLOGY</span></div>
        <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">كيف يصل رصد إلى الحقيقة</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          منهجية مفتوحة وشفّافة، يمكنك تتبّع كل خطوة من الإشارة الأولى إلى الحكم النهائي.
        </p>
      </div>
    </section>

    <section className="container py-16">
      <SectionHeader eyebrow="المراحل" title="ثماني مراحل دقيقة" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={i} className="glass-panel relative p-6">
            <div className="mono mb-3 text-[10px] tracking-widest text-muted-foreground">STEP 0{i + 1}</div>
            <s.Icon className="mb-4 h-7 w-7 text-primary" strokeWidth={1.75} />
            <div className="text-sm font-bold leading-6">{s.t}</div>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="container py-16">
      <SectionHeader eyebrow="المعايير" title="ما الذي يضمن دقة الأحكام؟" />
      <div className="grid gap-5 md:grid-cols-3">
        {[
          { t: "تعدد المصادر", d: "لا يصدر حكم نهائي إلا بعد تقاطع 3 مصادر موثوقة على الأقل." },
          { t: "درجة الثقة الشفافة", d: "كل حكم مرفق بنسبة ثقة من 0 إلى 100% بناءً على قوة الأدلة." },
          { t: "قابلية التدقيق", d: "كل خطوة موثّقة وقابلة للمراجعة من قبل الفريق التحريري والمستخدم." },
        ].map((m, i) => (
          <div key={i} className="glass-panel p-6">
            <div className="display text-3xl font-extrabold text-primary">{`0${i + 1}`}</div>
            <h3 className="mt-3 text-lg font-bold">{m.t}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{m.d}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="container pb-20">
      <div className="glass-panel flex flex-col items-center gap-5 p-10 text-center">
        <h2 className="text-2xl font-extrabold md:text-3xl">جرّب رصد على خبر تشكّ فيه الآن</h2>
        <p className="max-w-xl text-sm leading-7 text-muted-foreground">
          ابدأ بالباقة المجانية بدون بطاقة بنكية، واحصل على أول تقرير تحقق خلال ثوانٍ.
        </p>
        <Link
          to="/verify"
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-primary to-primary/80 px-6 py-3 font-bold text-primary-foreground signal-glow ring-1 ring-white/10 hover:brightness-110"
          style={{ minHeight: 48 }}
        >
          <ShieldCheck className="h-4 w-4" />
          ابدأ التحقق الآن <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </section>
  </Layout>
);

export default HowItWorks;
