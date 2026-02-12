import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

/**
 * API endpoint for managing item groups
 * Supports: GET (list groups), POST (create group), PUT (update group), DELETE (delete group)
 */
export default async function handler(req, res) {
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

    // GET - List all groups for the user
    if (req.method === 'GET') {
      const { group_type } = req.query;

      let query = supabase
        .from('item_groups')
        .select(`
          *,
          item_group_members(
            item_id,
            added_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (group_type) {
        query = query.eq('group_type', group_type);
      }

      const { data: groups, error: fetchError } = await query;

      if (fetchError) {
        console.error('❌ Error fetching groups:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch groups' });
      }

      // Add member count to each group
      const groupsWithCounts = groups.map(group => ({
        ...group,
        member_count: group.item_group_members?.length || 0
      }));

      return res.status(200).json({
        success: true,
        groups: groupsWithCounts
      });
    }

    // POST - Create a new group
    if (req.method === 'POST') {
      const { group_name, group_type = 'inventory', color, item_ids = [] } = req.body;

      if (!group_name) {
        return res.status(400).json({ error: 'group_name is required' });
      }

      console.log('📂 Creating new group:', { group_name, group_type, color, item_count: item_ids.length });

      // Create the group
      const { data: newGroup, error: createError } = await supabase
        .from('item_groups')
        .insert({
          user_id: userId,
          group_name,
          group_type,
          color
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating group:', createError);
        return res.status(500).json({ error: 'Failed to create group' });
      }

      console.log('✅ Created group:', newGroup.id);

      // Add items to the group if provided
      if (item_ids.length > 0) {
        const members = item_ids.map(item_id => ({
          group_id: newGroup.id,
          item_id
        }));

        const { error: membersError } = await supabase
          .from('item_group_members')
          .insert(members);

        if (membersError) {
          console.error('❌ Error adding group members:', membersError);
          // Don't fail the whole request, group is still created
        } else {
          console.log(`✅ Added ${item_ids.length} items to group`);
        }
      }

      return res.status(200).json({
        success: true,
        group: newGroup
      });
    }

    // PUT - Update a group (name, color, add/remove items)
    if (req.method === 'PUT') {
      const { group_id, group_name, color, add_items = [], remove_items = [] } = req.body;

      if (!group_id) {
        return res.status(400).json({ error: 'group_id is required' });
      }

      console.log('📝 Updating group:', { group_id, group_name, color, add: add_items.length, remove: remove_items.length });

      // Verify group belongs to user
      const { data: existingGroup, error: verifyError } = await supabase
        .from('item_groups')
        .select('id')
        .eq('id', group_id)
        .eq('user_id', userId)
        .single();

      if (verifyError || !existingGroup) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Update group metadata if provided
      if (group_name || color) {
        const updates = {};
        if (group_name) updates.group_name = group_name;
        if (color) updates.color = color;

        const { error: updateError } = await supabase
          .from('item_groups')
          .update(updates)
          .eq('id', group_id)
          .eq('user_id', userId);

        if (updateError) {
          console.error('❌ Error updating group:', updateError);
          return res.status(500).json({ error: 'Failed to update group' });
        }

        console.log('✅ Updated group metadata');
      }

      // Add items to group
      if (add_items.length > 0) {
        const members = add_items.map(item_id => ({
          group_id,
          item_id
        }));

        const { error: addError } = await supabase
          .from('item_group_members')
          .upsert(members, { onConflict: 'group_id,item_id' });

        if (addError) {
          console.error('❌ Error adding members:', addError);
        } else {
          console.log(`✅ Added ${add_items.length} items to group`);
        }
      }

      // Remove items from group
      if (remove_items.length > 0) {
        const { error: removeError } = await supabase
          .from('item_group_members')
          .delete()
          .eq('group_id', group_id)
          .in('item_id', remove_items);

        if (removeError) {
          console.error('❌ Error removing members:', removeError);
        } else {
          console.log(`✅ Removed ${remove_items.length} items from group`);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Group updated successfully'
      });
    }

    // DELETE - Delete a group
    if (req.method === 'DELETE') {
      const { group_id } = req.body;

      if (!group_id) {
        return res.status(400).json({ error: 'group_id is required' });
      }

      console.log('🗑️ Deleting group:', group_id);

      // Delete the group (members will be cascade deleted)
      const { error: deleteError } = await supabase
        .from('item_groups')
        .delete()
        .eq('id', group_id)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('❌ Error deleting group:', deleteError);
        return res.status(500).json({ error: 'Failed to delete group' });
      }

      console.log('✅ Deleted group');

      return res.status(200).json({
        success: true,
        message: 'Group deleted successfully'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Groups API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
