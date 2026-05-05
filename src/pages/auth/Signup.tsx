import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, ShieldCheck, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/rasad/Logo";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.32 0-6.02-2.74-6.02-6.13S8.68 5.94 12 5.94c1.89 0 3.16.8 3.88 1.49l2.65-2.55C16.86 3.27 14.66 2.3 12 2.3 6.94 2.3 2.86 6.38 2.86 11.5S6.94 20.7 12 20.7c6.92 0 9.5-4.86 9.5-7.36 0-.5-.05-.88-.12-1.27H12z"/>
  </svg>
);

export default function Signup() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) {
      const msg = error.message.includes("already")
        ? "هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول."
        : error.message;
      toast.error(msg);
      return;
    }
    setSent(true);
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.error("تعذّر إنشاء الحساب عبر Google");
  };

  if (sent) {
    return (
      <div className="grid min-h-screen place-items-center px-4 py-10">
        <Helmet><title>تأكيد البريد | رصد</title></Helmet>
        <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-card p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-verified/15 text-[hsl(var(--verified))]">
            <MailCheck className="h-7 w-7" />
          </div>
          <h1 className="mb-2 text-xl font-bold">تحقق من بريدك الإلكتروني</h1>
          <p className="text-sm text-muted-foreground">
            أرسلنا رسالة تأكيد إلى <span className="mono">{email}</span>. اضغط على الرابط داخلها لتفعيل حسابك.
          </p>
          <Button asChild className="mt-6 w-full"><Link to="/login">العودة لتسجيل الدخول</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <Helmet>
        <title>إنشاء حساب | رصد</title>
        <meta name="description" content="ابدأ مجانًا في منصة رصد للتحقق الرقمي." />
      </Helmet>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 grid place-items-center" aria-label="رصد"><Logo /></Link>
        <div className="rounded-2xl border border-white/[0.08] bg-card p-6 shadow-2xl sm:p-8">
          <h1 className="mb-1 text-2xl font-bold">أنشئ حسابك مجانًا</h1>
          <p className="mb-6 text-sm text-muted-foreground">10 عمليات تحقق شهريًا — بدون بطاقة ائتمان</p>

          <Button type="button" variant="outline" onClick={handleGoogle} className="mb-4 w-full gap-2">
            <GoogleIcon />
            التسجيل باستخدام Google
          </Button>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">أو</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم الكامل</Label>
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" required dir="ltr" className="text-start"
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" required minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">8 أحرف على الأقل</p>
            </div>
            <Button type="submit" disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              إنشاء الحساب
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            بإنشاء حسابك أنت توافق على{" "}
            <Link to="/terms" className="text-foreground hover:underline">الشروط</Link> و
            <Link to="/privacy-policy" className="text-foreground hover:underline">سياسة الخصوصية</Link>.
          </p>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            لديك حساب؟{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">تسجيل الدخول</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
