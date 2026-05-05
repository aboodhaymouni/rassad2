"""Redis-backed cache for verdict deduplication.

Falls back gracefully to an in-process dict when Redis is unreachable so the
pipeline never crashes due to cache infrastructure.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from typing import Optional

try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    aioredis = None
    _REDIS_AVAILABLE = False

from models.response_models import FinalVerdict

logger = logging.getLogger(__name__)


class RedisCache:
    """Async Redis cache with transparent in-memory fallback."""

    def __init__(self, url: Optional[str] = None, ttl_seconds: int = 86400) -> None:
        self.url = url or os.getenv("REDIS_URL", "redis://localhost:6379")
        self.ttl_seconds = ttl_seconds
        self._client: Optional["aioredis.Redis"] = None
        self._fallback: dict[str, str] = {}
        self._using_fallback = not _REDIS_AVAILABLE
        self._lock = asyncio.Lock()

    async def _get_client(self) -> Optional["aioredis.Redis"]:
        if self._using_fallback or not _REDIS_AVAILABLE:
            return None
        if self._client is not None:
            return self._client
        async with self._lock:
            if self._client is not None:
                return self._client
            try:
                self._client = aioredis.from_url(
                    self.url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
                await self._client.ping()
                logger.info("Redis cache connected at %s", self.url)
            except Exception as e:
                logger.warning("Redis unavailable (%s); using in-memory cache", e)
                self._client = None
                self._using_fallback = True
        return self._client

    @staticmethod
    def generate_hash(content: str) -> str:
        """SHA256 of normalized content (lower-case, stripped)."""
        normalized = content.strip().lower().encode("utf-8", errors="ignore")
        return hashlib.sha256(normalized).hexdigest()

    async def get_cached(self, content_hash: str) -> Optional[FinalVerdict]:
        try:
            client = await self._get_client()
            payload: Optional[str]
            if client is not None:
                payload = await client.get(f"rasad:verdict:{content_hash}")
            else:
                payload = self._fallback.get(content_hash)
            if not payload:
                return None
            data = json.loads(payload)
            return FinalVerdict.model_validate(data)
        except Exception as e:
            logger.warning("Cache read failed for %s: %s", content_hash[:8], e)
            return None

    async def set_cache(
        self,
        content_hash: str,
        verdict: FinalVerdict,
        ttl: Optional[int] = None,
    ) -> None:
        try:
            payload = verdict.model_dump_json()
            ttl_actual = ttl if ttl is not None else self.ttl_seconds
            client = await self._get_client()
            if client is not None:
                await client.setex(f"rasad:verdict:{content_hash}", ttl_actual, payload)
            else:
                self._fallback[content_hash] = payload
        except Exception as e:
            logger.warning("Cache write failed for %s: %s", content_hash[:8], e)

    async def increment_counter(self, key: str) -> int:
        try:
            client = await self._get_client()
            if client is not None:
                return int(await client.incr(f"rasad:counter:{key}"))
            self._fallback[f"counter:{key}"] = str(int(self._fallback.get(f"counter:{key}", "0")) + 1)
            return int(self._fallback[f"counter:{key}"])
        except Exception:
            return 0

    async def get_counter(self, key: str) -> int:
        try:
            client = await self._get_client()
            if client is not None:
                value = await client.get(f"rasad:counter:{key}")
                return int(value) if value else 0
            return int(self._fallback.get(f"counter:{key}", "0"))
        except Exception:
            return 0

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.close()
            except Exception:
                pass
        self._client = None
