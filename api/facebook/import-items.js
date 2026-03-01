/**
 * Import Facebook Marketplace items into user's inventory
 */

import { createClient } from '@supabase/supabase-js';
import { mapFacebookToOrbenCategory, resolveFacebookCategoryName } from '../utils/categoryMapper.js';

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
        console.log(`🔄 Importing Facebook item ${item.itemId}...`);
        console.log(`📊 Item data received:`, {
          itemId: item.itemId,
          title: item.title?.substring(0, 50),
          price: item.price,
          condition: item.condition,
          brand: item.brand,
          size: item.size,
          description_length: item.description?.length
        });

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
        
        // Resolve Facebook category ID to human-readable name (needed before insert)
        const facebookCategoryName = item.category || resolveFacebookCategoryName(item.categoryId);
        
        // Map Facebook category to Orben category
        const orbenCategory = mapFacebookToOrbenCategory(
          facebookCategoryName,
          item.categoryId,
          item.title
        );
        
        console.log(`📂 Category mapping: FB "${facebookCategoryName}" (ID: ${item.categoryId}) → Orben "${orbenCategory}"`);
        
        // Smart-match dedup: check by facebook_item_id first, then title+price fallback.
        // This prevents creating duplicate inventory records when re-importing.
        let inventoryId = null;
        let isExistingItem = false;

        // 1. Try exact match by facebook_item_id (most reliable)
        if (item.itemId) {
          const { data: idMatch } = await supabase
            .from('inventory_items')
            .select('id, item_name, status, listing_price')
            .eq('user_id', userId)
            .eq('facebook_item_id', String(item.itemId))
            .is('deleted_at', null)
            .maybeSingle();

          if (idMatch) {
            inventoryId = idMatch.id;
            isExistingItem = true;
            console.log(`✅ Found existing item by facebook_item_id: ${idMatch.item_name} (ID: ${inventoryId})`);
          }
        }

        // 2. Try matching by marketplace_listings table (if previously crosslisted)
        if (!isExistingItem && item.itemId) {
          const { data: listingMatch } = await supabase
            .from('marketplace_listings')
            .select('inventory_item_id')
            .eq('user_id', userId)
            .eq('marketplace', 'facebook')
            .eq('marketplace_listing_id', String(item.itemId))
            .maybeSingle();

          if (listingMatch) {
            inventoryId = listingMatch.inventory_item_id;
            isExistingItem = true;
            console.log(`✅ Found existing item via marketplace_listings: ${inventoryId}`);
          }
        }

        // 3. Fallback: match any inventory item by exact title + similar price (any source)
        // This catches items added manually or imported from another marketplace
        if (!isExistingItem) {
          const { data: titleMatch } = await supabase
            .from('inventory_items')
            .select('id, item_name, status, listing_price, quantity, quantity_sold')
            .eq('user_id', userId)
            .ilike('item_name', item.title)
            .is('deleted_at', null)
            .limit(5);

          if (titleMatch && titleMatch.length > 0) {
            // Find best match: prefer same source, then closest price
            const bestMatch = titleMatch.find(m => {
              const priceDiff = Math.abs((m.listing_price || 0) - (item.price || 0));
              return priceDiff <= 10; // $10 tolerance for cross-marketplace price differences
            });
            if (bestMatch) {
              inventoryId = bestMatch.id;
              isExistingItem = true;
              console.log(`✅ Found existing item by title+price match: ${bestMatch.item_name} (ID: ${inventoryId})`);
            }
          }
        }
        
        if (!isExistingItem) {
          // Create new inventory item
          console.log(`💾 Creating new inventory item...`);

          // Create inventory item
          const { data: insertData, error: insertError } = await supabase
            .from('inventory_items')
            .insert({
              user_id: userId,
              item_name: item.title,
              description: item.description || item.title,
              purchase_price: null, // Don't set purchase price - user will add their actual cost later
              listing_price: item.price, // Facebook price = suggested listing price for crosslisting
              status: isSoldItem ? 'sold' : 'listed', // Set status based on item status
              source: 'Facebook', // Changed from "Facebook Marketplace" to "Facebook"
              images: item.pictureURLs || [item.imageUrl].filter(Boolean),
              image_url: item.imageUrl || null,
              condition: item.condition || null, // From GraphQL attribute_data (e.g., "Used - Good")
              brand: item.brand || null, // From GraphQL attribute_data or extracted from title
              size: item.size || null, // From GraphQL attribute_data if available
              category: orbenCategory || facebookCategoryName || null, // Use mapped Orben category or fallback to FB category
              facebook_item_id: item.itemId ? String(item.itemId) : null, // Store Facebook item ID for dedup
              facebook_category_id: item.categoryId || null, // Store Facebook category ID (e.g., "1670493229902393")
              facebook_category_name: facebookCategoryName || null, // Store Facebook category name if resolved
              purchase_date: new Date().toISOString(),
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
          // Existing item found — update facebook_item_id if not set yet
          if (item.itemId) {
            await supabase
              .from('inventory_items')
              .update({ facebook_item_id: String(item.itemId) })
              .eq('id', inventoryId)
              .is('facebook_item_id', null);
          }

          if (isSoldItem) {
            // Fetch current item to check quantity
            const { data: currentItem } = await supabase
              .from('inventory_items')
              .select('status, quantity, quantity_sold')
              .eq('id', inventoryId)
              .single();

            if (currentItem) {
              const qty = currentItem.quantity || 1;
              const qtySold = currentItem.quantity_sold || 0;
              const newQtySold = qtySold + 1;

              // If all units are sold, mark as 'sold'; otherwise keep 'listed'
              const newStatus = newQtySold >= qty ? 'sold' : currentItem.status;
              const updates = { quantity_sold: newQtySold };
              if (newStatus !== currentItem.status) updates.status = newStatus;

              const { error: updateError } = await supabase
                .from('inventory_items')
                .update(updates)
                .eq('id', inventoryId);

              if (updateError) {
                console.error(`⚠️ Failed to update inventory quantity/status:`, updateError);
              } else {
                console.log(`✅ Updated inventory: quantity_sold ${qtySold} → ${newQtySold}, status: ${newStatus}`);
              }
            }
          }
        }

        // Upsert marketplace_listings record to track this item<>marketplace link
        try {
          await supabase
            .from('marketplace_listings')
            .upsert(
              {
                user_id: userId,
                inventory_item_id: inventoryId,
                marketplace: 'facebook',
                marketplace_listing_id: item.itemId ? String(item.itemId) : null,
                status: isSoldItem ? 'sold' : 'active',
                listed_at: item.listingDate || item.startTime || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'inventory_item_id,marketplace' }
            );
        } catch (linkErr) {
          console.error(`⚠️ Failed to upsert marketplace_listings:`, linkErr);
        }

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
                platform: 'facebook', // Lowercase to match platformOptions
                shipping_cost: 0, // Facebook doesn't provide this
                platform_fees: 0, // Facebook doesn't provide this
                vat_fees: 0, // Facebook doesn't provide this
                profit: item.price, // Since we don't know costs, profit = sale price
                image_url: item.imageUrl || null,
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
    console.error('Error importing Facebook items:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to import Facebook items' 
    });
  }
}
