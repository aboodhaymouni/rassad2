"""Article fetcher + extractor.

Strategy stack (each step falls through to the next on failure):

1. trafilatura — best-in-class article extraction with metadata (date, author,
   language) recovery. Open source, no API key.
2. readability-lxml — battle-tested fallback that performs main-content
   detection well on news pages with mixed boilerplate.
3. selectolax / BeautifulSoup — last resort, raw text + meta tag scrape.

The `WebScraper` is async-friendly: blocking work is shipped to the executor.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import re
import socket
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx


def _ssrf_safe(url: str) -> tuple[bool, str]:
    """Block obviously dangerous URLs (private IPs, non-http schemes, file://)."""
    try:
        p = urlparse(url)
    except Exception:
        return False, "invalid url"
    if p.scheme not in ("http", "https"):
        return False, f"scheme not allowed: {p.scheme}"
    host = p.hostname or ""
    if not host:
        return False, "no host"
    if host.lower() in ("localhost",):
        return False, "loopback host"
    # Resolve and reject private/loopback/link-local
    try:
        infos = socket.getaddrinfo(host, None)
        for fam, _, _, _, sockaddr in infos:
            ip_str = sockaddr[0]
            try:
                ip = ipaddress.ip_address(ip_str)
            except ValueError:
                continue
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False, f"private ip: {ip_str}"
    except socket.gaierror:
        # DNS lookup failed — let httpx fail naturally
        pass
    return True, ""

logger = logging.getLogger(__name__)


@dataclass
class ScrapedArticle:
    url: str
    canonical_url: str
    domain: str
    title: str = ""
    text: str = ""
    summary: str = ""
    author: str = ""
    pub_date: Optional[str] = None
    language: str = ""
    word_count: int = 0
    fetch_status: int = 0
    method: str = ""  # "trafilatura" | "readability" | "selectolax" | "fallback"
    error: Optional[str] = None
    fetched_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))


_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def _canonical(url: str) -> str:
    try:
        p = urlparse(url)
        host = p.netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        return f"{p.scheme}://{host}{p.path.rstrip('/')}"
    except Exception:
        return url


def _domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def _detect_lang(text: str) -> str:
    if not text:
        return ""
    arabic = sum(1 for c in text if "؀" <= c <= "ۿ")
    return "ar" if arabic > len(text) * 0.2 else "en"


class WebScraper:
    """Async article fetcher + multi-strategy extractor."""

    def __init__(self, timeout: float = 12.0, max_size_bytes: int = 1_500_000) -> None:
        self.timeout = timeout
        self.max_size_bytes = max_size_bytes

    async def fetch_and_extract(self, url: str) -> ScrapedArticle:
        article = ScrapedArticle(
            url=url,
            canonical_url=_canonical(url),
            domain=_domain(url),
        )
        html = await self._fetch_html(url, article)
        if not html:
            return article
        loop = asyncio.get_running_loop()
        # 1. trafilatura
        try:
            ok = await loop.run_in_executor(
                None, lambda: self._extract_trafilatura(html, url, article)
            )
            if ok:
                self._finalize(article)
                return article
        except Exception as e:
            logger.debug("trafilatura failed for %s: %s", url, e)

        # 2. readability
        try:
            ok = await loop.run_in_executor(
                None, lambda: self._extract_readability(html, article)
            )
            if ok:
                self._finalize(article)
                return article
        except Exception as e:
            logger.debug("readability failed for %s: %s", url, e)

        # 3. selectolax
        try:
            ok = await loop.run_in_executor(
                None, lambda: self._extract_selectolax(html, article)
            )
            if ok:
                self._finalize(article)
                return article
        except Exception as e:
            logger.debug("selectolax failed for %s: %s", url, e)

        article.error = article.error or "all extractors failed"
        return article

    async def fetch_many(self, urls: list[str], concurrency: int = 6) -> list[ScrapedArticle]:
        """Fetch multiple URLs concurrently with a small bound."""
        sem = asyncio.Semaphore(concurrency)

        async def _bounded(u: str) -> ScrapedArticle:
            async with sem:
                try:
                    return await self.fetch_and_extract(u)
                except Exception as e:
                    return ScrapedArticle(
                        url=u, canonical_url=_canonical(u), domain=_domain(u), error=str(e)
                    )

        return await asyncio.gather(*[_bounded(u) for u in urls])

    async def _fetch_html(self, url: str, article: ScrapedArticle) -> Optional[str]:
        # SSRF guard: only http(s), reject private/loopback/link-local IPs
        ok, reason = _ssrf_safe(url)
        if not ok:
            article.error = f"blocked: {reason}"
            return None
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                headers={
                    "User-Agent": _USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "ar,en;q=0.8",
                },
                follow_redirects=True,
            ) as c:
                # Stream so we can abort oversize responses without buffering them.
                async with c.stream("GET", url) as resp:
                    article.fetch_status = resp.status_code
                    if resp.status_code >= 400:
                        article.error = f"HTTP {resp.status_code}"
                        return None
                    final_url = str(resp.url)
                    # Re-check redirected target — defends against bait redirects
                    ok2, reason2 = _ssrf_safe(final_url)
                    if not ok2:
                        article.error = f"redirect blocked: {reason2}"
                        return None
                    article.url = final_url
                    article.canonical_url = _canonical(final_url)
                    article.domain = _domain(final_url)
                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in resp.aiter_bytes():
                        total += len(chunk)
                        if total > self.max_size_bytes:
                            article.error = "response too large"
                            return None
                        chunks.append(chunk)
                    body = b"".join(chunks)
                    ctype = resp.headers.get("Content-Type") or ""
                    text = body.decode(resp.charset_encoding or "utf-8", errors="replace")
                    if "text/html" not in ctype and not text.lstrip().startswith("<"):
                        article.error = "non-HTML response"
                        return None
                    return text
        except httpx.HTTPError as e:
            article.error = f"fetch error: {e}"
            return None
        except Exception as e:
            article.error = f"fetch unexpected: {e}"
            return None

    @staticmethod
    def _extract_trafilatura(html: str, url: str, article: ScrapedArticle) -> bool:
        try:
            import trafilatura
        except ImportError:
            return False
        text = trafilatura.extract(
            html,
            url=url,
            favor_recall=True,
            include_comments=False,
            include_tables=False,
            with_metadata=False,
            output_format="txt",
        )
        if not text or len(text) < 80:
            return False
        article.text = text.strip()
        article.method = "trafilatura"
        try:
            meta = trafilatura.extract_metadata(html, default_url=url)
            if meta:
                article.title = meta.title or article.title
                article.author = (meta.author or "")[:200] if meta.author else ""
                if meta.date:
                    article.pub_date = str(meta.date)
                if meta.language:
                    article.language = meta.language
        except Exception:
            pass
        return True

    @staticmethod
    def _extract_readability(html: str, article: ScrapedArticle) -> bool:
        try:
            from readability import Document
        except ImportError:
            return False
        doc = Document(html)
        article.title = (doc.short_title() or article.title).strip()
        body_html = doc.summary() or ""
        text = re.sub(r"<[^>]+>", " ", body_html)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) < 80:
            return False
        article.text = text
        article.method = "readability"
        return True

    @staticmethod
    def _extract_selectolax(html: str, article: ScrapedArticle) -> bool:
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return False
        tree = HTMLParser(html)
        # Title
        if not article.title:
            for sel in ('meta[property="og:title"]', 'meta[name="twitter:title"]', "title"):
                node = tree.css_first(sel)
                if node:
                    article.title = (
                        node.attributes.get("content") if "meta" in sel else node.text(strip=True)
                    ) or article.title
                    if article.title:
                        break
        # Description / fallback body
        body = tree.css_first("article") or tree.css_first("main") or tree.body
        text = body.text(separator=" ", strip=True) if body else ""
        text = re.sub(r"\s+", " ", text)[:8000]
        if len(text) < 80:
            return False
        article.text = text.strip()
        article.method = "selectolax"
        # pub_date guess
        for sel in (
            'meta[property="article:published_time"]',
            'meta[name="pubdate"]',
            'meta[itemprop="datePublished"]',
        ):
            node = tree.css_first(sel)
            if node and node.attributes.get("content"):
                article.pub_date = node.attributes["content"]
                break
        return True

    @staticmethod
    def _finalize(article: ScrapedArticle) -> None:
        if not article.language:
            article.language = _detect_lang(article.text or article.title)
        article.word_count = len(article.text.split())
        article.summary = (article.text[:480]).strip()
