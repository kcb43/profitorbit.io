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

  // Helper to decode HTML entities
  const decodeHtmlEntities = (text) => {
    if (!text) return '';
    
    // IMPORTANT: Decode &amp; FIRST, then other entities
    // Because other entities might contain &amp; (e.g., &amp;lt; -> &lt; -> <)
    let decoded = text;
    
    // First pass: decode &amp; to &
    decoded = decoded.replace(/&amp;/g, '&');
    
    // Second pass: decode remaining entities
    const entities = {
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&#160;': ' ',
    };
    
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }
    
    return decoded;
  };

  // Helper to strip HTML tags and format as plain text
  const stripHtmlTags = (html) => {
    if (!html) return '';
    
    // Decode HTML entities first
    let text = decodeHtmlEntities(html);
    
    // Replace common block elements with line breaks
    text = text.replace(/<\/?(p|div|br|h[1-6]|li)>/gi, '\n');
    
    // Remove all other HTML tags
    text = text.replace(/<[^>]+>/g, '');
    
    // Clean up multiple line breaks and trim
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    
    return text;
  };

  // Extract price with attribute handling
  const currentPriceMatch = xml.match(/<CurrentPrice[^>]*>([^<]+)<\/CurrentPrice>/);
  const startPriceMatch = xml.match(/<StartPrice[^>]*>([^<]+)<\/StartPrice>/);
  const price = parseFloat(currentPriceMatch?.[1] || startPriceMatch?.[1]) || 0;

  // Extract PictureURL fields
  const pictureURLs = [];
  const pictureRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
  let pictureMatch;
  while ((pictureMatch = pictureRegex.exec(xml)) !== null) {
    if (pictureMatch[1] && pictureMatch[1].startsWith('http')) {
      pictureURLs.push(pictureMatch[1]);
    }
  }

  // Extract description (handle CDATA and HTML)
  let description = '';
  const descMatch = xml.match(/<Description>(<!\[CDATA\[)?([\s\S]*?)(\]\]>)?<\/Description>/);
  if (descMatch) {
    const rawDescription = descMatch[2] || '';
    // Convert HTML to plain text
    description = stripHtmlTags(rawDescription);
  }

  // Extract primary category
  let categoryName = '';
  let categoryId = '';
  const primaryCategoryMatch = xml.match(/<PrimaryCategory>([\s\S]*?)<\/PrimaryCategory>/);
  if (primaryCategoryMatch) {
    const categoryXml = primaryCategoryMatch[1];
    const catNameMatch = categoryXml.match(/<CategoryName>([^<]*)<\/CategoryName>/);
    const catIdMatch = categoryXml.match(/<CategoryID>([^<]*)<\/CategoryID>/);
    categoryName = catNameMatch ? catNameMatch[1] : '';
    categoryId = catIdMatch ? catIdMatch[1] : '';
  }

  console.log(`📦 Parsed item:`, {
    itemId: getField('ItemID'),
    price,
    category: categoryName,
    hasDescription: description.length > 0,
    descriptionLength: description.length,
    imageCount: pictureURLs.length,
  });

  return {
    itemId: getField('ItemID'),
    title: getField('Title'),
    description,
    price,
    condition: getField('ConditionDisplayName') || 'USED',
    images: pictureURLs,
    quantity: parseInt(getField('Quantity')) || 1,
    sku: getField('SKU'),
    categoryName,
    categoryId,
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

    const { itemIds, itemsData } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds array is required' });
    }

    // itemsData is optional - contains full item details from my-listings endpoint (for sold items)
    const itemsDataMap = {};
    if (itemsData && Array.isArray(itemsData)) {
      itemsData.forEach(item => {
        itemsDataMap[item.itemId] = item;
      });
    }

    let imported = 0;
    let failed = 0;
    const errors = [];
    const importedItems = []; // Track imported items with their IDs

    for (const itemId of itemIds) {
      try {
        console.log(`🔄 Importing item ${itemId}...`);
        
        // Check if we have full item data from my-listings (for sold items)
        const fullItemData = itemsDataMap[itemId];
        const isSoldItem = fullItemData && fullItemData.status === 'Sold';
        
        let itemDetails;
        
        if (isSoldItem && fullItemData) {
          // For sold items, we already have the data - no need to call eBay API
          // Use originalItemId for the actual eBay item ID
          const actualEbayItemId = fullItemData.originalItemId || fullItemData.itemId;
          
          console.log(`📦 Using cached sold item data for ${actualEbayItemId} (transaction ${fullItemData.transactionId})`);
          
          itemDetails = {
            itemId: actualEbayItemId,
            title: fullItemData.title,
            description: fullItemData.description || '',
            price: fullItemData.price,
            condition: fullItemData.itemCondition || fullItemData.condition,
            images: fullItemData.images || [],
            quantity: 1,
            sku: fullItemData.sku || null,
          };
        } else {
          // For active items, fetch from eBay API
          itemDetails = await getItemDetails(itemId, accessToken);
        }

        if (!itemDetails || !itemDetails.itemId) {
          const error = 'Failed to parse item data';
          failed++;
          errors.push({ itemId, error });
          console.error(`❌ ${itemId}: ${error}`);
          continue;
        }

        console.log(`💾 Checking for existing inventory item...`);

        // Check if inventory item already exists (by eBay item ID)
        let inventoryId = null;
        let isExistingItem = false;
        
        const { data: existingItem, error: searchError } = await supabase
          .from('inventory_items')
          .select('id, item_name, status')
          .eq('user_id', userId)
          .eq('ebay_item_id', itemDetails.itemId)
          .is('deleted_at', null)
          .maybeSingle();
        
        if (existingItem) {
          inventoryId = existingItem.id;
          isExistingItem = true;
          console.log(`✅ Found existing inventory item: ${existingItem.item_name} (ID: ${inventoryId})`);
          
          // If it's a sold item, update the inventory status to 'sold'
          if (isSoldItem && existingItem.status !== 'sold') {
            const { error: updateError } = await supabase
              .from('inventory_items')
              .update({ status: 'sold' })
              .eq('id', inventoryId);
            
            if (updateError) {
              console.error(`⚠️ Failed to update inventory status to sold:`, updateError);
            } else {
              console.log(`✅ Updated inventory item status to 'sold'`);
            }
          }
        } else {
          // Create new inventory item
          console.log(`💾 Creating new inventory item...`);
          
          const { data: insertData, error: insertError } = await supabase
            .from('inventory_items')
            .insert({
              user_id: userId,
              item_name: itemDetails.title,
              description: itemDetails.description,
              purchase_price: itemDetails.price,
              listing_price: itemDetails.price,
              status: isSoldItem ? 'sold' : 'listed',
              source: 'eBay',
              images: itemDetails.images,
              image_url: itemDetails.images[0] || null,
              sku: itemDetails.sku,
              ebay_item_id: itemDetails.itemId,
              condition: itemDetails.condition,
              purchase_date: new Date().toISOString(),
              notes: null,
            })
            .select('id')
            .single();

          if (insertError) {
            failed++;
            const errorMsg = insertError.message;
            errors.push({ itemId, error: errorMsg });
            console.error(`❌ Failed to import item ${itemId}:`, insertError);
            continue;
          }
          
          inventoryId = insertData.id;
          console.log(`✅ Created new inventory item with ID ${inventoryId}`);
        }

        imported++;
        const importResult = {
          itemId,
          inventoryId,
          isExistingItem, // Flag to show if it was a duplicate
        };
        
        // If this is a sold item, also create a sale record
        if (isSoldItem && fullItemData) {
          try {
            console.log(`📊 Creating sale record for sold item ${itemId}...`);
            
            const { data: saleData, error: saleError } = await supabase
              .from('sales')
              .insert({
                user_id: userId,
                inventory_id: inventoryId,
                item_name: fullItemData.title || itemDetails.title,
                sale_price: fullItemData.price,
                sale_date: fullItemData.dateSold || new Date().toISOString(),
                platform: 'eBay',
                shipping_cost: fullItemData.shippingCost || 0,
                platform_fees: fullItemData.finalValueFee || 0,
                vat_fees: fullItemData.salesTax || 0,
                profit: fullItemData.netPayout || (fullItemData.price - (fullItemData.finalValueFee || 0)),
                image_url: fullItemData.images?.[0] || itemDetails.images?.[0] || null,
                // Fully displayed fields
                tracking_number: fullItemData.trackingNumber,
                shipping_carrier: fullItemData.shippingCarrier,
                delivery_date: fullItemData.deliveryDate,
                shipped_date: fullItemData.shippedDate,
                item_condition: fullItemData.itemCondition || itemDetails.condition,
                // Hidden fields
                buyer_address: fullItemData.buyerAddress,
                payment_method: fullItemData.paymentMethod,
                payment_status: fullItemData.paymentStatus,
                payment_date: fullItemData.paymentDate,
                item_location: fullItemData.itemLocation,
                buyer_notes: fullItemData.buyerNotes,
                // eBay identifiers
                ebay_order_id: fullItemData.orderId,
                ebay_transaction_id: fullItemData.transactionId,
                ebay_buyer_username: fullItemData.buyerUsername,
              })
              .select('id')
              .single();
            
            if (saleError) {
              console.error(`⚠️ Failed to create sale record for ${itemId}:`, saleError);
            } else {
              console.log(`✅ Created sale record for ${itemId} with ID ${saleData.id}`);
              importResult.saleId = saleData.id; // Add sale ID to result
            }
          } catch (saleErr) {
            console.error(`⚠️ Error creating sale record for ${itemId}:`, saleErr);
          }
        }
        
        importedItems.push(importResult);
        console.log(`✅ Successfully imported item ${itemId} with inventory ID ${inventoryId}${isExistingItem ? ' (linked to existing inventory)' : ''}`);
      } catch (error) {
        failed++;
        const errorMsg = error.message;
        errors.push({ itemId, error: errorMsg });
        console.error(`❌ Error importing item ${itemId}:`, error);
      }
    }

    console.log(`📊 Import summary: ${imported} imported, ${failed} failed`);
    
    // Count duplicates
    const duplicateCount = importedItems.filter(item => item.isExistingItem).length;

    return res.status(200).json({
      imported,
      failed,
      duplicates: duplicateCount,
      errors: failed > 0 ? errors : undefined,
      importedItems, // Return the mapping of itemId to inventoryId (includes isExistingItem flag)
    });

  } catch (error) {
    console.error('Error importing eBay items:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to import eBay items' 
    });
  }
}
