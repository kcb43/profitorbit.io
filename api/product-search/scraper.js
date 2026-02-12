import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { searchEbay } from './ebay-api.js';
import { searchWalmart } from './walmart-scraper.js';
import { searchAllMarketplaces } from './free-api-search.js';

/**
 * Multi-Source Product Scraper
 * Combines FREE APIs + direct scraping for 100+ marketplaces
 * 
 * Priority Order:
 * 1. FREE APIs (RapidAPI, SerpAPI) - Fast, reliable, covers 100+ marketplaces
 * 2. eBay Official API (if configured)
 * 3. Direct scraping (Walmart, Amazon) - Slower, for specific marketplaces
 */

// Marketplace logo mapping
const MARKETPLACE_LOGOS = {
  'amazon.com': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
  'ebay.com': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg',
  'walmart.com': 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Walmart_logo.svg',
  'target.com': 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Target_logo.svg',
  'bestbuy.com': 'https://upload.wikimedia.org/wikipedia/commons/f/f5/Best_Buy_Logo.svg',
  'macys.com': 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Macy%27s_Logo.svg',
  'kohls.com': 'https://upload.wikimedia.org/wikipedia/commons/4/48/Kohl%27s_logo.svg',
  'homedepot.com': 'https://upload.wikimedia.org/wikipedia/commons/5/5f/TheHomeDepot.svg',
  'lowes.com': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Lowe%27s_Companies_Logo.svg',
  'etsy.com': 'https://upload.wikimedia.org/wikipedia/commons/8/89/Etsy_logo.svg',
  'wayfair.com': 'https://companieslogo.com/img/orig/W-ec7e8bcb.png',
  'overstock.com': 'https://ak1.ostkcdn.com/img/mxc/OSTK_LOGO_20150225.svg',
  'newegg.com': 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Newegg_Logo.svg',
};

// Extract marketplace from URL
function extractMarketplace(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const marketplaceName = domain.split('.')[0];
    return {
      key: marketplaceName,
      domain: domain,
      logo: MARKETPLACE_LOGOS[domain] || null
    };
  } catch (error) {
    return { key: 'unknown', domain: url, logo: null };
  }
}

// Calculate discount percentage
function calculateDiscount(currentPrice, originalPrice) {
  if (!originalPrice || originalPrice <= currentPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

/**
 * Scrape Google Shopping for products
 * @param {string} query - Search query (e.g., "Nike Air Max 90")
 * @param {object} options - Search options
 * @returns {Promise<Array>} - Array of product results
 */
async function scrapeGoogleShopping(query, options = {}) {
  console.log('🔍 Starting Google Shopping scrape:', query);
  
  const {
    minPrice = null,
    maxPrice = null,
    condition = 'all', // 'new', 'used', 'all'
    sortBy = 'relevance', // 'relevance', 'price_low', 'price_high', 'rating'
    maxResults = 50
  } = options;

  let browser = null;

  try {
    // Launch browser (Vercel-optimized)
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
    
    browser = await puppeteer.launch({
      args: isProduction ? chromium.args : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
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

    // Build Google Shopping URL
    let url = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
    
    // Add price filters
    if (minPrice || maxPrice) {
      const min = minPrice || 0;
      const max = maxPrice || 999999;
      url += `&tbs=mr:1,price:1,ppr_min:${min},ppr_max:${max}`;
    }

    // Add condition filter
    if (condition === 'new') {
      url += '&tbs=mr:1,new:1';
    } else if (condition === 'used') {
      url += '&tbs=mr:1,used:1';
    }

    // Add sort parameter
    if (sortBy === 'price_low') {
      url += '&tbs=p_ord:p'; // Price: Low to High
    } else if (sortBy === 'price_high') {
      url += '&tbs=p_ord:pd'; // Price: High to Low
    } else if (sortBy === 'rating') {
      url += '&tbs=p_ord:r'; // By review score
    }

    console.log('🌐 Navigating to:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for product results to load
    await page.waitForSelector('.sh-dgr__content, .sh-dlr__list-result', { timeout: 10000 });

    // Extract product data
    const products = await page.evaluate((maxResults) => {
      const results = [];
      
      // Google Shopping uses multiple selectors depending on layout
      const productElements = document.querySelectorAll('.sh-dgr__content, .sh-dlr__list-result');
      
      for (let i = 0; i < Math.min(productElements.length, maxResults); i++) {
        const element = productElements[i];
        
        try {
          // Extract title
          const titleEl = element.querySelector('.tAxDx, .Xjkr3b, h3, .sh-np__product-title');
          const title = titleEl ? titleEl.innerText.trim() : null;
          
          // Extract price
          const priceEl = element.querySelector('.a8Pemb, .OqQkCd, .kHxwFf span[aria-hidden="true"]');
          const priceText = priceEl ? priceEl.innerText.trim() : null;
          const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null;
          const currency = priceText ? (priceText.match(/[$€£¥]/)?.[0] || 'USD') : 'USD';
          
          // Extract original price (for discount calculation)
          const originalPriceEl = element.querySelector('.HbpHee, .XrMopc');
          const originalPriceText = originalPriceEl ? originalPriceEl.innerText.trim() : null;
          const originalPrice = originalPriceText ? parseFloat(originalPriceText.replace(/[^0-9.]/g, '')) : null;
          
          // Extract seller/store
          const sellerEl = element.querySelector('.aULzUe, .IuHnof, .E5ocAb, .merchant-name');
          const seller = sellerEl ? sellerEl.innerText.trim() : null;
          
          // Extract product URL
          const linkEl = element.querySelector('a[href*="/shopping/product/"], a[jsname]');
          let productUrl = linkEl ? linkEl.href : null;
          
          // Extract image
          const imgEl = element.querySelector('img');
          const imageUrl = imgEl ? (imgEl.src || imgEl.dataset.src) : null;
          
          // Extract rating
          const ratingEl = element.querySelector('.Rsc7Yb, [aria-label*="star"], [aria-label*="rating"]');
          const ratingText = ratingEl ? (ratingEl.getAttribute('aria-label') || ratingEl.innerText) : null;
          const rating = ratingText ? parseFloat(ratingText.match(/[\d.]+/)?.[0]) : null;
          
          // Extract review count
          const reviewEl = element.querySelector('.QG4nld, .NVVhjd, [aria-label*="reviews"]');
          const reviewText = reviewEl ? reviewEl.innerText : null;
          const reviewCount = reviewText ? parseInt(reviewText.match(/[\d,]+/)?.[0]?.replace(/,/g, '')) : null;
          
          // Extract condition
          const conditionEl = element.querySelector('[data-condition], .condition');
          const condition = conditionEl ? conditionEl.innerText.trim().toLowerCase() : 'new';
          
          // Only add if we have minimum required data
          if (title && price) {
            results.push({
              title,
              price,
              currency,
              originalPrice,
              seller,
              productUrl,
              imageUrl,
              rating,
              reviewCount,
              condition,
              scrapedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error parsing product:', error);
        }
      }
      
      return results;
    }, maxResults);

    console.log(`✅ Scraped ${products.length} products`);

    // Enhance with marketplace detection and discount calculation
    const enhancedProducts = products.map(product => {
      const marketplace = extractMarketplace(product.productUrl || '');
      const discount = calculateDiscount(product.price, product.originalPrice);
      
      return {
        ...product,
        marketplace: marketplace.key,
        marketplaceDomain: marketplace.domain,
        marketplaceLogo: marketplace.logo,
        discountPercentage: discount,
        discountAmount: product.originalPrice ? (product.originalPrice - product.price).toFixed(2) : 0,
        availability: 'in_stock', // Google Shopping typically only shows available items
      };
    });

    // Filter by marketplace if specified
    if (options.marketplaces && options.marketplaces.length > 0) {
      return enhancedProducts.filter(p => 
        options.marketplaces.includes('all') || options.marketplaces.includes(p.marketplace)
      );
    }

    return enhancedProducts;

  } catch (error) {
    console.error('❌ Google Shopping scrape error:', error);
    throw new Error(`Failed to scrape Google Shopping: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape Amazon directly for detailed data
 * Used as fallback or for Amazon-specific searches
 */
async function scrapeAmazon(query, options = {}) {
  console.log('🛒 Scraping Amazon directly:', query);
  
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

    const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for results
    await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 });

    const products = await page.evaluate(() => {
      const results = [];
      const items = document.querySelectorAll('[data-component-type="s-search-result"]');

      items.forEach(item => {
        try {
          const titleEl = item.querySelector('h2 a span');
          const priceEl = item.querySelector('.a-price .a-offscreen');
          const imageEl = item.querySelector('img.s-image');
          const ratingEl = item.querySelector('.a-icon-star-small');
          const reviewEl = item.querySelector('[aria-label*="stars"]');
          const linkEl = item.querySelector('h2 a');

          const title = titleEl?.innerText.trim();
          const priceText = priceEl?.innerText.trim();
          const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null;
          const imageUrl = imageEl?.src;
          const productUrl = linkEl?.href;
          const ratingText = ratingEl?.innerText || reviewEl?.getAttribute('aria-label');
          const rating = ratingText ? parseFloat(ratingText.match(/[\d.]+/)?.[0]) : null;
          const reviewCount = reviewEl?.innerText ? parseInt(reviewEl.innerText.replace(/[^0-9]/g, '')) : null;

          if (title && price) {
            results.push({
              title,
              price,
              currency: 'USD',
              imageUrl,
              productUrl: productUrl ? `https://www.amazon.com${productUrl}` : null,
              rating,
              reviewCount,
              marketplace: 'amazon',
              marketplaceLogo: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
              seller: 'Amazon',
              condition: 'new',
              availability: 'in_stock'
            });
          }
        } catch (error) {
          console.error('Error parsing Amazon item:', error);
        }
      });

      return results;
    });

    console.log(`✅ Scraped ${products.length} Amazon products`);
    return products;

  } catch (error) {
    console.error('❌ Amazon scrape error:', error);
    throw new Error(`Failed to scrape Amazon: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Main scraper function - uses FREE APIs first, then falls back to scraping
 * 
 * FREE API Options (No payment needed):
 * 1. RapidAPI Product Search - 500 requests/month FREE
 * 2. SerpAPI Google Shopping - 100 searches/month FREE
 * 3. eBay Official API - 5,000 requests/day FREE
 * 
 * If no API keys configured, falls back to direct scraping
 */
async function scrapeProducts(query, options = {}) {
  const sources = [];
  
  try {
    console.log(`🔍 Starting search for: "${query}"`);
    
    // PRIORITY 1: Try FREE APIs first (fastest + covers 100+ marketplaces)
    try {
      const freeApiResults = await searchAllMarketplaces(query, options);
      if (freeApiResults && freeApiResults.length > 0) {
        console.log(`✅ FREE APIs returned ${freeApiResults.length} products`);
        
        // Enhance with marketplace logos
        const enhanced = freeApiResults.map(p => ({
          ...p,
          marketplaceLogo: MARKETPLACE_LOGOS[p.marketplaceDomain] || MARKETPLACE_LOGOS[`${p.marketplace}.com`] || null,
          discountPercentage: p.discountPercentage || calculateDiscount(p.price, p.originalPrice)
        }));
        
        return {
          success: true,
          sources: ['free_apis'],
          query,
          totalResults: enhanced.length,
          products: enhanced,
          scrapedAt: new Date().toISOString()
        };
      }
    } catch (apiError) {
      console.log('⚠️ FREE APIs not available:', apiError.message);
    }

    // PRIORITY 2: eBay API (if configured)
    console.log('⚠️ No FREE APIs, trying eBay API + direct scraping...');
    const promises = [];

    if (process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID) {
      promises.push(
        searchEbay(query, options)
          .then(results => ({ source: 'ebay_api', results }))
          .catch(err => ({ source: 'ebay_api', results: [], error: err.message }))
      );
    }

    // PRIORITY 3: Direct scraping (slower but works without any config)
    promises.push(
      searchWalmart(query, { ...options, maxResults: 20 })
        .then(results => ({ source: 'walmart', results }))
        .catch(err => ({ source: 'walmart', results: [], error: err.message }))
    );

    promises.push(
      scrapeAmazon(query, { ...options, maxResults: 20 })
        .then(results => ({ source: 'amazon', results }))
        .catch(err => ({ source: 'amazon', results: [], error: err.message }))
    );

    // Wait for all sources (with 25s timeout)
    const sourceResults = await Promise.race([
      Promise.all(promises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Scraping timeout')), 25000)
      )
    ]);

    // Combine results
    let allProducts = [];
    sourceResults.forEach(({ source, results, error }) => {
      if (results && results.length > 0) {
        sources.push(source);
        allProducts = allProducts.concat(results);
        console.log(`✅ ${source}: ${results.length} products`);
      } else if (error) {
        console.log(`⚠️ ${source}: ${error}`);
      }
    });

    if (allProducts.length === 0) {
      return {
        success: false,
        error: 'No results found from any source',
        query,
        products: [],
        totalResults: 0
      };
    }

    const uniqueProducts = deduplicateProducts(allProducts);

    return {
      success: true,
      sources,
      query,
      totalResults: uniqueProducts.length,
      products: uniqueProducts,
      scrapedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Search failed:', error);
    return {
      success: false,
      error: error.message,
      query,
      products: [],
      totalResults: 0
    };
  }
}

/**
 * Deduplicate products based on title and price similarity
 */
function deduplicateProducts(products) {
  const seen = new Map();
  
  return products.filter(product => {
    // Create a key based on normalized title and rounded price
    const normalizedTitle = product.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
    const roundedPrice = Math.round(product.price);
    const key = `${normalizedTitle}-${roundedPrice}`;
    
    if (seen.has(key)) {
      // Duplicate found - keep the one with more data
      const existing = seen.get(key);
      if (product.rating && !existing.rating) {
        seen.set(key, product);
        return true;
      }
      return false;
    }
    
    seen.set(key, product);
    return true;
  });
}

export {
  scrapeProducts,
  scrapeGoogleShopping,
  scrapeAmazon,
  deduplicateProducts,
  MARKETPLACE_LOGOS
};
