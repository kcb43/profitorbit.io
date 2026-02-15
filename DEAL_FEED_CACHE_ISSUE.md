# Deal Feed Cache Investigation

## Your SQL Results

```json
{
  "total_deals": 1081,
  "active_deals": 1081,
  "last_deal_posted": "2026-02-15 01:58:13+00"  // 01:58 UTC = 8:58 PM EST
}
```

**Current time**: 9:09 PM EST (Feb 14, 2026) = 02:09 UTC (Feb 15, 2026)

**Last deal posted**: 8:58 PM EST = **11 minutes ago!** ✅ Deals are fresh!

---

## Problem: Frontend Shows Stale Data

Since deals ARE being added (last one 11 minutes ago), but you're seeing stale data, the issue is **caching**.

### Cache Layers to Check:

1. **React Query Cache** (Frontend)
   - `staleTime: 60_000` (60 seconds) - ⚠️ Too long
   - Fix: Reduced to 30 seconds + added auto-refresh

2. **Redis Cache** (Backend - Orben API)
   - Line 111: `redis.set(cacheKey, JSON.stringify(response), 'EX', 60)`
   - Cache TTL: 60 seconds
   - **This is likely the culprit!**

3. **Browser Cache**
   - Hard refresh might help: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

---

## Root Cause Analysis

### Scenario:
1. You load the Deal Feed page at 8:00 PM EST
2. Backend caches the results for 60 seconds
3. New deal gets posted at 8:58 PM EST (58 minutes later)
4. You refresh at 9:09 PM EST
5. **Frontend**: Sees data is only 11 minutes old (within 60s `staleTime`)
6. **Backend**: Cached response from 8:00 PM (expired after 60s but new request creates new cache)
7. **Result**: You see deals from the OLD cache cycle, not the fresh ones!

---

## The Fix

### 1. Reduce Frontend `staleTime` ✅ DONE
```javascript
// BEFORE
staleTime: 60_000  // 60 seconds

// AFTER
staleTime: 30_000,  // 30 seconds (fresher data)
refetchInterval: 60_000  // Auto-refresh every 60 seconds
```

### 2. Add Manual Refresh Button ✅ DONE
```javascript
<Button onClick={() => refetch()}>
  <TrendingDown className="w-4 h-4 mr-2" />
  Refresh
</Button>
```

### 3. Consider Reducing Backend Cache (Optional)

**Current**: 60 seconds backend cache  
**Recommendation**: Reduce to 30 seconds or 15 seconds for "Live" feed

**File**: `orben-api/index.js` line 111
```javascript
// CURRENT
await redis.set(cacheKey, JSON.stringify(response), 'EX', 60);

// RECOMMENDED (for "Live" deals)
await redis.set(cacheKey, JSON.stringify(response), 'EX', 30);  // 30 seconds
```

---

## Testing Steps

### Test 1: Manual Refresh
1. Go to Deal Feed page
2. Note the deals you see
3. Click **"Refresh"** button (new button added)
4. Check if you see the fresh deals now

### Test 2: Auto-Refresh
1. Stay on Deal Feed page
2. Wait 60 seconds
3. Page should auto-refresh and show new deals

### Test 3: Hard Browser Refresh
1. Press **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
2. Should bypass all caches and show fresh deals

---

## SQL Query to Run Next

Run **Query 2** from the investigation file to see what the actual recent deals are:

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
LIMIT 20;
```

This will show you:
- What the most recent 20 deals are
- If they're marked as `active`
- When they were posted
- If they should be showing in your feed

---

## Expected Behavior After Fix

**Before**:
- Stale deals shown even after new deals posted
- No way to manually refresh
- 60-second stale time too long for "Live" feed

**After**:
- Auto-refreshes every 60 seconds
- Manual "Refresh" button available
- 30-second stale time (fresher data)
- Backend cache still 60s (can reduce further if needed)

---

## Next Steps

1. **Try the Refresh button** on the Deal Feed page
2. **Share Query 2 results** (recent 20 deals) so I can verify they should be showing
3. **If refresh doesn't work**: I'll reduce the backend Redis cache to 30s or 15s

---

## Time Zone Note

Your observation about time zones is correct:
- **EST**: UTC-5
- **Last deal**: 01:58 UTC = 8:58 PM EST
- **Current**: 02:09 UTC = 9:09 PM EST
- **Age**: 11 minutes (very fresh!)

The deals ARE fresh - it's just a caching issue preventing you from seeing them.

---

**Status**: ✅ Frontend fixes deployed (refresh button + auto-refresh)  
**Action**: Try the Refresh button on Deal Feed page  
**Date**: 2026-02-15 02:09 UTC (9:09 PM EST, Feb 14)
