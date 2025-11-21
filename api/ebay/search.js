/**
 * Vercel Serverless Function - eBay Item Search
 * 
 * This endpoint proxies eBay Browse API search requests.
 * Called from the frontend to search for items on eBay.
 */

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get access token first
    const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.VITE_EBAY_CLIENT_SECRET || process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ 
        error: 'eBay credentials not configured' 
      });
    }

    // Get access token
    const oauthUrl = process.env.EBAY_ENV === 'production' 
      ? 'https://api.ebay.com/identity/v1/oauth2/token'
      : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const tokenResponse = await fetch(oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return res.status(tokenResponse.status).json({ 
        error: 'Failed to authenticate with eBay',
        details: errorText 
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Build search query from request parameters
    const searchParams = new URLSearchParams();
    
    if (req.query.q) searchParams.append('q', req.query.q);
    if (req.query.category_ids) searchParams.append('category_ids', req.query.category_ids);
    if (req.query.gtin) searchParams.append('gtin', req.query.gtin);
    if (req.query.charity_ids) searchParams.append('charity_ids', req.query.charity_ids);
    if (req.query.limit) searchParams.append('limit', req.query.limit);
    if (req.query.offset) searchParams.append('offset', req.query.offset);
    if (req.query.filter) searchParams.append('filter', req.query.filter);
    if (req.query.sort) searchParams.append('sort', req.query.sort);
    if (req.query.fieldgroups) searchParams.append('fieldgroups', req.query.fieldgroups);
    if (req.query.aspect_filter) searchParams.append('aspect_filter', req.query.aspect_filter);
    if (req.query.compatibility_filter) searchParams.append('compatibility_filter', req.query.compatibility_filter);

    // eBay Browse API base URL
    const baseUrl = process.env.EBAY_ENV === 'production' 
      ? 'https://api.ebay.com'
      : 'https://api.sandbox.ebay.com';

    const searchUrl = `${baseUrl}/buy/browse/v1/item_summary/search?${searchParams.toString()}`;

    // Make search request to eBay
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': req.query.marketplace_id || 'EBAY_US',
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('eBay search error:', searchResponse.status, errorText);
      return res.status(searchResponse.status).json({ 
        error: `eBay API error: ${searchResponse.status}`,
        details: errorText 
      });
    }

    const searchData = await searchResponse.json();

    // Return search results to frontend
    res.status(200).json(searchData);
  } catch (error) {
    console.error('Error searching eBay:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

