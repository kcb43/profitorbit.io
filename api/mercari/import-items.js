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

        console.log(`💾 Inserting item ${item.itemId} into database...`);

        // Create inventory item
        const { data: insertData, error: insertError} = await supabase
          .from('inventory_items')
          .insert({
            user_id: userId,
            item_name: item.title,
            description: item.description || item.title,
            purchase_price: item.price,
            listing_price: item.price,
            status: 'listed',
            source: 'Mercari',
            images: item.pictureURLs || [item.imageUrl].filter(Boolean),
            image_url: item.imageUrl || null,
            condition: item.condition || 'USED',
            brand: item.brand || null,
            category: item.category || null,
            size: item.size || null,
            purchase_date: new Date().toISOString(),
            // Store Mercari metadata
            notes: `Mercari Item ID: ${item.itemId}` + 
                   (item.numLikes ? `\nLikes: ${item.numLikes}` : '') + 
                   (item.numViews ? `\nViews: ${item.numViews}` : ''),
          })
          .select('id')
          .single();

        if (insertError) {
          failed++;
          const errorMsg = insertError.message;
          errors.push({ itemId: item.itemId, error: errorMsg });
          console.error(`❌ Failed to import item ${item.itemId}:`, insertError);
        } else {
          imported++;
          importedItems.push({
            itemId: item.itemId,
            inventoryId: insertData.id,
          });
          console.log(`✅ Successfully imported item ${item.itemId} with inventory ID ${insertData.id}`);
        }

      } catch (error) {
        failed++;
        const errorMsg = error.message;
        errors.push({ itemId: item?.itemId || 'unknown', error: errorMsg });
        console.error(`❌ Error importing item ${item?.itemId}:`, error);
      }
    }

    console.log(`📊 Import summary: ${imported} imported, ${failed} failed`);

    return res.status(200).json({
      imported,
      failed,
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
