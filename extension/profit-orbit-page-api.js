// Page Context Script - Injected into Profit Orbit web app
// This runs in the page context, not the isolated content script context

(function() {
  'use strict';
  
  console.log('[PAGE] Profit Orbit Extension: Page script loaded');
  console.log('[PAGE] Profit Orbit Extension: URL:', window.location.href);
  
  // Store reference to content script's message handler
  window.__ProfitOrbitBridgeReady = true;
  
  // Listen for responses from content script
  window.addEventListener('message', function(event) {
    if (event.data.type === 'PROFIT_ORBIT_STATUS_RESPONSE') {
      const callback = window.__ProfitOrbitCallbacks && window.__ProfitOrbitCallbacks[event.data.requestId];
      if (callback) {
        if (event.data.error) {
          callback({ error: event.data.error });
        } else {
          callback(event.data.data || {});
        }
        delete window.__ProfitOrbitCallbacks[event.data.requestId];
      }
    }
  });
  
  // Expose API that will communicate with content script via postMessage
  window.ProfitOrbitExtension = {
    queryStatus: function() {
      console.log('[PAGE] Profit Orbit Extension: queryStatus() called');
      window.postMessage({ type: 'PROFIT_ORBIT_QUERY_STATUS' }, '*');
    },
    isAvailable: function() {
      console.log('[PAGE] Profit Orbit Extension: isAvailable() called - returning true');
      return true; // Assume available if script is injected
    },
    getAllStatus: function(callback) {
      console.log('[PAGE] Profit Orbit Extension: getAllStatus() called');
      const requestId = Math.random().toString(36).substring(7);
      window.__ProfitOrbitCallbacks = window.__ProfitOrbitCallbacks || {};
      window.__ProfitOrbitCallbacks[requestId] = callback;
      window.postMessage({ 
        type: 'PROFIT_ORBIT_GET_ALL_STATUS', 
        requestId: requestId 
      }, '*');
    }
  };
  
  console.log('[PAGE] Profit Orbit Extension: Bridge API injected into page context', window.ProfitOrbitExtension);
  console.log('[PAGE] Profit Orbit Extension: API methods:', Object.keys(window.ProfitOrbitExtension));
  
  // Dispatch a custom event to notify React app that bridge is ready
  window.dispatchEvent(new CustomEvent('profitOrbitBridgeReady', {
    detail: { api: window.ProfitOrbitExtension }
  }));
})();

