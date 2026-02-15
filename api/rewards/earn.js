/**
 * POST /api/rewards/earn
 * Award points/XP for a user action
 */

import { earnRewards } from '../../src/services/rewardsService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      actionKey,
      sourceType,
      sourceId,
      idempotencyKey,
      meta,
      profitCents,
      profitItemId,
    } = req.body;

    if (!actionKey || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: actionKey, idempotencyKey',
      });
    }

    // Get user from auth header
    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Award points
    const result = await earnRewards({
      userId: user.id,
      actionKey,
      sourceType,
      sourceId,
      idempotencyKey,
      meta,
      profitCents,
      profitItemId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error earning rewards:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
