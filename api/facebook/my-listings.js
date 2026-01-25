/**
 * Fetch user's Facebook Marketplace listings for import
 * Uses Chrome Extension to scrape listings from Facebook Marketplace
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get user ID from request
function getUserId(req) {
  return req.headers['x-user-id'] || null;
}

// Helper to get Facebook token from request headers
function getFacebookToken(req) {
  return req.headers['x-user-token'] || null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-user-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = getUserId(req);
    console.log('🔍 Facebook import request from user:', userId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - User ID missing' });
    }

    const accessToken = getFacebookToken(req);
    console.log('🔍 Facebook token:', accessToken ? 'present' : 'missing');
    
    if (!accessToken) {
      return res.status(401).json({ 
        error: 'Facebook not connected. Please connect your Facebook account first.',
        requiresConnection: true,
      });
    }

    // For now, return empty array
    // Extension will handle the scraping and send data directly to import endpoint
    console.log('⚡ Facebook Marketplace import - Extension handles scraping');

    return res.status(200).json({
      listings: [],
      total: 0,
      message: 'Use Chrome Extension to import Facebook listings',
      extensionRequired: true,
    });

  } catch (error) {
    console.error('❌ Error in Facebook import:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process Facebook import request',
      details: error.stack,
    });
  }
}
