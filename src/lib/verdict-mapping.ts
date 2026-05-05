/**
 * Verdict label utilities.
 *
 * The FastAPI backend emits a 9-label enum (VERIFIED, FALSE, MISLEADING,
 * AI_GENERATED, MANIPULATED, OLD_NEWS, UNVERIFIED, DUPLICATE, HIGH_RISK).
 * The Supabase `verifications` table has a 4-label CHECK constraint
 * (trusted/suspicious/fake/uncertain). This module bridges both.
 */

import type { VerdictLabel } from "./rasad-api";

export type LegacyVerdict = "trusted" | "suspicious" | "fake" | "uncertain";

/** Compact descriptor used by the UI. */
export interface VerdictDescriptor {
  label: VerdictLabel;
  arabic: string;
  english: string;
  legacy: LegacyVerdict;
  /** Tailwind utility classes for the badge background + text. */
  classes: string;
  /** Lucide icon name. */
  icon: VerdictIcon;
  /** Whether the badge should pulse for emphasis (e.g. HIGH_RISK). */
  pulse: boolean;
}

export type VerdictIcon =
  | "check-circle"
  | "x-octagon"
  | "alert-triangle"
  | "sparkles"
  | "scissors"
  | "rotate-ccw"
  | "help-circle"
  | "copy"
  | "alert-octagon";

const TABLE: Record<VerdictLabel, VerdictDescriptor> = {
  VERIFIED: {
    label: "VERIFIED",
    arabic: "موثوق",
    english: "Verified",
    legacy: "trusted",
    classes: "text-verified border-verified/30 bg-verified/10",
    icon: "check-circle",
    pulse: false,
  },
  FALSE: {
    label: "FALSE",
    arabic: "كاذب",
    english: "False",
    legacy: "fake",
    classes: "text-primary border-primary/30 bg-primary/10",
    icon: "x-octagon",
    pulse: false,
  },
  MISLEADING: {
    label: "MISLEADING",
    arabic: "مضلِّل",
    english: "Misleading",
    legacy: "suspicious",
    classes: "text-warning border-warning/30 bg-warning/10",
    icon: "alert-triangle",
    pulse: false,
  },
  AI_GENERATED: {
    label: "AI_GENERATED",
    arabic: "مولَّد بالذكاء الاصطناعي",
    english: "AI-generated",
    legacy: "fake",
    classes: "text-info border-info/30 bg-info/10",
    icon: "sparkles",
    pulse: false,
  },
  MANIPULATED: {
    label: "MANIPULATED",
    arabic: "متلاعَب به",
    english: "Manipulated",
    legacy: "fake",
    classes: "text-purple-300 border-purple-400/30 bg-purple-500/10",
    icon: "scissors",
    pulse: false,
  },
  OLD_NEWS: {
    label: "OLD_NEWS",
    arabic: "خبر قديم",
    english: "Old news",
    legacy: "suspicious",
    classes: "text-muted-foreground border-muted-foreground/30 bg-muted/30",
    icon: "rotate-ccw",
    pulse: false,
  },
  UNVERIFIED: {
    label: "UNVERIFIED",
    arabic: "غير مؤكَّد",
    english: "Unverified",
    legacy: "uncertain",
    classes: "text-foreground border-foreground/20 bg-foreground/5",
    icon: "help-circle",
    pulse: false,
  },
  DUPLICATE: {
    label: "DUPLICATE",
    arabic: "مكرَّر",
    english: "Duplicate",
    legacy: "uncertain",
    classes: "text-muted-foreground border-muted-foreground/30 bg-card/60",
    icon: "copy",
    pulse: false,
  },
  HIGH_RISK: {
    label: "HIGH_RISK",
    arabic: "خطر مرتفع",
    english: "High risk",
    legacy: "suspicious",
    classes: "text-primary border-primary/40 bg-primary/15",
    icon: "alert-octagon",
    pulse: true,
  },
};

/** Lookup full descriptor for any label. Falls back to UNVERIFIED. */
export function describeVerdict(label: string | undefined | null): VerdictDescriptor {
  if (!label) return TABLE.UNVERIFIED;
  const upper = label.toUpperCase();
  return (TABLE as Record<string, VerdictDescriptor>)[upper] ?? TABLE.UNVERIFIED;
}

/** Map any RASAD verdict to the legacy 4-label enum used by Supabase. */
export function toLegacyVerdict(label: string | undefined | null): LegacyVerdict {
  return describeVerdict(label).legacy;
}

/** Pretty Arabic name for the verdict, used in chips and titles. */
export function arabicName(label: string | undefined | null): string {
  return describeVerdict(label).arabic;
}

/** Pretty agent display name in Arabic. */
export const AGENT_DISPLAY_NAMES: Record<string, { ar: string; en: string }> = {
  a1_arabic_nlp: { ar: "تحليل لغوي عربي", en: "Arabic NLP" },
  a2_media_authenticity: { ar: "أصالة الوسائط", en: "Media Authenticity" },
  a3_reference: { ar: "مدقّق المصادر", en: "Reference Checker" },
  a4_ml_fakenews: { ar: "نموذج الأخبار الكاذبة", en: "ML Fake News" },
  a5_claim_tracer: { ar: "تتبّع الادعاء", en: "Claim Tracer" },
  a6_verdict_engine: { ar: "محرّك الحكم", en: "Verdict Engine" },
};

export function agentDisplayName(agentId: string): string {
  return AGENT_DISPLAY_NAMES[agentId]?.ar ?? agentId;
}

export const CONFIDENCE_LABEL_AR: Record<string, string> = {
  high: "ثقة عالية",
  medium: "ثقة متوسطة",
  low: "ثقة منخفضة",
  insufficient_data: "بيانات غير كافية",
  timeout: "انتهت المهلة",
};
