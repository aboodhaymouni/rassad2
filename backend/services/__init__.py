"""External service integrations: cache, RSS, media, persistence, web."""

from .redis_cache import RedisCache
from .rss_crawler import RSSCrawler, Article, ARABIC_SOURCES
from .media_processor import MediaProcessor
from .firestore_client import FirestoreClient
from .web_search import WebSearchService, SearchResult, ARABIC_NEWS_SITES
from .web_scraper import WebScraper, ScrapedArticle
from .query_expander import QueryExpander
from .live_monitor import LiveMonitor, LiveItem

__all__ = [
    "RedisCache",
    "RSSCrawler",
    "Article",
    "ARABIC_SOURCES",
    "MediaProcessor",
    "FirestoreClient",
    "WebSearchService",
    "SearchResult",
    "ARABIC_NEWS_SITES",
    "WebScraper",
    "ScrapedArticle",
    "QueryExpander",
    "LiveMonitor",
    "LiveItem",
]
