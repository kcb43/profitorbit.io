/**
 * Content Script for Profit Orbit Domain - ULTRA SIMPLE VERSION
 * Uses localStorage polling for communication (most reliable)
 */

// CRITICAL: This log should appear in the PAGE CONSOLE (F12), not service worker console
console.log('🔵🔵🔵 Profit Orbit Bridge: Content script loaded - CHECK PAGE CONSOLE (F12) 🔵🔵🔵');
console.log('🔵 Bridge: Current URL:', window.location.href);
console.log('🔵 Bridge: Chrome runtime ID:', chrome.runtime?.id);
console.log('🔵 Bridge: Chrome runtime available:', !!(chrome && chrome.runtime && chrome.runtime.id));

// Make it VERY visible
if (typeof window !== 'undefined') {
  window.__PROFIT_ORBIT_BRIDGE_LOADED = true;
  console.log('🔵 Bridge: Window flag set - window.__PROFIT_ORBIT_BRIDGE_LOADED = true');
}

// Function to update localStorage with marketplace status
function updateLocalStorage(status) {
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

// Function to query status from background
function queryStatus() {
  // Check if we're in content script context (has chrome.runtime)
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    console.error('🔴 Bridge: chrome.runtime not available - script may be in wrong context');
    console.error('🔴 Bridge: typeof chrome:', typeof chrome);
    console.error('🔴 Bridge: chrome.runtime:', chrome?.runtime);
    console.error('🔴 Bridge: chrome.runtime.id:', chrome?.runtime?.id);
    
    // Try to get runtime ID from extension URL
    try {
      const runtimeId = chrome.runtime?.id;
      if (!runtimeId) {
        console.error('🔴 Bridge: Cannot proceed without chrome.runtime.id');
        return;
      }
    } catch (e) {
      console.error('🔴 Bridge: Error accessing chrome.runtime:', e);
      return;
    }
    return;
  }
  
  console.log('🔵 Bridge: Querying background for status...');
  console.log('🔵 Bridge: chrome.runtime.id:', chrome.runtime.id);
  
  chrome.runtime.sendMessage({ type: 'GET_ALL_STATUS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('🔴 Bridge: Error:', chrome.runtime.lastError.message);
      return;
    }
    
    console.log('🔵 Bridge: Received status:', response);
    
    if (response?.status) {
      updateLocalStorage(response.status);
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

// Poll localStorage for status requests from React app
setInterval(() => {
  // Check if React app is requesting status
  const requestFlag = localStorage.getItem('profit_orbit_request_status');
  if (requestFlag === 'true') {
    console.log('🔵🔵🔵 Bridge: React app requested status, querying... 🔵🔵🔵');
    localStorage.removeItem('profit_orbit_request_status');
    queryStatus();
  }
}, 500); // Check every 500ms

// Wait for chrome.runtime to be available before setting up polling
function waitForChromeRuntime(callback, maxAttempts = 10) {
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      clearInterval(checkInterval);
      console.log('🔵 Bridge: chrome.runtime is now available');
      callback();
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.error('🔴 Bridge: chrome.runtime never became available after', maxAttempts, 'attempts');
    }
  }, 500);
}

// Query on load (wait for chrome.runtime first)
waitForChromeRuntime(() => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(queryStatus, 500);
    });
  } else {
    setTimeout(queryStatus, 500);
  }

  // Also poll every 2 seconds to keep status updated
  setInterval(queryStatus, 2000);
});

// Listen for manual checks
window.addEventListener('checkMercariStatus', queryStatus);

console.log('🔵 Profit Orbit Bridge: Initialized');
