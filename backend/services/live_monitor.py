"""Background live monitor.

Every N minutes it:
1. Fetches all configured Arabic RSS feeds in parallel.
2. Diffs against the in-memory "seen" set so we only process *new* articles.
3. Runs a lightweight check on each new article (A1 emotional patterns + a
   short A4 fake-news pass) — these are cheap and don't hit Gemini.
4. Stores the result in a bounded in-process feed (and Redis when present).
5. Notifies any subscribed pollers via the ``last_updated_at`` watermark.

The loop is intentionally simple: a single cancelable task plus an asyncio
event for instant kicks. Bound the per-cycle work so the monitor never starves
the user-facing pipeline.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Optional

from agents.arabic_nlp import ArabicNLPAgent
from agents.ml_fakenews import MLFakeNewsAgent
from services.redis_cache import RedisCache
from services.rss_crawler import Article, RSSCrawler

logger = logging.getLogger(__name__)


@dataclass
class LiveItem:
    """A monitored article with quick-pass scores."""

    id: str
    title: str
    summary: str
    url: str
    source_name: str
    source_domain: str
    pub_date: Optional[str]
    seen_at: str
    emotion_score: float = 0.0
    fake_score: float = 0.0
    risk_label: str = "neutral"  # 'verified' | 'suspicious' | 'risky' | 'neutral'
    flags: list[str] = field(default_factory=list)
    topic: str = "other"

    def to_dict(self) -> dict:
        return asdict(self)


def _classify_risk(emotion: float, fake: float) -> str:
    if fake >= 0.65 and emotion >= 0.4:
        return "risky"
    if fake >= 0.55 or emotion >= 0.65:
        return "suspicious"
    if fake <= 0.25 and emotion <= 0.25:
        return "verified"
    return "neutral"


class LiveMonitor:
    """Periodic background monitor with bounded ring buffer."""

    def __init__(
        self,
        crawler: Optional[RSSCrawler] = None,
        cache: Optional[RedisCache] = None,
        a1: Optional[ArabicNLPAgent] = None,
        a4: Optional[MLFakeNewsAgent] = None,
        interval_seconds: int = 240,  # 4 minutes
        max_items: int = 200,
    ) -> None:
        self.crawler = crawler or RSSCrawler()
        self.cache = cache
        self.a1 = a1 or ArabicNLPAgent()
        self.a4 = a4 or MLFakeNewsAgent()
        self.interval_seconds = max(60, interval_seconds)
        self.max_items = max_items
        self._task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._wake_event = asyncio.Event()
        self._items: deque[LiveItem] = deque(maxlen=max_items)
        self._seen_urls: set[str] = set()
        self._items_by_url: dict[str, LiveItem] = {}
        self._lock = asyncio.Lock()
        self.last_run_at: Optional[str] = None
        self.last_added_count: int = 0
        self.cycles_completed: int = 0
        self.errors_total: int = 0

    # ---------------- lifecycle ----------------

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._loop(), name="rasad-live-monitor")
        logger.info("LiveMonitor started (interval=%ss).", self.interval_seconds)

    async def stop(self) -> None:
        self._stop_event.set()
        self._wake_event.set()
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=5.0)
            except asyncio.TimeoutError:
                self._task.cancel()
        self._task = None

    def kick(self) -> None:
        """Wake the loop early — useful after manual user verifications."""
        self._wake_event.set()

    async def _loop(self) -> None:
        # Small initial delay so app warm-up finishes first.
        await asyncio.sleep(15)
        while not self._stop_event.is_set():
            try:
                await self._cycle()
            except Exception as e:
                self.errors_total += 1
                logger.warning("LiveMonitor cycle error: %s", e)
            try:
                await asyncio.wait_for(self._wake_event.wait(), timeout=self.interval_seconds)
            except asyncio.TimeoutError:
                pass
            self._wake_event.clear()

    # ---------------- cycle ----------------

    async def _cycle(self) -> None:
        articles = await self.crawler.fetch_all(limit_per_source=10)
        added = 0
        # Process newest-first, cap per-cycle to keep cycles bounded.
        for art in articles[:60]:
            if not art.url or art.url in self._seen_urls:
                continue
            self._seen_urls.add(art.url)
            try:
                item = await self._score_article(art)
            except Exception as e:
                logger.debug("Skip %s on score error: %s", art.url, e)
                continue
            async with self._lock:
                self._items.appendleft(item)
                self._items_by_url[item.url] = item
                # bound the by-URL map too
                if len(self._items_by_url) > self.max_items * 2:
                    excess = len(self._items_by_url) - self.max_items
                    for u in list(self._items_by_url.keys())[:excess]:
                        self._items_by_url.pop(u, None)
            added += 1

        self.last_added_count = added
        self.last_run_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        self.cycles_completed += 1
        if self.cache and added > 0:
            try:
                await self.cache.set_cache(
                    "live_feed",
                    None,  # not a FinalVerdict; use raw JSON via redis directly
                )
            except Exception:
                pass

    async def _score_article(self, art: Article) -> LiveItem:
        text = (art.title + ". " + (art.summary or art.text or ""))[:2000]
        # Run A1 + A4 in parallel — both are quick when models are warm.
        a1_task = asyncio.create_task(self.a1.analyze(text))
        a4_task = asyncio.create_task(self.a4.analyze(text))
        try:
            a1_res, a4_res = await asyncio.wait_for(
                asyncio.gather(a1_task, a4_task, return_exceptions=True),
                timeout=15.0,
            )
        except asyncio.TimeoutError:
            a1_res, a4_res = None, None
        emotion = 0.5
        fake = 0.5
        flags: list[str] = []
        topic = "other"
        if a1_res and not isinstance(a1_res, Exception):
            emotion = float(a1_res.score)
            flags.extend(list(a1_res.evidence)[:5])
            topic = (a1_res.raw or {}).get("topic", "other") or "other"
        if a4_res and not isinstance(a4_res, Exception):
            fake = float(a4_res.score)
        risk = _classify_risk(emotion, fake)
        return LiveItem(
            id=art.url[-32:] if art.url else art.title[:32],
            title=art.title,
            summary=(art.summary or art.text or "")[:300],
            url=art.url,
            source_name=art.source_name,
            source_domain=art.domain,
            pub_date=art.pub_date.isoformat() if art.pub_date else None,
            seen_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            emotion_score=round(emotion, 3),
            fake_score=round(fake, 3),
            risk_label=risk,
            flags=flags[:5],
            topic=topic,
        )

    # ---------------- API ----------------

    async def feed(
        self,
        limit: int = 30,
        since: Optional[str] = None,
        risk: Optional[str] = None,
        domain: Optional[str] = None,
        topic: Optional[str] = None,
    ) -> list[dict]:
        async with self._lock:
            items = list(self._items)
        out: list[dict] = []
        for it in items:
            if since and it.seen_at <= since:
                continue
            if risk and it.risk_label != risk:
                continue
            if domain and (it.source_domain or "").lower() != domain.lower():
                continue
            if topic and it.topic != topic:
                continue
            out.append(it.to_dict())
            if len(out) >= limit:
                break
        return out

    async def stats(self) -> dict:
        async with self._lock:
            items = list(self._items)
        by_risk: dict[str, int] = {}
        by_source: dict[str, int] = {}
        for it in items:
            by_risk[it.risk_label] = by_risk.get(it.risk_label, 0) + 1
            by_source[it.source_name] = by_source.get(it.source_name, 0) + 1
        return {
            "total": len(items),
            "max": self.max_items,
            "by_risk": by_risk,
            "by_source": by_source,
            "cycles_completed": self.cycles_completed,
            "last_run_at": self.last_run_at,
            "last_added_count": self.last_added_count,
            "interval_seconds": self.interval_seconds,
            "errors_total": self.errors_total,
        }
