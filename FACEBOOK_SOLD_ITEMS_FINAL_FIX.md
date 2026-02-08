# Facebook Sold Items - Final Fix Applied

## Problem Solved

Previously, we were only syncing ~10 recent sold items from Facebook, even though users had 90+ months of historical sales.

## Root Cause Discovered

After extensive investigation, we discovered:

1. **There is NO separate "Sold" tab on Facebook Marketplace** - the inventory page at `https://www.facebook.com/marketplace/you/selling` shows ALL items (active, sold, and out of stock) in one unified view
2. The query `MarketplaceYouSellingFastActiveSectionPaginationQuery` is the **correct and only query** for fetching all marketplace items
3. We were using an **outdated doc_id** (`6222877017763459`) that had pagination issues for sold items
4. Facebook has a **newer version** with doc_id `25467927229556480` that properly supports pagination for ALL item types

## The Fix

Updated `extension/facebook-api.js` to use the newer doc_id:

```javascript
// OLD (broken pagination for sold items):
formData.append('doc_id', '6222877017763459');

// NEW (working pagination for all items):
formData.append('doc_id', '25467927229556480');
```

## How It Works Now

1. **Single Unified Query**: Uses `MarketplaceYouSellingFastActiveSectionPaginationQuery` with doc_id `25467927229556480`
2. **Status Filtering**: Controls which items to fetch via the `status` parameter in GraphQL variables:
   - `available`: `status: ['IN_STOCK']`
   - `sold`: `status: ['OUT_OF_STOCK']` with `state: "SOLD"`
   - `out_of_stock`: `status: ['OUT_OF_STOCK']` with `state: "LIVE"`
   - `all`: `status: ['IN_STOCK', 'OUT_OF_STOCK']` (no state filter)
3. **Pagination**: Now properly works with `has_next_page: true` and `end_cursor` for historical data
4. **Large Batches**: Requests 100 items per page for sold/out-of-stock items, 50 for others
5. **Multi-Page Support**: Fetches up to 20 pages (2,000 sold items for sold filter, 1,000 for others)

## Expected Results

- **Active items**: All current listings
- **Sold items**: Up to 2,000 most recent sales (with proper pagination)
- **Out of Stock items**: Items marked as unavailable but not sold
- **All**: Combined view of all item types

## Status Detection Logic

From GraphQL response fields:

```javascript
if (listing.is_sold) {
  itemStatus = 'sold';  // Confirmed sold transaction
} else if (listing.inventory_count === 0 && listing.total_inventory === 0) {
  itemStatus = 'out_of_stock';  // No inventory but not sold
} else if (listing.is_pending) {
  itemStatus = 'out_of_stock';  // Pending = temporarily unavailable
} else if (listing.inventory_item?.inventory_status === 'IN_STOCK' || listing.inventory_count > 0) {
  itemStatus = 'available';  // Active listing with inventory
}
```

## Testing Checklist

- [x] Fetch "All" items - should include available, sold, and out-of-stock
- [x] Fetch "Sold" only - should paginate through historical sales
- [x] Fetch "Available" only - should show active listings
- [x] Fetch "Out of Stock" only - should show unavailable items
- [x] Verify pagination logs show multiple pages for sold items
- [x] Confirm sold item count matches or exceeds what's visible in Facebook UI

## Related Files

- `extension/facebook-api.js` - GraphQL query implementation
- `extension/background.js` - Pagination loop (up to 20 pages)
- `src/pages/Import.jsx` - UI for status filtering

## Key Insight

The limitation was NOT a Facebook API design decision - it was simply that we were using an outdated version of the query. The newer doc_id (`25467927229556480`) has proper pagination support for all item types, allowing us to fetch extensive historical sold items.
