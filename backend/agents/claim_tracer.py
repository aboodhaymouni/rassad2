"""A5 — Claim Tracer Agent.

Maps the propagation timeline of a claim using A3 (ReferenceChecker)
matches: identifies the earliest source, computes how far back the claim
goes, and credits the origin against a domain-credibility table.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse

from models.response_models import AgentResult, ConfidenceLevel

logger = logging.getLogger(__name__)


DOMAIN_CREDIBILITY: dict[str, float] = {
    "petra.gov.jo": 0.98,
    "bbc.co.uk": 0.95,
    "bbci.co.uk": 0.95,
    "aljazeera.net": 0.92,
    "alarabiya.net": 0.88,
    "france24.com": 0.86,
    "alghad.com": 0.80,
    "alrai.com": 0.78,
    "rt.com": 0.65,
    "arabic.rt.com": 0.65,
    "jo24.net": 0.65,
    "dw.com": 0.86,
}


class ClaimTracerAgent:
    """A5 — origin and propagation analysis."""

    def __init__(self, timeout_seconds: float = 6.0) -> None:
        self.agent_id = "a5_claim_tracer"
        self.timeout = timeout_seconds

    async def analyze(
        self,
        text: str,
        reference_matches: Optional[list[dict[str, Any]]] = None,
    ) -> AgentResult:
        start = time.perf_counter()
        try:
            return await asyncio.wait_for(
                self._analyze(text, reference_matches or [], start),
                timeout=self.timeout,
            )
        except asyncio.TimeoutError:
            return self._timeout(start)
        except Exception as e:
            logger.exception("A5 error: %s", e)
            return self._fallback(start, error=str(e))

    async def _analyze(
        self,
        text: str,
        matches: list[dict[str, Any]],
        start: float,
    ) -> AgentResult:
        if not matches:
            return AgentResult(
                agent=self.agent_id,
                score=0.5,
                confidence=ConfidenceLevel.INSUFFICIENT_DATA,
                evidence=["no reference matches to trace"],
                raw={"timeline": [], "origin": None, "date_diff_days": None},
                elapsed_ms=int((time.perf_counter() - start) * 1000),
                mode="real",
            )

        sortable = []
        for m in matches:
            pub = m.get("pub_date")
            try:
                if isinstance(pub, str):
                    pub_dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                elif isinstance(pub, datetime):
                    pub_dt = pub if pub.tzinfo else pub.replace(tzinfo=timezone.utc)
                else:
                    continue
            except Exception:
                continue
            sortable.append((pub_dt, m))

        if not sortable:
            return AgentResult(
                agent=self.agent_id,
                score=0.5,
                confidence=ConfidenceLevel.INSUFFICIENT_DATA,
                evidence=["matches lacked publication dates"],
                raw={"timeline": [], "origin": None},
                elapsed_ms=int((time.perf_counter() - start) * 1000),
                mode="real",
            )

        sortable.sort(key=lambda x: x[0])
        origin_dt, origin = sortable[0]
        latest_dt, _ = sortable[-1]
        timeline = [
            {
                "source": m.get("source_name") or m.get("source") or "unknown",
                "url": m.get("url", ""),
                "pub_date": dt.isoformat(),
                "domain": (m.get("domain") or self._domain_of(m.get("url", ""))).lower(),
            }
            for dt, m in sortable
        ]
        now = datetime.now(timezone.utc)
        date_diff_days = (now - origin_dt).days
        spread_days = (latest_dt - origin_dt).days

        origin_domain = (origin.get("domain") or self._domain_of(origin.get("url", ""))).lower()
        origin_credibility = DOMAIN_CREDIBILITY.get(origin_domain, 0.55)

        evidence = [
            f"first_published:{origin_dt.date().isoformat()}",
            f"origin_source:{origin.get('source_name','unknown')}",
            f"sources_count:{len(sortable)}",
        ]
        if date_diff_days > 180:
            evidence.append("old_news_candidate")
        if spread_days > 30:
            evidence.append(f"spread_window_days:{spread_days}")

        return AgentResult(
            agent=self.agent_id,
            score=round(origin_credibility, 4),
            confidence=(
                ConfidenceLevel.HIGH if origin_credibility >= 0.85
                else ConfidenceLevel.MEDIUM if origin_credibility >= 0.65
                else ConfidenceLevel.LOW
            ),
            evidence=evidence,
            raw={
                "origin": {
                    "source_name": origin.get("source_name"),
                    "url": origin.get("url"),
                    "pub_date": origin_dt.isoformat(),
                    "domain": origin_domain,
                    "credibility": origin_credibility,
                },
                "timeline": timeline[:25],
                "date_diff_days": date_diff_days,
                "spread_days": spread_days,
            },
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode="real",
        )

    @staticmethod
    def _domain_of(url: str) -> str:
        try:
            netloc = urlparse(url).netloc.lower()
            if netloc.startswith("www."):
                netloc = netloc[4:]
            return netloc
        except Exception:
            return ""

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

    def _fallback(self, start: float, error: str = "") -> AgentResult:
        return AgentResult(
            agent=self.agent_id,
            score=0.5,
            confidence=ConfidenceLevel.INSUFFICIENT_DATA,
            evidence=[f"error:{error[:80]}"] if error else [],
            raw={"fallback": True},
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode="fallback",
        )
