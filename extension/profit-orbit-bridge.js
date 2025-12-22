/**
 * Content Script for Profit Orbit Domain - SIMPLIFIED VERSION
 * Uses chrome.storage.local for communication (more reliable)
 */

console.log('🔵 Profit Orbit Bridge: Content script loaded');

// Function to sync marketplace status to localStorage
function syncStatusToLocalStorage(status) {
  if (!status) return;
  
  Object.entries(status).forEach(([marketplace, data]) => {
    if (data.loggedIn) {
      localStorage.setItem(`profit_orbit_${marketplace}_connected`, 'true');
      localStorage.setItem(`profit_orbit_${marketplace}_user`, JSON.stringify({
        userName: data.userName || data.name || 'User',
        marketplace: marketplace
      }));
      
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

// Query status from background
function queryStatus() {
  if (!chrome.runtime?.id) {
    console.warn('🔴 Bridge: chrome.runtime not available');
    return;
  }
  
  console.log('🔵 Bridge: Querying background for status...');
  
  chrome.runtime.sendMessage({ type: 'GET_ALL_STATUS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('🔴 Bridge: Error:', chrome.runtime.lastError.message);
      return;
    }
    
    console.log('🔵 Bridge: Received status:', response);
    
    if (response?.status) {
      syncStatusToLocalStorage(response.status);
    }
  });
}

// Listen for background messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔵 Bridge: Received message:', message.type);
  
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

// Listen for chrome.storage changes (backup method)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.profit_orbit_marketplace_status) {
    console.log('🔵 Bridge: Storage changed, syncing to localStorage');
    syncStatusToLocalStorage(changes.profit_orbit_marketplace_status.newValue);
  }
});

// Query on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(queryStatus, 500);
  });
} else {
  setTimeout(queryStatus, 500);
}

// Poll every 2 seconds
setInterval(queryStatus, 2000);

// Listen for manual checks
window.addEventListener('checkMercariStatus', queryStatus);

// Inject page API script
(function() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('profit-orbit-page-api.js');
  script.onload = () => {
    console.log('🔵 Bridge: Page API script loaded');
    script.remove();
  };
  script.onerror = () => {
    console.error('🔴 Bridge: Failed to load page API script');
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
})();

console.log('🔵 Profit Orbit Bridge: Initialized');
