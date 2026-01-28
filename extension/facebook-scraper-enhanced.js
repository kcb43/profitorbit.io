/**
 * Facebook Marketplace Scraper - Enhanced Version
 * Scrapes descriptions from individual listing pages
 */

(function() {
  'use strict';

  console.log('🔍 Facebook Marketplace Scraper (Enhanced) loaded');

  /**
   * Extract description from current page (when on a listing detail page)
   */
  function extractDescriptionFromPage() {
    console.log('📄 Extracting description from current page...');
    
    // Try multiple selectors
    const descriptionSelectors = [
      // Common Facebook selectors
      'div[class*="html-div"] > span',
      'span[dir="auto"][style*="text-align"]',
      'div[data-ad-preview="message"] span',
      // Meta tags as fallback
      'meta[property="og:description"]',
      'meta[name="description"]',
    ];
    
    let description = '';
    for (const selector of descriptionSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        description = selector.includes('meta') 
          ? el.getAttribute('content') 
          : el.textContent;
        if (description && description.trim().length > 20) {
          console.log('✅ Found description via:', selector);
          break;
        }
      }
    }
    
    // Try to get category
    const categorySelectors = [
      'a[href*="/marketplace/category/"]',
      'span[class*="category"]',
    ];
    
    let category = null;
    for (const selector of categorySelectors) {
      const el = document.querySelector(selector);
      if (el) {
        category = el.textContent.trim();
        if (category && category.length > 2) {
          console.log('✅ Found category:', category);
          break;
        }
      }
    }
    
    return {
      description: description.trim() || null,
      category: category || null,
    };
  }

  /**
   * Scrape Facebook Marketplace listings from list view
   */
  async function scrapeFacebookListings(options = {}) {
    console.log('🔍 Starting Facebook Marketplace scrape...');
    const { includeDescriptions = false, maxItems = 50 } = options;
    
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
    
    // Try multiple selector strategies
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
        
        // Status extraction
        const statusText = card.textContent.toLowerCase();
        let status = 'active';
        if (statusText.includes('sold') || statusText.includes('marked as sold')) {
          status = 'sold';
        } else if (statusText.includes('pending')) {
          status = 'pending';
        }
        
        // Description (from list view - usually very limited)
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
            category: null,
            imported: false,
            needsDetailScrape: includeDescriptions && !!listingUrl, // Flag for detail scraping
          });
          
          console.log(`✅ Scraped: ${title} - $${price}`);
        }
        
        // Stop if we've reached maxItems
        if (listings.length >= maxItems) {
          console.log(`⚠️ Reached max items limit (${maxItems}), stopping...`);
          break;
        }
      } catch (error) {
        console.error('❌ Error scraping listing card:', error);
      }
    }
    
    console.log(`✅ Successfully scraped ${listings.length} Facebook listings from list view`);
    
    return { 
      listings,
      total: listings.length,
      timestamp: new Date().toISOString(),
      message: includeDescriptions 
        ? `Scraped ${listings.length} listings. Use "Enhance Descriptions" to fetch full details.`
        : `Scraped ${listings.length} listings.`
    };
  }

  /**
   * Enhance a single listing with description from detail page
   * This should be called when the user is on the listing detail page
   */
  async function enhanceListingDetails(itemId) {
    console.log('📄 Enhancing listing details for:', itemId);
    
    // Check if we're on a listing detail page
    const isDetailPage = window.location.pathname.includes('/marketplace/item/');
    if (!isDetailPage) {
      return {
        success: false,
        error: 'Not on a listing detail page'
      };
    }
    
    // Extract the details
    const details = extractDescriptionFromPage();
    
    return {
      success: true,
      itemId,
      ...details
    };
  }

  // Expose to content script
  window.__fbScraper = {
    scrapeFacebookListings,
    enhanceListingDetails,
    extractDescriptionFromPage,
    version: '2.0.0',
  };
  
  console.log('✅ Facebook Marketplace Scraper (Enhanced) ready');
})();
