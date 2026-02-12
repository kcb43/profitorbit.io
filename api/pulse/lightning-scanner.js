/**
 * Lightning Deal Scanner
 * Based on Amazon-Deal-Monitor GitHub repo
 * 
 * Scans for time-sensitive Lightning Deals
 * Tracks expiration times and stock levels
 * Sends instant notifications for urgent deals
 */

import axios from 'axios';

/**
 * Scan for active Lightning Deals
 * @param {object} options - Search options
 * @returns {Promise<Array>} Array of lightning deals
 */
export async function scanLightningDeals(options = {}) {
  try {
    const {
      category = 'all',
      minDiscount = 50,
      maxPrice = null
    } = options;

    console.log(`⚡ Scanning lightning deals (category: ${category}, min discount: ${minDiscount}%)`);

    // Strategy 1: Use RapidAPI Lightning Deals endpoint
    if (process.env.RAPIDAPI_KEY) {
      return await scanViaRapidAPI(category, minDiscount, maxPrice);
    }

    // Strategy 2: Use Amazon's Today's Deals page
    // In production, you'd scrape or use API
    console.log('⚠️ Lightning deal scanning requires RapidAPI key');
    return [];

  } catch (error) {
    console.error('❌ Lightning deal scan error:', error.message);
    return [];
  }
}

/**
 * Scan lightning deals via RapidAPI
 */
async function scanViaRapidAPI(category, minDiscount, maxPrice) {
  try {
    const response = await axios.get('https://real-time-amazon-data.p.rapidapi.com/deals', {
      params: {
        country: 'US',
        type: 'LIGHTNING_DEAL',
        min_discount: minDiscount,
        category: category !== 'all' ? category : undefined
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'real-time-amazon-data.p.rapidapi.com'
      },
      timeout: 15000
    });

    const deals = response.data?.data?.deals || [];
    
    return deals
      .filter(deal => {
        // Filter by price if specified
        if (maxPrice && deal.price > maxPrice) return false;
        
        // Must have end time
        if (!deal.ends_at && !deal.end_time) return false;
        
        return true;
      })
      .map(deal => parseLightningDeal(deal));

  } catch (error) {
    console.error('RapidAPI lightning deal error:', error.message);
    return [];
  }
}

/**
 * Parse lightning deal from API response
 */
function parseLightningDeal(dealData) {
  const now = new Date();
  const endsAt = new Date(dealData.ends_at || dealData.end_time);
  const timeRemainingMs = endsAt - now;
  const timeRemainingMinutes = Math.floor(timeRemainingMs / (1000 * 60));

  // Calculate price and discount
  const price = parseFloat(dealData.deal_price || dealData.price);
  const originalPrice = parseFloat(dealData.list_price || dealData.original_price || price);
  const savings = originalPrice - price;
  const percentOff = Math.round((savings / originalPrice) * 100);

  return {
    productId: dealData.asin || dealData.product_id,
    productName: dealData.title || dealData.product_title,
    productUrl: dealData.product_url || `https://www.amazon.com/dp/${dealData.asin}`,
    productImageUrl: dealData.image || dealData.product_photo,
    category: dealData.category || 'Other',
    price,
    originalPrice,
    savings,
    percentOff,
    endsAt: endsAt.toISOString(),
    timeRemainingMinutes,
    timeRemaining: formatTimeRemaining(timeRemainingMinutes),
    percentClaimed: dealData.percent_claimed || dealData.percentage_claimed || 0,
    isActive: timeRemainingMinutes > 0,
    detectedAt: new Date().toISOString()
  };
}

/**
 * Format time remaining in human-readable format
 */
function formatTimeRemaining(minutes) {
  if (minutes <= 0) return 'Expired';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}m`;
  }
}

/**
 * Calculate urgency level based on time remaining
 */
export function calculateUrgency(timeRemainingMinutes) {
  if (timeRemainingMinutes <= 0) return 'expired';
  if (timeRemainingMinutes <= 30) return 'critical'; // Less than 30 min
  if (timeRemainingMinutes <= 60) return 'high';     // Less than 1 hour
  if (timeRemainingMinutes <= 360) return 'medium';  // Less than 6 hours
  return 'low';
}

/**
 * Store lightning deal in database
 */
export async function storeLightningDeal(supabase, deal) {
  try {
    const { data, error } = await supabase
      .from('lightning_deals')
      .upsert({
        product_id: deal.productId,
        product_name: deal.productName,
        product_url: deal.productUrl,
        product_image_url: deal.productImageUrl,
        category: deal.category,
        price: deal.price,
        original_price: deal.originalPrice,
        savings: deal.savings,
        percent_off: deal.percentOff,
        ends_at: deal.endsAt,
        time_remaining_minutes: deal.timeRemainingMinutes,
        percent_claimed: deal.percentClaimed,
        detected_at: deal.detectedAt,
        is_active: deal.isActive,
        last_checked_at: new Date().toISOString()
      }, {
        onConflict: 'product_id',
        ignoreDuplicates: false
      });

    if (error) throw error;
    return data;

  } catch (error) {
    console.error('Error storing lightning deal:', error);
    throw error;
  }
}

/**
 * Update time remaining for all active lightning deals
 */
export async function updateLightningDealsTimeRemaining(supabase) {
  try {
    const { data, error } = await supabase.rpc('update_lightning_deal_time_remaining');
    
    if (error) throw error;
    
    console.log('✅ Updated lightning deal time remaining');
    return data;

  } catch (error) {
    console.error('Error updating lightning deals:', error);
    throw error;
  }
}

/**
 * Match lightning deals to user watchlists
 */
export async function matchLightningDealsToWatchlists(supabase, lightningDeals) {
  try {
    // Get all active watchlists
    const { data: watchlists, error } = await supabase
      .from('price_watchlist')
      .select('*')
      .eq('notify_on_drop', true);

    if (error) throw error;

    const matches = [];

    for (const deal of lightningDeals) {
      // Find watchlists that match this product
      const matchedWatchlists = watchlists.filter(w => {
        // Check if product URL or name matches
        const urlMatch = w.product_url && w.product_url.includes(deal.productId);
        const nameMatch = w.product_name && 
          deal.productName.toLowerCase().includes(w.product_name.toLowerCase());
        
        return urlMatch || nameMatch;
      });

      for (const watchlist of matchedWatchlists) {
        // Create deal alert
        matches.push({
          userId: watchlist.user_id,
          watchlistId: watchlist.id,
          deal,
          urgency: calculateUrgency(deal.timeRemainingMinutes)
        });
      }
    }

    console.log(`✅ Matched ${matches.length} lightning deals to watchlists`);
    return matches;

  } catch (error) {
    console.error('Error matching lightning deals:', error);
    return [];
  }
}

/**
 * Create deal alerts for matched lightning deals
 */
export async function createLightningDealAlerts(supabase, matches) {
  const alerts = [];

  for (const match of matches) {
    try {
      const { data, error } = await supabase
        .from('deal_alerts')
        .insert({
          user_id: match.userId,
          watchlist_id: match.watchlistId,
          deal_type: 'lightning',
          category: match.deal.category,
          product_name: match.deal.productName,
          product_url: match.deal.productUrl,
          product_image_url: match.deal.productImageUrl,
          current_price: match.deal.price,
          original_price: match.deal.originalPrice,
          discount_percentage: match.deal.percentOff,
          savings_amount: match.deal.savings,
          time_remaining: match.deal.timeRemaining,
          expires_at: match.deal.endsAt,
          alert_reason: `⚡ Lightning Deal! Only ${match.deal.timeRemaining} remaining!`,
          deal_quality_score: calculateLightningScore(match.deal.percentOff, match.deal.timeRemainingMinutes),
          is_read: false
        });

      if (error) throw error;
      alerts.push(data);

    } catch (error) {
      console.error('Error creating lightning deal alert:', error);
    }
  }

  return alerts;
}

/**
 * Calculate quality score for lightning deals
 */
function calculateLightningScore(percentOff, timeRemainingMinutes) {
  let score = percentOff; // Base score from discount

  // Urgency bonus (more points for less time)
  if (timeRemainingMinutes <= 30) {
    score += 25; // Critical urgency!
  } else if (timeRemainingMinutes <= 60) {
    score += 20;
  } else if (timeRemainingMinutes <= 360) {
    score += 15;
  } else {
    score += 10;
  }

  return Math.min(score, 100);
}

export { formatTimeRemaining };
