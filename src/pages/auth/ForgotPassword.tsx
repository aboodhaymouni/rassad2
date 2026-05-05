import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/rasad/Logo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <Helmet><title>استعادة كلمة المرور | رصد</title></Helmet>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 grid place-items-center"><Logo /></Link>
        <div className="rounded-2xl border border-white/[0.08] bg-card p-6 sm:p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-verified/15 text-[hsl(var(--verified))]">
                <MailCheck className="h-7 w-7" />
              </div>
              <h1 className="mb-2 text-xl font-bold">تحقق من بريدك</h1>
              <p className="text-sm text-muted-foreground">
                إذا كان <span className="mono">{email}</span> مسجّلًا لدينا، فستصلك رسالة بخطوات إعادة التعيين.
              </p>
              <Button asChild className="mt-6 w-full"><Link to="/login">العودة لتسجيل الدخول</Link></Button>
            </div>
          ) : (
            <>
              <h1 className="mb-1 text-2xl font-bold">استعادة كلمة المرور</h1>
              <p className="mb-6 text-sm text-muted-foreground">سنرسل لك رابطًا لإعادة التعيين</p>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" type="email" required dir="ltr" className="text-start"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full gap-2">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  إرسال الرابط
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline">العودة لتسجيل الدخول</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
