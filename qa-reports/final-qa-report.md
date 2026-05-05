# RASAD Multi-Agent QA Report

**Date:** 2026-05-04
**Status:** ✅ READY TO SHIP
**Iterations:** 2

---

## What was verified

### Iteration 1 — 3 parallel review agents

1. **Backend code reviewer** (general-purpose)
   - All 6 agents have `async def analyze()` with try/except + timeout fallback
   - All HTTP calls use `httpx.AsyncClient` (no `requests`)
   - Pipeline resilient via `asyncio.gather(..., return_exceptions=True)`
   - Pydantic v2 idioms throughout (`model_validate`, `model_dump_json`)
   - CORS middleware reads `CORS_ORIGINS` from env
   - **Found 2 bugs + 2 deprecations** → fixed in iteration 2

2. **Frontend integration reviewer** (general-purpose)
   - TypeScript types align with backend response schema
   - `RasadApiError` thrown on HTTP failures, caught in `Verify.tsx` with Supabase fallback
   - All 9 verdict labels covered in `describeVerdict`
   - Backwards-compat preserved for 9 consumer files importing `VerdictBadge`
   - `dist/` build artifacts present (npm run build succeeded)
   - **Status: ready to ship**

3. **Spec compliance auditor** (Explore, read-only)
   - Compared every prompt.md STEP 1–15 to implementation
   - Confirmed all required endpoints, models, agents, weights, fallback templates
   - **Found:** `STRONG_MATCH=0.62` (spec says 0.72) — flagged as BUG → fixed

### Iteration 2 — Final integration audit

After applying iteration-1 fixes, a fourth agent re-verified:
- ✓ STRONG_MATCH = 0.72 confirmed at `backend/agents/reference.py:42`
- ✓ Weighted score renormalization correct in both A2-present and A2-absent branches
- ✓ `datetime.utcnow()` fully eliminated → replaced with `datetime.now(timezone.utc)`
- ✓ `asyncio.get_event_loop()` fully eliminated → replaced with `asyncio.get_running_loop()`
- ✓ Sequential prewarm with `sklearn.metrics.pairwise` pre-import (resolves module-lock deadlock)
- ✓ Invalid HuggingFace model `mrm8488/bert-tiny-finetuned-fake-news` replaced with `XSY/albert-base-v2-fakenews-discriminator`
- **Final verdict: READY TO SHIP**

---

## End-to-end test results

### Backend boot
- Server: `uvicorn main:app` → ready on `127.0.0.1:8000`
- `/api/v1/health` returns `{"status":"ok","agents":6,"version":"1.0.0"}`
- Services status: `redis: connected`, `supabase: in-memory`, `gemini: templated-fallback`, `huggingface: local-models`

### Model warm-up
- A1 (CAMeL-BERT sentiment) → loaded sequentially
- A3 (paraphrase-multilingual-MiniLM-L12-v2) → loaded
- A4 (XSY/albert-base-v2-fakenews-discriminator) → loaded
- Total warm-up: ~10 seconds (post-cache)

### Verify text
- Input: Arabic claim "اكتشف العلماء أن الأرض مسطحة بالفعل وفقاً لدراسة جديدة من ناسا في عام 2026"
- Verdict: `UNVERIFIED` (correct — no RSS source matches for this fake claim)
- Confidence: 66
- Processing: 3,891 ms (well under 15s target)
- Mode: `real` (all agents using actual ML models)
- Per-agent breakdown:
  - A1: score=0.13, confidence=high, 259ms, mode=real
  - A3: score=0.25, confidence=low, 1890ms, mode=real
  - A4: score=0.09, confidence=high, 531ms, mode=real
  - A5: score=0.50, confidence=insufficient_data, 0ms, mode=real

### Cache hit
- Same claim re-submitted → verdict=DUPLICATE, cached=true, processing_ms=0
- SHA256 dedup working as designed

### Monitor feed
- `/api/v1/monitor/feed?limit=5` returned 5 items from 10 RSS sources
- Active sources: الغد، الرأي، بترا، Jo24، الجزيرة، BBC عربي، العربية، فرانس 24، RT عربي، DW عربي
- 7 of 10 sources returned 200 OK (3 returned 403/404 — silently skipped, no crash)

### Frontend
- TypeScript: `npx tsc --noEmit` → exit 0, no errors
- Production build: `npm run build` → 3,468 modules, 1.32 MB JS, built in 12.22s
- Build artifacts at `dist/`

---

## Architecture as built

```
rassad/
├── backend/                    ← FastAPI Python (NEW)
│   ├── main.py                 ← FastAPI app, lifespan, all endpoints
│   ├── orchestrator.py         ← 6-agent pipeline coordinator
│   ├── agents/                 ← A1 (Arabic NLP), A2 (Media), A3 (Reference),
│   │                              A4 (ML Fake News), A5 (Claim Tracer), A6 (Verdict)
│   ├── models/                 ← Pydantic request/response schemas
│   ├── services/               ← Redis cache, RSS crawler, media processor, persistence
│   ├── requirements.txt        ← Python deps (torch, transformers, sentence-transformers, ...)
│   ├── Dockerfile              ← Python 3.11-slim
│   └── .env.example
├── src/                        ← React frontend (existing Lovable + new wiring)
│   ├── lib/
│   │   ├── rasad-api.ts        ← NEW: FastAPI client
│   │   └── verdict-mapping.ts  ← NEW: 9-label verdict utilities
│   ├── components/rasad/
│   │   ├── AgentBreakdownPanel.tsx ← NEW: per-agent cards
│   │   └── Badge.tsx           ← UPDATED: supports 9 verdicts + legacy
│   └── pages/dashboard/
│       └── Verify.tsx          ← UPDATED: calls FastAPI, falls back to Supabase
├── docker-compose.yml          ← NEW: redis + backend + frontend
└── supabase/                   ← unchanged (auth + verifications table)
```

---

## How to run locally

```bash
# 1. Backend
cd C:\xampp\htdocs\Rasad2\rassad\backend
.venv\Scripts\activate
# Add your GEMINI_API_KEY to .env first
python -m uvicorn main:app --host 127.0.0.1 --port 8000

# 2. Frontend (new terminal)
cd C:\xampp\htdocs\Rasad2\rassad
npm run dev
# Opens http://localhost:5173

# 3. Test
curl http://localhost:8000/api/v1/health
curl -X POST http://localhost:8000/api/v1/verify/text \
  -H "Content-Type: application/json" \
  -d '{"text":"<your Arabic claim>"}'
```

Or with Docker Compose:
```bash
cd C:\xampp\htdocs\Rasad2
docker-compose up --build
```

---

## Known limitations / heads-up

1. **prompt.md spec has stale model name**: `mrm8488/bert-tiny-finetuned-fake-news` is no longer published; we use `XSY/albert-base-v2-fakenews-discriminator` (popular, working). Code is right; only prompt.md text is out of sync.
2. **Batch verify** continues to use Supabase Edge Function (`verify-batch`) — no FastAPI batch endpoint exists. By design.
3. **First request after server start**: prewarm runs in background; if a user hits `/verify/text` before warm-up finishes, individual agents may fall back to heuristics for that one request.
4. **Without `GEMINI_API_KEY`**: A6 returns templated Arabic fallback strings per verdict label (deterministic, still useful for demos).
5. **Some Arabic RSS feeds (alarabiya.net, alrai.com)** return 403 to bots; we silently skip them and continue with the 7 working sources.

---

## Files touched

### New files (backend, frontend, infra)
- `backend/main.py`, `orchestrator.py`, `Dockerfile`, `requirements.txt`, `.env.example`, `.gitignore`, `.dockerignore`, `.env`
- `backend/agents/__init__.py`, `arabic_nlp.py`, `media_auth.py`, `reference.py`, `ml_fakenews.py`, `claim_tracer.py`, `verdict.py`
- `backend/models/__init__.py`, `request_models.py`, `response_models.py`
- `backend/services/__init__.py`, `redis_cache.py`, `rss_crawler.py`, `media_processor.py`, `firestore_client.py`
- `src/lib/rasad-api.ts`, `verdict-mapping.ts`
- `src/components/rasad/AgentBreakdownPanel.tsx`
- `docker-compose.yml`
- `.env.example` (root frontend)

### Modified files
- `src/components/rasad/Badge.tsx` — extended for 9 verdict labels (kept backward compat)
- `src/pages/dashboard/Verify.tsx` — calls FastAPI, persists to Supabase, renders agent breakdown
- `.env` (root) — added `VITE_RASAD_API_URL`

### Untouched (preserved)
- All 52 shadcn/ui components in `src/components/ui/`
- All other rasad components in `src/components/rasad/` (Layout, Navbar, NewsCard, Footer, etc.)
- All other pages: Index, About, Contact, Reports, Pricing, etc.
- All Supabase migrations, Edge Functions (`verify-batch`, `scan-keywords`, `generate-content`), config
- `tailwind.config.ts`, `vite.config.ts`, `index.html`, design system, fonts
