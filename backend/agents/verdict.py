"""A6 — Verdict Engine.

Synthesizes the per-agent results into a single FinalVerdict using a
weighted score and a deterministic classification ladder, then asks
Gemini 1.5 Pro for a 3-sentence Arabic explanation. Falls back to
templated Arabic strings if Gemini is unreachable.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from typing import Optional

from models.response_models import (
    AgentResult,
    ConfidenceLevel,
    FinalVerdict,
    VerdictLabel,
)

logger = logging.getLogger(__name__)


# Weights are intentionally aligned with prompt.md STEP 11.
WEIGHTS = {
    "a3_reference": 0.30,
    "a4_ml_model": 0.25,
    "a1_arabic_nlp": 0.20,
    "a5_claim_trace": 0.15,
    "a2_media": 0.10,
}

ARABIC_FALLBACK_TEMPLATES = {
    VerdictLabel.VERIFIED: "تم التحقق من صحة هذا المحتوى عبر مصادر موثوقة متعددة.",
    VerdictLabel.FALSE: "هذا المحتوى كاذب ولا أساس له في المصادر الموثوقة.",
    VerdictLabel.MISLEADING: "هذا المحتوى مضلل ويحتوي على معلومات منقوصة أو مشوهة.",
    VerdictLabel.AI_GENERATED: "تم الكشف عن مؤشرات قوية على أن هذا المحتوى مولّد بالذكاء الاصطناعي.",
    VerdictLabel.MANIPULATED: "تم اكتشاف تلاعب أو تعديل في هذا المحتوى الأصلي.",
    VerdictLabel.OLD_NEWS: "هذا خبر قديم يتم تداوله من جديد كأنه حديث.",
    VerdictLabel.HIGH_RISK: "هذا المحتوى غير موثق وقد يكون خطيراً إذا انتشر.",
    VerdictLabel.UNVERIFIED: "لا يمكن التحقق من هذا المحتوى بشكل قاطع في الوقت الحالي.",
    VerdictLabel.DUPLICATE: "هذا المحتوى تم تحليله مسبقاً والنتيجة مخزّنة.",
}


class VerdictEngine:
    """A6 — final verdict synthesizer."""

    def __init__(self, timeout_seconds: float = 12.0) -> None:
        self.agent_id = "a6_verdict_engine"
        self.timeout = timeout_seconds
        self.gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
        self._gemini_model = None
        self._gemini_failed = not self.gemini_key

    async def synthesize(
        self,
        a1: AgentResult,
        a3: AgentResult,
        a4: AgentResult,
        a5: AgentResult,
        content_text: str,
        a2: Optional[AgentResult] = None,
    ) -> FinalVerdict:
        start = time.perf_counter()

        weighted = self._weighted_score(a1, a3, a4, a5, a2)
        verdict_label = self._classify(a1, a3, a4, a5, a2, weighted)
        confidence = self._confidence_int(a1, a3, a4, a5, a2)

        # Build sources list from A3 matches
        sources = []
        for m in (a3.raw.get("matches") or [])[:6]:
            url = m.get("url")
            if url:
                sources.append(url)

        # Mode aggregation
        modes = {a.mode for a in [a1, a3, a4, a5] + ([a2] if a2 else []) if a is not None}
        if modes == {"real"}:
            run_mode = "real"
        elif "real" in modes:
            run_mode = "mixed"
        else:
            run_mode = "demo"

        explanation = await self._explain(
            verdict_label, a1, a3, a4, a5, a2, content_text
        )

        breakdown = {
            "a1_arabic_nlp": a1,
            "a3_reference": a3,
            "a4_ml_fakenews": a4,
            "a5_claim_tracer": a5,
        }
        if a2 is not None:
            breakdown["a2_media_authenticity"] = a2

        return FinalVerdict(
            id=str(uuid.uuid4()),
            verdict=verdict_label,
            confidence=confidence,
            arabic_explanation=explanation,
            english_explanation="",
            agent_breakdown=breakdown,
            sources=sources,
            processing_time_ms=int((time.perf_counter() - start) * 1000),
            content_type="text",
            weighted_score=round(weighted, 4),
            mode=run_mode,
            cached=False,
        )

    @staticmethod
    def _weighted_score(
        a1: AgentResult,
        a3: AgentResult,
        a4: AgentResult,
        a5: AgentResult,
        a2: Optional[AgentResult],
    ) -> float:
        # A3.score in our schema is "credibility" (high = trusted), so we
        # invert it to a "risk" score (high = suspicious) for the weighted sum.
        a3_risk = 1.0 - a3.score
        a5_risk = 1.0 - a5.score

        if a2 is not None:
            total = (
                WEIGHTS["a1_arabic_nlp"] * a1.score
                + WEIGHTS["a3_reference"] * a3_risk
                + WEIGHTS["a4_ml_model"] * a4.score
                + WEIGHTS["a5_claim_trace"] * a5_risk
                + WEIGHTS["a2_media"] * a2.score
            )
        else:
            # No media → renormalize the four remaining weights to sum to 1.0
            denom = 1.0 - WEIGHTS["a2_media"]
            total = (
                (WEIGHTS["a1_arabic_nlp"] / denom) * a1.score
                + (WEIGHTS["a3_reference"] / denom) * a3_risk
                + (WEIGHTS["a4_ml_model"] / denom) * a4.score
                + (WEIGHTS["a5_claim_trace"] / denom) * a5_risk
            )
        return float(min(1.0, max(0.0, total)))

    @staticmethod
    def _classify(
        a1: AgentResult,
        a3: AgentResult,
        a4: AgentResult,
        a5: AgentResult,
        a2: Optional[AgentResult],
        weighted: float,
    ) -> VerdictLabel:
        a3_matches = len(a3.raw.get("matches") or [])
        date_diff = a5.raw.get("date_diff_days") or 0

        # A2 strong signals
        if a2 is not None:
            if a2.score >= 0.75 and a2.confidence in (
                ConfidenceLevel.HIGH,
                ConfidenceLevel.MEDIUM,
            ):
                if a2.raw.get("ai_generated_likely"):
                    return VerdictLabel.AI_GENERATED
                if a2.raw.get("manipulation_detected"):
                    return VerdictLabel.MANIPULATED

        # 1. Strong VERIFIED
        if a3.score >= 0.85 and a3_matches >= 2 and weighted < 0.45:
            return VerdictLabel.VERIFIED
        # 2. Strong FALSE
        if a4.score >= 0.75 and a3.score < 0.25:
            return VerdictLabel.FALSE
        # 3. OLD_NEWS
        if date_diff > 180 and a3.score >= 0.5:
            return VerdictLabel.OLD_NEWS
        # 4. MISLEADING strong
        if a4.score >= 0.65 and a1.score >= 0.6:
            return VerdictLabel.MISLEADING
        # 5. HIGH_RISK
        if a3.score < 0.30 and a4.score >= 0.55:
            return VerdictLabel.HIGH_RISK
        # 6. weighted score band
        if weighted >= 0.55:
            return VerdictLabel.MISLEADING
        # 7. low weighted but matches → VERIFIED weak
        if weighted < 0.35 and a3_matches >= 1 and a3.score >= 0.7:
            return VerdictLabel.VERIFIED
        return VerdictLabel.UNVERIFIED

    @staticmethod
    def _confidence_int(
        a1: AgentResult,
        a3: AgentResult,
        a4: AgentResult,
        a5: AgentResult,
        a2: Optional[AgentResult],
    ) -> int:
        agents = [a1, a3, a4, a5] + ([a2] if a2 else [])
        if not agents:
            return 0
        # Use the *highest* score to estimate certainty
        max_score = max(a.score for a in agents)
        # Also factor confidence levels into a small bonus
        bonus = 0.0
        for a in agents:
            if a.confidence == ConfidenceLevel.HIGH:
                bonus += 0.08
            elif a.confidence == ConfidenceLevel.MEDIUM:
                bonus += 0.04
        return int(min(100, round((max_score + bonus) * 100)))

    async def _explain(
        self,
        label: VerdictLabel,
        a1: AgentResult,
        a3: AgentResult,
        a4: AgentResult,
        a5: AgentResult,
        a2: Optional[AgentResult],
        content: str,
    ) -> str:
        if not self.gemini_key or self._gemini_failed:
            return ARABIC_FALLBACK_TEMPLATES.get(label, ARABIC_FALLBACK_TEMPLATES[VerdictLabel.UNVERIFIED])
        try:
            return await asyncio.wait_for(
                self._call_gemini(label, a1, a3, a4, a5, a2, content),
                timeout=15.0,
            )
        except asyncio.TimeoutError:
            logger.warning("Gemini explanation timed out (>15s)")
            return ARABIC_FALLBACK_TEMPLATES.get(label, ARABIC_FALLBACK_TEMPLATES[VerdictLabel.UNVERIFIED])
        except Exception as e:
            logger.warning("Gemini explanation failed: %s (%s)", type(e).__name__, e)
            return ARABIC_FALLBACK_TEMPLATES.get(label, ARABIC_FALLBACK_TEMPLATES[VerdictLabel.UNVERIFIED])

    async def _call_gemini(
        self,
        label: VerdictLabel,
        a1: AgentResult,
        a3: AgentResult,
        a4: AgentResult,
        a5: AgentResult,
        a2: Optional[AgentResult],
        content: str,
    ) -> str:
        loop = asyncio.get_running_loop()
        model = self._get_gemini_model()
        if model is None:
            return ARABIC_FALLBACK_TEMPLATES[label]

        a3_matches = len(a3.raw.get("matches") or [])
        a2_section = ""
        if a2 is not None:
            a2_section = f"- نتيجة فحص الوسائط: {a2.score:.0%}\n"

        prompt = (
            "أنت محلل أخبار متخصص يعمل ضمن منصة RASAD للتحقق من الأخبار العربية. "
            "بناءً على نتائج التحليل التالية:\n"
            f"- نتيجة تحليل النص العربي: {a1.score:.0%}\n"
            f"- نتيجة التحقق من المصادر: {a3.score:.0%} — وجدنا {a3_matches} مصدر مطابق\n"
            f"- نتيجة نموذج الأخبار الكاذبة: {a4.score:.0%}\n"
            f"- نتيجة تتبّع الادعاء: {a5.score:.0%}\n"
            f"{a2_section}"
            f"- الحكم النهائي: {label.value}\n\n"
            "اكتب شرحاً واضحاً بالعربية الفصحى في 3 جمل فقط يوضح:\n"
            "1) ما هو حكم هذا المحتوى\n"
            "2) ما الدليل الرئيسي على ذلك\n"
            "3) ماذا يجب على القارئ أن يفعل\n\n"
            "لا تستخدم markdown. لا تستخدم نقاط ترقيم. فقط 3 جمل عربية متتالية."
        )

        try:
            response = await loop.run_in_executor(
                None, lambda: model.generate_content(prompt)
            )
            text = (response.text or "").strip()
            if text and len(text) > 20:
                return text
        except Exception as e:
            logger.warning("Gemini generate_content error: %s", e)
        return ARABIC_FALLBACK_TEMPLATES[label]

    def _get_gemini_model(self):
        if self._gemini_model is not None or self._gemini_failed:
            return self._gemini_model
        try:
            import google.generativeai as genai

            genai.configure(api_key=self.gemini_key)
            self._gemini_model = genai.GenerativeModel(
                os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            )
        except Exception as e:
            logger.warning("Gemini client init failed: %s", e)
            self._gemini_failed = True
            self._gemini_model = None
        return self._gemini_model
