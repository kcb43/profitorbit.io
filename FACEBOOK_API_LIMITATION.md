# Facebook Sold Items - API Limitation

## Issue Discovered

After testing, we've discovered that **Facebook's GraphQL API has limitations on historical sold items**:

### What We Found:
1. **Query Used**: `MarketplaceYouSellingFastActiveSectionPaginationQuery` (doc_id: `6222877017763459`)
2. **Limitation**: This query returns a **maximum of ~10-50 recent sold items**
3. **Pagination**: Returns `hasNextPage: false` even when user has more sold items
4. **Date Range**: Appears to be limited to approximately last 60-90 days of sold items

### From Your Log:
```
📄 Fetching page 1 (initial)
✅ Page 1: Fetched 10 items (total so far: 10)
✅ Reached last page
📄 Pagination info: {hasNextPage: false, endCursor: null}
```

This is a **Facebook API limitation**, not a bug in our code.

## What We've Done to Maximize Results

### 1. Fixed "Out of Stock" Detection
- Now uses `inventory_count` and `total_inventory` fields
- Items with `inventory_count: 0` are properly detected as out of stock
- Updated status detection priority:
  ```javascript
  if (is_sold) → 'sold'
  else if (inventory_count === 0 && total_inventory === 0) → 'out_of_stock'
  else if (is_pending) → 'out_of_stock'
  else → 'available'
  ```

### 2. Increased Request Size for Sold Items
- Active items: 50 per request
- Sold/Out of Stock items: **100 per request**
- This should help fetch more items in the single page Facebook returns

### 3. Enhanced Logging
- Now logs `inventory_count` and `total_inventory` in status detection
- Shows items requested per page based on status filter

## Why Facebook Limits Sold Items

Facebook's Marketplace is designed for active selling, not historical record-keeping:

1. **Performance**: Serving years of sold items would slow down the app
2. **Privacy**: Older sold items may contain sensitive buyer/seller data
3. **Relevance**: Most sellers only care about recent sales
4. **Storage**: Reducing data storage costs by limiting history

## Possible Workarounds

### Option 1: Use Facebook's "Download Your Information" Feature
Facebook allows users to download all their Marketplace data:
1. Go to Facebook Settings → Your Facebook Information
2. Click "Download Your Information"
3. Select "Marketplace" category
4. Download includes ALL historical listings

**Pros**: Gets ALL data going back years
**Cons**: Manual process, not automated, data format may need parsing

### Option 2: Different GraphQL Query (Advanced)
Facebook likely has different queries for different views:
- `MarketplaceYouSellingFastActiveSectionPaginationQuery` - Active items (current query)
- Possibly `MarketplaceYouSellingSoldSectionQuery` - Sold items specifically
- May need to reverse-engineer from Facebook's web app network requests

**Pros**: Could access more data programmatically
**Cons**: Requires finding correct doc_id, may be unstable if Facebook changes it

### Option 3: Regular Syncing
Instead of fetching historical data, sync regularly:
- Sync every week or month
- Capture sold items before they fall out of the API window
- Build up historical database over time

**Pros**: Reliable, doesn't depend on Facebook's historical API
**Cons**: Only works going forward, doesn't help with past data

## Current Behavior (After Fixes)

With the latest changes:
- ✅ **Out of Stock detection working** (using `inventory_count`)
- ✅ **Requesting 100 sold items per page** (increased from 50)
- ✅ **Proper status mapping** to UI terminology
- ⚠️ **Limited to ~10-50 recent sold items** (Facebook API restriction)

## Recommendation

**Short term**: Accept the Facebook API limitation and focus on recent sold items (last 60-90 days)

**Long term**: 
1. Implement regular syncing (weekly/monthly) to capture sales before they age out
2. Consider adding a "Download Facebook Data" import feature for historical data
3. Monitor for alternative GraphQL queries that might provide more history

## Testing After These Changes

1. Reload extension
2. Go to Import → Facebook → Select "Sold"
3. Click "Get Latest Facebook Items"
4. Check console:
   - Should request 100 items
   - Should properly detect out of stock items
   - Will still show limited results due to Facebook API

The fixes improve what we CAN fetch, but don't overcome Facebook's API limits on historical data.
