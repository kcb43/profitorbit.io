/**
 * Import Mercari items into user's inventory
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get user ID from request
function getUserId(req) {
  return req.headers['x-user-id'] || null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

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

    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    let imported = 0;
    let failed = 0;
    const errors = [];
    const importedItems = []; // Track imported items with their IDs

    for (const item of items) {
      try {
        console.log(`🔄 Importing Mercari item ${item.itemId}...`);

        if (!item || !item.itemId) {
          const error = 'Invalid item data';
          failed++;
          errors.push({ itemId: item?.itemId || 'unknown', error });
          console.error(`❌ ${item?.itemId}: ${error}`);
          continue;
        }

        console.log(`💾 Checking for existing inventory item...`);
        
        // Check if this is a sold item
        const isSoldItem = item.status === 'sold';
        console.log(`📊 Item status check:`, {
          status: item.status,
          isSoldItem
        });

        // Proxy Mercari images to avoid CORS issues
        const proxyImageUrl = (url) => {
          if (!url) return null;
          if (url.includes('mercdn.net')) {
            return `/api/proxy/image?url=${encodeURIComponent(url)}`;
          }
          return url;
        };

        const proxiedImageUrl = proxyImageUrl(item.imageUrl);
        const proxiedPictureURLs = (item.pictureURLs || []).map(proxyImageUrl);
        
        // Check if inventory item already exists (by title and price for Mercari)
        // Mercari has item IDs but they're not stored in our DB, so match by title + price
        let inventoryId = null;
        let isExistingItem = false;
        
        const { data: existingItem, error: searchError } = await supabase
          .from('inventory_items')
          .select('id, item_name, status, listing_price')
          .eq('user_id', userId)
          .eq('source', 'Mercari')
          .ilike('item_name', item.title) // Exact title match
          .is('deleted_at', null)
          .maybeSingle();
        
        if (existingItem) {
          // Double-check price is similar (within $5)
          const priceDiff = Math.abs((existingItem.listing_price || 0) - (item.price || 0));
          if (priceDiff <= 5) {
            inventoryId = existingItem.id;
            isExistingItem = true;
            console.log(`✅ Found existing inventory item: ${existingItem.item_name} (ID: ${inventoryId})`);
          }
        }
        
        if (!isExistingItem) {
          // Create new inventory item
          console.log(`💾 Creating new inventory item...`);

          // Create inventory item with all available metadata
          const { data: insertData, error: insertError} = await supabase
            .from('inventory_items')
            .insert({
              user_id: userId,
              item_name: item.title,
              description: item.description || item.title,
              purchase_price: null, // Don't set purchase price for imports
              listing_price: item.price, // Price from marketplace becomes listing price
              status: isSoldItem ? 'sold' : 'listed', // Set status based on item status
              source: 'Mercari',
              images: proxiedPictureURLs.filter(Boolean),
              image_url: proxiedImageUrl,
              condition: item.condition || null,
              brand: item.brand || null,
              category: item.category || null,
              size: item.size || null,
              // Use the actual posted date from Mercari, fallback to today
              purchase_date: item.listingDate 
                ? new Date(item.listingDate).toISOString().split('T')[0]
                : item.startTime 
                  ? new Date(item.startTime).toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0],
              notes: null, // User can add their own notes
            })
            .select('id')
            .single();

          if (insertError) {
            failed++;
            const errorMsg = insertError.message;
            errors.push({ itemId: item.itemId, error: errorMsg });
            console.error(`❌ Failed to import item ${item.itemId}:`, insertError);
            continue;
          }
          
          inventoryId = insertData.id;
          console.log(`✅ Created new inventory item with ID ${inventoryId}`);
        } else {
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
        }
        
        console.log(`📊 Item data received:`, {
          itemId: item.itemId,
          title: item.title?.substring(0, 50),
          price: item.price,
          condition: item.condition,
          brand: item.brand,
          size: item.size,
          description_length: item.description?.length
        });

        imported++;
        const importResult = {
          itemId: item.itemId,
          inventoryId,
          isExistingItem,
        };
        
        // If this is a sold item, also create a sale record
        if (isSoldItem) {
          try {
            console.log(`📊 Creating sale record for sold item ${item.itemId}...`);
            
            const { data: saleData, error: saleError } = await supabase
              .from('sales')
              .insert({
                user_id: userId,
                inventory_id: inventoryId,
                item_name: item.title,
                sale_price: item.price,
                sale_date: item.listingDate || item.startTime || new Date().toISOString(), // Use creation time as sale date
                platform: 'mercari', // Lowercase to match platformOptions
                shipping_cost: 0, // Mercari doesn't provide this in the import
                platform_fees: 0, // Mercari doesn't provide this in the import
                vat_fees: 0, // Mercari doesn't provide this in the import
                profit: item.price, // Since we don't know costs, profit = sale price
                image_url: proxiedImageUrl,
                item_condition: item.condition || null,
              })
              .select('id')
              .single();
            
            if (saleError) {
              console.error(`⚠️ Failed to create sale record for ${item.itemId}:`, saleError);
            } else {
              console.log(`✅ Created sale record for ${item.itemId} with ID ${saleData.id}`);
              importResult.saleId = saleData.id; // Add sale ID to result
            }
          } catch (saleErr) {
            console.error(`⚠️ Error creating sale record for ${item.itemId}:`, saleErr);
          }
        }
        
        importedItems.push(importResult);
        console.log(`✅ Successfully imported item ${item.itemId} with inventory ID ${inventoryId}${isExistingItem ? ' (linked to existing inventory)' : ''}`);
      } catch (error) {
        failed++;
        const errorMsg = error.message;
        errors.push({ itemId: item?.itemId || 'unknown', error: errorMsg });
        console.error(`❌ Error importing item ${item?.itemId}:`, error);
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
      importedItems, // Return the mapping of itemId to inventoryId
    });

  } catch (error) {
    console.error('Error importing Mercari items:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to import Mercari items' 
    });
  }
}
