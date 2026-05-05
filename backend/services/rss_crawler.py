"""Concurrent Arabic RSS crawler.

Fetches a curated set of Arabic news feeds in parallel using httpx + asyncio.
Failed sources are skipped silently to keep the pipeline resilient.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import feedparser
import httpx

logger = logging.getLogger(__name__)


@dataclass
class Article:
    """Single RSS article representation."""

    title: str
    text: str
    url: str
    pub_date: Optional[datetime]
    source_name: str
    domain: str
    summary: str = ""
    metadata: dict = field(default_factory=dict)


ARABIC_SOURCES: list[dict[str, str]] = [
    {"name": "الغد", "url": "https://alghad.com/feed/"},
    {"name": "الرأي", "url": "https://alrai.com/rss.xml"},
    {"name": "بترا", "url": "https://petra.gov.jo/rss"},
    {"name": "Jo24", "url": "https://jo24.net/feed/"},
    {"name": "الجزيرة", "url": "https://www.aljazeera.net/aljazeerarss/4f51f4ea-7d92-4c1b-9b3a-b47094ee7d11/c1f46c4d-4b3b-4f3c-93b2-7d3e6f3c0e9e"},
    {"name": "BBC عربي", "url": "https://feeds.bbci.co.uk/arabic/rss.xml"},
    {"name": "العربية", "url": "https://www.alarabiya.net/feed/rss2/ar.xml"},
    {"name": "فرانس 24", "url": "https://www.france24.com/ar/rss"},
    {"name": "RT عربي", "url": "https://arabic.rt.com/rss/"},
    {"name": "DW عربي", "url": "https://rss.dw.com/rdf/rss-ar-all"},
]

DEFAULT_TIMEOUT = 8.0
DEFAULT_USER_AGENT = "RASAD-Crawler/1.0 (+https://rassad.io)"


class RSSCrawler:
    """Asynchronous fetcher for the curated Arabic feed list."""

    def __init__(
        self,
        sources: Optional[list[dict[str, str]]] = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self.sources = sources or ARABIC_SOURCES
        self.timeout = timeout

    async def fetch_all(self, limit_per_source: int = 20) -> list[Article]:
        """Fetch articles from all configured sources in parallel."""
        tasks = [self._fetch_source(s, limit_per_source) for s in self.sources]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        articles: list[Article] = []
        for r in results:
            if isinstance(r, list):
                articles.extend(r)
            elif isinstance(r, Exception):
                logger.warning("RSS source failed: %s", r)
        articles.sort(
            key=lambda a: a.pub_date or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        return articles

    async def _fetch_source(
        self,
        source: dict[str, str],
        limit: int,
    ) -> list[Article]:
        url = source["url"]
        name = source["name"]
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                headers={"User-Agent": DEFAULT_USER_AGENT},
                follow_redirects=True,
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                feed = feedparser.parse(resp.content)
        except Exception as e:
            logger.info("Skipping %s (%s): %s", name, url, e)
            return []

        domain = urlparse(url).netloc.lower()
        out: list[Article] = []
        for entry in feed.entries[:limit]:
            try:
                pub = self._parse_date(entry)
                article = Article(
                    title=str(getattr(entry, "title", "")).strip(),
                    text=self._extract_text(entry),
                    url=str(getattr(entry, "link", "")),
                    pub_date=pub,
                    source_name=name,
                    domain=domain,
                    summary=str(getattr(entry, "summary", ""))[:500],
                )
                if article.title and article.url:
                    out.append(article)
            except Exception:
                continue
        return out

    @staticmethod
    def _parse_date(entry) -> Optional[datetime]:
        for field_name in ("published_parsed", "updated_parsed"):
            t = getattr(entry, field_name, None)
            if t:
                try:
                    return datetime(*t[:6], tzinfo=timezone.utc)
                except Exception:
                    continue
        return None

    @staticmethod
    def _extract_text(entry) -> str:
        for field_name in ("summary", "description", "content"):
            value = getattr(entry, field_name, "")
            if isinstance(value, list) and value:
                value = value[0].get("value", "") if isinstance(value[0], dict) else value[0]
            if value:
                # Lightweight HTML strip
                from html.parser import HTMLParser

                class _Strip(HTMLParser):
                    def __init__(self):
                        super().__init__()
                        self.parts: list[str] = []

                    def handle_data(self, data):
                        self.parts.append(data)

                p = _Strip()
                try:
                    p.feed(str(value))
                    return " ".join(p.parts).strip()
                except Exception:
                    return str(value)[:1000]
        return ""
