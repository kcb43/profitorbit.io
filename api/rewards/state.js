/**
 * GET /api/rewards/state
 * Get current rewards state for authenticated user
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

    // Get rewards state
    const { data, error } = await supabaseAdmin.rpc('get_rewards_state', {
      p_user_id: user.id
    });

    if (error) throw error;

    const state = Array.isArray(data) ? data[0] : data;

    return res.status(200).json({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error('Error getting rewards state:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
