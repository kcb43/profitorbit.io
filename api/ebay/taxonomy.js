/**
 * Vercel Serverless Function - eBay Taxonomy API
 * 
 * This endpoint proxies eBay Taxonomy API requests for category operations.
 * Supports:
 * - getDefaultCategoryTreeId: Get the default category tree ID for a marketplace
 * - getCategorySuggestions: Get category suggestions based on a query
 * - getCategorySubtree: Get a category subtree (hierarchical structure)
 */

const MARKETPLACE_ID = 'EBAY_US';

async function getAppToken() {
  const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.VITE_EBAY_CLIENT_SECRET || process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET env vars');
  }

  // Determine environment
  const ebayEnv = process.env.EBAY_ENV;
  const isProductionByEnv = ebayEnv === 'production' || ebayEnv?.trim() === 'production';
  const isProductionByClientId = clientId && (
    clientId.includes('-PRD-') || 
    clientId.includes('-PRD') || 
    clientId.startsWith('PRD-') ||
    /PRD/i.test(clientId)
  );
  const useProduction = isProductionByEnv || isProductionByClientId;
  
  const oauthUrl = useProduction
    ? 'https://api.ebay.com/identity/v1/oauth2/token'
    : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const resp = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error('eBay token error:', resp.status, data);
    throw new Error(`Failed to get eBay token: ${resp.status}`);
  }

  return data.access_token;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { operation, marketplace_id, category_tree_id, q } = req.query;

    if (!operation) {
      return res.status(400).json({ error: 'Operation parameter is required (getDefaultCategoryTreeId, getCategorySuggestions, or getCategorySubtree)' });
    }

    // Determine environment
    const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
    const ebayEnv = process.env.EBAY_ENV;
    const isProductionByEnv = ebayEnv === 'production' || ebayEnv?.trim() === 'production';
    const isProductionByClientId = clientId && (
      clientId.includes('-PRD-') || 
      clientId.includes('-PRD') || 
      clientId.startsWith('PRD-') ||
      /PRD/i.test(clientId)
    );
    const useProduction = isProductionByEnv || isProductionByClientId;
    
    const baseUrl = useProduction
      ? 'https://api.ebay.com'
      : 'https://api.sandbox.ebay.com';

    // Get access token
    const token = await getAppToken();

    if (operation === 'getDefaultCategoryTreeId') {
      // Get default category tree ID for marketplace
      const marketplaceId = marketplace_id || MARKETPLACE_ID;
      const taxonomyUrl = `${baseUrl}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${marketplaceId}`;

      const taxonomyResp = await fetch(taxonomyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        },
      });

      if (!taxonomyResp.ok) {
        const errorData = await taxonomyResp.json().catch(() => ({ error: 'Unknown error' }));
        console.error('eBay Taxonomy API error:', taxonomyResp.status, errorData);
        return res.status(taxonomyResp.status).json({
          error: 'eBay Taxonomy API error',
          details: errorData,
        });
      }

      const taxonomyData = await taxonomyResp.json();
      return res.status(200).json(taxonomyData);

    } else if (operation === 'getCategorySuggestions') {
      // Get category suggestions
      if (!category_tree_id) {
        return res.status(400).json({ error: 'category_tree_id is required for getCategorySuggestions' });
      }

      if (!q) {
        return res.status(400).json({ error: 'q parameter is required for getCategorySuggestions' });
      }

      const marketplaceId = marketplace_id || MARKETPLACE_ID;
      const taxonomyUrl = `${baseUrl}/commerce/taxonomy/v1/category_tree/${category_tree_id}/get_category_suggestions?q=${encodeURIComponent(q)}`;

      const taxonomyResp = await fetch(taxonomyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
          'Accept-Language': 'en-US',
        },
      });

      if (!taxonomyResp.ok) {
        const errorData = await taxonomyResp.json().catch(() => ({ error: 'Unknown error' }));
        console.error('eBay Taxonomy API error:', taxonomyResp.status, errorData);
        return res.status(taxonomyResp.status).json({
          error: 'eBay Taxonomy API error',
          details: errorData,
        });
      }

      const taxonomyData = await taxonomyResp.json();
      return res.status(200).json(taxonomyData);

    } else if (operation === 'getCategorySubtree') {
      // Get category subtree
      if (!category_tree_id) {
        return res.status(400).json({ error: 'category_tree_id is required for getCategorySubtree' });
      }

      const category_id = req.query.category_id || '0'; // Default to root (0)
      const marketplaceId = marketplace_id || MARKETPLACE_ID;
      const taxonomyUrl = `${baseUrl}/commerce/taxonomy/v1/category_tree/${category_tree_id}/get_category_subtree?category_id=${category_id}`;

      const taxonomyResp = await fetch(taxonomyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
          'Accept-Language': 'en-US',
          'Accept-Encoding': 'gzip', // Request gzip compression
        },
      });

      if (!taxonomyResp.ok) {
        const errorData = await taxonomyResp.json().catch(() => ({ error: 'Unknown error' }));
        console.error('eBay Taxonomy API error:', taxonomyResp.status, errorData);
        return res.status(taxonomyResp.status).json({
          error: 'eBay Taxonomy API error',
          details: errorData,
        });
      }

      const taxonomyData = await taxonomyResp.json();
      return res.status(200).json(taxonomyData);

    } else {
      return res.status(400).json({ error: `Unknown operation: ${operation}` });
    }

  } catch (err) {
    console.error('Server error in /api/ebay/taxonomy:', err);
    return res.status(500).json({
      error: 'Internal server error',
      details: err.message,
    });
  }
}

