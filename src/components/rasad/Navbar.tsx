import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Activity, LogIn, Menu, ShieldCheck, UserPlus, X } from "lucide-react";
import { Logo } from "./Logo";

const links = [
  { to: "/", label: "الرئيسية" },
  { to: "/verify", label: "تحقّق فوري" },
  { to: "/live", label: "البث المباشر" },
  { to: "/how-it-works", label: "كيف يعمل" },
  { to: "/agents", label: "الوكلاء" },
  { to: "/reports", label: "التقارير" },
  { to: "/about", label: "عن رصد" },
  { to: "/contact", label: "تواصل" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`enter-down sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/[0.08] bg-background/85 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          : "border-b border-transparent bg-background/40 backdrop-blur-md"
      }`}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link
          to="/"
          aria-label="رصد - الرئيسية"
          className="enter-fade transition-opacity hover:opacity-80"
          style={{ animationDelay: "120ms" }}
        >
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
          {links.map((l, idx) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              style={{ animationDelay: `${180 + idx * 55}ms` }}
              className={({ isActive }) =>
                `enter-down relative px-3 py-2 text-sm transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                } [&.active]:after:absolute [&.active]:after:inset-x-2 [&.active]:after:-bottom-[17px] [&.active]:after:h-[2px] [&.active]:after:bg-primary [&.active]:after:transition-all`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="enter-fade hidden items-center gap-2 md:flex" style={{ animationDelay: "640ms" }}>
          <Link
            to="/live"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
            style={{ minHeight: 40 }}
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">البث المباشر</span>
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
          </Link>
          <Link
            to="/verify"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-primary to-primary/80 px-4 py-2 text-sm font-bold text-primary-foreground signal-glow ring-1 ring-white/10 transition hover:brightness-110 hover:scale-[1.02]"
            style={{ minHeight: 40 }}
          >
            <ShieldCheck className="h-4 w-4" />
            تحقّق الآن
          </Link>
          <span className="mx-1 hidden h-6 w-px bg-white/[0.10] xl:inline-block" aria-hidden />
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            style={{ minHeight: 40 }}
          >
            <LogIn className="h-3.5 w-3.5" />
            تسجيل الدخول
          </Link>
        </div>

        <button
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="grid place-items-center rounded-md border border-white/[0.06] text-foreground transition hover:bg-white/[0.04] lg:hidden"
          style={{ width: 44, height: 44 }}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={`overflow-hidden border-t border-white/[0.06] bg-background/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 lg:hidden ${
          open ? "max-h-[640px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="container flex flex-col gap-1 py-4" aria-label="قائمة الجوال">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded-md px-3 py-3 text-sm font-medium transition ${
                  isActive ? "bg-white/[0.06] text-foreground" : "text-muted-foreground hover:bg-white/[0.04]"
                }`
              }
              style={{ minHeight: 48 }}
            >
              {l.label}
            </NavLink>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
            <Link
              to="/live"
              onClick={() => setOpen(false)}
              className="grid place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] py-3 text-sm font-semibold transition"
              style={{ minHeight: 48 }}
            >
              البث المباشر
            </Link>
            <Link
              to="/verify"
              onClick={() => setOpen(false)}
              className="grid place-items-center rounded-md bg-gradient-to-b from-primary to-primary/80 py-3 text-sm font-bold text-primary-foreground signal-glow"
              style={{ minHeight: 48 }}
            >
              تحقّق الآن
            </Link>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.03] py-2.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              style={{ minHeight: 44 }}
            >
              <LogIn className="h-3.5 w-3.5" />
              تسجيل الدخول
            </Link>
            <Link
              to="/signup"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.03] py-2.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              style={{ minHeight: 44 }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              حساب جديد
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
};
