/**
 * Mercari OAuth Start Endpoint
 * Initiates the OAuth flow by opening Mercari login
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  console.log('🟢 Mercari OAuth Start - Request received');
  
  try {
    // Get user ID from query or session
    const userId = req.query.userId || req.headers['x-user-id'];
    
    if (!userId) {
      console.error('❌ No user ID provided');
      return res.status(400).send(`
        <html>
          <body>
            <h1>Error: No user ID</h1>
            <script>
              window.opener?.postMessage({ type: 'MERCARI_AUTH_ERROR', error: 'No user ID' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }
    
    console.log('✅ User ID:', userId);
    
    // Store state for callback verification
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');
    
    // For now, redirect to Mercari login page
    // We'll capture the session after login
    const callbackUrl = `${req.headers.origin || 'https://profitorbit.io'}/api/mercari/oauth-callback`;
    const mercariLoginUrl = `https://www.mercari.com/login?redirect=${encodeURIComponent(callbackUrl)}&state=${state}`;
    
    console.log('🔄 Redirecting to Mercari login:', mercariLoginUrl);
    
    // Return HTML that redirects and monitors
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connecting to Mercari...</title>
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
            .spinner {
              border: 4px solid rgba(255, 255, 255, 0.3);
              border-radius: 50%;
              border-top: 4px solid white;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 20px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔗 Connecting to Mercari</h1>
            <div class="spinner"></div>
            <p>Redirecting to Mercari login...</p>
            <p style="font-size: 12px; opacity: 0.7;">State: ${state.substring(0, 20)}...</p>
          </div>
          
          <script>
            console.log('🟢 OAuth popup loaded');
            console.log('🔄 Will redirect to:', '${mercariLoginUrl}');
            
            // Monitor for network requests (if we can)
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              console.log('🌐 Fetch intercepted:', args[0]);
              return originalFetch.apply(this, args);
            };
            
            // Redirect after brief delay
            setTimeout(() => {
              console.log('🚀 Redirecting to Mercari...');
              window.location.href = '${mercariLoginUrl}';
            }, 2000);
            
            // Listen for messages from Mercari
            window.addEventListener('message', (event) => {
              console.log('📨 Message received:', event.data);
            });
          </script>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('❌ Error in OAuth start:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Error</h1>
          <p>${error.message}</p>
          <script>
            window.opener?.postMessage({ 
              type: 'MERCARI_AUTH_ERROR', 
              error: '${error.message}' 
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  }
}
