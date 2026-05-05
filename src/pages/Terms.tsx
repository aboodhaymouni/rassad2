import { Layout } from "@/components/rasad/Layout";
import { Breadcrumbs } from "@/components/rasad/Breadcrumbs";
import { Seo } from "@/components/seo/Seo";
import { JsonLd, buildBreadcrumbSchema } from "@/components/seo/JsonLd";

const Terms = () => (
  <Layout>
    <Seo
      title="شروط الاستخدام | رصد"
      description="الشروط والأحكام التي تحكم استخدامك لمنصة رصد للتحقق الرقمي."
      path="/terms"
    />
    <JsonLd data={buildBreadcrumbSchema([{ name: "الرئيسية", path: "/" }, { name: "شروط الاستخدام", path: "/terms" }])} />
    <Breadcrumbs items={[{ name: "شروط الاستخدام" }]} />

    <article className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">شروط الاستخدام</h1>
      <p className="mono mt-3 text-xs text-muted-foreground">آخر تحديث: 1 مايو 2026</p>

      <div className="mt-10 space-y-8 text-base leading-8 text-muted-foreground">
        <section>
          <h2 className="text-xl font-extrabold text-foreground">1. القبول بالشروط</h2>
          <p className="mt-3">
            باستخدامك منصة رصد، فإنك توافق على الالتزام بهذه الشروط بالكامل. إذا كنت لا توافق، يرجى عدم استخدام المنصة.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-foreground">2. الاستخدام المسموح</h2>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>التحقق من الأخبار والمحتوى الرقمي للأغراض الشخصية أو المهنية.</li>
            <li>مشاركة نتائج التحقق مع ذكر رصد كمصدر.</li>
            <li>استخدام الـ API ضمن حدود الباقة المشترك بها.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-foreground">3. الاستخدام المحظور</h2>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>محاولة اختراق المنصة أو تعطيل خدماتها.</li>
            <li>رفع محتوى ينتهك حقوق الملكية الفكرية أو القوانين.</li>
            <li>استخدام النتائج لتشويه سمعة الأشخاص أو المؤسسات بسوء نيّة.</li>
            <li>إعادة بيع خدمات رصد دون اتفاقية شراكة رسمية.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-warning/30 bg-warning/5 p-5">
          <h2 className="text-xl font-extrabold text-foreground">4. إخلاء المسؤولية</h2>
          <p className="mt-3">
            نتائج التحقق تُقدَّم كأداة مساعدة وليست بديلاً عن الحكم الشخصي أو القانوني. رصد لا يتحمل المسؤولية عن قرارات تُتّخذ بناءً على نتائج المنصة. تبقى مسؤولية التحقق النهائي على المستخدم.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-foreground">5. الاشتراكات والمدفوعات</h2>
          <p className="mt-3">
            الباقات المدفوعة قابلة للإلغاء في أي وقت. لا يُسترد المبلغ المدفوع عن الفترة الجارية، لكن لن يتم تجديد الاشتراك تلقائياً بعد الإلغاء.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-foreground">6. تعديل الشروط</h2>
          <p className="mt-3">
            نحتفظ بحقّ تعديل هذه الشروط في أي وقت. سنُشعر المستخدمين بالتغييرات الجوهرية عبر البريد الإلكتروني.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-foreground">7. القانون المطبّق</h2>
          <p className="mt-3">
            تخضع هذه الشروط لقوانين المملكة الأردنية الهاشمية، وتختصّ محاكم عمّان بالفصل في أي نزاع ينشأ عنها.
          </p>
        </section>
      </div>
    </article>
  </Layout>
);

export default Terms;
