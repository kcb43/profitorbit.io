# Deal Feed Investigation SQL Queries

Run these queries in Supabase SQL Editor to diagnose why the Deal Feed is empty.

## Query 1: Check if deals table has ANY deals

```sql
SELECT 
  COUNT(*) as total_deals, 
  COUNT(*) FILTER (WHERE status = 'active') as active_deals,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_deals,
  MAX(posted_at) as last_deal_posted,
  MAX(created_at) as last_deal_created
FROM deals;
```

**Expected**: Should show at least some deals. If 0, the scrapers aren't working.

---

## Query 2: Check recent deals (last 10 created)

```sql
SELECT 
  id, 
  title, 
  merchant, 
  score, 
  status, 
  posted_at, 
  created_at,
  url
FROM deals
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**: Should show recent deals. Check if `status = 'active'` and `posted_at` is recent.

---

## Query 3: Check deal sources (scrapers)

```sql
SELECT 
  id, 
  name, 
  source_type, 
  scrape_url, 
  is_active, 
  last_scraped_at,
  CASE 
    WHEN last_scraped_at IS NULL THEN 'Never scraped'
    WHEN last_scraped_at < NOW() - INTERVAL '1 day' THEN 'Stale (>1 day)'
    WHEN last_scraped_at < NOW() - INTERVAL '1 hour' THEN 'Recent (<1 hour)'
    ELSE 'Very Recent'
  END as scraper_status
FROM deal_sources
ORDER BY last_scraped_at DESC NULLS LAST;
```

**Expected**: Should show active scrapers with recent `last_scraped_at` timestamps.

---

## Query 4: Test the feed function directly

```sql
SELECT * FROM get_deal_feed(
  search_query := NULL,
  filter_merchant := NULL,
  filter_category := NULL,
  min_score_val := 0,
  page_limit := 20,
  page_offset := 0
);
```

**Expected**: Should return active deals. If empty, either no deals exist or they're all inactive.

---

## Query 5: Check if scrapers are inserting deals (last 30 days)

```sql
SELECT 
  DATE(created_at) as deal_date,
  COUNT(*) as deals_added,
  COUNT(*) FILTER (WHERE status = 'active') as active_deals_added
FROM deals
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY deal_date DESC;
```

**Expected**: Should show recent dates with deals being added. If empty, scrapers stopped working.

---

## Query 6: Check deals by score distribution

```sql
SELECT 
  CASE 
    WHEN score >= 90 THEN '90+ (MEGA)'
    WHEN score >= 70 THEN '70-89 (HOT)'
    WHEN score >= 50 THEN '50-69 (GREAT)'
    WHEN score >= 25 THEN '25-49 (GOOD)'
    ELSE '0-24 (OK)'
  END as score_range,
  COUNT(*) as deal_count,
  COUNT(*) FILTER (WHERE status = 'active') as active_count
FROM deals
GROUP BY score_range
ORDER BY MIN(score) DESC;
```

**Expected**: Shows distribution of deals by score. Helps understand deal quality.

---

## Query 7: Check RLS policies on deals table

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'deals';
```

**Expected**: Should show RLS policies. Check if anonymous users can read.

---

## Query 8: Check if get_deal_feed function exists

```sql
SELECT 
  routine_name,
  routine_type,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_deal_feed';
```

**Expected**: Should return the function definition with `SECURITY DEFINER`.

---

## Troubleshooting Scenarios

### Scenario 1: Query 1 shows 0 deals
**Problem**: No deals in database  
**Solution**: Check if deal scrapers are deployed and running

### Scenario 2: Query 1 shows deals, but Query 4 returns 0 rows
**Problem**: All deals have `status != 'active'` or `score < min_score`  
**Solution**: Check Query 2 to see actual statuses and scores

### Scenario 3: Query 3 shows `last_scraped_at IS NULL`
**Problem**: Scrapers never ran  
**Solution**: Deploy and start deal scrapers

### Scenario 4: Query 3 shows stale `last_scraped_at` (>1 day)
**Problem**: Scrapers stopped working  
**Solution**: Check scraper logs, restart scrapers

### Scenario 5: Query 5 shows deals stopped being added
**Problem**: Scrapers crashed or stopped  
**Solution**: Check scraper deployment, logs, and configuration

---

## Action Items Based on Results

After running these queries, you should be able to:

1. ✅ Confirm if deals exist in the database
2. ✅ Check if deal scrapers are active and running
3. ✅ Identify if deals are being marked as 'active' correctly
4. ✅ Verify if the feed function works
5. ✅ Determine if the issue is:
   - No deals in database (scraper not running)
   - Deals exist but are inactive (status issue)
   - RLS policy blocking reads (unlikely - we use SECURITY DEFINER)
   - API cache issue (unlikely - 60s TTL)

---

## Expected Next Steps

1. Run Query 1 first - determines if deals exist at all
2. If deals exist, run Query 4 - tests the feed function
3. If no deals, run Query 3 - checks scraper status
4. If scrapers are stale, check scraper deployment/logs
5. If scrapers don't exist, need to deploy deal scrapers

---

**Created**: 2026-02-15  
**Purpose**: Diagnose empty Deal Feed issue  
**Priority**: MEDIUM (user-reported issue)
