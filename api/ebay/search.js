/**
 * Vercel Serverless Function - eBay Item Search
 * 
 * This endpoint proxies eBay Browse API search requests.
 * Called from the frontend to search for items on eBay.
 */

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

    // Debug: Log received query parameters
    console.log('Received query parameters:', JSON.stringify(req.query));
    
    // Build search query from request parameters
    const searchParams = new URLSearchParams();
    
    // Trim and validate q parameter if provided
    if (req.query.q) {
      const qValue = String(req.query.q).trim();
      if (qValue.length > 0) {
        searchParams.append('q', qValue);
        console.log('Added q parameter:', qValue);
      } else {
        console.log('q parameter was empty after trimming');
      }
    } else {
      console.log('No q parameter in request.query');
    }
    
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
    
    // Validate that we have at least one required search parameter after processing
    if (!searchParams.has('q') && !searchParams.has('category_ids') && !searchParams.has('gtin') && !searchParams.has('charity_ids')) {
      console.error('Validation failed: Missing required parameter', {
        hasQ: searchParams.has('q'),
        hasCategoryIds: searchParams.has('category_ids'),
        hasGtin: searchParams.has('gtin'),
        hasCharityIds: searchParams.has('charity_ids'),
        receivedQuery: req.query,
        searchParamsString: searchParams.toString()
      });
      return res.status(400).json({ 
        error: 'Missing required parameter. Must provide q, category_ids, gtin, or charity_ids',
        receivedQuery: req.query,
        debug: {
          hasQ: searchParams.has('q'),
          searchParamsString: searchParams.toString()
        }
      });
    }
    
    console.log('Final search params:', searchParams.toString());

    // eBay Browse API base URL
    // Check if we should use production (default to sandbox if not explicitly set)
    const useProduction = process.env.EBAY_ENV === 'production';
    const baseUrl = useProduction
      ? 'https://api.ebay.com'
      : 'https://api.sandbox.ebay.com';

    const searchUrl = `${baseUrl}/buy/browse/v1/item_summary/search?${searchParams.toString()}`;
    
    console.log('Making request to eBay:', {
      environment: useProduction ? 'production' : 'sandbox',
      url: searchUrl,
      params: searchParams.toString()
    });

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

