/**
 * Fetch user's Facebook Marketplace listings for import
 * 
 * IMPORTANT LIMITATION:
 * Facebook does NOT provide a public API to fetch existing Marketplace listings.
 * Their Graph API only allows:
 * - Creating new listings
 * - Managing pages
 * - Getting basic page posts
 * 
 * Alternative approaches:
 * 1. Use Chrome Extension to scrape Facebook Marketplace (like Vendoo does)
 * 2. Manual export/import via CSV
 * 3. Ask user to manually re-list items
 * 
 * For now, this endpoint returns a message explaining the limitation.
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

    // Facebook Marketplace API Limitation
    // Facebook does NOT provide an API to fetch existing marketplace listings
    // This is a known limitation of Facebook's Graph API
    
    console.log('⚠️ Facebook Marketplace import requested - API limitation');

    return res.status(200).json({
      listings: [],
      total: 0,
      limitationNotice: true,
      message: 'Facebook Marketplace Import via Extension',
      explanation: [
        'Facebook does not provide a public API to fetch your existing Marketplace listings.',
        'To import from Facebook Marketplace, you can:',
        '1. Use our Chrome Extension (coming soon) to import listings',
        '2. Manually copy listing details',
        '3. Re-create listings using our Crosslist feature',
      ],
      extensionRequired: true,
      alternativeAction: 'crosslist',
    });

  } catch (error) {
    console.error('❌ Error in Facebook import:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process Facebook import request',
      details: error.stack,
    });
  }
}
