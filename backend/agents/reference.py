"""A3 — Reference Checker Agent.

Cross-references a claim against:
1. **RSS feed corpus** — 10 trusted Arabic news outlets (cached for 10 min).
2. **Live web search** — DuckDuckGo + SearXNG (+ Brave/Tavily/Serper if keys),
   plus Wikipedia, plus site-targeted searches on a list of trusted Arabic news
   domains. This makes the agent able to find a claim *even when only one
   source on the web mentions it*.
3. **Article scraping** — top web hits are pulled and parsed with trafilatura
   so the similarity ranker has full article text, not just snippets.

The agent merges everything, computes semantic similarity with sentence-
transformers, and classifies into matches / contradictions / web corroboration.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional

from models.response_models import AgentResult, ConfidenceLevel
from services.query_expander import QueryExpander
from services.rss_crawler import Article, RSSCrawler
from services.web_scraper import ScrapedArticle, WebScraper
from services.web_search import SearchResult, WebSearchService

logger = logging.getLogger(__name__)


SOURCE_CREDIBILITY: dict[str, float] = {
    "petra.gov.jo": 0.98,
    "reuters.com": 0.96,
    "apnews.com": 0.96,
    "bbci.co.uk": 0.95,
    "bbc.co.uk": 0.95,
    "bbc.com": 0.95,
    "afp.com": 0.94,
    "aljazeera.net": 0.92,
    "aljazeera.com": 0.92,
    "alarabiya.net": 0.88,
    "skynewsarabia.com": 0.86,
    "france24.com": 0.86,
    "dw.com": 0.86,
    "alhurra.com": 0.84,
    "alghad.com": 0.80,
    "alrai.com": 0.78,
    "asharq.com": 0.78,
    "rt.com": 0.65,
    "arabic.rt.com": 0.65,
    "jo24.net": 0.65,
    "ar.wikipedia.org": 0.78,
    "en.wikipedia.org": 0.80,
}
DEFAULT_CREDIBILITY = 0.55

STRONG_MATCH = 0.55       # any source: similarity at/above is a strong match
WEB_FOUND_MATCH = 0.28    # web hits down to here surface as "found on web"
WEAK_MATCH = 0.22         # contradictions / loose-overlap floor
OLD_NEWS_DAYS = 180

ARABIC_STOPWORDS = {
    "في", "من", "إلى", "على", "عن", "هو", "هي", "هم", "هذا", "هذه",
    "ذلك", "تلك", "أن", "إن", "لا", "ما", "كان", "كانت", "قد", "لقد",
    "كل", "بعض", "غير", "أو", "ثم", "أيضاً",
}


class ReferenceCheckerAgent:
    """A3 — multi-source semantic cross-reference."""

    def __init__(
        self,
        timeout_seconds: float = 28.0,
        crawler: Optional[RSSCrawler] = None,
        web_search: Optional[WebSearchService] = None,
        scraper: Optional[WebScraper] = None,
        query_expander: Optional[QueryExpander] = None,
    ) -> None:
        self.agent_id = "a3_reference"
        self.timeout = timeout_seconds
        self.crawler = crawler or RSSCrawler()
        self.web_search = web_search or WebSearchService()
        self.scraper = scraper or WebScraper()
        self.query_expander = query_expander or QueryExpander()
        self._encoder = None
        self._encoder_failed = False
        self.hf_token = os.getenv("HF_API_TOKEN", "").strip()
        self._article_cache: list[Article] = []
        self._cache_at: Optional[datetime] = None
        self._cache_ttl_seconds = 600
        self._cache_lock = asyncio.Lock()

    async def analyze(self, text: str) -> AgentResult:
        start = time.perf_counter()
        try:
            return await asyncio.wait_for(self._analyze(text, start), timeout=self.timeout)
        except asyncio.TimeoutError:
            return self._timeout(start)
        except Exception as e:
            logger.exception("A3 error: %s", e)
            return self._fallback(text, start, error=str(e))

    async def _analyze(self, text: str, start: float) -> AgentResult:
        text = (text or "").strip()
        if len(text) < 5:
            return self._fallback(text, start, error="text too short")

        rss_task = asyncio.create_task(self._get_articles())
        queries_task = asyncio.create_task(self.query_expander.expand(text, max_queries=3))
        rss_articles, queries = await asyncio.gather(rss_task, queries_task)
        if not queries:
            queries = [text[:200]]

        # Run a single comprehensive web search using the strongest query.
        # comprehensive_search itself already fans out (1 main + 2 site +
        # Wikipedia) and dedupes, so we don't need additional shadow queries.
        primary_query = queries[0]
        is_arabic = sum(1 for c in text if "؀" <= c <= "ۿ") > len(text) * 0.2
        lang = "ar" if is_arabic else "en"
        web_hits = await self._safe_web_search(primary_query, language=lang)
        scraped = await self._scrape_hits(web_hits)

        corpus = self._build_corpus(rss_articles, web_hits, scraped)
        if not corpus:
            return AgentResult(
                agent=self.agent_id,
                score=0.5,
                confidence=ConfidenceLevel.INSUFFICIENT_DATA,
                evidence=["no corpus available (RSS+web both empty)"],
                raw={"matches": [], "contradictions": [], "web_results": [], "queries": queries},
                elapsed_ms=int((time.perf_counter() - start) * 1000),
                mode="fallback",
            )

        sims, sim_mode = await self._similarity(text, corpus)

        matches: list[dict] = []
        contradictions: list[dict] = []
        web_results: list[dict] = []
        rss_match_count = 0
        web_match_count = 0
        for similarity, item in sims:
            entry = self._serialize(item, similarity)
            if item["kind"] == "web":
                if similarity >= WEB_FOUND_MATCH:
                    web_results.append(entry)
                if similarity >= STRONG_MATCH:
                    matches.append(entry)
                    web_match_count += 1
                elif similarity >= WEAK_MATCH:
                    contradictions.append(entry)
            else:  # rss
                if similarity >= STRONG_MATCH:
                    matches.append(entry)
                    rss_match_count += 1
                elif similarity >= WEAK_MATCH:
                    contradictions.append(entry)

        matches.sort(key=lambda m: m["similarity"], reverse=True)
        contradictions.sort(key=lambda m: m["similarity"], reverse=True)
        web_results.sort(key=lambda m: m["similarity"], reverse=True)
        matches = matches[:8]
        contradictions = contradictions[:6]
        web_results = web_results[:10]

        if matches:
            credibility = sum(
                SOURCE_CREDIBILITY.get(m.get("domain") or "", DEFAULT_CREDIBILITY)
                for m in matches
            ) / len(matches)
            score = round(credibility, 4)
        elif web_results:
            top_sim = web_results[0]["similarity"]
            score = round(min(0.45, max(0.25, top_sim * 0.6)), 4)
            credibility = score
        else:
            credibility = 0.0
            score = round(min(0.20, max(s for s, _ in sims) if sims else 0.0), 4)

        date_ok = self._check_date_ok(matches)
        confidence = self._classify_confidence(matches, web_results, sim_mode)

        evidence: list[str] = []
        for m in matches[:3]:
            evidence.append(f"match:{m['source_name']}|sim={m['similarity']:.2f}")
        if web_match_count and not matches:
            evidence.append(f"web_only_match:{web_match_count}")
        if web_results and not matches:
            top = web_results[0]
            evidence.append(f"web_corroboration:{top['source_name']}|sim={top['similarity']:.2f}")
        if contradictions:
            evidence.append(f"weak_or_contradiction:{len(contradictions)}")
        if not matches and not web_results:
            evidence.append("no source mentions this claim")
        if not date_ok and matches:
            evidence.append("matches older than 180 days")

        return AgentResult(
            agent=self.agent_id,
            score=score,
            confidence=confidence,
            evidence=evidence[:10],
            raw={
                "matches": matches,
                "contradictions": contradictions,
                "web_results": web_results,
                "queries": queries,
                "engines": self.web_search.status(),
                "rss_articles_checked": len(rss_articles),
                "web_hits_seen": len(web_hits),
                "web_articles_scraped": sum(1 for s in scraped if s.text),
                "credibility_score": round(credibility, 4),
                "date_ok": date_ok,
                "rss_match_count": rss_match_count,
                "web_match_count": web_match_count,
            },
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode=sim_mode,
        )

    # -------- corpus + scoring --------

    async def _safe_web_search(self, query: str, language: str = "ar") -> list[SearchResult]:
        try:
            return await self.web_search.comprehensive_search(
                query, language=language, per_query_limit=5, total_limit=18,
            )
        except Exception as e:
            logger.warning("comprehensive_search failed: %s", e)
            return []

    async def _scrape_hits(self, hits: list[SearchResult]) -> list[ScrapedArticle]:
        if not hits:
            return []
        urls = [h.url for h in hits[:5] if h.url]
        try:
            scraped = await asyncio.wait_for(
                self.scraper.fetch_many(urls, concurrency=4),
                timeout=8.0,
            )
            # discard failed extractions (no text)
            return [s for s in scraped if s.text and s.word_count >= 25]
        except Exception as e:
            logger.warning("Scrape phase failed/timed-out: %s", e)
            return []

    def _build_corpus(
        self,
        rss_articles: list[Article],
        web_hits: list[SearchResult],
        scraped: list[ScrapedArticle],
    ) -> list[dict]:
        corpus: list[dict] = []
        for a in rss_articles:
            text = (a.summary or a.text or "")[:1200]
            if not (a.title or text):
                continue
            corpus.append({
                "title": a.title,
                "text": (a.title + ". " + text).strip(". "),
                "url": a.url,
                "source_name": a.source_name,
                "domain": a.domain,
                "pub_date": a.pub_date.isoformat() if a.pub_date else None,
                "kind": "rss",
                "engine": "rss",
            })

        # Map scraped by canonical URL for fast lookup
        scraped_by_url: dict[str, ScrapedArticle] = {}
        for s in scraped:
            scraped_by_url[s.canonical_url or s.url] = s

        seen_urls = {a.url for a in rss_articles if a.url}
        for hit in web_hits:
            url = hit.url
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            sa = scraped_by_url.get(url) or scraped_by_url.get(self._canonicalize(url))
            title = (sa.title if sa else "") or hit.title
            domain = (sa.domain if sa else "") or hit.source_domain
            pub_date = (sa.pub_date if sa else None) or hit.pub_date
            # Build a focused similarity corpus from the most relevant slice:
            # search-engine snippet first (engine already deemed it relevant
            # to the query), then title and a short prefix of the scraped
            # article so we don't drown in boilerplate.
            engine_blurb = (hit.snippet or "").strip()
            scraped_prefix = (sa.text[:600].strip() if sa and sa.text else "")
            sim_text = (title + ". " + engine_blurb + ". " + scraped_prefix).strip(". ").strip()
            if not sim_text:
                continue
            display_summary = (
                (sa.summary[:300] if sa and sa.summary else "")
                or engine_blurb[:300]
            )
            corpus.append({
                "title": title,
                "text": sim_text[:1500],
                "summary": display_summary,
                "url": url,
                "source_name": domain or hit.engine,
                "domain": domain,
                "pub_date": pub_date,
                "kind": "web",
                "engine": hit.engine,
            })
        return corpus

    @staticmethod
    def _canonicalize(url: str) -> str:
        try:
            from urllib.parse import urlparse

            p = urlparse(url)
            host = p.netloc.lower()
            if host.startswith("www."):
                host = host[4:]
            return f"{p.scheme}://{host}{p.path.rstrip('/')}"
        except Exception:
            return url

    async def _similarity(
        self, claim: str, corpus: list[dict]
    ) -> tuple[list[tuple[float, dict]], str]:
        if self.hf_token:
            via_api = await self._similarity_hf_api(claim, corpus)
            if via_api:
                return via_api, "real"
        encoder = await self._get_encoder()
        if encoder is not None:
            try:
                loop = asyncio.get_running_loop()
                texts = [claim] + [c["text"] for c in corpus]
                vectors = await loop.run_in_executor(
                    None,
                    lambda: encoder.encode(texts, normalize_embeddings=True),
                )
                claim_vec = vectors[0]
                pairs: list[tuple[float, dict]] = []
                for vec, item in zip(vectors[1:], corpus):
                    sim = float((claim_vec * vec).sum())
                    pairs.append((sim, item))
                return pairs, "real"
            except Exception as e:
                logger.warning("Local encoder failed: %s", e)
        return self._jaccard_fallback(claim, corpus), "fallback"

    async def _similarity_hf_api(
        self, claim: str, corpus: list[dict]
    ) -> Optional[list[tuple[float, dict]]]:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api-inference.huggingface.co/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                    headers={"Authorization": f"Bearer {self.hf_token}"},
                    json={
                        "inputs": {
                            "source_sentence": claim[:480],
                            "sentences": [c["text"][:480] for c in corpus],
                        }
                    },
                )
                if resp.status_code != 200:
                    return None
                scores = resp.json()
                if not isinstance(scores, list):
                    return None
                return list(zip([float(s) for s in scores], corpus))
        except Exception as e:
            logger.debug("HF inference API failed: %s", e)
            return None

    async def _get_encoder(self):
        if self._encoder is not None or self._encoder_failed:
            return self._encoder
        loop = asyncio.get_running_loop()
        try:
            self._encoder = await loop.run_in_executor(None, self._load_encoder)
        except Exception as e:
            logger.warning("Sentence-transformer load failed: %s", e)
            self._encoder_failed = True
            self._encoder = None
        return self._encoder

    @staticmethod
    def _load_encoder():
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

    @staticmethod
    def _jaccard_fallback(claim: str, corpus: list[dict]) -> list[tuple[float, dict]]:
        ctokens = ReferenceCheckerAgent._tokens(claim)
        out = []
        if not ctokens:
            return out
        for c in corpus:
            t = ReferenceCheckerAgent._tokens(c["text"])
            if not t:
                continue
            jaccard = len(ctokens & t) / max(1, len(ctokens | t))
            out.append((jaccard * 0.85, c))
        return out

    @staticmethod
    def _tokens(text: str) -> set[str]:
        text = re.sub(r"[^؀-ۿa-zA-Z0-9 ]", " ", text or "")
        return {
            t.strip()
            for t in text.split()
            if t.strip() and len(t.strip()) > 2 and t.strip() not in ARABIC_STOPWORDS
        }

    @staticmethod
    def _serialize(item: dict, similarity: float) -> dict:
        return {
            "title": item.get("title") or "",
            "summary": (item.get("summary") or item.get("text") or "")[:300],
            "url": item.get("url") or "",
            "source_name": item.get("source_name") or item.get("domain") or "",
            "domain": item.get("domain") or "",
            "pub_date": item.get("pub_date"),
            "kind": item.get("kind") or "",
            "engine": item.get("engine") or "",
            "similarity": round(float(similarity), 4),
        }

    async def _get_articles(self) -> list[Article]:
        async with self._cache_lock:
            now = datetime.now(timezone.utc)
            if (
                self._article_cache
                and self._cache_at
                and (now - self._cache_at).total_seconds() < self._cache_ttl_seconds
            ):
                return self._article_cache
            try:
                articles = await self.crawler.fetch_all(limit_per_source=15)
                if articles:
                    self._article_cache = articles
                    self._cache_at = now
                return articles
            except Exception as e:
                logger.warning("RSS fetch failed in A3: %s", e)
                return self._article_cache

    @staticmethod
    def _check_date_ok(matches: list[dict]) -> bool:
        if not matches:
            return False
        now = datetime.now(timezone.utc)
        for m in matches:
            iso = m.get("pub_date")
            if not iso:
                continue
            try:
                dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
                if (now - dt).days <= OLD_NEWS_DAYS:
                    return True
            except Exception:
                continue
        return False

    @staticmethod
    def _classify_confidence(
        matches: list[dict], web_results: list[dict], mode: str
    ) -> ConfidenceLevel:
        if not matches and not web_results:
            return ConfidenceLevel.LOW
        if mode == "real" and len(matches) >= 2:
            return ConfidenceLevel.HIGH
        if mode == "real" and (matches or len(web_results) >= 2):
            return ConfidenceLevel.MEDIUM
        return ConfidenceLevel.LOW

    def _timeout(self, start: float) -> AgentResult:
        return AgentResult(
            agent=self.agent_id,
            score=0.5,
            confidence=ConfidenceLevel.TIMEOUT,
            evidence=["agent timeout"],
            raw={"matches": [], "contradictions": [], "web_results": []},
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode="fallback",
        )

    def _fallback(self, text: str, start: float, error: str = "") -> AgentResult:
        return AgentResult(
            agent=self.agent_id,
            score=0.5,
            confidence=ConfidenceLevel.INSUFFICIENT_DATA,
            evidence=[f"error:{error[:80]}"] if error else [],
            raw={"matches": [], "contradictions": [], "web_results": [], "fallback": True},
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            mode="fallback",
        )
