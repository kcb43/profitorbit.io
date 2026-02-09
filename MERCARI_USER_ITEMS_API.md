# Mercari User Items API Implementation

## Overview
Successfully implemented Mercari sold items sync using the **correct API** that Mercari's own website uses.

## Previous Issue
- Was using `searchQuery` with `itemStatuses: [1, 2]`
- Mercari API would return **only on_sale items** even when requesting sold items
- The `searchQuery` API doesn't support fetching sold items properly

## Solution
Discovered and implemented the **`userItemsQuery`** API that Mercari uses on their own listings pages.

## API Details

### Query Name
`userItemsQuery`

### SHA256 Hash
```
de32fb1b4a2727c67de3f242224d5647a5db015cd5f075fc4aee10d9c43ecce7
```

### Request Format
**Method:** GET (via query parameters)

**Endpoint:**
```
https://www.mercari.com/v1/api?operationName=userItemsQuery&variables={...}&extensions={...}
```

### Variables Structure
```json
{
  "userItemsInput": {
    "sellerId": 973134289,
    "status": "sold_out",  // or "on_sale"
    "keyword": "",
    "sortBy": "created",
    "sortType": "desc",
    "page": 1,
    "includeTotalCount": true
  }
}
```

### Status Values
- `"on_sale"` - Active listings
- `"sold_out"` - Sold/completed items

## Response Structure

### Root Path
```
data.userItems
```

### Fields Available
```javascript
{
  items: [...],          // Array of items
  totalCount: 25,        // Total number of items
  hasMore: false         // Whether there are more pages
}
```

### Item Fields
Each item in the `items` array contains:

#### Basic Info
- `id` - Item ID
- `name` - Item title
- `price` - Price in cents
- `status` - Item status (`"on_sale"` or `"sold_out"`)
- `photos` - Array of photos with `imageUrl` and `thumbnail`

#### Detailed Info
- `description` - Full item description
- `itemCondition.name` - Condition (e.g., "New", "Like New")
- `brand.name` - Brand name
- `itemCategory.name` - Category
- `itemCategoryHierarchy` - Full category path
- `itemSize.name` - Size
- `color` - Color

#### Timestamps
- `created` - Unix timestamp (seconds) when item was created
- `updated` - Unix timestamp (seconds) when item was last updated

#### NEW: Social/Engagement Metadata
- `favorites` - Number of users who favorited this item
- `numLikes` - Number of likes
- `autoLiked` - Boolean indicating if auto-like feature was used

## Implementation Notes

### Fetching "All" Items
When the user selects "All" status:
1. First fetch `on_sale` items
2. Then fetch `sold_out` items
3. Merge the results
4. Return combined array

### Date Conversion
Mercari returns timestamps in **seconds**, not milliseconds:
```javascript
const date = new Date(item.created * 1000).toISOString();
```

### Price Conversion
Mercari returns prices in **cents**:
```javascript
const price = item.price / 100;
```

## Files Modified
- `extension/mercari-api.js` - Updated to use `userItemsQuery`
- `extension/background.js` - Updated `EXT_BUILD` identifier
- `extension/profit-orbit-bridge.js` - Updated `PO_BRIDGE_BUILD` identifier

## Future Use Cases

### Pro Tools Integration
The new metadata fields can be used for future features:

1. **Auto-Like Management**
   - Track which items have `autoLiked: true`
   - Bulk enable/disable auto-like
   - Analytics on auto-like performance

2. **Favorites Analytics**
   - Show which items are most favorited
   - Track favorites over time
   - Identify trending items

3. **Engagement Metrics**
   - Compare likes vs. favorites
   - Track engagement before/after price changes
   - Optimize pricing based on engagement

4. **Posted Date Analytics**
   - See how long items take to sell
   - Identify stale listings
   - Best time to post analysis

## Testing

### Verify New Query Works
1. Open Chrome DevTools → Console
2. Navigate to `https://www.mercari.com/mypage/listings/complete/`
3. Check Network tab for `userItemsQuery` calls
4. Verify response contains sold items

### Test Extension
1. Reload extension in `chrome://extensions/`
2. Clear cache and hard refresh Profit Orbit
3. Click "Get latest items" with "All" selected
4. Verify both on_sale and sold items appear
5. Check status badges (green for "Sold", blue for "On Sale")

## Related Network Calls Discovered

The user also provided other useful API calls that may be useful in the future:

1. **`favoritesUnreadQuery`**
   - SHA: `591816605711cb1663f87f2561b7755e34dde3780ffe952b43ef890023ff8c6a`
   - Use: Track unread favorites

2. **`cartPreviewQuery`**
   - SHA: `988e2ab0621a8b9bcb33e7f57b48a76bb62e50de3629903c3cdeb3a7c56d9da3`
   - Use: Cart preview (for buyers)

3. **`shippingDiscountableItemsQuery`**
   - SHA: `9a4ccd4809e0a06b784a4412436176fa41adcde957d08722b92e151e1e19a9fc`
   - Use: Items eligible for shipping discounts

4. **`dropdownHeaderQuery`**
   - SHA: `e4419dbf5a4a2bb6700822925c9f2297f24f822869f0bb3ea2589d887a74c669`
   - Use: Header dropdown notifications

## Success Criteria
✅ Correctly fetch sold items using `userItemsQuery`  
✅ Capture all available metadata (favorites, likes, dates)  
✅ Support "All" status by fetching both on_sale and sold_out  
✅ Store metadata for future Pro Tools features  

## Version
**v3.1.0-user-items-query**
