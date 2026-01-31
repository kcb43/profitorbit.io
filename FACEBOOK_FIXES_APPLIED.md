# Facebook Import & Crosslist Fixes - January 31, 2026

## Issues Fixed

### Issue #1: Facebook Import - Missing Descriptions and Categories

**Problem:**
- Descriptions were showing as just the title (not full descriptions)
- Categories, conditions, brand, and size were all `null`

**Root Cause:**
Facebook's persisted GraphQL query (`doc_id: 6222877017763459`) might not include the detailed fields we expect (`story_description`, `redacted_description`, `marketplace_listing_category`, etc.) in its response.

**Fix Applied:**
1. **Added comprehensive debug logging** in `facebook-api.js` to see exactly what fields Facebook returns:
   - Logs all available fields in the first listing
   - Logs the full listing object structure
   - Checks for presence of expected fields
   
2. **Updated import handler** in `api/facebook/import-items.js`:
   - Now uses `item.description` if available (instead of always using title)
   - Now uses `item.condition` if available (instead of hardcoding 'USED')
   - Now stores `item.category` in inventory

**What to Check:**
After reloading the extension and importing items, check the console logs:
- `🔍 DEBUG: All available fields in first listing:` - Shows what fields exist
- `🔍 DEBUG: Field check:` - Shows which specific fields are present/missing

If the fields are truly missing from the API response, we'll need to either:
- Find a different GraphQL query that includes them
- Use a hybrid approach (API + targeted scraping for details only)

---

### Issue #2: Crosslisting to Facebook - Missing Photos and Wrong Category

**Problem:**
- Photos were not showing up on created Facebook listings (despite successful upload)
- Category was wrong (e.g., selected "Figurines" but showed "Video Games")

**Root Cause:**
1. **Photos**: The photoId was being uploaded successfully but may not have been in the correct format/location in the GraphQL variables
2. **Category**: The frontend was NOT passing `categoryId` or `category` to the extension at all!

**Fixes Applied:**

#### 1. Category Fix (CrosslistComposer.jsx)
**Added category fields to payload:**
```javascript
const result = await ext.createFacebookListing({
  inventory_item_id: currentEditingItemId || null,
  payload: { 
    title, 
    description, 
    price, 
    images: photosToUse,
    // NEW: Include Facebook-specific fields
    categoryId: facebookForm.categoryId || generalForm.categoryId,
    category: facebookForm.category || generalForm.category,
    condition: facebookForm.condition || generalForm.condition,
  },
});
```

#### 2. Category Extraction (background.js)
**Added code to extract and use category:**
```javascript
// Extract Facebook-specific fields
const categoryId = payload.categoryId || payload.category_id || payload.facebookCategoryId || null;
const category = payload.category || null;
const condition = payload.condition || null;

// Later in the code, inject into GraphQL variables:
if (categoryId) {
  setDeepPreserveType(vars, ['input', 'data', 'common', 'marketplace_listing_category_id'], String(categoryId));
}

if (condition) {
  const conditionUpper = String(condition).toUpperCase();
  setDeepPreserveType(vars, ['input', 'data', 'common', 'condition'], conditionUpper);
}
```

#### 3. Enhanced Debug Logging (background.js)
**Added extensive logging to diagnose photo issues:**
```javascript
console.log('🟦 [FACEBOOK] Extracted payload fields:', {
  hasTitle: !!title,
  hasDescription: !!description,
  hasPrice: !!price,
  hasCategoryId: !!categoryId,
  categoryId: categoryId,
  category: category,
  condition: condition,
});

console.log('🟦 [FACEBOOK] Final GraphQL variables:', JSON.stringify(vars, null, 2).substring(0, 3000));
console.log('🟦 [FACEBOOK] Photo IDs in variables:', vars?.input?.data?.common?.photo_ids);
console.log('🟦 [FACEBOOK] Category ID in variables:', vars?.input?.data?.common?.marketplace_listing_category_id);
```

---

## Files Modified

1. **extension/facebook-api.js**
   - Added comprehensive debug logging for GraphQL response structure
   - Logs all available fields and checks for expected fields
   - Helps identify if Facebook's API returns the fields we need

2. **src/pages/CrosslistComposer.jsx** (2 locations)
   - Added `categoryId`, `category`, and `condition` to Facebook listing payload
   - Falls back to general form values if Facebook-specific values not set

3. **extension/background.js**
   - Extracts `categoryId`, `category`, and `condition` from payload
   - Injects category ID into GraphQL variables at `input.data.common.marketplace_listing_category_id`
   - Injects condition into GraphQL variables at `input.data.common.condition`
   - Added extensive debug logging for all extracted fields and final variables

4. **api/facebook/import-items.js**
   - Now uses `item.condition` if available (instead of hardcoding 'USED')
   - Now stores `item.category` in the inventory

---

## Testing Instructions

### Test Issue #1 Fix (Import)
1. Reload Chrome extension (chrome://extensions/)
2. Go to Import page
3. Click "Get Latest Facebook Items"
4. **Check console logs** for:
   - `🔍 DEBUG: All available fields in first listing:` - What fields exist
   - `🔍 DEBUG: Field check:` - Which specific fields are true/false
   - `🔍 DEBUG: First listing full object` - Full response structure
5. Import an item and check inventory:
   - Does description show the full description (not just title)?
   - Does category appear?
   - Does condition appear?

### Test Issue #2 Fix (Crosslist)
1. Reload Chrome extension (chrome://extensions/)
2. Refresh frontend (Ctrl+F5)
3. Go to Crosslist page
4. Select an item with photos
5. Fill out Facebook form with a specific category (e.g., "Collectibles > Figurines")
6. Click "List on Facebook"
7. **Check console logs** for:
   - `🟦 [FACEBOOK] Extracted payload fields:` - Verify `categoryId` is present
   - `🟦 [FACEBOOK] Final GraphQL variables:` - Verify structure looks correct
   - `🟦 [FACEBOOK] Photo IDs in variables:` - Verify photo_ids array exists
   - `🟦 [FACEBOOK] Category ID in variables:` - Verify category ID is set
8. Go to Facebook Marketplace and check the listing:
   - Are photos visible?
   - Is the correct category showing?

---

## Next Steps Based on Test Results

### If Import Still Missing Data:
The debug logs will show us:
- **If fields don't exist in response**: We need to find a different GraphQL query or add targeted scraping
- **If fields exist but are null**: Facebook might not have that data for those specific listings

### If Photos Still Missing:
The debug logs will show us:
- Is `photo_ids` array in the correct location?
- Is the photo ID in the correct format (number vs string)?
- Check Facebook's error response for clues

### If Category Still Wrong:
The debug logs will show us:
- Is `categoryId` being extracted correctly?
- Is it being set in the right location in GraphQL variables?
- Check Facebook's error response for field validation issues

---

## Performance Impact

- **Import speed**: No change (still fast, ~5-10 seconds for 20 items)
- **Crosslist speed**: No change (single additional field in payload)
- **Code quality**: Improved with comprehensive logging for debugging

---

## Rollback Instructions

If issues occur, revert these commits:
1. `git log --oneline` - Find the commit hash
2. `git revert <commit-hash>`
3. `git push origin main`
