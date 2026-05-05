"""RASAD FastAPI application entry point."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models.request_models import VerifyTextRequest, VerifyURLRequest
from models.response_models import (
    FinalVerdict,
    HealthResponse,
    MonitorItem,
    VerdictLabel,
)
from orchestrator import MainOrchestrator
from services.firestore_client import FirestoreClient
from services.live_monitor import LiveMonitor
from services.query_expander import QueryExpander
from services.redis_cache import RedisCache
from services.rss_crawler import ARABIC_SOURCES, RSSCrawler
from services.web_scraper import WebScraper
from services.web_search import WebSearchService

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rasad")


orchestrator: Optional[MainOrchestrator] = None
shared_crawler: Optional[RSSCrawler] = None
shared_cache: Optional[RedisCache] = None
shared_store: Optional[FirestoreClient] = None
shared_search: Optional[WebSearchService] = None
shared_scraper: Optional[WebScraper] = None
shared_query_expander: Optional[QueryExpander] = None
live_monitor: Optional[LiveMonitor] = None


async def _prewarm_models(orch: MainOrchestrator) -> None:
    """Run a tiny no-op analyze() per heavy agent to populate the HF cache.

    Runs sequentially (not in parallel) to avoid a Python module-import
    deadlock between transformers/sklearn when multiple agents try to load
    models from worker threads simultaneously.
    """
    sample = "نص تجريبي قصير لتحميل النماذج عند بدء الخدمة."
    # Pre-import shared sklearn dependency on the main thread to dodge
    # the _ModuleLock deadlock that hits when several executor threads
    # import sklearn.metrics.pairwise at the same time.
    try:
        import sklearn.metrics.pairwise  # noqa: F401
    except Exception:
        pass
    for agent_name, coro_factory in [
        ("A1", lambda: orch.a1.analyze(sample)),
        ("A3", lambda: orch.a3.analyze(sample)),
        ("A4", lambda: orch.a4.analyze(sample)),
    ]:
        try:
            await coro_factory()
            logger.info("Warm-up: %s ready.", agent_name)
        except Exception as e:
            logger.warning("Warm-up: %s skipped (%s).", agent_name, e)
    logger.info("Model warm-up complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global orchestrator, shared_crawler, shared_cache, shared_store
    global shared_search, shared_scraper, shared_query_expander, live_monitor
    logger.info("RASAD starting up...")
    shared_cache = RedisCache(
        url=os.getenv("REDIS_URL"),
        ttl_seconds=int(os.getenv("CACHE_TTL_SECONDS", "86400")),
    )
    shared_store = FirestoreClient()
    shared_crawler = RSSCrawler()
    shared_search = WebSearchService()
    shared_scraper = WebScraper()
    shared_query_expander = QueryExpander()
    orchestrator = MainOrchestrator(cache=shared_cache, store=shared_store)
    # Share single web/RSS instances with A3 (per-process singletons).
    orchestrator.a3.web_search = shared_search
    orchestrator.a3.scraper = shared_scraper
    orchestrator.a3.query_expander = shared_query_expander
    orchestrator.a3.crawler = shared_crawler
    live_monitor = LiveMonitor(
        crawler=shared_crawler,
        cache=shared_cache,
        a1=orchestrator.a1,
        a4=orchestrator.a4,
        interval_seconds=int(os.getenv("LIVE_MONITOR_INTERVAL", "240")),
    )
    logger.info(
        "RASAD ready. Agents: 6, Gemini: %s, HF: %s, Search engines: %s",
        bool(os.getenv("GEMINI_API_KEY")),
        bool(os.getenv("HF_API_TOKEN")),
        ",".join(k for k, v in shared_search.status().items() if v),
    )
    if os.getenv("RASAD_PREWARM", "1") != "0":
        import asyncio as _asyncio

        async def _warmup_then_monitor():
            await _prewarm_models(orchestrator)
            if os.getenv("RASAD_LIVE_MONITOR", "1") != "0" and live_monitor is not None:
                await live_monitor.start()

        _asyncio.create_task(_warmup_then_monitor())
    elif os.getenv("RASAD_LIVE_MONITOR", "1") != "0" and live_monitor is not None:
        await live_monitor.start()
    yield
    logger.info("RASAD shutting down...")
    if live_monitor is not None:
        await live_monitor.stop()
    if shared_cache is not None:
        await shared_cache.close()


app = FastAPI(
    title="RASAD | رصد",
    version="1.0.0",
    description="AI-Powered Arabic News Verification Platform — 6 specialized agents",
    lifespan=lifespan,
)

cors_origins = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost:8080"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins if o.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.",
            "detail": str(exc)[:200],
        },
    )


def _orch() -> MainOrchestrator:
    if orchestrator is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    return orchestrator


@app.get("/")
async def root():
    return {
        "service": "RASAD",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


@app.get("/api/v1/health", response_model=HealthResponse)
async def health():
    services_status = {
        "redis": "connected" if shared_cache and not shared_cache._using_fallback else "in-memory",
        "supabase": "configured" if (shared_store and shared_store._enabled) else "in-memory",
        "gemini": "configured" if os.getenv("GEMINI_API_KEY") else "templated-fallback",
        "huggingface": "configured" if os.getenv("HF_API_TOKEN") else "local-models",
    }
    return HealthResponse(
        status="ok",
        agents=6,
        version="1.0.0",
        services=services_status,
        environment=os.getenv("ENVIRONMENT", "development"),
    )


@app.post("/api/v1/verify/text", response_model=FinalVerdict)
async def verify_text(payload: VerifyTextRequest):
    return await _orch().run_pipeline(
        content=payload.text,
        content_type="text",
    )


@app.post("/api/v1/verify/url", response_model=FinalVerdict)
async def verify_url(payload: VerifyURLRequest):
    article_text = await _fetch_article_text(str(payload.url))
    if not article_text or len(article_text) < 30:
        raise HTTPException(
            status_code=400,
            detail="Could not extract enough article text from this URL.",
        )
    verdict = await _orch().run_pipeline(
        content=article_text,
        content_type="url",
    )
    if str(payload.url) not in verdict.sources:
        verdict.sources.append(str(payload.url))
    return verdict


@app.post("/api/v1/verify/media", response_model=FinalVerdict)
async def verify_media(
    file: UploadFile = File(...),
    context_text: str = Form(""),
    media_type: str = Form("image"),
):
    if not file:
        raise HTTPException(status_code=400, detail="Media file required")
    raw = await file.read()
    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 12MB)")
    return await _orch().run_pipeline(
        content=context_text or f"[{media_type} upload: {file.filename}]",
        content_type=media_type,
        media_bytes=raw,
        media_filename=file.filename or "",
    )


@app.get("/api/v1/verify/{verdict_id}", response_model=FinalVerdict)
async def get_verdict(verdict_id: str):
    if shared_store is None:
        raise HTTPException(status_code=503, detail="Store not ready")
    result = await shared_store.get(verdict_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Verdict not found")
    return result


@app.get("/api/v1/monitor/feed")
async def monitor_feed(limit: int = 20):
    if shared_crawler is None:
        return {"items": [], "sources": []}
    articles = await shared_crawler.fetch_all(limit_per_source=4)
    items: list[MonitorItem] = []
    for a in articles[:limit]:
        items.append(
            MonitorItem(
                id=a.url[-32:] if a.url else a.title[:32],
                title=a.title,
                summary=a.summary or a.text[:200],
                url=a.url,
                source_name=a.source_name,
                published_at=a.pub_date.isoformat() if a.pub_date else "",
                flagged=False,
            )
        )
    return {
        "items": [i.model_dump() for i in items],
        "sources": [s["name"] for s in ARABIC_SOURCES],
    }


@app.get("/api/v1/monitor/trending")
async def monitor_trending(limit: int = 10):
    if shared_store is None:
        return {"items": []}
    recent = await shared_store.list_recent(limit=limit)
    return {
        "items": [
            {
                "id": v.id,
                "verdict": v.verdict.value,
                "confidence": v.confidence,
                "explanation": v.arabic_explanation[:140],
                "created_at": v.created_at,
            }
            for v in recent
        ]
    }


@app.get("/api/v1/live/feed")
async def live_feed(
    limit: int = 30,
    since: Optional[str] = None,
    risk: Optional[str] = None,
    domain: Optional[str] = None,
    topic: Optional[str] = None,
):
    """Public live feed of monitored news with quick-pass risk scores.

    Long-poll friendly: pass `since=<ISO timestamp>` to get only items newer
    than that timestamp; combine with reasonable polling interval (10-15s).
    """
    if live_monitor is None:
        return {"items": [], "watermark": None, "monitor": "disabled"}
    items = await live_monitor.feed(
        limit=min(max(1, limit), 100),
        since=since,
        risk=risk,
        domain=domain,
        topic=topic,
    )
    watermark = items[0]["seen_at"] if items else (live_monitor.last_run_at or None)
    return {"items": items, "watermark": watermark, "monitor": "live"}


@app.get("/api/v1/live/stats")
async def live_stats():
    if live_monitor is None:
        return {"monitor": "disabled"}
    out = await live_monitor.stats()
    out["monitor"] = "live"
    return out


@app.post("/api/v1/live/refresh")
async def live_refresh():
    """Force the live monitor to wake up immediately. No auth — public."""
    if live_monitor is None:
        raise HTTPException(status_code=503, detail="Monitor not running")
    live_monitor.kick()
    return {"ok": True, "kicked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}


@app.get("/api/v1/search")
async def search_web(
    q: str,
    limit: int = 10,
    language: str = "ar",
    comprehensive: bool = False,
    scrape: bool = False,
):
    """Direct web-search endpoint.

    Query params:
    - q              the search query
    - limit          max results to return (default 10)
    - language       'ar' or 'en'
    - comprehensive  when true, performs site-targeted + quoted + Wikipedia fan-out
    - scrape         when true, fetches and parses each result with trafilatura
    """
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    if shared_search is None:
        raise HTTPException(status_code=503, detail="Search not ready")
    if comprehensive:
        results = await shared_search.comprehensive_search(q, language=language, total_limit=limit)
    else:
        results = await shared_search.search(q, language=language, limit=limit)
    items = [
        {
            "title": r.title,
            "url": r.url,
            "snippet": r.snippet,
            "source_domain": r.source_domain,
            "language": r.language,
            "pub_date": r.pub_date,
            "engine": r.engine,
            "score": r.score,
        }
        for r in results
    ]
    if scrape and shared_scraper is not None:
        urls = [r.url for r in results[: min(len(results), 6)]]
        scraped = await shared_scraper.fetch_many(urls, concurrency=5)
        scraped_map = {s.url: s for s in scraped}
        for it in items:
            sa = scraped_map.get(it["url"])
            if sa and sa.text:
                it["scraped"] = {
                    "title": sa.title,
                    "summary": sa.summary,
                    "word_count": sa.word_count,
                    "language": sa.language,
                    "method": sa.method,
                    "pub_date": sa.pub_date,
                }
    return {
        "query": q,
        "language": language,
        "comprehensive": comprehensive,
        "scraped": scrape,
        "engines": shared_search.status(),
        "count": len(items),
        "results": items,
    }


@app.get("/api/v1/monitor/sources")
async def monitor_sources():
    return {
        "sources": [
            {"name": s["name"], "url": s["url"], "status": "active"}
            for s in ARABIC_SOURCES
        ]
    }


@app.get("/api/v1/stats")
async def stats():
    if shared_cache is None:
        return {"verifications_total": 0}
    counters = {}
    counters["verifications_total"] = await shared_cache.get_counter("verifications_total")
    for label in VerdictLabel:
        counters[f"verdict_{label.value.lower()}"] = await shared_cache.get_counter(
            f"verdict:{label.value}"
        )
    return counters


async def _fetch_article_text(url: str) -> str:
    """Fetch a URL and extract main article text via readability."""
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; RASAD-Bot/1.0; +https://rassad.io)"
                },
            )
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")

    try:
        from readability import Document

        doc = Document(html)
        title = doc.short_title() or ""
        body = doc.summary() or ""
        # Strip HTML tags from body
        from html.parser import HTMLParser

        class _Strip(HTMLParser):
            def __init__(self):
                super().__init__()
                self.parts: list[str] = []

            def handle_data(self, data):
                self.parts.append(data)

        p = _Strip()
        p.feed(body)
        text = " ".join(p.parts).strip()
        combined = (title + ". " + text).strip(". ").strip()
        return combined[:8000]
    except Exception as e:
        logger.warning("readability failed (%s); using raw HTML", e)
        # Last-resort fallback
        text = " ".join(html.split())
        return text[:4000]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("ENVIRONMENT", "development") == "development",
    )
