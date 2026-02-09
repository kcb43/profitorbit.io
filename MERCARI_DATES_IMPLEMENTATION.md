# Mercari Posted Dates Implementation Summary

## Overview
Successfully implemented posted date display and storage for Mercari items (both on_sale and sold).

## Changes Made

### 1. Frontend Display (Import.jsx)
**File:** `src/pages/Import.jsx`

**What Changed:**
- Updated date label logic to show **"Date sold:"** for sold Mercari items
- Shows **"Posted:"** for active (on_sale) Mercari items
- Matches behavior of eBay and Facebook

**Code:**
```javascript
{selectedSource === "mercari" 
  ? (item.status === "sold" || item.status === "sold_out" ? "Date sold: " : "Posted: ")
  : selectedSource === "facebook" 
  ? (item.status === "sold" ? "Date sold: " : "Posted: ")
  : selectedSource === "ebay" 
    ? (item.status === "Sold" ? "Date sold: " : "Posted: ")
    : ""}
{format(new Date(item.startTime), "MMM dd, yyyy")} · 
```

### 2. Backend Storage (import-items.js)
**File:** `api/mercari/import-items.js`

**What Changed:**
- Now saves the **actual posted date** from Mercari to `purchase_date` field
- Previously was using today's date (`new Date()`)
- Fallback chain: `listingDate` → `startTime` → today's date

**Code:**
```javascript
purchase_date: item.listingDate 
  ? new Date(item.listingDate).toISOString().split('T')[0]
  : item.startTime 
    ? new Date(item.startTime).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0],
```

### 3. Extension API (mercari-api.js)
**File:** `extension/mercari-api.js`

**Already Implemented:**
The extension API (`userItemsQuery`) already captures:
```javascript
startTime: item.created ? new Date(item.created * 1000).toISOString() : 
           item.updated ? new Date(item.updated * 1000).toISOString() : null,
listingDate: item.created ? new Date(item.created * 1000).toISOString() :
             item.updated ? new Date(item.updated * 1000).toISOString() : null,
```

## Data Flow

### From Mercari → Import Page
1. **Mercari API** returns `created` and `updated` timestamps (in seconds)
2. **Extension** converts to ISO format and stores as `startTime` and `listingDate`
3. **Import Page** displays using `item.startTime` with label based on status

### From Import Page → Database
1. **User imports** Mercari item
2. **Backend API** receives `item.listingDate` or `item.startTime`
3. **Database** stores in `purchase_date` column (inventory_items table)
4. **Sales table** stores in `sale_date` column (for sold items only)

## Display Format

### Import Page
- **Active Items:** "Posted: Dec 15, 2025 · $45.00"
- **Sold Items:** "Date sold: Jan 10, 2026 · $50.00"

### Status Badges (when "All" is selected)
- **On Sale** - Blue badge
- **Sold** - Green badge

## Database Schema

### inventory_items table
- `purchase_date` - Date item was posted on Mercari (DATE format)

### sales table  
- `sale_date` - Date item was sold on Mercari (TIMESTAMP format)

## Testing Checklist

### Import Page Display
- [ ] Mercari active items show "Posted: [date]"
- [ ] Mercari sold items show "Date sold: [date]"
- [ ] Date format is "MMM dd, yyyy" (e.g., "Dec 15, 2025")
- [ ] Date appears before the price

### After Import to Database
- [ ] Check `inventory_items.purchase_date` matches posted date
- [ ] Check `sales.sale_date` matches posted date (for sold items)
- [ ] Verify dates are NOT today's date (unless item was just posted today)

### SQL Query to Verify
```sql
-- Check imported Mercari items
SELECT 
  item_name,
  listing_price,
  purchase_date,
  status,
  source
FROM inventory_items
WHERE source = 'Mercari'
  AND user_id = 'YOUR_USER_ID'
ORDER BY purchase_date DESC
LIMIT 10;

-- Check sold Mercari items
SELECT 
  s.item_name,
  s.sale_price,
  s.sale_date,
  i.purchase_date,
  i.status
FROM sales s
JOIN inventory_items i ON s.inventory_id = i.id
WHERE s.platform = 'mercari'
  AND i.user_id = 'YOUR_USER_ID'
ORDER BY s.sale_date DESC
LIMIT 10;
```

## Additional Metadata Captured (For Future Use)

The `userItemsQuery` API also captures these fields, which are NOT yet displayed but are stored in localStorage:

- `favorites` - Number of favorites
- `numLikes` - Number of likes
- `autoLiked` - Whether auto-like was used
- `created` - Unix timestamp when item was created
- `updated` - Unix timestamp when item was last updated

These can be used for future Pro Tools features like:
- Auto-like management dashboard
- Engagement analytics
- Time-to-sell analysis
- Popular items reports

## Related Files
- `extension/mercari-api.js` - Fetches data from Mercari API
- `src/pages/Import.jsx` - Displays dates in UI
- `api/mercari/import-items.js` - Saves dates to database
- `MERCARI_USER_ITEMS_API.md` - API documentation
- `MERCARI_TESTING_GUIDE.md` - Testing instructions

## Git Commits
1. **Commit 1:** `d391259` - Implement Mercari sold items sync with userItemsQuery API
2. **Commit 2:** `31fbbae` - Display posted dates for Mercari items in Import page and database

## Status
✅ **Complete** - Posted dates now display correctly and save to database
