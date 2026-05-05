import { Layout } from "@/components/rasad/Layout";
import { SectionHeader } from "@/components/rasad/SectionHeader";
import { VerdictBadge } from "@/components/rasad/Badge";
import { DocumentedFakes } from "@/components/rasad/DocumentedFakes";
import { LiveTicker } from "@/components/rasad/LiveTicker";
import { PublicVerify } from "@/components/rasad/PublicVerify";
import { Reveal } from "@/components/rasad/Reveal";
import { CountUp } from "@/components/rasad/CountUp";
import { Seo } from "@/components/seo/Seo";
import { JsonLd, organizationSchema, webApplicationSchema, buildFaqSchema } from "@/components/seo/JsonLd";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ShieldCheck,
  ArrowLeft,
  Play,
  Star,
  Users,
  Target,
  Sparkles,
  Search,
  Eye,
  FileCheck,
  Zap,
  Lock,
  FileText,
  Code2,
  Languages,
  RefreshCw,
  User,
  Building2,
  Landmark,
  Activity,
} from "lucide-react";

const FAQ = [
  {
    q: "ما هو رصد وكيف يعمل؟",
    a: "رصد منصة عربية للتحقق من الأخبار والمحتوى الرقمي. تستخدم شبكة من الوكلاء الذكية لجمع الإشارات، تتبع المصادر، كشف التلاعب، ومقارنة الادعاءات بمراجع موثوقة لإصدار حكم نهائي بدرجة ثقة شفافة.",
  },
  {
    q: "ما مدى أمان بياناتي على المنصة؟",
    a: "جميع البيانات مشفّرة بمعيار AES-256 وتُنقل عبر HTTPS. لا نشارك بياناتك مع طرف ثالث ولا نستخدمها لأي غرض خارج تحسين خدمات التحقق وفق سياسة الخصوصية.",
  },
  {
    q: "هل أحتاج إلى تسجيل أو حساب لاستخدام رصد؟",
    a: "لا. كل الميزات الأساسية متاحة بدون تسجيل — ألصق الادعاء أو الرابط أو ارفع الصورة وستحصل على الحكم خلال ثوانٍ. التسجيل اختياري لمن يريد حفظ السجل والمجموعات.",
  },
  {
    q: "ما الذي يمكنني التحقق منه عبر رصد؟",
    a: "نصوص الأخبار والادعاءات، روابط المقالات، والصور (مع كشف توليد الذكاء الاصطناعي). كل تحقق يُرجع حكماً مع درجة ثقة وقائمة مصادر مرجعية حية من الإنترنت.",
  },
  {
    q: "كيف أتواصل مع فريق الدعم؟",
    a: "عبر بريد hello@rassad.io أو عبر واتساب الدعم من صفحة التواصل. ساعات العمل: الأحد إلى الخميس من 9 صباحاً حتى 6 مساءً بتوقيت عمّان.",
  },
];

const TESTIMONIALS = [
  {
    name: "خالد المنصور",
    role: "مدير المشتريات",
    company: "مجموعة الأفق",
    text: "صار رصد جزءاً يومياً من سير العمل عندنا. قبل اعتماد أي خبر يخص السوق نمرّره عليه — وفّر علينا أخطاء كان يمكن أن تكلّفنا الكثير.",
  },
  {
    name: "ليلى الحسيني",
    role: "صحفية تحقيق",
    company: "غرفة أخبار مستقلة",
    text: "الذي يميّز رصد ليس السرعة فقط، بل سلسلة الأدلة الواضحة. كل حكم مرفق بمصادره — وهذا ما نحتاجه في عملنا الصحفي.",
  },
  {
    name: "د. عمر الزعبي",
    role: "أستاذ الإعلام الرقمي",
    company: "جامعة الأردن",
    text: "أفضل أداة عربية رأيتها لتحليل الادعاءات والمحتوى المرئي. أنصح بها طلابي في مساقات الإعلام الرقمي والتحقق.",
  },
];

const Home = () => {
  return (
    <Layout>
      <Seo
        title="رصد | منصة التحقق من الأخبار العربية — فوري وآمن"
        description="رصد منصة عربية للتحقق من الأخبار والصور والفيديو والصوت في ثوانٍ بدقة عالية وأدلة كاملة. ابدأ مجاناً بدون بطاقة بنكية."
        path="/"
      />
      <JsonLd data={[organizationSchema, webApplicationSchema, buildFaqSchema(FAQ)]} />

      {/* HERO — RTL: text right, visual left, with staggered mount entrance */}
      <section className="relative overflow-hidden">
        <div
          className="enter-fade absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)", animationDuration: "1400ms" }}
        />
        <div
          className="enter-fade absolute inset-0 -z-10 grid-bg opacity-40"
          style={{ animationDelay: "200ms", animationDuration: "1400ms" }}
        />

        <div className="container grid items-center gap-12 py-20 md:grid-cols-2 md:gap-16 md:py-28 lg:gap-20">
          {/* HEADLINE — first column = right side in RTL */}
          <div className="order-1 md:order-1">
            <div className="chip enter-pop mb-6" style={{ animationDelay: "100ms" }}>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[12px]">التحقق الرقمي الأسرع في المنطقة العربية</span>
            </div>
            <h1 className="text-[2.5rem] font-extrabold leading-[1.45] tracking-tight md:text-5xl md:leading-[1.4] lg:text-[3.75rem] lg:leading-[1.35]">
              <span className="enter-up block" style={{ animationDelay: "220ms" }}>
                تحقّق من أي خبر
              </span>
              <span className="enter-up block" style={{ animationDelay: "340ms" }}>
                في <span className="text-shimmer">ثوانٍ معدودة</span>
              </span>
              <span className="enter-up block" style={{ animationDelay: "460ms" }}>
                بأدلة لا تقبل الشك.
              </span>
            </h1>
            <p
              className="enter-up mt-7 max-w-xl text-base leading-[2.1] text-muted-foreground md:text-lg md:leading-[2.2]"
              style={{ animationDelay: "620ms" }}
            >
              رصد منصة عربية لتحليل الأخبار والصور والفيديو والصوت عبر شبكة وكلاء ذكية، مع تحقق متعدد المصادر وأحكام شفافة قابلة للتتبع.
            </p>

            <div className="enter-up mt-9 flex flex-wrap gap-3" style={{ animationDelay: "780ms" }}>
              <a
                href="#verify-now"
                className="cta-glow inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-primary to-primary/80 px-6 py-3.5 font-bold text-primary-foreground ring-1 ring-white/10 transition hover:brightness-110 hover:scale-[1.02]"
                style={{ minHeight: 48 }}
              >
                <ShieldCheck className="h-4 w-4" /> تحقّق الآن — مجاناً
              </a>
              <Link
                to="/live"
                className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-6 py-3.5 font-semibold text-primary transition hover:bg-primary/10 hover:scale-[1.02]"
                style={{ minHeight: 48 }}
              >
                <Activity className="h-4 w-4" /> البث المباشر
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-6 py-3.5 font-semibold transition hover:bg-white/[0.06]"
                style={{ minHeight: 48 }}
              >
                <Play className="h-4 w-4" /> كيف يعمل
              </Link>
            </div>

            <div
              className="enter-fade mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-relaxed text-muted-foreground"
              style={{ animationDelay: "920ms" }}
            >
              <span className="inline-flex items-center gap-1 text-warning">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className="enter-pop h-3.5 w-3.5 fill-warning"
                    style={{ animationDelay: `${1000 + i * 70}ms` }}
                  />
                ))}
              </span>
              <span>يثق بنا أكثر من <strong className="text-foreground">500 صحفي ومؤسسة</strong></span>
              <span aria-hidden>·</span>
              <span>بدون تسجيل</span>
              <span aria-hidden>·</span>
              <span>بدون بطاقة بنكية</span>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="enter-pop" style={{ animationDelay: "1100ms" }}>
                <VerdictBadge verdict="trusted" />
              </span>
              <span className="enter-pop" style={{ animationDelay: "1180ms" }}>
                <VerdictBadge verdict="suspicious" />
              </span>
              <span className="enter-pop" style={{ animationDelay: "1260ms" }}>
                <VerdictBadge verdict="fake" />
              </span>
            </div>
          </div>

          {/* LIVE TICKER — real-time feed, second column = left in RTL */}
          <div className="enter-left order-2 md:order-2" style={{ animationDelay: "560ms" }}>
            <LiveTicker variant="compact" limit={6} />
          </div>
        </div>
      </section>

      {/* INLINE PUBLIC VERIFY — ألصق ادعاء وحقّقه فوراً، بدون login */}
      <section id="verify-now" className="relative overflow-hidden border-y border-white/[0.06] bg-surface/30">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div className="container py-14 md:py-20">
          <div className="mx-auto max-w-4xl">
            <Reveal direction="up" className="mb-7 text-center">
              <div className="chip mx-auto mb-4">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[12px]">جرّبه الآن — بدون حساب</span>
              </div>
              <h2 className="text-3xl font-extrabold leading-[1.4] md:text-4xl md:leading-[1.35]">
                ألصق الادعاء — يبحث رصد عبر <span className="text-primary">الإنترنت</span> فوراً
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-[2] text-muted-foreground md:text-lg md:leading-[2.1]">
                لا حاجة للتسجيل. تحليل لغوي + بحث ويب حي + سحب مقالات + مقارنة دلالية في خطوة واحدة.
              </p>
            </Reveal>
            <Reveal direction="up" delay={120}>
              <PublicVerify />
            </Reveal>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="border-y border-white/[0.06] bg-surface/40">
        <div className="container grid gap-6 py-10 md:grid-cols-4">
          {[
            { to: 10000, prefix: "+", suffix: "", l: "عملية تحقق منجزة", Icon: Activity },
            { to: 99.9, prefix: "", suffix: "%", l: "دقة التحليل", Icon: Target, decimals: 1 },
            { to: 30, prefix: "<", suffix: " ثانية", l: "متوسط زمن الاستجابة", Icon: Zap },
            { to: 500, prefix: "+", suffix: "", l: "مستخدم موثوق", Icon: Users },
          ].map((s, i) => (
            <Reveal key={i} direction="up" delay={i * 90} className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-primary transition hover:border-primary/30 hover:bg-primary/10">
                <s.Icon className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <div>
                <div className="display text-2xl font-extrabold text-foreground md:text-3xl">
                  <CountUp
                    to={s.to}
                    prefix={s.prefix}
                    suffix={s.suffix}
                    decimals={s.decimals ?? 0}
                    duration={1500 + i * 150}
                  />
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS — 3 STEPS */}
      <section className="container py-20">
        <Reveal direction="up">
          <SectionHeader
            eyebrow="كيف يعمل رصد"
            title="ثلاث خطوات للوصول إلى الحقيقة"
            subtitle="من الإشارة الأولى إلى الحكم المدعوم بالأدلة — رحلة مهيكلة وشفافة."
          />
        </Reveal>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { n: "01", Icon: Search, t: "أدخل المحتوى", d: "ألصق نص الادعاء، رابط الخبر، أو ارفع صورة/فيديو/تسجيلاً صوتياً تريد التحقق منه." },
            { n: "02", Icon: Eye, t: "رصد يُحلّل", d: "وكلاؤنا الذكية يفحصون المصادر الموثوقة، يكشفون التلاعب، ويقارنون الادعاء بقواعد بيانات حية." },
            { n: "03", Icon: FileCheck, t: "احصل على التقرير", d: "حكم نهائي بدرجة ثقة شفافة، مع سلسلة أدلة كاملة قابلة للتصدير ومشاركتها." },
          ].map((s, i) => (
            <Reveal
              key={s.n}
              direction="up"
              delay={i * 130}
              className="glass-panel hover-lift card-glow group relative p-7"
            >
              <div className="display absolute end-6 top-6 text-5xl font-extrabold text-primary/15 transition group-hover:text-primary/25">
                {s.n}
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-primary transition group-hover:border-primary/40 group-hover:bg-primary/10">
                <s.Icon className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 text-lg font-bold">{s.t}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{s.d}</p>
            </Reveal>
          ))}
        </div>

        <Reveal direction="up" delay={300} className="mt-10 flex justify-center">
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-all hover:gap-3 hover:underline"
          >
            شاهد عرضاً تفصيلياً <ArrowLeft className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>

      {/* FEATURES — 6 in 3x2 */}
      <section className="container py-20">
        <Reveal direction="up">
          <SectionHeader
            eyebrow="المميزات"
            title="منظومة كاملة للتحقق الرقمي"
            subtitle="أدوات متخصصة بنيت بعناية للسرعة، الدقة، والثقة."
          />
        </Reveal>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            { Icon: Zap, t: "تحقق فوري", d: "نتائج في أقل من 30 ثانية لمعظم العمليات، مهما كان نوع المحتوى." },
            { Icon: Lock, t: "أمان عالٍ", d: "تشفير AES-256 للبيانات وحماية كاملة لخصوصيتك ومستنداتك." },
            { Icon: FileText, t: "تقارير مفصّلة", d: "تقارير شاملة قابلة للتصدير بصيغ PDF و CSV مع كل أدلة الحكم." },
            { Icon: Code2, t: "API موثّق", d: "اربط رصد بأنظمتك ومنصاتك عبر REST API بتوثيق عربي وإنجليزي." },
            { Icon: Languages, t: "دعم عربي كامل", d: "واجهة، تقارير، وخدمة عملاء بالعربية الفصحى — بدون ترجمة آلية." },
            { Icon: RefreshCw, t: "تدقيق مستمر", d: "تحديث قواعد البيانات والمصادر الموثوقة كل 24 ساعة." },
          ].map((f, i) => (
            <Reveal
              key={i}
              direction="up"
              delay={(i % 3) * 110}
              className="glass-panel hover-lift card-glow group p-6"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-primary transition group-hover:border-primary/40 group-hover:bg-primary/10">
                <f.Icon className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 text-lg font-bold">{f.t}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{f.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* AUDIENCE */}
      <section className="container py-20">
        <Reveal direction="up">
          <SectionHeader
            eyebrow="لمن هو رصد"
            title="حلٌّ لكل من يحتاج إلى الحقيقة"
            subtitle="من الفرد إلى المؤسسة الحكومية — منظومة تكيّف نفسها مع احتياجاتك."
          />
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            { Icon: User, t: "الأفراد", d: "تحقق من أي خبر أو ادعاء قبل مشاركته، وكن جزءاً من مجتمع يقاوم التضليل.", to: "/verify" },
            { Icon: Building2, t: "الشركات والإعلام", d: "احم سمعة مؤسستك وموظفيك من الأخبار الكاذبة، وادعم قراراتك بمعلومة موثقة.", to: "/verify" },
            { Icon: Landmark, t: "الحكومات والجهات الرسمية", d: "أدوات مؤسسية متقدمة لرصد الحملات الممنهجة والتحقق على نطاق واسع.", to: "/contact" },
          ].map((a, i) => (
            <Reveal
              key={i}
              direction="up"
              delay={i * 120}
              className="glass-panel hover-lift card-glow group p-7"
            >
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20 transition group-hover:ring-primary/40">
                <a.Icon className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 text-xl font-bold">{a.t}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{a.d}</p>
              <Link
                to={a.to}
                className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-3 hover:underline"
              >
                اعرف المزيد <ArrowLeft className="h-4 w-4" />
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* DOCUMENTED FAKES — real cases with sources */}
      <DocumentedFakes />

      {/* TESTIMONIALS */}
      <section className="border-y border-white/[0.06] bg-surface/30">
        <div className="container py-20">
          <Reveal direction="up">
            <SectionHeader
              eyebrow="آراء المستخدمين"
              title="ما يقوله مستخدمو رصد"
              subtitle="صحفيون، باحثون، ومدراء يعتمدون على رصد كل يوم."
            />
          </Reveal>

          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal
                key={i}
                direction="up"
                delay={i * 130}
                as="figure"
                className="glass-panel hover-lift card-glow flex h-full flex-col p-7"
              >
                <div className="flex items-center gap-1 text-warning">
                  {[1, 2, 3, 4, 5].map((s) => <Star key={s} className="h-4 w-4 fill-warning" />)}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-8 text-foreground/90">
                  «{t.text}»
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-white/[0.06] pt-5">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-info/20 text-sm font-extrabold text-foreground ring-1 ring-white/10"
                    aria-hidden
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role} · {t.company}</div>
                  </div>
                </figcaption>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container py-20">
        <Reveal direction="up">
          <SectionHeader
            eyebrow="الأسئلة الشائعة"
            title="أسئلة سمعناها كثيراً"
            subtitle="إن لم تجد إجابتك هنا، تواصل معنا مباشرة."
          />
        </Reveal>

        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="space-y-3">
            {FAQ.map((item, i) => (
              <Reveal key={i} direction="up" delay={i * 60}>
                <AccordionItem
                  value={`q-${i}`}
                  className="glass-panel overflow-hidden border-white/[0.06] px-5 transition hover:border-primary/30"
                >
                  <AccordionTrigger className="text-start text-base font-bold hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-8 text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              </Reveal>
            ))}
          </Accordion>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-y border-white/[0.06]">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute inset-0 -z-10 radar-bg opacity-50" />
        <div className="container py-20 text-center">
          <div className="chip mx-auto mb-5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[12px]">انضم إلى المنظومة</span>
          </div>
          <h2 className="mx-auto max-w-3xl text-3xl font-extrabold leading-[1.4] md:text-5xl md:leading-[1.3]">
            ابدأ رحلتك نحو <span className="text-primary">التحقق الرقمي</span> الآن
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-[2.1] text-muted-foreground md:text-lg md:leading-[2.2]">
            انضم إلى أكثر من 500 صحفي ومؤسسة يحمون أنفسهم ومجتمعاتهم من التضليل يومياً مع رصد.
          </p>
          <Reveal direction="up" delay={120} className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#verify-now"
              className="cta-glow inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-primary to-primary/80 px-7 py-4 text-base font-bold text-primary-foreground ring-1 ring-white/10 transition hover:brightness-110 hover:scale-[1.02]"
              style={{ minHeight: 48 }}
            >
              <ShieldCheck className="h-5 w-5" />
              تحقّق من خبر الآن <ArrowLeft className="h-4 w-4" />
            </a>
            <Link
              to="/live"
              className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-7 py-4 text-base font-bold text-primary transition hover:bg-primary/10"
              style={{ minHeight: 48 }}
            >
              <Activity className="h-5 w-5" />
              البث المباشر للأخبار
            </Link>
          </Reveal>
          <p className="mt-5 text-xs text-muted-foreground">
            مجاني بالكامل · بدون تسجيل · بدون بطاقة بنكية · 6 وكلاء ذكاء اصطناعي
          </p>
        </div>
      </section>
    </Layout>
  );
};

export default Home;
