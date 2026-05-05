import { Layout } from "@/components/rasad/Layout";
import { SectionHeader } from "@/components/rasad/SectionHeader";
import { Breadcrumbs } from "@/components/rasad/Breadcrumbs";
import { Seo } from "@/components/seo/Seo";
import { JsonLd, buildBreadcrumbSchema } from "@/components/seo/JsonLd";
import { useState } from "react";
import { Eye, ShieldCheck, Scale, Sparkles, Linkedin } from "lucide-react";

const TEAM = [
  {
    name: "عبد الرحمن الهيموني",
    role: "مطوّر Full-stack وتجربة المستخدم",
    initial: "ع",
    photo: "/team/abdalrahman-alhaymouni.jpg",
    linkedin: "https://www.linkedin.com/in/abdalrahman-alhaymouni/",
  },
  {
    name: "عبد الرحمن الكردي",
    role: "مهندس الذكاء الاصطناعي ووكلاء التحقق",
    initial: "ع",
    photo: "/team/abdalrahman-kurdi.jpg",
    linkedin: "https://www.linkedin.com/in/abdalrhman-kurdi-832456328/",
  },
  {
    name: "زيد أبو الشعر",
    role: "مهندس Backend والبنية التحتية",
    initial: "ز",
    photo: "/team/zaid.jpg",
    linkedin: "https://www.linkedin.com/in/zaid-abu-alshaar-93765a3a1/",
  },
];

const TeamAvatar = ({ photo, initial, name }: { photo?: string; initial: string; name: string }) => {
  const [failed, setFailed] = useState(false);
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="mx-auto h-24 w-24 rounded-full object-cover ring-2 ring-primary/30"
      />
    );
  }
  return (
    <div
      className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-info/20 text-3xl font-extrabold text-foreground ring-2 ring-primary/30"
      aria-hidden
    >
      {initial}
    </div>
  );
};

const TIMELINE = [
  {
    y: "1 مايو 2026",
    t: "انطلاق المشروع",
    d: "تشكّل الفريق وانطلاق العمل على رصد كمشروع مقدَّم لمسابقة جامعة الزيتونة الأردنية.",
  },
  {
    y: "3 مايو 2026",
    t: "اكتمال نظام الوكلاء",
    d: "ستة وكلاء ذكاء اصطناعي متخصصة تعمل بالتوازي: تحليل لغوي، أصالة الوسائط، تدقيق المصادر، كشف التضليل، تتبّع الادعاء، ومحرّك الحكم.",
  },
  {
    y: "4 مايو 2026",
    t: "اكتمال الواجهة الكاملة",
    d: "تكامل الواجهة مع البحث الحي على الإنترنت، التحقق الفوري بدون تسجيل، والبث المباشر للأخبار العربية.",
  },
  {
    y: "5 مايو 2026",
    t: "العرض النهائي",
    d: "تقديم رصد ضمن مسابقة جامعة الزيتونة الأردنية كمنصة عربية متكاملة للتحقق من الأخبار.",
  },
];

const About = () => (
  <Layout>
    <Seo
      title="عن رصد | المهمة والرؤية والفريق"
      description="رصد منظومة عربية للتحقق الرقمي تأسست لمواجهة التضليل وحماية الفضاء المعلوماتي العربي. تعرّف على فريقنا ورحلتنا."
      path="/about"
    />
    <JsonLd data={buildBreadcrumbSchema([{ name: "الرئيسية", path: "/" }, { name: "عن رصد", path: "/about" }])} />
    <Breadcrumbs items={[{ name: "عن رصد" }]} />

    <section className="relative overflow-hidden border-b border-white/[0.06]">
      <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
      <div className="container py-16 md:py-20">
        <div className="chip mb-4">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="mono text-[11px] tracking-widest">مسابقة جامعة الزيتونة · مايو 2026</span>
        </div>
        <h1 className="text-4xl font-extrabold leading-[1.4] md:text-5xl md:leading-[1.35]">عن رصد</h1>
        <p className="mt-5 max-w-2xl text-lg leading-[2] text-muted-foreground">
          رصد منظومة عربية للتحقق الرقمي تُقدَّم ضمن مسابقة جامعة الزيتونة الأردنية. نعيد للحقيقة مكانتها وسط ضجيج المعلومات، ونبني نظام تشغيل للثقة في الفضاء العربي.
        </p>
      </div>
    </section>

    {/* الرسالة والرؤية */}
    <section className="container py-16">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="glass-panel p-8">
          <div className="mono text-xs uppercase tracking-widest text-primary">رسالتنا</div>
          <h2 className="mt-3 text-2xl font-extrabold">حماية الوعي العربي من التضليل</h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            نسعى إلى تمكين كل عربي من التحقق من المعلومة قبل تصديقها أو مشاركتها، ببناء أدوات ذكية، شفافة، وفي متناول الجميع.
          </p>
        </div>
        <div className="glass-panel p-8">
          <div className="mono text-xs uppercase tracking-widest text-primary">رؤيتنا</div>
          <h2 className="mt-3 text-2xl font-extrabold">أن نكون المرجع العربي الأول للتحقق الرقمي</h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            نطمح أن يكون رصد الخيار الافتراضي لكل صحفي، باحث، ومؤسسة عربية تتعامل مع المحتوى الرقمي.
          </p>
        </div>
      </div>
    </section>

    {/* قصة التأسيس */}
    <section className="container py-16">
      <SectionHeader eyebrow="قصة التأسيس" title="لماذا أسّسنا رصد؟" />
      <div className="mx-auto max-w-3xl space-y-5 text-base leading-8 text-muted-foreground">
        <p>
          في خضمّ السنوات الأخيرة، تضاعف حجم المحتوى المنشور بالعربية على الإنترنت أضعافاً مضاعفة. لكن في المقابل، تضاعفت كذلك الأخبار الكاذبة، الفيديوهات المعدّلة، والادعاءات المضللة.
        </p>
        <p>
          لاحظنا غياب أداة عربية متخصصة، تفهم اللهجات، تستوعب السياق، وتعمل بالسرعة التي تتطلبها دورة الأخبار اليوم. فقررنا بناءها — للناس قبل المؤسسات، وللعربية قبل أي لغة أخرى.
        </p>
        <p className="text-foreground">
          رصد ليس مجرد منتج. هو موقف.
        </p>
      </div>
    </section>

    {/* القيم */}
    <section className="container py-16">
      <SectionHeader eyebrow="القيم" title="ما الذي يحرّك رصد" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[
          { Icon: Eye, t: "الشفافية", d: "كل حكم مدعوم بأدلة قابلة للتتبع." },
          { Icon: ShieldCheck, t: "الأمان", d: "بياناتك ملكك، ومحمية بأعلى المعايير." },
          { Icon: Scale, t: "الدقة", d: "منهجية صارمة، بلا انحياز ولا أحكام مسبقة." },
          { Icon: Sparkles, t: "الانتماء العربي", d: "هندسة عربية بمعايير عالمية." },
        ].map((c, i) => (
          <div key={i} className="glass-panel p-6">
            <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
              <c.Icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-bold">{c.t}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{c.d}</p>
          </div>
        ))}
      </div>
    </section>

    {/* الفريق */}
    <section className="container py-16">
      <SectionHeader
        eyebrow="الفريق"
        title="الأشخاص خلف رصد"
        subtitle="فريق ثلاثي يجمع بين الذكاء الاصطناعي والهندسة والمنتج."
      />
      <div className="grid gap-5 md:grid-cols-3">
        {TEAM.map((m, i) => {
          const hasLinkedin = !!m.linkedin;
          return (
            <div key={i} className="glass-panel hover-lift p-6 text-center">
              <TeamAvatar photo={m.photo} initial={m.initial} name={m.name} />
              <h3 className="mt-4 text-base font-bold leading-[1.6]">{m.name}</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{m.role}</p>
              {hasLinkedin ? (
                <a
                  href={m.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`لينكدإن ${m.name}`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              ) : (
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary">
                  مساعد ذكاء اصطناعي
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>

    {/* Timeline */}
    <section className="container py-16">
      <SectionHeader
        eyebrow="الرحلة"
        title="محطات تطوير رصد"
        subtitle="مشروع كامل أُنجز خلال 5 أيام (1–5 مايو 2026) لمسابقة جامعة الزيتونة الأردنية."
      />
      <ol className="relative mx-auto max-w-2xl border-s border-white/[0.08] ps-6">
        {TIMELINE.map((it, i) => (
          <li key={i} className="mb-10 last:mb-0">
            <span className="absolute -start-[9px] grid h-4 w-4 place-items-center rounded-full bg-primary ring-4 ring-background" />
            <div className="display text-sm font-extrabold text-primary">{it.y}</div>
            <h3 className="mt-1 text-lg font-bold">{it.t}</h3>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">{it.d}</p>
          </li>
        ))}
      </ol>
    </section>
  </Layout>
);

export default About;
