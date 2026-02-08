# Facebook "Out of Stock" Limitation

## The Problem

When filtering for "Out of Stock" items specifically, we may not get all items that are marked as out of stock but not sold.

## Root Cause

Facebook's GraphQL API uses the same `OUT_OF_STOCK` status for TWO different scenarios:
1. **Items that are sold** (`is_sold: true`)
2. **Items that are out of stock but NOT sold** (`is_sold: false`, but `inventory_count: 0`)

### What We Request

When filtering by "out_of_stock":
```javascript
variables: {
  status: ['OUT_OF_STOCK'],
  state: 'LIVE',
  ...
}
```

### What Facebook Returns

Facebook returns ALL items with `status: OUT_OF_STOCK`, which includes:
- ✅ Sold items
- ✅ Out of stock items
- ❓ May be inconsistent about which out-of-stock items to include

## Current Status Detection Logic

We differentiate on the client-side AFTER fetching:

```javascript
if (listing.is_sold) {
  itemStatus = 'sold';  // Confirmed sold
} else if (listing.inventory_count === 0 && listing.total_inventory === 0) {
  itemStatus = 'out_of_stock';  // Out of stock but not sold
} else if (listing.is_pending) {
  itemStatus = 'out_of_stock';  // Pending/unavailable
}
```

## Why Some Items Might Be Missing

Facebook's API may not return ALL out-of-stock items when we request `status: ['OUT_OF_STOCK']` with `state: 'LIVE'`. This could be because:

1. **Internal Facebook Logic**: Their API might prioritize sold items over out-of-stock items
2. **State Confusion**: `state: 'LIVE'` might exclude some out-of-stock items
3. **API Design**: The query is optimized for sold items, not out-of-stock items

## What We've Tried

1. ✅ Using `status: ['OUT_OF_STOCK']` - Gets sold + some out-of-stock
2. ✅ Setting `state: 'LIVE'` - Same result
3. ✅ Increasing `count` to 100 - Doesn't help with missing items
4. ✅ Proper pagination - Works for what's returned, but doesn't reveal hidden items

## Possible Workarounds (Not Implemented)

### Option 1: Fetch "All" and Filter Client-Side
Instead of filtering server-side, fetch ALL items and filter client-side:
```javascript
// Request ALL items
status: ['IN_STOCK', 'OUT_OF_STOCK']
// Then filter after receiving
items.filter(item => item.status === 'out_of_stock')
```

**Pros**: Might get more out-of-stock items  
**Cons**: Much slower, fetches way more data

### Option 2: Multiple Queries with Different States
Try fetching with different state values:
```javascript
// Try each state separately
['LIVE', 'SOLD', null]
```

**Pros**: Might reveal items hidden by state filtering  
**Cons**: Unproven, would require trial and error

### Option 3: Accept the Limitation
Acknowledge that Facebook's API doesn't provide reliable access to all out-of-stock (non-sold) items.

**Pros**: No extra work, focus on what works well (Available, Sold, All)  
**Cons**: "Out of Stock" filter may be incomplete

## Recommendation

**Accept the limitation** for now because:
1. The "All" filter works perfectly and includes out-of-stock items
2. The "Available" and "Sold" filters work reliably
3. Users rarely need to filter ONLY out-of-stock items
4. The effort to work around Facebook's API design may not be worth it

## User Guidance

If a user needs to see out-of-stock items:
1. Use the "All" filter to fetch everything
2. Then filter in the UI for out-of-stock items
3. Or use the "Sold" filter which reliably gets all sold items

## Related Files

- `extension/facebook-api.js` - Status filtering logic (lines 150-162)
- `extension/background.js` - Pagination with status filter (lines 2382-2454)
- `src/pages/Import.jsx` - UI status dropdown (lines 1518-1529)
