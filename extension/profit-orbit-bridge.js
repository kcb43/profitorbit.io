/**
 * Content Script for Profit Orbit Domain
 * SIMPLIFIED - Direct communication with background
 */

// IMMEDIATE LOG - Should appear FIRST
console.log('🔵🔵🔵 PROFIT ORBIT BRIDGE SCRIPT STARTING 🔵🔵🔵');
console.log('🔵 Bridge: Script file loaded at:', new Date().toISOString());
console.log('🔵 Bridge: URL:', window.location.href);
console.log('🔵 Bridge: Document ready state:', document.readyState);

// Prevent multiple initializations
if (window.__PROFIT_ORBIT_BRIDGE_INITIALIZED) {
  console.log('⚠️ Bridge: Already initialized, skipping duplicate load');
  throw new Error('Bridge script already initialized');
}
window.__PROFIT_ORBIT_BRIDGE_INITIALIZED = true;

// Check chrome availability immediately
console.log('🔵 Bridge: typeof chrome:', typeof chrome);
if (typeof chrome !== 'undefined') {
  console.log('🔵 Bridge: chrome.runtime exists:', !!chrome.runtime);
  if (chrome.runtime) {
    console.log('🔵 Bridge: chrome.runtime.id:', chrome.runtime.id);
    console.log('🔵 Bridge: chrome.runtime.sendMessage exists:', typeof chrome.runtime.sendMessage);
  }
} else {
  console.error('🔴 Bridge: chrome is undefined - this is a content script, chrome should exist!');
}

// Function to update localStorage with marketplace status
function updateLocalStorage(status) {
  if (!status) return;
  
  console.log('🔵 Bridge: Updating localStorage with status:', status);
  
  Object.entries(status).forEach(([marketplace, data]) => {
    if (data.loggedIn) {
      localStorage.setItem(`profit_orbit_${marketplace}_connected`, 'true');
      localStorage.setItem(`profit_orbit_${marketplace}_user`, JSON.stringify({
        userName: data.userName || data.name || 'User',
        marketplace: marketplace
      }));
      
      console.log(`🔵 Bridge: ${marketplace} marked as connected`);
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('marketplaceStatusUpdate', {
        detail: { marketplace, status: data }
      }));
    } else {
      localStorage.removeItem(`profit_orbit_${marketplace}_connected`);
      localStorage.removeItem(`profit_orbit_${marketplace}_user`);
    }
  });
  
  // Dispatch ready event
  window.dispatchEvent(new CustomEvent('extensionReady', {
    detail: { marketplaces: status }
  }));
}

// Function to query status from background
function queryStatus() {
  console.log('🔵 Bridge: queryStatus() called');
  
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('🔴 Bridge: chrome.runtime not available');
    return;
  }
  
  console.log('🔵 Bridge: Sending GET_ALL_STATUS message to background...');
  
  try {
    chrome.runtime.sendMessage({ type: 'GET_ALL_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('🔴 Bridge: Error from background:', chrome.runtime.lastError.message);
        return;
      }
      
      console.log('🔵 Bridge: Received response from background:', response);
      
      if (response?.status) {
        updateLocalStorage(response.status);
      } else {
        console.warn('⚠️ Bridge: Response has no status field:', response);
      }
    });
  } catch (error) {
    console.error('🔴 Bridge: Exception sending message:', error);
  }
}

// Listen for background messages
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🔵 Bridge: Received message from background:', message.type);
    
    if (message.type === 'MARKETPLACE_STATUS_UPDATE') {
      const { marketplace, data } = message;
      
      if (data.loggedIn) {
        localStorage.setItem(`profit_orbit_${marketplace}_connected`, 'true');
        localStorage.setItem(`profit_orbit_${marketplace}_user`, JSON.stringify(data));
        
        window.dispatchEvent(new CustomEvent('marketplaceStatusUpdate', {
          detail: { marketplace, status: data }
        }));
      }
      
      sendResponse({ received: true });
    }
    
    return true;
  });
  console.log('🔵 Bridge: Message listener registered');
} else {
  console.error('🔴 Bridge: Cannot register message listener - chrome.runtime not available');
}

// Poll localStorage for status requests from React app
setInterval(() => {
  const requestFlag = localStorage.getItem('profit_orbit_request_status');
  if (requestFlag === 'true') {
    console.log('🔵🔵🔵 Bridge: React app requested status via localStorage flag 🔵🔵🔵');
    localStorage.removeItem('profit_orbit_request_status');
    queryStatus();
  }
}, 500);

// Query status on load
function initializePolling() {
  console.log('🔵 Bridge: Initializing polling...');
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('🔵 Bridge: DOMContentLoaded fired, querying status...');
      setTimeout(queryStatus, 500);
    });
  } else {
    console.log('🔵 Bridge: Document already loaded, querying status immediately...');
    setTimeout(queryStatus, 500);
  }

  // Poll every 2 seconds
  setInterval(() => {
    queryStatus();
  }, 2000);
  
  console.log('🔵 Bridge: Polling initialized');
}

// Start initialization
initializePolling();

// Listen for manual checks
window.addEventListener('checkMercariStatus', () => {
  console.log('🔵 Bridge: Manual check requested via event');
  queryStatus();
});

// Set window flag for React app
if (typeof window !== 'undefined') {
  window.__PROFIT_ORBIT_BRIDGE_LOADED = true;
  console.log('🔵 Bridge: Window flag set - window.__PROFIT_ORBIT_BRIDGE_LOADED = true');
}

console.log('🔵🔵🔵 PROFIT ORBIT BRIDGE SCRIPT INITIALIZED 🔵🔵🔵');
