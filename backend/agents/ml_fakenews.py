"""A4 — ML Fake News Agent.

Ensemble of two complementary models:
- XSY/albert-base-v2-fakenews-discriminator (English, 17MB) — weight 0.55
- CAMeL-Lab/bert-base-arabic-camelbert-msa-sentiment — weight 0.45

The Arabic sentiment model contributes by mapping strongly negative
sentiment toward higher fake-news probability (a noisy but useful proxy
for sensationalist content). Linguistic patterns add an extra signal.
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


WEIGHT_ENGLISH = 0.55
WEIGHT_ARABIC = 0.45

PATTERN_SIGNALS = {
    "all_caps_headline": re.compile(r"[A-Z]{8,}"),
    "anonymous_author": re.compile(r"(?:كاتب|كاتبة|كتب|نشر)\s+(?:مجهول|غير معروف|anonymous)", re.IGNORECASE),
    "no_date": None,  # detected by lack of date markers
    "extreme_emotion": re.compile(r"[!]{3,}|[؟]{3,}|\?{3,}"),
    "vague_attribution": re.compile(r"(?:قال البعض|يقال|البعض يقول|بعض الناس|قالوا)"),
    "unverifiable_stats": re.compile(r"\d{1,3}%\s+(?:من|of)\s+(?:الناس|الجميع|المجتمع|people)"),
}


class MLFakeNewsAgent:
    """A4 — fake-news probability via ensemble + patterns."""

    def __init__(self, timeout_seconds: float = 20.0) -> None:
        self.agent_id = "a4_ml_fakenews"
        self.timeout = timeout_seconds
        self.hf_token = os.getenv("HF_API_TOKEN", "").strip()
        self._english_pipeline = None
        self._arabic_pipeline = None
        self._english_failed = False
        self._arabic_failed = False

    async def analyze(self, text: str) -> AgentResult:
        start = time.perf_counter()
        try:
            return await asyncio.wait_for(
                self._analyze(text, start), timeout=self.timeout
            )
        except asyncio.TimeoutError:
            return self._timeout(start)
        except Exception as e:
            logger.exception("A4 error: %s", e)
            return self._fallback(text, start, error=str(e))

    async def _analyze(self, text: str, start: float) -> AgentResult:
        text = (text or "")[:512]
        patterns = self._detect_patterns(text)

        eng_score, eng_used = await self._english_score(text)
        ar_score, ar_used = await self._arabic_score(text)

        scores: list[tuple[float, float]] = []
        if eng_score is not None:
            scores.append((eng_score, WEIGHT_ENGLISH))
        if ar_score is not None:
            scores.append((ar_score, WEIGHT_ARABIC))

        if scores:
            total = sum(w for _, w in scores)
            ensemble = sum(s * w for s, w in scores) / total
            mode = "real" if (eng_used or ar_used) else "fallback"
        else:
            ensemble = self._heuristic_score(text, patterns)
            mode = "fallback"

        # Pattern boost (max +0.15)
        ensemble = min(1.0, ensemble + min(0.15, len(patterns) * 0.04))

        confidence = self._classify_confidence(eng_used, ar_used, len(patterns))
        evidence = list(patterns)
        if eng_score is not None:
            evidence.append(f"english_bert:{eng_score:.2f}")
        if ar_score is not None:
            evidence.append(f"arabic_sentiment:{ar_score:.2f}")

        return AgentResult(
            agent=self.agent_id,
            score=round(float(ensemble), 4),
            confidence=confidence,
            evidence=evidence[:10],
            raw={
                "fake_probability": round(float(ensemble), 4),
                "patterns": patterns,
                "model_scores": {
                    "english_bert_tiny": eng_score,
                    "arabic_sentiment": ar_score,
                },
            },
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode=mode,
        )

    async def _english_score(self, text: str) -> tuple[Optional[float], bool]:
        if self.hf_token:
            api_score = await self._call_hf_api(
                "XSY/albert-base-v2-fakenews-discriminator", text
            )
            if api_score is not None:
                return api_score, True
        if self._english_failed:
            return None, False
        if self._english_pipeline is None:
            try:
                loop = asyncio.get_running_loop()
                self._english_pipeline = await loop.run_in_executor(
                    None, self._load_english
                )
            except Exception as e:
                logger.warning("A4 english model load failed: %s", e)
                self._english_failed = True
                return None, False
        try:
            loop = asyncio.get_running_loop()
            res = await loop.run_in_executor(
                None, lambda: self._english_pipeline(text)
            )
            return self._extract_fake_score(res, fake_label_hints=("fake", "label_1", "1")), True
        except Exception as e:
            logger.debug("A4 english inference failed: %s", e)
            return None, False

    async def _arabic_score(self, text: str) -> tuple[Optional[float], bool]:
        if self.hf_token:
            api_score = await self._call_hf_api(
                "CAMeL-Lab/bert-base-arabic-camelbert-msa-sentiment", text
            )
            if api_score is not None:
                return api_score, True
        if self._arabic_failed:
            return None, False
        if self._arabic_pipeline is None:
            try:
                loop = asyncio.get_running_loop()
                self._arabic_pipeline = await loop.run_in_executor(
                    None, self._load_arabic
                )
            except Exception as e:
                logger.warning("A4 arabic model load failed: %s", e)
                self._arabic_failed = True
                return None, False
        try:
            loop = asyncio.get_running_loop()
            res = await loop.run_in_executor(
                None, lambda: self._arabic_pipeline(text)
            )
            # Negative sentiment → higher fake probability proxy
            return self._extract_fake_score(res, fake_label_hints=("neg", "negative")), True
        except Exception as e:
            logger.debug("A4 arabic inference failed: %s", e)
            return None, False

    @staticmethod
    def _load_english():
        from transformers import pipeline

        return pipeline(
            "text-classification",
            model="XSY/albert-base-v2-fakenews-discriminator",
            top_k=None,
        )

    @staticmethod
    def _load_arabic():
        from transformers import pipeline

        return pipeline(
            "sentiment-analysis",
            model="CAMeL-Lab/bert-base-arabic-camelbert-msa-sentiment",
            top_k=None,
        )

    async def _call_hf_api(self, model_id: str, text: str) -> Optional[float]:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.post(
                    f"https://api-inference.huggingface.co/models/{model_id}",
                    headers={"Authorization": f"Bearer {self.hf_token}"},
                    json={"inputs": text[:480]},
                )
                if resp.status_code != 200:
                    return None
                data = resp.json()
                if isinstance(data, list) and data:
                    inner = data[0] if isinstance(data[0], list) else data
                    return self._extract_fake_score(
                        inner, fake_label_hints=("fake", "neg", "negative", "label_1", "1")
                    )
        except Exception:
            return None
        return None

    @staticmethod
    def _extract_fake_score(prediction, fake_label_hints: tuple[str, ...]) -> Optional[float]:
        if isinstance(prediction, list) and prediction and isinstance(prediction[0], list):
            prediction = prediction[0]
        if not prediction:
            return None
        for entry in prediction:
            if not isinstance(entry, dict):
                continue
            label = str(entry.get("label", "")).lower()
            score = float(entry.get("score", 0.0))
            for hint in fake_label_hints:
                if hint in label:
                    return score
        # Fallback: highest-confidence label
        try:
            top = max(prediction, key=lambda x: x.get("score", 0))
            return float(top.get("score", 0.0))
        except Exception:
            return None

    @staticmethod
    def _detect_patterns(text: str) -> list[str]:
        flags: list[str] = []
        for name, regex in PATTERN_SIGNALS.items():
            if regex is None:
                continue
            if regex.search(text):
                flags.append(name)
        if not re.search(r"\b\d{4}\b|\d{1,2}/\d{1,2}", text):
            flags.append("no_date")
        if not re.search(r"(قال|أكد|صرح|أعلن|بحسب|وفقاً)", text):
            flags.append("no_sources")
        return flags

    @staticmethod
    def _heuristic_score(text: str, patterns: list[str]) -> float:
        if not text:
            return 0.5
        score = 0.4
        score += min(0.4, len(patterns) * 0.07)
        if text.count("!") > 3:
            score += 0.05
        return min(1.0, score)

    @staticmethod
    def _classify_confidence(eng_used: bool, ar_used: bool, pattern_count: int) -> ConfidenceLevel:
        if eng_used and ar_used:
            return ConfidenceLevel.HIGH
        if eng_used or ar_used:
            return ConfidenceLevel.MEDIUM
        if pattern_count >= 3:
            return ConfidenceLevel.MEDIUM
        return ConfidenceLevel.LOW

    def _timeout(self, start: float) -> AgentResult:
        return AgentResult(
            agent=self.agent_id,
            score=0.5,
            confidence=ConfidenceLevel.TIMEOUT,
            evidence=["agent timeout"],
            raw={},
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode="fallback",
        )

    def _fallback(self, text: str, start: float, error: str = "") -> AgentResult:
        patterns = self._detect_patterns(text or "")
        return AgentResult(
            agent=self.agent_id,
            score=self._heuristic_score(text or "", patterns),
            confidence=ConfidenceLevel.INSUFFICIENT_DATA,
            evidence=patterns + ([f"error:{error[:80]}"] if error else []),
            raw={"patterns": patterns, "fallback": True},
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode="fallback",
        )
