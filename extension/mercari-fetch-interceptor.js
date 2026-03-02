/**
 * Mercari Fetch Interceptor
 * This script runs in the MAIN world to intercept fetch calls before Mercari's code runs
 */

(function() {
  'use strict';
  
  console.log('🎯 Installing Mercari fetch/XHR interceptor in MAIN world...');

  // Keywords that indicate a price/offer/update mutation we want to capture
  const INTERESTING_OPS = /update|edit|price|offer|promote|discount|negotiate|reduce|item.*mut/i;

  // Dispatch captured GraphQL operation to content script for storage
  function captureGraphQLOp(operationName, hash, variables, method) {
    console.log(`🎯 Captured GraphQL op: ${operationName} [${method}] hash=${hash}`);
    window.dispatchEvent(new CustomEvent('MERCARI_GRAPHQL_OP_CAPTURED', {
      detail: { operationName, hash, variables, method, timestamp: Date.now() }
    }));
  }

  // Extract operation info from URL query params (GET requests)
  function checkGetUrl(url) {
    try {
      const u = new URL(url);
      const opName = u.searchParams.get('operationName');
      const extRaw = u.searchParams.get('extensions');
      if (opName && extRaw) {
        const ext = JSON.parse(extRaw);
        const hash = ext?.persistedQuery?.sha256Hash;
        if (hash) {
          const vars = u.searchParams.get('variables');
          captureGraphQLOp(opName, hash, vars ? JSON.parse(vars) : null, 'GET');
        }
      }
    } catch {}
  }

  // Store original fetch
  const originalFetch = window.fetch;

  // Resolve the URL string from any fetch argument type (string, URL, Request)
  function resolveUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (input instanceof Request) return input.url;
    try { return String(input); } catch { return ''; }
  }

  // Resolve the body from fetch arguments (could be in options or in a Request object)
  function resolveBody(input, options) {
    if (options?.body) return options.body;
    if (input instanceof Request) {
      // Request.body is a ReadableStream, but we can check the _bodyInit or clone
      // For our purposes, we'll intercept via the options path
    }
    return null;
  }

  // Resolve headers from fetch arguments
  function resolveHeaders(input, options) {
    if (options?.headers) return options.headers;
    if (input instanceof Request) {
      const h = {};
      try { input.headers.forEach((v, k) => { h[k] = v; }); } catch {}
      return h;
    }
    return null;
  }

  // Override fetch
  window.fetch = function(...args) {
    const [input, options] = args;
    const urlStr = resolveUrl(input);

    // Check if this is a Mercari API call (broad match)
    const isMercariApi = urlStr.includes('mercari.com/v1/api') || urlStr.includes('mercari.com/graphql');

    if (isMercariApi) {
      console.log('🔍 Intercepted Mercari API call (fetch):', urlStr);

      // Check GET query params for operation info
      checkGetUrl(urlStr);

      // Log the request body to see what queries are being made (POST)
      const body = resolveBody(input, options);
      if (body) {
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          if (parsed.operationName && parsed.extensions?.persistedQuery) {
            console.log('📋 GraphQL Operation:', parsed.operationName);
            console.log('🔑 Persisted Query Hash:', parsed.extensions.persistedQuery.sha256Hash);
            console.log('📦 Variables:', parsed.variables);
            captureGraphQLOp(parsed.operationName, parsed.extensions.persistedQuery.sha256Hash, parsed.variables, 'POST');
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      // If it's a Request object, also try to clone and read its body
      if (input instanceof Request && !body) {
        try {
          const cloned = input.clone();
          cloned.text().then(text => {
            try {
              const parsed = JSON.parse(text);
              if (parsed.operationName && parsed.extensions?.persistedQuery) {
                console.log('📋 GraphQL Operation (from Request body):', parsed.operationName);
                console.log('🔑 Persisted Query Hash:', parsed.extensions.persistedQuery.sha256Hash);
                captureGraphQLOp(parsed.operationName, parsed.extensions.persistedQuery.sha256Hash, parsed.variables, 'POST');
              }
            } catch {}
          }).catch(() => {});
        } catch {}
      }
      
      // Extract tokens from request
      const resolvedHeaders = resolveHeaders(input, options);
      if (resolvedHeaders) {
        const headers = resolvedHeaders;
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
        const bodyForSeller = resolveBody(input, options);
        if (bodyForSeller) {
          try {
            let bodyData = bodyForSeller;
            
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
    
    // Log any other mercari.com fetch calls we might be missing
    if (!isMercariApi && urlStr.includes('mercari.com')) {
      console.log('🔎 Other Mercari fetch (not /v1/api):', urlStr.substring(0, 120));
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
