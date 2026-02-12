/**
 * Coupon Deal Detector
 * Based on Amazon-Deal-Scraper GitHub repo
 * 
 * Detects products with active coupons
 * Tracks clippable coupons and promo codes
 * Calculates final price after coupon
 */

import axios from 'axios';

/**
 * Check if a product has an active coupon
 * @param {string} productUrl - Product URL or ID
 * @param {string} marketplace - Marketplace (default: amazon)
 * @returns {Promise<object|null>} Coupon data or null
 */
export async function checkForCoupon(productUrl, marketplace = 'amazon') {
  try {
    if (marketplace === 'amazon') {
      return await checkAmazonCoupon(productUrl);
    }
    
    // Add support for other marketplaces here
    return null;

  } catch (error) {
    console.error('❌ Coupon check error:', error.message);
    return null;
  }
}

/**
 * Check for Amazon coupons
 */
async function checkAmazonCoupon(productUrl) {
  try {
    const asin = extractASIN(productUrl);
    if (!asin) return null;

    console.log(`🎫 Checking coupons for ASIN: ${asin}`);

    // Strategy 1: Use RapidAPI if configured
    if (process.env.RAPIDAPI_KEY) {
      return await checkCouponViaRapidAPI(asin);
    }

    // Strategy 2: Use third-party coupon API (like MyVipon, as mentioned in Amazon-Deal-Scraper)
    // This requires reverse-engineered API access
    console.log('⚠️ Coupon detection requires API key');
    return null;

  } catch (error) {
    console.error('Amazon coupon check error:', error.message);
    return null;
  }
}

/**
 * Check coupons via RapidAPI
 */
async function checkCouponViaRapidAPI(asin) {
  try {
    const response = await axios.get('https://real-time-amazon-data.p.rapidapi.com/product-details', {
      params: { asin, country: 'US' },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'real-time-amazon-data.p.rapidapi.com'
      },
      timeout: 10000
    });

    const productData = response.data?.data;
    if (!productData) return null;

    // Check for coupon in product data
    const coupon = productData.coupon || productData.product_coupon;
    if (!coupon) return null;

    // Parse coupon details
    const currentPrice = parseFloat(productData.product_price || productData.price?.value || 0);
    let couponDiscount = 0;
    let couponPercentOff = 0;
    let couponCode = null;
    let isClippable = false;

    if (coupon.discount_amount) {
      // Fixed amount coupon
      couponDiscount = parseFloat(coupon.discount_amount);
    } else if (coupon.discount_percent) {
      // Percentage coupon
      couponPercentOff = parseInt(coupon.discount_percent);
      couponDiscount = (currentPrice * couponPercentOff) / 100;
    }

    // Check if it's a clippable coupon (no code needed)
    isClippable = coupon.is_clippable || coupon.clippable || false;
    
    // Get coupon code if it exists
    couponCode = coupon.code || coupon.promo_code || null;

    if (couponDiscount === 0 && couponPercentOff === 0) {
      return null; // No real discount
    }

    const finalPrice = Math.max(0, currentPrice - couponDiscount);
    const totalSavings = currentPrice - finalPrice;
    const totalPercentOff = currentPrice > 0 ? Math.round((totalSavings / currentPrice) * 100) : 0;

    return {
      found: true,
      asin,
      couponCode,
      couponDiscount,
      couponPercentOff,
      isClippable,
      currentPrice,
      finalPrice,
      totalSavings,
      totalPercentOff,
      expiresAt: coupon.expires_at || coupon.expiration_date || null,
      detectedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('RapidAPI coupon check error:', error.message);
    return null;
  }
}

/**
 * Extract ASIN from URL (reuse from warehouse-detector)
 */
function extractASIN(input) {
  if (!input) return null;

  if (/^[A-Z0-9]{10}$/.test(input)) {
    return input;
  }

  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /asin=([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:\/|$|\?)/i
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Batch check multiple products for coupons
 */
export async function batchCheckCoupons(productUrls) {
  console.log(`🎫 Batch checking ${productUrls.length} products for coupons`);
  
  const results = await Promise.allSettled(
    productUrls.map(url => checkForCoupon(url))
  );

  const found = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  console.log(`✅ Found ${found.length} products with coupons`);
  return found;
}

/**
 * Store coupon deal in database
 */
export async function storeCouponDeal(supabase, coupon, productName, productImageUrl, category) {
  try {
    const expiresAt = coupon.expiresAt 
      ? new Date(coupon.expiresAt).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default 30 days

    const { data, error } = await supabase
      .from('coupon_deals')
      .upsert({
        product_id: coupon.asin,
        product_name: productName,
        product_url: `https://www.amazon.com/dp/${coupon.asin}`,
        product_image_url: productImageUrl,
        category: category || 'Other',
        price: coupon.currentPrice,
        coupon_code: coupon.couponCode,
        coupon_discount: coupon.couponDiscount,
        coupon_percent_off: coupon.couponPercentOff,
        final_price: coupon.finalPrice,
        total_savings: coupon.totalSavings,
        total_percent_off: coupon.totalPercentOff,
        is_clippable: coupon.isClippable,
        detected_at: coupon.detectedAt,
        expires_at: expiresAt,
        is_available: true,
        last_checked_at: new Date().toISOString()
      }, {
        onConflict: 'product_id',
        ignoreDuplicates: false
      });

    if (error) throw error;
    return data;

  } catch (error) {
    console.error('Error storing coupon deal:', error);
    throw error;
  }
}

/**
 * Match coupon deals to user watchlists
 */
export async function matchCouponsToWatchlists(supabase, coupons) {
  try {
    const { data: watchlists, error } = await supabase
      .from('price_watchlist')
      .select('*')
      .eq('notify_on_drop', true);

    if (error) throw error;

    const matches = [];

    for (const coupon of coupons) {
      const matchedWatchlists = watchlists.filter(w => {
        const urlMatch = w.product_url && w.product_url.includes(coupon.asin);
        return urlMatch;
      });

      for (const watchlist of matchedWatchlists) {
        matches.push({
          userId: watchlist.user_id,
          watchlistId: watchlist.id,
          coupon
        });
      }
    }

    console.log(`✅ Matched ${matches.length} coupon deals to watchlists`);
    return matches;

  } catch (error) {
    console.error('Error matching coupons:', error);
    return [];
  }
}

/**
 * Create deal alerts for coupon matches
 */
export async function createCouponAlerts(supabase, matches) {
  const alerts = [];

  for (const match of matches) {
    try {
      const coupon = match.coupon;
      const alertReason = coupon.isClippable
        ? `🎫 Clippable Coupon! Save ${coupon.couponPercentOff}% (no code needed)`
        : `🎫 Coupon Code Available! Use code ${coupon.couponCode} for ${coupon.couponPercentOff}% off`;

      const { data, error } = await supabase
        .from('deal_alerts')
        .insert({
          user_id: match.userId,
          watchlist_id: match.watchlistId,
          deal_type: 'coupon',
          product_name: match.productName || 'Product with Coupon',
          product_url: `https://www.amazon.com/dp/${coupon.asin}`,
          product_image_url: match.productImageUrl,
          current_price: coupon.finalPrice,
          original_price: coupon.currentPrice,
          discount_percentage: coupon.totalPercentOff,
          savings_amount: coupon.totalSavings,
          coupon_code: coupon.couponCode,
          coupon_discount: coupon.couponDiscount,
          expires_at: coupon.expiresAt,
          alert_reason: alertReason,
          deal_quality_score: calculateCouponScore(coupon.totalPercentOff, coupon.isClippable),
          is_read: false
        });

      if (error) throw error;
      alerts.push(data);

    } catch (error) {
      console.error('Error creating coupon alert:', error);
    }
  }

  return alerts;
}

/**
 * Calculate quality score for coupon deals
 */
function calculateCouponScore(percentOff, isClippable) {
  let score = percentOff; // Base score from discount

  // Bonus for clippable coupons (easier to use)
  if (isClippable) {
    score += 15;
  } else {
    score += 5; // Small bonus for code-based coupons
  }

  return Math.min(score, 100);
}

/**
 * Format coupon for display
 */
export function formatCoupon(coupon) {
  if (!coupon) return null;

  return {
    type: coupon.isClippable ? 'clippable' : 'code',
    display: coupon.couponCode || 'Clip Coupon',
    discount: coupon.couponPercentOff > 0 
      ? `${coupon.couponPercentOff}% off`
      : `$${coupon.couponDiscount.toFixed(2)} off`,
    finalPrice: `$${coupon.finalPrice.toFixed(2)}`,
    savings: `Save $${coupon.totalSavings.toFixed(2)}`,
    icon: coupon.isClippable ? '🎫' : '🏷️'
  };
}

export { extractASIN };
