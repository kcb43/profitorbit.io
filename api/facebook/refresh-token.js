/**
 * Vercel Serverless Function - Facebook Access Token Refresh
 * 
 * Facebook doesn't provide refresh tokens like OAuth 2.0 standard.
 * Instead, we exchange short-lived tokens for long-lived tokens (60 days).
 * This endpoint handles that exchange or validates existing tokens.
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
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ 
        error: 'Access token is required' 
      });
    }

    const appId = process.env.VITE_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.VITE_FACEBOOK_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return res.status(500).json({ 
        error: 'Facebook credentials not configured' 
      });
    }

    // First, check if token is still valid
    const debugUrl = `https://graph.facebook.com/v18.0/debug_token?input_token=${access_token}&access_token=${appId}|${appSecret}`;
    
    const debugResponse = await fetch(debugUrl);
    
    if (!debugResponse.ok) {
      const errorText = await debugResponse.text();
      console.error('Facebook token debug error:', debugResponse.status, errorText);
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        details: 'Token validation failed'
      });
    }

    const debugData = await debugResponse.json();
    
    if (!debugData.data || !debugData.data.is_valid) {
      return res.status(401).json({ 
        error: 'Token is invalid',
        details: debugData.data?.error_message || 'Token validation failed'
      });
    }

    // Check if token is already long-lived (expires in more than 30 days)
    const expiresAt = debugData.data.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const daysUntilExpiry = expiresAt ? Math.floor((expiresAt - now) / 86400) : 0;

    // If token expires in more than 30 days, it's already long-lived
    if (daysUntilExpiry > 30) {
      return res.status(200).json({
        access_token: access_token,
        expires_in: expiresAt - now,
        token_type: 'bearer',
        expires_at: expiresAt,
        message: 'Token is already long-lived',
      });
    }

    // Exchange short-lived token for long-lived token
    const exchangeUrl = 'https://graph.facebook.com/v18.0/oauth/access_token';
    const exchangeParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: access_token,
    });

    const exchangeResponse = await fetch(`${exchangeUrl}?${exchangeParams.toString()}`, {
      method: 'GET',
    });

    if (!exchangeResponse.ok) {
      const errorText = await exchangeResponse.text();
      console.error('Facebook token exchange error:', exchangeResponse.status, errorText);
      let errorMsg = 'Failed to exchange token';
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.error?.message || errorData.error_description || errorData.error || errorMsg;
      } catch (e) {
        errorMsg = errorText || errorMsg;
      }
      return res.status(exchangeResponse.status).json({ 
        error: errorMsg,
        details: errorText 
      });
    }

    const exchangeData = await exchangeResponse.json();

    console.log('Facebook token exchange success:', {
      hasAccessToken: !!exchangeData.access_token,
      expiresIn: exchangeData.expires_in,
      expiresInDays: Math.floor((exchangeData.expires_in || 0) / 86400),
    });

    // Calculate expiration timestamp
    const newExpiresAt = Math.floor(Date.now() / 1000) + (exchangeData.expires_in || 5184000);

    // Return new token data
    res.status(200).json({
      access_token: exchangeData.access_token,
      expires_in: exchangeData.expires_in || 5184000, // 60 days default
      token_type: exchangeData.token_type || 'bearer',
      expires_at: newExpiresAt,
    });

  } catch (error) {
    console.error('Error refreshing Facebook token:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

