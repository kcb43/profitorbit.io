const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

/**
 * Walmart Direct Scraper
 * Scrapes Walmart.com directly for product data
 */

const WALMART_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Walmart_logo.svg';

/**
 * Extract price from Walmart price string
 */
function parseWalmartPrice(priceText) {
  if (!priceText) return null;
  
  // Handle formats like "$199.99", "Now $199.99", "$199.99 ea"
  const match = priceText.match(/\$?([\d,]+\.?\d*)/);
  return match ? parseFloat(match[1].replace(/,/g, '')) : null;
}

/**
 * Search Walmart for products
 */
async function searchWalmart(query, options = {}) {
  console.log('🛒 Searching Walmart:', query);

  let browser = null;

  try {
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
    
    browser = await puppeteer.launch({
      args: isProduction ? chromium.args : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: isProduction 
        ? await chromium.executablePath()
        : process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Build Walmart search URL
    const url = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
    
    console.log('🌐 Navigating to:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for product grid
    await page.waitForSelector('[data-item-id], .search-result-gridview-item', { timeout: 10000 });

    // Extract product data
    const products = await page.evaluate((maxResults) => {
      const results = [];
      
      // Walmart uses different selectors depending on layout
      const productElements = document.querySelectorAll(
        '[data-item-id], .search-result-gridview-item, .mb1.ph1.pa0-xl.bb.b--near-white'
      );
      
      for (let i = 0; i < Math.min(productElements.length, maxResults); i++) {
        const element = productElements[i];
        
        try {
          // Extract title
          const titleEl = element.querySelector('[data-automation-id="product-title"], .product-title-link, h1, h2');
          const title = titleEl ? titleEl.innerText.trim() : null;
          
          // Extract price
          const priceEl = element.querySelector(
            '[data-automation-id="product-price"], .price-main, .price-group, [itemprop="price"]'
          );
          const priceText = priceEl ? priceEl.innerText.trim() : null;
          
          // Extract image
          const imgEl = element.querySelector('img[data-automation-id="product-image"], img[src*="i5.walmartimages"]');
          const imageUrl = imgEl ? imgEl.src : null;
          
          // Extract product URL
          const linkEl = element.querySelector('a[href*="/ip/"]');
          const productUrl = linkEl ? linkEl.href : null;
          
          // Extract rating
          const ratingEl = element.querySelector('[data-automation-id="product-rating"], .stars-container');
          const ratingText = ratingEl ? ratingEl.getAttribute('aria-label') || ratingEl.innerText : null;
          const rating = ratingText ? parseFloat(ratingText.match(/[\d.]+/)?.[0]) : null;
          
          // Extract review count
          const reviewEl = element.querySelector('[data-automation-id="product-reviews-count"], .stars-reviews-count');
          const reviewText = reviewEl ? reviewEl.innerText : null;
          const reviewCount = reviewText ? parseInt(reviewText.match(/[\d,]+/)?.[0]?.replace(/,/g, '')) : null;
          
          // Extract original price (for sale items)
          const originalPriceEl = element.querySelector('.strike-through, .price-strikethrough, [data-automation-id="was-price"]');
          const originalPriceText = originalPriceEl ? originalPriceEl.innerText.trim() : null;
          
          // Extract badges (sale, clearance, etc.)
          const badgeEl = element.querySelector('[data-automation-id="product-badge"], .badge');
          const badge = badgeEl ? badgeEl.innerText.trim() : null;
          
          // Extract seller (Walmart vs 3rd party)
          const sellerEl = element.querySelector('[data-automation-id="seller-name"], .seller-name');
          const seller = sellerEl ? sellerEl.innerText.trim() : 'Walmart';
          
          if (title && priceText) {
            results.push({
              title,
              priceText,
              originalPriceText,
              imageUrl,
              productUrl,
              ratingText,
              rating,
              reviewCount,
              seller,
              badge,
              scrapedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error parsing Walmart product:', error);
        }
      }
      
      return results;
    }, options.maxResults || 50);

    console.log(`✅ Scraped ${products.length} Walmart products`);

    // Process and enhance products
    const enhancedProducts = products.map(product => {
      const price = parseWalmartPrice(product.priceText);
      const originalPrice = parseWalmartPrice(product.originalPriceText);
      const discount = originalPrice && price && originalPrice > price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0;

      return {
        title: product.title,
        price,
        currency: 'USD',
        originalPrice,
        discountPercentage: discount,
        discountAmount: originalPrice && price ? (originalPrice - price).toFixed(2) : 0,
        imageUrl: product.imageUrl,
        productUrl: product.productUrl,
        marketplace: 'walmart',
        marketplaceDomain: 'walmart.com',
        marketplaceLogo: WALMART_LOGO,
        seller: product.seller,
        condition: 'new',
        rating: product.rating,
        reviewCount: product.reviewCount,
        availability: 'in_stock',
        badge: product.badge,
        scrapedAt: product.scrapedAt
      };
    });

    return enhancedProducts;

  } catch (error) {
    console.error('❌ Walmart scrape error:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Get Walmart product details
 */
async function getWalmartProductDetails(productUrl) {
  console.log('🔍 Getting Walmart product details:', productUrl);

  let browser = null;

  try {
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
    
    browser = await puppeteer.launch({
      args: isProduction ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath: isProduction 
        ? await chromium.executablePath()
        : process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const details = await page.evaluate(() => {
      return {
        title: document.querySelector('h1[itemprop="name"]')?.innerText,
        price: document.querySelector('[itemprop="price"]')?.content,
        description: document.querySelector('[data-automation-id="product-description"]')?.innerText,
        images: Array.from(document.querySelectorAll('[data-automation-id="product-image"] img'))
          .map(img => img.src),
        specifications: Array.from(document.querySelectorAll('.ProductSpecifications'))
          .map(spec => spec.innerText)
      };
    });

    return details;

  } catch (error) {
    console.error('❌ Walmart details error:', error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  searchWalmart,
  getWalmartProductDetails,
  parseWalmartPrice
};
