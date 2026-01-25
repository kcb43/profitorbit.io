/**
 * Import eBay items into user's inventory
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

// Fetch detailed offer info from eBay Sell API
async function getOfferDetails(offerId, accessToken) {
  const ebayEnv = process.env.EBAY_ENV || 'production';
  const apiUrl = ebayEnv === 'production' 
    ? 'https://api.ebay.com'
    : 'https://api.sandbox.ebay.com';

  const response = await fetch(`${apiUrl}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'en-US',
      'Content-Language': 'en-US',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to fetch offer ${offerId}:`, errorText);
    throw new Error(`Failed to fetch offer ${offerId}`);
  }

  const offer = await response.json();
  const listing = offer.listing || {};
  const pricingSummary = offer.pricingSummary || {};
  
  return {
    offerId: offer.offerId,
    sku: offer.sku,
    title: listing.title || offer.sku || 'Untitled',
    description: listing.description || '',
    price: pricingSummary.price?.value || 0,
    condition: listing.condition || 'USED',
    images: listing.pictureUrls || [],
    quantity: offer.availableQuantity || 0,
    status: offer.status,
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, X-User-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const accessToken = getEbayToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'eBay not connected. Please connect your eBay account first.' });
    }

    const { itemIds } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds array is required' });
    }

    let imported = 0;
    let failed = 0;
    const errors = [];

    for (const itemId of itemIds) {
      try {
        // Fetch detailed offer info from eBay (itemId is offerId)
        const offerDetails = await getOfferDetails(itemId, accessToken);

        if (!offerDetails) {
          failed++;
          errors.push({ itemId, error: 'Failed to parse offer data' });
          continue;
        }

        // Create inventory item
        const { error: insertError } = await supabase
          .from('inventory_items')
          .insert({
            user_id: userId,
            item_name: offerDetails.title,
            description: offerDetails.description,
            purchase_price: offerDetails.price,
            listing_price: offerDetails.price,
            status: 'listed',
            source: 'eBay',
            images: offerDetails.images,
            image_url: offerDetails.images[0] || null,
            sku: offerDetails.sku,
            ebay_offer_id: offerDetails.offerId,
            condition: offerDetails.condition,
            purchase_date: new Date().toISOString(),
          });

        if (insertError) {
          failed++;
          errors.push({ itemId, error: insertError.message });
          console.error(`Failed to import item ${itemId}:`, insertError);
        } else {
          imported++;
        }

      } catch (error) {
        failed++;
        errors.push({ itemId, error: error.message });
        console.error(`Error importing item ${itemId}:`, error);
      }
    }

    return res.status(200).json({
      imported,
      failed,
      errors: failed > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error importing eBay items:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to import eBay items' 
    });
  }
}
