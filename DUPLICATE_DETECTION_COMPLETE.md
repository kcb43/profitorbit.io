# Duplicate Detection for Marketplace Imports - Implementation Complete

## Overview
Implemented smart duplicate detection across all marketplace imports (eBay, Facebook, Mercari) to prevent creating duplicate inventory records when users import items they've already added manually or previously imported.

---

## How It Works

### eBay (Most Accurate)
**Matching Strategy**: Uses eBay's unique `ebay_item_id`
- Queries existing inventory for matching `ebay_item_id`
- If found: Links sale to existing inventory, updates status to 'sold' if needed
- If not found: Creates new inventory record

**Why This Works Best**: eBay provides unique item IDs that persist across imports

### Facebook (Title + Price Matching)
**Matching Strategy**: Matches by exact title + price similarity (within $5)
- Queries existing inventory for exact title match (case-insensitive)
- Validates price is within $5 of existing item
- If found: Links to existing inventory
- If not found: Creates new inventory record

**Why Price Tolerance**: Users may adjust price slightly between manual entry and marketplace listing

### Mercari (Title + Price Matching)
**Matching Strategy**: Same as Facebook - title + price similarity (within $5)
- Queries existing inventory for exact title match (case-insensitive)
- Validates price is within $5 of existing item
- If found: Links to existing inventory
- If not found: Creates new inventory record

**Note**: Mercari has item IDs but they're not stored in our DB, so we match by title/price

---

## User Experience

### Import Success Messages
The toast notification now shows:
- **No duplicates**: "Import successful - Imported 5 item(s)"
- **With duplicates**: "Import completed (duplicates detected) - Imported 5 item(s), 2 linked to existing inventory"
- **With errors**: "Import completed with errors - Imported 3 item(s), 2 linked to existing inventory, 1 failed"

### Backend Logging
Console logs clearly indicate when duplicates are found:
```
✅ Found existing inventory item: Nike Air Max (ID: abc-123)
✅ Successfully imported item 257237875304 with inventory ID abc-123 (linked to existing inventory)
```

---

## Typical Scenarios Handled

### Scenario 1: Manual Entry → Crosslist → Sell → Import
1. User manually adds "Nike Air Max" to inventory
2. User crosslists it to eBay
3. Item sells on eBay
4. User imports sold items from eBay
5. **Result**: Sale is linked to existing inventory record, no duplicate created

### Scenario 2: Import Active → Sell → Import Sold
1. User imports active listing from eBay
2. Item sells
3. User imports sold items
4. **Result**: Sale is linked to existing inventory, status updated to 'sold'

### Scenario 3: Already Imported
1. User imports item from marketplace
2. User tries to import same item again
3. **Result**: Linked to existing inventory, user notified about duplicate

---

## API Changes

### All Import APIs Now Return:
```json
{
  "imported": 5,
  "failed": 0,
  "duplicates": 2,  // NEW: Count of items linked to existing inventory
  "importedItems": [
    {
      "itemId": "123",
      "inventoryId": "abc-456",
      "isExistingItem": false  // NEW: Flag indicating if duplicate
    },
    {
      "itemId": "789",
      "inventoryId": "def-012",
      "isExistingItem": true   // This was a duplicate
    }
  ]
}
```

---

## Database Queries

### eBay Duplicate Check
```sql
SELECT id, item_name, status 
FROM inventory_items 
WHERE user_id = ?
  AND ebay_item_id = ?
  AND deleted_at IS NULL
```

### Facebook/Mercari Duplicate Check
```sql
SELECT id, item_name, status, listing_price 
FROM inventory_items 
WHERE user_id = ?
  AND source = 'Facebook' -- or 'Mercari'
  AND item_name ILIKE ?
  AND deleted_at IS NULL
```
Then validates: `ABS(existing_price - new_price) <= 5`

---

## Edge Cases Handled

### 1. Price Changes
- **Scenario**: User listed item at $50, later changed to $48
- **Result**: Still matches (within $5 tolerance)

### 2. Title Variations
- **Scenario**: User manually entered "Nike Air Max" but marketplace shows "NIKE AIR MAX"
- **Result**: Still matches (case-insensitive comparison)

### 3. Multiple Quantities
- **Scenario**: User sold 3 of same item to different buyers
- **Result**: Each sale links to same inventory record (as expected)

### 4. Re-imports
- **Scenario**: User imports, deletes from UI, then imports again
- **Result**: Creates new record (deleted_at check excludes soft-deleted items)

---

## Future Enhancements (Optional)

### 1. Fuzzy Title Matching
Could use similarity algorithms (Levenshtein distance) for even better matching:
- "Nike Air Max" vs "Nike Air Max Shoes" → 90% similar
- Would reduce false negatives

### 2. Image Comparison
Could use image hashing to match items visually:
- Perceptual hash of primary image
- Match even if title/price slightly different

### 3. User Confirmation
Could show duplicate detection UI before import:
- "We found 2 existing items that might be duplicates. Review before importing?"
- Let user choose to link or create new

### 4. SKU Matching
If user uses SKUs consistently:
- Match by SKU first (most reliable)
- Fall back to title/price if no SKU

---

## Testing Checklist

- [x] eBay: Import sold item that was manually added
- [x] eBay: Import sold item that was already imported as active
- [x] Facebook: Import item with same title and similar price
- [x] Mercari: Import item with same title and similar price
- [x] Verify toast shows duplicate count
- [x] Verify no duplicate inventory records created
- [x] Verify sales records correctly link to existing inventory
- [x] Verify console logs show "linked to existing inventory"

---

## Files Modified

1. **api/ebay/import-items.js** - eBay duplicate detection by `ebay_item_id`
2. **api/facebook/import-items.js** - Facebook duplicate detection by title + price
3. **api/mercari/import-items.js** - Mercari duplicate detection by title + price
4. **src/pages/Import.jsx** - Updated toast to show duplicate count

---

## Notes

- All duplicate checks happen BEFORE creating inventory records
- Performance impact is minimal (single indexed query per item)
- Soft-deleted items (deleted_at IS NOT NULL) are excluded from matching
- For eBay sold items, if duplicate found and status is not 'sold', updates it automatically
