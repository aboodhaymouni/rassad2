"""A2 — Media Authenticity Agent.

Detects AI-generated/manipulated images using:
1. Hive Moderation API (when HIVE_API_KEY is configured)
2. EXIF metadata signals
3. Filename/format heuristics
4. Deterministic hash-based scoring as a last-resort demo mode.

The agent NEVER crashes the pipeline — even with no media bytes it returns
a graceful insufficient_data verdict.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from typing import Optional

from models.response_models import AgentResult, ConfidenceLevel
from services.media_processor import MediaProcessor, MediaSnapshot

logger = logging.getLogger(__name__)


class MediaAuthAgent:
    """A2 — multi-source image authenticity assessment.

    Provider order:
    1. Hive Moderation API (when HIVE_API_KEY is set) — paid, top quality.
    2. Local HuggingFace AI-vs-real classifier (Organika/sdxl-detector or
       umm-maybe/AI-image-detector) — free, runs on CPU.
    3. EXIF + filename + file-size heuristics — always available, no model.
    """

    AI_DETECTOR_MODEL = os.getenv("A2_AI_DETECTOR_MODEL", "Organika/sdxl-detector")

    def __init__(self, timeout_seconds: float = 30.0) -> None:
        self.agent_id = "a2_media_authenticity"
        self.timeout = timeout_seconds
        self.hive_key = os.getenv("HIVE_API_KEY", "").strip()
        self.hf_token = os.getenv("HF_API_TOKEN", "").strip()
        self.processor = MediaProcessor()
        self._local_detector = None
        self._local_failed = False

    async def analyze(
        self,
        media_bytes: Optional[bytes] = None,
        filename: str = "",
        media_url: Optional[str] = None,
    ) -> AgentResult:
        start = time.perf_counter()
        try:
            return await asyncio.wait_for(
                self._analyze(media_bytes, filename, media_url, start),
                timeout=self.timeout,
            )
        except asyncio.TimeoutError:
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
            logger.exception("A2 error: %s", e)
            return self._fallback(start, error=str(e))

    async def _analyze(
        self,
        media_bytes: Optional[bytes],
        filename: str,
        media_url: Optional[str],
        start: float,
    ) -> AgentResult:
        if not media_bytes and not media_url:
            return AgentResult(
                agent=self.agent_id,
                score=0.5,
                confidence=ConfidenceLevel.INSUFFICIENT_DATA,
                evidence=["no media supplied"],
                raw={"skipped": True},
                elapsed_ms=int((time.perf_counter() - start) * 1000),
                mode="fallback",
            )

        snap: Optional[MediaSnapshot] = None
        evidence: list[str] = []
        if media_bytes:
            snap = self.processor.analyze(media_bytes, filename)
            if snap.has_exif:
                evidence.append(f"exif_tags:{snap.exif_count}")
            else:
                evidence.append("no_exif_metadata")
            evidence.extend(snap.suspicious_flags[:6])

        ai_score = self._heuristic_score(snap)
        mode = "fallback"

        if self.hive_key and media_bytes:
            try:
                hive = await self._call_hive(media_bytes)
                if hive is not None:
                    ai_score = hive
                    mode = "real"
                    evidence.append(f"hive_ai_score:{hive:.2f}")
            except Exception as e:
                logger.debug("Hive call failed: %s", e)

        # If no Hive, run an open-source HF detector locally
        if mode != "real" and media_bytes:
            try:
                local = await self._call_local_detector(media_bytes)
                if local is not None:
                    ai_score = (ai_score * 0.25 + local * 0.75)
                    mode = "real"
                    evidence.append(f"hf_ai_detector:{local:.2f}")
            except Exception as e:
                logger.debug("Local detector failed: %s", e)

        confidence = (
            ConfidenceLevel.HIGH if mode == "real"
            else ConfidenceLevel.MEDIUM if snap and snap.has_exif
            else ConfidenceLevel.LOW
        )

        return AgentResult(
            agent=self.agent_id,
            score=round(ai_score, 4),
            confidence=confidence,
            evidence=evidence[:10],
            raw={
                "snapshot": snap.__dict__ if snap else None,
                "manipulation_detected": ai_score >= 0.6,
                "ai_generated_likely": ai_score >= 0.7,
            },
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode=mode,
        )

    @staticmethod
    def _heuristic_score(snap: Optional[MediaSnapshot]) -> float:
        if snap is None:
            return 0.5
        score = 0.2
        if not snap.has_exif:
            score += 0.25
        flags = snap.suspicious_flags
        if any(f.startswith("editor:") for f in flags):
            score += 0.25
        if "very_small_file" in flags:
            score += 0.1
        if "webp_repackaged" in flags:
            score += 0.1
        if any(f.startswith("filename:") for f in flags):
            score += 0.15
        # Deterministic noise so identical bytes return identical score
        seed = int(snap.sha256[:8], 16) / 0xFFFFFFFF
        score += (seed - 0.5) * 0.1
        return float(min(1.0, max(0.0, score)))

    async def _call_local_detector(self, media_bytes: bytes) -> Optional[float]:
        """Run a HuggingFace AI-vs-real image classifier locally.

        Returns 0..1 where 1 = highly likely AI-generated. Loads the model
        lazily on first call (cached after that). Failures are silent —
        the heuristic score still applies.
        """
        if self._local_failed:
            return None
        if self._local_detector is None:
            try:
                loop = asyncio.get_running_loop()
                self._local_detector = await loop.run_in_executor(None, self._load_local_detector)
                logger.info("A2 local AI-detector loaded: %s", self.AI_DETECTOR_MODEL)
            except Exception as e:
                logger.warning("A2 local detector load failed: %s", e)
                self._local_failed = True
                return None
        try:
            loop = asyncio.get_running_loop()
            preds = await loop.run_in_executor(
                None, lambda: self._classify_image(media_bytes)
            )
            return self._extract_ai_score(preds)
        except Exception as e:
            logger.debug("A2 local inference failed: %s", e)
            return None

    def _load_local_detector(self):
        from transformers import pipeline

        return pipeline(
            "image-classification",
            model=self.AI_DETECTOR_MODEL,
            top_k=None,
        )

    def _classify_image(self, media_bytes: bytes):
        import io

        from PIL import Image

        with Image.open(io.BytesIO(media_bytes)) as img:
            img = img.convert("RGB")
            return self._local_detector(img)

    @staticmethod
    def _extract_ai_score(preds) -> Optional[float]:
        """Pick the AI/artificial probability from a pipeline output."""
        if not preds:
            return None
        if isinstance(preds, list) and preds and isinstance(preds[0], list):
            preds = preds[0]
        ai_keywords = ("artificial", "ai", "generated", "fake", "synthetic", "sdxl", "stable_diffusion")
        for p in preds:
            if not isinstance(p, dict):
                continue
            label = str(p.get("label", "")).lower()
            score = float(p.get("score", 0.0))
            for k in ai_keywords:
                if k in label:
                    return score
        # Fallback: 1 - probability of "real/human"
        for p in preds:
            label = str(p.get("label", "")).lower()
            score = float(p.get("score", 0.0))
            if any(h in label for h in ("real", "human", "natural", "genuine")):
                return float(max(0.0, min(1.0, 1.0 - score)))
        return None

    async def _call_hive(self, media_bytes: bytes) -> Optional[float]:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=8.0) as client:
                files = {"image": ("image.jpg", media_bytes, "image/jpeg")}
                resp = await client.post(
                    "https://api.thehive.ai/api/v2/task/sync",
                    headers={"Authorization": f"Token {self.hive_key}"},
                    files=files,
                )
                if resp.status_code != 200:
                    return None
                data = resp.json()
                outputs = data.get("status", [{}])[0].get("response", {}).get("output", [])
                if not outputs:
                    return None
                classes = outputs[0].get("classes", [])
                ai_class = next(
                    (c for c in classes if "ai_generated" in str(c.get("class", "")).lower()),
                    None,
                )
                if ai_class:
                    return float(ai_class.get("score", 0.0))
        except Exception:
            return None
        return None

    def _fallback(self, start: float, error: str = "") -> AgentResult:
        return AgentResult(
            agent=self.agent_id,
            score=0.5,
            confidence=ConfidenceLevel.INSUFFICIENT_DATA,
            evidence=[f"error:{error[:80]}"] if error else ["no media data"],
            raw={"fallback": True},
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode="fallback",
        )

    @staticmethod
    def deterministic_hash(payload: bytes) -> str:
        return hashlib.sha256(payload).hexdigest()
