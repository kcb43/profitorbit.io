/**
 * Vercel Serverless Function - eBay Item Search
 * 
 * This endpoint proxies eBay Browse API search requests.
 * Called from the frontend to search for items on eBay.
 */

const MARKETPLACE_ID = 'EBAY_US';

async function getAppToken() {
  const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.VITE_EBAY_CLIENT_SECRET || process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET env vars');
  }

  // Determine environment - check both EBAY_ENV and Client ID prefix
  const ebayEnv = process.env.EBAY_ENV;
  const isProductionByEnv = ebayEnv === 'production' || ebayEnv?.trim() === 'production';
  const isProductionByClientId = clientId.includes('-PRD-') || clientId.startsWith('PRD-');
  const useProduction = isProductionByEnv || isProductionByClientId;
  
  console.log('Environment detection:', {
    EBAY_ENV: JSON.stringify(ebayEnv),
    isProductionByEnv,
    clientIdPrefix: clientId.substring(0, 20) + '...',
    isProductionByClientId,
    useProduction
  });
  
  const oauthUrl = useProduction
    ? 'https://api.ebay.com/identity/v1/oauth2/token'
    : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
  
  console.log('OAuth URL:', oauthUrl);

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const resp = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }).toString(),
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
    // IMPORTANT: Extract all query parameters upfront
    const {
      q,
      category_ids,
      gtin,
      charity_ids,
      limit,
      offset,
      filter,
      sort,
      fieldgroups,
      aspect_filter,
      compatibility_filter,
    } = req.query;

    console.log('Received query parameters:', JSON.stringify(req.query));
    console.log('Extracted q parameter:', q);

    // Validate that we have at least one required parameter BEFORE building params
    // This is the same rule eBay enforces
    if (!q && !category_ids && !gtin && !charity_ids) {
      console.error('Validation failed: Missing required parameter', { q, category_ids, gtin, charity_ids });
      return res.status(400).json({
        error: 'Missing required parameter. Must provide q, category_ids, gtin, or charity_ids',
        receivedQuery: req.query,
      });
    }

    // Build search parameters
    const params = new URLSearchParams();

    // Append parameters exactly as eBay expects them
    if (q) params.append('q', q);
    if (category_ids) params.append('category_ids', category_ids);
    if (gtin) params.append('gtin', gtin);
    if (charity_ids) params.append('charity_ids', charity_ids);
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);
    if (filter) params.append('filter', filter);
    if (sort) params.append('sort', sort);
    if (fieldgroups) params.append('fieldgroups', fieldgroups);
    if (aspect_filter) params.append('aspect_filter', aspect_filter);
    if (compatibility_filter) params.append('compatibility_filter', compatibility_filter);

    console.log('Final search params string:', params.toString());
    console.log('Has q parameter:', params.has('q'));

    // Get access token
    const token = await getAppToken();

    // Determine environment - check both EBAY_ENV and Client ID prefix
    const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
    const ebayEnv = process.env.EBAY_ENV;
    const isProductionByEnv = ebayEnv === 'production' || ebayEnv?.trim() === 'production';
    const isProductionByClientId = clientId?.includes('-PRD-') || clientId?.startsWith('PRD-');
    const useProduction = isProductionByEnv || isProductionByClientId;
    
    console.log('Handler environment detection:', {
      EBAY_ENV: JSON.stringify(ebayEnv),
      isProductionByEnv,
      isProductionByClientId,
      useProduction
    });
    
    const baseUrl = useProduction
      ? 'https://api.ebay.com'
      : 'https://api.sandbox.ebay.com';

    console.log('Base URL:', baseUrl);

    const searchUrl = `${baseUrl}/buy/browse/v1/item_summary/search?${params.toString()}`;

    console.log('Making request to eBay:', {
      environment: useProduction ? 'production' : 'sandbox',
      ebayEnv: ebayEnv,
      url: searchUrl,
    });

    // Make search request to eBay
    const ebayResp = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE_ID,
      },
    });

    const data = await ebayResp.json();

    if (!ebayResp.ok) {
      console.error('eBay search error:', ebayResp.status, data);
      return res.status(ebayResp.status).json({
        error: 'eBay API error',
        details: data,
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Server error in /api/ebay/search:', err);
    return res.status(500).json({
      error: 'Internal error',
      details: err.message,
    });
  }
}

