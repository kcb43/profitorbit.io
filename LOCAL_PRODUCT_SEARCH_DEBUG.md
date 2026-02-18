# Local Product Search Debug – Worker + Logs

Use this to run the Orben search worker locally and capture logs to track why some products show "Link Unavailable" and $0.

## Hypotheses we're testing

1. **H1 – Price**: SerpAPI `immersive_products` return price in a different field or format (e.g. string, or 0), so we store 0.
2. **H2 – Offers shape**: `getProductOffers` (google_immersive_product) returns stores under a different path or store objects use a different field for the merchant URL, so we get 0 offers after mapping.
3. **H3 – Token**: Many products have no or invalid `immersive_product_page_token`, so we never get offers for them (or the offers API fails).
4. **H4 – Cache**: Cached search results from an older run have empty offers / $0, so we keep serving them until cache expires.
5. **H5 – Frontend**: We rely on `merchantOffers` for links; when they're empty we show "Link Unavailable" (data flow; fix is in worker/API).

## Run worker locally and capture logs

### 1. Start the search worker locally

```bash
cd f:\bareretail\orben-search-worker
# Ensure .env has REDIS_URL, SERPAPI_KEY (and SUPABASE_* if you use snapshots)
npm run dev
```

Worker listens on **port 8081** by default.

### 2. Point Orben API at the local worker

Run orben-api locally and set the worker URL to your machine:

```bash
cd f:\bareretail\orben-api
# Windows PowerShell:
$env:ORBEN_SEARCH_WORKER_URL="http://localhost:8081"
# Optional: if your Orben API runs on a different port
$env:PORT="8080"
npm run dev
```

Orben API will call `http://localhost:8081/search` and `http://localhost:8081/product-offers` instead of Fly.

### 3. Point frontend at local Orben API

In the app's `.env.local` (or Vite env):

```env
VITE_ORBEN_API_URL=http://localhost:8080
```

Then run the frontend (e.g. `npm run dev` in the repo root) and open the Product Search page.

### 4. Soft reset without Redis (no hard reset needed)

To force a fresh search on every page load (bypass Redis cache), open Product Search with a query param:

- **URL:** `http://localhost:5173/product-search?fresh=1`  
  (or your frontend origin + path, then add `?fresh=1` or `&fresh=1`)

Each time you **refresh the page** and run a search, the frontend sends `cache_bust=<timestamp>` so the worker skips cache and hits SerpAPI again. You don’t need to clear Redis or restart anything.

### 5. Logs

- **Ingest:** Worker sends debug payloads to  
  `http://127.0.0.1:7243/ingest/27e41dcb-2d20-4818-a02b-7116067c6ef1`  
  (Cursor’s debug ingest; only works when the worker runs on the same machine as Cursor.)
- **Log file:** Ingested logs are written to  
  `f:\bareretail\.cursor\debug.log`  
  (NDJSON, one JSON object per line.)

After reproducing the bug, open `.cursor\debug.log` and look for:

- `getProductOffers:entry` / `getProductOffers:response` / `getProductOffers:return` – H2, H3
- `search:immersiveFirst` – H1, H3 (first product price/link/token)

## Quick checklist

- [ ] Worker running locally (`orben-search-worker`, port 8081)
- [ ] Orben API running with `ORBEN_SEARCH_WORKER_URL=http://localhost:8081`
- [ ] Frontend using `VITE_ORBEN_API_URL=http://localhost:8080` (or your orben-api port)
- [ ] Product Search opened with `?fresh=1` so each refresh bypasses cache
- [ ] One search performed; then inspect `f:\bareretail\.cursor\debug.log`
