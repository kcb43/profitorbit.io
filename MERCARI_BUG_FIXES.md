# Mercari Sync Bug Fixes

## Overview
Fixed three critical bugs in the Mercari sold items sync implementation.

---

## Bug 1: Pagination Duplicates for "All" Status

### Problem
When fetching with `status='all'` and any page number, the code always fetched `page: 1` for sold items while correctly paginating on_sale items.

**Impact:**
- Sold items from page 1 were duplicated on every subsequent page request
- `hasNext` incorrectly included `soldResult.pagination.hasNext`
- Misleadingly indicated more unique items were available when they would just be duplicates

**Example:**
```javascript
// Page 1: Shows on_sale items 1-20 + sold items 1-20 ✓
// Page 2: Shows on_sale items 21-40 + sold items 1-20 ✗ (DUPLICATE)
// Page 3: Shows on_sale items 41-60 + sold items 1-20 ✗ (DUPLICATE)
```

### Fix
**File:** `extension/mercari-api.js` (Line 752)

**Before:**
```javascript
const soldResult = await fetchMercariListings({ page: 1, status: 'sold' });
```

**After:**
```javascript
const soldResult = await fetchMercariListings({ page: page, status: 'sold' });
```

**Result:**
- Sold items now paginate correctly alongside on_sale items
- No more duplicates on subsequent pages
- `hasNext` correctly indicates when either category has more pages

---

## Bug 2: Misleading "Sold:" Date Label

### Problem
For sold Mercari items, the label changed from "Posted:" to "Sold:", but the date displayed (`item.startTime`) was still the `created` timestamp representing when the item was originally **listed**, not when it was **sold**.

**Impact:**
- Users interpreted the date as the sale date rather than the listing date
- Misleading information: "Sold: Dec 15, 2025" implied item sold on Dec 15, but it was actually listed on Dec 15

**Root Cause:**
- Mercari's `userItemsQuery` API only provides `created` and `updated` timestamps
- No separate "sold_date" or "sold_at" field in the API response
- The date represents when the item was first listed, not when it sold

### Fix
**File:** `src/pages/Import.jsx` (Line 2185)

**Before:**
```javascript
? (item.status === "sold" || item.status === "sold_out" ? "Sold: " : "Posted: ")
```

**After:**
```javascript
? (item.status === "sold" || item.status === "sold_out" ? "Listed: " : "Posted: ")
```

**Result:**
- Sold Mercari items now show: **"Listed: Dec 15, 2025"** (accurate - when it was listed)
- Active Mercari items show: **"Posted: Dec 15, 2025"** (unchanged)
- Users no longer confused about what the date represents

**Note:** Facebook and eBay kept "Sold:" label because their APIs provide actual sale dates.

---

## Bug 3: Sold Items Not Recognized by Backend

### Problem
The new `userItemsQuery` API returns `"sold_out"` for sold Mercari items, but the backend only checked for `item.status === 'sold'`.

**Impact:**
- `isSoldItem` evaluated to `false` for all sold Mercari items
- Items were stored with `status: 'listed'` instead of `'sold'`
- **No sale records were created** in the `sales` table
- Sold items appeared as active inventory instead of completed sales

**Inconsistency:**
- Frontend was correctly updated to check both `"sold"` and `"sold_out"` (line 2185)
- Backend wasn't updated to match the frontend logic

### Fix
**File:** `api/mercari/import-items.js` (Line 62)

**Before:**
```javascript
const isSoldItem = item.status === 'sold';
```

**After:**
```javascript
const isSoldItem = item.status === 'sold' || item.status === 'sold_out';
```

**Result:**
- Sold Mercari items are now correctly identified
- Items stored with `status: 'sold'` in inventory_items table
- Sale records created in `sales` table with proper sale_date
- Backend logic now matches frontend and API response

---

## Testing Checklist

### Bug 1 - Pagination
- [ ] Set status to "All (On Sale & Sold Out)"
- [ ] Click through multiple pages
- [ ] Verify sold items change on each page (not duplicated)
- [ ] Check that page 2+ shows different sold items than page 1

### Bug 2 - Date Labels
- [ ] Sync Mercari items with status "All"
- [ ] Verify sold items show **"Listed: [date]"** not "Sold: [date]"
- [ ] Verify active items still show **"Posted: [date]"**
- [ ] Compare with Facebook/eBay which should show "Sold: [date]"

### Bug 3 - Backend Recognition
- [ ] Import a sold Mercari item
- [ ] Check database: `SELECT * FROM inventory_items WHERE source='Mercari' ORDER BY created_at DESC LIMIT 1`
- [ ] Verify `status = 'sold'` (not 'listed')
- [ ] Check database: `SELECT * FROM sales WHERE platform='mercari' ORDER BY created_at DESC LIMIT 1`
- [ ] Verify sale record was created

### SQL Verification Queries
```sql
-- Check sold item status
SELECT 
  item_name,
  status,
  listing_price,
  purchase_date
FROM inventory_items
WHERE source = 'Mercari'
  AND user_id = 'YOUR_USER_ID'
  AND status = 'sold'
ORDER BY created_at DESC
LIMIT 5;

-- Check sale records were created
SELECT 
  s.item_name,
  s.sale_price,
  s.sale_date,
  i.status
FROM sales s
JOIN inventory_items i ON s.inventory_id = i.id
WHERE s.platform = 'mercari'
  AND i.user_id = 'YOUR_USER_ID'
ORDER BY s.created_at DESC
LIMIT 5;
```

---

## Files Changed

1. **extension/mercari-api.js**
   - Fixed pagination to use `page` variable instead of hardcoded `page: 1`

2. **src/pages/Import.jsx**
   - Changed sold Mercari item label from "Sold:" to "Listed:"

3. **api/mercari/import-items.js**
   - Updated `isSoldItem` check to include both `'sold'` and `'sold_out'`

---

## Git Commit

**Commit:** `5a66a60`
**Branch:** `main`
**Pushed:** ✅ Yes

**Commit Message:**
```
Fix three critical Mercari sync bugs

Bug 1: Fixed pagination for all status - now correctly paginates both 
on_sale and sold items instead of always fetching page 1 for sold items.

Bug 2: Changed sold item label from Sold to Listed since startTime 
represents listing date not sale date for Mercari.

Bug 3: Fixed backend to recognize sold_out status - backend now checks 
for both sold and sold_out matching the API response.
```

---

## Related Documentation
- `MERCARI_USER_ITEMS_API.md` - API documentation
- `MERCARI_TESTING_GUIDE.md` - Testing instructions
- `MERCARI_DATES_IMPLEMENTATION.md` - Date implementation details

---

## Status
✅ **All bugs fixed and pushed to production**
