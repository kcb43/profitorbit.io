/**
 * Mercari OAuth Callback Endpoint
 * Handles the redirect after Mercari login
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  console.log('🟢 Mercari OAuth Callback - Request received');
  console.log('📋 Query params:', req.query);
  console.log('🍪 Cookies:', req.headers.cookie);
  console.log('📨 Headers:', req.headers);
  
  try {
    const { state, code, token, access_token } = req.query;
    
    // Decode state
    let userId;
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = decoded.userId;
        console.log('✅ Decoded user ID:', userId);
      } catch (e) {
        console.error('❌ Failed to decode state:', e);
      }
    }
    
    // Check what we received
    console.log('🔍 Checking for auth data...');
    console.log('  - code:', code ? '✅' : '❌');
    console.log('  - token:', token ? '✅' : '❌');
    console.log('  - access_token:', access_token ? '✅' : '❌');
    console.log('  - cookies:', req.headers.cookie ? '✅' : '❌');
    
    // Try to extract any tokens from various sources
    const authData = {
      code,
      token,
      access_token,
      cookies: req.headers.cookie,
      timestamp: Date.now()
    };
    
    // If we got a token, try to validate it
    let isValid = false;
    if (access_token || token) {
      console.log('🧪 Testing token validity...');
      const testToken = access_token || token;
      
      try {
        const testResponse = await fetch('https://www.mercari.com/v1/api', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            operationName: 'userItemsQuery',
            variables: { userItemsInput: { sellerId: 0 } }
          })
        });
        
        isValid = testResponse.ok;
        console.log(isValid ? '✅ Token is valid!' : '❌ Token is invalid');
      } catch (e) {
        console.error('❌ Token validation failed:', e);
      }
    }
    
    // Store auth data if we have user ID
    if (userId && (code || token || access_token)) {
      console.log('💾 Storing auth data for user:', userId);
      
      // Store in database
      await supabase
        .from('marketplace_connections')
        .upsert({
          user_id: userId,
          marketplace: 'mercari',
          auth_data: authData,
          is_valid: isValid,
          connected_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,marketplace'
        });
      
      console.log('✅ Auth data stored');
    }
    
    // Return HTML that closes popup and sends message to parent
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mercari Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 20px;
              backdrop-filter: blur(10px);
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">${isValid ? '✅' : '🔄'}</div>
            <h1>${isValid ? 'Successfully Connected!' : 'Processing...'}</h1>
            <p>${isValid ? 'You can close this window' : 'Completing authentication...'}</p>
            <p style="font-size: 12px; opacity: 0.7; margin-top: 20px;">
              Debug Info:<br>
              Code: ${code ? '✅' : '❌'}<br>
              Token: ${token ? '✅' : '❌'}<br>
              Access Token: ${access_token ? '✅' : '❌'}<br>
              Cookies: ${req.headers.cookie ? '✅' : '❌'}<br>
              Valid: ${isValid ? '✅' : '❌'}
            </p>
          </div>
          
          <script>
            console.log('🟢 OAuth callback loaded');
            console.log('📋 Auth data:', ${JSON.stringify(authData)});
            console.log('✅ Is valid:', ${isValid});
            
            // Send message to parent window
            if (window.opener) {
              console.log('📤 Sending message to parent window...');
              window.opener.postMessage({
                type: 'MERCARI_AUTH_${isValid ? 'SUCCESS' : 'PARTIAL'}',
                data: {
                  hasCode: ${!!code},
                  hasToken: ${!!(token || access_token)},
                  hasCookies: ${!!req.headers.cookie},
                  isValid: ${isValid},
                  timestamp: ${Date.now()}
                }
              }, '*');
              
              // Close after delay
              setTimeout(() => {
                console.log('🔒 Closing popup...');
                window.close();
              }, ${isValid ? 2000 : 5000});
            } else {
              console.log('⚠️ No opener window found');
            }
            
            // Also try to extract session from current page
            console.log('🍪 Current cookies:', document.cookie);
            console.log('💾 Local storage:', localStorage);
            console.log('💾 Session storage:', sessionStorage);
          </script>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('❌ Error in OAuth callback:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Error</h1>
          <p>${error.message}</p>
          <pre>${error.stack}</pre>
          <script>
            window.opener?.postMessage({ 
              type: 'MERCARI_AUTH_ERROR', 
              error: '${error.message}' 
            }, '*');
          </script>
        </body>
      </html>
    `);
  }
}
