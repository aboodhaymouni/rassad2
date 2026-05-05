import { Layout } from "@/components/rasad/Layout";
import { Breadcrumbs } from "@/components/rasad/Breadcrumbs";
import { Seo } from "@/components/seo/Seo";
import { JsonLd, buildBreadcrumbSchema } from "@/components/seo/JsonLd";

const PrivacyPolicy = () => (
  <Layout>
    <Seo
      title="سياسة الخصوصية | رصد"
      description="كيف يجمع رصد بياناتك ويستخدمها ويحميها — مع حقوقك الكاملة كمستخدم."
      path="/privacy-policy"
    />
    <JsonLd data={buildBreadcrumbSchema([{ name: "الرئيسية", path: "/" }, { name: "سياسة الخصوصية", path: "/privacy-policy" }])} />
    <Breadcrumbs items={[{ name: "سياسة الخصوصية" }]} />

    <article className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">سياسة الخصوصية</h1>
      <p className="mono mt-3 text-xs text-muted-foreground">آخر تحديث: 1 مايو 2026</p>

      <div className="prose prose-invert mt-10 max-w-none space-y-8 text-base leading-8 text-muted-foreground">
        <section>
          <h2 className="text-xl font-extrabold text-foreground">1. مقدمة</h2>
          <p className="mt-3">
            تحترم منصة رصد خصوصية مستخدميها وتلتزم بحماية بياناتهم الشخصية. تشرح هذه السياسة ما البيانات التي نجمعها، وكيف نستخدمها ونحميها.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-foreground">2. البيانات التي نجمعها</h2>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>بيانات الحساب: الاسم، البريد الإلكتروني، كلمة المرور المشفّرة.</li>
            <li>محتوى عمليات التحقق التي تُجريها (نصوص، روابط، صور، ملفات).</li>
            <li>بيانات تقنية: عنوان IP، نوع المتصفح، نظام التشغيل، تاريخ الزيارة.</li>
            <li>ملفات تعريف الارتباط الضرورية لتشغيل المنصة.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-foreground">3. كيف نستخدم بياناتك</h2>
          <p className="mt-3">نستخدم بياناتك حصراً للأغراض التالية:</p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>تشغيل خدمات التحقق وتوفير النتائج.</li>
            <li>تحسين دقة منظومة الوكلاء الذكية.</li>
            <li>التواصل معك بخصوص حسابك وخدماتنا.</li>
            <li>الالتزام بالمتطلبات القانونية عند اللزوم.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-verified/30 bg-verified/5 p-5">
          <h2 className="text-xl font-extrabold text-foreground">4. لا نبيع بياناتك أبداً</h2>
          <p className="mt-3">
            نتعهّد بشكل قاطع بعدم بيع بياناتك الشخصية لأي طرف ثالث، تحت أي ظرف. لا نستخدم بياناتك لأغراض إعلانية خارج المنصة.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-foreground">5. حقوقك كمستخدم</h2>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>الوصول إلى بياناتك المخزنة وطلب نسخة منها.</li>
            <li>تصحيح أي معلومة غير دقيقة.</li>
            <li>حذف حسابك وبياناتك بشكل كامل في أي وقت.</li>
            <li>الاعتراض على معالجة بياناتك أو سحب موافقتك.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-foreground">6. الأمان</h2>
          <p className="mt-3">
            نستخدم تشفير AES-256 لتخزين البيانات الحساسة، وHTTPS لجميع عمليات النقل. نراجع أنظمتنا الأمنية بشكل دوري ونلتزم بأفضل الممارسات الدولية.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-foreground">7. التواصل بشأن الخصوصية</h2>
          <p className="mt-3">
            لأي استفسار يخصّ خصوصية بياناتك، تواصل معنا على{" "}
            <a href="mailto:privacy@rassad.io" className="text-primary underline-offset-4 hover:underline">privacy@rassad.io</a>.
          </p>
        </section>
      </div>
    </article>
  </Layout>
);

export default PrivacyPolicy;
