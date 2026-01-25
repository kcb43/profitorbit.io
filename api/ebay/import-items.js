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

// Fetch detailed item info from eBay Trading API
async function getItemDetails(itemId, accessToken) {
  const ebayEnv = process.env.EBAY_ENV || 'production';
  const tradingUrl = ebayEnv === 'production'
    ? 'https://api.ebay.com/ws/api.dll'
    : 'https://api.sandbox.ebay.com/ws/api.dll';

  // Build XML request for GetItem
  const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  const response = await fetch(tradingUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-CALL-NAME': 'GetItem',
    },
    body: xmlRequest,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to fetch item ${itemId}:`, errorText);
    throw new Error(`Failed to fetch item ${itemId}`);
  }

  const xmlText = await response.text();
  return parseItemXML(xmlText);
}

// Parse GetItem XML response
function parseItemXML(xml) {
  const getField = (field) => {
    const match = xml.match(new RegExp(`<${field}>([^<]*)<\/${field}>`));
    return match ? match[1] : null;
  };

  // Extract PictureURL fields
  const pictureURLs = [];
  const pictureRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
  let pictureMatch;
  while ((pictureMatch = pictureRegex.exec(xml)) !== null) {
    pictureURLs.push(pictureMatch[1]);
  }

  return {
    itemId: getField('ItemID'),
    title: getField('Title'),
    description: getField('Description') || '',
    price: parseFloat(getField('CurrentPrice') || getField('StartPrice')) || 0,
    condition: getField('ConditionDisplayName') || 'USED',
    images: pictureURLs,
    quantity: parseInt(getField('Quantity')) || 1,
    sku: getField('SKU'),
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
        // Fetch detailed item info from eBay Trading API
        const itemDetails = await getItemDetails(itemId, accessToken);

        if (!itemDetails || !itemDetails.itemId) {
          failed++;
          errors.push({ itemId, error: 'Failed to parse item data' });
          continue;
        }

        // Create inventory item
        const { error: insertError } = await supabase
          .from('inventory_items')
          .insert({
            user_id: userId,
            item_name: itemDetails.title,
            description: itemDetails.description,
            purchase_price: itemDetails.price,
            listing_price: itemDetails.price,
            status: 'listed',
            source: 'eBay',
            images: itemDetails.images,
            image_url: itemDetails.images[0] || null,
            sku: itemDetails.sku,
            ebay_item_id: itemDetails.itemId,
            condition: itemDetails.condition,
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
