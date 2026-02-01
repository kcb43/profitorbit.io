# Mercari Import Fixes - In Progress

## Issues Fixed

### Bug 1: Pagination Not Working ✅
**Problem**: The `fetchMercariListings` function accepted a `page` parameter but ignored it. The query always fetched the first 20 items, preventing users with 20+ listings from importing all their items.

**Fix Applied** (`extension/mercari-api.js`):
- Added offset calculation: `offset = (page - 1) * pageSize`
- Added `offset` field to GraphQL query criteria
- Fixed `currentPage` in return value to use actual `page` parameter instead of hardcoded `1`
- Fixed `hasNext` logic to correctly calculate: `(offset + listings.length) < count`

**Result**: Users can now paginate through all their Mercari listings.

---

### Bug 2: Status Filter Not Working ✅
**Problem**: The `fetchMercariListings` function accepted a `status` parameter but ignored it. The query hardcoded `itemStatuses: [1]` (on_sale), so requesting sold items would still return on_sale items.

**Fix Applied** (`extension/mercari-api.js`):
- Added status conversion logic:
  - `'sold'` → `itemStatuses: [2]`
  - `'on_sale'` → `itemStatuses: [1]`
  - Invalid values default to `[1]` (on_sale)
- Used dynamic `itemStatuses` array in query instead of hardcoded value

**Result**: Status filtering now works correctly for both on_sale and sold items.

---

### Bug 3: Mercari Item Details Not Displayed in UI ✅
**Problem**: Mercari items were being imported with metadata (brand, condition, size, category) successfully saved to the database, but these fields were not displayed in the inventory UI.

**Fixes Applied**:

1. **Inventory List View - Desktop** (`src/pages/Inventory.jsx` lines ~2398-2480):
   - Added conditional display of: `condition`, `brand`, `size`, `category`, `source`
   - Fields only show if they have values
   - Uses 2-column grid layout for clean presentation

2. **Inventory List View - Mobile/Tablet** (`src/pages/Inventory.jsx` lines ~2119-2160):
   - Added conditional display of same metadata fields
   - Matches desktop styling for consistency

3. **View Details Dialog** (`src/components/InventoryItemViewDialog.jsx` lines ~128-165):
   - Added conditional display of: `condition`, `brand`, `size`
   - Already had `category` and `source` displayed
   - Uses Package icon for consistency

**Result**: All Mercari import metadata now visible throughout the UI.

---

### Bug 4: Descriptions Not Being Fetched 🔍 INVESTIGATING

**Problem**: The `searchQuery` returns `description: ""` (empty string) even though Mercari listings have descriptions.

**Root Cause**: The `searchQuery` GraphQL endpoint may not include full descriptions in the response. We need to:
1. Verify what fields are actually available in `searchQuery`
2. Test if `itemQuery` (individual item fetch) returns descriptions
3. Find the correct field name or alternative method to get descriptions

**Investigation Added** (`extension/mercari-api.js`):
- Added enhanced debug logging to show ALL available fields in search results
- Restored `fetchMercariItemDetails` function with full field debugging
- Logs all possible description-related fields

**Next Steps**:
1. User needs to run the test script (see `MERCARI_DESCRIPTION_DEBUG.md`)
2. Check console output to see what fields are available
3. Based on findings, implement the appropriate solution:
   - **Option A**: Fetch individual item details after search (if `itemQuery` has descriptions)
   - **Option B**: Use a different field name if description exists under another key
   - **Option C**: Implement DOM scraping if API doesn't provide descriptions

**Debug Guide**: See `MERCARI_DESCRIPTION_DEBUG.md` for detailed investigation steps

---

## Technical Details

### Mercari API Changes
The migration from `userItemsQuery` to `searchQuery` now properly supports:
- **Pagination**: Uses `offset` and `length` fields
- **Status filtering**: Uses `itemStatuses` array
- **Rich metadata**: Returns condition, brand, size, category in search results
- **Descriptions**: ⚠️ Under investigation - may require additional API call or scraping

### Database Schema
All required columns already exist in `inventory_items` table:
- `brand` (TEXT)
- `condition` (TEXT)  
- `size` (TEXT)
- `category` (TEXT)
- `description` (TEXT)
- `listing_price` (DECIMAL)

Migration `20260201_ensure_all_metadata_columns.sql` ensures these columns exist.

### Data Flow
1. **Extension** (`mercari-api.js`): Fetches listings from Mercari GraphQL API with metadata
2. **API** (`api/mercari/import-items.js`): Saves items to database including brand, condition, size, category, description
3. **Frontend** (`src/pages/Inventory.jsx`, `src/components/InventoryItemViewDialog.jsx`): Displays all metadata fields

---

## Testing Recommendations

1. **Test Pagination**:
   - Import from account with 20+ Mercari listings
   - Verify all items are imported (check count matches Mercari)

2. **Test Status Filter**:
   - Request sold items: `fetchMercariListings({ status: 'sold' })`
   - Verify only sold items returned

3. **Test UI Display**:
   - Import Mercari items with various metadata
   - Check List View (desktop & mobile) shows: condition, brand, size, category
   - Click "View Details" and verify all fields display
   - Test with items missing some fields (should gracefully hide missing fields)

4. **Test Description Fetching** (PENDING):
   - Run investigation script from `MERCARI_DESCRIPTION_DEBUG.md`
   - Report back findings to determine solution

---

## Files Modified

1. `extension/mercari-api.js` - Fixed pagination, status filtering, added description debugging
2. `src/pages/Inventory.jsx` - Added metadata display to list views
3. `src/components/InventoryItemViewDialog.jsx` - Added metadata display to detail view
4. `MERCARI_DESCRIPTION_DEBUG.md` - Investigation guide for finding descriptions

---

**Status**: 🔍 3 bugs fixed, 1 under investigation (descriptions)
**Date**: February 1, 2026
**Action Required**: Run debug script to investigate description field availability
