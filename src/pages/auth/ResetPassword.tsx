import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/rasad/Logo";

export default function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The recovery link sets a session via hash; supabase-js auto-handles it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    if (password !== confirm) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث كلمة المرور");
    nav("/dashboard", { replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <Helmet><title>إعادة تعيين كلمة المرور | رصد</title></Helmet>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 grid place-items-center"><Logo /></Link>
        <div className="rounded-2xl border border-white/[0.08] bg-card p-6 sm:p-8">
          <h1 className="mb-1 text-2xl font-bold">كلمة مرور جديدة</h1>
          <p className="mb-6 text-sm text-muted-foreground">اختر كلمة مرور قوية لحسابك</p>

          {!ready ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="mt-3 text-xs text-muted-foreground">جارٍ التحقق من الرابط...</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور الجديدة</Label>
                <Input id="password" type="password" required minLength={8}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
                <Input id="confirm" type="password" required minLength={8}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy} className="w-full gap-2">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                تحديث كلمة المرور
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
