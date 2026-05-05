import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Copy,
  HelpCircle,
  RotateCcw,
  Scissors,
  Sparkles,
  XOctagon,
  type LucideIcon,
} from "lucide-react";
import { describeVerdict, type VerdictIcon } from "@/lib/verdict-mapping";

/** Legacy verdict type kept for backward compatibility with the dashboard. */
export type Verdict = "trusted" | "suspicious" | "fake";

const ICON_MAP: Record<VerdictIcon, LucideIcon> = {
  "check-circle": CheckCircle2,
  "x-octagon": XOctagon,
  "alert-triangle": AlertTriangle,
  sparkles: Sparkles,
  scissors: Scissors,
  "rotate-ccw": RotateCcw,
  "help-circle": HelpCircle,
  copy: Copy,
  "alert-octagon": AlertOctagon,
};

/** Backwards-compatible 4-label badge used by existing dashboard pages. */
export const VerdictBadge = ({
  verdict,
  className = "",
}: {
  verdict: Verdict | string;
  className?: string;
}) => {
  // Map legacy 4-label verdict to a 9-label descriptor for unified rendering.
  const upgraded =
    verdict === "trusted"
      ? "VERIFIED"
      : verdict === "fake"
        ? "FALSE"
        : verdict === "suspicious"
          ? "MISLEADING"
          : (verdict as string).toUpperCase();
  return <RasadVerdictBadge verdict={upgraded} className={className} />;
};

/** Full 9-label badge used by the new agent-aware verify flow. */
export const RasadVerdictBadge = ({
  verdict,
  className = "",
  showEnglish = false,
}: {
  verdict: string;
  className?: string;
  showEnglish?: boolean;
}) => {
  const desc = describeVerdict(verdict);
  const Icon = ICON_MAP[desc.icon] ?? AlertTriangle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${desc.classes} ${desc.pulse ? "animate-pulse" : ""} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {desc.arabic}
      {showEnglish && (
        <span className="mono ms-1 text-[10px] opacity-75">{desc.english}</span>
      )}
    </span>
  );
};
