import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";

const KEY = "rasad_cookie_consent_v1";

export const CookieBanner = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem(KEY, "accepted");
    setShow(false);
  };
  const decline = () => {
    localStorage.setItem(KEY, "declined");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="إشعار ملفات تعريف الارتباط"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl"
    >
      <div className="glass-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Cookie className="h-5 w-5" />
        </div>
        <p className="flex-1 text-sm leading-7 text-muted-foreground">
          نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتحليل أداء المنصة. اطّلع على{" "}
          <Link to="/privacy-policy" className="text-foreground underline underline-offset-4 hover:text-primary">
            سياسة الخصوصية
          </Link>
          .
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={decline}
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-semibold hover:bg-white/[0.06]"
          >
            رفض
          </button>
          <button
            onClick={accept}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110"
          >
            قبول الكل
          </button>
          <button
            onClick={decline}
            aria-label="إغلاق"
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
