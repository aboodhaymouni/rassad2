import { useEffect, useState } from "react";
import { Plus, Bell, Trash2, BellOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { KeywordAlert } from "@/components/dashboard/types";
import { verdictArabic } from "@/components/dashboard/types";

const VERDICTS = ["fake", "suspicious", "trusted", "uncertain"] as const;

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<KeywordAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [verdicts, setVerdicts] = useState<string[]>(["fake", "suspicious"]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("keyword_alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setAlerts((data ?? []) as KeywordAlert[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !keyword.trim()) return;
    const { error } = await supabase.from("keyword_alerts").insert({
      user_id: user.id, keyword: keyword.trim(), match_verdicts: verdicts,
    });
    if (error) toast.error("فشل الإنشاء"); else { toast.success("تم"); setOpen(false); setKeyword(""); load(); }
  };

  const toggle = async (a: KeywordAlert) => {
    await supabase.from("keyword_alerts").update({ active: !a.active }).eq("id", a.id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("keyword_alerts").delete().eq("id", id);
    load();
  };

  const toggleVerdict = (v: string) =>
    setVerdicts((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">تنبيهات الكلمات المفتاحية</h1>
          <p className="mt-1 text-sm text-muted-foreground">سنبلغك حين يظهر محتوى يطابق كلماتك</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> جديد</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : alerts.length === 0 ? (
        <Card className="border-dashed border-border/50 bg-transparent p-12 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">لا تنبيهات. أنشئ اشتراكًا بكلمة مفتاحية لمراقبة المحتوى.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <Card key={a.id} className="border-border/50 p-4 flex items-center gap-4">
              {a.active ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{a.keyword}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.match_verdicts.map((v) => (
                    <Badge key={v} variant="outline" className="text-[10px]">{verdictArabic[v] ?? v}</Badge>
                  ))}
                </div>
              </div>
              <Switch checked={a.active} onCheckedChange={() => toggle(a)} />
              <Button size="icon" variant="ghost" onClick={() => remove(a.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>تنبيه جديد</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">الكلمة المفتاحية</label>
              <Input placeholder="مثلًا: لقاح، انتخابات، ..." value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={80} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">نبّهني عند حكم</label>
              <div className="grid grid-cols-2 gap-2">
                {VERDICTS.map((v) => (
                  <label key={v} className="flex items-center gap-2 rounded-md border border-border/50 p-2 cursor-pointer hover:bg-accent">
                    <Checkbox checked={verdicts.includes(v)} onCheckedChange={() => toggleVerdict(v)} />
                    <span className="text-sm">{verdictArabic[v]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={create} disabled={!keyword.trim() || verdicts.length === 0}>إنشاء</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
