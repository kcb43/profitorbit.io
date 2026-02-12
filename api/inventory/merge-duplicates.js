import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

/**
 * API endpoint to merge duplicate inventory items
 * POST /api/inventory/merge-duplicates
 * Body: {
 *   primaryItemId: UUID,
 *   duplicateItemIds: UUID[],
 *   action: 'link' | 'merge_and_delete'
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
    const { primaryItemId, duplicateItemIds, action = 'link' } = req.body;

    console.log('🔗 Merge duplicates request:', { userId, primaryItemId, duplicateItemIds, action });

    if (!primaryItemId || !duplicateItemIds || !Array.isArray(duplicateItemIds) || duplicateItemIds.length === 0) {
      return res.status(400).json({ error: 'Invalid request: primaryItemId and duplicateItemIds array required' });
    }

    // Verify all items belong to the user
    const { data: allItems, error: itemsError } = await supabase
      .from('inventory_items')
      .select('id, item_name, photos, description, brand, size, condition, purchase_price, purchase_date, status, quantity')
      .in('id', [primaryItemId, ...duplicateItemIds])
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (itemsError) {
      console.error('❌ Error fetching items:', itemsError);
      return res.status(500).json({ error: 'Failed to fetch items' });
    }

    if (!allItems || allItems.length !== (duplicateItemIds.length + 1)) {
      return res.status(404).json({ error: 'One or more items not found or do not belong to user' });
    }

    const primaryItem = allItems.find(item => item.id === primaryItemId);
    const duplicateItems = allItems.filter(item => duplicateItemIds.includes(item.id));

    console.log('✅ Found primary item:', primaryItem.item_name);
    console.log('✅ Found duplicate items:', duplicateItems.map(i => i.item_name));

    if (action === 'merge_and_delete') {
      // Merge data from duplicates into primary item
      console.log('🔄 Merging data and deleting duplicates...');
      
      // Collect all unique photos
      let allPhotos = [];
      if (primaryItem.photos && Array.isArray(primaryItem.photos)) {
        allPhotos = [...primaryItem.photos];
      }
      
      for (const dup of duplicateItems) {
        if (dup.photos && Array.isArray(dup.photos)) {
          for (const photo of dup.photos) {
            if (!allPhotos.includes(photo)) {
              allPhotos.push(photo);
            }
          }
        }
      }

      // Merge additional fields if primary item is missing them
      const mergedData = {
        photos: allPhotos.length > 0 ? allPhotos : primaryItem.photos,
      };

      // Only update fields that are empty/null in primary item
      if (!primaryItem.description) {
        const dupWithDesc = duplicateItems.find(d => d.description);
        if (dupWithDesc) mergedData.description = dupWithDesc.description;
      }

      if (!primaryItem.brand) {
        const dupWithBrand = duplicateItems.find(d => d.brand);
        if (dupWithBrand) mergedData.brand = dupWithBrand.brand;
      }

      if (!primaryItem.size) {
        const dupWithSize = duplicateItems.find(d => d.size);
        if (dupWithSize) mergedData.size = dupWithSize.size;
      }

      if (!primaryItem.condition) {
        const dupWithCondition = duplicateItems.find(d => d.condition);
        if (dupWithCondition) mergedData.condition = dupWithCondition.condition;
      }

      // Sum quantities
      const totalQuantity = duplicateItems.reduce((sum, item) => sum + (item.quantity || 1), primaryItem.quantity || 1);
      mergedData.quantity = totalQuantity;

      console.log('📊 Merged data:', mergedData);

      // Update primary item with merged data
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update(mergedData)
        .eq('id', primaryItemId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ Error updating primary item:', updateError);
        return res.status(500).json({ error: 'Failed to update primary item' });
      }

      // Soft delete duplicate items
      const { error: deleteError } = await supabase
        .from('inventory_items')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', duplicateItemIds)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('❌ Error deleting duplicate items:', deleteError);
        return res.status(500).json({ error: 'Failed to delete duplicate items' });
      }

      console.log('✅ Merged and deleted duplicates');

      return res.status(200).json({
        success: true,
        action: 'merge_and_delete',
        primaryItemId,
        mergedCount: duplicateItemIds.length,
        mergedData
      });

    } else {
      // Just link items without deleting
      console.log('🔗 Linking duplicate items...');
      
      const linksToCreate = duplicateItemIds.map(dupId => ({
        user_id: userId,
        primary_item_id: primaryItemId,
        linked_item_id: dupId,
        link_type: 'duplicate'
      }));

      const { error: linkError } = await supabase
        .from('item_links')
        .upsert(linksToCreate, { 
          onConflict: 'primary_item_id,linked_item_id',
          ignoreDuplicates: false 
        });

      if (linkError) {
        console.error('❌ Error creating links:', linkError);
        return res.status(500).json({ error: 'Failed to create item links' });
      }

      console.log('✅ Created item links');

      return res.status(200).json({
        success: true,
        action: 'link',
        primaryItemId,
        linkedCount: duplicateItemIds.length
      });
    }

  } catch (error) {
    console.error('❌ Merge duplicates error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
