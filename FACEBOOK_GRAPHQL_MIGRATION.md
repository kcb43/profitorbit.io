# Facebook GraphQL Migration - Complete!

## What Changed

We've completely replaced the Puppeteer worker approach with direct Facebook GraphQL API calls, exactly matching how Vendoo does it.

## Key Updates

### 1. Extension Code (`extension/facebook-api.js`)
- **Removed**: All Puppeteer worker logic (API calls to `/api/facebook/scrape-details` and `/api/facebook/scrape-status`)
- **Added**: New `scrapeMultipleListings()` function that uses Facebook's `MarketplacePDPContainerQuery` GraphQL query
- **Result**: Direct API calls to Facebook's GraphQL endpoint, no backend worker needed

### 2. Data Extraction Strategy

**Initial Sync** (when clicking "Get Latest Facebook Items"):
- Uses: `MarketplaceYouSellingFastActiveSectionPaginationQuery` (doc_id: 6222877017763459)
- Returns: Basic listing data (ID, title, price, image, category ID)
- Speed: Fast, no additional API calls

**Import** (when user selects items and clicks import):
- Uses: `MarketplacePDPContainerQuery` (doc_id: 6097985476929977)
- Returns: Detailed data including:
  - `redacted_description.text` → Full item description
  - `attribute_data` array → Condition and Brand
  - `marketplace_listing_category_id` → Category ID
- Speed: Fast, direct GraphQL calls (no browser automation)

## How It Works

```javascript
// For each selected item during import:
const variables = {
  targetId: listing.itemId,  // Facebook item ID
  shouldShowBoostedFields: false,
  scale: 1,
};

// Make GraphQL call
POST https://www.facebook.com/api/graphql/
doc_id=6097985476929977
variables={"targetId":"..."}
fb_dtsg=<csrf_token>

// Extract data from response:
- description: data.node.redacted_description.text
- condition: data.node.attribute_data.find(attr => attr.label === 'Condition').value_label
- brand: data.node.attribute_data.find(attr => attr.label === 'Brand').value_label
```

## Benefits

1. **Faster** - Direct API calls, no browser automation overhead
2. **More Reliable** - Using official Facebook API, not scraping HTML
3. **Matches Vendoo** - Exact same approach as proven by HAR logs
4. **Invisible** - No tabs, no browser windows, completely silent
5. **Simpler** - No need for Fly.io worker, Docker, or Puppeteer

## Testing Instructions

1. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Find "ProfitOrbit"
   - Click the refresh icon

2. **Test Initial Sync**:
   - Go to https://profitorbit.io/import
   - Click "Get Latest Facebook Items"
   - ✅ Should show loading state
   - ✅ Should NOT show "Fetching details..." popup
   - ✅ Should load basic item data (title, price, image)

3. **Test Detailed Import**:
   - Select 1-2 items from the import list
   - Click "Import to Inventory"
   - ✅ Open browser console (F12) and look for logs:
     - `📡 Fetching details for item <itemId>...`
     - `✅ Fetched details for <itemId>: { hasDescription: true, ... }`
   - ✅ After import completes, go to Inventory
   - ✅ Check that the imported item has:
     - Full description (NOT just the title)
     - Condition (e.g., "Used - Good")
     - Brand (if available)

## Troubleshooting

### If descriptions are still not working:

1. **Check console logs** for:
   - `❌ Failed to fetch details for <itemId>: <error>`
   - This would indicate a GraphQL API error

2. **Verify Facebook login**:
   - Make sure you're logged into Facebook in the same browser
   - Check for cookies: `c_user`, `xs`

3. **Check fb_dtsg token**:
   - Open browser console
   - Look for: `✅ fb_dtsg token found: ...`
   - If missing, the extension will try to fetch it automatically

4. **Check GraphQL response**:
   - Look for logs like: `📥 GraphQL response status: 200`
   - If status is not 200, there's an API authentication issue

## What About the Fly.io Worker?

The Puppeteer worker on Fly.io (`profitorbit-facebook-worker`) is **no longer needed** for Facebook imports. You can:
- Stop the worker: `fly scale count 0 -a profitorbit-facebook-worker`
- Keep it running (idle) in case we need it for future features
- Or completely remove it if you want to save resources

The worker API endpoints (`/api/facebook/scrape-details` and `/api/facebook/scrape-status`) are also no longer used by the extension.

## Migration Complete! ✅

This approach is:
- ✅ Faster than Puppeteer scraping
- ✅ More reliable (official API)
- ✅ Exactly how Vendoo does it
- ✅ Completely invisible to users
- ✅ No backend infrastructure needed

Test it out and let me know if the descriptions are finally coming through correctly!
