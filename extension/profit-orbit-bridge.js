/**
 * Content Script for Profit Orbit Domain
 * SIMPLIFIED - Direct communication with background
 */

// BUILD stamp (high-signal): use this to confirm Chrome is running the file you think it is.
const PO_BRIDGE_BUILD = '2025-12-29-bridge-build-1';

// IMMEDIATE LOG - Should appear FIRST
// Using try-catch to prevent any parse errors from silently failing
try {
  console.log('🔵🔵🔵 PROFIT ORBIT BRIDGE SCRIPT STARTING 🔵🔵🔵');
  console.log('🔵 BRIDGE BUILD:', PO_BRIDGE_BUILD);
  console.log('🔵 Bridge: Script file loaded at:', new Date().toISOString());
  console.log('🔵 Bridge: URL:', window.location.href);
  console.log('🔵 Bridge: Document ready state:', document.readyState);
  console.log('🔵 Bridge: Content script context - window exists:', typeof window !== 'undefined');
  console.log('🔵 Bridge: Content script context - document exists:', typeof document !== 'undefined');
  console.log('🔵 Bridge: Content script context - chrome exists:', typeof chrome !== 'undefined');

  // Persist a few breadcrumbs into page localStorage for quick verification.
  // (Content scripts can access localStorage for the page origin.)
  try {
    localStorage.setItem('profit_orbit_bridge_build', PO_BRIDGE_BUILD);
    localStorage.setItem('profit_orbit_bridge_loaded_at', String(Date.now()));
    if (typeof chrome !== 'undefined' && chrome?.runtime?.id) {
      localStorage.setItem('profit_orbit_bridge_extension_id', String(chrome.runtime.id));
    }
  } catch (_) {}
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

// Helper to safely post a response back to the MAIN world
function poPostResponse(type, resp) {
  try {
    window.postMessage({ type, resp }, "*");
  } catch (_) {}
}

function poHandleExtensionInvalidated(err, responseType) {
  try {
    console.error('🔴 Bridge: Extension context invalidated (caught)', err);
  } catch (_) {}

  try {
    // Mark + notify so the app can prompt a refresh
    localStorage.setItem('profit_orbit_extension_invalidated', 'true');
  } catch (_) {}

  try {
    window.dispatchEvent(new CustomEvent('profitOrbitExtensionInvalidated'));
  } catch (_) {}

  // Stop any periodic polling loops
  try {
    stopAllPolling();
  } catch (_) {}

  poPostResponse(responseType, {
    success: false,
    error: 'Extension context invalidated. If you just reloaded/updated the extension, refresh this tab and try again.',
  });
}

function poTrySendMessage(message, responseType) {
  try {
    chrome.runtime.sendMessage(message, (resp) => poPostResponse(responseType, resp));
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (msg.toLowerCase().includes('extension context invalidated')) {
      poHandleExtensionInvalidated(err, responseType);
      return;
    }
    poPostResponse(responseType, { success: false, error: msg || 'Unknown error sending message to extension.' });
  }
}

// Listen for page context requests (page -> bridge -> background)
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg?.type) return;

  if (msg.type === "PO_CREATE_MERCARI_LISTING") {
    poTrySendMessage({ type: "CREATE_MERCARI_LISTING", listingData: msg.payload }, "PO_CREATE_MERCARI_LISTING_RESULT");
    return;
  }
  if (msg.type === "PO_DELIST_MERCARI_LISTING") {
    poTrySendMessage(
      { type: "DELIST_MERCARI_LISTING", listingId: msg?.payload?.listingId ?? msg?.payload?.itemId ?? null },
      "PO_DELIST_MERCARI_LISTING_RESULT"
    );
    return;
  }
  if (msg.type === "PO_CHECK_MERCARI_LISTING_STATUS") {
    poTrySendMessage(
      {
        type: "CHECK_MERCARI_LISTING_STATUS",
        listingUrl: msg?.payload?.listingUrl ?? msg?.payload?.url ?? null,
        listingId: msg?.payload?.listingId ?? msg?.payload?.itemId ?? null,
      },
      "PO_CHECK_MERCARI_LISTING_STATUS_RESULT"
    );
    return;
  }
  if (msg.type === "PO_CREATE_FACEBOOK_LISTING") {
    poTrySendMessage({ type: "CREATE_FACEBOOK_LISTING", listingData: msg.payload }, "PO_CREATE_FACEBOOK_LISTING_RESULT");
    return;
  }

  // Mercari API recorder controls (for API-mode reverse engineering)
  if (msg.type === "PO_START_MERCARI_API_RECORDING") {
    poTrySendMessage({ type: "START_MERCARI_API_RECORDING" }, "PO_START_MERCARI_API_RECORDING_RESULT");
    return;
  }
  if (msg.type === "PO_STOP_MERCARI_API_RECORDING") {
    poTrySendMessage({ type: "STOP_MERCARI_API_RECORDING" }, "PO_STOP_MERCARI_API_RECORDING_RESULT");
    return;
  }
  if (msg.type === "PO_GET_MERCARI_API_RECORDING") {
    poTrySendMessage({ type: "GET_MERCARI_API_RECORDING" }, "PO_GET_MERCARI_API_RECORDING_RESULT");
    return;
  }
  if (msg.type === "PO_CLEAR_MERCARI_API_RECORDING") {
    poTrySendMessage({ type: "CLEAR_MERCARI_API_RECORDING" }, "PO_CLEAR_MERCARI_API_RECORDING_RESULT");
    return;
  }

  // Facebook API recorder controls (for API-mode reverse engineering)
  if (msg.type === "PO_START_FACEBOOK_API_RECORDING") {
    poTrySendMessage({ type: "START_FACEBOOK_API_RECORDING" }, "PO_START_FACEBOOK_API_RECORDING_RESULT");
    return;
  }
  if (msg.type === "PO_STOP_FACEBOOK_API_RECORDING") {
    poTrySendMessage({ type: "STOP_FACEBOOK_API_RECORDING" }, "PO_STOP_FACEBOOK_API_RECORDING_RESULT");
    return;
  }
  if (msg.type === "PO_GET_FACEBOOK_API_RECORDING") {
    poTrySendMessage({ type: "GET_FACEBOOK_API_RECORDING" }, "PO_GET_FACEBOOK_API_RECORDING_RESULT");
    return;
  }
  if (msg.type === "PO_CLEAR_FACEBOOK_API_RECORDING") {
    poTrySendMessage({ type: "CLEAR_FACEBOOK_API_RECORDING" }, "PO_CLEAR_FACEBOOK_API_RECORDING_RESULT");
    return;
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
    window.location.origin;
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
    // Common on domains where the user isn't logged in (or Supabase token isn't stored).
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
        console.log("🟣 Bridge: CONNECT_PLATFORM response", resp);
        if (platformId === "mercari") {
          if (resp?.success) {
            localStorage.setItem("profit_orbit_mercari_server_connected", "true");
            localStorage.removeItem("profit_orbit_mercari_connect_error");
          } else {
            localStorage.removeItem("profit_orbit_mercari_server_connected");
            if (resp?.error) {
              localStorage.setItem("profit_orbit_mercari_connect_error", String(resp.error));
            }
          }
        }
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
        window.location.origin;

      sendResponse({ apiUrl, authToken });
    } catch (err) {
      sendResponse({ apiUrl: window.location.origin, authToken: null, error: err?.message });
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
      
      // For Mercari, dispatch an immediate message (existing consumer expects this type).
      // IMPORTANT: we do NOT auto-connect to the backend here anymore.
      if (marketplace === 'mercari' && data.loggedIn) {
        window.postMessage({
          type: 'MERCARI_CONNECTION_READY',
          payload: { userName: data.userName || data.name || 'Mercari User' }
        }, '*');
        console.log('🔵 Bridge: Dispatched MERCARI_CONNECTION_READY event');
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
    // Reduce console spam: only log MARKETPLACE_STATUS_UPDATE when it actually changes.
    const __poLastStatusLog = new Map(); // key: marketplace, val: stringified minimal status

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Check if extension context is still valid
      if (extensionContextInvalidated) {
        console.warn('⚠️ Bridge: Ignoring message - extension context invalidated');
        return false;
      }
      
      if (message.type !== 'MARKETPLACE_STATUS_UPDATE') {
        console.log('🔵 Bridge: Received message from background:', message.type);
      }
      
      if (message.type === 'MARKETPLACE_STATUS_UPDATE') {
        const { marketplace, data } = message;

        try {
          const minimal = JSON.stringify({ loggedIn: !!data?.loggedIn, userName: data?.userName || null });
          const prev = __poLastStatusLog.get(marketplace);
          if (prev !== minimal) {
            __poLastStatusLog.set(marketplace, minimal);
            console.log('🔵 Bridge: Received MARKETPLACE_STATUS_UPDATE', marketplace, minimal);
          }
        } catch (_) {
          // ignore
        }
        
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

// Allow the web app to request an explicit server-side connect (CONNECT_PLATFORM).
// This avoids auto-connecting on every status update while still supporting a "Connect" button in the UI.
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const type = event.data?.type;
  if (type !== 'REQUEST_CONNECT_PLATFORM') return;

  const platform = event.data?.payload?.platform || event.data?.platform;
  if (!platform) return;
  ensurePlatformConnected(platform);
});

// NOTE: Bridge flag injection removed - CSP blocks inline scripts
// Flag is now set in profit-orbit-page-api.js which loads via src=chrome-extension://
// This avoids CSP violations on sites like Mercari

// Dispatch bridge ready event
function dispatchBridgeReady() {
  console.log('🔵 Bridge: Dispatching profitOrbitBridgeReady event');
  window.dispatchEvent(new CustomEvent('profitOrbitBridgeReady'));
}

// NOTE:
// `profit-orbit-page-api.js` is injected via `extension/manifest.json` as a MAIN-world content_script.
// Avoid re-injecting from this bridge (isolated world) which can cause repeated "Page API: Loading..." spam.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', dispatchBridgeReady);
} else {
  dispatchBridgeReady();
}

console.log('🔵🔵🔵 PROFIT ORBIT BRIDGE SCRIPT INITIALIZED 🔵🔵🔵');