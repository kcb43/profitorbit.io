# 📊 Orben Deal Sources Status

**Date:** February 14, 2026  
**Total Configured:** 26 sources (includes duplicates)  
**Actually Working:** 5 sources  
**Failing:** 13 sources  

---

## ✅ Working Sources (200 deals total)

| Source | Deals | Status | Last Success |
|--------|-------|--------|--------------|
| **Travelzoo** | 59 | ✅ Active | Feb 13 11:49 PM |
| **9to5Toys** | 50 | ✅ Active | Feb 14 1:48 AM |
| **Clark Deals** | 40 | ✅ Active | Feb 14 1:15 AM |
| **Slickdeals Frontpage** | 36 | ✅ Active | Feb 14 1:46 AM |
| **DMFlip** | 15 | ✅ Active | Feb 14 1:15 AM |

---

## ⚠️ Configured But Failing (0 deals)

These sources are in the database but have **never successfully** fetched deals:

### 3 Failures:
- **Woot** (duplicate entries)
- **SaveYourDeals**

### 5 Failures (Need Investigation):
- **TechBargains** (duplicate)
- **Deals of America**
- **Brad's Deals** (duplicate)
- **DealNews** (duplicate)
- **DealCatcher** (duplicate)
- **Ben's Bargains**

---

## 🔴 Missing Sources (Never Added)

These were in your original migration file but were **NEVER** added to the database:

### Reddit Sources (5):
- `r/buildapcsales` - `https://www.reddit.com/r/buildapcsales/.rss`
- `r/frugalmalefashion` - `https://www.reddit.com/r/frugalmalefashion/.rss`
- `r/GameDeals` - `https://www.reddit.com/r/GameDeals/.rss`
- `r/deals` - `https://www.reddit.com/r/deals/.rss`
- `r/consoledeals` - `https://www.reddit.com/r/consoledeals/.rss`

### Tech/Lifestyle Deals (4):
- **Kinja Deals** - `https://deals.kinja.com/rss`
- **The Verge Deals** - `https://www.theverge.com/rss/deals/index.xml`
- **CNET Deals** - `https://www.cnet.com/rss/deals/`
- **Wirecutter Deals** - `https://www.nytimes.com/wirecutter/rss/deals/`

---

## 🐛 Problems Found

### 1. Duplicate Sources
Several sources have duplicate database entries:
- **Slickdeals Frontpage** (2x)
- **Brad's Deals** (2x)
- **Woot** (2x)
- **TechBargains** (2x)
- **DealNews** (2x)
- **DealCatcher** (2x)

**Impact:** Wastes API calls, causes confusion in logs

### 2. RSS URL Issues
Many sources are failing with 5 consecutive failures. Possible reasons:
- RSS URL changed/moved
- Site blocks scrapers (needs User-Agent header)
- Site requires authentication
- Site no longer has RSS feed

### 3. Missing Reddit Sources
Reddit was mentioned in your original requirements but was never added to the database. Reddit is a HUGE source of quality deals.

---

## 🛠️ How to Fix

### Option 1: Run Supabase Migrations (Recommended)
The migrations exist but may not have been run. Run them manually:

```bash
# If you have Supabase CLI:
cd supabase
supabase db push

# Or run via SQL editor in Supabase dashboard
```

### Option 2: Manual SQL (Direct to Database)
Log into Supabase dashboard → SQL Editor → Run:

```sql
-- Add Reddit sources
INSERT INTO deal_sources (name, type, base_url, rss_url, enabled, poll_interval_minutes, notes)
VALUES 
  ('Reddit - r/buildapcsales', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/buildapcsales/.rss', true, 30, 'PC components and tech deals'),
  ('Reddit - r/frugalmalefashion', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/frugalmalefashion/.rss', true, 30, 'Mens fashion deals'),
  ('Reddit - r/GameDeals', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/GameDeals/.rss', true, 30, 'Video game deals'),
  ('Reddit - r/deals', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/deals/.rss', true, 30, 'General deals'),
  ('Reddit - r/consoledeals', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/consoledeals/.rss', true, 30, 'Console gaming deals'),
  ('Kinja Deals', 'rss', 'https://deals.kinja.com', 'https://deals.kinja.com/rss', true, 45, 'Gizmodo deals'),
  ('The Verge Deals', 'rss', 'https://www.theverge.com', 'https://www.theverge.com/rss/deals/index.xml', true, 45, 'Tech deals from The Verge'),
  ('CNET Deals', 'rss', 'https://www.cnet.com', 'https://www.cnet.com/rss/deals/', true, 45, 'CNET curated deals'),
  ('Wirecutter Deals', 'rss', 'https://www.nytimes.com/wirecutter', 'https://www.nytimes.com/wirecutter/rss/deals/', true, 60, 'NYT Wirecutter deals')
ON CONFLICT (name) DO NOTHING;

-- Remove duplicates (keep most recent success)
DELETE FROM deal_sources
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM deal_sources
  ORDER BY name, last_success_at DESC NULLS LAST, created_at DESC
);

-- Reset fail counts for retry
UPDATE deal_sources
SET fail_count = 0
WHERE fail_count >= 5;
```

### Option 3: Via Fly.io Secrets + Redeploy
If migrations weren't run, you can add them via environment and trigger redeploy:

```powershell
# Redeploy deal worker to pick up any new DB changes
fly deploy -a orben-deal-worker --local-only
```

---

## 📈 Expected Result After Fix

Once all sources are added and working, you should have:

| Category | Sources | Est. Deals/Day |
|----------|---------|----------------|
| **Current (Working)** | 5 | ~200 |
| **Reddit** | 5 | ~500-1000 |
| **Tech/Lifestyle** | 4 | ~100-200 |
| **Fixed RSS Feeds** | 8+ | ~300-500 |
| **TOTAL** | 22+ | **1,000-2,000+** |

---

## 🎯 Immediate Action Required

1. **Log into Supabase Dashboard:** https://supabase.com/dashboard
2. **Go to SQL Editor**
3. **Run the SQL from "Option 2" above**
4. **Wait 60 seconds** for the deal worker to pick up new sources
5. **Check logs:** `fly logs -a orben-deal-worker`

The deal worker automatically polls the database every 60 seconds for new sources, so once you add them, they'll start working immediately.

---

## 📝 Why This Happened

The migration files (`20260213_orben_deal_sources_comprehensive.sql` and `20260213_orben_additional_sources.sql`) exist in your codebase but were either:

1. **Never run** on the Supabase database
2. **Partially run** (which would explain duplicates)
3. **Run but had errors** (Reddit sources failed silently)

The Supabase CLI or manual SQL execution is needed to actually apply these migrations to your live database.
