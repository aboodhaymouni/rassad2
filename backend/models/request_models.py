"""Pydantic request models for the RASAD API."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class VerifyURLRequest(BaseModel):
    """Verify a news article by URL."""

    url: HttpUrl
    priority: str = Field(default="normal", pattern="^(low|normal|high)$")
    language: str = Field(default="auto", pattern="^(auto|ar|en)$")
    include_breakdown: bool = True


class VerifyTextRequest(BaseModel):
    """Verify a free-text claim."""

    text: str = Field(..., min_length=10, max_length=50000)
    language: str = Field(default="auto", pattern="^(auto|ar|en)$")
    include_breakdown: bool = True


class VerifyMediaRequest(BaseModel):
    """Verify a media file (image/video). Used as JSON metadata alongside the multipart upload."""

    context_text: Optional[str] = Field(default=None, max_length=2000)
    media_type: str = Field(default="image", pattern="^(image|video|audio)$")
    language: str = Field(default="auto", pattern="^(auto|ar|en)$")
    include_breakdown: bool = True
