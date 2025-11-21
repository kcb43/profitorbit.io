/**
 * Vercel Serverless Function - eBay OAuth Token
 * 
 * This endpoint handles OAuth token generation for eBay API.
 * Called from the frontend to get an access token.
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.VITE_EBAY_CLIENT_SECRET || process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ 
        error: 'eBay credentials not configured. Please set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET environment variables.' 
      });
    }

    // eBay OAuth endpoint
    const oauthUrl = process.env.EBAY_ENV === 'production' 
      ? 'https://api.ebay.com/identity/v1/oauth2/token'
      : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

    // Create Basic Auth header
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // Request access token from eBay
    const response = await fetch(oauthUrl, {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('eBay OAuth error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: `Failed to get access token: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();

    // Return token to frontend
    res.status(200).json({
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
    });
  } catch (error) {
    console.error('Error getting eBay token:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

