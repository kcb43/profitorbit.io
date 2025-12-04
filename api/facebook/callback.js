/**
 * Vercel Serverless Function - Facebook OAuth Callback
 * 
 * This endpoint handles the OAuth callback from Facebook after user authorization.
 * It exchanges the authorization code for an access token and refresh token.
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
    const { code, state, error, error_reason, error_description } = req.query;

    // Build frontend URL for redirects
    // Priority: BASE_URL > Production domain from host > VERCEL_URL > Headers
    let frontendUrl = null;
    
    // 1. Check for explicit BASE_URL environment variable (highest priority)
    if (process.env.BASE_URL) {
      frontendUrl = process.env.BASE_URL.replace(/\/$/, '');
    }
    // 2. Try to extract production domain from host header
    else if (req.headers.host) {
      const host = req.headers.host;
      // If it's a preview deployment, try to use production domain
      if (host.includes('vercel.app') && host !== 'profitorbit.io') {
        // Use production domain
        const productionDomain = 'profitorbit.io';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        frontendUrl = `${protocol}://${productionDomain}`;
      } else {
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        frontendUrl = `${protocol}://${host}`;
      }
    }
    // 3. Use production domain as fallback if VERCEL_URL is a preview
    else if (process.env.VERCEL_URL) {
      const vercelUrl = process.env.VERCEL_URL.replace(/^https?:\/\//, '');
      // If it's a preview deployment, use production domain instead
      if (vercelUrl.includes('vercel.app') && !vercelUrl.startsWith('profitorbit.io')) {
        frontendUrl = 'https://profitorbit.io';
      } else {
        frontendUrl = `https://${vercelUrl}`;
      }
    }
    // 4. Try referer header
    else if (req.headers.referer) {
      try {
        const refererUrl = new URL(req.headers.referer);
        // If referer is a preview deployment, use production domain
        if (refererUrl.host.includes('vercel.app') && refererUrl.host !== 'profitorbit.io') {
          frontendUrl = 'https://profitorbit.io';
        } else {
          frontendUrl = refererUrl.origin;
        }
      } catch (e) {
        console.error('Error parsing referer:', e);
        frontendUrl = 'https://profitorbit.io'; // Fallback to production
      }
    }
    // 5. Last resort: use production domain
    else {
      frontendUrl = 'https://profitorbit.io';
    }
    
    // Default redirect path - redirect to CrosslistComposer (where connect button is)
    // This matches eBay's behavior
    const redirectPath = '/CrosslistComposer';

    // Check for errors from Facebook
    if (error) {
      console.error('Facebook OAuth error:', {
        error,
        error_reason,
        error_description,
        query: req.query,
        redirectUri: redirectUri,
      });
      
      let errorMsg = error_description || error_reason || error || 'Unknown OAuth error';
      
      // Provide helpful error messages for common issues
      if (error === 'redirect_uri_mismatch') {
        errorMsg = `Redirect URI mismatch. The redirect URI used (${redirectUri}) must match exactly what's configured in Facebook App Settings. Please check your Valid OAuth Redirect URIs in Facebook App Settings.`;
      } else if (error === 'invalid_client_id') {
        errorMsg = 'Invalid App ID. Please check that FACEBOOK_APP_ID is set correctly.';
      } else if (error === 'access_denied') {
        errorMsg = 'Access denied. You cancelled the authorization or did not grant the required permissions.';
      }
      
      return res.redirect(`${frontendUrl}${redirectPath}?facebook_auth_error=${encodeURIComponent(errorMsg)}`);
    }

    // Check for authorization code
    if (!code) {
      const userAgent = req.headers['user-agent'] || '';
      const isBot = userAgent.includes('compatible') || 
                    userAgent.includes('bot') || 
                    userAgent.includes('crawler') ||
                    userAgent.includes('spider') ||
                    !userAgent ||
                    userAgent.length < 10;
      
      if (isBot || Object.keys(req.query).length === 0) {
        console.log('Callback accessed by bot/health check without authorization code');
        return res.status(400).json({ 
          error: 'Invalid request',
          message: 'This endpoint requires OAuth authorization parameters'
        });
      }
      
      console.warn('Callback accessed without authorization code. Query params:', req.query);
      return res.redirect(
        `${frontendUrl}${redirectPath}?facebook_auth_error=${encodeURIComponent('OAuth callback was accessed without authorization code. Please try connecting again.')}`
      );
    }

    const appId = process.env.VITE_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.VITE_FACEBOOK_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return res.status(500).json({ 
        error: 'Facebook credentials not configured' 
      });
    }

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
    
    const redirectUri = `${baseUrl}/auth/facebook/callback`;

    // Facebook OAuth token endpoint
    const tokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token';

    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code: code,
    });

    const tokenResponse = await fetch(`${tokenUrl}?${tokenParams.toString()}`, {
      method: 'GET',
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Facebook OAuth token exchange error:', {
        status: tokenResponse.status,
        errorText,
        redirectUri,
        code: code?.substring(0, 20) + '...',
      });
      
      let errorMsg = 'Failed to exchange authorization code for access token';
      try {
        const errorData = JSON.parse(errorText);
        const fbError = errorData.error || {};
        errorMsg = fbError.message || errorData.error_description || fbError.type || errorMsg;
        
        // Provide helpful messages for common errors
        if (fbError.type === 'OAuthException') {
          if (fbError.message?.includes('redirect_uri')) {
            errorMsg = `Redirect URI mismatch: ${redirectUri}. This must match exactly what's configured in Facebook App Settings > Valid OAuth Redirect URIs.`;
          } else if (fbError.message?.includes('code')) {
            errorMsg = 'Invalid or expired authorization code. Please try connecting again.';
          } else {
            errorMsg = `Facebook OAuth error: ${fbError.message || errorMsg}`;
          }
        }
      } catch (e) {
        errorMsg = errorText || errorMsg;
      }
      
      return res.redirect(`${frontendUrl}${redirectPath}?facebook_auth_error=${encodeURIComponent(errorMsg)}`);
    }

    const tokenData = await tokenResponse.json();

    // Facebook returns:
    // - access_token: User token for API calls
    // - token_type: Usually "bearer"
    // - expires_in: Token expiration time in seconds (optional, can be long-lived)

    console.log('Facebook OAuth success:', {
      hasAccessToken: !!tokenData.access_token,
      expiresIn: tokenData.expires_in,
    });

    // Exchange short-lived token for long-lived token (60 days)
    let longLivedToken = tokenData.access_token;
    let expiresIn = tokenData.expires_in || 3600; // Default to 1 hour if not specified

    try {
      const longLivedTokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token';
      const longLivedParams = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: tokenData.access_token,
      });

      const longLivedResponse = await fetch(`${longLivedTokenUrl}?${longLivedParams.toString()}`, {
        method: 'GET',
      });

      if (longLivedResponse.ok) {
        const longLivedData = await longLivedResponse.json();
        longLivedToken = longLivedData.access_token;
        expiresIn = longLivedData.expires_in || 5184000; // 60 days in seconds
        console.log('Long-lived token obtained:', {
          expiresIn: expiresIn,
          expiresInDays: Math.floor(expiresIn / 86400),
        });
      } else {
        console.warn('Failed to get long-lived token, using short-lived token');
      }
    } catch (e) {
      console.warn('Error exchanging for long-lived token:', e);
      // Continue with short-lived token
    }

    // Encode tokens to pass to frontend
    const tokenEncoded = encodeURIComponent(JSON.stringify({
      access_token: longLivedToken,
      expires_in: expiresIn,
      token_type: tokenData.token_type || 'bearer',
      expires_at: Date.now() + (expiresIn * 1000), // Store expiration timestamp
    }));

    // Redirect to frontend page that will handle token storage
    return res.redirect(`${frontendUrl}${redirectPath}?facebook_auth_success=1&token=${tokenEncoded}`);

  } catch (error) {
    console.error('Error in Facebook OAuth callback:', error);
    
    let frontendUrl = null;
    if (process.env.BASE_URL) {
      frontendUrl = process.env.BASE_URL.replace(/\/$/, '');
    } else if (process.env.VERCEL_URL) {
      const vercelUrl = process.env.VERCEL_URL.replace(/^https?:\/\//, '');
      frontendUrl = `https://${vercelUrl}`;
    } else if (req.headers.host) {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      frontendUrl = `${protocol}://${req.headers.host}`;
    } else if (req.headers.referer) {
      try {
        frontendUrl = new URL(req.headers.referer).origin;
      } catch (e) {
        frontendUrl = 'http://localhost:5173';
      }
    } else {
      frontendUrl = 'http://localhost:5173';
    }
    
    return res.redirect(`${frontendUrl}/CrosslistComposer?facebook_auth_error=${encodeURIComponent(error.message)}`);
  }
}

