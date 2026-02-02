import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Find duplicate inventory items based on:
 * 1. Same marketplace item ID (ebay_item_id, facebook_item_id, mercari_item_id)
 * 2. Same title (normalized, case-insensitive)
 * 
 * Returns groups of duplicates with their metadata
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = user.id;

    // For POST, check specific item for duplicates
    if (req.method === 'POST') {
      const { itemId, itemName, ebayItemId, facebookItemId, mercariItemId } = req.body;

      console.log('🔍 Checking for duplicates:', {
        itemId,
        itemName: itemName?.substring(0, 50),
        ebayItemId,
        facebookItemId,
        mercariItemId
      });

      const duplicates = [];

      // Check by marketplace ID first (most reliable)
      if (ebayItemId) {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('user_id', userId)
          .eq('ebay_item_id', ebayItemId)
          .is('deleted_at', null);

        if (!error && data) {
          // Exclude the item itself
          const others = data.filter(item => item.id !== itemId);
          duplicates.push(...others);
        }
      }

      if (facebookItemId) {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('user_id', userId)
          .eq('facebook_item_id', facebookItemId)
          .is('deleted_at', null);

        if (!error && data) {
          const others = data.filter(item => item.id !== itemId);
          duplicates.push(...others);
        }
      }

      if (mercariItemId) {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('user_id', userId)
          .eq('mercari_item_id', mercariItemId)
          .is('deleted_at', null);

        if (!error && data) {
          const others = data.filter(item => item.id !== itemId);
          duplicates.push(...others);
        }
      }

      // Also check by normalized title (fuzzy match)
      if (itemName && duplicates.length === 0) {
        const normalizedName = itemName.toLowerCase().trim();
        
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (!error && data) {
          const titleMatches = data.filter(item => {
            if (item.id === itemId) return false;
            const otherName = item.item_name?.toLowerCase().trim() || '';
            // Exact match or very close (Levenshtein distance < 10% of length)
            return otherName === normalizedName || 
                   (Math.abs(otherName.length - normalizedName.length) < normalizedName.length * 0.1 &&
                    otherName.includes(normalizedName.substring(0, Math.floor(normalizedName.length * 0.7))));
          });
          
          duplicates.push(...titleMatches);
        }
      }

      // Deduplicate results (in case same item matched multiple criteria)
      const uniqueDuplicates = Array.from(
        new Map(duplicates.map(item => [item.id, item])).values()
      );

      console.log(`✅ Found ${uniqueDuplicates.length} duplicates`);

      return res.status(200).json({
        hasDuplicates: uniqueDuplicates.length > 0,
        count: uniqueDuplicates.length,
        duplicates: uniqueDuplicates
      });
    }

    // For GET, return all duplicate groups across entire inventory
    const { data: allItems, error: fetchError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching inventory:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch inventory' });
    }

    // Group by marketplace IDs and normalized titles
    const duplicateGroups = [];
    const processedIds = new Set();

    for (const item of allItems) {
      if (processedIds.has(item.id)) continue;

      const group = [item];
      processedIds.add(item.id);

      // Find all items matching this item's criteria
      for (const otherItem of allItems) {
        if (processedIds.has(otherItem.id)) continue;

        let isDuplicate = false;

        // Check marketplace IDs
        if (item.ebay_item_id && otherItem.ebay_item_id === item.ebay_item_id) {
          isDuplicate = true;
        } else if (item.facebook_item_id && otherItem.facebook_item_id === item.facebook_item_id) {
          isDuplicate = true;
        } else if (item.mercari_item_id && otherItem.mercari_item_id === item.mercari_item_id) {
          isDuplicate = true;
        } else {
          // Check normalized title
          const name1 = item.item_name?.toLowerCase().trim() || '';
          const name2 = otherItem.item_name?.toLowerCase().trim() || '';
          if (name1 && name2 && name1 === name2) {
            isDuplicate = true;
          }
        }

        if (isDuplicate) {
          group.push(otherItem);
          processedIds.add(otherItem.id);
        }
      }

      // Only include groups with 2+ items
      if (group.length > 1) {
        duplicateGroups.push({
          key: item.ebay_item_id || item.facebook_item_id || item.mercari_item_id || item.item_name,
          count: group.length,
          items: group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) // Oldest first
        });
      }
    }

    console.log(`📊 Found ${duplicateGroups.length} duplicate groups`);

    return res.status(200).json({
      groups: duplicateGroups,
      totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.count, 0)
    });

  } catch (error) {
    console.error('Error in duplicates API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
