/**
 * Profile API Endpoint
 * Handles getting and updating user profiles
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Get user from session
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // GET - Fetch user profile
  if (req.method === 'GET') {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      return res.status(200).json(profile);

    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  // PUT - Update user profile
  if (req.method === 'PUT') {
    try {
      const { display_name, avatar_seed, avatar_type, avatar_url } = req.body;

      // Validate
      if (!display_name?.trim()) {
        return res.status(400).json({ error: 'Display name is required' });
      }

      if (display_name.trim().length > 50) {
        return res.status(400).json({ error: 'Display name too long (max 50 characters)' });
      }

      // Update profile
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: display_name.trim(),
          avatar_seed: avatar_seed || 'Felix',
          avatar_type: avatar_type || 'dicebear',
          avatar_url: avatar_type === 'custom' ? avatar_url : null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json(data);

    } catch (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
