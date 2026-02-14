# 🚀 Orben Quick Start Checklist

Use this checklist to deploy Orben in 30 minutes.

## ☑️ Pre-Deployment Setup

### 1. Get API Keys (15 minutes)

- [ ] **Upstash Redis** (free tier)
  - Go to https://upstash.com/
  - Create database
  - Copy Redis URL: `rediss://default:xxx@...upstash.io:6379`
  - **Why?** Supabase = durable DB, Redis = fast cache. You need both!
  - Alternative: Use Fly Redis if you prefer (`fly redis create`)

- [ ] **eBay Developer** (free)
  - Go to https://developer.ebay.com/
  - Create application
  - Get: App ID, Cert ID, Dev ID

- [ ] **RapidAPI Account** (for Google Shopping, free 100/mo)
  - Go to https://rapidapi.com/
  - Subscribe to "Real-Time Product Search" API
  - Copy API key
  - Get 100 free searches/month, then $10/mo for 1,000

### 2. Verify Existing Setup

- [ ] Supabase project exists
- [ ] Have Supabase URL, Anon Key, Service Role Key
- [ ] Fly.io account exists (from existing worker)
- [ ] Vercel project exists

---

## ☑️ Deployment (15 minutes)

### Step 1: Database Setup (3 min)

```bash
cd f:\bareretail

# Option A: Supabase CLI
supabase db push

# Option B: Supabase Dashboard SQL Editor
# Run: supabase/migrations/20260213_orben_deal_system.sql
# Run: supabase/migrations/20260213_orben_additional_sources.sql
```

- [ ] Tables created (run `SELECT * FROM deal_sources` to verify)

---

### Step 2: Deploy orben-deal-worker (4 min)

```bash
cd orben-deal-worker
npm install

fly launch --no-deploy
# Name: orben-deal-worker
# Region: iad (or your preferred)

fly secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_KEY" \
  REDIS_URL="YOUR_UPSTASH_URL"

fly deploy
```

- [ ] Worker deployed
- [ ] Check logs: `fly logs -a orben-deal-worker`
- [ ] See polling messages every 60 seconds

---

### Step 3: Deploy orben-search-worker (4 min)

```bash
cd ../orben-search-worker
npm install

fly launch --no-deploy
# Name: orben-search-worker

fly secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_KEY" \
  REDIS_URL="YOUR_UPSTASH_URL" \
  EBAY_APP_ID="YOUR_EBAY_APP_ID" \
  EBAY_CERT_ID="YOUR_EBAY_CERT_ID" \
  RAPIDAPI_KEY="YOUR_RAPIDAPI_KEY_OR_SKIP"

fly deploy
```

- [ ] Worker deployed
- [ ] Test: `curl https://orben-search-worker.fly.dev/health`

---

### Step 4: Deploy orben-api (4 min)

```bash
cd ../orben-api
npm install

fly launch --no-deploy
# Name: orben-api

fly secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_KEY" \
  SUPABASE_ANON_KEY="YOUR_ANON_KEY" \
  REDIS_URL="YOUR_UPSTASH_URL" \
  ORBEN_SEARCH_WORKER_URL="https://orben-search-worker.fly.dev"

fly deploy
```

- [ ] API deployed
- [ ] Test: `curl https://orben-api.fly.dev/v1/health`
- [ ] Test deals: `curl https://orben-api.fly.dev/v1/deals/feed?limit=5`

---

### Step 5: Deploy Frontend (Vercel) (2 min)

1. **Add environment variable in Vercel:**
   - Project → Settings → Environment Variables
   - `VITE_ORBEN_API_URL` = `https://orben-api.fly.dev`

2. **Deploy:**
```bash
cd f:\bareretail
git add .
git commit -m "Add Orben deal intelligence system"
git push origin main
```

- [ ] Vercel auto-deploys
- [ ] Visit `https://yourapp.vercel.app/deals`

---

## ☑️ Verification (5 minutes)

### Test Deal Worker

```bash
fly logs -a orben-deal-worker
```

**Expected output:**
```
📊 Polling 6 sources...
[DealCatcher] Starting ingestion from https://www.dealcatcher.com/feed/
[DealCatcher] Fetched 50 items
[DealCatcher] Success: 5 created, 2 updated, 50 seen
```

- [ ] See ingestion messages
- [ ] No errors in logs

---

### Test Database

```sql
-- In Supabase SQL Editor
SELECT COUNT(*) FROM deals;
-- Should see > 0 after a few minutes

SELECT * FROM deal_ingestion_runs ORDER BY started_at DESC LIMIT 5;
-- Should see recent runs with status 'success'
```

- [ ] Deals are being created
- [ ] Ingestion runs show success

---

### Test Frontend

1. **Deals Feed**
   - [ ] Go to `/deals`
   - [ ] See deal cards with images
   - [ ] Search works
   - [ ] Filters work (merchant, category, min score)
   - [ ] "View Deal" opens merchant URL
   - [ ] Save/unsave works (requires login)

2. **Product Search**
   - [ ] Go to `/product-search`
   - [ ] Search for "iPhone 15"
   - [ ] See results from eBay
   - [ ] Results load within 5 seconds (first time)
   - [ ] Second search is instant (cached)

3. **Submit Deal**
   - [ ] Go to `/deals/submit`
   - [ ] Fill out form
   - [ ] Submit successfully
   - [ ] Check `deal_submissions` table in Supabase

---

### Test API Directly

```bash
# Health
curl https://orben-api.fly.dev/v1/health

# Deals feed
curl "https://orben-api.fly.dev/v1/deals/feed?limit=5"

# Should return JSON with deals array
```

- [ ] API responds with 200
- [ ] Returns valid JSON
- [ ] Contains deal items

---

## ☑️ Post-Deployment

### Add More Deal Sources (Optional)

```sql
-- In Supabase SQL Editor
INSERT INTO deal_sources (name, type, base_url, rss_url, enabled)
VALUES 
  ('Your Favorite Deal Site', 'rss', 'https://example.com', 'https://example.com/rss', true);
```

- [ ] Add 2-3 more sources
- [ ] Verify they appear in ingestion logs

---

### Monitor for 24 Hours

1. **Check deal growth:**
```sql
SELECT DATE(created_at) as date, COUNT(*) as deals 
FROM deals 
GROUP BY DATE(created_at) 
ORDER BY date DESC;
```

2. **Check ingestion success rate:**
```sql
SELECT 
  status, 
  COUNT(*) as runs,
  AVG(items_created) as avg_created
FROM deal_ingestion_runs
WHERE started_at > now() - interval '24 hours'
GROUP BY status;
```

3. **Check Redis cache hit rate:**
   - Go to Upstash dashboard
   - View operations graph
   - Should see consistent usage

---

## ☑️ Troubleshooting

If something's not working, check these in order:

### Deal Worker Not Ingesting?

```bash
fly logs -a orben-deal-worker
```

Common issues:
- [ ] RSS feed is down (try URL in browser)
- [ ] Supabase credentials wrong
- [ ] Redis credentials wrong

Fix: Redeploy with correct secrets

---

### Search Not Working?

```bash
fly logs -a orben-search-worker
```

Common issues:
- [ ] eBay API key invalid
- [ ] RapidAPI quota exceeded
- [ ] Network timeout

Fix: Check API keys, verify quotas

---

### Frontend Not Showing Deals?

1. Check browser console for errors
2. Verify `VITE_ORBEN_API_URL` in Vercel
3. Test API directly: `curl https://orben-api.fly.dev/v1/deals/feed`

Common issues:
- [ ] CORS error → API not deployed
- [ ] 401 error → Auth token not sent
- [ ] Empty response → Worker hasn't ingested yet (wait 5 min)

---

## 🎉 Success!

You're done when:

✅ Deal worker logs show successful ingestion runs  
✅ `/deals` page loads with deal cards  
✅ Product search returns eBay results  
✅ Manual deal submission works  
✅ Supabase has 50+ deals in database  

**Total cost:** ~$15-40/month  
**Maintenance:** ~5 min/week (add sources, check logs)  

---

## 📋 Quick Reference

| Service | URL | Purpose |
|---------|-----|---------|
| **API** | `https://orben-api.fly.dev` | All client requests |
| **Deal Worker** | Internal | RSS ingestion |
| **Search Worker** | `https://orben-search-worker.fly.dev` | Product search |
| **Frontend** | `https://yourapp.vercel.app/deals` | User interface |

### Key Commands

```bash
# View logs
fly logs -a orben-deal-worker
fly logs -a orben-search-worker
fly logs -a orben-api

# Check status
fly status -a orben-deal-worker

# Redeploy
cd orben-deal-worker && fly deploy

# Update secrets
fly secrets set KEY=VALUE -a orben-deal-worker
```

---

## 🆘 Need Help?

1. Check `ORBEN_DEPLOYMENT_GUIDE.md` for detailed steps
2. Check `ORBEN_README.md` for architecture overview
3. Ask for help with specific error messages

---

**Built:** February 13, 2026  
**Status:** Production Ready ✅  
**Time to Deploy:** ~30 minutes
