/**
 * POST /api/rewards/redeem
 * Redeem a reward (Pulse Mode, subscription credit, etc.)
 */

import { redeemReward } from '../../src/services/rewardsService';
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
    const { rewardKey, idempotencyKey, meta } = req.body;

    if (!rewardKey || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: rewardKey, idempotencyKey',
      });
    }

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

    // Redeem reward
    const result = await redeemReward({
      userId: user.id,
      rewardKey,
      idempotencyKey,
      meta,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error redeeming reward:', error);
    const status = error.message.includes('Insufficient points') || error.message.includes('cooldown')
      ? 400
      : 500;

    return res.status(status).json({
      success: false,
      error: error.message,
    });
  }
}
