import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Sparkles, Trash2, Search, Radar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export default function Admin() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({ users: 0, articles: 0, verifications: 0, messages: 0 });
  const [generating, setGenerating] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => { setIsAdmin(!!data); setChecking(false); });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [u, a, v, m, ar, ms] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("articles").select("id", { count: "exact", head: true }),
        supabase.from("verifications").select("id", { count: "exact", head: true }),
        supabase.from("contact_messages").select("id", { count: "exact", head: true }),
        supabase.from("articles").select("id, title, type, verdict, published_at").order("published_at", { ascending: false }).limit(20),
        supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      setStats({ users: u.count ?? 0, articles: a.count ?? 0, verifications: v.count ?? 0, messages: m.count ?? 0 });
      setArticles(ar.data ?? []);
      setMessages(ms.data ?? []);
    })();
  }, [isAdmin]);

  const generate = async (_type: string) => {
    // Demo-content generation has been removed. Articles arrive via the
    // FastAPI live monitor instead of an on-demand generator.
    toast.error("الوظيفة معطّلة — استخدم البث المباشر بدلاً منها");
  };

  const scanKeywords = async () => {
    setScanning(true);
    const { data, error } = await supabase.functions.invoke("scan-keywords");
    setScanning(false);
    if (error) toast.error("فشل المسح"); else toast.success(`تم مسح ${data?.scanned ?? 0} مقالًا — ${data?.created ?? 0} تنبيه جديد`);
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("حذف هذا المقال؟")) return;
    await supabase.from("articles").delete().eq("id", id);
    setArticles((p) => p.filter((a) => a.id !== id));
  };

  const markHandled = async (id: string) => {
    await supabase.from("contact_messages").update({ handled: true }).eq("id", id);
    setMessages((p) => p.map((m) => m.id === id ? { ...m, handled: true } : m));
  };

  if (checking) return <Loader2 className="h-6 w-6 animate-spin" />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة المدير</h1>
        <p className="mt-1 text-sm text-muted-foreground">إدارة المحتوى والمستخدمين</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "المستخدمون", value: stats.users },
          { label: "المقالات", value: stats.articles },
          { label: "التحقّقات", value: stats.verifications },
          { label: "الرسائل", value: stats.messages },
        ].map((s) => (
          <Card key={s.label} className="border-border/50 p-5">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-2 display text-3xl">{s.value}</div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">توليد محتوى</TabsTrigger>
          <TabsTrigger value="articles">المقالات</TabsTrigger>
          <TabsTrigger value="messages">الرسائل</TabsTrigger>
          <TabsTrigger value="alerts">مسح التنبيهات</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-4">
          <Card className="border-border/50 p-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {["news", "report", "social", "agent"].map((t) => (
                <Button key={t} variant="outline" onClick={() => generate(t)} disabled={generating === t} className="gap-1.5">
                  {generating === t ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  توليد {t}
                </Button>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="articles" className="mt-4 space-y-2">
          {articles.length === 0 ? (
            <Skeleton className="h-20" />
          ) : articles.map((a) => (
            <Card key={a.id} className="border-border/50 p-4 flex items-center gap-3">
              <Badge variant="outline">{a.type}</Badge>
              {a.verdict && <Badge variant="secondary">{a.verdict}</Badge>}
              <div className="min-w-0 flex-1 text-sm line-clamp-1">{a.title}</div>
              <Button size="icon" variant="ghost" onClick={() => deleteArticle(a.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="messages" className="mt-4 space-y-2">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا رسائل</p>
          ) : messages.map((m) => (
            <Card key={m.id} className={`border-border/50 p-4 ${m.handled ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">{m.name}</span>
                <span className="text-xs text-muted-foreground" dir="ltr">{m.email}</span>
                <span className="ms-auto text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ar })}
                </span>
              </div>
              {m.subject && <div className="text-sm font-medium mb-1">{m.subject}</div>}
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.message}</p>
              {!m.handled && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => markHandled(m.id)}>تم المعالجة</Button>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card className="border-border/50 p-5">
            <div className="flex items-center gap-3">
              <Radar className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="font-semibold">مسح يدوي للكلمات المفتاحية</div>
                <p className="text-xs text-muted-foreground">يمر على آخر 24 ساعة من المقالات ويُنشئ تنبيهات للمستخدمين المطابقين.</p>
              </div>
              <Button onClick={scanKeywords} disabled={scanning} className="gap-1.5">
                {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                ابدأ المسح
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
