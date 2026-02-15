/**
 * POST /api/notifications/read
 * Mark notifications as read
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    const { notificationIds, markAll } = req.body;

    let count;
    if (markAll) {
      const { data, error } = await supabaseAdmin.rpc('mark_all_notifications_read', {
        p_user_id: user.id,
      });
      if (error) throw error;
      count = data;
    } else if (notificationIds && Array.isArray(notificationIds)) {
      const { data, error } = await supabaseAdmin.rpc('mark_notifications_read', {
        p_user_id: user.id,
        p_notification_ids: notificationIds,
      });
      if (error) throw error;
      count = data;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Missing notificationIds or markAll flag',
      });
    }

    return res.status(200).json({
      success: true,
      data: { updatedCount: count },
    });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
