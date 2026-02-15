/**
 * ORBEN NOTIFICATIONS SERVICE
 * 
 * Multi-channel notification delivery:
 * - In-app notifications
 * - Push notifications (FCM)
 * - Email notifications (future)
 * 
 * Handles:
 * - User preferences
 * - Rate limiting
 * - Quiet hours
 * - Deduplication
 * - Delivery queue management
 */

import { supabase } from '../api/supabaseClient';
import { NOTIFICATION_TYPES, REDIS_KEYS } from '../config/rewardsRules';

// Upstash Redis client
import { redis } from '../lib/upstashRedis';

// =====================================================
// NOTIFICATION PREFERENCES
// =====================================================

/**
 * Get user notification preferences (creates defaults if missing)
 */
export async function getNotificationPreferences(userId) {
  const { data, error } = await supabase.rpc('get_notification_preferences', {
    p_user_id: userId,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(userId, updates) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        ...updates,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =====================================================
// DEVICE TOKENS
// =====================================================

/**
 * Register or update device token for push notifications
 */
export async function registerDeviceToken(userId, platform, token, deviceId = null) {
  const { data, error } = await supabase.rpc('register_device_token', {
    p_user_id: userId,
    p_platform: platform,
    p_token: token,
    p_device_id: deviceId,
  });

  if (error) throw error;
  return data;
}

/**
 * Get user's device tokens
 */
export async function getDeviceTokens(userId) {
  const { data, error } = await supabase
    .from('device_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('is_valid', true);

  if (error) throw error;
  return data;
}

/**
 * Mark device token as invalid (after delivery failure)
 */
export async function invalidateDeviceToken(tokenId) {
  const { error } = await supabase
    .from('device_tokens')
    .update({ is_valid: false })
    .eq('id', tokenId);

  if (error) throw error;
}

// =====================================================
// SEND NOTIFICATION
// =====================================================

/**
 * Send notification to user (checks preferences, creates in-app, enqueues push/email)
 * 
 * @param {Object} input
 * @param {string} input.userId - User ID
 * @param {string} input.type - Notification type
 * @param {string} input.title - Notification title
 * @param {string} input.body - Notification body
 * @param {string} [input.deepLink] - Deep link URL
 * @param {Object} [input.meta] - Additional metadata
 * @param {string} [input.idempotencyKey] - Unique key for deduplication
 * @returns {Object} Created notification
 */
export async function sendNotification(input) {
  const {
    userId,
    type,
    title,
    body,
    deepLink = null,
    meta = {},
    idempotencyKey = null,
  } = input;

  // 1) Get user preferences
  const prefs = await getNotificationPreferences(userId);

  // 2) Map notification type to topic
  const topic = getTopicFromType(type);

  // 3) Check if user has this topic enabled
  const topicKey = `${topic}_enabled`;
  if (prefs[topicKey] === false) {
    // User disabled this topic
    return { sent: false, reason: 'topic_disabled' };
  }

  // 4) Check quiet hours
  if (prefs.quiet_hours_enabled && isInQuietHours(prefs)) {
    // Skip push/email but still create in-app
    // (or queue for after quiet hours)
  }

  // 5) Check rate limits
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rateLimitKey = REDIS_KEYS.NOTIFY_COUNT(userId, topic, yyyymmdd);
  const countToday = parseInt((await redis.get(rateLimitKey)) || '0', 10);

  const maxPerDay = prefs[`${topic}_max_per_day`] || 999;
  if (countToday >= maxPerDay) {
    return { sent: false, reason: 'rate_limit_exceeded' };
  }

  // 6) Check deduplication
  if (idempotencyKey) {
    const dedupeKey = REDIS_KEYS.NOTIFY_DEDUPE_NOTIF(userId, topic, idempotencyKey);
    const existing = await redis.get(dedupeKey);
    if (existing) {
      return { sent: false, reason: 'duplicate' };
    }
    await redis.setex(dedupeKey, 60 * 60 * 24, '1'); // 24h dedupe
  }

  // 7) Create in-app notification (always)
  const { data: notification, error: notifError } = await supabase
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

  if (notifError) throw notifError;

  // 8) Increment rate limit counter
  await redis.incr(rateLimitKey);
  await redis.setex(rateLimitKey, 60 * 60 * 48, String(countToday + 1)); // 48h TTL

  // 9) Enqueue push notification (if enabled)
  if (prefs.push_enabled && !isInQuietHours(prefs)) {
    await enqueuePushNotification(userId, notification, topic, idempotencyKey || notification.id);
  }

  // 10) Enqueue email notification (if enabled)
  if (prefs.email_enabled) {
    // Future: enqueue email
  }

  return { sent: true, notification };
}

/**
 * Map notification type to topic
 */
function getTopicFromType(type) {
  const mapping = {
    [NOTIFICATION_TYPES.RETURN_REMINDER]: 'returns',
    [NOTIFICATION_TYPES.LISTING_NUDGE]: 'listing_nudges',
    [NOTIFICATION_TYPES.DEAL_ALERT]: 'deals',
    [NOTIFICATION_TYPES.NEWS]: 'news',
    [NOTIFICATION_TYPES.POINTS_EARNED]: 'rewards',
    [NOTIFICATION_TYPES.PULSE_MODE]: 'rewards',
    [NOTIFICATION_TYPES.TIER_UP]: 'rewards',
    [NOTIFICATION_TYPES.CREDIT_APPLIED]: 'rewards',
  };
  return mapping[type] || 'rewards';
}

/**
 * Check if current time is in user's quiet hours
 */
function isInQuietHours(prefs) {
  if (!prefs.quiet_hours_enabled || !prefs.quiet_start_local || !prefs.quiet_end_local) {
    return false;
  }

  // Simple check (assumes server time matches user timezone for now)
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

  const start = prefs.quiet_start_local;
  const end = prefs.quiet_end_local;

  if (start < end) {
    // Normal range (e.g., 22:00 - 08:00)
    return currentTime >= start && currentTime < end;
  } else {
    // Crosses midnight (e.g., 22:00 - 08:00)
    return currentTime >= start || currentTime < end;
  }
}

// =====================================================
// PUSH NOTIFICATION QUEUE
// =====================================================

/**
 * Enqueue push notification for delivery
 */
async function enqueuePushNotification(userId, notification, topic, idempotencyKey) {
  const payload = {
    title: notification.title,
    body: notification.body,
    data: {
      type: notification.type,
      deepLink: notification.deep_link,
      notificationId: notification.id,
      ...notification.meta,
    },
  };

  const { error } = await supabase
    .from('notification_outbox')
    .insert({
      user_id: userId,
      notification_id: notification.id,
      channel: 'push',
      topic,
      status: 'pending',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
      payload,
      idempotency_key: `push:${idempotencyKey}`,
    });

  if (error && error.code !== '23505') {
    // Ignore duplicate key errors (idempotency)
    throw error;
  }
}

// =====================================================
// GET NOTIFICATIONS
// =====================================================

/**
 * Get user's notifications (paginated)
 */
export async function getNotifications(userId, limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Get unread count
  const { data: unreadData } = await supabase.rpc('get_unread_count', {
    p_user_id: userId,
  });

  return {
    notifications: data,
    unreadCount: unreadData || 0,
  };
}

/**
 * Mark notifications as read
 */
export async function markNotificationsRead(userId, notificationIds) {
  const { data, error } = await supabase.rpc('mark_notifications_read', {
    p_user_id: userId,
    p_notification_ids: notificationIds,
  });

  if (error) throw error;
  return data; // Returns count of updated notifications
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId) {
  const { data, error } = await supabase.rpc('mark_all_notifications_read', {
    p_user_id: userId,
  });

  if (error) throw error;
  return data; // Returns count of updated notifications
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId) {
  const { data, error } = await supabase.rpc('get_unread_count', {
    p_user_id: userId,
  });

  if (error) throw error;
  return data || 0;
}

// =====================================================
// PUSH NOTIFICATION DELIVERY (Worker)
// =====================================================

/**
 * Process pending push notifications (called by worker/cron)
 * This would typically run in a Fly.io worker or serverless function
 */
export async function processPushNotifications(batchSize = 100) {
  // 1) Fetch pending jobs
  const { data: jobs, error: fetchError } = await supabase
    .from('notification_outbox')
    .select('*')
    .eq('status', 'pending')
    .eq('channel', 'push')
    .lte('next_attempt_at', new Date().toISOString())
    .limit(batchSize)
    .order('next_attempt_at');

  if (fetchError) throw fetchError;

  const results = [];

  for (const job of jobs) {
    try {
      // Get user's device tokens
      const tokens = await getDeviceTokens(job.user_id);

      if (tokens.length === 0) {
        // No valid tokens
        await supabase
          .from('notification_outbox')
          .update({
            status: 'failed',
            last_error: 'No valid device tokens',
            attempts: job.attempts + 1,
          })
          .eq('id', job.id);
        continue;
      }

      // Send via FCM (Firebase Cloud Messaging)
      // TODO: Integrate with FCM SDK
      // For now, mark as sent
      await supabase
        .from('notification_outbox')
        .update({
          status: 'sent',
          attempts: job.attempts + 1,
        })
        .eq('id', job.id);

      results.push({ jobId: job.id, status: 'sent' });
    } catch (error) {
      // Retry with exponential backoff
      const nextAttempt = new Date(
        Date.now() + Math.pow(2, job.attempts) * 1000 * 60
      ); // 1min, 2min, 4min, etc.

      await supabase
        .from('notification_outbox')
        .update({
          status: job.attempts >= 5 ? 'failed' : 'pending', // Max 5 attempts
          last_error: error.message,
          attempts: job.attempts + 1,
          next_attempt_at: nextAttempt.toISOString(),
        })
        .eq('id', job.id);

      results.push({ jobId: job.id, status: 'retry', error: error.message });
    }
  }

  return results;
}

// =====================================================
// HELPER: Send Firebase Cloud Messaging
// =====================================================

/**
 * Send push notification via FCM
 * Requires firebase-admin SDK setup
 * 
 * @param {Array} tokens - Device tokens
 * @param {Object} payload - Notification payload
 */
async function sendFCM(tokens, payload) {
  // TODO: Implement FCM integration
  // Example:
  // const admin = require('firebase-admin');
  // const message = {
  //   notification: {
  //     title: payload.title,
  //     body: payload.body,
  //   },
  //   data: payload.data,
  //   tokens: tokens.map(t => t.token),
  // };
  // await admin.messaging().sendMulticast(message);

  throw new Error('FCM not implemented yet');
}

// =====================================================
// BULK NOTIFICATIONS (e.g., Deal Alerts)
// =====================================================

/**
 * Send notification to multiple users (with rate limit checks per user)
 * 
 * @param {Array} userIds - Array of user IDs
 * @param {Object} notificationTemplate - Notification template
 * @returns {Object} Results
 */
export async function sendBulkNotification(userIds, notificationTemplate) {
  const results = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const userId of userIds) {
    try {
      const result = await sendNotification({
        userId,
        ...notificationTemplate,
        idempotencyKey: `${notificationTemplate.type}:${userId}:${Date.now()}`,
      });

      if (result.sent) {
        results.sent++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ userId, error: error.message });
    }
  }

  return results;
}

// =====================================================
// EXPORT ALL
// =====================================================

export default {
  // Preferences
  getNotificationPreferences,
  updateNotificationPreferences,

  // Device tokens
  registerDeviceToken,
  getDeviceTokens,
  invalidateDeviceToken,

  // Notifications
  sendNotification,
  getNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  getUnreadCount,

  // Bulk
  sendBulkNotification,

  // Worker
  processPushNotifications,
};
