# Facebook Import & Crosslisting Issues - Fix Plan

## Issue #1: Descriptions and Categories Not Imported

### Problem
When importing Facebook items into inventory:
- Description shows as just the title (not the full description)
- Category is always `null`
- Condition, brand, size are all `null`

### Root Cause
The GraphQL query (`doc_id: 6222877017763459`) doesn't return the detailed fields we're trying to extract because:
1. **Persisted queries have fixed response structure** - We can't modify which fields are returned
2. The fields `story_description`, `redacted_description`, `marketplace_listing_category`, etc. are **not included in this particular query's response**
3. Our code is trying to access fields that don't exist in the response

### Evidence from Console Logs
```javascript
description: "3PACK - Sexy Hair Concepts Big Sexy Hair Spritz & Stay Fast Drying Spray, 8.5oz."
category: null
categoryId: "686977074745292"  // ← ID exists but name doesn't
condition: null
brand: null
size: null
```

The `marketplace_listing_title` is being used as the description (fallback), but the actual detailed fields are `null`.

### Solution Options

#### Option A: Use a Different GraphQL Query (RECOMMENDED)
Find or discover a Facebook GraphQL query that returns detailed item information, similar to what Vendoo might use for getting item details.

#### Option B: Hybrid Approach - API + Scraping
1. Keep the fast GraphQL API call for basic listing info
2. **For descriptions only**, make a single additional request per item to fetch full details
3. Use a more targeted approach (perhaps a different GraphQL endpoint specific to item details)

#### Option C: Accept Limitations
- Use `marketplace_listing_title` as description (current behavior)
- Accept that category names aren't available (only IDs)
- This is FAST but limited in data quality

### Recommended Fix (Option B - Targeted)
1. Keep the current fast GraphQL for listing basic info
2. Add logging to see the **actual** response structure from Facebook
3. Check if there's a `description` or `listing_description` field we're missing
4. If not available in current query, investigate if we need to call a different endpoint

## Issue #2: Photos Not Showing & Wrong Category When Crosslisting to Facebook

### Problem
When creating a Facebook listing from Orben:
1. **Photos don't upload** - Facebook shows no photos after listing is created
2. **Wrong category** - User selected "Figurines" but listing shows "Video Games"

### Analysis

#### Photo Issue
From console logs:
```javascript
🟦 [FACEBOOK] Uploaded photo {photoId: '33662017710111242', status: 200}
🟢 [FACEBOOK] Listing request completed {listingId: '893513616599698'}
```

- Photo **IS** uploading successfully (`photoId: '33662017710111242'`)
- The photoId is being set in the GraphQL mutation variables
- BUT the listing is created successfully

**Likely Causes:**
1. The recorded Facebook template might not have the correct structure for `photo_ids`
2. The `photo_ids` field might be in the wrong location in the variables object
3. The template might need `photo` instead of `photo_ids`

#### Category Issue
From code inspection:
```javascript
// frontend/src/pages/CrosslistComposer.jsx line 36808
const result = await ext.createFacebookListing({
  inventory_item_id: currentEditingItemId || null,
  payload: { title, description, price, images: photosToUse },  // ← MISSING CATEGORY!
});
```

**The category is NOT being passed to the extension!**

Facebook form has:
- `facebookForm.categoryId` (e.g., "686977074745292")
- `facebookForm.category` (e.g., "Collectibles > Figurines")

But these are not included in the payload sent to `createFacebookListing()`.

### Solutions

#### Photo Fix
1. Add debug logging to see what the variables object looks like before sending
2. Check if `photo_ids` array is correctly formatted
3. Verify the photo_ids are in the right location (`input.data.common.photo_ids`)
4. May need to check if multiple photos need to be handled differently

#### Category Fix (DEFINITE)
**Update `CrosslistComposer.jsx` line 36808:**

```javascript
const result = await ext.createFacebookListing({
  inventory_item_id: currentEditingItemId || null,
  payload: { 
    title, 
    description, 
    price, 
    images: photosToUse,
    // ADD THESE:
    categoryId: facebookForm.categoryId || generalForm.categoryId,
    category: facebookForm.category || generalForm.category,
    condition: facebookForm.condition || generalForm.condition,
  },
});
```

**Then update `background.js` to use these fields:**
1. Extract `categoryId` from payload
2. Inject it into the GraphQL variables
3. Similar for `condition` if Facebook supports it

## Implementation Priority

1. **HIGH**: Fix Issue #2 Category (simple frontend + backend change)
2. **HIGH**: Add comprehensive logging to Issue #1 to see actual response structure
3. **MEDIUM**: Fix Issue #2 Photos (debug variables structure)
4. **MEDIUM**: Fix Issue #1 based on what logging reveals

## Files to Modify

1. `f:\bareretail\extension\facebook-api.js` - Add detailed response logging
2. `f:\bareretail\src\pages\CrosslistComposer.jsx` - Pass category to extension (line 36808 and similar)
3. `f:\bareretail\extension\background.js` - Extract and use category from payload
4. `f:\bareretail\api\facebook\import-items.js` - Ensure description/category fields are used when available
