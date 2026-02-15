/**
 * GET /api/rewards/catalog
 * Get available rewards catalog with eligibility
 */

import { createClient } from '@supabase/supabase-js';
import { redis } from '../../src/lib/upstashRedis';
import { REDIS_KEYS } from '../../src/config/rewardsRules';

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

    // Get catalog
    const { data: catalog, error: catalogError } = await supabaseAdmin
      .from('rewards_catalog')
      .select('*')
      .eq('active', true)
      .order('sort_order');

    if (catalogError) throw catalogError;

    // Get user state
    const { data: stateData, error: stateError } = await supabaseAdmin.rpc('get_rewards_state', {
      p_user_id: user.id
    });

    if (stateError) throw stateError;
    const state = Array.isArray(stateData) ? stateData[0] : stateData;

    // Enrich with eligibility
    const enriched = await Promise.all(
      catalog.map(async (reward) => {
        const cooldownKey = REDIS_KEYS.COOLDOWN(user.id, reward.reward_key);
        const cooldownUntil = await redis.get(cooldownKey);

        return {
          ...reward,
          eligible: state.points_balance >= reward.points_cost,
          cooldownUntil: cooldownUntil ? new Date(parseInt(cooldownUntil, 10)).toISOString() : null,
          onCooldown: cooldownUntil && new Date(parseInt(cooldownUntil, 10)) > new Date(),
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    console.error('Error getting catalog:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
