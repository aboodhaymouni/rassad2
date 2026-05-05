"""Persistence layer.

Primary path is Supabase REST (when credentials are configured); falls back
to an in-memory store so the demo runs without any external DB.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

from models.response_models import FinalVerdict

logger = logging.getLogger(__name__)


class FirestoreClient:
    """Despite the name (mandated by prompt.md), this writes to Supabase REST.

    Behaviour:
    - If SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, INSERT/SELECT against
      the `verifications` table over the REST endpoint.
    - Otherwise, keep verdicts in memory (lost on restart).
    """

    def __init__(self) -> None:
        self.supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self._enabled = bool(self.supabase_url and self.service_key)
        self._memory: dict[str, FinalVerdict] = {}
        self._lock = asyncio.Lock()
        if self._enabled:
            logger.info("Persistence: Supabase REST at %s", self.supabase_url)
        else:
            logger.info("Persistence: in-memory store (set SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY to enable Supabase)")

    async def save(self, verdict: FinalVerdict, user_id: Optional[str] = None) -> None:
        async with self._lock:
            self._memory[verdict.id] = verdict
        if not self._enabled:
            return
        try:
            payload = self._to_supabase_row(verdict, user_id)
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(
                    f"{self.supabase_url}/rest/v1/verifications",
                    headers=self._headers(),
                    json=payload,
                )
                if resp.status_code >= 400:
                    logger.warning("Supabase insert failed (%s): %s", resp.status_code, resp.text[:300])
        except Exception as e:
            logger.warning("Supabase save error: %s", e)

    async def get(self, verdict_id: str) -> Optional[FinalVerdict]:
        async with self._lock:
            cached = self._memory.get(verdict_id)
        if cached is not None:
            return cached
        if not self._enabled:
            return None
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self.supabase_url}/rest/v1/verifications",
                    params={"id": f"eq.{verdict_id}", "select": "*"},
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    rows = resp.json()
                    if rows:
                        return self._from_supabase_row(rows[0])
        except Exception as e:
            logger.warning("Supabase get error: %s", e)
        return None

    async def list_recent(self, limit: int = 20) -> list[FinalVerdict]:
        async with self._lock:
            mem_items = sorted(
                self._memory.values(), key=lambda v: v.created_at, reverse=True
            )[:limit]
        if mem_items or not self._enabled:
            return mem_items
        return []

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    @staticmethod
    def _to_supabase_row(verdict: FinalVerdict, user_id: Optional[str]) -> dict:
        # Map 9-label verdict → 4-label legacy enum stored in DB CHECK constraint
        legacy = _map_to_legacy_verdict(verdict.verdict.value)
        return {
            "id": verdict.id,
            "user_id": user_id,
            "input_text": "",  # filled in by main.py before save
            "input_url": None,
            "kind": verdict.content_type,
            "verdict": legacy,
            "confidence": int(verdict.confidence),
            "explanation": verdict.arabic_explanation,
            "sources": verdict.sources,
            "model": "rasad-6agent-v1",
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }

    @staticmethod
    def _from_supabase_row(row: dict) -> FinalVerdict:
        from models.response_models import VerdictLabel

        try:
            label = VerdictLabel(row.get("verdict", "UNVERIFIED").upper())
        except Exception:
            label = VerdictLabel.UNVERIFIED
        return FinalVerdict(
            id=row["id"],
            verdict=label,
            confidence=int(row.get("confidence") or 0),
            arabic_explanation=row.get("explanation") or "",
            content_type=row.get("kind") or "text",
            sources=row.get("sources") or [],
            created_at=row.get("created_at") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        )


def _map_to_legacy_verdict(label: str) -> str:
    """Map RASAD 9-label verdicts to the legacy 4-label CHECK constraint."""
    upper = label.upper()
    if upper in ("VERIFIED",):
        return "trusted"
    if upper in ("FALSE", "AI_GENERATED", "MANIPULATED"):
        return "fake"
    if upper in ("MISLEADING", "OLD_NEWS", "HIGH_RISK"):
        return "suspicious"
    return "uncertain"
