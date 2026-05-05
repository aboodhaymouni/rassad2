/**
 * Public-user verdict history backed by localStorage.
 *
 * Stores up to MAX_ITEMS most-recent FinalVerdicts so that visitors who don't
 * sign in still get a personal history. Purely client-side; nothing leaves
 * the browser.
 */

import type { FinalVerdict } from "./rasad-api";

const KEY = "rasad:public-history";
const MAX_ITEMS = 20;

export interface LocalHistoryEntry {
  /** When the entry was saved (ISO). Distinct from verdict.created_at. */
  saved_at: string;
  /** Original input (shortened) so we can show context in the list. */
  input_snippet: string;
  input_kind: "text" | "url" | "image";
  verdict: FinalVerdict;
}

function readRaw(): LocalHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(items: LocalHistoryEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage might be disabled or full — fail silently.
  }
}

export function getHistory(): LocalHistoryEntry[] {
  return readRaw();
}

export function addToHistory(
  verdict: FinalVerdict,
  input: { kind: LocalHistoryEntry["input_kind"]; snippet: string },
): void {
  if (!verdict?.id) return;
  const items = readRaw();
  // De-dupe by content_hash if available, else by id
  const key = verdict.content_hash || verdict.id;
  const filtered = items.filter(
    (e) => (e.verdict.content_hash || e.verdict.id) !== key,
  );
  const entry: LocalHistoryEntry = {
    saved_at: new Date().toISOString(),
    input_snippet: input.snippet.slice(0, 240),
    input_kind: input.kind,
    verdict,
  };
  writeRaw([entry, ...filtered].slice(0, MAX_ITEMS));
}

export function removeFromHistory(verdictId: string): void {
  const items = readRaw().filter((e) => e.verdict.id !== verdictId);
  writeRaw(items);
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export const HISTORY_LIMIT = MAX_ITEMS;
