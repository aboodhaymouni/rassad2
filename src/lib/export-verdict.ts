/**
 * Verdict export helpers — JSON, CSV, plain-text shareable summary.
 *
 * Pure client-side: builds a Blob and triggers a download. No server hop.
 */

import type { FinalVerdict, AgentResult } from "./rasad-api";
import { describeVerdict, agentDisplayName } from "./verdict-mapping";

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so Safari has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const safeId = (v: FinalVerdict): string =>
  (v.id || v.content_hash || Date.now().toString()).slice(0, 12);

export function exportVerdictJSON(verdict: FinalVerdict): void {
  const json = JSON.stringify(verdict, null, 2);
  const blob = new Blob(["﻿" + json], {
    type: "application/json;charset=utf-8",
  });
  triggerDownload(blob, `rasad-verdict-${safeId(verdict)}.json`);
}

export function exportVerdictCSV(verdict: FinalVerdict): void {
  const rows: string[][] = [];
  rows.push(["field", "value"]);
  rows.push(["id", verdict.id]);
  rows.push(["verdict", verdict.verdict]);
  rows.push(["confidence", String(verdict.confidence)]);
  rows.push(["mode", verdict.mode]);
  rows.push(["processing_time_ms", String(verdict.processing_time_ms)]);
  rows.push(["content_type", verdict.content_type]);
  rows.push(["created_at", verdict.created_at]);
  rows.push(["arabic_explanation", verdict.arabic_explanation || ""]);
  rows.push(["english_explanation", verdict.english_explanation || ""]);
  if (verdict.weighted_score !== undefined) {
    rows.push(["weighted_score", String(verdict.weighted_score)]);
  }

  rows.push([]);
  rows.push(["agent", "score", "confidence", "mode", "elapsed_ms", "evidence"]);
  for (const [agentId, result] of Object.entries(verdict.agent_breakdown ?? {})) {
    const r = result as AgentResult;
    rows.push([
      agentId,
      String(r.score ?? ""),
      r.confidence ?? "",
      r.mode ?? "",
      String(r.elapsed_ms ?? ""),
      (r.evidence ?? []).join(" | "),
    ]);
  }

  rows.push([]);
  rows.push(["sources"]);
  for (const s of verdict.sources ?? []) {
    rows.push([s]);
  }

  const escape = (cell: string): string =>
    `"${(cell ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, `rasad-verdict-${safeId(verdict)}.csv`);
}

export function buildShareableText(verdict: FinalVerdict): string {
  const desc = describeVerdict(verdict.verdict);
  const lines: string[] = [];
  lines.push(`📋 تقرير رصد — ${desc.arabic}`);
  lines.push(`الثقة: ${verdict.confidence}%`);
  lines.push("");
  if (verdict.arabic_explanation) {
    lines.push(verdict.arabic_explanation);
    lines.push("");
  }
  if (verdict.agent_breakdown && Object.keys(verdict.agent_breakdown).length > 0) {
    lines.push("نتائج الوكلاء:");
    for (const [aid, r] of Object.entries(verdict.agent_breakdown)) {
      const a = r as AgentResult;
      const pct = Math.round((a.score ?? 0) * 100);
      lines.push(`• ${agentDisplayName(aid)}: ${pct}% (${a.confidence})`);
    }
    lines.push("");
  }
  if (verdict.sources && verdict.sources.length > 0) {
    lines.push("المصادر:");
    for (const s of verdict.sources.slice(0, 6)) {
      lines.push(`• ${s}`);
    }
  }
  lines.push("");
  lines.push(`— رصد · rassad.io · ${verdict.processing_time_ms}ms`);
  return lines.join("\n");
}

export async function copyShareableText(verdict: FinalVerdict): Promise<boolean> {
  const text = buildShareableText(verdict);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
