/**
 * ORBEN NOTIFICATIONS API ENDPOINTS
 * 
 * Deploy these to Vercel Serverless Functions or Fly.io
 * 
 * Endpoints:
 * - GET /api/notifications - Get user notifications
 * - POST /api/notifications/read - Mark notifications as read
 * - GET /api/notifications/preferences - Get preferences
 * - POST /api/notifications/preferences - Update preferences
 * - POST /api/notifications/device-token - Register device token
 */

import { createClient } from '@supabase/supabase-js';
import {
  getNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  getUnreadCount,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerDeviceToken,
  getDeviceTokens,
} from '../services/notificationService';

// Initialize Supabase with service role
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return user;
}

// =====================================================
// GET /api/notifications
// =====================================================
// Get user's notifications (paginated)

export async function getNotificationsHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);

    const result = await getNotifications(user.id, limit, offset);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(error.message.includes('authorization') ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// POST /api/notifications/read
// =====================================================
// Mark notifications as read

export async function markReadHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
    const { notificationIds, markAll } = req.body;

    let count;
    if (markAll) {
      count = await markAllNotificationsRead(user.id);
    } else if (notificationIds && Array.isArray(notificationIds)) {
      count = await markNotificationsRead(user.id, notificationIds);
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
    return res.status(error.message.includes('authorization') ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// GET /api/notifications/unread-count
// =====================================================
// Get unread notification count

export async function getUnreadCountHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
    const count = await getUnreadCount(user.id);

    return res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    return res.status(error.message.includes('authorization') ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// GET /api/notifications/preferences
// =====================================================
// Get notification preferences

export async function getPreferencesHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
    const preferences = await getNotificationPreferences(user.id);

    return res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    return res.status(error.message.includes('authorization') ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// POST /api/notifications/preferences
// =====================================================
// Update notification preferences

export async function updatePreferencesHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
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

    const preferences = await updateNotificationPreferences(user.id, filtered);

    return res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    return res.status(error.message.includes('authorization') ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// POST /api/notifications/device-token
// =====================================================
// Register or update device token for push notifications

export async function registerDeviceTokenHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
    const { platform, token, deviceId } = req.body;

    if (!platform || !token) {
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

    const tokenId = await registerDeviceToken(user.id, platform, token, deviceId);

    return res.status(200).json({
      success: true,
      data: { tokenId },
    });
  } catch (error) {
    return res.status(error.message.includes('authorization') ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// GET /api/notifications/device-tokens
// =====================================================
// Get user's device tokens

export async function getDeviceTokensHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
    const tokens = await getDeviceTokens(user.id);

    return res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    return res.status(error.message.includes('authorization') ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// VERCEL SERVERLESS FUNCTION EXPORTS
// =====================================================

// /api/notifications/index.js
export async function notificationsEndpoint(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return getNotificationsHandler(req, res);
}

// /api/notifications/read.js
export async function readEndpoint(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return markReadHandler(req, res);
}

// /api/notifications/unread-count.js
export async function unreadCountEndpoint(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return getUnreadCountHandler(req, res);
}

// /api/notifications/preferences.js
export async function preferencesEndpoint(req, res) {
  if (req.method === 'GET') {
    return getPreferencesHandler(req, res);
  } else if (req.method === 'POST') {
    return updatePreferencesHandler(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// /api/notifications/device-token.js
export async function deviceTokenEndpoint(req, res) {
  if (req.method === 'POST') {
    return registerDeviceTokenHandler(req, res);
  } else if (req.method === 'GET') {
    return getDeviceTokensHandler(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// =====================================================
// EXPRESS/FLY.IO ROUTER
// =====================================================

export function createNotificationsRouter() {
  const express = require('express');
  const router = express.Router();

  router.get('/', getNotificationsHandler);
  router.post('/read', markReadHandler);
  router.get('/unread-count', getUnreadCountHandler);
  router.get('/preferences', getPreferencesHandler);
  router.post('/preferences', updatePreferencesHandler);
  router.post('/device-token', registerDeviceTokenHandler);
  router.get('/device-tokens', getDeviceTokensHandler);

  return router;
}

// =====================================================
// EXAMPLE USAGE (Frontend)
// =====================================================

/*
// 1) Fetch notifications
const fetchNotifications = async () => {
  const response = await fetch('/api/notifications?limit=50&offset=0', {
    headers: {
      'Authorization': `Bearer ${supabaseToken}`,
    },
  });
  
  const data = await response.json();
  if (data.success) {
    setNotifications(data.data.notifications);
    setUnreadCount(data.data.unreadCount);
  }
};

// 2) Mark notification as read
const markAsRead = async (notificationId) => {
  await fetch('/api/notifications/read', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseToken}`,
    },
    body: JSON.stringify({
      notificationIds: [notificationId],
    }),
  });
};

// 3) Update preferences
const updatePreferences = async (updates) => {
  await fetch('/api/notifications/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseToken}`,
    },
    body: JSON.stringify(updates),
  });
};

// 4) Register push token (on app launch)
const registerPushToken = async (token) => {
  await fetch('/api/notifications/device-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseToken}`,
    },
    body: JSON.stringify({
      platform: 'ios', // or 'android', 'web'
      token: token,
      deviceId: deviceId,
    }),
  });
};
*/

export default {
  getNotificationsHandler,
  markReadHandler,
  getUnreadCountHandler,
  getPreferencesHandler,
  updatePreferencesHandler,
  registerDeviceTokenHandler,
  getDeviceTokensHandler,
  notificationsEndpoint,
  readEndpoint,
  unreadCountEndpoint,
  preferencesEndpoint,
  deviceTokenEndpoint,
  createNotificationsRouter,
};
