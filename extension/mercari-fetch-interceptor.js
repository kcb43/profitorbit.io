/**
 * Mercari Fetch Interceptor
 * This script runs in the MAIN world to intercept fetch calls before Mercari's code runs
 */

(function() {
  'use strict';
  
  console.log('🎯 Installing Mercari fetch interceptor in MAIN world...');
  
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override fetch
  window.fetch = function(...args) {
    const [url, options] = args;
    
    // Check if this is a Mercari API call
    if (typeof url === 'string' && url.includes('mercari.com/v1/api')) {
      console.log('🔍 Intercepted Mercari API call:', url);
      
      // Extract tokens from request
      if (options?.headers) {
        const headers = options.headers;
        let bearerToken = null;
        let csrfToken = null;
        let sellerId = null;
        
        // Check for Authorization header
        if (headers.Authorization || headers.authorization) {
          const authHeader = headers.Authorization || headers.authorization;
          if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            bearerToken = authHeader.substring(7);
            console.log('✅ Captured bearer token from fetch');
          }
        }
        
        // Check for CSRF token
        if (headers['x-csrf-token']) {
          csrfToken = headers['x-csrf-token'];
          console.log('✅ Captured CSRF token from fetch');
        }
        
        // Extract seller ID from request body
        if (options.body) {
          try {
            let bodyData = options.body;
            
            // Handle URL-encoded body
            if (typeof bodyData === 'string' && bodyData.includes('variables=')) {
              const params = new URLSearchParams(bodyData);
              const variablesStr = params.get('variables');
              if (variablesStr) {
                const variables = JSON.parse(variablesStr);
                if (variables.userItemsInput?.sellerId) {
                  sellerId = variables.userItemsInput.sellerId;
                  console.log('✅ Captured seller ID from URL-encoded body:', sellerId);
                }
              }
            } else if (typeof bodyData === 'string') {
              // Handle JSON body
              const body = JSON.parse(bodyData);
              if (body.variables?.userItemsInput?.sellerId) {
                sellerId = body.variables.userItemsInput.sellerId;
                console.log('✅ Captured seller ID from JSON body:', sellerId);
              }
            }
          } catch (e) {
            console.log('⚠️ Could not parse request body:', e);
          }
        }
        
        // Dispatch custom event to communicate with content script
        if (bearerToken || csrfToken || sellerId) {
          window.dispatchEvent(new CustomEvent('MERCARI_AUTH_INTERCEPTED', {
            detail: {
              bearerToken: bearerToken,
              csrfToken: csrfToken,
              sellerId: sellerId ? sellerId.toString() : null,
              timestamp: Date.now(),
            }
          }));
        }
      }
    }
    
    // Call original fetch
    return originalFetch.apply(this, args);
  };
  
  console.log('✅ Mercari fetch interceptor installed!');
})();
