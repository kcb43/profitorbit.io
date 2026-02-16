/**
 * Simple Multi-Marketplace Search using Free APIs
 * 
 * Strategy: Use multiple FREE sources:
 * 1. eBay Official API (if configured)
 * 2. RapidAPI Product Search (free tier: 500 requests/month)
 * 3. Amazon Product Advertising API (if configured)
 * 4. Direct scraping as fallback
 * 
 * All work without payment initially!
 */

import axios from 'axios';

/**
 * Search using RapidAPI Real-Time Product Search (FREE TIER)
 * https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-product-search
 * 
 * Free tier: 500 requests/month
 * Covers: Amazon, eBay, Walmart, Home Depot, and more
 */
async function searchRapidAPI(query, options = {}) {
  const apiKey = process.env.RAPIDAPI_KEY;
  
  if (!apiKey) {
    console.log('⚠️ RAPIDAPI_KEY not configured, skipping');
    return [];
  }

  try {
    console.log('🔍 Searching via RapidAPI:', query);
    
    const response = await axios.get('https://real-time-product-search.p.rapidapi.com/search', {
      params: {
        q: query,
        country: 'us',
        language: 'en',
        limit: options.maxResults || 50,
        sort_by: options.sortBy === 'price_low' ? 'LOWEST_PRICE' : 'BEST_MATCH'
      },
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'real-time-product-search.p.rapidapi.com'
      },
      timeout: 10000
    });

    const products = (response.data.data || []).map(item => ({
      title: item.product_title,
      price: parseFloat(item.offer?.price || item.typical_price_range?.[0] || 0),
      currency: 'USD',
      originalPrice: item.typical_price_range ? parseFloat(item.typical_price_range[1]) : null,
      imageUrl: item.product_photos?.[0],
      productUrl: item.offer?.offer_page_url || item.product_page_url,
      marketplace: extractMarketplaceFromUrl(item.offer?.offer_page_url || item.product_page_url),
      rating: item.product_rating || null,
      reviewCount: item.product_num_reviews || null,
      seller: item.offer?.store_name || 'Unknown',
      condition: 'new',
      availability: 'in_stock',
      scrapedAt: new Date().toISOString()
    }));

    console.log(`✅ RapidAPI: Found ${products.length} products`);
    return products;

  } catch (error) {
    console.error('❌ RapidAPI error:', error.message);
    return [];
  }
}

/**
 * Extract marketplace name from URL
 */
function extractMarketplaceFromUrl(url) {
  if (!url) return 'unknown';
  
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    
    if (hostname.includes('amazon')) return 'amazon';
    if (hostname.includes('ebay')) return 'ebay';
    if (hostname.includes('walmart')) return 'walmart';
    if (hostname.includes('target')) return 'target';
    if (hostname.includes('bestbuy')) return 'bestbuy';
    if (hostname.includes('homedepot')) return 'homedepot';
    if (hostname.includes('lowes')) return 'lowes';
    if (hostname.includes('macys')) return 'macys';
    if (hostname.includes('kohls')) return 'kohls';
    if (hostname.includes('wayfair')) return 'wayfair';
    if (hostname.includes('etsy')) return 'etsy';
    
    // Extract first part of domain as fallback
    return hostname.split('.')[0];
  } catch {
    return 'unknown';
  }
}

/**
 * Search using SerpAPI Google Shopping + Immersive Product (FREE TIER)
 * https://serpapi.com/google-shopping-api
 * https://serpapi.com/google-immersive-product-api
 * 
 * Free tier: 100 searches/month
 * Strategy: Use google_shopping to get product tokens, then fetch immersive data for top results
 */
async function searchSerpAPI(query, options = {}) {
  const apiKey = process.env.SERPAPI_KEY;
  
  if (!apiKey) {
    console.log('⚠️ SERPAPI_KEY not configured, skipping');
    return [];
  }

  try {
    console.log('🛍️ Searching via SerpAPI Google Shopping:', query);
    
    // Step 1: Get shopping results with product tokens
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_shopping',
        q: query,
        api_key: apiKey,
        num: options.maxResults || 50,
        location: 'United States'
      },
      timeout: 10000
    });

    const shoppingResults = response.data.shopping_results || [];
    
    if (shoppingResults.length === 0) {
      console.log('⚠️ SerpAPI: No shopping results found');
      return [];
    }

    console.log(`✅ SerpAPI Shopping: Found ${shoppingResults.length} products`);

    // Step 2: For products with immersive tokens, fetch detailed data
    // Limit to top 5 to control API usage (1 initial + 5 immersive = 6 calls total)
    const productsWithTokens = shoppingResults
      .filter(item => item.immersive_product_page_token)
      .slice(0, 5);

    console.log(`🔍 Fetching immersive data for ${productsWithTokens.length} products...`);

    // Fetch immersive data in parallel
    const immersiveResults = await Promise.allSettled(
      productsWithTokens.map(async (item) => {
        try {
          const immersiveResponse = await axios.get('https://serpapi.com/search', {
            params: {
              engine: 'google_immersive_product',
              page_token: item.immersive_product_page_token,
              more_stores: true, // Get up to 13 stores instead of 3-5
              api_key: apiKey
            },
            timeout: 10000
          });

          const immersiveData = immersiveResponse.data.product_results;
          
          // Return multiple results - one for each store
          if (immersiveData && immersiveData.stores && immersiveData.stores.length > 0) {
            return immersiveData.stores.slice(0, 10).map(store => ({
              title: immersiveData.title || item.title,
              price: store.extracted_price || parseFloat(store.price?.replace(/[^0-9.]/g, '') || 0),
              currency: 'USD',
              originalPrice: store.extracted_original_price || null,
              imageUrl: immersiveData.thumbnails?.[0] || item.thumbnail,
              productUrl: store.link,
              marketplace: store.name || extractMarketplaceFromUrl(store.link),
              marketplaceDomain: extractMarketplaceFromUrl(store.link),
              rating: store.rating || immersiveData.rating || item.rating || null,
              reviewCount: store.reviews || immersiveData.reviews || item.reviews || null,
              seller: store.name || 'Unknown',
              condition: 'new',
              availability: store.details_and_offers?.some(d => d.includes('In stock')) ? 'in_stock' : 'unknown',
              discountPercentage: store.discount ? parseInt(store.discount.replace(/\D/g, '')) : 0,
              priceRange: immersiveData.price_range,
              brand: immersiveData.brand,
              storeRating: store.rating,
              storeReviews: store.reviews,
              paymentMethods: store.payment_methods,
              shipping: store.shipping,
              shippingCost: store.shipping_extracted || 0,
              tag: store.tag, // "Best price", etc.
              source: 'serpapi_immersive',
              scrapedAt: new Date().toISOString()
            }));
          }
          
          // Fallback to basic data if no stores
          return [{
            title: item.title,
            price: parseFloat(item.extracted_price || item.price?.replace(/[^0-9.]/g, '') || 0),
            currency: 'USD',
            originalPrice: item.original_price ? parseFloat(item.original_price.replace(/[^0-9.]/g, '')) : null,
            imageUrl: item.thumbnail,
            productUrl: item.link,
            marketplace: item.source || extractMarketplaceFromUrl(item.link),
            rating: item.rating || null,
            reviewCount: item.reviews || null,
            seller: item.source || 'Unknown',
            condition: 'new',
            availability: 'in_stock',
            source: 'serpapi_shopping',
            scrapedAt: new Date().toISOString()
          }];

        } catch (immersiveError) {
          console.error('⚠️ Immersive fetch failed:', immersiveError.message);
          // Return basic shopping result as fallback
          return [{
            title: item.title,
            price: parseFloat(item.extracted_price || item.price?.replace(/[^0-9.]/g, '') || 0),
            currency: 'USD',
            originalPrice: item.original_price ? parseFloat(item.original_price.replace(/[^0-9.]/g, '')) : null,
            imageUrl: item.thumbnail,
            productUrl: item.link,
            marketplace: item.source || extractMarketplaceFromUrl(item.link),
            rating: item.rating || null,
            reviewCount: item.reviews || null,
            seller: item.source || 'Unknown',
            condition: 'new',
            availability: 'in_stock',
            source: 'serpapi_shopping_fallback',
            scrapedAt: new Date().toISOString()
          }];
        }
      })
    );

    // Flatten and collect all products
    const products = immersiveResults
      .filter(result => result.status === 'fulfilled' && result.value)
      .flatMap(result => result.value);

    // Add remaining basic shopping results that didn't have immersive tokens
    const remainingProducts = shoppingResults
      .filter(item => !item.immersive_product_page_token)
      .slice(0, options.maxResults ? options.maxResults - products.length : 45)
      .map(item => ({
        title: item.title,
        price: parseFloat(item.extracted_price || item.price?.replace(/[^0-9.]/g, '') || 0),
        currency: 'USD',
        originalPrice: item.original_price ? parseFloat(item.original_price.replace(/[^0-9.]/g, '')) : null,
        imageUrl: item.thumbnail,
        productUrl: item.link,
        marketplace: item.source || extractMarketplaceFromUrl(item.link),
        rating: item.rating || null,
        reviewCount: item.reviews || null,
        seller: item.source || 'Unknown',
        condition: 'new',
        availability: 'in_stock',
        source: 'serpapi_shopping',
        scrapedAt: new Date().toISOString()
      }));

    const allProducts = [...products, ...remainingProducts];

    console.log(`✅ SerpAPI: Total ${allProducts.length} products (${products.length} with detailed store data)`);
    return allProducts;

  } catch (error) {
    console.error('❌ SerpAPI error:', error.message);
    return [];
  }
}

/**
 * Main search aggregator - tries multiple FREE sources
 */
export async function searchAllMarketplaces(query, options = {}) {
  const results = [];
  
  try {
    // Try all free sources in parallel
    const [rapidResults, serpResults] = await Promise.allSettled([
      searchRapidAPI(query, options),
      searchSerpAPI(query, options)
    ]);

    // Collect results from successful sources
    if (rapidResults.status === 'fulfilled' && rapidResults.value.length > 0) {
      results.push(...rapidResults.value);
    }
    
    if (serpResults.status === 'fulfilled' && serpResults.value.length > 0) {
      results.push(...serpResults.value);
    }

    // Deduplicate based on title + price similarity
    const uniqueProducts = deduplicateProducts(results);

    console.log(`✅ Total unique products: ${uniqueProducts.length} from ${results.length} raw results`);
    
    return uniqueProducts;

  } catch (error) {
    console.error('❌ Multi-marketplace search error:', error);
    return [];
  }
}

/**
 * Simple deduplication
 */
function deduplicateProducts(products) {
  const seen = new Map();
  
  return products.filter(product => {
    const normalizedTitle = product.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
    const roundedPrice = Math.round(product.price);
    const key = `${normalizedTitle}-${roundedPrice}`;
    
    if (seen.has(key)) {
      return false;
    }
    
    seen.set(key, product);
    return true;
  });
}

export { searchRapidAPI, searchSerpAPI };
