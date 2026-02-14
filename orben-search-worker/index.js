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
 */

import Fastify from 'fastify';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import axios from 'axios';
import crypto from 'crypto';
import 'dotenv/config';

// ==========================================
// Initialize
// ==========================================
const fastify = Fastify({ logger: true });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
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
// RapidAPI Google Shopping Provider
// ==========================================
class RapidApiGoogleProvider extends SearchProvider {
  constructor() {
    super('google');
    this.apiKey = process.env.RAPIDAPI_KEY;
  }

  async search(query, opts = {}) {
    // #region agent log
    const fs = require('fs'); const logPath = 'f:\\bareretail\\.cursor\\debug.log'; try { fs.appendFileSync(logPath, JSON.stringify({location:'index.js:172',message:'RapidAPI search entry',data:{hasApiKey:!!this.apiKey,keyLength:this.apiKey?.length||0,query:query,opts:opts},timestamp:Date.now(),runId:'search',hypothesisId:'A'})+'\n'); } catch(e) {}
    // #endregion
    
    if (!this.apiKey) {
      console.warn('[Google/RapidAPI] No API key configured');
      // #region agent log
      try { fs.appendFileSync(logPath, JSON.stringify({location:'index.js:174',message:'No API key - returning empty',data:{env_key_exists:!!process.env.RAPIDAPI_KEY},timestamp:Date.now(),runId:'search',hypothesisId:'A'})+'\n'); } catch(e) {}
      // #endregion
      return [];
    }

    const { country = 'US', limit = 20 } = opts;

    try {
      // Using Real-Time Product Search API v2 on RapidAPI
      console.log(`[Google/RapidAPI] Searching for: "${query}"`);
      
      // #region agent log
      try { fs.appendFileSync(logPath, JSON.stringify({location:'index.js:183',message:'Making RapidAPI request',data:{query:query,country:country,limit:limit},timestamp:Date.now(),runId:'search',hypothesisId:'B'})+'\n'); } catch(e) {}
      // #endregion
      
      const response = await axios.get('https://real-time-product-search.p.rapidapi.com/search-v2', {
        params: {
          q: query,
          country: country.toLowerCase(),
          language: 'en',
          page: 1,
          limit: Math.min(limit, 50), // Support up to 50 results
          sort_by: 'BEST_MATCH',
          product_condition: 'ANY'
        },
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'real-time-product-search.p.rapidapi.com'
        },
        timeout: 15000
      });

      // #region agent log
      const fs = require('fs'); const logPath = 'f:\\bareretail\\.cursor\\debug.log'; try { fs.appendFileSync(logPath, JSON.stringify({location:'index.js:199',message:'RapidAPI response received',data:{statusCode:response.status,dataStatus:response.data?.status,hasData:!!response.data,hasProducts:!!(response.data?.data?.products),productCount:response.data?.data?.products?.length||0},timestamp:Date.now(),runId:'search',hypothesisId:'D'})+'\n'); } catch(e) {}
      // #endregion

      console.log(`[Google/RapidAPI] Response status: ${response.data?.status}`);
      
      const products = response.data?.data?.products || [];
      
      // #region agent log
      try { fs.appendFileSync(logPath, JSON.stringify({location:'index.js:205',message:'Products extracted',data:{productCount:products.length,firstProductTitle:products[0]?.product_title||null},timestamp:Date.now(),runId:'search',hypothesisId:'D'})+'\n'); } catch(e) {}
      // #endregion
      
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
      // #region agent log
      const fs = require('fs'); const logPath = 'f:\\bareretail\\.cursor\\debug.log'; try { fs.appendFileSync(logPath, JSON.stringify({location:'index.js:228',message:'RapidAPI error caught',data:{errorMessage:error.message,hasResponse:!!error.response,statusCode:error.response?.status||null,responseData:error.response?.data?JSON.stringify(error.response.data).slice(0,200):null},timestamp:Date.now(),runId:'search',hypothesisId:'B'})+'\n'); } catch(e) {}
      // #endregion
      
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
  google: new RapidApiGoogleProvider(),
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

  // Smart routing enabled - always use RapidAPI Google Shopping
  // (Oxylabs google_shopping_search not in plan, amazon_search too slow)
  console.log(`[SmartRouting] Auto mode - Using RapidAPI Google Shopping`);
  return ['google'];
}

// ==========================================
// Helpers
// ==========================================
function normalizeQuery(q) {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getCacheKey(provider, country, query) {
  const hash = crypto.createHash('md5').update(`${provider}:${country}:${normalizeQuery(query)}`).digest('hex');
  // v5: Cache bust after RapidAPI key configured (2026-02-14)
  return `search:v5:${provider}:${country}:${hash}`;
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
  const { query, providers: requestedProviders, country = 'US', userId, limit = 20 } = request.body;

  if (!query || !query.trim()) {
    return reply.code(400).send({ error: 'Missing query' });
  }

  if (!userId) {
    return reply.code(400).send({ error: 'Missing userId' });
  }

  // Use smart provider selection
  const selectedProviders = selectSmartProviders(query, requestedProviders);
  
  console.log(`[Search] Query: "${query}", Selected providers: ${selectedProviders.join(', ')}`);

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

    const cacheKey = getCacheKey(providerName, country, query);

    // #region agent log
    const fs = require('fs'); const logPath = 'f:\\bareretail\\.cursor\\debug.log'; try { fs.appendFileSync(logPath, JSON.stringify({location:'index.js:463',message:'Cache key generated',data:{cacheKey:cacheKey,providerName:providerName,query:query},timestamp:Date.now(),runId:'search',hypothesisId:'C'})+'\n'); } catch(e) {}
    // #endregion

    // Check cache first
    const cached = await redis.get(cacheKey);
    
    // #region agent log
    try { fs.appendFileSync(logPath, JSON.stringify({location:'index.js:467',message:'Cache lookup result',data:{hasCached:!!cached,cacheKey:cacheKey,willUseCached:!!cached},timestamp:Date.now(),runId:'search',hypothesisId:'E'})+'\n'); } catch(e) {}
    // #endregion
    
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
      const items = await provider.search(query, { country, limit });
      
      // #region agent log
      const fs = require('fs'); const logPath = 'f:\\bareretail\\.cursor\\debug.log'; try { fs.appendFileSync(logPath, JSON.stringify({location:'index.js:484',message:'Provider search completed',data:{provider:providerName,itemCount:items.length,firstItem:items[0]?.title||null},timestamp:Date.now(),runId:'search',hypothesisId:'D'})+'\n'); } catch(e) {}
      // #endregion
      
      // Cache for 6 hours
      await redis.set(cacheKey, JSON.stringify(items), 'EX', 60 * 60 * 6);

      results.providers.push({ provider: providerName, cached: false, count: items.length });
      results.items.push(...items);
    } catch (error) {
      // #region agent log
      try { fs.appendFileSync(logPath, JSON.stringify({location:'index.js:491',message:'Provider search error',data:{provider:providerName,errorMsg:error.message},timestamp:Date.now(),runId:'search',hypothesisId:'B'})+'\n'); } catch(e) {}
      // #endregion
      results.providers.push({ provider: providerName, error: error.message });
    }
  }

  // Optional: save snapshot to Supabase
  if (results.items.length > 0) {
    await supabase.from('search_snapshots').insert([{
      user_id: userId,
      query,
      providers: requestedProviders,
      result: results,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
    }]);
  }

  return results;
});

// ==========================================
// Health check
// ==========================================
fastify.get('/health', async () => {
  return { status: 'ok', service: 'orben-search-worker', ts: new Date().toISOString() };
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
