import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

/**
 * API endpoint to check for duplicate inventory items
 * POST /api/inventory/check-duplicates
 * Body: {
 *   itemIds: UUID[] (optional - checks specific items)
 *   checkAll: boolean (optional - checks all items)
 * }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get user ID from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = user.id;
    const { itemIds, checkAll = false } = req.body;

    console.log('🔍 Check duplicates request:', { userId, itemIds, checkAll });

    // Get items to check
    let itemsToCheck;
    if (checkAll) {
      const { data: allItems, error: fetchError } = await supabase
        .from('inventory_items')
        .select('id, item_name, ebay_item_id, mercari_item_id, facebook_item_id')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (fetchError) {
        console.error('❌ Error fetching items:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch items' });
      }

      itemsToCheck = allItems;
    } else if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      const { data: selectedItems, error: fetchError } = await supabase
        .from('inventory_items')
        .select('id, item_name, ebay_item_id, mercari_item_id, facebook_item_id')
        .in('id', itemIds)
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (fetchError) {
        console.error('❌ Error fetching items:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch items' });
      }

      itemsToCheck = selectedItems;
    } else {
      return res.status(400).json({ error: 'Invalid request: itemIds array or checkAll required' });
    }

    console.log(`✅ Checking ${itemsToCheck.length} items for duplicates`);

    // Get existing links to exclude already-linked items
    const { data: existingLinks } = await supabase
      .from('item_links')
      .select('primary_item_id, linked_item_id')
      .eq('user_id', userId);

    const linkedPairs = new Set(
      (existingLinks || []).map(link => `${link.primary_item_id}:${link.linked_item_id}`)
    );

    // Get all inventory items for comparison
    const { data: allInventoryItems, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('id, item_name, ebay_item_id, mercari_item_id, facebook_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (inventoryError) {
      console.error('❌ Error fetching inventory:', inventoryError);
      return res.status(500).json({ error: 'Failed to fetch inventory' });
    }

    // Build a map for fast lookups
    const inventoryMap = new Map(allInventoryItems.map(item => [item.id, item]));

    // Check each item for duplicates
    const duplicatesFound = {};

    for (const item of itemsToCheck) {
      const potentialDuplicates = [];

      // Check each other item
      for (const compareItem of allInventoryItems) {
        if (compareItem.id === item.id) continue; // Skip self

        // Skip if already linked
        const pairKey1 = `${item.id}:${compareItem.id}`;
        const pairKey2 = `${compareItem.id}:${item.id}`;
        if (linkedPairs.has(pairKey1) || linkedPairs.has(pairKey2)) {
          continue;
        }

        // Check for marketplace ID matches (exact duplicate)
        if (item.ebay_item_id && item.ebay_item_id === compareItem.ebay_item_id) {
          potentialDuplicates.push({
            id: compareItem.id,
            item_name: compareItem.item_name,
            similarity: 100,
            reason: 'Same eBay Item ID'
          });
          continue;
        }

        if (item.mercari_item_id && item.mercari_item_id === compareItem.mercari_item_id) {
          potentialDuplicates.push({
            id: compareItem.id,
            item_name: compareItem.item_name,
            similarity: 100,
            reason: 'Same Mercari Item ID'
          });
          continue;
        }

        if (item.facebook_item_id && item.facebook_item_id === compareItem.facebook_item_id) {
          potentialDuplicates.push({
            id: compareItem.id,
            item_name: compareItem.item_name,
            similarity: 100,
            reason: 'Same Facebook Item ID'
          });
          continue;
        }

        // Check for title similarity
        const itemTitle = item.item_name.toLowerCase();
        const compareTitle = compareItem.item_name.toLowerCase();
        
        const itemWords = itemTitle.split(/\s+/).filter(w => w.length > 2);
        const compareWords = compareTitle.split(/\s+/).filter(w => w.length > 2);
        
        const itemSet = new Set(itemWords);
        const compareSet = new Set(compareWords);
        const commonWords = [...itemSet].filter(w => compareSet.has(w));
        
        const maxWords = Math.max(itemSet.size, compareSet.size);
        const similarity = maxWords > 0 ? (commonWords.length / maxWords) * 100 : 0;
        
        if (similarity >= 40) {
          potentialDuplicates.push({
            id: compareItem.id,
            item_name: compareItem.item_name,
            similarity: Math.round(similarity),
            reason: 'Similar title'
          });
        }
      }

      if (potentialDuplicates.length > 0) {
        duplicatesFound[item.id] = {
          item_name: item.item_name,
          duplicate_count: potentialDuplicates.length,
          duplicates: potentialDuplicates.sort((a, b) => b.similarity - a.similarity).slice(0, 5) // Top 5
        };
      }
    }

    console.log(`✅ Found duplicates for ${Object.keys(duplicatesFound).length} items`);

    return res.status(200).json({
      success: true,
      checked: itemsToCheck.length,
      duplicatesFound: Object.keys(duplicatesFound).length,
      duplicates: duplicatesFound
    });

  } catch (error) {
    console.error('❌ Check duplicates error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
