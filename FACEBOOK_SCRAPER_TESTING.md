# Facebook Marketplace Scraper - Testing Guide

## Setup

1. **Load Extension**
   ```
   1. Open Chrome
   2. Go to chrome://extensions
   3. Enable "Developer mode"
   4. Click "Load unpacked"
   5. Select f:\bareretail\extension folder
   ```

2. **Verify Extension Loaded**
   - Look for "Profit Orbit - Crosslisting Assistant" in extensions
   - Icon should appear in toolbar

## Testing Steps

### Step 1: Connect Facebook
1. Go to profitorbit.io/settings
2. Click "Connect Facebook"
3. Complete OAuth flow
4. Verify connection status shows "Connected"

### Step 2: Navigate to Import Page
1. Go to profitorbit.io/import?source=facebook
2. Should see "Facebook" selected
3. Should show "No items found" initially

### Step 3: Trigger Scraping
1. Click "Get Latest Facebook Items" button
2. Extension should:
   - Open facebook.com/marketplace/you/selling (if not already there)
   - Inject facebook-scraper.js
   - Scrape listing data
   - Send back to Import page

### Step 4: Verify Results
1. Check browser console for logs:
   ```
   🔍 Facebook Marketplace Scraper loaded
   🔍 Starting Facebook Marketplace scrape...
   ✅ Found X elements with selector...
   📦 Processing X listing cards...
   ✅ Scraped: [Title] - $[Price]
   ✅ Successfully scraped X Facebook listings
   ```

2. Import page should show:
   - Toast: "Found X Facebook listings"
   - Listings displayed with images, titles, prices
   - Can select items for import

### Step 5: Import Items
1. Select one or more listings
2. Click "Import" button
3. Items should be added to inventory

## Debugging

### Console Logs to Check

**Extension Console (chrome://extensions → Details → Inspect views: background page)**
```
📥 Received scraped Facebook listings: X
✅ Stored Facebook listings in chrome.storage
```

**Page Console (profitorbit.io)**
```
📡 Requesting Facebook scrape from extension...
✅ Facebook listings ready: {count: X}
📦 Retrieved Facebook listings: X
```

**Facebook Page Console (facebook.com/marketplace/you/selling)**
```
🔍 Facebook Marketplace Scraper loaded
🔍 Starting Facebook Marketplace scrape...
✅ Successfully scraped X Facebook listings
```

### Common Issues

#### 1. No listings found
**Problem**: Scraper can't find listing elements
**Solution**: 
- Facebook changed their DOM structure
- Update selectors in `facebook-scraper.js`
- Check console for which selector worked

#### 2. Extension not triggering
**Problem**: postMessage not reaching content script
**Solution**:
- Verify extension is loaded
- Check extension has permissions for facebook.com
- Reload extension

#### 3. Data not appearing in Import page
**Problem**: Storage or messaging issue
**Solution**:
- Check chrome.storage has data:
  ```javascript
  chrome.storage.local.get(['facebook_listings'], console.log)
  ```
- Verify FACEBOOK_LISTINGS_READY message sent
- Check message listener is active

### Manual Testing

You can manually test the scraper in Facebook console:

```javascript
// Navigate to facebook.com/marketplace/you/selling
// Open console and run:

// Load scraper
const script = document.createElement('script');
script.src = chrome.runtime.getURL('facebook-scraper.js');
document.head.appendChild(script);

// After it loads, run:
window.__fbScraper.scrapeFacebookListings().then(console.log);
```

## Expected Behavior

### Success Flow:
1. User clicks "Get Latest Facebook Items"
2. Toast: "Syncing Facebook Marketplace"
3. Extension scrapes facebook.com
4. Toast: "Found X Facebook listings"
5. Listings appear on Import page
6. User can select and import

### Data Format:
```javascript
{
  itemId: "1234567890",
  title: "Item Title",
  price: 25.99,
  imageUrl: "https://scontent.xx.fbcdn.net/...",
  pictureURLs: ["https://..."],
  listingUrl: "https://www.facebook.com/marketplace/item/1234567890",
  source: "facebook",
  status: "active",
  description: "Item description...",
  imported: false
}
```

## Troubleshooting Selectors

If Facebook changes their DOM, update these selectors in `facebook-scraper.js`:

```javascript
// Listing cards
const listingSelectors = [
  '[data-testid="marketplace_you_listing_item"]', // Primary
  '.marketplace_listing_card',                     // Fallback 1
  '[role="article"]',                              // Fallback 2
  // Add new selectors here
];

// Title
const titleSelectors = [
  'span[role="heading"]',  // Primary
  'a[aria-label]',         // Fallback
  // Add new selectors here
];

// Price
const priceSelectors = [
  '[data-testid="marketplace_you_listing_price"]', // Primary
  '.marketplace_price',                            // Fallback
  // Add new selectors here
];
```

## Next Steps After Testing

1. ✅ Verify scraping works
2. ✅ Test with different listing states (active, sold, pending)
3. ✅ Test import functionality
4. ⏭️ Add better error handling
5. ⏭️ Add loading states
6. ⏭️ Add retry logic
7. ⏭️ Handle pagination (if >20 listings)

## Production Checklist

- [ ] Test on multiple Facebook accounts
- [ ] Test with 0 listings
- [ ] Test with 100+ listings
- [ ] Test with sold/pending items
- [ ] Test rate limiting
- [ ] Test error scenarios
- [ ] Verify no duplicate imports
- [ ] Test on different screen sizes
- [ ] Verify works in incognito
- [ ] Test after Facebook UI updates
