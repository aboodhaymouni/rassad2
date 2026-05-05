"""Image/media preprocessing utilities.

Used by A2 (MediaAuthenticityAgent) to extract EXIF metadata and basic
file-property signals when no Hive API key is configured.
"""

from __future__ import annotations

import hashlib
import io
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class MediaSnapshot:
    """Lightweight summary of a media file."""

    sha256: str
    size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    format: Optional[str] = None
    mode: Optional[str] = None
    has_exif: bool = False
    exif_count: int = 0
    exif_tags: dict[str, str] = field(default_factory=dict)
    suspicious_flags: list[str] = field(default_factory=list)


class MediaProcessor:
    """Synchronous helper; cheap enough to call inside async agents."""

    def analyze(self, raw: bytes, filename: str = "") -> MediaSnapshot:
        snap = MediaSnapshot(
            sha256=hashlib.sha256(raw).hexdigest(),
            size_bytes=len(raw),
        )
        self._extract_pillow(raw, snap)
        self._extract_exif(raw, snap)
        self._heuristic_flags(snap, filename)
        return snap

    def _extract_pillow(self, raw: bytes, snap: MediaSnapshot) -> None:
        try:
            from PIL import Image

            img = Image.open(io.BytesIO(raw))
            img.verify()
            img2 = Image.open(io.BytesIO(raw))
            snap.width, snap.height = img2.size
            snap.format = img2.format
            snap.mode = img2.mode
        except Exception as e:
            logger.debug("Pillow open failed: %s", e)
            snap.suspicious_flags.append("pillow_open_failed")

    def _extract_exif(self, raw: bytes, snap: MediaSnapshot) -> None:
        try:
            import exifread

            tags = exifread.process_file(io.BytesIO(raw), details=False)
            if tags:
                snap.has_exif = True
                snap.exif_count = len(tags)
                # keep a small selection of high-signal tags
                keep = [
                    "Image Make",
                    "Image Model",
                    "EXIF DateTimeOriginal",
                    "GPS GPSLatitude",
                    "GPS GPSLongitude",
                    "Image Software",
                ]
                for k in keep:
                    if k in tags:
                        snap.exif_tags[k] = str(tags[k])[:200]
        except Exception as e:
            logger.debug("EXIF extraction failed: %s", e)

    def _heuristic_flags(self, snap: MediaSnapshot, filename: str) -> None:
        if not snap.has_exif:
            snap.suspicious_flags.append("no_exif_metadata")
        software = snap.exif_tags.get("Image Software", "").lower()
        for marker in ("photoshop", "midjourney", "stable", "dall-e", "ai"):
            if marker in software:
                snap.suspicious_flags.append(f"editor:{marker}")
        if snap.size_bytes < 8000:
            snap.suspicious_flags.append("very_small_file")
        if snap.format and snap.format.upper() == "WEBP":
            snap.suspicious_flags.append("webp_repackaged")
        lowered = filename.lower()
        for marker in ("ai_", "_ai", "midjourney", "synthetic", "fake"):
            if marker in lowered:
                snap.suspicious_flags.append(f"filename:{marker}")
