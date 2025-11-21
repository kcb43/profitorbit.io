/**
 * Vercel Serverless Function - eBay Item Details
 * 
 * This endpoint proxies eBay Browse API item detail requests.
 * Called from the frontend to get detailed information about a specific item.
 */

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { itemId, legacyItemId } = req.query;

    if (!itemId && !legacyItemId) {
      return res.status(400).json({ error: 'Item ID or Legacy Item ID is required' });
    }

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

    // eBay Browse API base URL
    const baseUrl = process.env.EBAY_ENV === 'production' 
      ? 'https://api.ebay.com'
      : 'https://api.sandbox.ebay.com';

    let itemUrl;

    if (legacyItemId) {
      // Get item by legacy ID
      itemUrl = `${baseUrl}/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${legacyItemId}`;
    } else {
      // Get item by RESTful ID
      const queryParams = new URLSearchParams();
      if (req.query.fieldgroups) {
        queryParams.append('fieldgroups', req.query.fieldgroups);
      }
      itemUrl = `${baseUrl}/buy/browse/v1/item/${encodeURIComponent(itemId)}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    }

    // Make request to eBay
    const itemResponse = await fetch(itemUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': req.query.marketplace_id || 'EBAY_US',
        'Content-Type': 'application/json',
      },
    });

    if (!itemResponse.ok) {
      const errorText = await itemResponse.text();
      console.error('eBay item error:', itemResponse.status, errorText);
      return res.status(itemResponse.status).json({ 
        error: `eBay API error: ${itemResponse.status}`,
        details: errorText 
      });
    }

    const itemData = await itemResponse.json();

    // Return item data to frontend
    res.status(200).json(itemData);
  } catch (error) {
    console.error('Error getting eBay item:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

