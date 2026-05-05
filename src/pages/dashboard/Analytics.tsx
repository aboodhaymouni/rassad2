import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format } from "date-fns";
import type { Verification } from "@/components/dashboard/types";

const COLORS: Record<string, string> = {
  trusted: "hsl(var(--verified))",
  fake: "hsl(var(--primary))",
  suspicious: "hsl(var(--warning))",
  uncertain: "hsl(var(--muted-foreground))",
};
const FALLBACK_COLOR = "hsl(var(--muted))";

const NAMES: Record<string, string> = {
  trusted: "موثوق",
  fake: "مزيّف",
  suspicious: "مشكوك",
  uncertain: "غير مؤكد",
};

export default function Analytics() {
  const { user } = useAuth();
  const [items, setItems] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("verifications").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setItems((data ?? []) as unknown as Verification[]);
        setLoading(false);
      });
  }, [user]);

  const verdictData = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((i) => { counts[i.verdict] = (counts[i.verdict] ?? 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({ name: NAMES[k] ?? k, key: k, value: v }));
  }, [items]);

  const timelineData = useMemo(() => {
    const m: Record<string, { date: string; trusted: number; fake: number; suspicious: number; uncertain: number }> = {};
    items.forEach((i) => {
      const d = format(new Date(i.created_at), "MM-dd");
      if (!m[d]) m[d] = { date: d, trusted: 0, fake: 0, suspicious: 0, uncertain: 0 };
      (m[d] as any)[i.verdict] = ((m[d] as any)[i.verdict] ?? 0) + 1;
    });
    return Object.values(m).slice(-14);
  }, [items]);

  const kindData = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((i) => { counts[i.kind || "text"] = (counts[i.kind || "text"] ?? 0) + 1; });
    const labels: Record<string, string> = { text: "نص", url: "رابط", image: "صورة", batch: "دفعة" };
    return Object.entries(counts).map(([k, v]) => ({ name: labels[k] ?? k, value: v }));
  }, [items]);

  const avgConfidence = items.length
    ? Math.round(items.reduce((s, i) => s + (i.confidence ?? 0), 0) / items.length)
    : 0;

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">التحليلات</h1>
        <Card className="border-dashed border-border/50 bg-transparent p-12 text-center text-sm text-muted-foreground">
          لا بيانات كافية. ابدأ بعمليات تحقق لتظهر هنا.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">التحليلات</h1>
        <p className="mt-1 text-sm text-muted-foreground">رؤى من نشاطك على المنصة</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 p-5">
          <div className="text-xs text-muted-foreground">إجمالي عمليات التحقق</div>
          <div className="mt-2 display text-3xl">{items.length}</div>
        </Card>
        <Card className="border-border/50 p-5">
          <div className="text-xs text-muted-foreground">متوسط الثقة</div>
          <div className="mt-2 display text-3xl">{avgConfidence}<span className="text-base">%</span></div>
        </Card>
        <Card className="border-border/50 p-5">
          <div className="text-xs text-muted-foreground">نسبة المزيّف</div>
          <div className="mt-2 display text-3xl">
            {Math.round((items.filter((i) => i.verdict === "fake").length / items.length) * 100)}<span className="text-base">%</span>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50 p-5">
          <h3 className="mb-4 font-semibold">توزيع الأحكام</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={verdictData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {verdictData.map((e) => <Cell key={e.key} fill={COLORS[e.key] ?? FALLBACK_COLOR} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-border/50 p-5">
          <h3 className="mb-4 font-semibold">حسب نوع الإدخال</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={kindData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="border-border/50 p-5">
        <h3 className="mb-4 font-semibold">النشاط عبر الوقت (آخر 14 يومًا)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Legend />
            <Line type="monotone" dataKey="trusted" stroke={COLORS.trusted} name="موثوق" />
            <Line type="monotone" dataKey="fake" stroke={COLORS.fake} name="مزيّف" />
            <Line type="monotone" dataKey="suspicious" stroke={COLORS.suspicious} name="مشكوك" />
            <Line type="monotone" dataKey="uncertain" stroke={COLORS.uncertain} name="غير مؤكد" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
