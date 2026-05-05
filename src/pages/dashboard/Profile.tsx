import { useEffect, useState } from "react";
import { Upload, KeyRound, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? "");
        setAvatarUrl(data?.avatar_url ?? null);
        setLoading(false);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, avatar_url: avatarUrl }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("فشل الحفظ"); else toast.success("تم الحفظ");
  };

  const upload = async (f: File) => {
    if (!user) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("الحد 5MB"); return; }
    const path = `${user.id}/avatar-${Date.now()}.${f.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
    if (error) { toast.error("فشل الرفع"); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    toast.success("تم الرفع — اضغط حفظ لتثبيت التغيير");
  };

  const updatePassword = async () => {
    if (newPwd.length < 8) { toast.error("8 أحرف على الأقل"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) toast.error(error.message); else { toast.success("تم تحديث كلمة المرور"); setNewPwd(""); }
  };

  if (loading) return <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>;

  const initials = (fullName || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الملف الشخصي</h1>
        <p className="mt-1 text-sm text-muted-foreground">إدارة معلوماتك وحسابك</p>
      </div>

      <Card className="border-border/50 p-6 space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <label className="cursor-pointer">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <span><Upload className="h-3.5 w-3.5" /> رفع صورة</span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">الاسم الكامل</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">البريد الإلكتروني</label>
          <Input value={user?.email ?? ""} disabled />
        </div>

        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          حفظ التغييرات
        </Button>
      </Card>

      <Card className="border-border/50 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">تغيير كلمة المرور</h2>
        </div>
        <Input type="password" placeholder="كلمة مرور جديدة (8+ أحرف)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} dir="ltr" />
        <Button onClick={updatePassword} variant="outline" disabled={!newPwd}>تحديث</Button>
      </Card>
    </div>
  );
}
