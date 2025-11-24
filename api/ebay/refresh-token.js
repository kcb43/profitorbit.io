/**
 * Vercel Serverless Function - eBay OAuth Token Refresh
 * 
 * This endpoint refreshes an expired eBay access token using a refresh token.
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ 
        error: 'Refresh token is required' 
      });
    }

    const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.VITE_EBAY_CLIENT_SECRET || process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ 
        error: 'eBay credentials not configured' 
      });
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

    // Build callback URL (must match the redirect_uri used in auth.js)
    let baseUrl = null;
    
    if (process.env.BASE_URL) {
      baseUrl = process.env.BASE_URL.replace(/\/$/, '');
    } else if (process.env.VERCEL_URL) {
      const vercelUrl = process.env.VERCEL_URL.replace(/^https?:\/\//, '');
      baseUrl = `https://${vercelUrl}`;
    } else if (req.headers.host) {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      baseUrl = `${protocol}://${req.headers.host}`;
    } else if (req.headers.referer) {
      try {
        baseUrl = new URL(req.headers.referer).origin;
      } catch (e) {
        console.error('Error parsing referer:', e);
      }
    } else {
      baseUrl = 'http://localhost:5173';
    }
    
    const redirectUri = `${baseUrl}/api/ebay/callback`;

    // eBay OAuth token endpoint
    const tokenUrl = useProduction
      ? 'https://api.ebay.com/identity/v1/oauth2/token'
      : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

    // Create Basic Auth header
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // Refresh access token using refresh token
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        scope: 'https://api.ebay.com/oauth/api_scope',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('eBay token refresh error:', tokenResponse.status, errorText);
      let errorMsg = 'Failed to refresh access token';
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.error_description || errorData.error || errorMsg;
      } catch (e) {
        errorMsg = errorText || errorMsg;
      }
      return res.status(tokenResponse.status).json({ 
        error: errorMsg,
        details: errorText 
      });
    }

    const tokenData = await tokenResponse.json();

    console.log('eBay token refresh success:', {
      hasAccessToken: !!tokenData.access_token,
      expiresIn: tokenData.expires_in,
      environment: useProduction ? 'production' : 'sandbox',
    });

    // Return new token data
    res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refresh_token, // Use new refresh token if provided, otherwise keep old one
      expires_in: tokenData.expires_in,
      refresh_token_expires_in: tokenData.refresh_token_expires_in,
      token_type: tokenData.token_type,
    });

  } catch (error) {
    console.error('Error refreshing eBay token:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

