/**
 * POST /api/notifications/device-token
 * Register or update device token for push notifications
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

    const { platform, token: deviceToken, deviceId } = req.body;

    if (!platform || !deviceToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: platform, token',
      });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid platform (must be ios, android, or web)',
      });
    }

    // Register token
    const { data, error } = await supabaseAdmin.rpc('register_device_token', {
      p_user_id: user.id,
      p_platform: platform,
      p_token: deviceToken,
      p_device_id: deviceId,
    });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: { tokenId: data },
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
