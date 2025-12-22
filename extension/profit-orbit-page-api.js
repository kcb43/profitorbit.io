/**
 * Page Context API - SIMPLIFIED VERSION
 */

(function() {
  'use strict';
  
  console.log('🟢 Profit Orbit Page API: Loading...');
  
  // Listen for chrome.storage changes via content script
  window.addEventListener('storage', (e) => {
    if (e.key === 'profit_orbit_mercari_connected' && e.newValue === 'true') {
      console.log('🟢 Page API: Mercari connection detected via storage event');
    }
  });
  
  // Expose API
  window.ProfitOrbitExtension = {
    queryStatus: function() {
      console.log('🟢 Page API: queryStatus() called');
      window.postMessage({ type: 'PROFIT_ORBIT_QUERY_STATUS' }, '*');
    },
    
    isAvailable: function() {
      return true;
    },
    
    getAllStatus: function(callback) {
      console.log('🟢 Page API: getAllStatus() called');
      const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      window.__ProfitOrbitCallbacks = window.__ProfitOrbitCallbacks || {};
      window.__ProfitOrbitCallbacks[requestId] = callback;
      
      window.postMessage({
        type: 'PROFIT_ORBIT_GET_ALL_STATUS',
        requestId: requestId
      }, '*');
      
      setTimeout(() => {
        if (window.__ProfitOrbitCallbacks[requestId]) {
          delete window.__ProfitOrbitCallbacks[requestId];
          if (callback) callback({ error: 'Timeout' });
        }
      }, 5000);
    }
  };
  
  // Listen for responses
  window.addEventListener('message', function(event) {
    if (event.data.type === 'PROFIT_ORBIT_STATUS_RESPONSE') {
      const callback = window.__ProfitOrbitCallbacks?.[event.data.requestId];
      if (callback) {
        delete window.__ProfitOrbitCallbacks[event.data.requestId];
        if (event.data.error) {
          callback({ error: event.data.error });
        } else {
          callback(event.data.data || {});
        }
      }
    }
  });
  
  window.dispatchEvent(new CustomEvent('profitOrbitBridgeReady', {
    detail: { api: window.ProfitOrbitExtension }
  }));
  
  console.log('🟢 Profit Orbit Page API: Ready!');
})();
