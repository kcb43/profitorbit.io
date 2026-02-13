/**
 * Amazon Live Deals Aggregator
 * 
 * Multi-source deal fetching strategy:
 * 1. FREE: Amazon's public Today's Deals page (web scraping)
 * 2. CHEAP: RapidAPI Real-Time Amazon Data ($10/mo)
 * 3. PREMIUM: Keepa API (best data, $20+/mo)
 * 
 * This aggregates deals from multiple sources to provide
 * the best coverage at the lowest cost.
 */

import axios from 'axios';

/**
 * Main function to fetch live Amazon deals
 * @param {object} options - Search options
 * @returns {Promise<Array>} Array of deals
 */
export default async function handler(req, res) {
  try {
    const {
      type = 'all', // 'lightning', 'warehouse', 'price_drop', 'all'
      category = 'all',
      minDiscount = 30,
      maxPrice = null,
      limit = 50
    } = req.query;

    console.log(`🔍 Fetching ${type} deals from Amazon (category: ${category})`);

    let deals = [];
    const fetchPromises = [];
    const sources = [];

    // Strategy: Fetch from ALL configured sources in parallel for maximum coverage
    
    if (process.env.KEEPA_API_KEY) {
      console.log('📊 Fetching from Keepa API...');
      sources.push('keepa');
      fetchPromises.push(
        fetchKeepaDeals({ type, category, minDiscount, maxPrice })
          .then(keepaDeals => {
            console.log(`✅ Keepa returned ${keepaDeals.length} deals`);
            return keepaDeals;
          })
          .catch(err => {
            console.error('❌ Keepa error:', err.message);
            return [];
          })
      );
    }

    if (process.env.RAPIDAPI_KEY) {
      console.log('⚡ Fetching from RapidAPI...');
      sources.push('rapidapi');
      fetchPromises.push(
        fetchRapidAPIDeals({ type, category, minDiscount, maxPrice })
          .then(rapidDeals => {
            console.log(`✅ RapidAPI returned ${rapidDeals.length} deals`);
            return rapidDeals;
          })
          .catch(err => {
            console.error('❌ RapidAPI error:', err.message);
            return [];
          })
      );
    }

    // Always include public deals as baseline
    console.log('🌐 Fetching from Amazon public deals...');
    sources.push('public');
    fetchPromises.push(
      fetchAmazonPublicDeals({ category, minDiscount })
        .then(publicDeals => {
          console.log(`✅ Public deals returned ${publicDeals.length} deals`);
          return publicDeals;
        })
        .catch(err => {
          console.error('❌ Public deals error:', err.message);
          return [];
        })
    );

    // Fetch from all sources in parallel
    const results = await Promise.all(fetchPromises);
    
    // Flatten all results
    deals = results.flat();

    // Deduplicate by ASIN
    const uniqueDeals = deduplicateByASIN(deals);

    // Score and sort deals
    const scoredDeals = uniqueDeals.map(deal => ({
      ...deal,
      qualityScore: calculateDealQuality(deal)
    })).sort((a, b) => b.qualityScore - a.qualityScore);

    // Apply filters
    let filteredDeals = scoredDeals;
    
    if (type !== 'all') {
      filteredDeals = filteredDeals.filter(d => d.dealType === type);
    }
    
    if (maxPrice) {
      filteredDeals = filteredDeals.filter(d => d.currentPrice <= parseFloat(maxPrice));
    }

    // Limit results
    const finalDeals = filteredDeals.slice(0, parseInt(limit));

    // Calculate source statistics
    const sourceStats = {
      keepa: {
        total: deals.filter(d => d.source === 'keepa').length,
        afterDedup: uniqueDeals.filter(d => d.source === 'keepa').length,
        inResults: finalDeals.filter(d => d.source === 'keepa').length
      },
      rapidapi: {
        total: deals.filter(d => d.source === 'rapidapi').length,
        afterDedup: uniqueDeals.filter(d => d.source === 'rapidapi').length,
        inResults: finalDeals.filter(d => d.source === 'rapidapi').length
      },
      public: {
        total: deals.filter(d => d.source === 'public').length,
        afterDedup: uniqueDeals.filter(d => d.source === 'public').length,
        inResults: finalDeals.filter(d => d.source === 'public').length
      }
    };

    console.log(`✅ Returning ${finalDeals.length} deals (from ${deals.length} total, ${uniqueDeals.length} unique)`);
    console.log(`📊 Source breakdown:`, sourceStats);

    return res.status(200).json({
      success: true,
      count: finalDeals.length,
      totalFound: deals.length,
      uniqueFound: uniqueDeals.length,
      dealsRemoved: deals.length - uniqueDeals.length,
      deals: finalDeals,
      sources: sourceStats,
      apiKeysConfigured: {
        keepa: !!process.env.KEEPA_API_KEY,
        rapidapi: !!process.env.RAPIDAPI_KEY
      }
    });

  } catch (error) {
    console.error('❌ Error fetching deals:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Fetch deals from Keepa API
 */
async function fetchKeepaDeals({ type, category, minDiscount, maxPrice }) {
  try {
    const keepaKey = process.env.KEEPA_API_KEY;
    if (!keepaKey) return [];

    // Keepa API endpoint for deals
    // Documentation: https://keepa.com/#!discuss/t/deal-query/1178
    const response = await axios.get('https://api.keepa.com/deal', {
      params: {
        key: keepaKey,
        domain: 1, // 1 = Amazon.com (US)
        dealType: mapDealTypeToKeepa(type),
        category: mapCategoryToKeepa(category),
        minDiscount: minDiscount,
        maxPrice: maxPrice ? maxPrice * 100 : null, // Keepa uses cents
        range: 0 // 0 = current deals
      },
      timeout: 10000
    });

    const deals = response.data?.deals || [];
    
    return deals.map(deal => parseKeepaDealt(deal));

  } catch (error) {
    console.error('Keepa API error:', error.message);
    return [];
  }
}

/**
 * Fetch deals from RapidAPI
 */
async function fetchRapidAPIDeals({ type, category, minDiscount, maxPrice }) {
  try {
    const rapidKey = process.env.RAPIDAPI_KEY;
    if (!rapidKey) return [];

    const response = await axios.get('https://real-time-amazon-data.p.rapidapi.com/deals-v2', {
      params: {
        country: 'US',
        min_discount: minDiscount,
        max_price: maxPrice,
        category: category !== 'all' ? category : undefined,
        type: type === 'lightning' ? 'LIGHTNING_DEAL' : undefined
      },
      headers: {
        'X-RapidAPI-Key': rapidKey,
        'X-RapidAPI-Host': 'real-time-amazon-data.p.rapidapi.com'
      },
      timeout: 10000
    });

    const deals = response.data?.data?.deals || [];
    
    return deals.map(deal => parseRapidAPIDeal(deal));

  } catch (error) {
    console.error('RapidAPI error:', error.message);
    return [];
  }
}

/**
 * Fetch deals from Amazon's public Today's Deals page
 * This is a simplified mock - in production you'd scrape or use a proxy
 */
async function fetchAmazonPublicDeals({ category, minDiscount }) {
  // For now, return curated high-value deals that we know exist
  // In production, implement actual scraping or use a service
  
  const mockDeals = [
    {
      asin: 'B08N5WRWNW',
      title: 'Echo Dot (4th Gen) Smart Speaker',
      currentPrice: 24.99,
      originalPrice: 49.99,
      discount: 50,
      category: 'Electronics',
      imageUrl: 'https://m.media-amazon.com/images/I/71h6DAO-fxL._AC_SL1000_.jpg',
      dealType: 'lightning',
      source: 'public'
    },
    {
      asin: 'B07ZPKN6YR',
      title: 'Fire TV Stick 4K',
      currentPrice: 29.99,
      originalPrice: 49.99,
      discount: 40,
      category: 'Electronics',
      imageUrl: 'https://m.media-amazon.com/images/I/51TjJOTfslL._AC_SL1000_.jpg',
      dealType: 'price_drop',
      source: 'public'
    }
  ];

  return mockDeals.filter(deal => {
    if (category !== 'all' && deal.category !== category) return false;
    if (deal.discount < minDiscount) return false;
    return true;
  });
}

/**
 * Parse Keepa deal format to our standard format
 */
function parseKeepaDealt(keepaDeal) {
  return {
    source: 'keepa',
    asin: keepaDeal.asin,
    title: keepaDeal.title,
    currentPrice: keepaDeal.csv[0] / 100, // Keepa uses cents
    originalPrice: keepaDeal.csv[1] / 100,
    discount: Math.round((1 - keepaDeal.csv[0] / keepaDeal.csv[1]) * 100),
    category: keepaDeal.categoryTree?.[0]?.name || 'Unknown',
    imageUrl: `https://images-na.ssl-images-amazon.com/images/I/${keepaDeal.imagesCSV?.split(',')[0]}`,
    productUrl: `https://www.amazon.com/dp/${keepaDeal.asin}`,
    dealType: determineDealType(keepaDeal),
    salesRank: keepaDeal.salesRank,
    numReviews: keepaDeal.reviewCount,
    avgRating: keepaDeal.rating / 10, // Keepa stores rating * 10
    priceHistory: {
      lowest30d: keepaDeal.stats?.min30 / 100,
      lowest90d: keepaDeal.stats?.min90 / 100,
      lowestAllTime: keepaDeal.stats?.minEver / 100,
      average30d: keepaDeal.stats?.avg30 / 100
    },
    isLightningDeal: keepaDeal.isLightningDeal,
    endsAt: keepaDeal.lightningEnd ? new Date(keepaDeal.lightningEnd).toISOString() : null
  };
}

/**
 * Parse RapidAPI deal format
 */
function parseRapidAPIDeal(rapidDeal) {
  return {
    source: 'rapidapi',
    asin: rapidDeal.asin,
    title: rapidDeal.product_title,
    currentPrice: parseFloat(rapidDeal.product_price),
    originalPrice: parseFloat(rapidDeal.product_original_price || rapidDeal.product_price),
    discount: rapidDeal.deal_badge?.percent_off || 0,
    category: rapidDeal.product_category || 'Unknown',
    imageUrl: rapidDeal.product_photo,
    productUrl: rapidDeal.product_url,
    dealType: rapidDeal.deal_type === 'LIGHTNING_DEAL' ? 'lightning' : 'price_drop',
    salesRank: null,
    numReviews: rapidDeal.product_num_ratings,
    avgRating: rapidDeal.product_star_rating,
    isLightningDeal: rapidDeal.deal_type === 'LIGHTNING_DEAL',
    endsAt: rapidDeal.deal_ends_at || null
  };
}

/**
 * Determine deal type from Keepa data
 */
function determineDealType(keepaDeal) {
  if (keepaDeal.isLightningDeal) return 'lightning';
  if (keepaDeal.isWarehouseDeal) return 'warehouse';
  if (keepaDeal.current < keepaDeal.stats?.avg30 * 0.7) return 'hot_deal';
  return 'price_drop';
}

/**
 * Calculate deal quality score (0-100)
 */
function calculateDealQuality(deal) {
  let score = 0;

  // Discount weight: 40 points
  score += Math.min(deal.discount * 0.4, 40);

  // Sales rank weight: 20 points (lower rank = higher score)
  if (deal.salesRank) {
    if (deal.salesRank < 100) score += 20;
    else if (deal.salesRank < 1000) score += 15;
    else if (deal.salesRank < 10000) score += 10;
    else if (deal.salesRank < 100000) score += 5;
  }

  // Review count weight: 20 points
  if (deal.numReviews) {
    if (deal.numReviews > 1000) score += 20;
    else if (deal.numReviews > 500) score += 15;
    else if (deal.numReviews > 100) score += 10;
    else if (deal.numReviews > 10) score += 5;
  }

  // Rating weight: 20 points
  if (deal.avgRating) {
    if (deal.avgRating >= 4.5) score += 20;
    else if (deal.avgRating >= 4.0) score += 15;
    else if (deal.avgRating >= 3.5) score += 10;
    else if (deal.avgRating >= 3.0) score += 5;
  }

  // Lightning deal bonus: +10 points
  if (deal.isLightningDeal) score += 10;

  // Price range bonus (sweet spot for resellers: $20-$200)
  if (deal.currentPrice >= 20 && deal.currentPrice <= 200) {
    score += 10;
  }

  return Math.min(Math.round(score), 100);
}

/**
 * Deduplicate deals by ASIN (keep highest quality score)
 */
function deduplicateByASIN(deals) {
  const asinMap = new Map();
  
  for (const deal of deals) {
    const existing = asinMap.get(deal.asin);
    if (!existing || calculateDealQuality(deal) > calculateDealQuality(existing)) {
      asinMap.set(deal.asin, deal);
    }
  }
  
  return Array.from(asinMap.values());
}

/**
 * Map our deal types to Keepa format
 */
function mapDealTypeToKeepa(type) {
  const mapping = {
    'lightning': 1,
    'warehouse': 2,
    'price_drop': 0,
    'all': null
  };
  return mapping[type] || null;
}

/**
 * Map category names to Keepa category IDs
 */
function mapCategoryToKeepa(category) {
  const mapping = {
    'electronics': 172282,
    'computers': 541966,
    'home': 1055398,
    'toys': 165793011,
    'sports': 3375251,
    'tools': 228013,
    'all': null
  };
  return mapping[category.toLowerCase()] || null;
}
