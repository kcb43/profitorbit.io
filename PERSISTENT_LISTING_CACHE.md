# Persistent Listing Cache Implementation

## Problem
When syncing Facebook/Mercari listings with different status filters (e.g., "Available", "Sold", "All"), the system was **replacing** the entire cache with only the newly fetched items instead of **merging** them. This caused:

1. **Data Loss**: Syncing "Available" items would delete previously synced "Sold" items
2. **No Persistence**: Switching between status filters or navigating away would lose items
3. **Poor UX**: Users had to re-sync everything repeatedly

### Example of the Problem
1. User syncs "Sold" items → Cache has 100 sold items
2. User switches to "Available" and syncs → Cache now has only 30 available items (100 sold items LOST!)
3. User switches back to "Sold" → No items shown, must re-sync

## Solution: Map-Based Merge Logic

### Core Concept
The listing cache should be a **master list** that accumulates ALL items ever synced, regardless of status. Status filters should only affect what you **SEE**, not what's **STORED**.

### Implementation (Import.jsx)

#### Before (BAD - Overwrites Cache)
```javascript
// Load existing imported status from localStorage
const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
let existingImportedIds = new Set();

if (cachedListings) {
  const parsedListings = JSON.parse(cachedListings);
  existingImportedIds = new Set(
    parsedListings
      .filter(item => item.imported)
      .map(item => item.itemId)
  );
}

// PROBLEM: This REPLACES the cache with only new items!
const mergedListings = listings.map(item => ({
  ...item,
  imported: existingImportedIds.has(item.itemId) || false
}));

// Cache is now ONLY the newly fetched items (old items deleted!)
localStorage.setItem('profit_orbit_facebook_listings', JSON.stringify(mergedListings));
```

#### After (GOOD - Merges Cache)
```javascript
// Load ALL existing listings from localStorage (don't overwrite, MERGE!)
const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
let existingListingsMap = new Map();

if (cachedListings) {
  const parsedListings = JSON.parse(cachedListings);
  // Create a map of existing listings by itemId for quick lookup
  parsedListings.forEach(item => {
    existingListingsMap.set(item.itemId, item);
  });
  console.log('📦 Found', existingListingsMap.size, 'existing cached items');
}

// MERGE: Update existing items with new data, preserve imported status, add new items
listings.forEach(newItem => {
  const existingItem = existingListingsMap.get(newItem.itemId);
  
  if (existingItem) {
    // Item exists - update it but preserve the imported status
    existingListingsMap.set(newItem.itemId, {
      ...newItem,
      imported: existingItem.imported || false
    });
  } else {
    // New item - add it to the map
    existingListingsMap.set(newItem.itemId, {
      ...newItem,
      imported: false
    });
  }
});

// Convert map back to array
const mergedListings = Array.from(existingListingsMap.values());

console.log('✅ Merged cache:', {
  totalItems: mergedListings.length,
  newItems: listings.length,
  existingItems: existingListingsMap.size - listings.length,
  byStatus: mergedListings.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {})
});

// Now cache contains ALL items (old + new merged together!)
localStorage.setItem('profit_orbit_facebook_listings', JSON.stringify(mergedListings));
```

### Key Benefits

1. **Data Persistence**: All synced items stay in the cache permanently
2. **Status Updates**: If an item's status changes (e.g., Available → Sold), the cache updates it
3. **Import Status Preserved**: If you imported an item, it stays marked as imported even after re-syncing
4. **Efficient Lookups**: Using a Map provides O(1) lookup time instead of O(n) array searches
5. **Full Transparency**: Users can see all their items across all status filters

### How It Works

```
Initial State: Cache is empty
│
├─ User syncs "Sold" (fetches 100 items)
│  └─ Cache: {sold: 100, available: 0} = 100 total
│
├─ User syncs "Available" (fetches 30 items)
│  └─ Cache: {sold: 100, available: 30} = 130 total (MERGED!)
│
├─ User syncs "All" (fetches 150 items)
│  └─ Cache: {sold: 100, available: 30, out_of_stock: 20} = 150 total (UPDATED + MERGED!)
│
└─ User switches between filters
   └─ All items remain in cache, only display changes
```

## Applied To
- ✅ Facebook listings (`handleFacebookSync`)
- ✅ Mercari listings (`handleMercariSync`)
- ⚠️ eBay listings (uses different pattern with react-query, already handles this correctly)

## Testing
1. Sync "Sold" items → Verify count
2. Sync "Available" items → Verify both sold + available items exist
3. Switch to "All" status → Verify all items are visible
4. Navigate away and return → Verify items persist
5. Import some items → Verify import status persists after re-sync
6. Refresh page → Verify cache loads correctly

## Related Files
- `src/pages/Import.jsx` - Main implementation
- `extension/background.js` - Smart re-sync logic (stops after duplicate pages)
- `extension/facebook-api.js` - Facebook GraphQL API with 90-day filter for sold items

## Notes
- Cache is stored in `localStorage` with keys:
  - `profit_orbit_facebook_listings`
  - `profit_orbit_mercari_listings`
- The cache is also synced to React Query cache for reactivity
- Status filtering happens at display time (lines 966-1022 in Import.jsx)
- Import counts are calculated from filtered cache (lines 1025-1058)

## Future Improvements
- Consider adding a "Clear Cache" button for users
- Add cache size limits to prevent localStorage overflow
- Implement cache expiration for very old items
- Add conflict resolution if an item changes drastically
