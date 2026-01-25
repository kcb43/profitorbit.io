/**
 * Facebook Marketplace Scraper
 * Scrapes user's listings from Facebook Marketplace
 */

(function() {
  'use strict';

  console.log('🔍 Facebook Marketplace Scraper loaded');

  /**
   * Scrape Facebook Marketplace listings from current page
   */
  async function scrapeFacebookListings() {
    console.log('🔍 Starting Facebook Marketplace scrape...');
    
    // Check if we're on the right page
    const isSellingPage = window.location.pathname.includes('/marketplace/you/selling') ||
                         window.location.pathname.includes('/marketplace/you/listings');
    
    if (!isSellingPage) {
      console.log('⚠️ Not on marketplace selling page, navigating...');
      window.location.href = 'https://www.facebook.com/marketplace/you/selling';
      return { waitForNavigation: true };
    }
    
    // Wait for listings to load
    console.log('⏳ Waiting for listings to load...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const listings = [];
    
    // Try multiple selector strategies (Facebook changes their DOM frequently)
    const listingSelectors = [
      '[data-testid="marketplace_you_listing_item"]',
      '.marketplace_listing_card',
      '[role="article"]',
      '[data-pagelet*="Marketplace"]',
      'div[class*="listing"]',
    ];
    
    let listingCards = null;
    for (const selector of listingSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
        listingCards = elements;
        break;
      }
    }
    
    if (!listingCards || listingCards.length === 0) {
      console.warn('⚠️ No listing cards found on page');
      return { listings: [], message: 'No listings found. Make sure you have active listings on Facebook Marketplace.' };
    }
    
    console.log(`📦 Processing ${listingCards.length} listing cards...`);
    
    for (const card of listingCards) {
      try {
        // Try multiple strategies to extract data
        
        // Title extraction
        const titleSelectors = [
          'span[role="heading"]',
          'a[aria-label]',
          'span[dir="auto"]',
          'h2',
          'h3',
        ];
        let title = '';
        for (const selector of titleSelectors) {
          const el = card.querySelector(selector);
          if (el && el.textContent.trim()) {
            title = el.textContent.trim();
            break;
          }
        }
        
        // Price extraction
        const priceSelectors = [
          '[data-testid="marketplace_you_listing_price"]',
          '.marketplace_price',
          'span[dir="auto"]',
        ];
        let priceText = '';
        for (const selector of priceSelectors) {
          const el = card.querySelector(selector);
          if (el && el.textContent.includes('$')) {
            priceText = el.textContent.trim();
            break;
          }
        }
        const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
        
        // Image extraction
        const imageEl = card.querySelector('img[src*="scontent"]') || 
                       card.querySelector('img[src*="fbcdn"]') ||
                       card.querySelector('img[src]');
        const imageUrl = imageEl?.src || '';
        
        // Link extraction
        const linkEl = card.querySelector('a[href*="/marketplace/item/"]') ||
                      card.querySelector('a[href*="/groups/"]') ||
                      card.querySelector('a[href]');
        const listingUrl = linkEl?.href || '';
        const listingId = listingUrl.match(/\/item\/(\d+)/)?.[1] || 
                         listingUrl.match(/\/(\d+)\//)?.[1] ||
                         `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Status extraction (try to determine if active, pending, sold)
        const statusText = card.textContent.toLowerCase();
        let status = 'active';
        if (statusText.includes('sold') || statusText.includes('marked as sold')) {
          status = 'sold';
        } else if (statusText.includes('pending')) {
          status = 'pending';
        }
        
        // Description (if available - usually not in list view)
        const descriptionEl = card.querySelector('[data-testid="listing_description"]') ||
                             card.querySelector('div[dir="auto"]');
        const description = descriptionEl?.textContent?.trim() || '';
        
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
            description: description || title,
            imported: false,
          });
          
          console.log(`✅ Scraped: ${title} - $${price}`);
        }
      } catch (error) {
        console.error('❌ Error scraping listing card:', error);
      }
    }
    
    console.log(`✅ Successfully scraped ${listings.length} Facebook listings`);
    return { 
      listings,
      total: listings.length,
      timestamp: new Date().toISOString(),
    };
  }

  // Expose to content script
  window.__fbScraper = {
    scrapeFacebookListings,
    version: '1.0.0',
  };
  
  console.log('✅ Facebook Marketplace Scraper ready');
})();
