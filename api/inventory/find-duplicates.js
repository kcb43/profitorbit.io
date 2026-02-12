/**
 * Find potential duplicate items in inventory based on title similarity
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Calculate Levenshtein distance (string similarity)
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

// Calculate similarity percentage
function calculateSimilarity(str1, str2) {
  const normalized1 = str1.toLowerCase().trim();
  const normalized2 = str2.toLowerCase().trim();
  
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  
  if (maxLength === 0) return 100;
  
  const similarity = ((maxLength - distance) / maxLength) * 100;
  return Math.round(similarity);
}

// Helper to get user ID from request
function getUserId(req) {
  return req.headers['x-user-id'] || null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, itemId, ebayItemId, mercariItemId, facebookItemId, threshold = 70 } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    console.log(`🔍 Finding duplicates for: "${title}" (threshold: ${threshold}%)`);

    // Get all user's inventory items (excluding the current item if itemId provided)
    let query = supabase
      .from('inventory_items')
      .select('id, item_name, purchase_price, purchase_date, status, source, image_url, images, ebay_item_id, mercari_item_id, facebook_item_id, quantity, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null);

    // Exclude the current item if we're checking for an existing item
    if (itemId) {
      query = query.neq('id', itemId);
    }

    const { data: items, error } = await query;

    if (error) {
      console.error('Error fetching items:', error);
      return res.status(500).json({ error: 'Failed to fetch items' });
    }

    console.log(`📦 Checking ${items.length} items for duplicates...`);

    // Find duplicates based on title similarity
    const duplicates = items
      .map(item => ({
        ...item,
        similarity: calculateSimilarity(title, item.item_name),
        // Check if marketplace IDs match
        ebayMatch: ebayItemId && item.ebay_item_id === ebayItemId,
        mercariMatch: mercariItemId && item.mercari_item_id === mercariItemId,
        facebookMatch: facebookItemId && item.facebook_item_id === facebookItemId,
      }))
      .filter(item => {
        // Always include if marketplace ID matches (exact duplicate)
        if (item.ebayMatch || item.mercariMatch || item.facebookMatch) {
          return true;
        }
        // Otherwise check title similarity
        return item.similarity >= threshold;
      })
      .sort((a, b) => {
        // Prioritize exact marketplace ID matches
        if (a.ebayMatch || a.mercariMatch || a.facebookMatch) return -1;
        if (b.ebayMatch || b.mercariMatch || b.facebookMatch) return 1;
        // Then sort by similarity
        return b.similarity - a.similarity;
      });

    console.log(`✅ Found ${duplicates.length} potential duplicates`);
    
    // Log top 3 matches for debugging
    duplicates.slice(0, 3).forEach(dup => {
      console.log(`  - "${dup.item_name}" (${dup.similarity}% similar, eBay match: ${dup.ebayMatch || false})`);
    });

    return res.status(200).json({
      success: true,
      duplicates,
      count: duplicates.length,
      threshold,
    });

  } catch (error) {
    console.error('Error finding duplicates:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to find duplicates' 
    });
  }
}
