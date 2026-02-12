const axios = require('axios');

/**
 * eBay Browse API Integration
 * Uses eBay's official API for rich product data
 * Requires eBay API credentials
 */

const EBAY_API_BASE = 'https://api.ebay.com/buy/browse/v1';
const EBAY_MARKETPLACE_ID = 'EBAY_US';

/**
 * Get eBay OAuth token
 */
async function getEbayToken() {
  const clientId = process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CERT_ID;

  if (!clientId || !clientSecret) {
    console.warn('⚠️ eBay API credentials not configured');
    return null;
  }

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await axios.post(
      'https://api.ebay.com/identity/v1/oauth2/token',
      'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`
        }
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('❌ eBay token error:', error.message);
    return null;
  }
}

/**
 * Search eBay using Browse API
 */
async function searchEbay(query, options = {}) {
  console.log('🛍️ Searching eBay via API:', query);

  const token = await getEbayToken();
  if (!token) {
    console.log('⚠️ eBay API not available, skipping');
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: query,
      limit: options.maxResults || 50,
    });

    // Add filters
    if (options.minPrice || options.maxPrice) {
      const min = options.minPrice || 0;
      const max = options.maxPrice || 999999;
      params.append('filter', `price:[${min}..${max}],priceCurrency:USD`);
    }

    if (options.condition === 'new') {
      params.append('filter', 'conditions:{NEW}');
    } else if (options.condition === 'used') {
      params.append('filter', 'conditions:{USED}');
    }

    // Sort
    if (options.sortBy === 'price_low') {
      params.append('sort', 'price');
    } else if (options.sortBy === 'price_high') {
      params.append('sort', '-price');
    }

    const response = await axios.get(
      `${EBAY_API_BASE}/item_summary/search?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE_ID,
          'X-EBAY-C-ENDUSERCTX': 'affiliateCampaignId=<ePNCampaignId>,affiliateReferenceId=<referenceId>'
        }
      }
    );

    if (!response.data.itemSummaries) {
      return [];
    }

    // Transform to our format
    const products = response.data.itemSummaries.map(item => ({
      title: item.title,
      price: parseFloat(item.price?.value || 0),
      currency: item.price?.currency || 'USD',
      originalPrice: item.marketingPrice?.originalPrice?.value 
        ? parseFloat(item.marketingPrice.originalPrice.value)
        : null,
      discountPercentage: item.marketingPrice?.discountPercentage 
        ? parseInt(item.marketingPrice.discountPercentage)
        : 0,
      imageUrl: item.image?.imageUrl || null,
      productUrl: item.itemWebUrl,
      marketplace: 'ebay',
      marketplaceDomain: 'ebay.com',
      marketplaceLogo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg',
      seller: item.seller?.username || 'eBay Seller',
      condition: item.condition?.toLowerCase() || 'used',
      rating: item.seller?.feedbackPercentage ? parseFloat(item.seller.feedbackPercentage) / 20 : null,
      reviewCount: item.seller?.feedbackScore || null,
      availability: item.availabilityType === 'AVAILABLE' ? 'in_stock' : 'out_of_stock',
      shipping: item.shippingOptions?.[0]?.shippingCost?.value 
        ? parseFloat(item.shippingOptions[0].shippingCost.value)
        : null,
      itemLocation: item.itemLocation?.city || null,
      scrapedAt: new Date().toISOString()
    }));

    console.log(`✅ Found ${products.length} products on eBay`);
    return products;

  } catch (error) {
    console.error('❌ eBay API error:', error.message);
    return [];
  }
}

/**
 * Get eBay product details by item ID
 */
async function getEbayItemDetails(itemId) {
  const token = await getEbayToken();
  if (!token) return null;

  try {
    const response = await axios.get(
      `${EBAY_API_BASE}/item/${itemId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE_ID
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ eBay item details error:', error.message);
    return null;
  }
}

/**
 * Get eBay price history (if available)
 */
async function getEbayPriceHistory(itemId) {
  // eBay doesn't provide historical pricing via API
  // But we can check if there's a discount from original price
  const details = await getEbayItemDetails(itemId);
  
  if (!details?.marketingPrice) {
    return null;
  }

  return {
    currentPrice: parseFloat(details.price.value),
    originalPrice: parseFloat(details.marketingPrice.originalPrice.value),
    discountPercentage: parseInt(details.marketingPrice.discountPercentage),
    discountAmount: parseFloat(details.marketingPrice.discountAmount.value)
  };
}

module.exports = {
  searchEbay,
  getEbayItemDetails,
  getEbayPriceHistory
};
