/**
 * ORBEN REWARDS SERVICE
 * 
 * Backend service for rewards system operations:
 * - Earning points/XP from actions
 * - Redeeming rewards (Pulse Mode, subscription credits)
 * - State management (streaks, tiers, multipliers)
 * - Idempotency and fraud prevention
 * 
 * This is designed for serverless (Vercel) or Fly.io API
 */

import { supabase } from '../api/supabaseClient';
import {
  REWARD_RULES,
  PROFIT_POINTS,
  DAILY_TOTAL_CAP,
  computeMultiplier,
  computeTier,
  REDIS_KEYS,
} from '../config/rewardsRules';

// =====================================================
// REDIS CLIENT (Upstash REST API for Vercel)
// =====================================================
import { redis } from '../lib/upstashRedis';

// =====================================================
// EARN REWARDS
// =====================================================

/**
 * Award points/XP for a user action (idempotent)
 * 
 * @param {Object} input
 * @param {string} input.userId - User ID
 * @param {string} input.actionKey - Action type (listing_created, item_sold, etc)
 * @param {string} [input.sourceType] - Source type (inventory, listing, sale, deal)
 * @param {string} [input.sourceId] - Source ID (e.g., listing_id, sale_id)
 * @param {string} input.idempotencyKey - Unique key to prevent duplicate awards
 * @param {Object} [input.meta] - Additional metadata
 * @param {number} [input.profitCents] - Profit amount in cents (for profit_logged)
 * @param {string} [input.profitItemId] - Item ID for profit cap tracking
 * @returns {Object} Updated rewards state
 */
export async function earnRewards(input) {
  const {
    userId,
    actionKey,
    sourceType = null,
    sourceId = null,
    idempotencyKey,
    meta = {},
    profitCents = 0,
    profitItemId = null,
  } = input;

  const rule = REWARD_RULES[actionKey];
  if (!rule) {
    throw new Error(`Unknown action key: ${actionKey}`);
  }

  // 1) Idempotency check: if event exists, return current state
  const { data: existing, error: existingError } = await supabase
    .from('rewards_events')
    .select('id')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError;
  }

  if (existing) {
    // Already processed, return current state
    return await getRewardsState(userId);
  }

  // 2) Load rewards state (create if missing)
  const { data: state, error: stateError } = await supabase.rpc('get_rewards_state', {
    p_user_id: userId,
  });

  if (stateError) throw stateError;
  const userState = Array.isArray(state) ? state[0] : state;

  // 3) Update streak based on date boundary
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const yyyymmdd = todayStr.replace(/-/g, '');

  let newStreak = userState.active_days_streak || 0;

  if (!userState.last_active_day) {
    newStreak = 1;
  } else {
    const last = new Date(userState.last_active_day);
    const diffDays = Math.floor(
      (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
        Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())) /
        86400000
    );

    if (diffDays === 0) {
      // Same day: streak unchanged
      newStreak = userState.active_days_streak;
    } else if (diffDays === 1) {
      // Consecutive day
      newStreak = userState.active_days_streak + 1;
    } else {
      // Streak broken
      newStreak = 1;
    }
  }

  const multiplier = computeMultiplier(newStreak);

  // 4) Calculate points/XP (profit adds dynamic points)
  let pointsBase = rule.points;
  const xpDelta = rule.xp;

  if (actionKey === 'profit_logged') {
    const profitDollars = Math.max(0, Math.floor(profitCents / 100));
    const dynamicPoints = Math.min(
      profitDollars * PROFIT_POINTS.perDollar,
      PROFIT_POINTS.perItemCap
    );
    pointsBase += dynamicPoints;
  }

  // 5) Apply multiplier to points only (XP stays as-is for "progress")
  let pointsDelta = Math.floor(pointsBase * multiplier);

  // 6) Apply caps (per-action daily cap + global daily cap)
  const dailyKey = REDIS_KEYS.DAILY_EARN(userId, yyyymmdd);
  const currentDaily = parseInt((await redis.get(dailyKey)) || '0', 10);

  if (currentDaily >= DAILY_TOTAL_CAP) {
    // Hit global daily cap: award XP only, no points
    pointsDelta = 0;
  } else {
    // Check per-action cap
    if (rule.dailyCapPoints) {
      const actionKey2 = REDIS_KEYS.ACTION_COUNT(userId, actionKey, yyyymmdd);
      const actionPointsToday = parseInt((await redis.get(actionKey2)) || '0', 10);
      const remaining = Math.max(0, rule.dailyCapPoints - actionPointsToday);
      pointsDelta = Math.min(pointsDelta, remaining);

      // Update action counter
      await redis.setex(actionKey2, 60 * 60 * 48, String(actionPointsToday + pointsDelta));
    }

    // Check global cap
    const allowed = Math.min(pointsDelta, DAILY_TOTAL_CAP - currentDaily);
    pointsDelta = allowed;

    // Update daily total
    await redis.setex(dailyKey, 60 * 60 * 48, String(currentDaily + pointsDelta));
  }

  // 7) Insert ledger event
  const { error: eventError } = await supabase.from('rewards_events').insert({
    user_id: userId,
    event_type: 'EARN',
    action_key: actionKey,
    points_delta: pointsDelta,
    xp_delta: xpDelta,
    source_type: sourceType,
    source_id: sourceId,
    idempotency_key: idempotencyKey,
    meta: { ...meta, multiplier, streak: newStreak },
  });

  if (eventError) throw eventError;

  // 8) Update state atomically
  const { error: updateError } = await supabase.rpc('apply_rewards_deltas', {
    p_user_id: userId,
    p_points_delta: pointsDelta,
    p_xp_delta: xpDelta,
    p_new_streak: newStreak,
    p_last_active_day: todayStr,
    p_multiplier: multiplier,
  });

  if (updateError) throw updateError;

  // 9) Check for tier change & create notification if needed
  const newXpTotal = (userState.xp_total || 0) + xpDelta;
  const oldTier = userState.tier;
  const newTier = computeTier(newXpTotal);

  if (newTier !== oldTier) {
    await createNotification({
      userId,
      type: 'tier_up',
      title: `🎉 Tier Up! You're now ${newTier.toUpperCase()}`,
      body: `You've reached ${newXpTotal.toLocaleString()} XP and unlocked ${newTier} tier benefits!`,
      deepLink: 'orben://rewards',
      meta: { oldTier, newTier, xp: newXpTotal },
    });
  }

  // 10) Return updated state
  return await getRewardsState(userId);
}

// =====================================================
// GET REWARDS STATE
// =====================================================

/**
 * Get current rewards state for a user
 */
export async function getRewardsState(userId) {
  const { data, error } = await supabase.rpc('get_rewards_state', {
    p_user_id: userId,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

// =====================================================
// REDEEM REWARD
// =====================================================

/**
 * Redeem a reward (Pulse Mode, subscription credit, etc.)
 * 
 * @param {Object} input
 * @param {string} input.userId - User ID
 * @param {string} input.rewardKey - Reward key (pulse_mode_7d, sub_credit_5, etc)
 * @param {string} input.idempotencyKey - Unique key for this redemption
 * @param {Object} [input.meta] - Additional metadata
 * @returns {Object} Redemption result
 */
export async function redeemReward(input) {
  const { userId, rewardKey, idempotencyKey, meta = {} } = input;

  // 1) Check idempotency
  const { data: existing, error: existingError } = await supabase
    .from('rewards_redemptions')
    .select('*')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError;
  }

  if (existing) {
    return { success: existing.status === 'fulfilled', redemption: existing };
  }

  // 2) Get reward from catalog
  const { data: reward, error: rewardError } = await supabase
    .from('rewards_catalog')
    .select('*')
    .eq('reward_key', rewardKey)
    .eq('active', true)
    .single();

  if (rewardError || !reward) {
    throw new Error('Reward not found or inactive');
  }

  // 3) Check cooldown (Redis)
  const cooldownKey = REDIS_KEYS.COOLDOWN(userId, rewardKey);
  const cooldownUntil = await redis.get(cooldownKey);

  if (cooldownUntil) {
    const cooldownDate = new Date(parseInt(cooldownUntil, 10));
    if (cooldownDate > new Date()) {
      throw new Error(`Reward on cooldown until ${cooldownDate.toISOString()}`);
    }
  }

  // 4) Check user balance and subscription status (TODO: add subscription check)
  const state = await getRewardsState(userId);

  if (state.points_balance < reward.points_cost) {
    throw new Error('Insufficient points');
  }

  // 5) Deduct points atomically
  const { data: deductSuccess, error: deductError } = await supabase.rpc('deduct_points', {
    p_user_id: userId,
    p_points: reward.points_cost,
  });

  if (deductError || !deductSuccess) {
    throw new Error('Failed to deduct points (insufficient balance)');
  }

  // 6) Create redemption record
  const { data: redemption, error: redemptionError } = await supabase
    .from('rewards_redemptions')
    .insert({
      user_id: userId,
      reward_key: rewardKey,
      points_spent: reward.points_cost,
      status: 'pending',
      idempotency_key: idempotencyKey,
      meta,
    })
    .select()
    .single();

  if (redemptionError) throw redemptionError;

  // 7) Create ledger event
  await supabase.from('rewards_events').insert({
    user_id: userId,
    event_type: 'REDEEM',
    action_key: rewardKey,
    points_delta: -reward.points_cost,
    xp_delta: 0,
    source_type: 'redemption',
    source_id: redemption.id,
    idempotency_key: `redeem:${idempotencyKey}`,
    meta: { rewardKey, rewardName: reward.name },
  });

  // 8) Fulfill the reward
  try {
    if (rewardKey === 'pulse_mode_7d') {
      // Activate Pulse Mode
      const durationDays = reward.payload.duration_days || 7;
      await supabase.rpc('activate_pulse_mode', {
        p_user_id: userId,
        p_duration_days: durationDays,
      });

      // Create notification
      await createNotification({
        userId,
        type: 'pulse_mode',
        title: '🔥 Pulse Mode Activated!',
        body: `You'll receive priority deal alerts for the next ${durationDays} days.`,
        deepLink: 'orben://deals?tab=pulse',
        meta: { durationDays, expiresAt: new Date(Date.now() + durationDays * 86400000).toISOString() },
      });

      // Set cooldown
      const cooldownEnd = Date.now() + reward.cooldown_days * 86400000;
      await redis.setex(cooldownKey, reward.cooldown_days * 86400, String(cooldownEnd));
    } else if (rewardKey.startsWith('sub_credit_')) {
      // Apply subscription credit (TODO: integrate with Stripe)
      const creditCents = reward.payload.credit_cents || 0;

      // For now, just mark as fulfilled and create notification
      await createNotification({
        userId,
        type: 'credit_applied',
        title: '💰 Credit Applied!',
        body: `$${(creditCents / 100).toFixed(2)} credit will be applied to your next renewal.`,
        deepLink: 'orben://settings',
        meta: { creditCents },
      });

      // Set cooldown
      const cooldownEnd = Date.now() + reward.cooldown_days * 86400000;
      await redis.setex(cooldownKey, reward.cooldown_days * 86400, String(cooldownEnd));
    }

    // Mark redemption as fulfilled
    await supabase
      .from('rewards_redemptions')
      .update({ status: 'fulfilled' })
      .eq('id', redemption.id);

    return { success: true, redemption: { ...redemption, status: 'fulfilled' } };
  } catch (error) {
    // Fulfillment failed: mark as failed and refund points
    await supabase
      .from('rewards_redemptions')
      .update({ status: 'failed', failure_reason: error.message })
      .eq('id', redemption.id);

    // Refund points
    await supabase.rpc('apply_rewards_deltas', {
      p_user_id: userId,
      p_points_delta: reward.points_cost,
      p_xp_delta: 0,
      p_new_streak: state.active_days_streak,
      p_last_active_day: state.last_active_day,
      p_multiplier: state.points_multiplier,
    });

    // Create refund event
    await supabase.from('rewards_events').insert({
      user_id: userId,
      event_type: 'ADJUST',
      action_key: 'refund',
      points_delta: reward.points_cost,
      xp_delta: 0,
      source_type: 'redemption',
      source_id: redemption.id,
      idempotency_key: `refund:${idempotencyKey}`,
      meta: { reason: 'Redemption failed', error: error.message },
    });

    throw new Error(`Redemption failed: ${error.message}`);
  }
}

// =====================================================
// GET REWARDS CATALOG
// =====================================================

/**
 * Get available rewards catalog with eligibility info
 */
export async function getRewardsCatalog(userId) {
  const { data: catalog, error: catalogError } = await supabase
    .from('rewards_catalog')
    .select('*')
    .eq('active', true)
    .order('sort_order');

  if (catalogError) throw catalogError;

  const state = await getRewardsState(userId);

  // Add eligibility info
  const enriched = await Promise.all(
    catalog.map(async (reward) => {
      const cooldownKey = REDIS_KEYS.COOLDOWN(userId, reward.reward_key);
      const cooldownUntil = await redis.get(cooldownKey);

      return {
        ...reward,
        eligible: state.points_balance >= reward.points_cost,
        cooldownUntil: cooldownUntil ? new Date(parseInt(cooldownUntil, 10)).toISOString() : null,
        onCooldown: cooldownUntil && new Date(parseInt(cooldownUntil, 10)) > new Date(),
      };
    })
  );

  return enriched;
}

// =====================================================
// GET REWARDS EVENTS
// =====================================================

/**
 * Get user's rewards event history
 */
export async function getRewardsEvents(userId, limit = 50) {
  const { data, error } = await supabase
    .from('rewards_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// =====================================================
// CREATE NOTIFICATION
// =====================================================

/**
 * Create an in-app notification
 */
export async function createNotification(input) {
  const { userId, type, title, body, deepLink = null, meta = {} } = input;

  const { data, error } = await supabase
    .from('user_notifications')
    .insert({
      user_id: userId,
      type,
      title,
      body,
      deep_link: deepLink,
      meta,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =====================================================
// HELPER: Generate idempotency key
// =====================================================

/**
 * Generate standardized idempotency key
 */
export function generateIdempotencyKey(actionKey, sourceType, sourceId) {
  return `${actionKey}:${sourceType}:${sourceId}`;
}

// =====================================================
// EXPORT ALL
// =====================================================

export default {
  earnRewards,
  getRewardsState,
  redeemReward,
  getRewardsCatalog,
  getRewardsEvents,
  createNotification,
  generateIdempotencyKey,
};
