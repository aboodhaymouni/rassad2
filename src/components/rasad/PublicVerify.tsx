import { useEffect, useState } from "react";
import {
  Check,
  Clipboard,
  Download,
  History as HistoryIcon,
  Image as ImageIcon,
  Link2,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfidenceRing } from "@/components/rasad/ConfidenceRing";
import { RasadVerdictBadge } from "@/components/rasad/Badge";
import { AgentBreakdownPanel } from "@/components/rasad/AgentBreakdownPanel";
import { WebSourcesPanel } from "@/components/rasad/WebSourcesPanel";
import {
  verifyText,
  verifyUrl,
  verifyMedia,
  RasadApiError,
  type FinalVerdict,
  type WebSourceMatch,
} from "@/lib/rasad-api";
import {
  addToHistory,
  clearHistory,
  getHistory,
  removeFromHistory,
  type LocalHistoryEntry,
} from "@/lib/local-history";
import {
  copyShareableText,
  exportVerdictCSV,
  exportVerdictJSON,
} from "@/lib/export-verdict";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const SUGGESTIONS = [
  "اكتشاف علاج جديد لمرض السكري في مستشفى أردني",
  "زلزال يضرب جنوب تركيا اليوم",
  "ارتفاع أسعار الذهب في الأسواق العربية",
  "اجتماع طارئ لجامعة الدول العربية حول غزة",
];

export const PublicVerify = ({ className = "" }: { className?: string }) => {
  const [tab, setTab] = useState<"text" | "url" | "image">("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [result, setResult] = useState<FinalVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<LocalHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const refreshHistory = () => setHistory(getHistory());

  const onImage = (f: File | null) => {
    setImgFile(f);
    if (imgPreview) URL.revokeObjectURL(imgPreview);
    setImgPreview(f ? URL.createObjectURL(f) : null);
  };

  const cycleStages = () => {
    const stages = tab === "image"
      ? [
          "استخراج بيانات EXIF…",
          "فحص الميتاداتا…",
          "كشف توليد الذكاء الاصطناعي…",
          "تحليل سياق الصورة…",
          "صياغة الحكم النهائي…",
        ]
      : [
          "تحليل النص العربي…",
          "البحث في الويب…",
          "مطابقة المصادر الموثوقة…",
          "كشف أنماط التضليل…",
          "تتبّع أصل الادعاء…",
          "صياغة الحكم النهائي…",
        ];
    let i = 0;
    setStage(stages[0]);
    const interval = window.setInterval(() => {
      i = (i + 1) % stages.length;
      setStage(stages[i]);
    }, 2200);
    return () => window.clearInterval(interval);
  };

  const run = async () => {
    if (running) return;
    setError(null);
    setResult(null);
    if (tab === "text" && text.trim().length < 10) {
      toast.error("الادعاء يحتاج 10 أحرف على الأقل");
      return;
    }
    if (tab === "url" && !/^https?:\/\//i.test(url.trim())) {
      toast.error("أدخل رابطًا صالحًا يبدأ بـ http(s)");
      return;
    }
    if (tab === "image" && !imgFile) {
      toast.error("اختر صورة للتحقق منها");
      return;
    }
    setRunning(true);
    const stop = cycleStages();
    try {
      let v: FinalVerdict;
      let snippet = "";
      let kind: "text" | "url" | "image" = tab;
      if (tab === "text") {
        v = await verifyText(text.trim());
        snippet = text.trim();
      } else if (tab === "url") {
        v = await verifyUrl(url.trim());
        snippet = url.trim();
      } else {
        v = await verifyMedia(imgFile!, { contextText: text.trim() || undefined });
        snippet = (text.trim() || imgFile?.name || "صورة") + "";
      }
      setResult(v);
      addToHistory(v, { kind, snippet });
      refreshHistory();
      toast.success(
        v.cached ? "نتيجة من الذاكرة المؤقتة" : "اكتمل التحقق",
      );
    } catch (e) {
      const msg = e instanceof RasadApiError
        ? e.detail || e.message
        : e instanceof Error
          ? e.message
          : "تعذّر إكمال التحقق";
      setError(msg);
      toast.error(msg);
    } finally {
      stop();
      setStage("");
      setRunning(false);
    }
  };

  const a3raw = (result?.agent_breakdown?.a3_reference?.raw ?? {}) as Record<string, unknown>;
  const matches = (a3raw.matches ?? []) as WebSourceMatch[];
  const webResults = (a3raw.web_results ?? []) as WebSourceMatch[];
  const contradictions = (a3raw.contradictions ?? []) as WebSourceMatch[];
  const queries = (a3raw.queries ?? []) as string[];
  const engines = (a3raw.engines ?? {}) as Record<string, boolean>;

  return (
    <section className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-card p-5 sm:p-7 ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold leading-tight">حقل التحقق</h2>
        </div>
        <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          نص أو رابط
        </span>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "text" | "url" | "image")} className="mt-5">
        <TabsList className="grid w-full grid-cols-3 sm:w-96">
          <TabsTrigger value="text" className="gap-1.5">
            <Search className="h-3.5 w-3.5" /> نص
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> رابط
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> صورة
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="مثال: اكتشف العلماء أن الأرض مسطحة وفقاً لدراسة جديدة من ناسا"
            rows={4}
            maxLength={2000}
            disabled={running}
            dir="auto"
          />
          {!text && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setText(s)}
                  className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                  disabled={running}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="url" className="mt-4">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.aljazeera.net/news/..."
            disabled={running}
            dir="ltr"
          />
        </TabsContent>
        <TabsContent value="image" className="mt-4 space-y-3">
          {imgPreview ? (
            <div className="relative inline-block">
              <img
                src={imgPreview}
                alt="معاينة"
                className="max-h-64 rounded-lg border border-white/[0.08]"
              />
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 end-2 h-7 w-7"
                onClick={() => onImage(null)}
                disabled={running}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/[0.08] bg-card/40 p-8 transition hover:border-primary/40 hover:bg-primary/5">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm">اضغط لاختيار صورة (JPG/PNG حتى 10MB)</span>
              <span className="text-[11px] text-muted-foreground">
                سيفحص EXIF + علامات التوليد بالذكاء الاصطناعي
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={running}
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
            placeholder="سياق اختياري للصورة (مثلاً: ادعاء يرافقها)…"
            disabled={running}
            dir="auto"
          />
        </TabsContent>
      </Tabs>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={running} className="gap-2 px-6 py-3 text-base font-bold" style={{ minHeight: 48 }}>
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {stage || "جارٍ التحليل…"}
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              تحقّق الآن
            </>
          )}
        </Button>
        <span className="text-[11px] leading-relaxed text-muted-foreground">
          {tab === "image"
            ? "مجاناً · ~5 ثوانٍ · فحص EXIF + كشف AI generation"
            : "مجاناً · 10–15 ثانية · 10 مصادر RSS + بحث ويب حي"}
        </span>
      </div>

      {error && !running && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
          {error}
        </div>
      )}

      {result && !running && (
        <div className="mt-7 space-y-5">
          <div className="flex flex-col items-start gap-5 rounded-xl border border-border/50 bg-background/40 p-5 sm:flex-row">
            <ConfidenceRing value={result.confidence} size={92} label="ثقة" />
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <RasadVerdictBadge verdict={result.verdict} showEnglish />
                <span className="mono text-xs text-muted-foreground">
                  {result.processing_time_ms} ms · {result.mode}
                </span>
                {result.cached && (
                  <span className="mono rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    CACHED
                  </span>
                )}
                <div className="ms-auto flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyShareableText(result);
                      if (ok) {
                        setCopiedShare(true);
                        toast.success("تم نسخ التقرير");
                        setTimeout(() => setCopiedShare(false), 2000);
                      } else {
                        toast.error("تعذّر النسخ");
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-white/[0.10] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                    title="نسخ ملخص قابل للمشاركة"
                  >
                    {copiedShare ? <Check className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />}
                    نسخ
                  </button>
                  <button
                    type="button"
                    onClick={() => exportVerdictCSV(result)}
                    className="inline-flex items-center gap-1 rounded-md border border-white/[0.10] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                    title="تصدير CSV"
                  >
                    <Download className="h-3 w-3" /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => exportVerdictJSON(result)}
                    className="inline-flex items-center gap-1 rounded-md border border-white/[0.10] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                    title="تصدير JSON"
                  >
                    <Download className="h-3 w-3" /> JSON
                  </button>
                </div>
              </div>
              <p className="text-sm leading-[2] text-foreground/95" dir="auto">
                {result.arabic_explanation}
              </p>
              {result.sources.length > 0 && (
                <div className="mt-4 border-t border-border/50 pt-3">
                  <div className="mono mb-2 text-[10px] tracking-widest text-muted-foreground">
                    المصادر المرجعية
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground" dir="ltr">
                    {result.sources.map((s, i) => (
                      <li key={i} className="line-clamp-1">
                        <a href={s} target="_blank" rel="noreferrer noopener" className="hover:text-primary hover:underline">
                          • {s}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {(matches.length > 0 || webResults.length > 0 || contradictions.length > 0 || queries.length > 0) && (
            <WebSourcesPanel
              matches={matches}
              webResults={webResults}
              contradictions={contradictions}
              queries={queries}
              engines={engines}
              rssCount={Number(a3raw.rss_articles_checked ?? 0)}
              webHitsSeen={Number(a3raw.web_hits_seen ?? 0)}
              webScraped={Number(a3raw.web_articles_scraped ?? 0)}
            />
          )}

          {result.agent_breakdown && (
            <AgentBreakdownPanel
              agents={result.agent_breakdown}
              weighted_score={result.weighted_score}
            />
          )}
        </div>
      )}

      {/* Local history (no login, localStorage) */}
      {history.length > 0 && (
        <details
          className="mt-6 rounded-lg border border-white/[0.08] bg-white/[0.02] open:bg-white/[0.03]"
          open={historyOpen}
          onToggle={(e) => setHistoryOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
            <span className="inline-flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-primary" />
              آخر عمليات التحقق ({history.length})
              <span className="mono text-[10px] text-muted-foreground">محفوظة محلياً</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearHistory();
                refreshHistory();
                toast.success("تم مسح السجل المحلي");
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              <Trash2 className="h-3 w-3" /> مسح
            </button>
          </summary>
          <ul className="space-y-2 px-3 pb-3">
            {history.map((entry) => (
              <li
                key={entry.verdict.id}
                className="flex items-start gap-3 rounded-md border border-white/[0.06] bg-background/40 p-3 transition hover:border-primary/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <RasadVerdictBadge verdict={entry.verdict.verdict} />
                    <span className="mono text-muted-foreground">
                      {entry.input_kind.toUpperCase()}
                    </span>
                    <span className="mono text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.saved_at), {
                        addSuffix: true,
                        locale: ar,
                      })}
                    </span>
                    <span className="mono text-muted-foreground">
                      {entry.verdict.confidence}%
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-6 text-foreground/90" dir="auto">
                    {entry.input_snippet}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => exportVerdictJSON(entry.verdict)}
                    className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                    title="تنزيل JSON"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeFromHistory(entry.verdict.id);
                      refreshHistory();
                    }}
                    className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                    title="حذف"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};
