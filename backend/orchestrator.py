"""Multi-agent orchestrator for the RASAD verification pipeline.

Pipeline order:
1. Cache check (SHA256 of normalized content)
2. Parallel: A1 (Arabic NLP), A3 (Reference), A4 (ML Fake News)
3. Conditional: A2 (Media Auth) — only if media bytes are present
4. Sequential: A5 (Claim Tracer) — needs A3.matches
5. A6 synthesizes the FinalVerdict
6. Cache write + return
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

from agents import (
    ArabicNLPAgent,
    ClaimTracerAgent,
    MLFakeNewsAgent,
    MediaAuthAgent,
    ReferenceCheckerAgent,
    VerdictEngine,
)
from models.response_models import (
    AgentResult,
    ConfidenceLevel,
    FinalVerdict,
    VerdictLabel,
)
from services.firestore_client import FirestoreClient
from services.redis_cache import RedisCache

logger = logging.getLogger(__name__)


class MainOrchestrator:
    """Coordinates the 6-agent pipeline end-to-end."""

    def __init__(
        self,
        cache: Optional[RedisCache] = None,
        store: Optional[FirestoreClient] = None,
    ) -> None:
        self.cache = cache or RedisCache()
        self.store = store or FirestoreClient()
        self.a1 = ArabicNLPAgent()
        self.a2 = MediaAuthAgent()
        self.a3 = ReferenceCheckerAgent()
        self.a4 = MLFakeNewsAgent()
        self.a5 = ClaimTracerAgent()
        self.a6 = VerdictEngine()

    async def run_pipeline(
        self,
        content: str,
        content_type: str = "text",
        media_bytes: Optional[bytes] = None,
        media_filename: str = "",
        media_url: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> FinalVerdict:
        start = time.perf_counter()

        # 1) Cache check
        content_hash = RedisCache.generate_hash(content)
        try:
            cached = await self.cache.get_cached(content_hash)
            if cached is not None:
                cached.cached = True
                cached.verdict = VerdictLabel.DUPLICATE
                cached.processing_time_ms = int((time.perf_counter() - start) * 1000)
                return cached
        except Exception as e:
            logger.debug("Cache lookup error: %s", e)

        # 2) Parallel: A1, A3, A4
        a1_task = asyncio.create_task(self.a1.analyze(content))
        a3_task = asyncio.create_task(self.a3.analyze(content))
        a4_task = asyncio.create_task(self.a4.analyze(content))

        a1, a3, a4 = await self._gather_safely(a1_task, a3_task, a4_task)

        # 3) A2 (conditional)
        a2: Optional[AgentResult] = None
        if media_bytes or media_url:
            try:
                a2 = await self.a2.analyze(
                    media_bytes=media_bytes,
                    filename=media_filename,
                    media_url=media_url,
                )
            except Exception as e:
                logger.warning("A2 failed: %s", e)
                a2 = self._fallback_result("a2_media_authenticity")

        # 4) A5 (sequential, needs A3.matches)
        try:
            a5 = await self.a5.analyze(
                text=content,
                reference_matches=a3.raw.get("matches") if a3 else None,
            )
        except Exception as e:
            logger.warning("A5 failed: %s", e)
            a5 = self._fallback_result("a5_claim_tracer")

        # 5) A6 synthesizes
        try:
            verdict = await self.a6.synthesize(a1, a3, a4, a5, content, a2)
        except Exception as e:
            logger.exception("A6 synthesis failed: %s", e)
            verdict = self._emergency_verdict(a1, a3, a4, a5, a2, content_hash, content_type)

        verdict.processing_time_ms = int((time.perf_counter() - start) * 1000)
        verdict.content_type = content_type
        verdict.content_hash = content_hash
        verdict.cached = False

        # 6) Persist + cache
        try:
            await self.cache.set_cache(content_hash, verdict)
        except Exception as e:
            logger.debug("Cache write failed: %s", e)
        try:
            await self.store.save(verdict, user_id=user_id)
        except Exception as e:
            logger.debug("Store save failed: %s", e)
        try:
            await self.cache.increment_counter("verifications_total")
            await self.cache.increment_counter(f"verdict:{verdict.verdict.value}")
        except Exception:
            pass

        return verdict

    async def _gather_safely(self, *tasks: asyncio.Task) -> list[AgentResult]:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        normalized: list[AgentResult] = []
        agent_ids = ["a1_arabic_nlp", "a3_reference", "a4_ml_fakenews"]
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                logger.warning("Agent %s crashed: %s", agent_ids[i], r)
                normalized.append(self._fallback_result(agent_ids[i], error=str(r)))
            else:
                normalized.append(r)
        return normalized

    @staticmethod
    def _fallback_result(agent_id: str, error: str = "") -> AgentResult:
        return AgentResult(
            agent=agent_id,
            score=0.5,
            confidence=ConfidenceLevel.INSUFFICIENT_DATA,
            evidence=[f"error:{error[:80]}"] if error else ["pipeline fallback"],
            raw={"fallback": True},
            elapsed_ms=0,
            mode="fallback",
        )

    @staticmethod
    def _emergency_verdict(
        a1: AgentResult,
        a3: AgentResult,
        a4: AgentResult,
        a5: AgentResult,
        a2: Optional[AgentResult],
        content_hash: str,
        content_type: str,
    ) -> FinalVerdict:
        import uuid

        return FinalVerdict(
            id=str(uuid.uuid4()),
            verdict=VerdictLabel.UNVERIFIED,
            confidence=30,
            arabic_explanation="حدث خطأ أثناء تحليل المحتوى، يرجى المحاولة مرة أخرى.",
            agent_breakdown={
                "a1_arabic_nlp": a1,
                "a3_reference": a3,
                "a4_ml_fakenews": a4,
                "a5_claim_tracer": a5,
                **({"a2_media_authenticity": a2} if a2 else {}),
            },
            sources=[],
            processing_time_ms=0,
            content_type=content_type,
            content_hash=content_hash,
            mode="fallback",
            cached=False,
        )

    async def health(self) -> dict:
        return {
            "a1_arabic_nlp": "ok",
            "a2_media_authenticity": "ok",
            "a3_reference": "ok",
            "a4_ml_fakenews": "ok",
            "a5_claim_tracer": "ok",
            "a6_verdict_engine": "ok" if self.a6.gemini_key else "templated",
        }
