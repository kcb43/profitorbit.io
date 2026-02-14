# ✅ STEP 5: Testing Your Deployment

You're on **Step 5** of the deployment. Here's how to properly test everything.

---

## 🚨 CURRENT ISSUE: Redis Connection Failing

Your deal worker is showing Redis connection errors. **This must be fixed first!**

### Quick Fix:

1. **Get your correct Redis URL from Upstash:**
   - Visit: https://console.upstash.com/redis
   - Click your database
   - Copy the **"REDIS_URL"** (must start with `rediss://` with double 's')

2. **Update all three Fly.io apps:**

```powershell
# In PowerShell, run these commands one by one:
fly secrets set REDIS_URL="rediss://default:YOUR_PASSWORD@YOUR_HOST.upstash.io:6379" -a orben-deal-worker

fly secrets set REDIS_URL="rediss://default:YOUR_PASSWORD@YOUR_HOST.upstash.io:6379" -a orben-search-worker

fly secrets set REDIS_URL="rediss://default:YOUR_PASSWORD@YOUR_HOST.upstash.io:6379" -a orben-api
```

3. **Wait 30 seconds** for apps to restart with new secrets

4. **Verify the fix:**

```powershell
fly logs -a orben-deal-worker | Select-Object -Last 30
```

You should see:
```
✅ Redis connected successfully
✅ Redis ready for commands  
✅ Supabase connection verified
🚀 Orben Deal Worker starting...
```

**See `FIX_REDIS.md` for detailed instructions if you need more help!**

---

## Once Redis is Fixed: Complete Testing

### Test 1: Local Connection Test (Optional but Recommended)

Create a `.env` file in `f:\bareretail\` with your actual credentials:

```bash
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_actual_key
REDIS_URL=rediss://default:password@your-host.upstash.io:6379
```

Then run the test script:

```powershell
node test-deployment.js
```

**Expected output:**
```
🔍 Testing Deployment...

1️⃣ Testing Redis Connection...
✅ Redis: Connected and responding to PING
   Keys in database: 0

2️⃣ Testing Supabase Connection...
✅ Supabase: Connected
   Deal sources in database: 19
   Enabled sources: 13

3️⃣ Checking Deals Table...
✅ Active deals in database: 0
   ℹ️  No deals yet - this is normal for first 30 minutes

4️⃣ Checking Ingestion Runs...
   ℹ️  No ingestion runs yet - worker may not have started polling

✅ Tests Complete!
```

---

### Test 2: Check Worker Logs

```powershell
# Deal Worker - should be polling sources
fly logs -a orben-deal-worker | Select-Object -Last 50

# Search Worker - should be ready for requests
fly logs -a orben-search-worker | Select-Object -Last 30

# API - should be serving requests
fly logs -a orben-api | Select-Object -Last 30
```

**What to look for:**
- ✅ No `ECONNRESET` or Redis errors
- ✅ "Redis connected successfully"
- ✅ "Supabase connection verified"
- ✅ "Polling X sources..." (for deal worker)

---

### Test 3: API Health Check

```powershell
curl https://orben-api.fly.dev/v1/health
```

**Expected:** `{"ok":true}`

---

### Test 4: Test Search Worker

```powershell
# PowerShell syntax:
$body = @{
    query = "iPhone 15"
    providers = @("ebay")
    userId = "test-user"
    limit = 10
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

**Expected:** JSON response with eBay listings for iPhone 15

---

### Test 5: Check Deals API

```powershell
curl https://orben-api.fly.dev/v1/deals/feed?limit=10
```

**Expected:**
- **If worker just started:** Empty array `{"deals":[],"total":0}`
- **After 30-60 mins:** Array of deal objects `{"deals":[{...}],"total":X}`

---

### Test 6: Query Database Directly

Since `psql` isn't available on Windows, use the Supabase web interface:

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/editor
2. Click **SQL Editor** → **New Query**
3. Run these queries:

```sql
-- Check active deals count
SELECT COUNT(*) FROM deals WHERE status = 'active';

-- Check deals by source
SELECT 
  ds.name,
  COUNT(d.id) as deal_count,
  ROUND(AVG(d.score), 1) as avg_score
FROM deals d
JOIN deal_sources ds ON d.source_id = ds.id
WHERE d.status = 'active'
GROUP BY ds.name
ORDER BY deal_count DESC;

-- Check recent ingestion runs
SELECT 
  ds.name,
  dir.status,
  dir.items_created,
  dir.items_updated,
  dir.started_at
FROM deal_ingestion_runs dir
JOIN deal_sources ds ON dir.source_id = ds.id
ORDER BY dir.started_at DESC
LIMIT 10;

-- Check source health
SELECT 
  name,
  enabled,
  last_polled_at,
  last_success_at,
  fail_count
FROM deal_sources
WHERE enabled = true
ORDER BY last_polled_at DESC NULLS LAST;
```

---

### Test 7: Frontend Testing

Once deals are appearing in the database (after 30-60 minutes):

1. **Visit your Vercel deployment URL**
2. **Test the Deals page:** `/deals`
   - Should show deal cards
   - Filtering and sorting should work
3. **Test Product Search:** `/product-search`
   - Search for "PlayStation 5"
   - Should show eBay results
4. **Test Submit Deal:** `/deals/submit`
   - Submit a test deal
   - Should save to database

---

## ⏱️ Timeline Expectations

### Immediately (after fixing Redis):
- ✅ All workers start successfully
- ✅ Health endpoints respond
- ✅ No errors in logs

### Within 30 minutes:
- ✅ Deal worker completes first polling cycle
- ✅ First deals appear in database
- ✅ Deals visible on frontend

### Within 2 hours:
- ✅ Multiple sources ingested
- ✅ 100+ deals in database
- ✅ Search cache warming up

### Within 24 hours:
- ✅ All 13 RSS sources polled
- ✅ 500-2000 deals in database
- ✅ System running smoothly

---

## 🐛 Troubleshooting

### Issue: "No deals appearing after 2 hours"

**Check:**
```powershell
fly logs -a orben-deal-worker | Select-Object -Last 100
```

**Look for:**
- Errors parsing RSS feeds
- Network errors
- "Polling X sources" messages

**Fix:** Check the `deal_sources` table - are sources enabled? Are RSS URLs valid?

---

### Issue: "Search returns no results"

**Check:**
```powershell
fly logs -a orben-search-worker
```

**Common causes:**
- ❌ Invalid `EBAY_APP_ID`
- ❌ RapidAPI quota exceeded
- ❌ Network timeout

**Fix:** Verify your eBay API key at https://developer.ebay.com/my/keys

---

### Issue: "Frontend not loading deals"

**Check:**
1. Is `ORBEN_API_URL` set in Vercel?
   ```powershell
   vercel env ls
   ```

2. Test API directly:
   ```powershell
   curl https://orben-api.fly.dev/v1/deals/feed?limit=5
   ```

3. Check browser console for CORS errors

---

## ✅ Step 5 Complete Checklist

- [ ] Redis connection fixed (no ECONNRESET errors)
- [ ] All three workers running successfully
- [ ] API health check responds with `{"ok":true}`
- [ ] Search worker returns eBay results
- [ ] Deals API returns data (may be empty initially)
- [ ] Database queries working (via Supabase SQL Editor)
- [ ] Frontend pages load without errors

**Once all checked:** You're done with Step 5! 🎉

---

## 🚀 What's Next?

After Step 5, you're **FULLY DEPLOYED**! The system will now:

1. ✅ Poll RSS feeds automatically every 30-60 mins
2. ✅ Ingest and score deals
3. ✅ Serve deals via API
4. ✅ Handle product searches
5. ✅ Cache results in Redis

**Your only job now:** Monitor logs for the first 24 hours and watch deals roll in!

---

**Need help?** 
- Read: `FIX_REDIS.md` for Redis issues
- Read: `DEPLOY_NOW.md` for the full deployment guide
- Check: `ORBEN_QUICK_START.md` for troubleshooting

**Success?** You now have a production deal intelligence system! 🎯🚀
