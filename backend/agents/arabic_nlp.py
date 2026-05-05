"""A1 — Arabic NLP Agent.

Detects emotional manipulation, classifies broad topic, and surfaces
linguistic patterns commonly found in Arabic misinformation.

Real mode: HuggingFace Inference API (if HF_API_TOKEN set) or local
transformer (CAMeL-BERT sentiment) loaded lazily on first call.
Fallback: Regex-based heuristics that still produce a usable AgentResult.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from typing import Optional

from models.response_models import AgentResult, ConfidenceLevel

logger = logging.getLogger(__name__)

EMOTIONAL_KEYWORDS = [
    "عاجل", "خطير", "صادم", "كارثي", "مرعب", "فضيحة", "كذبة",
    "خيانة", "مؤامرة", "سري", "حصري", "انفجار", "مذبحة", "مأساة",
    "صدمة", "غضب", "ثائر", "هلع", "ذعر", "أزمة",
]

URGENCY_MARKERS = [
    "الآن", "فوراً", "عاجل", "بسرعة", "قبل فوات الأوان",
    "لحظة بلحظة", "هذه اللحظة", "حالاً", "فوراً وفوراً",
]

ANONYMOUS_PATTERNS = [
    r"مصادر?\s+مطلعة",
    r"مصادر?\s+مجهولة",
    r"شهود\s+عيان",
    r"شخص\s+مقرب",
    r"بحسب\s+مصادر",
    r"وفقاً\s+لمصادر",
]

UNVERIFIABLE_PATTERNS = [
    r"\d+%\s+(?:من|of)",  # weird percentages
    r"العلماء\s+يؤكدون",   # generic appeal
    r"الدراسات\s+تثبت",
    r"الجميع\s+يعرف",
]

ALL_CAPS_RE = re.compile(r"[A-Z؀-ۿ]{8,}")  # Arabic doesn't have caps but for emphasis chars
SELF_CONTRADICTION_HINTS = ["ولكن", "غير أن", "إلا أن", "بينما"]
TOPIC_KEYWORDS = {
    "politics": ["حكومة", "وزير", "رئيس", "برلمان", "انتخابات", "سياسي", "حزب"],
    "security": ["جيش", "أمن", "إرهاب", "قتلى", "هجوم", "تفجير", "اشتباك"],
    "health": ["مرض", "وباء", "لقاح", "صحة", "مستشفى", "طبيب", "دواء"],
    "economy": ["اقتصاد", "دولار", "بورصة", "سعر", "تضخم", "عملة", "بنك"],
    "social": ["مجتمع", "أسرة", "تعليم", "شباب", "ثقافة", "ديني"],
}


class ArabicNLPAgent:
    """A1 — Arabic linguistic and emotion analysis."""

    def __init__(self, timeout_seconds: float = 20.0) -> None:
        self.agent_id = "a1_arabic_nlp"
        self.timeout = timeout_seconds
        self._sentiment_pipeline = None
        self._loaded = False
        self._load_failed = False
        self.hf_token = os.getenv("HF_API_TOKEN", "").strip()

    async def analyze(self, text: str) -> AgentResult:
        start = time.perf_counter()
        try:
            return await asyncio.wait_for(self._analyze(text, start), timeout=self.timeout)
        except asyncio.TimeoutError:
            logger.warning("A1 timeout after %.1fs", self.timeout)
            return AgentResult(
                agent=self.agent_id,
                score=0.5,
                confidence=ConfidenceLevel.TIMEOUT,
                evidence=["agent timeout"],
                raw={},
                elapsed_ms=int((time.perf_counter() - start) * 1000),
                mode="fallback",
            )
        except Exception as e:
            logger.exception("A1 unexpected error: %s", e)
            return self._fallback(text, start, error=str(e))

    async def _analyze(self, text: str, start: float) -> AgentResult:
        text = (text or "")[:3000]
        emotion_score = self._score_emotion(text)
        urgency = self._score_urgency(text)
        flags = self._detect_flags(text)
        topic = self._detect_topic(text)

        sentiment = None
        mode = "fallback"
        try:
            sentiment = await self._sentiment(text)
            if sentiment is not None:
                mode = "real"
                # blend sentiment polarity into emotion score
                emotion_score = min(1.0, max(0.0, 0.6 * emotion_score + 0.4 * sentiment))
        except Exception as e:
            logger.debug("A1 sentiment fallback: %s", e)

        score = round(min(1.0, 0.5 * emotion_score + 0.3 * urgency + 0.2 * (len(flags) / 6.0)), 4)
        confidence = self._classify_confidence(score, len(flags), sentiment is not None)

        evidence = list(flags)
        if topic != "other":
            evidence.append(f"topic:{topic}")
        if sentiment is not None:
            evidence.append(f"sentiment_polarity:{sentiment:.2f}")
        if urgency > 0.4:
            evidence.append("urgency_panic")

        return AgentResult(
            agent=self.agent_id,
            score=score,
            confidence=confidence,
            evidence=evidence[:10],
            raw={
                "emotion_score": round(emotion_score, 4),
                "urgency_level": round(urgency, 4),
                "topic": topic,
                "manipulation_flags": flags,
                "sentiment_polarity": sentiment,
            },
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode=mode,
        )

    async def _sentiment(self, text: str) -> Optional[float]:
        """Returns a 0..1 polarity (1 = very negative/aggressive)."""
        if self.hf_token:
            return await self._sentiment_via_hf_api(text)
        return await self._sentiment_via_local(text)

    async def _sentiment_via_hf_api(self, text: str) -> Optional[float]:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.post(
                    "https://api-inference.huggingface.co/models/CAMeL-Lab/bert-base-arabic-camelbert-msa-sentiment",
                    headers={"Authorization": f"Bearer {self.hf_token}"},
                    json={"inputs": text[:500]},
                )
                if resp.status_code != 200:
                    return None
                data = resp.json()
                if isinstance(data, list) and data:
                    inner = data[0] if isinstance(data[0], list) else data
                    for entry in inner:
                        label = (entry.get("label") or "").lower()
                        if label in ("negative", "neg"):
                            return float(entry.get("score", 0.0))
                return 0.0
        except Exception as e:
            logger.debug("HF API sentiment failed: %s", e)
            return None

    async def _sentiment_via_local(self, text: str) -> Optional[float]:
        if self._load_failed:
            return None
        if self._sentiment_pipeline is None:
            try:
                loop = asyncio.get_running_loop()
                self._sentiment_pipeline = await loop.run_in_executor(None, self._load_local)
                self._loaded = True
            except Exception as e:
                logger.warning("A1 local model load failed: %s", e)
                self._load_failed = True
                return None
        try:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                None, lambda: self._sentiment_pipeline(text[:480])
            )
            if isinstance(result, list) and result:
                top = result[0] if isinstance(result[0], dict) else result[0][0]
                label = str(top.get("label", "")).lower()
                score = float(top.get("score", 0.0))
                if "neg" in label:
                    return score
                if "pos" in label:
                    return 1.0 - score
                return 0.5
        except Exception as e:
            logger.debug("Local sentiment inference failed: %s", e)
        return None

    @staticmethod
    def _load_local():
        from transformers import pipeline

        return pipeline(
            "sentiment-analysis",
            model="CAMeL-Lab/bert-base-arabic-camelbert-msa-sentiment",
            tokenizer="CAMeL-Lab/bert-base-arabic-camelbert-msa-sentiment",
            top_k=None,
        )

    @staticmethod
    def _score_emotion(text: str) -> float:
        if not text:
            return 0.0
        hits = sum(1 for kw in EMOTIONAL_KEYWORDS if kw in text)
        words = max(1, len(text.split()))
        return min(1.0, hits / max(8.0, words / 30))

    @staticmethod
    def _score_urgency(text: str) -> float:
        hits = sum(1 for kw in URGENCY_MARKERS if kw in text)
        if "!" in text:
            hits += text.count("!") // 2
        return min(1.0, hits / 4.0)

    @staticmethod
    def _detect_flags(text: str) -> list[str]:
        flags: list[str] = []
        if any(kw in text for kw in EMOTIONAL_KEYWORDS):
            flags.append("emotional_language")
        if any(kw in text for kw in URGENCY_MARKERS):
            flags.append("urgency_panic")
        if any(re.search(p, text) for p in ANONYMOUS_PATTERNS):
            flags.append("anonymous_source")
        if any(re.search(p, text) for p in UNVERIFIABLE_PATTERNS):
            flags.append("unverifiable_claim")
        if text.count("!") >= 3:
            flags.append("sensationalist")
        if ALL_CAPS_RE.search(text):
            flags.append("all_caps_phrases")
        if not re.search(r"(قال|أكد|صرح|أعلن|أوضح|بحسب|وفقاً)", text):
            flags.append("no_attribution")
        if sum(text.count(h) for h in SELF_CONTRADICTION_HINTS) >= 3:
            flags.append("contradicts_self")
        return flags

    @staticmethod
    def _detect_topic(text: str) -> str:
        scores: dict[str, int] = {k: 0 for k in TOPIC_KEYWORDS}
        for topic, keywords in TOPIC_KEYWORDS.items():
            for kw in keywords:
                if kw in text:
                    scores[topic] += 1
        best = max(scores.items(), key=lambda x: x[1])
        return best[0] if best[1] >= 2 else "other"

    @staticmethod
    def _classify_confidence(score: float, flag_count: int, real_signal: bool) -> ConfidenceLevel:
        if not real_signal and flag_count == 0:
            return ConfidenceLevel.LOW
        if flag_count >= 3 or real_signal:
            return ConfidenceLevel.HIGH
        return ConfidenceLevel.MEDIUM

    def _fallback(self, text: str, start: float, error: str = "") -> AgentResult:
        flags = self._detect_flags(text or "")
        return AgentResult(
            agent=self.agent_id,
            score=0.5,
            confidence=ConfidenceLevel.INSUFFICIENT_DATA,
            evidence=flags + ([f"error:{error[:80]}"] if error else []),
            raw={"manipulation_flags": flags, "fallback": True},
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode="fallback",
        )
