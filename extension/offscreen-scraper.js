/**
 * Offscreen Document Scraper
 * Invisible to the user - loads Facebook pages in a hidden iframe
 * This matches Vendoo's behavior: no visible tabs
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
  return new Promise((resolve, reject) => {
    const iframe = document.getElementById('scraper-frame');
    
    // Set up message listener for iframe content
    const messageHandler = (event) => {
      // Verify origin
      if (!event.origin.includes('facebook.com')) return;
      
      if (event.data && event.data.type === 'SCRAPE_RESULT') {
        window.removeEventListener('message', messageHandler);
        clearTimeout(timeout);
        resolve(event.data.details);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      reject(new Error('Scraping timeout'));
    }, 10000);
    
    // Inject scraper script into iframe
    iframe.onload = () => {
      console.log('📄 Page loaded in iframe');
      
      // Wait a moment for page to fully render
      setTimeout(() => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          
          // Execute scraping logic
          const details = scrapeFromDocument(iframeDoc);
          
          // Send result
          window.removeEventListener('message', messageHandler);
          clearTimeout(timeout);
          resolve(details);
        } catch (error) {
          console.error('❌ Error accessing iframe:', error);
          window.removeEventListener('message', messageHandler);
          clearTimeout(timeout);
          reject(error);
        }
      }, 2000);
    };
    
    iframe.onerror = (error) => {
      window.removeEventListener('message', messageHandler);
      clearTimeout(timeout);
      reject(new Error('Failed to load page'));
    };
    
    // Load the listing page
    console.log('🌐 Loading page in iframe:', url);
    iframe.src = url;
  });
}

function scrapeFromDocument(doc) {
  try {
    console.log('🔍 Starting to scrape document...');
    
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
    const descriptionSelectors = [
      '[data-testid="product_details"] > div > div > div:nth-child(2) > span',
      '[data-testid="product_details"] span[dir="auto"]',
      'div[style*="word-break"] span',
      '.x1iorvi4 span[dir="auto"]',
      'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs',
    ];
    
    for (const selector of descriptionSelectors) {
      const descElement = doc.querySelector(selector);
      if (descElement && descElement.textContent.trim()) {
        details.description = descElement.textContent.trim();
        console.log('✅ Found description using selector:', selector);
        break;
      }
    }
    
    // If description not found, scan for long text blocks
    if (!details.description) {
      const textBlocks = Array.from(doc.querySelectorAll('span[dir="auto"]'))
        .filter(el => {
          const text = el.textContent.trim();
          return text.length > 20 && 
                 !text.includes('Messenger') && 
                 !text.includes('See all') &&
                 !text.includes('Message');
        })
        .sort((a, b) => b.textContent.length - a.textContent.length);
      
      if (textBlocks.length > 0) {
        details.description = textBlocks[0].textContent.trim();
        console.log('✅ Found description by text scan');
      }
    }
    
    // Extract title
    const titleSelectors = [
      'h1 span',
      '[role="heading"] span',
      'span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6',
    ];
    
    for (const selector of titleSelectors) {
      const titleElement = doc.querySelector(selector);
      if (titleElement && titleElement.textContent.trim()) {
        details.title = titleElement.textContent.trim();
        console.log('✅ Found title:', details.title);
        break;
      }
    }
    
    // Extract price
    const priceElements = doc.querySelectorAll('span[dir="auto"]');
    for (const el of priceElements) {
      const text = el.textContent.trim();
      if (text.includes('$') && /\$[\d,]+/.test(text)) {
        details.price = text.replace(/[^0-9.]/g, '');
        console.log('✅ Found price:', details.price);
        break;
      }
    }
    
    // Extract category from breadcrumbs
    const breadcrumbLinks = Array.from(doc.querySelectorAll('a[href*="/marketplace/category/"]'));
    if (breadcrumbLinks.length > 0) {
      details.categoryPath = breadcrumbLinks.map(link => link.textContent.trim());
      details.category = details.categoryPath[details.categoryPath.length - 1];
      console.log('✅ Found category path:', details.categoryPath);
    }
    
    // Try alternative category extraction
    if (!details.category) {
      const categoryLabels = Array.from(doc.querySelectorAll('span'))
        .filter(el => el.textContent.trim() === 'Category');
      
      if (categoryLabels.length > 0) {
        const categoryLabel = categoryLabels[0];
        const parent = categoryLabel.closest('div');
        if (parent) {
          const valueSpans = parent.querySelectorAll('span[dir="auto"]');
          for (const span of valueSpans) {
            if (span.textContent !== 'Category') {
              details.category = span.textContent.trim();
              console.log('✅ Found category from details:', details.category);
              break;
            }
          }
        }
      }
    }
    
    // Extract condition
    const conditionLabels = Array.from(doc.querySelectorAll('span'))
      .filter(el => el.textContent.trim() === 'Condition');
    
    if (conditionLabels.length > 0) {
      const conditionLabel = conditionLabels[0];
      const parent = conditionLabel.closest('div');
      if (parent) {
        const valueSpans = parent.querySelectorAll('span[dir="auto"]');
        for (const span of valueSpans) {
          if (span.textContent !== 'Condition') {
            details.condition = span.textContent.trim();
            console.log('✅ Found condition:', details.condition);
            break;
          }
        }
      }
    }
    
    // Extract brand
    const brandLabels = Array.from(doc.querySelectorAll('span'))
      .filter(el => el.textContent.trim() === 'Brand');
    
    if (brandLabels.length > 0) {
      const brandLabel = brandLabels[0];
      const parent = brandLabel.closest('div');
      if (parent) {
        const valueSpans = parent.querySelectorAll('span[dir="auto"]');
        for (const span of valueSpans) {
          if (span.textContent !== 'Brand') {
            details.brand = span.textContent.trim();
            console.log('✅ Found brand:', details.brand);
            break;
          }
        }
      }
    }
    
    // Extract size
    const sizeLabels = Array.from(doc.querySelectorAll('span'))
      .filter(el => {
        const text = el.textContent.trim().toLowerCase();
        return text === 'size' || text === 'shoe size' || text === 'clothing size';
      });
    
    if (sizeLabels.length > 0) {
      const sizeLabel = sizeLabels[0];
      const parent = sizeLabel.closest('div');
      if (parent) {
        const valueSpans = parent.querySelectorAll('span[dir="auto"]');
        for (const span of valueSpans) {
          const text = span.textContent.toLowerCase();
          if (!text.includes('size')) {
            details.size = span.textContent.trim();
            console.log('✅ Found size:', details.size);
            break;
          }
        }
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
