/**
 * Content Script for Profit Orbit Domain
 * Bridges communication between extension and Profit Orbit web app
 */

console.log('Profit Orbit Extension: Bridge script loaded on Profit Orbit domain');

// Inject script into page context to expose API to React app
// This is necessary because content scripts run in an isolated world
(function() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
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
          window.postMessage({ type: 'PROFIT_ORBIT_QUERY_STATUS' }, '*');
        },
        isAvailable: function() {
          return true; // Assume available if script is injected
        },
        getAllStatus: function(callback) {
          const requestId = Math.random().toString(36).substring(7);
          window.__ProfitOrbitCallbacks = window.__ProfitOrbitCallbacks || {};
          window.__ProfitOrbitCallbacks[requestId] = callback;
          window.postMessage({ 
            type: 'PROFIT_ORBIT_GET_ALL_STATUS', 
            requestId: requestId 
          }, '*');
        }
      };
      
      console.log('Profit Orbit Extension: Bridge API injected into page context', window.ProfitOrbitExtension);
    })();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
  console.log('Profit Orbit Extension: Page script injected');
})();

// Function to query extension for marketplace statuses (defined first so API can reference it)
function queryExtensionStatus() {
  // Check if extension context is still valid before sending message
  if (!chrome.runtime?.id) {
    console.log('Profit Orbit Bridge: Extension context invalidated - page may need refresh');
    return;
  }
  
  console.log('Profit Orbit Bridge: Querying extension for marketplace statuses...');
  
  chrome.runtime.sendMessage(
    { type: 'GET_ALL_STATUS' },
    (response) => {
      // Check for runtime errors
      if (chrome.runtime.lastError) {
        console.log('Profit Orbit Bridge: Extension context changed:', chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.status) {
        console.log('Profit Orbit Bridge: Marketplace statuses from extension:', response.status);
        
        // Update localStorage for all marketplaces
        Object.entries(response.status).forEach(([marketplace, data]) => {
          if (data.loggedIn) {
            const wasConnected = localStorage.getItem(`profit_orbit_${marketplace}_connected`) === 'true';
            localStorage.setItem(`profit_orbit_${marketplace}_connected`, 'true');
            localStorage.setItem(`profit_orbit_${marketplace}_user`, JSON.stringify({
              userName: data.userName || data.name || 'User',
              marketplace: marketplace
            }));
            
            // Dispatch event for React components (only if status changed)
            if (!wasConnected) {
              console.log(`Profit Orbit Bridge: ${marketplace} connection detected!`);
              window.dispatchEvent(new CustomEvent('marketplaceStatusUpdate', {
                detail: { marketplace, status: data }
              }));
            }
          } else {
            const wasConnected = localStorage.getItem(`profit_orbit_${marketplace}_connected`) === 'true';
            if (wasConnected) {
              localStorage.removeItem(`profit_orbit_${marketplace}_connected`);
              localStorage.removeItem(`profit_orbit_${marketplace}_user`);
            }
          }
        });
        
        // Trigger page update
        window.dispatchEvent(new CustomEvent('extensionReady', {
          detail: { marketplaces: response.status }
        }));
      } else {
        console.log('Profit Orbit Bridge: No status data received from extension');
      }
    }
  );
}

// Expose API to React app via window object immediately
// Since this runs at document_start, window should be available
if (typeof window !== 'undefined') {
  window.ProfitOrbitExtension = {
    // Query extension for marketplace status
    queryStatus: () => {
      console.log('Profit Orbit Bridge: queryStatus() called');
      queryExtensionStatus();
    },
    
    // Check if extension is available
    isAvailable: () => {
      try {
        const available = !!(chrome && chrome.runtime && chrome.runtime.id);
        console.log('Profit Orbit Bridge: isAvailable() =', available);
        return available;
      } catch (e) {
        console.log('Profit Orbit Bridge: isAvailable() error:', e);
        return false;
      }
    },
    
    // Get all marketplace statuses
    getAllStatus: (callback) => {
      console.log('Profit Orbit Bridge: getAllStatus() called');
      if (!chrome.runtime?.id) {
        console.log('Profit Orbit Bridge: Extension not available in getAllStatus');
        if (callback) callback({ error: 'Extension not available' });
        return;
      }
      
      chrome.runtime.sendMessage(
        { type: 'GET_ALL_STATUS' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log('Profit Orbit Bridge: getAllStatus error:', chrome.runtime.lastError.message);
            if (callback) callback({ error: chrome.runtime.lastError.message });
          } else {
            console.log('Profit Orbit Bridge: getAllStatus response:', response);
            if (callback) callback(response || {});
          }
        }
      );
    }
  };
  
  console.log('Profit Orbit Extension: Bridge API exposed to window.ProfitOrbitExtension', window.ProfitOrbitExtension);
} else {
  console.error('Profit Orbit Extension: window is not available - bridge script may have loaded too early');
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Profit Orbit received message from extension:', message);
  
  if (message.type === 'MARKETPLACE_STATUS_UPDATE') {
    const marketplace = message.marketplace;
    const data = message.data;
    
    // Update localStorage so the web app can access it
    if (data.loggedIn) {
      localStorage.setItem(`profit_orbit_${marketplace}_connected`, 'true');
      localStorage.setItem(`profit_orbit_${marketplace}_user`, JSON.stringify(data));
      console.log(`${marketplace} connection saved to localStorage`);
      
      // Dispatch custom event that React can listen to
      window.dispatchEvent(new CustomEvent('marketplaceStatusUpdate', {
        detail: { marketplace, status: data }
      }));
    } else {
      localStorage.removeItem(`profit_orbit_${marketplace}_connected`);
      localStorage.removeItem(`profit_orbit_${marketplace}_user`);
    }
    
    sendResponse({ received: true });
  }

  // Handle request for listing API configuration
  if (message.type === 'GET_LISTING_CONFIG') {
    // Get API URL from window (set by React app)
    const apiUrl = window.LISTING_API_URL || localStorage.getItem('LISTING_API_URL');
    
    // Get auth token from Supabase (if available)
    // The React app should expose this via window or localStorage
    const authToken = window.SUPABASE_AUTH_TOKEN || localStorage.getItem('SUPABASE_AUTH_TOKEN');
    
    sendResponse({
      apiUrl: apiUrl || null,
      authToken: authToken || null,
    });
    return true;
  }
  
  return true;
});


// Set up event listeners when window is ready
(function setupEventListeners() {
  if (typeof window === 'undefined') {
    // If window isn't ready yet, try again
    setTimeout(setupEventListeners, 100);
    return;
  }
  
  // Listen for manual refresh requests from React app
  window.addEventListener('checkMercariStatus', () => {
    console.log('Profit Orbit Bridge: Manual status check requested');
    queryExtensionStatus();
  });
  
  // On page load, query extension for all marketplace statuses
  window.addEventListener('load', () => {
    setTimeout(queryExtensionStatus, 1000);
  });
  
  // Also query immediately if DOM is already loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(queryExtensionStatus, 500);
  }
  
  // Poll every 2 seconds to keep status updated (more frequent for better detection)
  setInterval(queryExtensionStatus, 2000);
  
  console.log('Profit Orbit Bridge: Event listeners set up');
})();

// Listen for messages from the page script (via window.postMessage)
window.addEventListener('message', async (event) => {
  // Only accept messages from same origin
  if (event.source !== window) return;
  
  console.log('Bridge received window message:', event.data);
  
  // Handle API requests from page script
  if (event.data.type === 'PROFIT_ORBIT_QUERY_STATUS') {
    console.log('Bridge: Page script requested status query');
    queryExtensionStatus();
    return;
  }
  
  if (event.data.type === 'PROFIT_ORBIT_GET_ALL_STATUS') {
    console.log('Bridge: Page script requested all status');
    if (!chrome.runtime?.id) {
      // Send error back to page script
      window.postMessage({
        type: 'PROFIT_ORBIT_STATUS_RESPONSE',
        requestId: event.data.requestId,
        error: 'Extension not available'
      }, '*');
      return;
    }
    
    chrome.runtime.sendMessage(
      { type: 'GET_ALL_STATUS' },
      (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage({
            type: 'PROFIT_ORBIT_STATUS_RESPONSE',
            requestId: event.data.requestId,
            error: chrome.runtime.lastError.message
          }, '*');
        } else {
          window.postMessage({
            type: 'PROFIT_ORBIT_STATUS_RESPONSE',
            requestId: event.data.requestId,
            data: response || {}
          }, '*');
        }
      }
    );
    return;
  }
  
  if (event.data.type === 'CREATE_MERCARI_LISTING') {
    console.log('Forwarding Mercari listing request to extension...');
    console.log('chrome.runtime available:', !!chrome.runtime);
    console.log('Listing data to send:', event.data.listingData);
    
    // Check if extension context is still valid before sending message
    if (!chrome.runtime?.id) {
      console.error('Extension context invalidated - extension may have been reloaded');
      window.postMessage({
        type: 'MERCARI_LISTING_RESPONSE',
        success: false,
        error: 'Extension context invalidated. Please refresh this page and try again. If the issue persists, reload the extension.'
      }, '*');
      return;
    }
    
    try {
      // Forward to background script (Manifest V3 uses promises)
      console.log('Calling chrome.runtime.sendMessage...');
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_MERCARI_LISTING',
        listingData: event.data.listingData
      });
      
      console.log('✅ Extension response received:', response);
      
      // Send response back to web app
      window.postMessage({
        type: 'MERCARI_LISTING_RESPONSE',
        success: response?.success || false,
        listingId: response?.listingId,
        listingUrl: response?.listingUrl,
        error: response?.error || 'Unknown error occurred'
      }, '*');
    } catch (error) {
      console.error('Error communicating with extension:', error);
      
      // Check if it's a context invalidated error
      const isContextInvalidated = error.message?.includes('Extension context invalidated') || 
                                   error.message?.includes('message port closed') ||
                                   !chrome.runtime?.id;
      
      // Send error back to web app
      window.postMessage({
        type: 'MERCARI_LISTING_RESPONSE',
        success: false,
        error: isContextInvalidated 
          ? 'Extension context invalidated. Please refresh this page and try again. If the issue persists, reload the extension.'
          : (error.message || 'Failed to communicate with extension')
      }, '*');
    }
  }
});

console.log('Profit Orbit Extension: Bridge script initialized');

