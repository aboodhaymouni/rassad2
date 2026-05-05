import {
  Brain,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Network,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import { ConfidenceRing } from "./ConfidenceRing";
import {
  AGENT_DISPLAY_NAMES,
  CONFIDENCE_LABEL_AR,
} from "@/lib/verdict-mapping";
import type { AgentResult } from "@/lib/rasad-api";

const AGENT_ICON: Record<string, LucideIcon> = {
  a1_arabic_nlp: Brain,
  a2_media_authenticity: ImageIcon,
  a3_reference: FileSearch,
  a4_ml_fakenews: ShieldCheck,
  a5_claim_tracer: Network,
  a6_verdict_engine: Sparkles,
};

const AGENT_DESC: Record<string, string> = {
  a1_arabic_nlp: "يكتشف التلاعب العاطفي والأنماط الإثارية في النص العربي",
  a2_media_authenticity: "يفحص الميتاداتا والمؤشرات على توليد بالذكاء أو تلاعب",
  a3_reference: "يطابق الادعاء مع المصادر العربية الموثوقة",
  a4_ml_fakenews: "نموذج BERT يُقدّر احتمال أن يكون الخبر مزيفاً",
  a5_claim_tracer: "يحدّد المصدر الأصلي وزمن انتشار الادعاء",
  a6_verdict_engine: "يجمع نتائج كل الوكلاء ويصيغ الشرح النهائي",
};

const ORDER = [
  "a1_arabic_nlp",
  "a3_reference",
  "a4_ml_fakenews",
  "a5_claim_tracer",
  "a2_media_authenticity",
  "a6_verdict_engine",
];

interface Props {
  agents: Record<string, AgentResult>;
  weighted_score?: number;
  className?: string;
}

export const AgentBreakdownPanel = ({ agents, weighted_score, className = "" }: Props) => {
  const ids = ORDER.filter((id) => id in agents).concat(
    Object.keys(agents).filter((id) => !ORDER.includes(id)),
  );
  if (ids.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/90">تفصيل الوكلاء ({ids.length})</h3>
        {typeof weighted_score === "number" && (
          <span className="mono text-[11px] text-muted-foreground">
            WEIGHTED {Math.round(weighted_score * 100)}%
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ids.map((id) => (
          <AgentBreakdownCard key={id} id={id} result={agents[id]} />
        ))}
      </div>
    </div>
  );
};

const AgentBreakdownCard = ({ id, result }: { id: string; result: AgentResult }) => {
  const Icon = AGENT_ICON[id] ?? ShieldCheck;
  const name = AGENT_DISPLAY_NAMES[id]?.ar ?? id;
  const desc = AGENT_DESC[id] ?? "";
  const score = Math.round((result.score ?? 0) * 100);
  const confidence = CONFIDENCE_LABEL_AR[result.confidence] ?? result.confidence;
  const isReal = result.mode === "real";
  const isTimeout = result.confidence === "timeout";
  const evidence = (result.evidence ?? []).slice(0, 4);

  return (
    <div className="glass-panel relative overflow-hidden p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
          <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-bold">{name}</h4>
            <span className="mono text-[10px] text-muted-foreground">{id}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
            {desc}
          </p>
        </div>
        <ConfidenceRing value={score} size={44} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            isReal
              ? "border-verified/30 bg-verified/10 text-verified"
              : isTimeout
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-muted-foreground/30 bg-muted/30 text-muted-foreground"
          }`}
        >
          {isReal ? (
            <CheckCircle2 className="h-2.5 w-2.5" />
          ) : isTimeout ? (
            <Clock3 className="h-2.5 w-2.5" />
          ) : (
            <AlertTriangle className="h-2.5 w-2.5" />
          )}
          {isReal ? "حقيقي" : isTimeout ? "مهلة" : "احتياطي"}
        </span>
        <span className="mono text-[10px] text-muted-foreground">{confidence}</span>
        {result.elapsed_ms > 0 && (
          <span className="mono text-[10px] text-muted-foreground">
            {result.elapsed_ms}ms
          </span>
        )}
      </div>

      {evidence.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-white/[0.05] pt-3 text-[11px] text-muted-foreground">
          {evidence.map((e, i) => (
            <li key={i} className="line-clamp-1">• {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
