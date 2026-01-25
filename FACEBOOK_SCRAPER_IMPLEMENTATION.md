# Facebook Marketplace Scraping - Extension Implementation Plan

## Goal
Add Facebook Marketplace listing scraper to existing Profit Orbit Chrome Extension

## Current State
✅ Extension already has:
- Facebook permissions in manifest.json
- Content script running on facebook.com
- Background service worker
- Communication with profitorbit.io

## Implementation Steps

### 1. Add Facebook Scraper Module

Create `extension/facebook-scraper.js`:

```javascript
/**
 * Facebook Marketplace Scraper
 * Scrapes user's listings from Facebook Marketplace
 */

async function scrapeFacebookListings() {
  console.log('🔍 Scraping Facebook Marketplace listings...');
  
  // Navigate to user's marketplace listings
  if (!window.location.pathname.includes('/marketplace/you/selling')) {
    window.location.href = 'https://www.facebook.com/marketplace/you/selling';
    return { waitForNavigation: true };
  }
  
  // Wait for listings to load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const listings = [];
  
  // Facebook Marketplace listing selectors (may need adjustment)
  const listingCards = document.querySelectorAll('[data-testid="marketplace_you_listing_item"]') ||
                      document.querySelectorAll('.marketplace_listing_card') ||
                      document.querySelectorAll('[role="article"]');
  
  console.log(`📦 Found ${listingCards.length} listing cards`);
  
  for (const card of listingCards) {
    try {
      // Extract listing data
      const titleEl = card.querySelector('span[role="heading"]') || 
                     card.querySelector('a[aria-label]');
      const priceEl = card.querySelector('[data-testid="marketplace_you_listing_price"]') ||
                     card.querySelector('.marketplace_price');
      const imageEl = card.querySelector('img[src]');
      const linkEl = card.querySelector('a[href*="/marketplace/item/"]');
      
      const title = titleEl?.textContent?.trim() || '';
      const priceText = priceEl?.textContent?.trim() || '';
      const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
      const imageUrl = imageEl?.src || '';
      const listingUrl = linkEl?.href || '';
      const listingId = listingUrl.match(/\/item\/(\d+)/)?.[1] || '';
      
      if (title && listingId) {
        listings.push({
          itemId: listingId,
          title,
          price,
          imageUrl,
          listingUrl,
          source: 'facebook',
          status: 'active', // Can be determined from card status
        });
      }
    } catch (error) {
      console.error('Error scraping listing card:', error);
    }
  }
  
  console.log(`✅ Scraped ${listings.length} Facebook listings`);
  return { listings };
}

// Expose to content script
window.__fbScraper = { scrapeFacebookListings };
```

### 2. Update Content Script

Add to `extension/content.js` (Facebook section):

```javascript
// Add to MARKETPLACE === 'facebook' section

// Listen for scrape requests from Import page
if (MARKETPLACE === 'facebook') {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'SCRAPE_FACEBOOK_LISTINGS') {
      console.log('📥 Received Facebook scrape request');
      
      // Load scraper module
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('facebook-scraper.js');
      document.head.appendChild(script);
      
      script.onload = async () => {
        try {
          const result = await window.__fbScraper.scrapeFacebookListings();
          
          if (result.waitForNavigation) {
            sendResponse({ 
              status: 'navigating',
              message: 'Navigating to marketplace listings...' 
            });
            return;
          }
          
          // Send listings to background
          chrome.runtime.sendMessage({
            action: 'FACEBOOK_LISTINGS_SCRAPED',
            data: result.listings,
          });
          
          sendResponse({ 
            status: 'success',
            count: result.listings.length 
          });
        } catch (error) {
          console.error('Scraping error:', error);
          sendResponse({ 
            status: 'error',
            message: error.message 
          });
        }
      };
      
      return true; // Keep channel open for async response
    }
  });
}
```

### 3. Update Manifest

Add to `extension/manifest.json`:

```json
"web_accessible_resources": [
  {
    "resources": [
      "profit-orbit-page-api.js",
      "facebook-scraper.js"
    ],
    "matches": [
      "https://profitorbit.io/*",
      "https://*.vercel.app/*",
      "https://www.facebook.com/*",
      "http://localhost:5173/*",
      "http://localhost:5174/*"
    ]
  }
]
```

### 4. Update Background Worker

Add to `extension/background.js`:

```javascript
// Listen for scraped listings
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'FACEBOOK_LISTINGS_SCRAPED') {
    console.log('📥 Received scraped Facebook listings:', message.data.length);
    
    // Store in chrome.storage for Import page to fetch
    chrome.storage.local.set({
      'facebook_listings': message.data,
      'facebook_listings_timestamp': Date.now(),
    });
    
    // Notify Import page
    notifyProfitOrbit({
      action: 'FACEBOOK_LISTINGS_READY',
      count: message.data.length,
    });
    
    sendResponse({ status: 'stored' });
  }
});
```

### 5. Update Import Page Frontend

Add to `src/pages/Import.jsx`:

```javascript
// Add Facebook scraping functionality
const handleFacebookSync = async () => {
  if (selectedSource !== 'facebook') return;
  
  setIsLoading(true);
  
  try {
    // Check if extension is installed
    if (!window.chrome?.runtime) {
      throw new Error('Chrome Extension not detected');
    }
    
    // Request scrape from extension
    const response = await chrome.runtime.sendMessage(
      EXTENSION_ID, // Your extension ID
      { action: 'SCRAPE_FACEBOOK_LISTINGS' }
    );
    
    if (response.status === 'navigating') {
      toast({
        title: "Opening Facebook Marketplace",
        description: "Please wait while we load your listings...",
      });
      
      // Wait for listings to be ready
      window.addEventListener('FACEBOOK_LISTINGS_READY', (event) => {
        chrome.storage.local.get(['facebook_listings'], (result) => {
          setFacebookListings(result.facebook_listings || []);
          setLastSync(new Date());
          toast({
            title: "Success",
            description: `Found ${result.facebook_listings.length} listings`,
          });
        });
      }, { once: true });
      
    } else if (response.status === 'success') {
      // Fetch from storage
      chrome.storage.local.get(['facebook_listings'], (result) => {
        setFacebookListings(result.facebook_listings || []);
        setLastSync(new Date());
      });
    }
    
  } catch (error) {
    console.error('Facebook sync error:', error);
    toast({
      title: "Sync failed",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
};
```

## Testing Steps

1. Load unpacked extension in Chrome
2. Go to profitorbit.io/import?source=facebook
3. Click "Get Latest Facebook Items"
4. Extension opens facebook.com/marketplace/you/selling
5. Scrapes listing data
6. Sends back to Import page
7. Displays listings for import

## Important Notes

- Facebook's DOM structure changes frequently
- Selectors may need adjustment
- Add error handling for missing elements
- Consider rate limiting (don't scrape too fast)
- Test with various listing states (active, pending, sold)

## Next Steps

1. Create `facebook-scraper.js` file
2. Update `content.js` with message listener
3. Update `background.js` with storage logic
4. Test scraping on Facebook Marketplace
5. Refine selectors based on actual DOM
6. Add to Import page UI

Would you like me to create these files now?
