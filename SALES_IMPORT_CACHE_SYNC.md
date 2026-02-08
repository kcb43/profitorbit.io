# Sales History and Import Page Synchronization

## Overview
When deleting sold items from Sales History or Inventory pages, the Import page cache is automatically updated to reflect the deletion. This ensures counters stay accurate and items return to the "Not Imported" list.

## Problem Solved
Previously, when you deleted a sold Facebook/Mercari item from:
- Sales History page → Import counter stayed at "1 Imported" ❌
- Inventory page → Item remained marked as imported ❌

This caused data inconsistency between pages.

## Solution: Cross-Page Cache Synchronization

### Implementation (SalesHistory.jsx)

Added `updateImportCacheAfterSaleDelete()` helper function that:
1. Gets the current user ID from Supabase auth
2. Determines which marketplace the sale came from (platform field)
3. Updates the appropriate Import cache (Facebook/Mercari/eBay)
4. Marks the item as `imported: false`
5. Removes `inventoryId` and `saleId` references
6. Persists to both localStorage and React Query cache

```javascript
const updateImportCacheAfterSaleDelete = async (sale) => {
  try {
    // Get user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const userId = user.id;
    
    // Determine cache based on platform
    let cacheKey = null;
    let cacheQueryKey = null;
    
    if (sale.platform === 'facebook' || sale.platform === 'facebook_marketplace') {
      cacheKey = 'profit_orbit_facebook_listings';
      cacheQueryKey = ['facebook-listings', userId];
    } else if (sale.platform === 'mercari') {
      cacheKey = 'profit_orbit_mercari_listings';
      cacheQueryKey = ['mercari-listings', userId];
    }
    
    // Update cache
    const cachedListings = localStorage.getItem(cacheKey);
    if (cachedListings) {
      const parsedListings = JSON.parse(cachedListings);
      const updatedListings = parsedListings.map(item => {
        // Match by inventory_id
        if (item.inventoryId === sale.inventory_id) {
          return { ...item, imported: false, inventoryId: null, saleId: null };
        }
        return item;
      });
      
      localStorage.setItem(cacheKey, JSON.stringify(updatedListings));
      queryClient.setQueryData(cacheQueryKey, updatedListings);
    }
  } catch (error) {
    console.error('Error updating Import cache:', error);
  }
};
```

### Called From All Delete Mutations

1. **Soft Delete (deleteSaleMutation)** - Lines 688-691
   ```javascript
   onSuccess: (data, sale) => {
     // ... existing code ...
     updateImportCacheAfterSaleDelete(sale);
     // ...
   }
   ```

2. **Permanent Delete (permanentDeleteSaleMutation)** - Lines 793-795
   ```javascript
   onSuccess: (saleId, sale) => {
     // ... existing code ...
     updateImportCacheAfterSaleDelete(sale);
     // ...
   }
   ```

3. **Bulk Soft Delete (bulkDeleteMutation)** - Lines 960-961
   ```javascript
   onSuccess: ({ saleIds, salesToDelete }) => {
     // ... existing code ...
     salesToDelete.forEach(sale => updateImportCacheAfterSaleDelete(sale));
     // ...
   }
   ```

4. **Bulk Permanent Delete (bulkPermanentDeleteMutation)** - Lines 854-855
   ```javascript
   onSuccess: ({ saleIds, salesToDelete }) => {
     // ... existing code ...
     salesToDelete.forEach(sale => updateImportCacheAfterSaleDelete(sale));
     // ...
   }
   ```

## How It Works

### Matching Logic
The helper matches sales to Import cache items using `inventory_id`:
```javascript
// In Import cache, items have: { itemId, inventoryId, imported, saleId }
// In Sales table, sales have: { id (saleId), inventory_id, platform }

// Match by:
item.inventoryId === sale.inventory_id
```

### Platform Detection
Uses the `platform` field from the sale record:
- `'facebook'` or `'facebook_marketplace'` → Updates `profit_orbit_facebook_listings`
- `'mercari'` → Updates `profit_orbit_mercari_listings`
- `'ebay'` → Skipped (Import page handles this already)

### Cache Updates
When a sale is deleted:
```javascript
// Before deletion:
{
  itemId: '1234',
  imported: true,
  inventoryId: 'inv-uuid',
  saleId: 'sale-uuid',
  status: 'sold'
}

// After deletion:
{
  itemId: '1234',
  imported: false,      // ← Changed!
  inventoryId: null,    // ← Cleared!
  saleId: null,         // ← Cleared!
  status: 'sold'        // ← Unchanged
}
```

## Import Page Behavior

### Before Fix
1. Import sold FB item → Shows "1 Imported"
2. Delete from Sales History → Still shows "1 Imported" ❌
3. Item stays in "Imported" list ❌
4. Counter is wrong ❌

### After Fix
1. Import sold FB item → Shows "1 Imported"
2. Delete from Sales History → Shows "0 Imported" ✅
3. Item returns to "Not Imported" list ✅
4. Counter is accurate ✅
5. Can re-import the item if needed ✅

## Also Works From Inventory Page
The Inventory page already had similar logic (lines 448-797 in Inventory.jsx) that updates Import caches when deleting inventory items. This ensures consistency whether you delete from:
- ✅ Sales History page (soft or permanent delete)
- ✅ Inventory page (permanent delete)
- ✅ Import page (delete button on imported items)

## Edge Cases Handled

1. **User not logged in**: Silently skips cache update
2. **Platform not supported**: Logs warning and continues
3. **Cache doesn't exist**: Silently skips (user hasn't synced yet)
4. **Inventory ID mismatch**: Item stays marked as imported (safe fallback)
5. **Bulk operations**: Handles multiple sales at once efficiently

## Related Files
- `src/pages/SalesHistory.jsx` - Added helper function and integrated with all delete mutations
- `src/pages/Inventory.jsx` - Already had similar logic for inventory deletes
- `src/pages/Import.jsx` - Consumes the updated cache and displays correct counts

## Testing Checklist

### Facebook Sold Items
- [ ] Import a sold FB item → Verify "1 Imported"
- [ ] Delete from Sales History → Verify "0 Imported"
- [ ] Check "Not Imported" list → Verify item appears
- [ ] Re-import → Verify it works

### Mercari Sold Items
- [ ] Same tests as Facebook

### eBay Sold Items
- [ ] Import a sold eBay item → Verify "1 Imported"
- [ ] Delete from Sales History → Verify "0 Imported"
- [ ] Verify counter accuracy

### Bulk Operations
- [ ] Import 5 sold items
- [ ] Bulk delete from Sales History
- [ ] Verify all return to "Not Imported"
- [ ] Verify counter shows 0

### Inventory Page
- [ ] Import sold item (creates inventory + sale)
- [ ] Delete from Inventory page
- [ ] Verify Import cache updates
- [ ] Verify item returns to "Not Imported"

## UI Improvements Included

1. **Clear Button for Sold Items** (Import page)
   - When sold items selected → Shows "Clear" button (no count)
   - Clicking clears all selections
   - Replaces Crosslist button which doesn't make sense for sold items

2. **Sales History Pagination**
   - Default page size changed from 50 to 100 items
   - Added Prev/Next buttons at bottom of page (matching top)
   - Better navigation for long sales lists

3. **Consistent Button Labels**
   - Sold items (all platforms) → "View Sales History"
   - Active items → "View Inventory"
   - Delete dialog shows correct text based on item type

## Notes
- Import cache uses `inventoryId` to link items across pages
- Sales use `inventory_id` (snake_case) which matches the `inventoryId` (camelCase) in Import cache
- Cache updates are async but non-blocking (won't fail the delete if cache update fails)
- eBay uses different caching strategy (react-query based, not localStorage)

## Future Improvements
- [ ] Add real-time sync across browser tabs using BroadcastChannel API
- [ ] Add cache versioning to handle schema changes
- [ ] Consider using IndexedDB for larger caches
- [ ] Add cache health check on app startup
