/**
 * Warehouse Deal Detector
 * Based on Amazon-WD-Alerts GitHub repo
 * 
 * Detects Amazon Warehouse Deals (open-box, returned items)
 * Tracks condition: Like New, Very Good, Good, Acceptable
 * Monitors price changes and availability
 */

import axios from 'axios';

/**
 * Check if a product has an Amazon Warehouse deal
 * @param {string} productUrl - Amazon product URL or ASIN
 * @returns {Promise<object|null>} Warehouse deal data or null
 */
export async function checkWarehouseDeal(productUrl) {
  try {
    const asin = extractASIN(productUrl);
    if (!asin) {
      throw new Error('Invalid Amazon URL or ASIN');
    }

    console.log(`🔍 Checking warehouse deals for ASIN: ${asin}`);

    // Build Amazon offers URL (where warehouse deals appear)
    const offersUrl = `https://www.amazon.com/gp/offer-listing/${asin}`;

    // Strategy 1: Try RapidAPI if configured (fastest)
    if (process.env.RAPIDAPI_KEY) {
      const rapidResult = await checkWarehouseViaRapidAPI(asin);
      if (rapidResult) return rapidResult;
    }

    // Strategy 2: Try eBay-style scraping (if we expand to other marketplaces)
    // For now, return structured mock data for testing
    // In production, you'd use Puppeteer or a scraping service
    
    console.log('⚠️ Warehouse deal detection requires RapidAPI or scraping service');
    return null;

  } catch (error) {
    console.error('❌ Warehouse deal check error:', error.message);
    return null;
  }
}

/**
 * Check warehouse deals via RapidAPI
 */
async function checkWarehouseViaRapidAPI(asin) {
  try {
    const response = await axios.get('https://real-time-amazon-data.p.rapidapi.com/product-offers', {
      params: { asin, country: 'US' },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'real-time-amazon-data.p.rapidapi.com'
      },
      timeout: 10000
    });

    const offers = response.data?.data?.offers || [];
    
    // Find Amazon Warehouse offer
    const warehouseOffer = offers.find(offer => 
      offer.seller?.name?.toLowerCase().includes('amazon warehouse') ||
      offer.seller?.name?.toLowerCase().includes('warehouse')
    );

    if (!warehouseOffer) {
      console.log('No warehouse deals found');
      return null;
    }

    // Parse condition from offer
    const condition = parseCondition(warehouseOffer.condition);
    const price = parseFloat(warehouseOffer.price?.value || warehouseOffer.price);
    const originalPrice = parseFloat(response.data?.data?.product?.price?.value || 0);

    if (!price || !originalPrice || price >= originalPrice) {
      return null; // No real discount
    }

    const savings = originalPrice - price;
    const percentOff = Math.round((savings / originalPrice) * 100);

    return {
      found: true,
      asin,
      condition,
      conditionNote: warehouseOffer.condition_note || warehouseOffer.condition_description || '',
      price,
      originalPrice,
      savings,
      percentOff,
      url: `https://www.amazon.com/gp/offer-listing/${asin}`,
      detectedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('RapidAPI warehouse check error:', error.message);
    return null;
  }
}

/**
 * Parse and normalize condition text
 */
function parseCondition(conditionText) {
  if (!conditionText) return 'good';
  
  const text = conditionText.toLowerCase();
  
  if (text.includes('like new') || text.includes('likenew')) {
    return 'like_new';
  } else if (text.includes('very good') || text.includes('verygood')) {
    return 'very_good';
  } else if (text.includes('acceptable')) {
    return 'acceptable';
  } else if (text.includes('good')) {
    return 'good';
  }
  
  return 'good'; // Default
}

/**
 * Extract ASIN from Amazon URL or return if already ASIN
 */
function extractASIN(input) {
  if (!input) return null;

  // Already an ASIN (10 alphanumeric characters)
  if (/^[A-Z0-9]{10}$/.test(input)) {
    return input;
  }

  // Extract from URL patterns
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,        // /dp/ASIN
    /\/gp\/product\/([A-Z0-9]{10})/i, // /gp/product/ASIN
    /\/product\/([A-Z0-9]{10})/i,   // /product/ASIN
    /asin=([A-Z0-9]{10})/i,         // ?asin=ASIN
    /\/([A-Z0-9]{10})(?:\/|$|\?)/i  // /ASIN/ or /ASIN?
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Batch check multiple products for warehouse deals
 */
export async function batchCheckWarehouseDeals(productUrls) {
  console.log(`📦 Batch checking ${productUrls.length} products for warehouse deals`);
  
  const results = await Promise.allSettled(
    productUrls.map(url => checkWarehouseDeal(url))
  );

  const found = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  console.log(`✅ Found ${found.length} warehouse deals`);
  return found;
}

/**
 * Store warehouse deal in database
 */
export async function storeWarehouseDeal(supabase, warehouseDeal, productName, productImageUrl) {
  try {
    const { data, error } = await supabase
      .from('warehouse_deals')
      .upsert({
        asin: warehouseDeal.asin,
        product_name: productName,
        product_url: warehouseDeal.url,
        product_image_url: productImageUrl,
        condition: warehouseDeal.condition,
        condition_note: warehouseDeal.conditionNote,
        price: warehouseDeal.price,
        original_price: warehouseDeal.originalPrice,
        savings: warehouseDeal.savings,
        percent_off: warehouseDeal.percentOff,
        detected_at: warehouseDeal.detectedAt,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        is_available: true,
        last_checked_at: new Date().toISOString()
      }, {
        onConflict: 'asin',
        ignoreDuplicates: false
      });

    if (error) throw error;
    return data;

  } catch (error) {
    console.error('Error storing warehouse deal:', error);
    throw error;
  }
}

/**
 * Get condition display name and emoji
 */
export function getConditionDisplay(condition) {
  const displays = {
    like_new: { text: 'Like New', emoji: '✨', color: 'green' },
    very_good: { text: 'Very Good', emoji: '👍', color: 'blue' },
    good: { text: 'Good', emoji: '👌', color: 'yellow' },
    acceptable: { text: 'Acceptable', emoji: '⚠️', color: 'orange' }
  };

  return displays[condition] || displays.good;
}

/**
 * Calculate deal quality score for warehouse deals
 */
export function calculateWarehouseScore(percentOff, condition) {
  let score = percentOff; // Base score from discount

  // Condition bonus
  const conditionBonus = {
    like_new: 15,
    very_good: 10,
    good: 5,
    acceptable: 0
  };

  score += conditionBonus[condition] || 0;

  return Math.min(score, 100);
}

export { extractASIN };
