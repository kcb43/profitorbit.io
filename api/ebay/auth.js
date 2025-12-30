/**
 * Vercel Serverless Function - eBay OAuth Authorization
 * 
 * This endpoint initiates the eBay OAuth flow by redirecting users to eBay's authorization page.
 * After authorization, eBay redirects back to the callback URL with an authorization code.
 */

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
    const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
    const redirectUriName =
      process.env.EBAY_REDIRECT_URI_NAME ||
      process.env.EBAY_RU_NAME ||
      process.env.EBAY_OAUTH_REDIRECT_URI_NAME ||
      null;
    const ebayEnv = process.env.EBAY_ENV;
    const isProductionByEnv = ebayEnv === 'production' || ebayEnv?.trim() === 'production';
    const isProductionByClientId = clientId && (
      clientId.includes('-PRD-') || 
      clientId.includes('-PRD') || 
      clientId.startsWith('PRD-') ||
      /PRD/i.test(clientId)
    );
    const useProduction = isProductionByEnv || isProductionByClientId;

    if (!clientId) {
      return res.status(500).json({ 
        error: 'eBay Client ID not configured. Please set EBAY_CLIENT_ID environment variable.' 
      });
    }

    // eBay OAuth uses the "Redirect URI name" (RuName) for the `redirect_uri` parameter,
    // not the callback URL itself.
    if (!redirectUriName) {
      return res.status(500).json({
        error:
          'eBay redirect URI name (RuName) not configured. Please set EBAY_REDIRECT_URI_NAME in Vercel.',
        hint:
          'In eBay Developer Portal -> your app -> Auth (new security), copy the Redirect URI name (RuName) and set it as EBAY_REDIRECT_URI_NAME.',
      });
    }

    // Build callback URL - should match what's configured in eBay Developer Console
    // For OAuth 2.0, this must be YOUR application's callback URL, not eBay's signin page
    // Example: https://your-domain.vercel.app/api/ebay/callback
    
    // Try multiple sources for base URL (in priority order)
    let baseUrl = null;
    
    // 1. Check for explicit BASE_URL environment variable (highest priority)
    if (process.env.BASE_URL) {
      baseUrl = process.env.BASE_URL.replace(/\/$/, ''); // Remove trailing slash
    }
    // 2. Check for VERCEL_URL (provided by Vercel)
    else if (process.env.VERCEL_URL) {
      // VERCEL_URL is just the domain, add https://
      const vercelUrl = process.env.VERCEL_URL.replace(/^https?:\/\//, ''); // Remove protocol if present
      baseUrl = `https://${vercelUrl}`;
    }
    // 3. Use request headers to determine URL
    else if (req.headers.host) {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      baseUrl = `${protocol}://${req.headers.host}`;
    }
    // 4. Try referer header as fallback
    else if (req.headers.referer) {
      try {
        baseUrl = new URL(req.headers.referer).origin;
      } catch (e) {
        console.error('Error parsing referer:', e);
      }
    }
    // 5. Last resort: localhost (for local development)
    else {
      baseUrl = 'http://localhost:5173';
    }
    
    // This is the callback URL you configured/accepted in eBay dev portal.
    // NOTE: eBay still expects the RuName in the auth URL param.
    const callbackUrl = `${baseUrl}/api/ebay/callback`;
    
    console.log('OAuth Redirect URI construction:', {
      BASE_URL: process.env.BASE_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      host: req.headers.host,
      referer: req.headers.referer,
      finalBaseUrl: baseUrl,
      callbackUrl,
      redirectUriName,
      environment: useProduction ? 'production' : 'sandbox',
    });
    
    // Get optional state parameter for CSRF protection
    const state = req.query.state || Math.random().toString(36).substring(7);
    
    // eBay OAuth authorization URL
    const authUrl = useProduction
      ? 'https://auth.ebay.com/oauth2/authorize'
      : 'https://auth.sandbox.ebay.com/oauth2/authorize';

    // Scopes: use env override, otherwise default to a broad set used for selling + identity.
    // eBay scopes are space-separated.
    const scope =
      process.env.EBAY_OAUTH_SCOPES ||
      [
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
        'https://api.ebay.com/oauth/api_scope/sell.account',
        'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
        'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
      ].join(' ');

    // Build authorization URL with parameters
    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUriName,
      response_type: 'code',
      scope: scope,
      state: state,
    });

    const fullAuthUrl = `${authUrl}?${authParams.toString()}`;

    console.log('eBay OAuth authorization redirect:', {
      authUrl: fullAuthUrl,
      callbackUrl,
      redirectUriName,
      environment: useProduction ? 'production' : 'sandbox',
      clientId: clientId?.substring(0, 20) + '...',
    });

    // Validate that we have all required parameters before redirecting
    if (!clientId || !callbackUrl || !redirectUriName || !scope) {
      console.error('Missing required OAuth parameters:', {
        hasClientId: !!clientId,
        hasCallbackUrl: !!callbackUrl,
        hasRedirectUriName: !!redirectUriName,
        hasScope: !!scope,
      });
      return res.status(500).json({ 
        error: 'Invalid OAuth configuration',
        details: 'Missing required parameters for OAuth flow',
        callbackUrl,
        redirectUriName,
      });
    }

    // Debug mode: if ?debug=true is in query, return info instead of redirecting
    if (req.query.debug === 'true') {
      return res.status(200).json({
        debug: true,
        callbackUrl,
        redirectUriName,
        authUrl: fullAuthUrl,
        environment: useProduction ? 'production' : 'sandbox',
        clientIdPrefix: clientId?.substring(0, 30) + '...',
        baseUrl: baseUrl,
        environmentVariables: {
          hasBaseUrl: !!process.env.BASE_URL,
          hasVercelUrl: !!process.env.VERCEL_URL,
          vercelUrl: process.env.VERCEL_URL,
        },
        instructions: [
          '1. Verify callbackUrl is listed in eBay Developer Portal (Accepted/Allowed Redirect URI)',
          '2. Verify redirectUriName matches the "Redirect URI name" (RuName) for that callbackUrl',
          '2. Go to https://developer.ebay.com/my/keys',
          '3. Find your OAuth 2.0 Redirect URIs section',
          '4. Make sure the callbackUrl matches EXACTLY (including https/http and path)',
          '5. If it doesn\'t match, either:',
          '   - Add the callbackUrl to eBay Developer Console, OR',
          '   - Set BASE_URL environment variable to match what\'s in eBay Console',
        ],
      });
    }

    // Redirect user to eBay authorization page
    res.redirect(fullAuthUrl);

  } catch (error) {
    console.error('Error initiating eBay OAuth:', error);
    
    // Return detailed error information
    const baseUrl = process.env.BASE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'unknown');
    const callbackUrl = `${baseUrl}/api/ebay/callback`;
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      callbackUrl,
      hint: 'Make sure EBAY_REDIRECT_URI_NAME (RuName) matches what is configured in eBay Developer Console',
    });
  }
}

