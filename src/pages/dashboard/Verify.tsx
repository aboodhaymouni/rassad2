import { useState, useEffect } from "react";
import {
  Search,
  ShieldCheck,
  Loader2,
  Image as ImageIcon,
  Link2,
  Layers,
  Upload,
  X,
  Save,
  Download,
  ServerCog,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RasadVerdictBadge, VerdictBadge } from "@/components/rasad/Badge";
import { ConfidenceRing } from "@/components/rasad/ConfidenceRing";
import { AgentBreakdownPanel } from "@/components/rasad/AgentBreakdownPanel";
import { WebSourcesPanel } from "@/components/rasad/WebSourcesPanel";
import type { WebSourceMatch } from "@/lib/rasad-api";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import type { Verification, Collection } from "@/components/dashboard/types";
import {
  verifyText,
  verifyUrl,
  verifyMedia,
  pingRasad,
  RasadApiError,
  type FinalVerdict,
} from "@/lib/rasad-api";
import { toLegacyVerdict } from "@/lib/verdict-mapping";

const exportCsv = (rows: Verification[]) => {
  const header = ["id", "kind", "verdict", "confidence", "input_text", "input_url", "created_at"];
  const escape = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = [header.join(","), ...rows.map((r) => header.map((k) => escape((r as any)[k])).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rasad-verifications-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/** Persist a FastAPI verdict to Supabase so it shows up in dashboard history. */
async function persistToSupabase(
  v: FinalVerdict,
  user_id: string,
  source: { input_text: string; input_url?: string | null; image_url?: string | null; kind: string },
): Promise<Verification | null> {
  const row = {
    user_id,
    input_text: source.input_text.slice(0, 4000),
    input_url: source.input_url ?? null,
    image_url: source.image_url ?? null,
    kind: source.kind,
    verdict: toLegacyVerdict(v.verdict),
    confidence: Math.max(0, Math.min(100, v.confidence)),
    explanation: v.arabic_explanation ?? "",
    sources: (v.sources ?? []).map((s) => ({ title: s, note: "" })),
    model: "rasad-6agent-v1",
  };
  const { data, error } = await supabase
    .from("verifications")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.warn("Supabase persist failed", error);
    return null;
  }
  return data as unknown as Verification;
}

export default function Verify() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"text" | "url" | "image" | "batch">("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [batch, setBatch] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [latest, setLatest] = useState<Verification | null>(null);
  const [latestRich, setLatestRich] = useState<FinalVerdict | null>(null);
  const [history, setHistory] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveTarget, setSaveTarget] = useState<Verification | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [chosenCol, setChosenCol] = useState<string>("");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("verifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data ?? []) as unknown as Verification[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("collections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setCollections((data ?? []) as Collection[]));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    pingRasad().then((ok) => {
      if (!cancelled) setBackendOnline(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onImage = (f: File | null) => {
    setImgFile(f);
    if (imgPreview) URL.revokeObjectURL(imgPreview);
    setImgPreview(f ? URL.createObjectURL(f) : null);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imgFile || !user) return null;
    const path = `${user.id}/${Date.now()}-${imgFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, imgFile, { upsert: true });
    if (error) {
      toast.error("فشل رفع الصورة");
      return null;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    return pub.publicUrl;
  };

  /** Run via FastAPI. Failures bubble up — no Supabase fallback any more. */
  const runFastApi = async (
    kind: "text" | "url" | "image",
  ): Promise<{ verdict: FinalVerdict; image_url?: string | null } | null> => {
    try {
      if (kind === "text") {
        const t = text.trim();
        if (t.length < 10) {
          toast.error("الادعاء يحتاج 10 أحرف على الأقل");
          return null;
        }
        const v = await verifyText(t);
        return { verdict: v };
      }
      if (kind === "url") {
        const u = url.trim();
        if (!/^https?:\/\//i.test(u)) {
          toast.error("أدخل رابطًا صالحًا");
          return null;
        }
        const v = await verifyUrl(u);
        return { verdict: v };
      }
      if (!imgFile) {
        toast.error("اختر صورة");
        return null;
      }
      const v = await verifyMedia(imgFile, { contextText: text.trim() || undefined });
      const image_url = await uploadImage();
      return { verdict: v, image_url };
    } catch (e) {
      if (e instanceof RasadApiError) {
        console.error("FastAPI error", e);
        toast.error(`فشل التحقق: ${e.detail ?? e.message}`);
      } else {
        console.error(e);
        toast.error("الخادم الذكي غير متاح حالياً");
      }
      return null;
    }
  };

  const run = async () => {
    if (analyzing) return;

    if (tab === "batch") {
      const items = batch
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      if (items.length === 0) {
        toast.error("أدخل ادعاءات (سطر لكل ادعاء)");
        return;
      }
      setAnalyzing(true);
      const { data, error } = await supabase.functions.invoke("verify-batch", {
        body: { items },
      });
      setAnalyzing(false);
      if (error) {
        toast.error("فشل التحقق الجماعي");
        return;
      }
      toast.success(`تم تحقق ${data?.results?.length ?? 0} عنصر`);
      setBatch("");
      load();
      return;
    }

    setAnalyzing(true);
    setLatest(null);
    setLatestRich(null);

    let success = false;

    if (backendOnline !== false) {
      const result = await runFastApi(tab);
      if (result && user) {
        const persisted = await persistToSupabase(result.verdict, user.id, {
          input_text: tab === "url" ? url : text,
          input_url: tab === "url" ? url : null,
          image_url: result.image_url ?? null,
          kind: tab,
        });
        const verification: Verification =
          persisted ??
          ({
            id: result.verdict.id,
            user_id: user.id,
            input_text: tab === "url" ? url : text,
            input_url: tab === "url" ? url : null,
            image_url: result.image_url ?? null,
            kind: tab,
            verdict: toLegacyVerdict(result.verdict.verdict),
            confidence: result.verdict.confidence,
            explanation: result.verdict.arabic_explanation,
            sources: (result.verdict.sources ?? []).map((s) => ({ title: s })),
            model: "rasad-6agent-v1",
            created_at: result.verdict.created_at,
          } as Verification);
        setLatest(verification);
        setLatestRich(result.verdict);
        setHistory((p) => [verification, ...p]);
        toast.success(
          result.verdict.cached
            ? "نتيجة من الذاكرة المؤقتة"
            : "اكتمل التحقق",
        );
        success = true;
      }
    }

    if (!success) {
      const v: Verification | null = null;
      if (v) {
        setLatest(v);
        setHistory((p) => [v, ...p]);
        toast.success("اكتمل التحقق");
        success = true;
      }
    }

    setAnalyzing(false);
    if (success) {
      setText("");
      setUrl("");
      onImage(null);
    }
  };

  const saveToCollection = async () => {
    if (!saveTarget || !chosenCol) return;
    const { error } = await supabase.from("collection_items").insert({
      collection_id: chosenCol,
      verification_id: saveTarget.id,
    });
    if (error) {
      if (error.code === "23505") toast.error("موجود مسبقًا في هذه المجموعة");
      else toast.error("تعذّر الحفظ");
    } else {
      toast.success("تم الحفظ");
      setSaveTarget(null);
      setChosenCol("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">تحقّق جديد</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            حلّل نصًا، رابطًا، صورة، أو دفعة من الادعاءات
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              backendOnline === true
                ? "border-verified/30 bg-verified/10 text-verified"
                : backendOnline === false
                  ? "border-warning/30 bg-warning/10 text-warning"
                  : "border-muted-foreground/30 bg-muted/30 text-muted-foreground"
            }`}
            title="حالة خادم الوكلاء (FastAPI)"
          >
            <ServerCog className="h-3 w-3" />
            {backendOnline === true
              ? "الخادم الذكي متصل"
              : backendOnline === false
                ? "احتياطي Supabase"
                : "جارٍ الفحص..."}
          </span>
        </div>
      </div>

      <Card className="border-border/50 p-5 sm:p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="text" className="gap-1.5">
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">نص</span>
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">رابط</span>
            </TabsTrigger>
            <TabsTrigger value="image" className="gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">صورة</span>
            </TabsTrigger>
            <TabsTrigger value="batch" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">دفعة</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتب الادعاء المراد التحقق منه..."
              rows={3}
              maxLength={2000}
              disabled={analyzing}
            />
          </TabsContent>
          <TabsContent value="url" className="mt-4">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              disabled={analyzing}
              dir="ltr"
            />
          </TabsContent>
          <TabsContent value="image" className="mt-4 space-y-3">
            {imgPreview ? (
              <div className="relative inline-block">
                <img
                  src={imgPreview}
                  alt="preview"
                  className="max-h-64 rounded-lg border border-border/50"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 end-2 h-7 w-7"
                  onClick={() => onImage(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-card/40 p-8 hover:border-primary/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm">اضغط لاختيار صورة (JPG/PNG حتى 10MB)</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 10 * 1024 * 1024) {
                      toast.error("الحد 10MB");
                      return;
                    }
                    onImage(f);
                  }}
                />
              </label>
            )}
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="سياق اختياري للصورة..."
              disabled={analyzing}
            />
          </TabsContent>
          <TabsContent value="batch" className="mt-4">
            <Textarea
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="ادعاء في كل سطر — حد أقصى 10 ادعاءات"
              rows={6}
              disabled={analyzing}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {batch.split("\n").filter((s) => s.trim()).length}/10
            </p>
          </TabsContent>

          <Button
            onClick={run}
            disabled={analyzing}
            className="mt-4 w-full sm:w-auto gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحليل...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> تحقّق الآن
              </>
            )}
          </Button>
        </Tabs>

        {latest && !analyzing && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col items-start gap-6 rounded-xl border border-border/50 bg-background/40 p-5 sm:flex-row">
              <ConfidenceRing value={latest.confidence} size={84} label="ثقة" />
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {latestRich ? (
                    <RasadVerdictBadge verdict={latestRich.verdict} showEnglish />
                  ) : (
                    <VerdictBadge
                      verdict={
                        latest.verdict === "uncertain" ? "suspicious" : (latest.verdict as any)
                      }
                    />
                  )}
                  <span className="mono text-xs text-muted-foreground">
                    CONF {latest.confidence}%
                  </span>
                  {latestRich?.processing_time_ms ? (
                    <span className="mono text-[11px] text-muted-foreground">
                      {latestRich.processing_time_ms}ms
                    </span>
                  ) : null}
                  {latestRich?.cached && (
                    <span className="mono text-[11px] text-muted-foreground">CACHED</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ms-auto gap-1"
                    onClick={() => setSaveTarget(latest)}
                  >
                    <Save className="h-3.5 w-3.5" /> حفظ
                  </Button>
                </div>
                <p className="text-sm font-semibold">{latest.input_text}</p>
                {latest.image_url && (
                  <img
                    src={latest.image_url}
                    alt=""
                    className="mt-3 max-h-40 rounded-md border border-border/50"
                  />
                )}
                {latest.explanation && (
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {latest.explanation}
                  </p>
                )}
                {latest.sources?.length > 0 && (
                  <div className="mt-4 border-t border-border/50 pt-3">
                    <div className="mb-2 mono text-[11px] tracking-widest text-muted-foreground">
                      المصادر
                    </div>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {latest.sources.map((s, i) => (
                        <li key={i} dir="ltr">
                          •{" "}
                          {typeof s === "string"
                            ? s
                            : `${s.title}${s.note ? ` — ${s.note}` : ""}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {latestRich?.agent_breakdown?.a3_reference?.raw && (() => {
              const raw = latestRich.agent_breakdown.a3_reference.raw as Record<string, unknown>;
              const matches = (raw.matches ?? []) as WebSourceMatch[];
              const webResults = (raw.web_results ?? []) as WebSourceMatch[];
              const contradictions = (raw.contradictions ?? []) as WebSourceMatch[];
              const queries = (raw.queries ?? []) as string[];
              const engines = (raw.engines ?? {}) as Record<string, boolean>;
              if (matches.length === 0 && webResults.length === 0 && contradictions.length === 0 && queries.length === 0) {
                return null;
              }
              return (
                <WebSourcesPanel
                  matches={matches}
                  webResults={webResults}
                  contradictions={contradictions}
                  queries={queries}
                  engines={engines}
                  rssCount={Number(raw.rss_articles_checked ?? 0)}
                  webHitsSeen={Number(raw.web_hits_seen ?? 0)}
                  webScraped={Number(raw.web_articles_scraped ?? 0)}
                />
              );
            })()}

            {latestRich?.agent_breakdown && (
              <AgentBreakdownPanel
                agents={latestRich.agent_breakdown}
                weighted_score={latestRich.weighted_score}
              />
            )}
          </div>
        )}
      </Card>

      {/* History */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">السجل ({history.length})</h2>
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportCsv(history)}
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <Card className="border-dashed border-border/50 bg-transparent p-10 text-center text-sm text-muted-foreground">
            لا يوجد سجل بعد
          </Card>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <Card key={h.id} className="border-border/50 p-4">
                <div className="flex items-start gap-4">
                  <ConfidenceRing value={h.confidence} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <VerdictBadge
                        verdict={
                          h.verdict === "uncertain" ? "suspicious" : (h.verdict as any)
                        }
                      />
                      <span className="mono text-[11px] text-muted-foreground">
                        {h.kind?.toUpperCase()}
                      </span>
                      <span className="mono text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(h.created_at), {
                          addSuffix: true,
                          locale: ar,
                        })}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ms-auto h-7 gap-1 text-xs"
                        onClick={() => setSaveTarget(h)}
                      >
                        <Save className="h-3 w-3" /> حفظ
                      </Button>
                    </div>
                    <p className="line-clamp-2 text-sm">{h.input_text}</p>
                    {h.explanation && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {h.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!saveTarget} onOpenChange={(o) => !o && setSaveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حفظ في مجموعة</DialogTitle>
          </DialogHeader>
          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              أنشئ مجموعة أولًا من صفحة "المجموعات".
            </p>
          ) : (
            <Select value={chosenCol} onValueChange={setChosenCol}>
              <SelectTrigger>
                <SelectValue placeholder="اختر مجموعة" />
              </SelectTrigger>
              <SelectContent>
                {collections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button onClick={saveToCollection} disabled={!chosenCol}>
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
