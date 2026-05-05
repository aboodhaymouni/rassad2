import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, AlertTriangle, FileSearch, Activity, ArrowLeft, FolderHeart, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { VerdictBadge } from "@/components/rasad/Badge";
import { ConfidenceRing } from "@/components/rasad/ConfidenceRing";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import type { Verification } from "@/components/dashboard/types";

export default function Overview() {
  const { user } = useAuth();
  const [items, setItems] = useState<Verification[]>([]);
  const [counts, setCounts] = useState({ collections: 0, alerts: 0, notifications: 0 });
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [v, c, a, n, p] = await Promise.all([
        supabase.from("verifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("collections").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("keyword_alerts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("alert_notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false),
        supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
      ]);
      setItems((v.data ?? []) as unknown as Verification[]);
      setCounts({
        collections: c.count ?? 0,
        alerts: a.count ?? 0,
        notifications: n.count ?? 0,
      });
      setProfile(p.data ?? { full_name: null });
      setLoading(false);
    })();
  }, [user]);

  const name = profile?.full_name || user?.email?.split("@")[0] || "مستخدم";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">أهلًا، {name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">ملخص نشاطك على رصد</p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Button asChild size="lg" className="h-auto py-4 justify-start gap-3">
          <Link to="/dashboard/verify">
            <ShieldCheck className="h-5 w-5" />
            <div className="text-start">
              <div className="font-semibold">تحقّق جديد</div>
              <div className="text-xs opacity-80">نص، رابط، أو صورة</div>
            </div>
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-auto py-4 justify-start gap-3">
          <Link to="/dashboard/collections">
            <FolderHeart className="h-5 w-5" />
            <div className="text-start">
              <div className="font-semibold">المجموعات</div>
              <div className="text-xs opacity-80">{counts.collections} مجموعة</div>
            </div>
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-auto py-4 justify-start gap-3">
          <Link to="/dashboard/alerts">
            <Bell className="h-5 w-5" />
            <div className="text-start">
              <div className="font-semibold">التنبيهات</div>
              <div className="text-xs opacity-80">{counts.alerts} اشتراك · {counts.notifications} جديد</div>
            </div>
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "إجمالي عمليات التحقق", value: items.length === 5 ? "5+" : items.length, icon: Activity },
          { label: "موثوقة", value: items.filter((h) => h.verdict === "trusted").length, icon: ShieldCheck },
          { label: "مزيّفة", value: items.filter((h) => h.verdict === "fake").length, icon: AlertTriangle },
        ].map((s) => (
          <Card key={s.label} className="border-border/50 p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{s.label}</span>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="mt-2 display text-3xl">{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">آخر عمليات التحقق</h2>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/dashboard/verify">عرض الكل <ArrowLeft className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <Card className="border-dashed border-border/50 bg-transparent p-10 text-center">
            <FileSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">لا يوجد نشاط بعد. ابدأ بتحقّق جديد.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((h) => (
              <Card key={h.id} className="border-border/50 p-4">
                <div className="flex items-start gap-4">
                  <ConfidenceRing value={h.confidence} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <VerdictBadge verdict={h.verdict === "uncertain" ? "suspicious" : h.verdict} />
                      <span className="mono text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(h.created_at), { addSuffix: true, locale: ar })}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm">{h.input_text}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
