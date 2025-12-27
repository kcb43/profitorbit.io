/**
 * Content Script for Profit Orbit Domain
 * SIMPLIFIED - Direct communication with background
 */

// IMMEDIATE LOG - Should appear FIRST
// Using try-catch to prevent any parse errors from silently failing
try {
  console.log('🔵🔵🔵 PROFIT ORBIT BRIDGE SCRIPT STARTING 🔵🔵🔵');
  console.log('🔵 Bridge: Script file loaded at:', new Date().toISOString());
  console.log('🔵 Bridge: URL:', window.location.href);
  console.log('🔵 Bridge: Document ready state:', document.readyState);
  console.log('🔵 Bridge: Content script context - window exists:', typeof window !== 'undefined');
  console.log('🔵 Bridge: Content script context - document exists:', typeof document !== 'undefined');
  console.log('🔵 Bridge: Content script context - chrome exists:', typeof chrome !== 'undefined');
} catch (e) {
  console.error('🔴 Bridge: ERROR in initial logging:', e);
}

// Prevent multiple initializations (using content script's isolated window)
// Note: This is the content script's window, NOT the page's window
if (typeof window !== 'undefined' && window.__PROFIT_ORBIT_BRIDGE_INITIALIZED) {
  console.log('⚠️ Bridge: Already initialized, skipping duplicate load');
  // Don't throw - just return to avoid breaking injection
  // throw new Error('Bridge script already initialized');
} else {
  if (typeof window !== 'undefined') {
    window.__PROFIT_ORBIT_BRIDGE_INITIALIZED = true;
  }
}

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

// Listen for page context requests to create a Mercari listing
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (msg?.type === "PO_CREATE_MERCARI_LISTING") {
    chrome.runtime.sendMessage(
      { type: "CREATE_MERCARI_LISTING", listingData: msg.payload },
      (resp) => {
        window.postMessage({ type: "PO_CREATE_MERCARI_LISTING_RESULT", resp }, "*");
      }
    );
  }
});

// Helper: extract Supabase access token from localStorage
function parseSupabaseTokenValue(raw) {
  if (!raw) return null;

  // If the value itself is a JWT, return it
  if (typeof raw === "string" && raw.split(".").length === 3) return raw;

  try {
    const parsed = JSON.parse(raw);
    // Supabase common shapes (v1/v2)
    return (
      parsed?.currentSession?.access_token ||
      parsed?.currentSession?.accessToken ||
      parsed?.session?.access_token ||
      parsed?.data?.session?.access_token ||
      parsed?.access_token ||
      parsed?.accessToken ||
      null
    );
  } catch (_) {
    // ignore
  }

  // Sometimes it's a JSON string embedded in a string
  if (typeof raw === "string" && raw.includes("{") && raw.includes("access_token")) {
    try {
      const parsed2 = JSON.parse(raw);
      return (
        parsed2?.currentSession?.access_token ||
        parsed2?.session?.access_token ||
        parsed2?.access_token ||
        null
      );
    } catch (_) {
      // ignore
    }
  }

  return null;
}

function extractSupabaseToken() {
  try {
    const keys = Object.keys(localStorage);

    // Prefer the canonical Supabase v2 key pattern first: sb-<ref>-auth-token
    const preferred = keys
      .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
      .concat(keys);

    for (const key of preferred) {
      if (!key.includes("auth") && !key.includes("supabase") && !key.startsWith("sb-")) continue;
      const raw = localStorage.getItem(key);
      const token = parseSupabaseTokenValue(raw);
      if (token) return token;
    }
  } catch (_) {
    // ignore
  }
  return null;
}

function getListingConfig() {
  const authToken = extractSupabaseToken();
  const apiUrl =
    window.__PO_API_URL ||
    window.__LISTING_API_URL ||
    "https://profitorbit-api.fly.dev";
  return { apiUrl, authToken };
}

let __poLastMissingConfigWarnAt = 0;
function ensurePlatformConnected(platform) {
  const platformId =
    typeof platform === "string"
      ? platform
      : platform?.platform || platform?.marketplace || platform?.id || "unknown";

  const { apiUrl, authToken } = getListingConfig();
  // apiUrl has a default; authToken may be missing if user isn't logged in yet.
  if (!authToken) {
    const now = Date.now();
    if (now - __poLastMissingConfigWarnAt > 30000) {
      __poLastMissingConfigWarnAt = now;
      console.warn("âš ï¸ Bridge: Missing authToken; cannot connect platform", {
        platform: platformId,
        apiUrl,
      });
    }
    return;
  }
  try {
    chrome.runtime.sendMessage(
      {
        type: "CONNECT_PLATFORM",
        platform: platformId,
        apiUrl,
        authToken,
      },
      (resp) => {
        console.log("ðŸŸ£ Bridge: CONNECT_PLATFORM response", resp);
      }
    );
  } catch (err) {
    console.error("ðŸ”´ Bridge: Failed to trigger CONNECT_PLATFORM", err);
  }
}

// Respond to extension popup asking for API URL + auth token so it can connect the platform
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_LISTING_CONFIG") {
    try {
      const authToken = extractSupabaseToken();
      // Use page-provided API URL if set; fallback to default
      const apiUrl =
        window.__PO_API_URL ||
        window.__LISTING_API_URL ||
        "https://profitorbit-api.fly.dev";

      sendResponse({ apiUrl, authToken });
    } catch (err) {
      sendResponse({ apiUrl: "https://profitorbit-api.fly.dev", authToken: null, error: err?.message });
    }
    return true;
  }
});

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
      
      // Dispatch connection ready event for Mercari (so React app knows immediately)
      if (marketplace === 'mercari' && data.loggedIn) {
        window.postMessage({
          type: 'MERCARI_CONNECTION_READY',
          payload: { userName: data.userName || data.name || 'Mercari User' }
        }, '*');
        console.log('🔵 Bridge: Dispatched MERCARI_CONNECTION_READY event');
        // Also upsert platform_accounts via API so backend sees Mercari connected
        ensurePlatformConnected('mercari');
      }
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

// Track if extension context is invalidated
let extensionContextInvalidated = false;

// Function to check if extension context is still valid
function isExtensionContextValid() {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      return false;
    }
    // Try to access runtime ID - will throw if invalidated
    const id = chrome.runtime.id;
    return !!id;
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      extensionContextInvalidated = true;
      return false;
    }
    return false;
  }
}

// Function to query status from background
function queryStatus() {
  // Check if extension context is invalidated first (fast path)
  if (extensionContextInvalidated) {
    return;
  }
  
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    // isExtensionContextValid() sets extensionContextInvalidated flag if needed
    // Only log warning once
    if (!extensionContextInvalidated) {
      console.warn('⚠️ Bridge: Extension context not available');
      extensionContextInvalidated = true;
      stopAllPolling();
    }
    return;
  }
  
  console.log('🔵 Bridge: queryStatus() called');
  
  console.log('🔵 Bridge: Sending GET_ALL_STATUS message to background...');
  
  try {
    chrome.runtime.sendMessage({ type: 'GET_ALL_STATUS' }, (response) => {
      // Check for extension context invalidation
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        if (errorMsg && errorMsg.includes('Extension context invalidated')) {
          extensionContextInvalidated = true;
          console.error('🔴 Bridge: Extension context invalidated - extension was reloaded');
          console.error('🔴 Bridge: Please reload this page to reconnect to the extension');
          // Stop all polling immediately
          stopAllPolling();
          // Dispatch event so React app knows extension was reloaded
          window.dispatchEvent(new CustomEvent('profitOrbitExtensionInvalidated'));
          return;
        }
        console.error('🔴 Bridge: Error from background:', errorMsg);
        return;
      }
      
      // Reset invalidated flag if we got a successful response
      if (extensionContextInvalidated) {
        console.log('🟢 Bridge: Extension context restored');
        extensionContextInvalidated = false;
      }
      
      console.log('🔵 Bridge: Received response from background:', response);
      
      if (response?.status) {
        updateLocalStorage(response.status);
      } else {
        console.warn('⚠️ Bridge: Response has no status field:', response);
      }
    });
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      extensionContextInvalidated = true;
      console.error('🔴 Bridge: Extension context invalidated - extension was reloaded');
      console.error('🔴 Bridge: Please reload this page to reconnect to the extension');
      // Stop all polling immediately
      stopAllPolling();
      window.dispatchEvent(new CustomEvent('profitOrbitExtensionInvalidated'));
    } else {
      console.error('🔴 Bridge: Exception sending message:', error);
    }
  }
}

// Listen for background messages
if (typeof chrome !== 'undefined' && chrome.runtime) {
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Check if extension context is still valid
      if (extensionContextInvalidated) {
        console.warn('⚠️ Bridge: Ignoring message - extension context invalidated');
        return false;
      }
      
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
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      extensionContextInvalidated = true;
      console.error('🔴 Bridge: Extension context invalidated while registering message listener');
      // Stop all polling immediately
      stopAllPolling();
      window.dispatchEvent(new CustomEvent('profitOrbitExtensionInvalidated'));
    } else {
      console.error('🔴 Bridge: Error registering message listener:', error);
    }
  }
} else {
  console.error('🔴 Bridge: Cannot register message listener - chrome.runtime not available');
}

// Poll localStorage for status requests from React app
let statusRequestInterval = null;
let pollingInterval = null;

function stopAllPolling() {
  console.warn('⚠️ Bridge: Stopping all polling - extension context invalidated');
  if (statusRequestInterval) {
    clearInterval(statusRequestInterval);
    statusRequestInterval = null;
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function startStatusRequestPolling() {
  // Clear existing interval if any
  if (statusRequestInterval) {
    clearInterval(statusRequestInterval);
  }
  
  statusRequestInterval = setInterval(() => {
    // Stop polling if extension context is invalidated
    if (extensionContextInvalidated) {
      stopAllPolling();
      return;
    }
    
    // Check context validity before processing requests
    if (!isExtensionContextValid()) {
      extensionContextInvalidated = true;
      stopAllPolling();
      return;
    }
    
    const requestFlag = localStorage.getItem('profit_orbit_request_status');
    if (requestFlag === 'true') {
      console.log('🔵🔵🔵 Bridge: React app requested status via localStorage flag 🔵🔵🔵');
      localStorage.removeItem('profit_orbit_request_status');
      queryStatus();
    }
  }, 500);
}

// Start polling
startStatusRequestPolling();

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

  // Poll every 2 seconds (only if extension context is valid)
  function startPolling() {
    // Temporarily disabled for debugging; leave single initial query intact
    // if (pollingInterval) {
    //   clearInterval(pollingInterval);
    // }
    //
    // pollingInterval = setInterval(() => {
    //   // Stop polling if extension context is invalidated (check before calling queryStatus)
    //   if (extensionContextInvalidated) {
    //     stopAllPolling();
    //     return;
    //   }
    //   // Only call queryStatus if context is still valid
    //   if (isExtensionContextValid()) {
    //     queryStatus();
    //   } else {
    //     // Context became invalid, stop polling
    //     extensionContextInvalidated = true;
    //     stopAllPolling();
    //   }
    // }, 2000);
  }
  
  // startPolling(); // disabled for debugging
  
  console.log('🔵 Bridge: Polling initialized (interval disabled for debug)');
}

// Start initialization
initializePolling();

// Listen for manual checks
window.addEventListener('checkMercariStatus', () => {
  console.log('🔵 Bridge: Manual check requested via event');
  queryStatus();
});

// NOTE: Bridge flag injection removed - CSP blocks inline scripts
// Flag is now set in profit-orbit-page-api.js which loads via src=chrome-extension://
// This avoids CSP violations on sites like Mercari

// Inject page API script into page context
function injectPageAPI() {
  // Check if already injected
  if (window.ProfitOrbitExtension) {
    console.log('🔵 Bridge: Page API already exists, skipping injection');
    dispatchBridgeReady();
    return;
  }

  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('🔴 Bridge: Cannot inject page API - chrome.runtime not available');
    return;
  }

  try {
    const scriptUrl = chrome.runtime.getURL('profit-orbit-page-api.js');
    console.log('🔵 Bridge: Injecting page API script:', scriptUrl);

    const script = document.createElement('script');
    script.src = scriptUrl;
    
    script.onload = function() {
      console.log('🔵 Bridge: Page API script loaded successfully');
      console.log('🔵 Bridge: window.ProfitOrbitExtension exists:', typeof window.ProfitOrbitExtension !== 'undefined');
      dispatchBridgeReady();
    };
    
    script.onerror = function(error) {
      console.error('🔴 Bridge: Failed to load page API script:', error);
      console.error('🔴 Bridge: Check Network tab for profit-orbit-page-api.js');
    };
    
    // Inject into page context
    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(script);
      console.log('🔵 Bridge: Page API script tag appended to', target.tagName);
    } else {
      console.error('🔴 Bridge: No injection target available');
      // Try again when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectPageAPI);
      } else {
        setTimeout(injectPageAPI, 100);
      }
    }
  } catch (error) {
    console.error('🔴 Bridge: Exception injecting page API:', error);
  }
}

// Dispatch bridge ready event
function dispatchBridgeReady() {
  console.log('🔵 Bridge: Dispatching profitOrbitBridgeReady event');
  window.dispatchEvent(new CustomEvent('profitOrbitBridgeReady'));
}

// Inject page API script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectPageAPI);
} else {
  // DOM already loaded, inject immediately
  injectPageAPI();
}

console.log('🔵🔵🔵 PROFIT ORBIT BRIDGE SCRIPT INITIALIZED 🔵🔵🔵');
