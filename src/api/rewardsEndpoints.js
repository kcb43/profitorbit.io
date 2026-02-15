/**
 * ORBEN REWARDS API ENDPOINTS
 * 
 * Deploy these to Vercel Serverless Functions or Fly.io
 * 
 * Vercel: Place in /api/rewards/[endpoint].js
 * Fly.io: Use Express/Fastify router
 * 
 * All endpoints require authentication (auth.uid() from Supabase)
 */

import { createClient } from '@supabase/supabase-js';
import {
  earnRewards,
  getRewardsState,
  redeemReward,
  getRewardsCatalog,
  getRewardsEvents,
  generateIdempotencyKey,
} from '../services/rewardsService';

// Initialize Supabase with service role for backend operations
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
// GET /api/rewards/state
// =====================================================
// Get current rewards state for authenticated user

export async function getStateHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
    const state = await getRewardsState(user.id);

    return res.status(200).json({
      success: true,
      data: state,
    });
  } catch (error) {
    return res.status(error.message.includes('authorization') ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// POST /api/rewards/earn
// =====================================================
// Award points/XP for a user action

export async function earnHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
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
    return res.status(error.message.includes('authorization') ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// GET /api/rewards/catalog
// =====================================================
// Get available rewards catalog with eligibility

export async function getCatalogHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
    const catalog = await getRewardsCatalog(user.id);

    return res.status(200).json({
      success: true,
      data: catalog,
    });
  } catch (error) {
    return res.status(error.message.includes('authorization') ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// POST /api/rewards/redeem
// =====================================================
// Redeem a reward (Pulse Mode, subscription credit, etc.)

export async function redeemHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
    const { rewardKey, idempotencyKey, meta } = req.body;

    if (!rewardKey || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: rewardKey, idempotencyKey',
      });
    }

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
    const status = error.message.includes('authorization')
      ? 401
      : error.message.includes('Insufficient points') || error.message.includes('cooldown')
      ? 400
      : 500;

    return res.status(status).json({
      success: false,
      error: error.message,
    });
  }
}

// =====================================================
// GET /api/rewards/events
// =====================================================
// Get rewards event history (ledger)

export async function getEventsHandler(req, res) {
  try {
    const user = await authenticateRequest(req);
    const limit = parseInt(req.query.limit || '50', 10);

    const events = await getRewardsEvents(user.id, limit);

    return res.status(200).json({
      success: true,
      data: events,
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
// For Vercel deployment, export these handlers:

// /api/rewards/state.js
export async function stateEndpoint(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return getStateHandler(req, res);
}

// /api/rewards/earn.js
export async function earnEndpoint(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return earnHandler(req, res);
}

// /api/rewards/catalog.js
export async function catalogEndpoint(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return getCatalogHandler(req, res);
}

// /api/rewards/redeem.js
export async function redeemEndpoint(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return redeemHandler(req, res);
}

// /api/rewards/events.js
export async function eventsEndpoint(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return getEventsHandler(req, res);
}

// =====================================================
// EXPRESS/FLY.IO ROUTER
// =====================================================
// For Fly.io deployment with Express:

export function createRewardsRouter() {
  const express = require('express');
  const router = express.Router();

  router.get('/state', getStateHandler);
  router.post('/earn', earnHandler);
  router.get('/catalog', getCatalogHandler);
  router.post('/redeem', redeemHandler);
  router.get('/events', getEventsHandler);

  return router;
}

// =====================================================
// EXAMPLE USAGE (Frontend)
// =====================================================

/*
// In your React components:

// 1) Award points when user creates a listing
const awardListingPoints = async (listingId) => {
  const response = await fetch('/api/rewards/earn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseToken}`,
    },
    body: JSON.stringify({
      actionKey: 'listing_created',
      sourceType: 'listing',
      sourceId: listingId,
      idempotencyKey: `listing_created:listing:${listingId}`,
    }),
  });
  
  const data = await response.json();
  if (data.success) {
    // Show toast: "+10 OP earned!"
  }
};

// 2) Redeem Pulse Mode
const redeemPulseMode = async () => {
  const response = await fetch('/api/rewards/redeem', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseToken}`,
    },
    body: JSON.stringify({
      rewardKey: 'pulse_mode_7d',
      idempotencyKey: `redeem:pulse_mode_7d:${Date.now()}`,
    }),
  });
  
  const data = await response.json();
  if (data.success) {
    // Show success: "Pulse Mode activated!"
  } else {
    // Show error: data.error
  }
};
*/

export default {
  getStateHandler,
  earnHandler,
  getCatalogHandler,
  redeemHandler,
  getEventsHandler,
  stateEndpoint,
  earnEndpoint,
  catalogEndpoint,
  redeemEndpoint,
  eventsEndpoint,
  createRewardsRouter,
};
