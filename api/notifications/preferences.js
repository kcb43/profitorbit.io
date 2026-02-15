/**
 * GET/POST /api/notifications/preferences
 * Get or update notification preferences
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (req.method === 'GET') {
      // Get preferences
      const { data, error } = await supabaseAdmin.rpc('get_notification_preferences', {
        p_user_id: user.id,
      });

      if (error) throw error;
      const prefs = Array.isArray(data) ? data[0] : data;

      return res.status(200).json({
        success: true,
        data: prefs,
      });
    } else if (req.method === 'POST') {
      // Update preferences
      const updates = req.body;

      // Validate allowed fields
      const allowedFields = [
        'in_app_enabled',
        'push_enabled',
        'email_enabled',
        'returns_enabled',
        'listing_nudges_enabled',
        'deals_enabled',
        'news_enabled',
        'rewards_enabled',
        'quiet_hours_enabled',
        'quiet_start_local',
        'quiet_end_local',
        'timezone',
        'deals_max_per_day',
        'listing_nudges_max_per_day',
      ];

      const filtered = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          filtered[key] = updates[key];
        }
      }

      const { data, error } = await supabaseAdmin
        .from('notification_preferences')
        .upsert(
          {
            user_id: user.id,
            ...filtered,
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data,
      });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error with notification preferences:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
