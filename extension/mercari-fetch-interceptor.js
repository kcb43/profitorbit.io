/**
 * Mercari Fetch Interceptor
 * This script runs in the MAIN world to intercept fetch calls before Mercari's code runs
 */

(function() {
  'use strict';
  
  console.log('🎯 Installing Mercari fetch/XHR interceptor in MAIN world...');
  
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override fetch
  window.fetch = function(...args) {
    const [url, options] = args;
    
    // Check if this is a Mercari API call
    if (typeof url === 'string' && url.includes('mercari.com/v1/api')) {
      console.log('🔍 Intercepted Mercari API call (fetch):', url);
      
      // Log the request body to see what queries are being made
      if (options?.body) {
        try {
          const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
          if (body.operationName && body.extensions?.persistedQuery) {
            console.log('📋 GraphQL Operation:', body.operationName);
            console.log('🔑 Persisted Query Hash:', body.extensions.persistedQuery.sha256Hash);
            console.log('📦 Variables:', body.variables);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
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
  
  // Also intercept XMLHttpRequest (Mercari might use XHR instead of fetch)
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    this._method = method;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    const url = this._url;
    
    // Check if this is a Mercari API call
    if (typeof url === 'string' && url.includes('mercari.com/v1/api')) {
      console.log('🔍 Intercepted Mercari API call (XHR):', url);
      
      // Extract seller ID from request body
      if (body && typeof body === 'string') {
        try {
          let sellerId = null;
          
          // Handle URL-encoded body
          if (body.includes('variables=')) {
            const params = new URLSearchParams(body);
            const variablesStr = params.get('variables');
            if (variablesStr) {
              const variables = JSON.parse(variablesStr);
              if (variables.userItemsInput?.sellerId) {
                sellerId = variables.userItemsInput.sellerId;
                console.log('✅ Captured seller ID from XHR URL-encoded body:', sellerId);
              }
            }
          } else {
            // Handle JSON body
            const bodyObj = JSON.parse(body);
            if (bodyObj.variables?.userItemsInput?.sellerId) {
              sellerId = bodyObj.variables.userItemsInput.sellerId;
              console.log('✅ Captured seller ID from XHR JSON body:', sellerId);
            }
          }
          
          // Dispatch custom event if we found seller ID
          if (sellerId) {
            window.dispatchEvent(new CustomEvent('MERCARI_AUTH_INTERCEPTED', {
              detail: {
                bearerToken: null,
                csrfToken: null,
                sellerId: sellerId.toString(),
                timestamp: Date.now(),
              }
            }));
          }
        } catch (e) {
          console.log('⚠️ Could not parse XHR request body:', e);
        }
      }
    }
    
    return originalXHRSend.apply(this, [body]);
  };
  
  console.log('✅ Mercari fetch/XHR interceptor installed!');
})();
