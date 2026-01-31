/**
 * Facebook Listing Page Scraper
 * Content script that extracts detailed information from individual Facebook Marketplace listing pages
 * This mimics how Vendoo gets full descriptions and category information
 */

(function() {
  'use strict';
  
  console.log('🔍 Facebook listing scraper loaded');
  
  // Function to extract listing details from the page
  function scrapeListingDetails() {
    try {
      console.log('🔍 Starting to scrape listing page...');
      
      const details = {
        description: null,
        category: null,
        categoryPath: [],
        condition: null,
        brand: null,
        size: null,
        price: null,
        title: null,
        location: null,
      };
      
      // Extract description
      // Facebook uses various selectors for description, try them in order
      const descriptionSelectors = [
        '[data-testid="product_details"] > div > div > div:nth-child(2) > span',
        '[data-testid="product_details"] span[dir="auto"]',
        'div[style*="word-break"] span',
        '.x1iorvi4 span[dir="auto"]',
        'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs',
      ];
      
      for (const selector of descriptionSelectors) {
        const descElement = document.querySelector(selector);
        if (descElement && descElement.textContent.trim()) {
          details.description = descElement.textContent.trim();
          console.log('✅ Found description using selector:', selector);
          break;
        }
      }
      
      // If description not found in specific selectors, try to find it by scanning text content
      if (!details.description) {
        // Look for a longer text block that's not the title
        const textBlocks = Array.from(document.querySelectorAll('span[dir="auto"]'))
          .filter(el => {
            const text = el.textContent.trim();
            // Filter out short texts, navigation items, buttons, etc.
            return text.length > 20 && 
                   !text.includes('Messenger') && 
                   !text.includes('See all') &&
                   !text.includes('Message');
          })
          .sort((a, b) => b.textContent.length - a.textContent.length);
        
        if (textBlocks.length > 0) {
          details.description = textBlocks[0].textContent.trim();
          console.log('✅ Found description by text length scan');
        }
      }
      
      // Extract title
      const titleSelectors = [
        'h1 span',
        '[role="heading"] span',
        'span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6',
      ];
      
      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement && titleElement.textContent.trim()) {
          details.title = titleElement.textContent.trim();
          console.log('✅ Found title:', details.title);
          break;
        }
      }
      
      // Extract price
      const priceSelectors = [
        'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv',
        'span[dir="auto"]:not([class*="x1"])',
      ];
      
      for (const selector of priceSelectors) {
        const priceElement = document.querySelector(selector);
        if (priceElement) {
          const priceText = priceElement.textContent.trim();
          if (priceText.includes('$')) {
            details.price = priceText.replace(/[^0-9.]/g, '');
            console.log('✅ Found price:', details.price);
            break;
          }
        }
      }
      
      // Extract category from breadcrumb or details section
      // Facebook often shows category in "Marketplace > Category > Subcategory" format
      const breadcrumbLinks = Array.from(document.querySelectorAll('a[href*="/marketplace/category/"]'));
      if (breadcrumbLinks.length > 0) {
        details.categoryPath = breadcrumbLinks.map(link => link.textContent.trim());
        details.category = details.categoryPath[details.categoryPath.length - 1];
        console.log('✅ Found category path:', details.categoryPath);
      }
      
      // Try alternative category extraction from product details section
      if (!details.category) {
        const categoryLabels = Array.from(document.querySelectorAll('span'))
          .filter(el => el.textContent.trim() === 'Category');
        
        if (categoryLabels.length > 0) {
          // Find the value next to the "Category" label
          const categoryLabel = categoryLabels[0];
          const categoryValue = categoryLabel.closest('div')?.querySelector('span[dir="auto"]');
          if (categoryValue && categoryValue.textContent !== 'Category') {
            details.category = categoryValue.textContent.trim();
            console.log('✅ Found category from details:', details.category);
          }
        }
      }
      
      // Extract condition
      const conditionLabels = Array.from(document.querySelectorAll('span'))
        .filter(el => el.textContent.trim() === 'Condition');
      
      if (conditionLabels.length > 0) {
        const conditionLabel = conditionLabels[0];
        const conditionValue = conditionLabel.closest('div')?.querySelector('span[dir="auto"]');
        if (conditionValue && conditionValue.textContent !== 'Condition') {
          details.condition = conditionValue.textContent.trim();
          console.log('✅ Found condition:', details.condition);
        }
      }
      
      // Extract brand
      const brandLabels = Array.from(document.querySelectorAll('span'))
        .filter(el => el.textContent.trim() === 'Brand');
      
      if (brandLabels.length > 0) {
        const brandLabel = brandLabels[0];
        const brandValue = brandLabel.closest('div')?.querySelector('span[dir="auto"]');
        if (brandValue && brandValue.textContent !== 'Brand') {
          details.brand = brandValue.textContent.trim();
          console.log('✅ Found brand:', details.brand);
        }
      }
      
      // Extract size (could be in various formats)
      const sizeLabels = Array.from(document.querySelectorAll('span'))
        .filter(el => {
          const text = el.textContent.trim().toLowerCase();
          return text === 'size' || text === 'shoe size' || text === 'clothing size';
        });
      
      if (sizeLabels.length > 0) {
        const sizeLabel = sizeLabels[0];
        const sizeValue = sizeLabel.closest('div')?.querySelector('span[dir="auto"]');
        if (sizeValue && !sizeValue.textContent.toLowerCase().includes('size')) {
          details.size = sizeValue.textContent.trim();
          console.log('✅ Found size:', details.size);
        }
      }
      
      // Extract location
      const locationSelectors = [
        'span[dir="auto"]:has(> a[href*="/marketplace/"])',
      ];
      
      for (const selector of locationSelectors) {
        const locationElement = document.querySelector(selector);
        if (locationElement) {
          const locationText = locationElement.textContent.trim();
          if (!locationText.includes('$') && locationText.length < 100) {
            details.location = locationText;
            console.log('✅ Found location:', details.location);
            break;
          }
        }
      }
      
      console.log('✅ Scraping complete:', details);
      return details;
      
    } catch (error) {
      console.error('❌ Error scraping listing:', error);
      return null;
    }
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'SCRAPE_FACEBOOK_LISTING') {
      console.log('📨 Received scrape request');
      
      // Wait a moment for the page to fully load
      setTimeout(() => {
        const details = scrapeListingDetails();
        sendResponse({ success: true, data: details });
      }, 1000);
      
      // Return true to indicate we'll send response asynchronously
      return true;
    }
  });
  
  console.log('✅ Facebook listing scraper ready');
})();
