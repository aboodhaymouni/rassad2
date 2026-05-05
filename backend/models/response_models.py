"""Pydantic response models for the RASAD API.

Includes the verdict label enum, individual agent results, and the final
synthesized verdict returned to the frontend.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class VerdictLabel(str, Enum):
    """Final verdict labels produced by the verdict engine (A6).

    Values map to user-facing badges in the frontend; each label has a
    distinct color in tailwind.config.ts.
    """

    VERIFIED = "VERIFIED"
    FALSE = "FALSE"
    MISLEADING = "MISLEADING"
    AI_GENERATED = "AI_GENERATED"
    MANIPULATED = "MANIPULATED"
    OLD_NEWS = "OLD_NEWS"
    UNVERIFIED = "UNVERIFIED"
    DUPLICATE = "DUPLICATE"
    HIGH_RISK = "HIGH_RISK"


class ConfidenceLevel(str, Enum):
    """Per-agent confidence indicator."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INSUFFICIENT_DATA = "insufficient_data"
    TIMEOUT = "timeout"


class AgentResult(BaseModel):
    """Standardized output from a single agent (A1–A5)."""

    agent: str = Field(..., description="Agent identifier, e.g. 'a1_arabic_nlp'")
    score: float = Field(..., ge=0.0, le=1.0, description="Risk score 0..1")
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM
    evidence: list[str] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)
    elapsed_ms: int = 0
    mode: str = Field(default="real", description="'real' | 'demo' | 'fallback'")


class FinalVerdict(BaseModel):
    """Top-level response returned by the orchestrator."""

    id: str
    verdict: VerdictLabel
    confidence: int = Field(..., ge=0, le=100)
    arabic_explanation: str
    english_explanation: str = ""
    agent_breakdown: dict[str, AgentResult] = Field(default_factory=dict)
    sources: list[str] = Field(default_factory=list)
    processing_time_ms: int = 0
    content_type: str = "text"
    content_hash: Optional[str] = None
    weighted_score: float = 0.0
    mode: str = Field(default="real", description="'real' | 'demo' | 'mixed'")
    cached: bool = False
    created_at: str = Field(default_factory=_now_iso)


class HealthResponse(BaseModel):
    """Health-check payload for /api/v1/health."""

    status: str = "ok"
    agents: int = 6
    version: str = "1.0.0"
    services: dict[str, str] = Field(default_factory=dict)
    environment: str = "development"


class MonitorItem(BaseModel):
    """Single item in the live monitoring feed."""

    id: str
    title: str
    summary: str = ""
    url: str = ""
    source_name: str = ""
    verdict: Optional[VerdictLabel] = None
    confidence: int = 0
    published_at: str = ""
    flagged: bool = False
