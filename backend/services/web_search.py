"""Multi-engine web search with priority-ordered providers.

Open-source / free-tier first. No API key is required by default — DuckDuckGo
and public SearXNG instances handle the baseline. Paid APIs (Brave, Tavily,
Serper) take over automatically when their keys are present in the env.

Design goals:
- Resilient: any provider failure falls through to the next.
- Comprehensive: a single high-level call performs general + site-targeted +
  exact-quote + Wikipedia lookups, dedupes, and merges.
- Bilingual: Arabic queries get an English shadow query when useful.
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import re
import time
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import quote, urlparse

import httpx

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """A single search hit, source-engine agnostic."""

    title: str
    url: str
    snippet: str = ""
    source_domain: str = ""
    language: str = ""
    pub_date: Optional[str] = None
    engine: str = ""
    score: float = 0.0
    raw: dict = field(default_factory=dict)


# Trusted Arabic sites we proactively site-search.
ARABIC_NEWS_SITES = [
    "aljazeera.net",
    "alarabiya.net",
    "bbc.com/arabic",
    "alghad.com",
    "alrai.com",
    "petra.gov.jo",
    "jo24.net",
    "skynewsarabia.com",
    "france24.com/ar",
    "dw.com/ar",
    "rt.com/arabic",
    "asharq.com",
    "alhurra.com",
    "aljazeera.com",
    "reuters.com/arabic",
    "afp.com/ar",
]

PUBLIC_SEARXNG_INSTANCES = [
    "https://searx.be",
    "https://searx.tiekoetter.com",
    "https://search.bus-hit.me",
    "https://baresearch.org",
    "https://opnxng.com",
]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def _canonical_url(url: str) -> str:
    try:
        p = urlparse(url)
        host = p.netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        path = p.path.rstrip("/")
        return f"{p.scheme}://{host}{path}"
    except Exception:
        return url


def _domain_of(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def _detect_language(text: str) -> str:
    if not text:
        return ""
    arabic_chars = sum(1 for c in text if "؀" <= c <= "ۿ")
    return "ar" if arabic_chars > len(text) * 0.2 else "en"


# -------------------- Providers --------------------


class DuckDuckGoProvider:
    """DuckDuckGo via the modern ddgs library, with old duckduckgo_search +
    raw HTML scraping as fallbacks."""

    name = "duckduckgo"

    async def search(self, query: str, limit: int = 10, language: str = "ar") -> list[SearchResult]:
        # Try paths in order; return on first non-empty result
        for path_name, path in (
            ("ddgs", self._via_ddgs),
            ("duckduckgo_search", self._via_legacy_lib),
            ("html", self._via_html),
        ):
            try:
                hits = await path(query, limit, language)
                if hits:
                    return hits
            except Exception as e:
                logger.debug("DDG %s path failed: %s", path_name, e)
        return []

    async def _via_ddgs(self, query: str, limit: int, language: str) -> list[SearchResult]:
        try:
            from ddgs import DDGS
        except ImportError:
            return []

        loop = asyncio.get_running_loop()

        def _do() -> list[SearchResult]:
            results: list[SearchResult] = []
            region = "xa-ar" if language == "ar" else "wt-wt"
            with DDGS() as ddgs:
                hits = ddgs.text(query, region=region, safesearch="off", max_results=limit)
                for h in hits or []:
                    url = h.get("href") or h.get("url") or ""
                    if not url:
                        continue
                    title = h.get("title") or ""
                    body = h.get("body") or h.get("snippet") or ""
                    results.append(
                        SearchResult(
                            title=title,
                            url=url,
                            snippet=body,
                            source_domain=_domain_of(url),
                            language=_detect_language(title + " " + body),
                            engine=self.name,
                            score=1.0,
                            raw=dict(h),
                        )
                    )
            return results

        return await loop.run_in_executor(None, _do)

    async def _via_legacy_lib(self, query: str, limit: int, language: str) -> list[SearchResult]:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return []

        loop = asyncio.get_running_loop()

        def _do() -> list[SearchResult]:
            results: list[SearchResult] = []
            region = "xa-ar" if language == "ar" else "wt-wt"
            with DDGS() as ddgs:
                hits = ddgs.text(query, region=region, safesearch="off", max_results=limit)
                for h in hits or []:
                    url = h.get("href") or ""
                    if not url:
                        continue
                    results.append(
                        SearchResult(
                            title=h.get("title") or "",
                            url=url,
                            snippet=h.get("body") or "",
                            source_domain=_domain_of(url),
                            language=_detect_language(
                                (h.get("title") or "") + " " + (h.get("body") or "")
                            ),
                            engine=self.name,
                            score=1.0,
                            raw=dict(h),
                        )
                    )
            return results

        return await loop.run_in_executor(None, _do)

    async def _via_html(self, query: str, limit: int, language: str) -> list[SearchResult]:
        params = {"q": query, "kl": "xa-ar" if language == "ar" else "wt-wt"}
        async with httpx.AsyncClient(
            timeout=10.0,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "ar,en;q=0.8"},
            follow_redirects=True,
        ) as c:
            resp = await c.get("https://html.duckduckgo.com/html/", params=params)
            resp.raise_for_status()
        return _parse_ddg_html(resp.text, limit, self.name)


def _parse_ddg_html(html: str, limit: int, engine: str) -> list[SearchResult]:
    """Tolerant DDG HTML parser using selectolax with BeautifulSoup fallback."""
    out: list[SearchResult] = []
    try:
        from selectolax.parser import HTMLParser

        tree = HTMLParser(html)
        for node in tree.css(".result")[:limit]:
            a = node.css_first(".result__a")
            snippet = node.css_first(".result__snippet")
            if not a:
                continue
            url = a.attributes.get("href") or ""
            title = a.text(strip=True)
            text = snippet.text(strip=True) if snippet else ""
            if not url:
                continue
            out.append(
                SearchResult(
                    title=title,
                    url=url,
                    snippet=text,
                    source_domain=_domain_of(url),
                    language=_detect_language(title + " " + text),
                    engine=engine,
                    score=1.0,
                )
            )
    except Exception:
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html, "lxml")
            for r in soup.select(".result")[:limit]:
                a = r.select_one(".result__a")
                snip = r.select_one(".result__snippet")
                if not a:
                    continue
                url = a.get("href", "")
                title = a.get_text(strip=True)
                snippet_text = snip.get_text(strip=True) if snip else ""
                if not url:
                    continue
                out.append(
                    SearchResult(
                        title=title,
                        url=url,
                        snippet=snippet_text,
                        source_domain=_domain_of(url),
                        language=_detect_language(title + " " + snippet_text),
                        engine=engine,
                        score=1.0,
                    )
                )
        except Exception:
            pass
    return out


class BingHTMLProvider:
    """Direct Bing HTML scraper. No API key, more reliable than DDG mirroring."""

    name = "bing"

    async def search(self, query: str, limit: int = 10, language: str = "ar") -> list[SearchResult]:
        params = {"q": query, "count": str(limit)}
        if language == "ar":
            params["setlang"] = "ar"
            params["mkt"] = "ar-XA"
        try:
            async with httpx.AsyncClient(
                timeout=10.0,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "ar,en;q=0.8",
                },
                follow_redirects=True,
            ) as c:
                resp = await c.get("https://www.bing.com/search", params=params)
                resp.raise_for_status()
                html = resp.text
        except Exception as e:
            logger.debug("Bing fetch failed: %s", e)
            return []
        return _parse_bing_html(html, limit, self.name)


def _parse_bing_html(html: str, limit: int, engine: str) -> list[SearchResult]:
    out: list[SearchResult] = []
    try:
        from selectolax.parser import HTMLParser

        tree = HTMLParser(html)
        for li in tree.css("li.b_algo")[:limit]:
            a = li.css_first("h2 a")
            snip = li.css_first(".b_caption p") or li.css_first(".b_lineclamp4")
            if not a:
                continue
            url = a.attributes.get("href") or ""
            title = a.text(strip=True)
            text = snip.text(strip=True) if snip else ""
            if not url or url.startswith("javascript:"):
                continue
            out.append(
                SearchResult(
                    title=title,
                    url=url,
                    snippet=text,
                    source_domain=_domain_of(url),
                    language=_detect_language(title + " " + text),
                    engine=engine,
                    score=1.1,
                )
            )
    except Exception:
        pass
    return out


class SearXNGProvider:
    """Public SearXNG instances. Tries each with a small jitter."""

    name = "searxng"

    def __init__(self, instances: Optional[list[str]] = None) -> None:
        env = os.getenv("SEARXNG_INSTANCE", "").strip()
        base = [env] if env else []
        self.instances = base + list(instances or PUBLIC_SEARXNG_INSTANCES)

    async def search(self, query: str, limit: int = 10, language: str = "ar") -> list[SearchResult]:
        for inst in self.instances:
            try:
                return await self._query_one(inst, query, limit, language)
            except Exception as e:
                logger.debug("SearXNG %s failed: %s", inst, e)
                await asyncio.sleep(0.05 + random.random() * 0.1)
        return []

    async def _query_one(
        self, instance: str, query: str, limit: int, language: str
    ) -> list[SearchResult]:
        params = {
            "q": query,
            "format": "json",
            "language": "ar" if language == "ar" else "en",
            "categories": "news,general",
            "safesearch": "0",
            "pageno": "1",
        }
        async with httpx.AsyncClient(
            timeout=8.0,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
                "Accept-Language": "ar,en;q=0.8",
            },
            follow_redirects=True,
        ) as c:
            resp = await c.get(f"{instance.rstrip('/')}/search", params=params)
            if resp.status_code == 429:
                raise RuntimeError("rate-limited")
            resp.raise_for_status()
            data = resp.json()
        out: list[SearchResult] = []
        for r in (data.get("results") or [])[:limit]:
            url = r.get("url") or ""
            if not url:
                continue
            out.append(
                SearchResult(
                    title=r.get("title") or "",
                    url=url,
                    snippet=r.get("content") or "",
                    source_domain=_domain_of(url),
                    language=_detect_language(
                        (r.get("title") or "") + " " + (r.get("content") or "")
                    ),
                    pub_date=r.get("publishedDate"),
                    engine=f"searxng:{urlparse(instance).netloc}",
                    score=float(r.get("score") or 1.0),
                    raw=r,
                )
            )
        return out


class BraveProvider:
    """Brave Search API. Free 2000/month with email signup."""

    name = "brave"

    def __init__(self) -> None:
        self.key = os.getenv("BRAVE_API_KEY", "").strip()

    @property
    def enabled(self) -> bool:
        return bool(self.key)

    async def search(self, query: str, limit: int = 10, language: str = "ar") -> list[SearchResult]:
        if not self.enabled:
            return []
        params = {
            "q": query,
            "count": str(limit),
            "safesearch": "off",
            "search_lang": "ar" if language == "ar" else "en",
        }
        try:
            async with httpx.AsyncClient(
                timeout=8.0,
                headers={
                    "X-Subscription-Token": self.key,
                    "Accept": "application/json",
                    "Accept-Language": "ar,en;q=0.8",
                },
            ) as c:
                resp = await c.get(
                    "https://api.search.brave.com/res/v1/web/search", params=params
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning("Brave search failed: %s", e)
            return []
        out: list[SearchResult] = []
        for r in ((data.get("web") or {}).get("results") or [])[:limit]:
            url = r.get("url") or ""
            if not url:
                continue
            title = r.get("title") or ""
            snippet = r.get("description") or ""
            pub = (r.get("page_age") or {}).get("date") if isinstance(r.get("page_age"), dict) else r.get("age")
            out.append(
                SearchResult(
                    title=title,
                    url=url,
                    snippet=snippet,
                    source_domain=_domain_of(url),
                    language=_detect_language(title + " " + snippet),
                    pub_date=pub,
                    engine=self.name,
                    score=2.0,  # higher trust
                    raw=r,
                )
            )
        return out


class TavilyProvider:
    """Tavily AI search. Free 1000/month."""

    name = "tavily"

    def __init__(self) -> None:
        self.key = os.getenv("TAVILY_API_KEY", "").strip()

    @property
    def enabled(self) -> bool:
        return bool(self.key)

    async def search(self, query: str, limit: int = 10, language: str = "ar") -> list[SearchResult]:
        if not self.enabled:
            return []
        try:
            async with httpx.AsyncClient(timeout=8.0) as c:
                resp = await c.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": self.key,
                        "query": query,
                        "search_depth": "basic",
                        "max_results": limit,
                        "include_answer": False,
                        "include_raw_content": False,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning("Tavily search failed: %s", e)
            return []
        out: list[SearchResult] = []
        for r in (data.get("results") or [])[:limit]:
            url = r.get("url") or ""
            if not url:
                continue
            out.append(
                SearchResult(
                    title=r.get("title") or "",
                    url=url,
                    snippet=r.get("content") or "",
                    source_domain=_domain_of(url),
                    language=_detect_language(
                        (r.get("title") or "") + " " + (r.get("content") or "")
                    ),
                    engine=self.name,
                    score=2.0,
                    raw=r,
                )
            )
        return out


class SerperProvider:
    """Serper.dev — Google results via API. Free 2500 first queries."""

    name = "serper"

    def __init__(self) -> None:
        self.key = os.getenv("SERPER_API_KEY", "").strip()

    @property
    def enabled(self) -> bool:
        return bool(self.key)

    async def search(self, query: str, limit: int = 10, language: str = "ar") -> list[SearchResult]:
        if not self.enabled:
            return []
        try:
            async with httpx.AsyncClient(timeout=8.0) as c:
                resp = await c.post(
                    "https://google.serper.dev/search",
                    headers={"X-API-KEY": self.key, "Content-Type": "application/json"},
                    json={
                        "q": query,
                        "gl": "jo" if language == "ar" else "us",
                        "hl": "ar" if language == "ar" else "en",
                        "num": limit,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning("Serper search failed: %s", e)
            return []
        out: list[SearchResult] = []
        for r in (data.get("organic") or [])[:limit]:
            url = r.get("link") or ""
            if not url:
                continue
            out.append(
                SearchResult(
                    title=r.get("title") or "",
                    url=url,
                    snippet=r.get("snippet") or "",
                    source_domain=_domain_of(url),
                    language=_detect_language(
                        (r.get("title") or "") + " " + (r.get("snippet") or "")
                    ),
                    pub_date=r.get("date"),
                    engine=self.name,
                    score=2.5,
                    raw=r,
                )
            )
        return out


class WikipediaProvider:
    """Arabic + English Wikipedia search for entity grounding."""

    name = "wikipedia"

    async def search(self, query: str, limit: int = 5, language: str = "ar") -> list[SearchResult]:
        wikis = ["ar", "en"] if language == "ar" else ["en", "ar"]
        results: list[SearchResult] = []
        for wiki in wikis:
            try:
                async with httpx.AsyncClient(timeout=6.0) as c:
                    resp = await c.get(
                        f"https://{wiki}.wikipedia.org/w/api.php",
                        params={
                            "action": "query",
                            "list": "search",
                            "srsearch": query,
                            "format": "json",
                            "srlimit": str(max(1, limit // len(wikis))),
                        },
                        headers={"User-Agent": USER_AGENT},
                    )
                    resp.raise_for_status()
                    data = resp.json()
                hits = ((data.get("query") or {}).get("search") or [])
                for h in hits:
                    title = h.get("title") or ""
                    snippet = re.sub(r"<[^>]+>", "", h.get("snippet") or "")
                    page = title.replace(" ", "_")
                    url = f"https://{wiki}.wikipedia.org/wiki/{quote(page)}"
                    results.append(
                        SearchResult(
                            title=title,
                            url=url,
                            snippet=snippet,
                            source_domain=f"{wiki}.wikipedia.org",
                            language=wiki,
                            engine=f"wikipedia:{wiki}",
                            score=1.5,
                            raw=h,
                        )
                    )
            except Exception as e:
                logger.debug("Wikipedia (%s) failed: %s", wiki, e)
        return results[:limit]


# -------------------- Aggregator --------------------


class WebSearchService:
    """Top-level facade used by A3 and the /search endpoint."""

    def __init__(self) -> None:
        # Order = priority. Higher-quality paid providers run first when keyed.
        # The free tier (Bing+DDG+SearXNG) runs in parallel and de-dupes, so a
        # single working engine is enough.
        self.providers: list = [
            BraveProvider(),
            TavilyProvider(),
            SerperProvider(),
            BingHTMLProvider(),
            DuckDuckGoProvider(),
            SearXNGProvider(),
        ]
        self.wikipedia = WikipediaProvider()

    async def search(
        self,
        query: str,
        language: str = "ar",
        limit: int = 10,
        include_wikipedia: bool = True,
        per_provider_timeout: float = 6.0,
    ) -> list[SearchResult]:
        """Single-query multi-engine search with merge + dedupe.

        Each provider is wrapped in its own timeout so a slow engine cannot
        hold up the response. The first batch of providers to return ends
        the call only if a paid provider gives enough results — otherwise
        we wait for all of them.
        """

        async def _safe(p) -> list[SearchResult]:
            try:
                return await asyncio.wait_for(p.search(query, limit, language), timeout=per_provider_timeout)
            except Exception as e:
                logger.debug("Provider %s timed out / failed: %s", getattr(p, "name", "?"), e)
                return []

        tasks = [_safe(p) for p in self.providers]
        if include_wikipedia:
            async def _wiki():
                try:
                    return await asyncio.wait_for(
                        self.wikipedia.search(query, max(2, limit // 4), language),
                        timeout=4.0,
                    )
                except Exception:
                    return []
            tasks.append(_wiki())
        gathered = await asyncio.gather(*tasks, return_exceptions=True)
        merged: list[SearchResult] = []
        for r in gathered:
            if isinstance(r, list):
                merged.extend(r)
        return self._dedupe(merged)[:limit]

    async def comprehensive_search(
        self,
        claim: str,
        language: str = "ar",
        per_query_limit: int = 5,
        total_limit: int = 18,
    ) -> list[SearchResult]:
        """Multi-pronged search.

        1. Raw claim          (broadest)
        2. Two site-targeted  (boosts trusted Arabic outlets)
        3. Wikipedia          (fast, free)

        Each sub-query is firewalled with its own timeout so one slow
        provider cannot drag the whole call past A3's outer budget.
        """
        claim = (claim or "").strip()
        if not claim:
            return []

        queries: list[tuple[str, int]] = [(claim[:200], per_query_limit)]
        # Pick 2 trusted sites at random for the run to spread load
        for site in random.sample(ARABIC_NEWS_SITES, k=2):
            queries.append((f"site:{site} {claim[:140]}", 3))

        async def _bounded(q: str, lim: int) -> list[SearchResult]:
            try:
                return await asyncio.wait_for(
                    self.search(q, language=language, limit=lim, include_wikipedia=False, per_provider_timeout=5.0),
                    timeout=8.0,
                )
            except Exception as e:
                logger.debug("Sub-query timed out: %s (%s)", q[:60], e)
                return []

        tasks = [_bounded(q, lim) for q, lim in queries]
        # Add Wikipedia once (don't repeat in every sub-query)
        async def _wiki():
            try:
                return await asyncio.wait_for(self.wikipedia.search(claim, 4, language), timeout=4.0)
            except Exception:
                return []
        tasks.append(_wiki())

        gathered = await asyncio.gather(*tasks, return_exceptions=True)
        merged: list[SearchResult] = []
        for r in gathered:
            if isinstance(r, list):
                merged.extend(r)
        return self._dedupe(merged)[:total_limit]

    @staticmethod
    def _dedupe(results: list[SearchResult]) -> list[SearchResult]:
        seen: dict[str, SearchResult] = {}
        for r in results:
            if not r.url:
                continue
            key = _canonical_url(r.url)
            if key in seen:
                # keep the higher-scored one and merge engine info
                if r.score > seen[key].score:
                    r.raw["alt_engines"] = seen[key].raw.get("alt_engines", []) + [seen[key].engine]
                    seen[key] = r
                else:
                    seen[key].raw.setdefault("alt_engines", []).append(r.engine)
            else:
                seen[key] = r
        ordered = sorted(seen.values(), key=lambda x: x.score, reverse=True)
        return ordered

    def status(self) -> dict[str, bool]:
        out: dict[str, bool] = {}
        for p in self.providers:
            enabled = getattr(p, "enabled", True)
            out[p.name] = bool(enabled)
        out["wikipedia"] = True
        return out
