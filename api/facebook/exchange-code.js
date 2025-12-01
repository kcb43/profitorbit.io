/**
 * Vercel Serverless Function - Exchange Facebook Authorization Code
 * 
 * This endpoint exchanges the authorization code from embedded signup
 * for an access token.
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
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const appId = process.env.VITE_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.VITE_FACEBOOK_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return res.status(500).json({ 
        error: 'Facebook App credentials not configured. Please set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET environment variables.' 
      });
    }

    // Build callback URL - should match what's configured in Facebook App Settings
    let baseUrl = null;
    
    // 1. Check for explicit BASE_URL environment variable (highest priority)
    if (process.env.BASE_URL) {
      baseUrl = process.env.BASE_URL.replace(/\/$/, '');
    }
    // 2. Check for VERCEL_URL (provided by Vercel)
    else if (process.env.VERCEL_URL) {
      const vercelUrl = process.env.VERCEL_URL.replace(/^https?:\/\//, '');
      baseUrl = `https://${vercelUrl}`;
    }
    // 3. Use request headers to determine URL
    else if (req.headers.host) {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      baseUrl = `${protocol}://${req.headers.host}`;
    }
    // 4. Last resort: localhost (for local development)
    else {
      baseUrl = 'http://localhost:5173';
    }
    
    const redirectUri = `${baseUrl}/api/facebook/callback`;

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'GET',
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Facebook token exchange failed: ${JSON.stringify(errorData)}`);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('No access token in response');
    }

    // Try to get long-lived token (60 days)
    let longLivedToken = tokenData.access_token;
    try {
      const longLivedUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${appId}` +
        `&client_secret=${appSecret}` +
        `&fb_exchange_token=${tokenData.access_token}`;

      const longLivedResponse = await fetch(longLivedUrl, {
        method: 'GET',
      });

      if (longLivedResponse.ok) {
        const longLivedData = await longLivedResponse.json();
        if (longLivedData.access_token) {
          longLivedToken = longLivedData.access_token;
          tokenData.expires_in = longLivedData.expires_in || 5184000; // 60 days in seconds
        }
      }
    } catch (error) {
      console.warn('Failed to get long-lived token, using short-lived token:', error);
      // Continue with short-lived token
    }

    // Return token data
    return res.status(200).json({
      access_token: longLivedToken,
      token_type: tokenData.token_type || 'bearer',
      expires_in: tokenData.expires_in || 3600, // Default to 1 hour if not provided
      expires_at: Date.now() + ((tokenData.expires_in || 3600) * 1000),
    });
  } catch (error) {
    console.error('Error exchanging Facebook code:', error);
    return res.status(500).json({
      error: 'Failed to exchange authorization code',
      details: error.message,
    });
  }
}

