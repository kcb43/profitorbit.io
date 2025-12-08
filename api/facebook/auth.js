/**
 * Vercel Serverless Function - Facebook OAuth Authorization
 * 
 * This endpoint initiates the Facebook OAuth flow by redirecting users to Facebook's authorization page.
 * After authorization, Facebook redirects back to the callback URL with an authorization code.
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
    const appId = process.env.VITE_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.VITE_FACEBOOK_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    if (!appId) {
      return res.status(500).json({ 
        error: 'Facebook App ID not configured. Please set FACEBOOK_APP_ID environment variable.' 
      });
    }

    // Build callback URL - should match what's configured in Facebook App Settings
    let baseUrl = null;
    
    // 1. Check for explicit BASE_URL environment variable (highest priority)
    if (process.env.BASE_URL) {
      baseUrl = process.env.BASE_URL.replace(/\/$/, ''); // Remove trailing slash
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
    
    const redirectUri = `${baseUrl}/auth/facebook/callback`;
    
    console.log('Facebook OAuth Redirect URI construction:', {
      BASE_URL: process.env.BASE_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      host: req.headers.host,
      referer: req.headers.referer,
      finalBaseUrl: baseUrl,
      finalRedirectUri: redirectUri,
    });
    
    // Get optional state parameter for CSRF protection
    const state = req.query.state || Math.random().toString(36).substring(7);
    
    // Facebook OAuth authorization URL
    const authUrl = 'https://www.facebook.com/v18.0/dialog/oauth';

    // OAuth scopes for Facebook integration
    // For Business type apps, we need at least one permission beyond public_profile and email
    // 
    // Required permissions:
    // - public_profile: Basic profile info (automatic)
    // - email: User's email address (automatic but must be requested)
    // - pages_show_list: See which Pages the user manages (needed for listing)
    // 
    // For automation/extension-based listing, we just need to identify the user and their pages
    const scope = 'public_profile,email,pages_show_list';

    // Build authorization URL with parameters
    const authParams = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope,
      state: state,
    });

    const fullAuthUrl = `${authUrl}?${authParams.toString()}`;

    console.log('Facebook OAuth authorization redirect:', {
      authUrl: fullAuthUrl,
      redirectUri,
      appId: appId?.substring(0, 20) + '...',
    });

    // Validate that we have all required parameters before redirecting
    if (!appId || !redirectUri || !scope) {
      console.error('Missing required OAuth parameters:', {
        hasAppId: !!appId,
        hasRedirectUri: !!redirectUri,
        hasScope: !!scope,
      });
      return res.status(500).json({ 
        error: 'Invalid OAuth configuration',
        details: 'Missing required parameters for OAuth flow',
        redirectUri: redirectUri,
      });
    }

    // Debug mode: if ?debug=true is in query, return info instead of redirecting
    if (req.query.debug === 'true') {
      return res.status(200).json({
        debug: true,
        redirectUri: redirectUri,
        authUrl: fullAuthUrl,
        appIdPrefix: appId?.substring(0, 30) + '...',
        baseUrl: baseUrl,
        environmentVariables: {
          hasBaseUrl: !!process.env.BASE_URL,
          hasVercelUrl: !!process.env.VERCEL_URL,
          vercelUrl: process.env.VERCEL_URL,
        },
        instructions: [
          '1. Copy the redirectUri above',
          '2. Go to https://developers.facebook.com/apps',
          '3. Select your app and go to Settings > Basic',
          '4. Add the redirectUri to "Valid OAuth Redirect URIs"',
          '5. Make sure it matches EXACTLY (including https/http and path)',
        ],
      });
    }

    // Redirect user to Facebook authorization page
    res.redirect(fullAuthUrl);

  } catch (error) {
    console.error('Error initiating Facebook OAuth:', error);
    
    const baseUrl = process.env.BASE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'unknown');
    const redirectUri = `${baseUrl}/auth/facebook/callback`;
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      redirectUri: redirectUri,
      hint: 'Make sure the redirect_uri matches exactly what is configured in Facebook App Settings',
    });
  }
}

