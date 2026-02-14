# 🎯 Orben Deal Intelligence System

A complete, production-ready deal aggregation and universal product search platform built for resellers.

## 🚀 What You Just Built

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Next.js UI)                       │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐      │
│  │  Deals   │  │ Product      │  │  Submit Deal     │      │
│  │  Feed    │  │ Search       │  │  (Manual)        │      │
│  └──────────┘  └──────────────┘  └──────────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS/JWT
                         │
              ┌──────────▼─────────────┐
              │   ORBEN-API (Fly.io)   │
              │  • Deal feed endpoint  │
              │  • Save/unsave deals   │
              │  • Search aggregation  │
              │  • Admin endpoints     │
              └──┬──────────────────┬──┘
                 │                  │
        ┌────────▼────────┐  ┌─────▼────────────┐
        │ ORBEN-DEAL      │  │ ORBEN-SEARCH     │
        │ WORKER          │  │ WORKER           │
        │ (Fly.io)        │  │ (Fly.io)         │
        │                 │  │                  │
        │ • RSS polling   │  │ • eBay API       │
        │ • Normalization │  │ • Google/RapidAPI│
        │ • Dedupe        │  │ • Oxylabs        │
        │ • Scoring       │  │ • Cache-first    │
        └────────┬────────┘  └──────┬───────────┘
                 │                  │
     ┌───────────▼──────────────────▼───────────┐
     │         REDIS (Upstash)                   │
     │  • Deal cards cache                       │
     │  • Search results cache                   │
     │  • Rate limiting                          │
     │  • Ingestion locks                        │
     └───────────────────────────────────────────┘
                         │
              ┌──────────▼─────────────┐
              │  SUPABASE (Postgres)   │
              │  • 8 tables            │
              │  • RLS policies        │
              │  • Auth (JWT)          │
              └────────────────────────┘
```

### Key Features

✅ **Deal Intelligence Feed**
- RSS/API ingestion from syndicated sources
- Smart deduplication (hash-based)
- 0-100 scoring for reseller value
- Filter by merchant, category, score
- User watchlists
- Manual employee submissions

✅ **Universal Product Search**
- Multi-provider search (eBay, Google Shopping)
- Cache-first strategy (6-24h TTL)
- Rate limiting per user/provider
- Search history/snapshots
- Price comparison across marketplaces

✅ **Clean Data Sources**
- RSS feeds (DealCatcher, Slickdeals, TechBargains, etc.)
- Affiliate feeds (ShareASale, CJ, Rakuten)
- Retailer APIs (Best Buy, Walmart)
- Manual submissions
- **NO scraping/stealth** - all official sources

✅ **Production Ready**
- Row-level security (RLS)
- Redis caching layers
- Health checks + monitoring
- Horizontal scaling ready
- Cost-efficient ($15-40/month)

---

## 📦 Project Structure

```
f:\bareretail\
├── orben-api/              # HTTP API (Fastify)
│   ├── index.js            # All endpoints (deals, search, admin)
│   ├── fly.toml
│   ├── Dockerfile
│   └── package.json
│
├── orben-deal-worker/      # RSS/feed ingestion worker
│   ├── index.js            # Polling loop + normalization
│   ├── fly.toml
│   ├── Dockerfile
│   └── package.json
│
├── orben-search-worker/    # Product search worker
│   ├── index.js            # Multi-provider search
│   ├── fly.toml
│   ├── Dockerfile
│   └── package.json
│
├── src/pages/              # Vercel frontend
│   ├── Deals.jsx           # Deal feed UI
│   ├── ProductSearch.jsx   # Universal search UI
│   └── SubmitDeal.jsx      # Manual submission form
│
├── supabase/migrations/
│   ├── 20260213_orben_deal_system.sql
│   └── 20260213_orben_additional_sources.sql
│
└── ORBEN_DEPLOYMENT_GUIDE.md  # Step-by-step deployment
```

---

## 🎯 Quick Start

### 1. Apply Database Migrations

```bash
cd f:\bareretail

# Option A: Using Supabase CLI
supabase db push

# Option B: Manually via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Run: supabase/migrations/20260213_orben_deal_system.sql
# 3. Run: supabase/migrations/20260213_orben_additional_sources.sql
```

### 2. Set Up Redis

1. Go to https://upstash.com/
2. Create a free Redis database
3. Copy the connection URL

### 3. Deploy Workers to Fly.io

```bash
# Deal Worker
cd orben-deal-worker
npm install
fly launch --no-deploy
fly secrets set SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." REDIS_URL="..."
fly deploy

# Search Worker
cd ../orben-search-worker
npm install
fly launch --no-deploy
fly secrets set SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." REDIS_URL="..." EBAY_APP_ID="..." RAPIDAPI_KEY="..."
fly deploy

# API
cd ../orben-api
npm install
fly launch --no-deploy
fly secrets set SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." SUPABASE_ANON_KEY="..." REDIS_URL="..." ORBEN_SEARCH_WORKER_URL="https://orben-search-worker.fly.dev"
fly deploy
```

### 4. Configure Vercel

Add environment variable in Vercel dashboard:
```
VITE_ORBEN_API_URL = https://orben-api.fly.dev
```

Then deploy:
```bash
git add .
git commit -m "Add Orben system"
git push origin main
```

### 5. Test!

Visit your Vercel app:
- `/deals` - See deal feed
- `/product-search` - Search products
- `/deals/submit` - Submit manual deal

---

## 📊 Database Schema

### Core Tables

**deal_sources**
- Registry of RSS/API sources
- Poll intervals, last run times
- Enable/disable per source

**deals**
- Canonical normalized deals
- Dedupe via hash (title + url + merchant + price_bucket)
- Score 0-100 for reseller value
- Status: active/expired/hidden

**deal_events**
- Audit trail (created, updated, expired, flagged)

**deal_ingestion_runs**
- Track each polling run
- Items seen/created/updated
- Error tracking

**deal_submissions**
- Manual submissions from users
- Approval workflow (pending/approved/rejected)

**deal_saves**
- User watchlists

**search_snapshots**
- Cached universal search results
- 24h expiration

---

## 🔌 API Endpoints

### Public/User Endpoints

```
GET  /v1/health
GET  /v1/deals/feed?q=&merchant=&category=&min_score=&limit=50
GET  /v1/deals/:id
POST /v1/deals/:id/save          (requires auth)
DELETE /v1/deals/:id/save        (requires auth)
GET  /v1/deals/saved             (requires auth)
POST /v1/deals/manual            (requires auth)
POST /v1/deals/flag              (requires auth)
GET  /v1/search?q=&providers=&country=US  (requires auth)
POST /v1/search/snapshot         (requires auth)
GET  /v1/search/snapshot/:id     (requires auth)
```

### Admin Endpoints

```
GET  /v1/admin/deals/sources
POST /v1/admin/deals/sources
PATCH /v1/admin/deals/sources/:id
GET  /v1/admin/deals/ingest/runs
GET  /v1/admin/deals/submissions
PATCH /v1/admin/deals/submissions/:id  (approve/reject)
```

---

## 🎨 Frontend Pages

### `/deals` - Deal Feed
- Filterable grid of active deals
- Search, merchant filter, category filter
- Min score slider
- Save/unsave to watchlist
- View deal details
- Shows discount %, coupon codes
- Score badges

### `/product-search` - Universal Search
- Multi-provider product search
- eBay + Google Shopping + more
- Tabbed results by provider
- Price range summary
- Cache indicators
- Direct links to products

### `/deals/submit` - Manual Submission
- Simple form (title, URL, price, merchant, notes)
- Pending approval workflow
- Guidelines for submissions
- Success confirmation

---

## 🔧 Configuration

### Required API Keys

1. **Supabase** (free tier)
   - URL
   - Anon key
   - Service role key

2. **Upstash Redis** (free tier)
   - Connection URL

3. **eBay Developer** (free)
   - App ID
   - Cert ID
   - Dev ID

4. **RapidAPI** (optional, free tier 100 req/mo)
   - API key for Google Shopping

### Environment Variables

**Fly Workers:**
```env
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
REDIS_URL
EBAY_APP_ID
EBAY_CERT_ID
RAPIDAPI_KEY
```

**Vercel:**
```env
VITE_ORBEN_API_URL
```

---

## 📈 Scaling & Performance

### Current Capacity (Free/Cheap Tiers)

- **Deals ingestion**: 10-20 sources polling every 30-60 minutes
- **Active deals**: Tens of thousands (Supabase free tier: 500MB)
- **Searches**: ~1000/day (with caching)
- **Redis cache**: 10k operations/day (Upstash free)
- **Cost**: ~$15-40/month (mostly Fly.io)

### Scaling Up

1. **More sources**: Just add to `deal_sources` table
2. **More searches**: Upgrade Upstash, scale search worker
3. **Horizontal scaling**: Add Fly.io regions
4. **Database**: Archive old deals monthly
5. **Better scoring**: Add ML model for ROI prediction

---

## 🛠️ Monitoring

### Health Checks

```bash
# API
curl https://orben-api.fly.dev/v1/health

# Search worker
curl https://orben-search-worker.fly.dev/health

# Deal worker
fly logs -a orben-deal-worker
```

### Key Metrics (SQL)

```sql
-- Deal growth
SELECT DATE(created_at) as date, COUNT(*) 
FROM deals 
GROUP BY DATE(created_at) 
ORDER BY date DESC 
LIMIT 7;

-- Top merchants
SELECT merchant, COUNT(*), AVG(score) 
FROM deals 
WHERE status = 'active' 
GROUP BY merchant 
ORDER BY COUNT(*) DESC;

-- Ingestion performance
SELECT * FROM recent_ingestion_summary 
ORDER BY started_at DESC 
LIMIT 10;
```

---

## 🚨 Troubleshooting

### Worker not ingesting?
```bash
fly logs -a orben-deal-worker
# Check for RSS feed errors, network issues
```

### Search failing?
```bash
fly logs -a orben-search-worker
# Verify API keys, check quotas
```

### CORS errors in frontend?
- Verify `VITE_ORBEN_API_URL` in Vercel
- Check API health endpoint
- Ensure auth token is being sent

---

## 📚 Adding More Deal Sources

### RSS Feeds (Easy)

Just add to `deal_sources`:

```sql
INSERT INTO deal_sources (name, type, base_url, rss_url, enabled)
VALUES ('MySource', 'rss', 'https://example.com', 'https://example.com/feed.rss', true);
```

Worker will automatically start polling within 60 seconds.

### Affiliate Feeds (Medium)

1. Join affiliate network (ShareASale, CJ, Rakuten)
2. Get data feed URL
3. Add as source with `type = 'affiliate_feed'`
4. Extend worker code to handle feed format

### Retailer APIs (Hard)

1. Apply for API access (Best Buy, Walmart)
2. Add credentials to worker secrets
3. Implement provider in `orben-deal-worker/index.js`
4. Add as source with `type = 'retailer_api'`

---

## 🎯 Roadmap / Future Enhancements

- [ ] Admin dashboard for source management
- [ ] Deal scoring improvements (comps from search)
- [ ] Email/webhook notifications for hot deals
- [ ] Deal categories/tags
- [ ] Deal expiration checking
- [ ] User preferences for deal types
- [ ] Analytics/reporting dashboard
- [ ] Affiliate link transformation
- [ ] Social sharing (Discord, Telegram bots)
- [ ] Mobile app (React Native)

---

## 📄 License

This is part of the ProfitOrbit/BareRetail project.

---

## 🎉 Success Criteria

You'll know it's working when:

✅ `fly logs -a orben-deal-worker` shows ingestion runs every minute  
✅ `/deals` page loads and shows deals  
✅ Clicking "View Deal" opens the merchant URL  
✅ Save/unsave buttons work  
✅ `/product-search` returns results from eBay  
✅ Manual submissions appear in Supabase `deal_submissions` table  

---

## 📞 Support

For deployment help or feature requests, just ask!

Built with ❤️ for resellers by the BareRetail team.
