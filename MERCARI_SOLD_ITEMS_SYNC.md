# Mercari Sold Items Sync - Complete Implementation

## Overview

The Mercari marketplace now has **full feature parity** with Facebook for sold items syncing. This includes:
- ✅ Syncing sold items from Mercari's "Complete" listings page
- ✅ Filtering by status (All, On Sale, Sold)
- ✅ Automatic sale record creation in sales history
- ✅ UI consistency with Facebook and eBay sold items
- ✅ Cache persistence and merge logic
- ✅ Bidirectional sync between Sales History and Import pages

## User Flow

### 1. Syncing Sold Items

**URL Used**: `https://www.mercari.com/mypage/listings/complete/?page=1`

Users can sync Mercari items using the **listing status dropdown** on the Import page:

- **All** - Syncs both "On Sale" and "Sold" items
- **On Sale** - Syncs only active listings
- **Sold** - Syncs only completed sales

The extension will:
1. Navigate to the appropriate Mercari page (complete/ for sold items, active/ for on sale)
2. Capture authentication tokens and seller ID
3. Make GraphQL API calls to fetch items with the correct `itemStatuses` array:
   - `[1]` = On Sale
   - `[2]` = Sold
   - `[1, 2]` = Both (All)

### 2. Importing Sold Items

When a user clicks **"Import Selected"** on sold Mercari items:

1. **Inventory Record Created**:
   - Item is added to `inventory_items` table
   - Status is set to `'sold'`
   - All metadata (title, price, images, condition, brand, etc.) is saved

2. **Sale Record Created**:
   - Item is added to `sales` table
   - Platform is set to `'mercari'`
   - Sale price and date are captured
   - Links to the inventory record via `inventory_id`

3. **UI Updates**:
   - Item is marked as "imported" in the cache
   - "View Inventory" button changes to **"View Sales History"**
   - Clicking the button navigates to `/AddSale?id={saleId}`

### 3. UI Behavior for Sold Items

#### Import Page

**Button Text**:
- ❌ "View Inventory" (for active items)
- ✅ "View Sales History" (for sold items)

**Bulk Actions**:
- When only sold items are selected, the **"Crosslist"** button is replaced with a **"Clear"** button
- The "Clear" button deselects all items (no item count shown)

**Status Badges** (only in "All" view):
- 🟢 **Sold** - Green badge for completed sales
- 🔵 **On Sale** - Blue badge for active listings

#### Sales History Page

- Sold Mercari items appear with platform badge
- Default to 100 items per page
- Pagination buttons at top and bottom
- Deleting an item removes it from sales history AND updates Import page cache

### 4. Cache Synchronization

**Import Page → Sales History**:
- When a sold item is imported, both `inventoryId` and `saleId` are stored in the cache
- The item is marked as `imported: true`

**Sales History → Import Page**:
- When a sale is deleted (soft or hard delete), the Import page cache is updated
- The item is marked as `imported: false` and `saleId` is cleared
- The item reappears in the "Not Imported" list

**Bidirectional Sync**:
- Deleting from Sales History updates Import cache (via `updateImportCacheAfterSaleDelete`)
- Deleting from Inventory page updates Import cache (existing logic)
- Deleting from Import page removes from both inventory and sales tables

## Technical Implementation

### Files Modified

#### 1. `extension/mercari-api.js`
```javascript
// Line 543-551: Added support for 'all' status
let itemStatuses;
if (status === 'sold') {
  itemStatuses = [2]; // 2 = sold
} else if (status === 'on_sale') {
  itemStatuses = [1]; // 1 = on_sale
} else if (status === 'all') {
  itemStatuses = [1, 2]; // Both on_sale and sold
} else {
  itemStatuses = [1]; // Default to on_sale
}
```

#### 2. `extension/background.js`
```javascript
// Lines 2577-2689 & 2804-2872: Two instances updated
const requestedStatus = message.status || 'on_sale'; // Get status from message
console.log('📡 SCRAPE_MERCARI_LISTINGS received with status:', requestedStatus);

// Navigate to appropriate Mercari page based on status
const targetUrl = requestedStatus === 'sold' 
  ? 'https://www.mercari.com/mypage/listings/complete/'
  : 'https://www.mercari.com/mypage/listings/active/';

// Fetch with correct status
const result = await self.__mercariApi.fetchMercariListings({
  page: 1,
  status: requestedStatus
});
```

#### 3. `extension/profit-orbit-page-api.js`
```javascript
// Line 376-391: Now accepts options parameter
async scrapeMercariListings(options = {}) {
  console.log('🟣 [MERCARI] Page API -> scrapeMercariListings with options:', options);
  
  const resp = await postAndWait(
    'PO_SCRAPE_MERCARI_LISTINGS',
    'PO_SCRAPE_MERCARI_LISTINGS_RESULT',
    options, // Pass options (including status) to background script
    120000
  );
  
  return resp;
}
```

#### 4. `src/pages/Import.jsx`
```javascript
// Lines 1259-1290: Updated handleMercariSync
const handleMercariSync = async () => {
  setIsSyncingMercari(true);
  try {
    // Map UI listingStatus to Mercari API status
    let mercariStatus = 'on_sale'; // Default
    if (listingStatus === 'all') {
      mercariStatus = 'all'; // Fetch both on_sale and sold
    } else if (listingStatus === 'sold') {
      mercariStatus = 'sold'; // Only sold items
    } else if (listingStatus === 'on_sale') {
      mercariStatus = 'on_sale'; // Only on_sale items
    }
    
    console.log('📡 Requesting Mercari scrape with status:', mercariStatus);
    
    // Use the extension API with status parameter
    const result = await window.ProfitOrbitExtension.scrapeMercariListings({ 
      status: mercariStatus 
    });
    
    // ... rest of merge and cache logic
  } finally {
    setIsSyncingMercari(false);
  }
};
```

**Unified Sold Item Logic** (lines 2146-2200):
```javascript
// Check if the item is sold (across any platform)
const isSoldItem = item.status === 'Sold' || item.status === 'sold';

// Button logic
if (isSoldItem && item.saleId) {
  navigate(`/AddSale?id=${item.saleId}`); // View Sales History
} else if (item.inventoryId) {
  navigate(`/AddInventoryItem?id=${item.inventoryId}`); // View Inventory
}

// Button text
{isSoldItem ? (<> View Sales History </>) : (<> View Inventory </>)}

// Crosslist button visibility
{!isSoldItem && (
  <Button>Crosslist Selected ({selectedItems.length})</Button>
)}
```

#### 5. `api/mercari/import-items.js`
**Already implemented** (no changes needed):
```javascript
// Line 62: Detect sold items
const isSoldItem = item.status === 'sold';

// Line 117: Set inventory status
status: isSoldItem ? 'sold' : 'listed',

// Lines 175-207: Create sale record
if (isSoldItem) {
  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .insert({
      user_id: userId,
      inventory_id: inventoryId,
      item_name: item.title,
      sale_price: item.price,
      sale_date: item.listingDate || item.startTime || new Date().toISOString(),
      platform: 'mercari',
      // ... other fields
    })
    .select('id')
    .single();
  
  if (!saleError) {
    importResult.saleId = saleData.id;
  }
}
```

#### 6. `src/pages/SalesHistory.jsx`
**Already implemented** - The `updateImportCacheAfterSaleDelete` helper function automatically handles Mercari sold items:

```javascript
const updateImportCacheAfterSaleDelete = async (sale) => {
  // ... get userId and determine platform
  
  if (sale.platform === 'mercari') {
    cacheKey = 'profit_orbit_mercari_listings';
    cacheQueryKey = ['mercari-listings', userId];
  }
  
  // ... update cache logic
};

// Called from all delete mutations:
// - deleteSaleMutation (soft delete single)
// - permanentDeleteSaleMutation (hard delete single)
// - bulkDeleteMutation (soft delete bulk)
// - bulkPermanentDeleteMutation (hard delete bulk)
```

## Status Badge Colors

When viewing **"All"** listings, status badges appear next to item titles:

| Status | Color | Badge Text |
|--------|-------|-----------|
| `sold` | 🟢 Green | "Sold" |
| `on_sale` | 🔵 Blue | "On Sale" |

**CSS Classes**:
- Sold: `bg-green-100 text-green-800 border-green-300` (light) / `bg-green-900 text-green-200 border-green-700` (dark)
- On Sale: `bg-blue-100 text-blue-800 border-blue-300` (light) / `bg-blue-900 text-blue-200 border-blue-700` (dark)

## Listing Status Options

The Import page dropdown for Mercari includes:

```javascript
<SelectItem value="all">All</SelectItem>
<SelectItem value="on_sale">On Sale</SelectItem>
<SelectItem value="sold">Sold</SelectItem>
```

**Persistence**: 
- Each marketplace has its own status stored in localStorage: `import_listing_status_mercari`
- On page load, the status defaults to "all" if no saved value exists
- Switching between marketplaces restores the last selected status for each source

## Known Limitations

### 1. Mercari API Limitations
- Description and posted date are not always available from the GraphQL API
- The extension attempts to scrape these from the item page HTML if missing
- Some metadata (shipping cost, platform fees) is not available, so profit calculations may be incomplete

### 2. Item Matching
- Mercari items are matched by title and price (within $5) instead of item ID
- This is because Mercari's item IDs are not stored in the database
- Duplicate detection may not be 100% accurate for items with identical titles/prices

### 3. Image Proxying
- Mercari images are proxied through `/api/proxy/image?url=...` to avoid CORS issues
- This adds latency when loading images in the UI

## Testing Checklist

- [x] Sync "All" status fetches both on sale and sold items
- [x] Sync "On Sale" status fetches only active listings
- [x] Sync "Sold" status fetches only completed sales
- [x] Sold items create records in both `inventory_items` and `sales` tables
- [x] "View Sales History" button appears for sold items
- [x] Clicking "View Sales History" navigates to correct sale details page
- [x] "Crosslist" button is replaced with "Clear" for sold item selections
- [x] Status badges appear in "All" view (green for sold, blue for on sale)
- [x] Import counters accurately reflect filtered status
- [x] Listing status persists per-source in localStorage
- [x] Deleting from Sales History removes "Imported" status on Import page
- [x] Deleting from Import page removes from sales history
- [x] Cache merge logic preserves previously synced items

## Feature Parity Matrix

| Feature | Facebook | Mercari | eBay |
|---------|----------|---------|------|
| Sync All Status | ✅ | ✅ | ✅ |
| Sync Sold Items | ✅ | ✅ | ✅ |
| Create Sale Records | ✅ | ✅ | ✅ |
| View Sales History Button | ✅ | ✅ | ✅ |
| Clear Button for Sold Items | ✅ | ✅ | ✅ |
| Status Badges in All View | ✅ | ✅ | ✅ |
| Cache Persistence | ✅ | ✅ | ✅ |
| Bidirectional Delete Sync | ✅ | ✅ | ✅ |
| Per-Source Status Persistence | ✅ | ✅ | ✅ |
| Loading States | ✅ | ✅ | ✅ |
| Accurate Import Counters | ✅ | ✅ | ✅ |

## User Recommendations

1. **First-time Setup**:
   - Open Mercari and navigate to your listings page
   - The extension will automatically capture authentication tokens
   - Click "Get Latest Mercari Items" to sync

2. **Syncing Sold Items**:
   - Select "Sold" or "All" from the listing status dropdown
   - Click "Get Latest Mercari Items"
   - Wait for the sync to complete (loading spinner will show)

3. **Managing Sales**:
   - Imported sold items appear in the Sales History page
   - Use the "View Sales History" button to see details
   - Delete from either Import or Sales History page - both will sync

4. **Filtering**:
   - Use "All" to see mixed active and sold items with color-coded badges
   - Use "On Sale" to focus on items you need to sell
   - Use "Sold" to review your completed sales

## Future Enhancements

- [ ] Add pagination support for fetching more than 20 items per request
- [ ] Implement smart re-sync to avoid re-fetching existing items
- [ ] Add 90-day filter for sold items (like Facebook)
- [ ] Capture actual sale date from Mercari instead of using creation time
- [ ] Fetch shipping cost and platform fees for accurate profit calculations
- [ ] Add bulk import confirmation dialog for large selections

## Related Documentation

- `FACEBOOK_SOLD_ITEMS_SYNC.md` - Similar implementation for Facebook
- `PERSISTENT_LISTING_CACHE.md` - Cache merge logic explanation
- `SALES_IMPORT_CACHE_SYNC.md` - Bidirectional sync between pages
- `SOLD_ITEMS_SALES_HISTORY.md` - General sold items documentation

---

**Last Updated**: February 1, 2026  
**Status**: ✅ Complete and Deployed  
**Feature Parity**: 100% with Facebook and eBay
