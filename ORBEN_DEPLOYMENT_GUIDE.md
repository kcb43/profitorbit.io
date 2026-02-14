# Orben Deal Intelligence + Universal Product Search
# Complete Deployment Guide

## Overview

You've built a clean, scalable deal intelligence system with:
- **3 Fly.io Apps**: orben-api, orben-deal-worker, orben-search-worker
- **Supabase**: 8 tables for deals, sources, submissions, search snapshots
- **Redis/Upstash**: Caching, locks, rate limiting
- **Vercel**: 3 new frontend pages (Deals, ProductSearch, SubmitDeal)

All based on **syndicated sources only** (RSS, APIs, affiliate feeds) - no scraping.

---

## 1. Prerequisites

✅ You already have:
- Supabase project
- Vercel account
- Fly.io account (from existing worker deployment)

Need to add:
- **Upstash Redis** (free tier works): https://upstash.com/
  - **Why Redis?** Supabase = Postgres (persistent DB), Redis = in-memory cache (sub-ms reads, TTL, locks)
  - You need BOTH: Supabase for durable data, Redis for caching/rate-limiting
  - Alternative: Use Fly Redis instead of Upstash if you prefer
- **eBay Developer Account**: https://developer.ebay.com/
- **RapidAPI Account** (for Google Shopping): https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-product-search

---

## 2. Step-by-Step Deployment

### A. Apply Supabase Migration

```bash
cd f:\bareretail

# Apply the Orben migration
supabase db push

# OR manually via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Paste contents of supabase/migrations/20260213_orben_deal_system.sql
# 3. Run
```

**Verify tables created:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'deal%' OR table_name LIKE 'search%';
```

Should see: `deal_sources`, `deals`, `deal_events`, `deal_ingestion_runs`, `deal_submissions`, `deal_saves`, `search_snapshots`

---

### B. Set Up Redis (Upstash)

1. Go to https://upstash.com/ and create a free Redis database
2. Copy the Redis URL (looks like: `rediss://default:xxx@...upstash.io:6379`)
3. Keep this for the next steps

---

### C. Deploy orben-deal-worker (Fly.io)

```bash
cd orben-deal-worker

# Install dependencies
npm install

# Create Fly app
fly launch --no-deploy

# Set secrets
fly secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
  REDIS_URL="YOUR_UPSTASH_REDIS_URL"

# Deploy
fly deploy

# Check logs
fly logs
```

**Expected output:** Should see polling messages every 60 seconds

---

### D. Deploy orben-search-worker (Fly.io)

```bash
cd ../orben-search-worker

npm install

fly launch --no-deploy

# Set secrets (including provider keys)
fly secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
  REDIS_URL="YOUR_UPSTASH_REDIS_URL" \
  EBAY_APP_ID="YOUR_EBAY_APP_ID" \
  EBAY_CERT_ID="YOUR_EBAY_CERT_ID" \
  RAPIDAPI_KEY="YOUR_RAPIDAPI_KEY_OR_LEAVE_BLANK"

fly deploy

# Test health
curl https://orben-search-worker.fly.dev/health
```

---

### E. Deploy orben-api (Fly.io)

```bash
cd ../orben-api

npm install

fly launch --no-deploy

# Set secrets
fly secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
  SUPABASE_ANON_KEY="YOUR_ANON_KEY" \
  REDIS_URL="YOUR_UPSTASH_REDIS_URL" \
  ORBEN_SEARCH_WORKER_URL="https://orben-search-worker.fly.dev"

fly deploy

# Test
curl https://orben-api.fly.dev/v1/health
```

---

### F. Configure Vercel Frontend

1. **Add environment variable in Vercel:**
   - Go to your Vercel project → Settings → Environment Variables
   - Add: `VITE_ORBEN_API_URL` = `https://orben-api.fly.dev`

2. **Update .env.example:**
```bash
# Add to f:\bareretail\.env.example
VITE_ORBEN_API_URL=https://orben-api.fly.dev
```

3. **Deploy to Vercel:**
```bash
cd f:\bareretail
git add .
git commit -m "Add Orben deal intelligence system"
git push origin main
```

Vercel will auto-deploy.

---

### G. Add More Deal Sources (Admin)

The system ships with DealCatcher.com already seeded. Add more sources via API or SQL:

**Option 1: SQL (Supabase SQL Editor)**
```sql
INSERT INTO deal_sources (name, type, base_url, rss_url, enabled, notes)
VALUES 
  ('Slickdeals Frontpage', 'rss', 'https://slickdeals.net', 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', true, 'Popular deals'),
  ('TechBargains', 'rss', 'https://www.techbargains.com', 'https://www.techbargains.com/rss/deals.xml', true, 'Tech deals'),
  ('Brad''s Deals', 'rss', 'https://www.bradsdeals.com', 'https://www.bradsdeals.com/deals/feed', true, 'General deals');
```

**Option 2: API (coming soon - admin endpoints)**

---

## 3. Testing End-to-End

### A. Test Deal Ingestion

1. Check worker logs: `fly logs -a orben-deal-worker`
2. Query deals via API:
```bash
curl "https://orben-api.fly.dev/v1/deals/feed?limit=10"
```

3. Check Supabase:
```sql
SELECT COUNT(*) FROM deals;
SELECT * FROM deal_ingestion_runs ORDER BY started_at DESC LIMIT 5;
```

### B. Test Frontend

1. Go to your Vercel app: `https://yourapp.vercel.app/deals`
2. Should see deal feed with filters
3. Try searching, saving deals
4. Go to `/deals/submit` and submit a manual deal
5. Go to `/product-search` and search for a product (requires login)

### C. Test Universal Search

```bash
# Via API (need JWT token)
curl -H "Authorization: Bearer YOUR_JWT" \
  "https://orben-api.fly.dev/v1/search?q=iPhone%2015&providers=ebay"
```

---

## 4. Optional: Additional Deal Sources

### RSS Feeds (easy to add)
- **FatWallet**: Mostly defunct, but some mirrors exist
- **DealNews**: `https://www.dealnews.com/features/RSS/`
- **Woot**: `https://www.woot.com/category.rss`
- **Ben's Bargains**: Check for RSS feed
- **Offers.com**: Check for RSS feed

### Affiliate Feeds (requires partnership)
- **ShareASale**: Join affiliate network → get data feeds
- **CJ Affiliate**: Same process
- **Rakuten Advertising**: Same process
- **Impact**: Same process

### Retailer APIs (need approval)
- **Best Buy API**: https://developer.bestbuy.com/
- **Walmart Open API**: https://developer.walmart.com/
- **Target API**: (Harder to get access)
- **Amazon Product Advertising API**: https://affiliate-program.amazon.com/

---

## 5. Monitoring & Maintenance

### Check Deal Worker Health
```bash
fly logs -a orben-deal-worker

# Should see:
# [DealCatcher] Starting ingestion...
# [DealCatcher] Fetched 50 items
# [DealCatcher] Success: 5 created, 2 updated, 50 seen
```

### Check Search Worker
```bash
fly logs -a orben-search-worker
fly status -a orben-search-worker
```

### Check Redis Usage (Upstash Dashboard)
- Monitor cache hit rates
- Check quota usage
- View key patterns

### Supabase Monitoring
```sql
-- Check deal growth
SELECT DATE(created_at) as date, COUNT(*) as deals_added
FROM deals
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;

-- Check top merchants
SELECT merchant, COUNT(*) as deal_count, AVG(score) as avg_score
FROM deals
WHERE status = 'active'
GROUP BY merchant
ORDER BY deal_count DESC
LIMIT 10;

-- Check ingestion runs
SELECT 
  ds.name,
  dir.status,
  dir.items_created,
  dir.items_updated,
  dir.started_at
FROM deal_ingestion_runs dir
JOIN deal_sources ds ON ds.id = dir.source_id
ORDER BY dir.started_at DESC
LIMIT 20;
```

---

## 6. Cost Breakdown (Monthly Estimates)

| Service | Usage | Cost |
|---------|-------|------|
| **Supabase** | Database + Auth | Free tier (likely sufficient) |
| **Upstash Redis** | Caching | Free tier: 10k requests/day |
| **Fly.io** (3 apps) | Always-on worker + 2 auto-scale | ~$15-30/month |
| **Vercel** | Frontend hosting | Free tier |
| **eBay API** | Product search | Free (usage limits apply) |
| **RapidAPI** | Google Shopping search | Free tier: 100 req/mo, then $10/mo |
| **TOTAL** | | **$15-40/month** |

---

## 7. Scaling Considerations

### When You Outgrow This Setup:

1. **More deals**: Increase Fly worker memory (512MB → 1GB)
2. **More searches**: Scale search worker horizontally (add regions)
3. **Redis limits**: Upgrade Upstash plan
4. **Database growth**: Archive old deals monthly
5. **Better scoring**: Add ML model for ROI prediction

---

## 8. Troubleshooting

### Worker not ingesting deals?
```bash
fly logs -a orben-deal-worker
# Check for:
# - Network errors (RSS feed down)
# - Supabase connection errors
# - Redis connection errors
```

### Search not working?
```bash
fly logs -a orben-search-worker
# Check provider API keys
# Verify quota not exceeded
```

### Frontend not loading deals?
- Check browser console for CORS errors
- Verify `VITE_ORBEN_API_URL` is set in Vercel
- Check API health: `curl https://orben-api.fly.dev/v1/health`

---

## 9. Next Steps (Future Enhancements)

- [ ] Add admin dashboard for source management
- [ ] Implement deal scoring improvements (comps from search)
- [ ] Add email/webhook notifications for hot deals
- [ ] Add deal categories/tags
- [ ] Implement deal expiration checking
- [ ] Add user preferences for deal types
- [ ] Add deal analytics/reporting
- [ ] Implement affiliate link transformation
- [ ] Add deal sharing (social, Discord, Telegram)

---

## 10. Quick Reference: All Endpoints

### Deals API (`https://orben-api.fly.dev`)

```
GET  /v1/health
GET  /v1/deals/feed?q=&merchant=&category=&min_score=&limit=&offset=
GET  /v1/deals/:dealId
POST /v1/deals/:dealId/save
DELETE /v1/deals/:dealId/save
GET  /v1/deals/saved
POST /v1/deals/manual
POST /v1/deals/flag

GET  /v1/search?q=&providers=&country=&limit=
POST /v1/search/snapshot
GET  /v1/search/snapshot/:id

GET  /v1/admin/deals/sources
POST /v1/admin/deals/sources
PATCH /v1/admin/deals/sources/:id
POST /v1/admin/deals/ingest/run
GET  /v1/admin/deals/ingest/runs
GET  /v1/admin/deals/submissions
PATCH /v1/admin/deals/submissions/:id
```

### Frontend Routes

```
/deals                - Deal feed
/deals/submit         - Submit manual deal
/product-search       - Universal product search
```

---

## Summary: What You Built

✅ **3 Fly.io workers** (deal ingestion, search, API)  
✅ **8 Supabase tables** with RLS policies  
✅ **Redis caching** layer  
✅ **RSS feed polling** with dedupe + scoring  
✅ **Multi-provider product search** (eBay, Google)  
✅ **3 frontend pages** integrated with Vercel  
✅ **Manual deal submissions** workflow  
✅ **User watchlists**  
✅ **Clean architecture** - no scraping, all official APIs  

**Total Setup Time**: ~30-45 minutes if you have all API keys ready.

**Ready to scale**: Just add more deal sources to `deal_sources` table and the worker will automatically start ingesting them.

---

## Contact & Support

If you need help deploying or want to add more features, let me know!

The system is production-ready and follows best practices:
- Proper error handling
- Rate limiting
- Caching
- RLS security
- Clean separation of concerns
- Observable (logs, health checks)
- Cost-effective

Enjoy your deal intelligence system! 🚀
