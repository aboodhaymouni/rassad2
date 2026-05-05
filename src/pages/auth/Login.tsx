import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, ShieldCheck } from "lucide-react";
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

export default function Login() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={from} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const msg = error.message.includes("Invalid")
        ? "البريد أو كلمة المرور غير صحيحة"
        : error.message.includes("Email not confirmed")
        ? "يرجى تأكيد بريدك الإلكتروني أولاً من الرسالة المرسلة إليك"
        : error.message;
      toast.error(msg);
      return;
    }
    toast.success("مرحبًا بعودتك");
    nav(from, { replace: true });
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.error("تعذّر تسجيل الدخول عبر Google");
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <Helmet>
        <title>تسجيل الدخول | رصد</title>
        <meta name="description" content="ادخل إلى حسابك في منصة رصد للتحقق الرقمي." />
      </Helmet>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 grid place-items-center" aria-label="رصد"><Logo /></Link>
        <div className="rounded-2xl border border-white/[0.08] bg-card p-6 shadow-2xl sm:p-8">
          <h1 className="mb-1 text-2xl font-bold">تسجيل الدخول</h1>
          <p className="mb-6 text-sm text-muted-foreground">ادخل إلى لوحة التحقق الخاصة بك</p>

          <Button type="button" variant="outline" onClick={handleGoogle} className="mb-4 w-full gap-2">
            <GoogleIcon />
            متابعة باستخدام Google
          </Button>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">أو</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" required dir="ltr" className="text-start"
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">كلمة المرور</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">نسيت كلمة المرور؟</Link>
              </div>
              <Input id="password" type="password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              دخول
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">أنشئ حسابًا مجانًا</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
