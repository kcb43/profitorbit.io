/**
 * Offscreen Document Scraper
 * Fetches Facebook pages via fetch API and parses HTML
 * This bypasses X-Frame-Options blocking
 */

console.log('🔍 Offscreen scraper loaded');

// Listen for scraping requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SCRAPE_LISTING_URL') {
    console.log('📨 Received scrape request for:', message.url);
    scrapeListing(message.url)
      .then(data => {
        console.log('✅ Scraping complete:', data);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('❌ Scraping error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

async function scrapeListing(url) {
  try {
    console.log('🌐 Fetching page:', url);
    
    // Fetch the page HTML
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log('✅ Fetched HTML:', html.length, 'bytes');
    
    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract details from the parsed HTML
    const details = scrapeFromDocument(doc);
    
    return details;
    
  } catch (error) {
    console.error('❌ Error fetching/parsing page:', error);
    throw error;
  }
}

function scrapeFromDocument(doc) {
  try {
    console.log('🔍 Starting to scrape parsed document...');
    
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
    
    // Get all text content for pattern matching
    const allText = doc.body ? doc.body.textContent : doc.documentElement.textContent;
    
    // Strategy: Look for the Details section which contains the full description
    // The description is usually after "Details" and before other fields
    
    // Try to find description in various ways
    // 1. Look for meta description tag
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (metaDesc && metaDesc.content) {
      const content = metaDesc.content.trim();
      if (content && content.length > 50) {
        details.description = content;
        console.log('✅ Found description from meta tag:', content.substring(0, 100));
      }
    }
    
    // 2. Look for structured data (JSON-LD)
    if (!details.description) {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data.description && data.description.length > 20) {
            details.description = data.description;
            console.log('✅ Found description from JSON-LD');
            break;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
    
    // 3. Look for Open Graph description
    if (!details.description) {
      const ogDesc = doc.querySelector('meta[property="og:description"]');
      if (ogDesc && ogDesc.content) {
        const content = ogDesc.content.trim();
        if (content && content.length > 50) {
          details.description = content;
          console.log('✅ Found description from og:description');
        }
      }
    }
    
    // 4. Scan all text content for description patterns
    if (!details.description) {
      // Look for "Details" section followed by text
      const detailsMatch = allText.match(/Details[\s\S]{0,500}?(Brand New|Selling|Brand:|Condition:)([\s\S]{50,2000}?)(?:Pickup|Delivery|Shipping|Listed|Posted|Message)/i);
      if (detailsMatch && detailsMatch[2]) {
        details.description = detailsMatch[2].trim();
        console.log('✅ Found description via pattern matching');
      }
    }
    
    // Extract title from og:title or title tag
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      details.title = ogTitle.content.trim();
      console.log('✅ Found title:', details.title);
    } else {
      const titleTag = doc.querySelector('title');
      if (titleTag) {
        details.title = titleTag.textContent.replace('| Facebook Marketplace', '').trim();
        console.log('✅ Found title from title tag');
      }
    }
    
    // Extract price from og:price
    const ogPrice = doc.querySelector('meta[property="product:price:amount"]') || 
                    doc.querySelector('meta[property="og:price:amount"]');
    if (ogPrice && ogPrice.content) {
      details.price = ogPrice.content;
      console.log('✅ Found price:', details.price);
    }
    
    // Extract condition - search in all text
    const conditionMatch = allText.match(/Condition[\s\n]+(Used|New|Like New|Good|Fair|Brand New)/i);
    if (conditionMatch && conditionMatch[1]) {
      details.condition = conditionMatch[1].trim();
      console.log('✅ Found condition:', details.condition);
    }
    
    // Extract brand
    const brandMatch = allText.match(/Brand[\s\n]+([A-Za-z0-9\s&]+?)(?:\n|Details|Condition|Size)/i);
    if (brandMatch && brandMatch[1]) {
      details.brand = brandMatch[1].trim();
      console.log('✅ Found brand:', details.brand);
    }
    
    // Extract category from meta or URL
    const category = doc.querySelector('meta[name="keywords"]');
    if (category && category.content) {
      const keywords = category.content.split(',')[0];
      if (keywords && keywords.length < 50) {
        details.category = keywords.trim();
        console.log('✅ Found category:', details.category);
      }
    }
    
    console.log('✅ Scraping complete:', details);
    return details;
    
  } catch (error) {
    console.error('❌ Error scraping document:', error);
    throw error;
  }
}

console.log('✅ Offscreen scraper ready');
