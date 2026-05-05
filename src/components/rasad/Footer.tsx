import { Logo } from "./Logo";
import { Link } from "react-router-dom";
import { Twitter, Linkedin, Instagram, Mail, MessageCircle, ShieldCheck } from "lucide-react";

export const Footer = () => (
  <footer className="mt-24 border-t border-white/[0.06] bg-surface/40 pb-20 md:pb-0">
    <div className="container grid gap-10 py-14 md:grid-cols-5">
      <div className="space-y-4 md:col-span-2">
        <Logo />
        <p className="max-w-sm text-sm leading-7 text-muted-foreground">
          منصة عربية للتحقق من الأخبار والمحتوى الرقمي. نرصد الإشارات ونحوّلها إلى أحكام مدعومة بالأدلة عبر شبكة وكلاء ذكية.
        </p>
        <div className="inline-flex items-center gap-2 rounded-md border border-verified/30 bg-verified/10 px-3 py-1.5 text-xs font-semibold text-verified">
          <ShieldCheck className="h-3.5 w-3.5" />
          SSL مشفر · بيانات آمنة
        </div>
      </div>

      <div>
        <h4 className="mb-4 text-sm font-semibold text-foreground">المنصة</h4>
        <ul className="space-y-2.5 text-sm text-muted-foreground">
          <li><Link to="/news" className="hover:text-foreground">الأخبار المتحقّق منها</Link></li>
          <li><Link to="/agents" className="hover:text-foreground">الوكلاء</Link></li>
          <li><Link to="/reports" className="hover:text-foreground">التقارير</Link></li>
          <li><Link to="/social" className="hover:text-foreground">السوشال ميديا</Link></li>
        </ul>
      </div>

      <div>
        <h4 className="mb-4 text-sm font-semibold text-foreground">قانوني</h4>
        <ul className="space-y-2.5 text-sm text-muted-foreground">
          <li><Link to="/about" className="hover:text-foreground">عن رصد</Link></li>
          <li><Link to="/how-it-works" className="hover:text-foreground">كيف يعمل</Link></li>
          <li><Link to="/privacy-policy" className="hover:text-foreground">سياسة الخصوصية</Link></li>
          <li><Link to="/terms" className="hover:text-foreground">شروط الاستخدام</Link></li>
        </ul>
      </div>

      <div>
        <h4 className="mb-4 text-sm font-semibold text-foreground">تواصل معنا</h4>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>
            <a href="mailto:hello@rassad.io" className="inline-flex items-center gap-2 hover:text-foreground">
              <Mail className="h-4 w-4 text-primary" /> hello@rassad.io
            </a>
          </li>
          <li>
            <a
              href="https://wa.me/962790000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4 text-verified" /> واتساب الدعم
            </a>
          </li>
          <li><Link to="/contact" className="hover:text-foreground">نموذج التواصل</Link></li>
        </ul>
        <div className="mt-4 flex gap-2">
          {[
            { I: Twitter, label: "تويتر" },
            { I: Linkedin, label: "لينكدإن" },
            { I: Instagram, label: "إنستغرام" },
          ].map(({ I, label }, i) => (
            <a
              key={i}
              href="#"
              aria-label={label}
              className="grid h-9 w-9 place-items-center rounded-md border border-white/[0.06] text-muted-foreground hover:border-primary hover:text-foreground"
            >
              <I className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </div>

    <div className="border-t border-white/[0.06]">
      <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground md:flex-row">
        <span>© {new Date().getFullYear()} رصد RASAD — جميع الحقوق محفوظة.</span>
        <span className="mono">v1.0 · INTELLIGENCE GRADE · Made in 🇯🇴</span>
      </div>
    </div>
  </footer>
);
