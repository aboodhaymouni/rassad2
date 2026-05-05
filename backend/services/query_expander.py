"""Generates a small set of strong search queries from a raw claim.

Two paths:
- Gemini-powered (when GEMINI_API_KEY is configured): asks the model for 3
  bilingual query variants tuned for news search.
- Heuristic fallback: regex-based key-phrase + entity extraction with a few
  Arabic stop-words removed; works fully offline.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

ARABIC_STOPWORDS = {
    "في", "من", "إلى", "على", "عن", "هو", "هي", "هم", "أن", "إن", "لا", "ما",
    "كان", "كانت", "قد", "لقد", "كل", "بعض", "غير", "أو", "ثم", "إذا", "حتى",
    "بعد", "قبل", "هذه", "هذا", "ذلك", "تلك", "بين", "أمام", "خلف", "تحت",
    "فوق", "كذلك", "أيضا", "أيضاً", "وفق", "وفقاً", "بحسب", "حسب", "خلال",
    "اليوم", "أمس", "الآن", "هنا", "هناك", "حيث", "متى", "لماذا", "كيف",
}
ENGLISH_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "of", "in", "on",
    "to", "from", "for", "with", "by", "at", "this", "that", "these",
    "those", "is", "are", "was", "were", "be", "been", "being", "as",
    "it", "its", "can", "could", "should", "would",
}


def _clean(text: str) -> str:
    text = re.sub(r"https?://\S+", " ", text or "")
    text = re.sub(r"[‏‎‪-‮]", "", text)
    text = re.sub(r"[^؀-ۿa-zA-Z0-9 ،.\-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _is_arabic(text: str) -> bool:
    if not text:
        return False
    arabic = sum(1 for c in text if "؀" <= c <= "ۿ")
    return arabic > len(text) * 0.2


def _key_terms(text: str) -> list[str]:
    text = _clean(text)
    out: list[str] = []
    for tok in text.split():
        low = tok.lower()
        if len(tok) <= 2:
            continue
        if low in ARABIC_STOPWORDS or low in ENGLISH_STOPWORDS:
            continue
        out.append(tok)
    # de-dupe preserving order
    seen, deduped = set(), []
    for t in out:
        if t in seen:
            continue
        seen.add(t)
        deduped.append(t)
    return deduped


def _extract_quoted_phrases(text: str) -> list[str]:
    return [m for m in re.findall(r'"([^"]{4,80})"|«([^»]{4,80})»', text or "") for m in m if m]


class QueryExpander:
    """Produces ranked list of search queries from a free-text claim."""

    def __init__(self) -> None:
        self.gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
        self._gemini = None
        self._gemini_failed = not self.gemini_key

    async def expand(self, claim: str, max_queries: int = 4) -> list[str]:
        claim = (claim or "").strip()
        if not claim:
            return []
        # Always include the trimmed claim as query #1
        queries: list[str] = [claim[:200]]

        # Quoted excerpt for exact match (short)
        if 30 < len(claim) < 200:
            queries.append(f'"{claim[:120]}"')

        # Key-term query (cheap, always available)
        terms = _key_terms(claim)
        if terms:
            top = " ".join(terms[:8])
            if top and top not in queries:
                queries.append(top)

        # Add quoted phrases the user typed
        for phrase in _extract_quoted_phrases(claim):
            if phrase not in queries:
                queries.append(f'"{phrase}"')

        # Try LLM expansion (best effort)
        if self.gemini_key and not self._gemini_failed:
            llm_queries = await self._gemini_queries(claim)
            for q in llm_queries:
                if q and q not in queries:
                    queries.append(q)

        # Cap and clean
        out: list[str] = []
        seen = set()
        for q in queries:
            qc = q.strip()
            if not qc or qc.lower() in seen:
                continue
            seen.add(qc.lower())
            out.append(qc)
            if len(out) >= max_queries:
                break
        return out

    async def _gemini_queries(self, claim: str) -> list[str]:
        try:
            model = self._get_model()
            if model is None:
                return []
            loop = asyncio.get_running_loop()
            language = "ar" if _is_arabic(claim) else "en"
            prompt = (
                "أنت محرّك بحث. أعد JSON فقط، لا شرح، لا markdown.\n"
                "بناءً على هذا الادعاء:\n"
                f"\"\"\"{claim[:600]}\"\"\"\n\n"
                "أنشئ 3 استعلامات بحث قصيرة (5-12 كلمة لكل استعلام) "
                f"مناسبة لمحرك بحث أخبار. اللغة الأساسية: {language}. "
                "أحدها يجب أن يكون باللغة الأخرى لتوسيع التغطية. "
                "أعد فقط مصفوفة JSON من السلاسل، مثال:\n"
                '["query 1","query 2","query 3"]'
            )
            resp = await loop.run_in_executor(None, lambda: model.generate_content(prompt))
            raw = (resp.text or "").strip()
            return self._parse_json_array(raw)
        except Exception as e:
            logger.debug("Gemini query expansion failed: %s", e)
            self._gemini_failed = True
            return []

    def _get_model(self):
        if self._gemini is not None or self._gemini_failed:
            return self._gemini
        try:
            import google.generativeai as genai

            genai.configure(api_key=self.gemini_key)
            self._gemini = genai.GenerativeModel(
                os.getenv("GEMINI_QUERY_MODEL", "gemini-2.5-flash"),
            )
        except Exception as e:
            logger.debug("Gemini init failed: %s", e)
            self._gemini_failed = True
            self._gemini = None
        return self._gemini

    @staticmethod
    def _parse_json_array(raw: str) -> list[str]:
        if not raw:
            return []
        # Strip markdown fences
        cleaned = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE)
        # Find the first JSON array
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start == -1 or end == -1 or end <= start:
            return []
        try:
            import json

            arr = json.loads(cleaned[start : end + 1])
            return [str(x).strip() for x in arr if isinstance(x, str)]
        except Exception:
            return []
