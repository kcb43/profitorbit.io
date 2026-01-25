/**
 * Fetch user's eBay listings (for Import page)
 * Uses eBay Sell API (Inventory + Browse)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get user ID from request
function getUserId(req) {
  return req.headers['x-user-id'] || null;
}

// Helper to get eBay token from request headers
function getEbayToken(req) {
  return req.headers['x-user-token'] || null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-user-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = getUserId(req);
    console.log('🔍 API: getUserId result:', userId);
    
    if (!userId) {
      console.error('❌ API: No user ID in headers');
      return res.status(401).json({ error: 'Unauthorized - User ID missing' });
    }

    const accessToken = getEbayToken(req);
    console.log('🔍 API: getEbayToken result:', accessToken ? 'token present' : 'NO TOKEN');
    
    if (!accessToken) {
      console.error('❌ API: No eBay token in headers');
      return res.status(401).json({ error: 'eBay not connected. Please connect your eBay account first.' });
    }

    const status = req.query.status || 'Active'; // Active, Ended, All
    const limit = req.query.limit || '200';

    // Determine which eBay API environment to use
    const ebayEnv = process.env.EBAY_ENV || 'production';
    const useProduction = ebayEnv === 'production';
    const apiUrl = useProduction
      ? 'https://api.ebay.com'
      : 'https://api.sandbox.ebay.com';

    console.log('🔍 Fetching eBay listings:', { useProduction, status, userId: userId.substring(0, 8) + '...' });

    // Use Sell API - Offer API to get active listings (offers)
    // https://developer.ebay.com/api-docs/sell/inventory/resources/offer/methods/getOffers
    // This returns actual listings, not just inventory items
    const offerUrl = `${apiUrl}/sell/inventory/v1/offer?limit=${limit}`;

    const response = await fetch(offerUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'Content-Language': 'en-US',
      },
    });

    console.log('📡 eBay API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ eBay API error:', response.status, errorText);
      
      let errorMessage = 'Failed to fetch eBay listings';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.errors?.[0]?.message || errorData.error_description || errorMessage;
      } catch (e) {
        // If not JSON, use the text directly
        if (errorText) errorMessage = errorText;
      }
      
      return res.status(response.status).json({ 
        error: errorMessage,
        details: errorText,
      });
    }

    const data = await response.json();
    console.log('✅ Fetched offers (listings):', data.offers?.length || 0);

    // Transform eBay offers to our format
    const items = (data.offers || []).map(offer => {
      const listing = offer.listing || {};
      const pricingSummary = offer.pricingSummary || {};
      
      return {
        itemId: offer.offerId, // Use offerId as item ID
        offerId: offer.offerId,
        sku: offer.sku,
        title: listing.title || offer.sku || 'Untitled',
        description: listing.description || '',
        price: pricingSummary.price?.value || 0,
        imageUrl: listing.pictureUrls?.[0] || null,
        pictureURLs: listing.pictureUrls || [],
        condition: listing.condition || 'USED',
        quantity: offer.availableQuantity || 0,
        listingDate: offer.listingStartDate || null,
        startTime: offer.listingStartDate || null,
        status: offer.status,
        marketplaceId: offer.marketplaceId,
      };
    });

    // Check which items are already imported
    const offerIds = items.map(item => item.offerId).filter(Boolean);
    
    if (offerIds.length > 0) {
      const { data: importedItems } = await supabase
        .from('inventory_items')
        .select('sku, ebay_offer_id')
        .eq('user_id', userId)
        .or(`sku.in.(${items.map(i => `"${i.sku}"`).join(',')}),ebay_offer_id.in.(${offerIds.map(id => `"${id}"`).join(',')})`);

      const importedSkus = new Set(importedItems?.map(item => item.sku).filter(Boolean) || []);
      const importedOfferIds = new Set(importedItems?.map(item => item.ebay_offer_id).filter(Boolean) || []);

      // Mark items as imported or not
      const listings = items.map(item => ({
        ...item,
        imported: importedSkus.has(item.sku) || importedOfferIds.has(item.offerId),
      }));

      return res.status(200).json({
        listings,
        total: listings.length,
      });
    }

    return res.status(200).json({
      listings: items.map(item => ({ ...item, imported: false })),
      total: items.length,
    });

  } catch (error) {
    console.error('❌ Error fetching eBay listings:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch eBay listings',
      details: error.stack,
    });
  }
}
