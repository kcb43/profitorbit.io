/**
 * Vercel Serverless Function - Facebook OAuth Debug
 * 
 * This endpoint helps debug OAuth configuration issues
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

    // Build callback URL - same logic as auth.js
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
    
    const redirectUri = `${baseUrl}/api/facebook/callback`;

    return res.status(200).json({
      debug: true,
      configuration: {
        hasAppId: !!appId,
        appIdPrefix: appId ? appId.substring(0, 20) + '...' : 'NOT SET',
        hasAppSecret: !!appSecret,
        redirectUri: redirectUri,
        baseUrl: baseUrl,
      },
      environment: {
        BASE_URL: process.env.BASE_URL || 'not set',
        VERCEL_URL: process.env.VERCEL_URL || 'not set',
        host: req.headers.host || 'not set',
        referer: req.headers.referer || 'not set',
        protocol: req.headers['x-forwarded-proto'] || 'not set',
      },
      instructions: [
        '1. Copy the redirectUri above',
        '2. Go to https://developers.facebook.com/apps',
        '3. Select your app (App ID: ' + (appId ? appId.substring(0, 20) + '...' : 'NOT SET') + ')',
        '4. Go to Settings > Basic',
        '5. Scroll to "Valid OAuth Redirect URIs"',
        '6. Add the redirectUri EXACTLY as shown above',
        '7. Make sure it matches EXACTLY (including https/http, domain, and path)',
        '8. Click Save Changes',
        '9. Try connecting again',
      ],
      commonIssues: [
        {
          issue: 'Redirect URI mismatch',
          solution: 'The redirect URI must match EXACTLY. Check for trailing slashes, http vs https, and full path.',
        },
        {
          issue: 'App ID not set',
          solution: 'Set FACEBOOK_APP_ID in Vercel environment variables and redeploy.',
        },
        {
          issue: 'App Secret not set',
          solution: 'Set FACEBOOK_APP_SECRET in Vercel environment variables and redeploy.',
        },
        {
          issue: 'App in Development mode',
          solution: 'Make sure your app is in Development mode and you are logged in as a test user, or submit for App Review.',
        },
      ],
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

