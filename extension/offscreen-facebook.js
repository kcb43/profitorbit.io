/**
 * Offscreen Facebook Scraper
 * Runs in background without visible tabs/windows
 */

console.log('🔍 Offscreen Facebook Scraper loaded');

let currentScrapingPromise = null;

// Listen for scrape requests from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SCRAPE_FACEBOOK_IN_OFFSCREEN') {
    console.log('📥 Received offscreen scrape request');
    
    // Prevent concurrent scraping
    if (currentScrapingPromise) {
      sendResponse({
        success: false,
        error: 'Scraping already in progress'
      });
      return true;
    }
    
    currentScrapingPromise = scrapeInIframe()
      .then(result => {
        sendResponse(result);
        currentScrapingPromise = null;
      })
      .catch(error => {
        console.error('❌ Offscreen scraping error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Scraping failed'
        });
        currentScrapingPromise = null;
      });
    
    return true; // Keep channel open for async response
  }
});

async function scrapeInIframe() {
  console.log('🔍 Starting offscreen iframe scrape...');
  
  const iframe = document.getElementById('facebook-frame');
  
  // Load Facebook marketplace selling page in iframe
  iframe.src = 'https://www.facebook.com/marketplace/you/selling';
  
  // Wait for iframe to load
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Iframe load timeout'));
    }, 10000);
    
    iframe.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    
    iframe.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Iframe failed to load'));
    };
  });
  
  console.log('✅ Iframe loaded, waiting for content...');
  
  // Wait a bit for dynamic content to load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Try to access iframe content and scrape
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    if (!iframeDoc) {
      throw new Error('Cannot access iframe document - possibly blocked by CORS');
    }
    
    console.log('🔍 Scraping iframe content...');
    
    const listings = [];
    const listingSelectors = [
      '[data-testid="marketplace_you_listing_item"]',
      '.marketplace_listing_card',
      '[role="article"]',
      '[data-pagelet*="Marketplace"]',
      'div[class*="listing"]',
    ];
    
    let listingCards = null;
    for (const selector of listingSelectors) {
      const elements = iframeDoc.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
        listingCards = elements;
        break;
      }
    }
    
    if (!listingCards || listingCards.length === 0) {
      console.warn('⚠️ No listing cards found');
      return {
        success: true,
        listings: [],
        message: 'No listings found. Make sure you are logged into Facebook.'
      };
    }
    
    // Parse each listing
    for (const card of listingCards) {
      try {
        // Title
        const titleEl = card.querySelector('span[dir="auto"]') || 
                       card.querySelector('[role="heading"]') ||
                       card.querySelector('h3, h4');
        const title = titleEl?.textContent?.trim() || '';
        
        // Price
        const priceEl = card.querySelector('[data-testid*="price"]') ||
                       Array.from(card.querySelectorAll('span')).find(el => 
                         /^\$[\d,]+(\.\d{2})?$/.test(el.textContent?.trim() || '')
                       );
        const priceText = priceEl?.textContent?.trim() || '$0';
        const price = parseFloat(priceText.replace(/[$,]/g, '')) || 0;
        
        // Image
        const imgEl = card.querySelector('img');
        const imageUrl = imgEl?.src || '';
        
        // Link
        const linkEl = card.querySelector('a[href*="/marketplace/item/"]');
        const listingUrl = linkEl?.href || '';
        const listingId = listingUrl.match(/\/item\/(\d+)/)?.[1] || `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Status
        const statusEl = card.querySelector('[data-testid*="status"]') ||
                        Array.from(card.querySelectorAll('span')).find(el =>
                          ['available', 'sold', 'pending'].some(s => 
                            el.textContent?.toLowerCase().includes(s)
                          )
                        );
        const status = statusEl?.textContent?.toLowerCase().includes('sold') ? 'sold' :
                      statusEl?.textContent?.toLowerCase().includes('pending') ? 'pending' : 'available';
        
        if (title && price > 0) {
          listings.push({
            itemId: listingId,
            title,
            price,
            imageUrl,
            pictureURLs: imageUrl ? [imageUrl] : [],
            listingUrl,
            source: 'facebook',
            status,
            description: title,
            imported: false,
          });
          console.log(`✅ Scraped: ${title} - $${price}`);
        }
      } catch (error) {
        console.error('❌ Error scraping listing card:', error);
      }
    }
    
    console.log(`✅ Successfully scraped ${listings.length} listings in offscreen mode`);
    
    return {
      success: true,
      listings,
      total: listings.length,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Error accessing iframe:', error);
    throw new Error(`Iframe scraping failed: ${error.message}`);
  }
}

console.log('✅ Offscreen Facebook Scraper ready');
