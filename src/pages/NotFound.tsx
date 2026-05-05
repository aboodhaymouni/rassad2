import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "@/components/rasad/Layout";
import { Seo } from "@/components/seo/Seo";
import { Home, ArrowLeft, SearchX } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: مسار غير موجود:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <Seo
        title="الصفحة غير موجودة | رصد"
        description="عذراً، الصفحة التي تبحث عنها غير موجودة."
        path={location.pathname}
        noindex
      />
      <section className="container flex flex-col items-center justify-center py-24 text-center md:py-32">
        <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <SearchX className="h-10 w-10" strokeWidth={1.75} />
        </div>
        <div className="display mt-8 text-7xl font-extrabold text-primary md:text-9xl">404</div>
        <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">لم نجد ما تبحث عنه</h1>
        <p className="mt-4 max-w-md text-base leading-8 text-muted-foreground">
          الصفحة التي تحاول الوصول إليها غير موجودة، أو ربما تم نقلها. يمكنك العودة إلى الصفحة الرئيسية والمتابعة من هناك.
        </p>
        <p className="mono mt-3 text-xs text-muted-foreground/70">{location.pathname}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-primary to-primary/80 px-6 py-3 font-bold text-primary-foreground signal-glow ring-1 ring-white/10 hover:brightness-110"
            style={{ minHeight: 48 }}
          >
            <Home className="h-4 w-4" /> العودة للرئيسية
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-6 py-3 font-semibold hover:bg-white/[0.06]"
            style={{ minHeight: 48 }}
          >
            تواصل مع الدعم <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default NotFound;
