import { Layout } from "@/components/rasad/Layout";
import { PublicVerify } from "@/components/rasad/PublicVerify";
import { Seo } from "@/components/seo/Seo";
import { LiveTicker } from "@/components/rasad/LiveTicker";

const VerifyPublicPage = () => (
  <Layout>
    <Seo
      title="رصد | تحقّق فوري — مجاناً وبدون تسجيل"
      description="ألصق ادعاءً أو رابط خبر لتفحصه عبر 6 وكلاء ذكاء اصطناعي تبحث في الإنترنت وتقارن مع المصادر الموثوقة. النتيجة في 10–15 ثانية."
      path="/verify"
    />
    <section className="container py-10 md:py-14">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold leading-[1.4] md:text-4xl md:leading-[1.35]">
            تحقّق <span className="text-primary">فوري</span> من أي خبر
          </h1>
          <p className="mt-4 text-base leading-[2.1] text-muted-foreground md:text-lg md:leading-[2.2]">
            ألصق نص ادعاء أو رابط مقالة، يبحث رصد في الإنترنت، يسحب المقالات،
            ويقارنها مع المصادر الموثوقة، ويعرض الحكم في ثوانٍ — بدون تسجيل.
          </p>
        </header>
        <PublicVerify />
      </div>
    </section>

    <section className="border-t border-white/[0.06] bg-surface/30">
      <div className="container py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold leading-[1.4] md:text-2xl">آخر ما تحقّقت منه المنصة</h2>
          </div>
          <LiveTicker variant="compact" limit={6} />
        </div>
      </div>
    </section>
  </Layout>
);

export default VerifyPublicPage;
