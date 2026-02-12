import { createClient } from '@supabase/supabase-js';
import { scrapeProducts } from './scraper.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Product Search API Endpoint
 * POST /api/product-search/search
 * 
 * Searches products across all marketplaces using Google Shopping
 * Implements smart caching to reduce scraping load
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, filters = {}, useCache = true } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log('🔍 Product search request:', { query, filters });

    // Generate cache key
    const cacheKey = JSON.stringify({ query: query.toLowerCase().trim(), filters });

    // Check cache first (if enabled)
    if (useCache) {
      const { data: cachedResult } = await supabase
        .from('product_search_cache')
        .select('*')
        .eq('search_query', query.toLowerCase().trim())
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (cachedResult) {
        console.log('✅ Cache hit! Returning cached results');
        return res.status(200).json({
          ...cachedResult.results,
          fromCache: true,
          cachedAt: cachedResult.created_at
        });
      }
    }

    console.log('⚡ Cache miss, scraping fresh data...');

    // Scrape products
    const scrapedData = await scrapeProducts(query, {
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      condition: filters.condition || 'all',
      sortBy: filters.sortBy || 'relevance',
      maxResults: filters.maxResults || 50,
      marketplaces: filters.marketplaces || ['all']
    });

    if (!scrapedData.success) {
      return res.status(500).json({
        error: 'Failed to scrape product data',
        details: scrapedData.error
      });
    }

    // Apply post-scrape filters
    let filteredProducts = scrapedData.products;

    // Filter by marketplace
    if (filters.marketplaces && !filters.marketplaces.includes('all')) {
      filteredProducts = filteredProducts.filter(p =>
        filters.marketplaces.includes(p.marketplace)
      );
    }

    // Filter by discount percentage
    if (filters.minDiscount) {
      filteredProducts = filteredProducts.filter(p =>
        p.discountPercentage >= filters.minDiscount
      );
    }

    // Filter by rating
    if (filters.minRating) {
      filteredProducts = filteredProducts.filter(p =>
        p.rating && p.rating >= filters.minRating
      );
    }

    // Sort results
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'price_low':
          filteredProducts.sort((a, b) => a.price - b.price);
          break;
        case 'price_high':
          filteredProducts.sort((a, b) => b.price - a.price);
          break;
        case 'discount':
          filteredProducts.sort((a, b) => b.discountPercentage - a.discountPercentage);
          break;
        case 'rating':
          filteredProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        case 'marketplace':
          filteredProducts.sort((a, b) => a.marketplace.localeCompare(b.marketplace));
          break;
      }
    }

    // Calculate stats
    const marketplaceCounts = filteredProducts.reduce((acc, p) => {
      acc[p.marketplace] = (acc[p.marketplace] || 0) + 1;
      return acc;
    }, {});

    const priceStats = {
      lowest: Math.min(...filteredProducts.map(p => p.price)),
      highest: Math.max(...filteredProducts.map(p => p.price)),
      average: (filteredProducts.reduce((sum, p) => sum + p.price, 0) / filteredProducts.length).toFixed(2),
      median: filteredProducts.length > 0
        ? filteredProducts.sort((a, b) => a.price - b.price)[Math.floor(filteredProducts.length / 2)].price
        : 0
    };

    const response = {
      success: true,
      query,
      totalResults: filteredProducts.length,
      products: filteredProducts,
      stats: {
        marketplaceCounts,
        priceStats,
        averageDiscount: filteredProducts.length > 0
          ? (filteredProducts.reduce((sum, p) => sum + p.discountPercentage, 0) / filteredProducts.length).toFixed(1)
          : 0
      },
      source: scrapedData.source,
      scrapedAt: scrapedData.scrapedAt,
      fromCache: false
    };

    // Cache the results (1 hour TTL)
    try {
      await supabase.from('product_search_cache').insert({
        search_query: query.toLowerCase().trim(),
        search_filters: filters,
        results: response,
        api_source: scrapedData.source,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      });
      console.log('💾 Cached search results');
    } catch (cacheError) {
      console.error('⚠️ Failed to cache results:', cacheError);
      // Don't fail the request if caching fails
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Product search error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
