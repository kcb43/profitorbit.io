/**
 * Orben Search Worker
 * 
 * Universal product search across multiple providers:
 * - eBay API
 * - RapidAPI (Google Shopping, etc.)
 * - Retailer APIs
 * - Oxylabs (optional)
 * 
 * Cache-first strategy with Redis
 * Budget/quota enforcement
 * Updated: 2026-02-15 - New SerpAPI key deployment
 */

import Fastify from 'fastify';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import axios from 'axios';
import http from 'http';
import https from 'https';
import CacheableLookup from 'cacheable-lookup';
import crypto from 'crypto';
import 'dotenv/config';

// ==========================================
// Initialize
// ==========================================
const fastify = Fastify({ logger: true });

// Optional: Supabase for saving search snapshots
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// #region agent log
// Log Supabase initialization status on startup
if (supabase) {
  console.log('[Search Worker] Supabase client initialized successfully');
} else {
  console.log('[Search Worker] Supabase client NOT initialized - missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
// #endregion

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

// DNS caching to avoid repeated lookups (saves 100-500ms per request)
const cacheable = new CacheableLookup();

// Create HTTP agents with keep-alive for connection pooling
// This significantly reduces latency by reusing TCP connections
const httpAgent = new http.Agent({ 
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000
});

const httpsAgent = new https.Agent({ 
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000
});

// Install DNS cache on agents
cacheable.install(httpAgent);
cacheable.install(httpsAgent);

// Create axios instance with connection pooling and DNS caching
const axiosInstance = axios.create({
  httpAgent: httpAgent,
  httpsAgent: httpsAgent
});

// ==========================================
// Provider Interface
// ==========================================
class SearchProvider {
  constructor(name) {
    this.name = name;
  }

  async search(query, opts) {
    throw new Error('Must implement search()');
  }
}

// ==========================================
// eBay Provider (via Oxylabs Universal Scraper)
// Note: eBay Finding API was decommissioned Feb 4, 2025
// Browse API is unreliable, so using Oxylabs to scrape eBay directly
// ==========================================
class EbayProvider extends SearchProvider {
  constructor() {
    super('ebay');
    this.username = process.env.OXYLABS_USERNAME;
    this.password = process.env.OXYLABS_PASSWORD;
  }

  async search(query, opts = {}) {
    const { country = 'US', limit = 20 } = opts;

    if (!this.username || !this.password) {
      console.error('[eBay] No Oxylabs credentials configured');
      return [];
    }

    try {
      console.log(`[eBay] Searching via Oxylabs for: "${query}"`);
      
      // Use Oxylabs to scrape eBay search results WITHOUT parsing
      // We'll get raw HTML and look for basic patterns
      const response = await axios.post(
        'https://realtime.oxylabs.io/v1/queries',
        {
          source: 'universal',
          url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_ipg=${Math.min(limit, 50)}`,
          parse: false // Get raw HTML instead of trying to parse as product page
        },
        {
          auth: {
            username: this.username,
            password: this.password
          },
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`[eBay] Oxylabs response status: ${response.status}`);
      console.log(`[eBay] Job status: ${response.data?.job?.status}`);
      
      if (response.data?.job?.status === 'faulted') {
        console.error('[eBay] Oxylabs job faulted');
        return [];
      }

      // Get raw HTML content
      const html = response.data?.results?.[0]?.content || '';
      
      if (!html || html.length < 100) {
        console.error('[eBay] No HTML content returned');
        return [];
      }

      // Parse eBay search results from HTML using regex patterns
      // This is a simplified parser - looks for item cards in eBay's HTML
      const items = [];
      
      // eBay search results have a specific structure we can match
      // Looking for s-item__info divs with title, price, and link
      const itemPattern = /<div class="s-item__info[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/li>/g;
      const titlePattern = /<div class="s-item__title[^"]*"[^>]*><span[^>]*>([^<]+)<\/span>/;
      const pricePattern = /<span class="s-item__price">([^<]+)<\/span>/;
      const urlPattern = /<a class="s-item__link" href="([^"]+)"/;
      const imagePattern = /<img[^>]+src="([^"]+)"[^>]*class="[^"]*s-item__image-img/;
      
      let match;
      let count = 0;
      while ((match = itemPattern.exec(html)) !== null && count < limit) {
        const itemHtml = match[1];
        
        const titleMatch = titlePattern.exec(itemHtml);
        const priceMatch = pricePattern.exec(itemHtml);
        const urlMatch = urlPattern.exec(match[0]);
        const imageMatch = imagePattern.exec(match[0]);
        
        if (titleMatch && priceMatch && urlMatch) {
          const price = priceMatch[1].replace(/[^0-9.]/g, '');
          
          items.push({
            title: titleMatch[1].trim(),
            url: urlMatch[1],
            price: parseFloat(price) || null,
            currency: 'USD',
            merchant: 'eBay',
            image_url: imageMatch ? imageMatch[1] : null,
            source: this.name,
            condition: 'Used'
          });
          count++;
        }
      }
      
      console.log(`[eBay] Parsed ${items.length} items from HTML`);
      return items.filter(item => item.title && item.url);
      
    } catch (error) {
      console.error(`[eBay] Oxylabs search error:`, error.message);
      if (error.response) {
        console.error(`[eBay] Status: ${error.response.status}`);
        console.error(`[eBay] Data:`, JSON.stringify(error.response.data).slice(0, 300));
      }
      return [];
    }
  }
}

// ==========================================
// SerpAPI Google Shopping Provider
// ==========================================
class SerpApiGoogleProvider extends SearchProvider {
  constructor() {
    super('google');
    this.apiKey = process.env.SERPAPI_KEY;
    this.baseUrl = 'https://serpapi.com/search.json';
  }

  /**
   * Fetch merchant offers for a specific product using Immersive Product API
   * @param {string} productPageToken - The immersive_product_page_token from search results
   * @returns {Array} Array of merchant offers with direct links
   */
  async getProductOffers(productPageToken) {
    if (!this.apiKey || !productPageToken) {
      console.warn('[SerpAPI] Missing API key or page token for product offers');
      return [];
    }

    try {
      console.log(`[SerpAPI] Fetching product offers for token: ${productPageToken.substring(0, 20)}...`);
      
      const params = {
        engine: 'google_immersive_product',
        page_token: productPageToken,
        api_key: this.apiKey,
        more_stores: true // Get up to 13 stores instead of default 3-5
      };
      
      const response = await axiosInstance.get(this.baseUrl, {
        params: params,
        timeout: 10000
      });

      console.log('[SerpAPI] Product offers response', JSON.stringify({
        hasOffers: !!response.data?.sellers_results,
        offerCount: response.data?.sellers_results?.length || 0,
        allKeys: Object.keys(response.data || {}),
        hasOnlineStores: !!response.data?.online_stores,
        onlineStoresCount: response.data?.online_stores?.length || 0,
        hasProductResults: !!response.data?.product_results,
        hasStores: !!response.data?.product_results?.stores,
        storesCount: response.data?.product_results?.stores?.length || 0
      }));

      // Extract merchant offers with REAL direct links
      // The correct field is product_results.stores (not sellers_results)
      const offers = response.data?.product_results?.stores || [];
      
      return offers.map(offer => ({
        merchant: offer.name || 'Unknown',
        price: offer.extracted_price || offer.price || 0,
        link: offer.link || offer.store_link || null, // This is the REAL merchant URL!
        shipping: offer.shipping || null,
        delivery: offer.delivery || null,
        rating: offer.seller_rating || null,
        reviews: offer.seller_reviews || null,
        base_price: offer.base_price || null,
        total_price: offer.total_price || null
      })).filter(offer => offer.link); // Only return offers with valid links
      
    } catch (error) {
      console.error('[SerpAPI] Error fetching product offers:', error.message);
      return [];
    }
  }

  async search(query, opts = {}) {
    console.log('[SerpAPI] Search entry', JSON.stringify({
      hasApiKey: !!this.apiKey,
      query: query
    }));
    
    if (!this.apiKey) {
      console.warn('[SerpAPI] No API key configured');
      return [];
    }

    const { country = 'US', limit = 20, page = 1 } = opts;

    try {
      console.log(`[SerpAPI] Searching for: "${query}"`);
      
      const requestStartTime = Date.now();
      
      // SerpAPI parameters for Google Shopping
      // Support BOTH engines:
      // 1. engine=google - regular search that returns immersive_products
      // 2. engine=google_shopping - dedicated shopping that returns shopping_results
      // We'll use engine=google by default to match SerpAPI playground behavior
      const params = {
        engine: 'google',  // Changed from 'google_shopping' to 'google'
        q: query,
        hl: 'en',
        gl: country.toLowerCase(),
        api_key: this.apiKey,
        num: Math.min(limit, 100), // SerpAPI supports up to 100 results
        start: (page - 1) * limit // SerpAPI uses 'start' for pagination offset
      };
      
      console.log('[SerpAPI] Request parameters', JSON.stringify({
        query: query,
        limit: limit,
        page: page,
        start: params.start
      }));
      
      const response = await axiosInstance.get(this.baseUrl, {
        params: params,
        timeout: 30000 // Increased from 10s to 30s - SerpAPI can be slow for some queries
      });
      
      const requestDuration = Date.now() - requestStartTime;
      console.log('[SerpAPI] Request completed', JSON.stringify({
        duration: requestDuration,
        hasShoppingResults: !!response.data?.shopping_results,
        shoppingCount: response.data?.shopping_results?.length || 0,
        hasImmersiveProducts: !!response.data?.immersive_products,
        immersiveCount: response.data?.immersive_products?.length || 0,
        hasInlineShoppingResults: !!response.data?.inline_shopping_results,
        inlineCount: response.data?.inline_shopping_results?.length || 0,
        hasOrganicResults: !!response.data?.organic_results,
        organicCount: response.data?.organic_results?.length || 0,
        allTopLevelKeys: Object.keys(response.data || {})
      }));
      
      // DEBUG: Log first product to see all available fields
      if (response.data?.immersive_products?.[0]) {
        console.log('[SerpAPI] First immersive product fields:', JSON.stringify({
          availableFields: Object.keys(response.data.immersive_products[0]),
          hasImmersiveToken: !!response.data.immersive_products[0].immersive_product_page_token,
          immersiveTokenValue: response.data.immersive_products[0].immersive_product_page_token?.substring(0, 50),
          title: response.data.immersive_products[0].title,
          price: response.data.immersive_products[0].price || response.data.immersive_products[0].extracted_price
        }));
      } else if (response.data?.shopping_results?.[0]) {
        console.log('[SerpAPI] First shopping product fields:', JSON.stringify({
          availableFields: Object.keys(response.data.shopping_results[0]),
          hasImmersiveToken: !!response.data.shopping_results[0].immersive_product_page_token,
          immersiveTokenValue: response.data.shopping_results[0].immersive_product_page_token?.substring(0, 50),
          title: response.data.shopping_results[0].title,
          price: response.data.shopping_results[0].price || response.data.shopping_results[0].extracted_price
        }));
      }

      // Transform SerpAPI response to our standard format
      const items = [];
      
      // Priority 1: immersive_products (NEW Google Shopping format)
      if (response.data?.immersive_products) {
        console.log(`[SerpAPI] Found immersive_products: ${response.data.immersive_products.length}`);
        for (const product of response.data.immersive_products) {
          items.push({
            title: product.title || 'Untitled',
            price: product.extracted_price || parseFloat(product.price?.replace(/[^0-9.]/g, '')) || 0,
            old_price: product.extracted_original_price || null,
            currency: 'USD',
            url: product.link || product.serpapi_link || '#',
            product_link: product.link || '#',
            image_url: product.thumbnail || null,
            merchant: product.source || 'Unknown',
            condition: 'New',
            shipping: product.delivery?.toLowerCase().includes('free') ? 0 : null,
            delivery: product.delivery || null,
            rating: product.rating || null,
            reviews: product.reviews || null,
            snippet: null,
            extensions: product.extensions || [],
            tag: product.tag || null,
            badge: null,
            position: null,
            multiple_sources: false,
            // CRITICAL: Include the token to fetch direct merchant links
            immersive_product_page_token: product.immersive_product_page_token || null,
            product_id: null,
            location: product.location || null
          });
        }
      }
      
      // Priority 2: shopping_results (Classic Google Shopping tab results)
      if (items.length < limit && response.data?.shopping_results) {
        console.log(`[SerpAPI] Found shopping_results: ${response.data.shopping_results.length}`);
        for (const product of response.data.shopping_results) {
          if (items.length >= limit) break;
          
          items.push({
            title: product.title || 'Untitled',
            price: product.extracted_price || product.price || 0,
            old_price: product.extracted_old_price || null,
            currency: 'USD',
            url: product.link || product.product_link || '#',
            product_link: product.product_link || product.link || '#',
            image_url: product.thumbnail || null,
            merchant: product.source || product.seller || 'Unknown',
            condition: 'New',
            shipping: product.delivery?.toLowerCase().includes('free') ? 0 : null,
            delivery: product.delivery || null,
            rating: product.rating || null,
            reviews: product.reviews || product.reviews_count || null,
            snippet: product.snippet || null,
            extensions: product.extensions || [],
            tag: product.tag || null,
            badge: product.badge || null,
            position: product.position || null,
            multiple_sources: product.multiple_sources || false,
            // CRITICAL: Include the token to fetch direct merchant links
            immersive_product_page_token: product.immersive_product_page_token || null,
            product_id: product.product_id || null,
            location: product.store || null
          });
        }
      }
      
      // Priority 3: inline_shopping_results (if available)
      if (items.length < limit && response.data?.inline_shopping_results) {
        console.log(`[SerpAPI] Found inline_shopping_results: ${response.data.inline_shopping_results.length}`);
        for (const product of response.data.inline_shopping_results) {
          if (items.length >= limit) break;
          
          items.push({
            title: product.title || 'Untitled',
            price: product.extracted_price || product.price || 0,
            original_price: product.extracted_original_price || null,
            currency: 'USD',
            url: product.link || product.product_link || '#',
            image_url: product.thumbnail || null,
            merchant: product.source || product.seller || 'Unknown',
            condition: 'New',
            shipping: product.delivery?.toLowerCase().includes('free') ? 0 : null,
            rating: product.rating || null,
            reviews: product.reviews || product.reviews_count || null
          });
        }
      }
      
      // Priority 4: organic_results (if no shopping results found)
      if (items.length < limit && response.data?.organic_results) {
        console.log(`[SerpAPI] Found organic_results: ${response.data.organic_results.length}`);
        for (const product of response.data.organic_results) {
          if (items.length >= limit) break;
          
          // Only include organic results that look like shopping items
          if (product.price || product.thumbnail) {
            items.push({
              title: product.title || 'Untitled',
              price: product.extracted_price || parseFloat(product.price?.replace(/[^0-9.]/g, '')) || 0,
              original_price: product.extracted_original_price || null,
              currency: 'USD',
              url: product.link || '#',
              image_url: product.thumbnail || null,
              merchant: product.source || new URL(product.link || '').hostname.replace('www.', '') || 'Unknown',
              condition: 'New',
              rating: product.rating || null,
              reviews: product.reviews || null,
              snippet: product.snippet || null
            });
          }
        }
      }

      console.log(`[SerpAPI] Transformed ${items.length} items`);
      return items;

    } catch (error) {
      console.error('[SerpAPI] Search error:', error.message);
      
      if (error.response) {
        console.error('[SerpAPI] Error response:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      return [];
    }
  }
}

// ==========================================
// RapidAPI Google Shopping Provider (DEPRECATED - keeping for fallback)
// ==========================================
class RapidApiGoogleProvider extends SearchProvider {
  constructor() {
    super('google');
    this.apiKey = process.env.RAPIDAPI_KEY;
  }

  async search(query, opts = {}) {
    // Hypothesis A: Is the RAPIDAPI_KEY accessible?
    console.log('[DEBUG-A] RapidAPI search entry', JSON.stringify({
      hasApiKey: !!this.apiKey,
      keyLength: this.apiKey?.length || 0,
      query: query
    }));
    
    if (!this.apiKey) {
      console.warn('[Google/RapidAPI] No API key configured');
      console.log('[DEBUG-A] No API key - returning empty', JSON.stringify({
        env_key_exists: !!process.env.RAPIDAPI_KEY
      }));
      return [];
    }

    const { country = 'US', limit = 20, page = 1 } = opts;

    try {
      // Using Real-Time Product Search API v2 on RapidAPI
      console.log(`[Google/RapidAPI] Searching for: "${query}"`);
      
      // Hypothesis B: Is RapidAPI request being made correctly?
      // #region agent log
      const requestStartTime = Date.now();
      console.log('[DEBUG-B] Making RapidAPI request', JSON.stringify({
        query: query,
        country: country,
        limit: limit,
        page: page,
        timestamp: requestStartTime,
        allParams: {
          q: query,
          country: country.toLowerCase(),
          language: 'en',
          page: page,
          limit: Math.min(limit, 50),
          sort_by: 'BEST_MATCH',
          product_condition: 'ANY'
        }
      }));
      // #endregion
      
      // Hypothesis H: Limit parameter directly impacts speed
      // Testing shows: 10 items = 3-4s, 20 items = 6-8s, 50 items = 23s
      // Pass through the requested limit directly (no capping)
      const optimizedLimit = Math.min(limit, 100); // Cap at 100 max to prevent abuse
      
      const requestParams = {
        q: query,
        country: country.toLowerCase(),
        page: page,
        limit: optimizedLimit
      };
      
      // #region agent log
      console.log('[DEBUG-H] Optimized request parameters', JSON.stringify({
        requestedLimit: limit,
        optimizedLimit: optimizedLimit,
        page: page,
        params: requestParams,
        hypothesisId: 'H'
      }));
      // #endregion
      
      console.log('[DEBUG-N] Before RapidAPI request', JSON.stringify({
        query: query,
        requestedLimit: limit,
        optimizedLimit: optimizedLimit,
        timeout: 30000,
        hypothesisId: 'N'
      }));
      
      const response = await axiosInstance.get('https://real-time-product-search.p.rapidapi.com/search-v2', {
        params: requestParams,
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'real-time-product-search.p.rapidapi.com'
        },
        timeout: 30000 // Increased from 15s to 30s to handle larger result sets
      });
      
      // #region agent log
      const requestEndTime = Date.now();
      const requestDuration = requestEndTime - requestStartTime;
      console.log('[DEBUG-TIMING] RapidAPI request completed', JSON.stringify({
        query: query,
        durationMs: requestDuration,
        startTime: requestStartTime,
        endTime: requestEndTime,
        statusCode: response.status,
        hypothesisId: 'TIMING'
      }));
      // #endregion

      // Hypothesis D: Is RapidAPI returning products?
      console.log('[DEBUG-D] RapidAPI response received', JSON.stringify({
        statusCode: response.status,
        dataStatus: response.data?.status,
        hasData: !!response.data,
        hasProducts: !!(response.data?.data?.products),
        productCount: response.data?.data?.products?.length || 0,
        requestedLimit: limit,
        actualLimit: Math.min(limit, 50),
        rawDataKeys: Object.keys(response.data || {}),
        hypothesisId: 'D'
      }));
      
      // Hypothesis F: Log raw response structure for debugging
      if (response.data?.data?.products?.length === 0) {
        console.log('[DEBUG-F] RapidAPI returned 0 products', JSON.stringify({
          query: query,
          responseStatus: response.data?.status,
          totalAvailable: response.data?.data?.total || 0,
          hasError: !!response.data?.error,
          errorMessage: response.data?.error || null,
          hypothesisId: 'F'
        }));
      }
      
      // Log if we got fewer items than requested
      if (response.data?.data?.products?.length < limit) {
        console.log('[DEBUG-G] RapidAPI returned fewer items than requested', JSON.stringify({
          requested: limit,
          received: response.data?.data?.products?.length || 0,
          query: query,
          hypothesisId: 'G'
        }));
      }

      console.log(`[Google/RapidAPI] Response status: ${response.data?.status}`);
      
      const products = response.data?.data?.products || [];
      
      // Hypothesis D continued: Log product extraction
      console.log('[DEBUG-D] Products extracted', JSON.stringify({
        productCount: products.length,
        firstProductTitle: products[0]?.product_title || null
      }));
      
      console.log(`[Google/RapidAPI] Found ${products.length} products`);

      return products.map(item => {
        // Extract price from string (e.g., "$429.00" -> 429.00)
        let price = null;
        if (item.offer?.price) {
          const priceStr = item.offer.price.toString().replace(/[^0-9.]/g, '');
          price = parseFloat(priceStr);
        }

        return {
          title: item.product_title,
          url: item.offer?.offer_page_url || item.product_page_url,
          price: price,
          currency: 'USD',
          merchant: item.offer?.store_name || 'Google Shopping',
          image_url: item.product_photos?.[0],
          source: this.name,
          rating: item.product_rating,
          reviews_count: item.product_num_reviews,
          condition: item.offer?.product_condition || 'New'
        };
      }).filter(item => item.title && item.url);
    } catch (error) {
      // Hypothesis B: Log RapidAPI errors
      console.log('[DEBUG-B] RapidAPI error caught', JSON.stringify({
        errorMessage: error.message,
        hasResponse: !!error.response,
        statusCode: error.response?.status || null,
        responseData: error.response?.data ? JSON.stringify(error.response.data).slice(0, 200) : null
      }));
      
      console.error(`[Google/RapidAPI] Search error:`, error.message);
      if (error.response) {
        console.error(`[Google/RapidAPI] Status: ${error.response.status}`);
        console.error(`[Google/RapidAPI] Data:`, JSON.stringify(error.response.data).slice(0, 200));
      }
      return [];
    }
  }
}

// ==========================================
// Oxylabs Provider (Web Scraper API)
// ==========================================
class OxylabsProvider extends SearchProvider {
  constructor() {
    super('oxylabs');
    this.username = process.env.OXYLABS_USERNAME;
    this.password = process.env.OXYLABS_PASSWORD;
  }

  async search(query, opts = {}) {
    if (!this.username || !this.password) {
      console.warn('[Oxylabs] No credentials configured');
      return [];
    }

    const { country = 'US', limit = 20 } = opts;

    try {
      console.log(`[Oxylabs] Searching Amazon via Oxylabs for: "${query}"`);
      
      // Use amazon_search - more reliable and returns actual products with prices
      const response = await axios.post(
        'https://realtime.oxylabs.io/v1/queries',
        {
          source: 'amazon_search',
          query: query,
          domain: 'com',
          start_page: 1,
          pages: 1,
          parse: true,
          context: [
            { key: 'category_id', value: 'aps' } // All departments
          ]
        },
        {
          auth: {
            username: this.username,
            password: this.password
          },
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`[Oxylabs] Response status: ${response.status}`);
      console.log(`[Oxylabs] Job status: ${response.data?.job?.status}`);
      
      // Parse Amazon search results (structured product data)
      const content = response.data?.results?.[0]?.content || {};
      const organicResults = content.results?.organic || [];
      
      console.log(`[Oxylabs] Found ${organicResults.length} Amazon results`);

      // Map Amazon results to our format
      const items = organicResults.map(item => {
        // Extract price from Amazon price field
        let price = null;
        if (item.price) {
          price = parseFloat(item.price.toString().replace(/[^0-9.]/g, ''));
        } else if (item.price_upper) {
          price = parseFloat(item.price_upper.toString().replace(/[^0-9.]/g, ''));
        }

        return {
          title: item.title,
          url: item.url,
          price: price,
          currency: item.currency || 'USD',
          merchant: 'Amazon',
          image_url: item.thumbnail || item.image,
          source: this.name,
          rating: item.rating,
          reviews_count: item.reviews_count,
          condition: 'New',
          asin: item.asin
        };
      }).filter(item => item.title && item.url);

      console.log(`[Oxylabs] Returning ${items.length} product results`);
      
      return items.slice(0, limit);
    } catch (error) {
      console.error(`[Oxylabs] Search error:`, error.message);
      if (error.response) {
        console.error(`[Oxylabs] Status: ${error.response.status}`);
        console.error(`[Oxylabs] Data:`, JSON.stringify(error.response.data).slice(0, 300));
      }
      return [];
    }
  }
}

// ==========================================
// Provider Registry
// ==========================================
const providers = {
  ebay: new EbayProvider(),
  google: new SerpApiGoogleProvider(), // UPDATED: Now using SerpAPI instead of RapidAPI
  rapidapi_google: new RapidApiGoogleProvider(), // DEPRECATED: Keeping as fallback
  oxylabs: new OxylabsProvider()
};

// ==========================================
// Smart Provider Selection
// ==========================================
function selectSmartProviders(query, requestedProviders) {
  // Parse providers (could be string or array)
  let providerArray = [];
  if (typeof requestedProviders === 'string') {
    providerArray = requestedProviders.split(',').map(p => p.trim()).filter(Boolean);
  } else if (Array.isArray(requestedProviders)) {
    providerArray = requestedProviders;
  }

  // If user explicitly requested specific providers (not 'auto'), use them
  if (providerArray.length > 0 && !providerArray.includes('auto')) {
    console.log(`[SmartRouting] Manual mode - User requested: ${providerArray.join(', ')}`);
    return providerArray;
  }

  // Smart routing enabled - always use SerpAPI Google Shopping
  // SerpAPI provides rich metadata AND immersive product page tokens for direct merchant links
  console.log(`[SmartRouting] Auto mode - Using SerpAPI Google Shopping`);
  return ['google'];
}

// ==========================================
// Helpers
// ==========================================
function normalizeQuery(q) {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getCacheKey(provider, country, query, limit = 10, page = 1) {
  const hash = crypto.createHash('md5').update(`${provider}:${country}:${normalizeQuery(query)}:${limit}:${page}`).digest('hex');
  // v10: Don't cache empty results, increased timeout to 30s (2026-02-16)
  return `search:v10:${provider}:${country}:${hash}`;
}

async function checkQuota(userId, provider) {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const userKey = `quota:user:${userId}:${today}`;
  const providerKey = `quota:provider:${provider}:${today}`;

  const userQuota = await redis.incr(userKey);
  await redis.expire(userKey, 86400); // 24h

  const providerQuota = await redis.incr(providerKey);
  await redis.expire(providerKey, 86400);

  // Simple limits (adjust as needed)
  const USER_DAILY_LIMIT = 100;
  const PROVIDER_DAILY_LIMIT = 1000;

  if (userQuota > USER_DAILY_LIMIT) {
    throw new Error(`User quota exceeded: ${userQuota}/${USER_DAILY_LIMIT}`);
  }

  if (providerQuota > PROVIDER_DAILY_LIMIT) {
    throw new Error(`Provider quota exceeded: ${providerQuota}/${PROVIDER_DAILY_LIMIT}`);
  }

  return { userQuota, providerQuota };
}

// ==========================================
// Search endpoint
// ==========================================
fastify.post('/search', async (request, reply) => {
  // #region agent log
  console.log('[DEBUG-C] Search worker: Request received', JSON.stringify({
    hasQuery: !!request.body?.query,
    hasUserId: !!request.body?.userId,
    providers: request.body?.providers,
    country: request.body?.country,
    limit: request.body?.limit,
    page: request.body?.page,
    hypothesisId: 'C'
  }));
  // #endregion
  
  const { query, providers: requestedProviders, country = 'US', userId, limit = 20, page = 1, cache_bust } = request.body;

  if (!query || !query.trim()) {
    return reply.code(400).send({ error: 'Missing query' });
  }

  if (!userId) {
    return reply.code(400).send({ error: 'Missing userId' });
  }

  // Use smart provider selection
  const selectedProviders = selectSmartProviders(query, requestedProviders);
  
  console.log(`[Search] Query: "${query}", Selected providers: ${selectedProviders.join(', ')}`);

  // #region agent log
  console.log('[DEBUG-C] Search worker: Providers selected', JSON.stringify({
    selectedProviders: selectedProviders,
    requestedProviders: requestedProviders,
    hypothesisId: 'C'
  }));
  // #endregion

  const results = {
    query,
    country,
    providers: [],
    items: [],
    smartRouting: requestedProviders?.includes('auto') || !requestedProviders
  };

  for (const providerName of selectedProviders) {
    const provider = providers[providerName];
    if (!provider) {
      results.providers.push({ provider: providerName, error: 'Unknown provider' });
      continue;
    }

    const cacheKey = getCacheKey(providerName, country, query, limit, page);

    // Hypothesis C: Is the cache key v7 with page?
    console.log('[DEBUG-C] Cache key generated', JSON.stringify({
      cacheKey: cacheKey,
      providerName: providerName,
      query: query,
      limit: limit,
      page: page
    }));

    // Check for cache_bust parameter to force fresh search
    const cacheBust = cache_bust;
    
    // Check cache first (skip if cache_bust is present)
    const cached = !cacheBust ? await redis.get(cacheKey) : null;
    
    // Hypothesis E: Is old v4 cache being served?
    console.log('[DEBUG-E] Cache lookup result', JSON.stringify({
      hasCached: !!cached,
      cacheKey: cacheKey,
      willUseCached: !!cached
    }));
    
    if (cached) {
      const parsed = JSON.parse(cached);
      results.providers.push({ provider: providerName, cached: true, count: parsed.length });
      results.items.push(...parsed);
      continue;
    }

    // Check quota
    try {
      await checkQuota(userId, providerName);
    } catch (quotaError) {
      results.providers.push({ provider: providerName, error: quotaError.message });
      continue;
    }

    // Search
    try {
      // #region agent log
      const providerStartTime = Date.now();
      console.log('[DEBUG-TIMING] Provider search starting', JSON.stringify({
        provider: providerName,
        query: query,
        timestamp: providerStartTime,
        hypothesisId: 'TIMING'
      }));
      // #endregion
      
      const items = await provider.search(query, { country, limit, page });
      
      // #region agent log
      const providerEndTime = Date.now();
      const providerDuration = providerEndTime - providerStartTime;
      console.log('[DEBUG-TIMING] Provider search completed', JSON.stringify({
        provider: providerName,
        durationMs: providerDuration,
        itemCount: items.length,
        startTime: providerStartTime,
        endTime: providerEndTime,
        hypothesisId: 'TIMING'
      }));
      // #endregion
      
      // Hypothesis D: Log provider search results
      console.log('[DEBUG-D] Provider search completed', JSON.stringify({
        provider: providerName,
        itemCount: items.length,
        firstItem: items[0]?.title || null
      }));
      
      // Cache for 6 hours - but ONLY cache successful results with items
      // Don't cache empty results (timeouts, errors) to allow retry
      if (items.length > 0) {
        await redis.set(cacheKey, JSON.stringify(items), 'EX', 60 * 60 * 6);
        console.log(`[Cache] Cached ${items.length} items for query: "${query}"`);
      } else {
        console.log(`[Cache] Skipping cache for empty result: "${query}"`);
      }

      results.providers.push({ provider: providerName, cached: false, count: items.length });
      results.items.push(...items);
    } catch (error) {
      // Hypothesis B: Log provider search errors
      console.log('[DEBUG-B] Provider search error', JSON.stringify({
        provider: providerName,
        errorMsg: error.message
      }));
      results.providers.push({ provider: providerName, error: error.message });
    }
  }

  // Optional: save snapshot to Supabase
  console.log('[DEBUG-M] Before DB save check', JSON.stringify({
    hasItems: results.items.length > 0,
    itemCount: results.items.length,
    hasSupabase: !!supabase,
    userId: userId,
    query: query,
    hypothesisId: 'M'
  }));
  
  if (results.items.length > 0 && supabase) {
    try {
      console.log('[DEBUG-M] Attempting DB insert', JSON.stringify({
        userId: userId,
        query: query,
        itemCount: results.items.length,
        providers: requestedProviders,
        hypothesisId: 'M'
      }));
      
      const insertResult = await supabase.from('search_snapshots').insert([{
        user_id: userId,
        query,
        providers: requestedProviders,
        result: results,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
      }]);
      
      console.log('[DEBUG-M,Q] DB insert result', JSON.stringify({
        hasError: !!insertResult.error,
        errorMsg: insertResult.error?.message || null,
        errorDetails: insertResult.error?.details || null,
        status: insertResult.status,
        statusText: insertResult.statusText,
        hypothesisId: 'M,Q'
      }));
    } catch (error) {
      console.error('[DEBUG-M,Q] DB insert exception', JSON.stringify({
        errorMsg: error.message,
        errorStack: error.stack?.slice(0, 200),
        hypothesisId: 'M,Q'
      }));
      console.error('[Search Worker] Failed to save search snapshot:', error);
    }
  } else {
    console.log('[DEBUG-M,P] DB save skipped', JSON.stringify({
      hasItems: results.items.length > 0,
      itemCount: results.items.length,
      hasSupabase: !!supabase,
      reason: results.items.length === 0 ? 'no_items' : 'no_supabase',
      hypothesisId: 'M,P'
    }));
  }

  // #region agent log
  console.log('[DEBUG-D] Search worker: Final response', JSON.stringify({
    totalItems: results.items.length,
    providerCount: results.providers.length,
    providers: results.providers,
    firstItemTitle: results.items[0]?.title || null,
    hypothesisId: 'D'
  }));
  // #endregion

  return results;
});

// ==========================================
// Get product merchant offers endpoint
// ==========================================
fastify.post('/product-offers', async (request, reply) => {
  console.log('[Product Offers] Request received');
  
  const { immersive_product_page_token, userId } = request.body;

  if (!immersive_product_page_token) {
    return reply.code(400).send({ error: 'Missing immersive_product_page_token' });
  }

  if (!userId) {
    return reply.code(400).send({ error: 'Missing userId' });
  }

  // Check cache first
  const cacheKey = `product:offers:${crypto.createHash('md5').update(immersive_product_page_token).digest('hex')}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    console.log('[Product Offers] Cache HIT');
    return JSON.parse(cached);
  }

  console.log('[Product Offers] Cache MISS - fetching from API');

  try {
    // Use SerpAPI Google Shopping provider to get merchant offers
    const googleProvider = providers.google;
    
    if (!googleProvider || !(googleProvider instanceof SerpApiGoogleProvider)) {
      return reply.code(500).send({ error: 'Google provider not available' });
    }

    const offers = await googleProvider.getProductOffers(immersive_product_page_token);
    
    console.log(`[Product Offers] Fetched ${offers.length} merchant offers`);

    const response = {
      token: immersive_product_page_token,
      offers: offers
    };

    // Cache for 24 hours
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 60 * 60 * 24);

    return response;
    
  } catch (error) {
    console.error('[Product Offers] Error:', error.message);
    return reply.code(500).send({ error: error.message });
  }
});

// ==========================================
// Health check
// ==========================================
fastify.get('/health', async () => {
  return { status: 'ok', service: 'orben-search-worker', ts: new Date().toISOString() };
});

// ==========================================
// Admin: Flush cache
// ==========================================
fastify.post('/admin/flush-cache', async (request, reply) => {
  const { queries } = request.body;
  
  if (!Array.isArray(queries) || queries.length === 0) {
    return reply.code(400).send({ error: 'queries array required' });
  }
  
  const flushed = [];
  for (const query of queries) {
    // Flush both v5 (old) and v6 (new) cache keys for all common limits
    const limits = [10, 20, 50];
    for (const limit of limits) {
      // v6 with limit
      const cacheKeyV6 = getCacheKey('google', 'US', query, limit);
      const resultV6 = await redis.del(cacheKeyV6);
      if (resultV6 === 1) {
        flushed.push({ query, limit, cacheKey: cacheKeyV6, deleted: true });
      }
    }
    
    // Also flush old v5 cache (without limit) for backward compatibility
    const hashV5 = crypto.createHash('md5').update(`google:US:${query.toLowerCase().trim()}`).digest('hex');
    const cacheKeyV5 = `search:v5:google:US:${hashV5}`;
    const resultV5 = await redis.del(cacheKeyV5);
    if (resultV5 === 1) {
      flushed.push({ query, limit: 'v5_any', cacheKey: cacheKeyV5, deleted: true });
    }
  }
  
  return { ok: true, flushed };
});

// ==========================================
// Admin: Flush ALL cache (emergency use)
// ==========================================
fastify.post('/admin/flush-all-cache', async (request, reply) => {
  try {
    console.log('[Admin] Flushing ALL Redis cache keys...');
    await redis.flushall();
    console.log('[Admin] Redis cache flushed successfully');
    return { ok: true, message: 'All cache keys flushed' };
  } catch (error) {
    console.error('[Admin] Error flushing cache:', error);
    return reply.code(500).send({ error: error.message });
  }
});

// ==========================================
// Start server
// ==========================================
const PORT = process.env.PORT || 8081;

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🔍 Orben Search Worker listening on port ${PORT}`);
});
