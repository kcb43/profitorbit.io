# Load More Pagination Fix + Deal Feed Investigation

## Issue 1: Load More Returns Duplicate Items ❌

### Problem
When clicking "Load More" on product search, pages 2, 3, 4+ all return THE SAME 10 items from page 1. 

### Root Cause
The Orben API (`orben-api/index.js`) was **not passing the `page` parameter** to the search worker, even though:
- ✅ Frontend sends `page` parameter correctly
- ✅ Search worker supports `page` parameter
- ✅ Search worker includes `page` in cache key
- ❌ Orben API was ignoring the `page` parameter!

### The Bug (Line 330)
```javascript
// BEFORE - Missing page parameter!
const { q, country = 'US', providers = 'ebay', limit = 20 } = request.query;
// ...
const response = await axios.post(`${SEARCH_WORKER_URL}/search`, {
  query: q.trim(),
  providers: providerList,
  country,
  userId: user.id,
  limit: parseInt(limit, 10)
  // ❌ page parameter missing!
});
```

### The Fix (Line 330)
```javascript
// AFTER - Now passes page parameter!
const { q, country = 'US', providers = 'ebay', limit = 20, page = 1 } = request.query;
// ...
const response = await axios.post(`${SEARCH_WORKER_URL}/search`, {
  query: q.trim(),
  providers: providerList,
  country,
  userId: user.id,
  limit: parseInt(limit, 10),
  page: parseInt(page, 10)  // ✅ Now passing page!
});
```

### Result
✅ Page 2 will now return items 11-20  
✅ Page 3 will now return items 21-30  
✅ Load More will properly accumulate unique items  
✅ Deduplication will have new items to add

---

## Issue 2: Deal Feed Investigation 🔍

### Status: ✅ Backend Appears Functional

The Deal Feed backend is properly configured:

#### 1. API Endpoint ✅
```javascript
// orben-api/index.js:80
fastify.get('/v1/deals/feed', async (request, reply) => {
  // Calls Supabase RPC: get_deal_feed
  const { data, error } = await supabase.rpc('get_deal_feed', {
    search_query: q || null,
    filter_merchant: merchant || null,
    filter_category: category || null,
    min_score_val: parseInt(min_score, 10),
    page_limit: parseInt(limit, 10),
    page_offset: parseInt(offset, 10)
  });
});
```

#### 2. Database Function ✅
```sql
-- get_deal_feed() exists (hotfix applied 2026-02-14)
SELECT * FROM deals WHERE status = 'active' AND score >= min_score_val
ORDER BY score DESC, posted_at DESC
LIMIT page_limit OFFSET page_offset;
```

#### 3. Frontend ✅
```javascript
// Deals.jsx uses infinite scroll
useInfiniteQuery({
  queryKey: ['deals', searchQuery, filters],
  queryFn: async ({ pageParam = 0 }) => {
    const response = await fetch(`${ORBEN_API_URL}/v1/deals/feed?${params}`);
    return response.json();
  }
});
```

### Possible Issues (To Investigate)

1. **No Deals in Database?**
   - Check if `deals` table has any rows
   - Check if any deals have `status = 'active'`
   - Check if `posted_at` is recent

2. **Deal Sources Not Running?**
   - Are Reddit/Slickdeals scrapers active?
   - Are they adding deals to the database?
   - Check `deal_sources` table for active sources

3. **RLS Policies Too Strict?**
   - Check if RLS policies are blocking anonymous reads
   - Verify `get_deal_feed` uses `SECURITY DEFINER` (it does ✅)

### Investigation SQL Queries

Run these in Supabase SQL Editor:

```sql
-- 1. Check if deals table has ANY deals
SELECT COUNT(*) as total_deals, 
       COUNT(*) FILTER (WHERE status = 'active') as active_deals,
       MAX(posted_at) as last_deal_posted
FROM deals;

-- 2. Check recent deals
SELECT id, title, merchant, score, status, posted_at, created_at
FROM deals
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check deal sources
SELECT id, name, source_type, scrape_url, is_active, last_scraped_at
FROM deal_sources
ORDER BY last_scraped_at DESC NULLS LAST;

-- 4. Test the feed function directly
SELECT * FROM get_deal_feed(
  search_query := NULL,
  filter_merchant := NULL,
  filter_category := NULL,
  min_score_val := 0,
  page_limit := 20,
  page_offset := 0
);

-- 5. Check if scrapers are inserting deals
SELECT DATE(created_at) as deal_date,
       COUNT(*) as deals_added
FROM deals
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY deal_date DESC;
```

---

## Deployment Steps

### 1. Deploy Orben API Fix
```bash
cd orben-api
git add index.js
git commit -m "Fix: Pass page parameter to search worker for proper pagination"
git push
fly deploy
```

### 2. Test Product Search
```
1. Search "air force 1"
2. Wait for 10 results
3. Click "Load More"
4. Verify: NEW items appear (not duplicates)
5. Check console: "newItemsFound: 10" (not 0!)
```

### 3. Investigate Deal Feed
```
1. Run SQL queries above in Supabase
2. Check if deals exist in database
3. Check if deal sources are active
4. Verify scrapers are running
```

---

## Expected Console Logs (After Fix)

### Before Fix (Broken):
```
[DEBUG-LOAD-MORE] Load More clicked {currentPage: 1, willIncreaseTo: 2}
[ProductSearch] Fetching: ...&page=2&limit=10...
[DEBUG-ACCUM] After deduplication {newItemsFound: 0}  ← ❌ DUPLICATES
```

### After Fix (Working):
```
[DEBUG-LOAD-MORE] Load More clicked {currentPage: 1, willIncreaseTo: 2}
[ProductSearch] Fetching: ...&page=2&limit=10...
[DEBUG-ACCUM] After deduplication {newItemsFound: 10}  ← ✅ NEW ITEMS!
```

---

## Files Modified

1. ✅ `orben-api/index.js` - Added `page` parameter support (line 330)

## Files to Investigate

1. 🔍 Check `deals` table in Supabase - Are there active deals?
2. 🔍 Check `deal_sources` table - Are scrapers active?
3. 🔍 Check scraper logs - Are they running?

---

## Next Steps

1. **Deploy the pagination fix** to Orben API
2. **Run SQL investigation queries** to diagnose deal feed
3. **Check deal source scrapers** - Are they running/working?
4. **Report findings** from SQL queries

---

**Status**: ✅ Pagination fix ready to deploy  
**Date**: 2026-02-15  
**Priority**: HIGH (user-reported pagination bug)
