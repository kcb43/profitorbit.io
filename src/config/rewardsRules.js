/**
 * ORBEN REWARDS RULES
 * 
 * Defines point/XP earning rules, caps, and tier thresholds.
 * Used by both frontend (display) and backend (calculation).
 */

// =====================================================
// ACTION DEFINITIONS
// =====================================================
// Maps user actions to point/XP rewards and daily caps

export const REWARD_RULES = {
  listing_created: {
    points: 10,
    xp: 10,
    dailyCapPoints: 300, // Max 30 listings/day counted for points
    description: 'Create a new listing',
  },
  
  crosslist_created: {
    points: 5,
    xp: 5,
    dailyCapPoints: 200, // Max 40 crosslistings/day counted
    description: 'Crosslist to another marketplace',
  },
  
  inventory_added: {
    points: 5,
    xp: 5,
    dailyCapPoints: 200, // Max 40 items added/day counted
    description: 'Add item to inventory',
  },
  
  item_sold: {
    points: 25,
    xp: 30,
    dailyCapPoints: 400, // Max ~16 sales/day counted (prevents fraud)
    requiresVerification: true, // Requires sale record in DB
    description: 'Sell an item',
  },
  
  deal_submitted: {
    points: 15,
    xp: 15,
    dailyCapPoints: 150, // Max 10 submissions/day counted
    description: 'Submit a deal',
  },
  
  deal_approved: {
    points: 50,
    xp: 60,
    dailyCapPoints: 200, // Max 4 approvals/day counted
    requiresVerification: true, // Requires admin approval
    description: 'Deal approved by admin',
  },
  
  profit_logged: {
    points: 0, // Dynamic based on profit amount (see PROFIT_POINTS)
    xp: 10,
    dailyCapPoints: 500, // Max profit points per day
    description: 'Log profit from a sale',
  },
};

// =====================================================
// PROFIT-BASED POINTS
// =====================================================
// Dynamic points based on profit amount

export const PROFIT_POINTS = {
  perDollar: 1,      // +1 OP per $1 profit
  perItemCap: 100,   // Max 100 points per item (caps at $100 profit)
};

// =====================================================
// DAILY CAPS
// =====================================================

export const DAILY_TOTAL_CAP = 1500; // Global daily cap across all actions

// =====================================================
// STREAK MULTIPLIERS
// =====================================================
// Consecutive active days → points multiplier
// (XP is NOT multiplied - it's "progress", not "earnings")

export const STREAK_THRESHOLDS = [
  { days: 90, multiplier: 1.5, label: '90+ days' },
  { days: 30, multiplier: 1.25, label: '30+ days' },
  { days: 7, multiplier: 1.1, label: '7+ days' },
  { days: 1, multiplier: 1.0, label: '1+ days' },
];

/**
 * Calculate multiplier based on streak days
 */
export function computeMultiplier(streakDays) {
  for (const threshold of STREAK_THRESHOLDS) {
    if (streakDays >= threshold.days) {
      return threshold.multiplier;
    }
  }
  return 1.0;
}

// =====================================================
// XP TIER THRESHOLDS
// =====================================================
// Total XP → Tier level

export const TIER_THRESHOLDS = [
  { tier: 'platinum', minXp: 250000, color: '#E5E4E2', label: 'Platinum' },
  { tier: 'gold', minXp: 75000, color: '#FFD700', label: 'Gold' },
  { tier: 'silver', minXp: 20000, color: '#C0C0C0', label: 'Silver' },
  { tier: 'bronze', minXp: 0, color: '#CD7F32', label: 'Bronze' },
];

/**
 * Calculate tier based on total XP
 */
export function computeTier(xpTotal) {
  for (const threshold of TIER_THRESHOLDS) {
    if (xpTotal >= threshold.minXp) {
      return threshold.tier;
    }
  }
  return 'bronze';
}

/**
 * Get tier details including next tier progress
 */
export function getTierInfo(xpTotal) {
  const currentTier = computeTier(xpTotal);
  const currentTierData = TIER_THRESHOLDS.find(t => t.tier === currentTier);
  const currentTierIndex = TIER_THRESHOLDS.findIndex(t => t.tier === currentTier);
  
  // Find next tier (if exists)
  const nextTier = currentTierIndex > 0 ? TIER_THRESHOLDS[currentTierIndex - 1] : null;
  
  if (!nextTier) {
    // Already at max tier
    return {
      current: currentTierData,
      next: null,
      progress: 100,
      xpNeeded: 0,
      xpInTier: xpTotal - currentTierData.minXp,
    };
  }
  
  const xpInTier = xpTotal - currentTierData.minXp;
  const xpNeeded = nextTier.minXp - xpTotal;
  const tierRange = nextTier.minXp - currentTierData.minXp;
  const progress = (xpInTier / tierRange) * 100;
  
  return {
    current: currentTierData,
    next: nextTier,
    progress: Math.min(progress, 100),
    xpNeeded: Math.max(xpNeeded, 0),
    xpInTier,
    tierRange,
  };
}

// =====================================================
// REWARDS CATALOG (frontend reference)
// =====================================================
// Actual catalog is in Supabase, but this provides type hints

export const REWARD_KEYS = {
  PULSE_MODE_7D: 'pulse_mode_7d',
  SUB_CREDIT_5: 'sub_credit_5',
  SUB_CREDIT_10: 'sub_credit_10',
};

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export const NOTIFICATION_TYPES = {
  POINTS_EARNED: 'points_earned',
  PULSE_MODE: 'pulse_mode',
  TIER_UP: 'tier_up',
  CREDIT_APPLIED: 'credit_applied',
  DEAL_ALERT: 'deal_alert',
  RETURN_REMINDER: 'return_reminder',
  LISTING_NUDGE: 'listing_nudge',
  NEWS: 'news',
};

// =====================================================
// REDIS KEY PATTERNS (for reference)
// =====================================================

export const REDIS_KEYS = {
  REWARDS_STATE: (userId) => `orben:rewards:state:${userId}`,
  DAILY_EARN: (userId, yyyymmdd) => `orben:rewards:dailyEarn:${userId}:${yyyymmdd}`,
  ACTION_COUNT: (userId, action, yyyymmdd) => `orben:rewards:actionCount:${userId}:${action}:${yyyymmdd}`,
  COOLDOWN: (userId, rewardKey) => `orben:rewards:cooldown:${userId}:${rewardKey}`,
  PULSE: (userId) => `orben:rewards:pulse:${userId}`,
  NOTIFY_DEDUPE: (userId, hash) => `orben:rewards:notify:dedupe:${userId}:${hash}`,
  
  // Notification rate limits
  NOTIFY_COUNT: (userId, topic, yyyymmdd) => `orben:notif:count:${userId}:${topic}:${yyyymmdd}`,
  NOTIFY_DEDUPE_NOTIF: (userId, topic, hash) => `orben:notif:dedupe:${userId}:${topic}:${hash}`,
};

// =====================================================
// EXPORT ALL
// =====================================================

export default {
  REWARD_RULES,
  PROFIT_POINTS,
  DAILY_TOTAL_CAP,
  STREAK_THRESHOLDS,
  TIER_THRESHOLDS,
  REWARD_KEYS,
  NOTIFICATION_TYPES,
  REDIS_KEYS,
  computeMultiplier,
  computeTier,
  getTierInfo,
};
