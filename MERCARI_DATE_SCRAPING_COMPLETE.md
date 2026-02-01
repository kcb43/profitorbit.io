# Mercari Date Scraping Implementation - Complete!

## What Was Implemented

Added HTML scraping functionality to fetch Mercari posted dates since the GraphQL search API doesn't return timestamp fields.

## How It Works

### 1. Automatic Scraping
When fetching Mercari listings, the extension now:
1. Checks if `startTime` is missing (which it always is from the API)
2. Automatically fetches the item's HTML page
3. Extracts the posted date from `__NEXT_DATA__` JSON or HTML patterns
4. Sets both `startTime` and `listingDate` fields

### 2. Date Extraction Methods

**Primary Method: __NEXT_DATA__ JSON**
- Checks for `created`, `updated`, `createdAt`, `updatedAt`, `listedAt`, `postedAt`, `timestamp`
- Converts Unix timestamps to ISO date strings
- Most reliable method

**Fallback Method: Regex Patterns**
- Looks for "Posted X days ago" or "Listed X days ago" text
- Calculates absolute date from relative time
- Supports: seconds, minutes, hours, days, weeks, months

### 3. Performance Considerations

**Trade-off:**
- **Before:** Fast sync, but no dates shown
- **After:** Slower sync (1 HTTP request per item), but dates are shown

**Optimization:**
- Uses async/await to scrape all items in parallel
- For 20 items, all dates are scraped simultaneously
- Typical sync time: ~2-5 seconds (depending on network)

## How to Use

### Step 1: Reload Extension
1. Go to `chrome://extensions/`
2. Find "Profit Orbit"
3. Click the **reload** button (circular arrow)

### Step 2: Clear Cache (Optional but Recommended)
Run this in the browser console to clear old cached data without dates:
```javascript
localStorage.removeItem('profit_orbit_mercari_listings');
console.log('✅ Cleared Mercari cache');
```

### Step 3: Re-sync Mercari Items
1. Go to Profit Orbit Import page
2. Select Mercari source
3. Click "Get Latest Mercari Items"
4. Watch the console for scraping progress:
   - `📅 Scraping posted date for Mercari item...`
   - `✅ Found created date in __NEXT_DATA__: [date]`
   - `✅ Set scraped date for [itemId]: [date]`

### Step 4: Verify Dates Appear
After sync completes, you should see:
- **Not Imported:** "Posted: Jan 15, 2026 · $51.00 · View Item ID"
- **Imported:** Same format with dates showing

## Testing

You can manually test the scraping function in the console:
```javascript
// Test scraping a single item's date
self.__mercariApi.scrapeMercariItemDate('m79893323132').then(date => {
  console.log('Scraped date:', date);
});
```

## Console Output

During sync, you'll see:
```
📅 Scraping posted date for Mercari item m85955812918...
✅ Found created date in __NEXT_DATA__: 2026-01-03T15:30:00.000Z
✅ Set scraped date for m85955812918: 2026-01-03T15:30:00.000Z
```

## Troubleshooting

### Dates Still Not Showing?
1. **Extension not reloaded:** Hard reload by removing and re-adding extension
2. **Old cache:** Clear `localStorage.removeItem('profit_orbit_mercari_listings')`
3. **Network issues:** Check console for HTTP errors during scraping
4. **Mercari HTML changed:** Check for error logs showing parsing failures

### Slow Sync?
This is expected! Scraping 20 items = 20 HTTP requests. First sync is slower, but:
- Dates are cached in localStorage
- Subsequent views are instant
- Only new items need scraping

## Files Modified

- `extension/mercari-api.js`:
  - Added `scrapeMercariItemDate()` function
  - Integrated automatic date scraping in `fetchMercariListings()`
  - Exported function for testing

## Date: February 1, 2026
