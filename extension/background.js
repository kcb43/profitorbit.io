/**
 * Background Service Worker
 * Manages state for all marketplace connections
 */

console.log('Profit Orbit Extension: Background script loaded');
console.log('EXT BUILD:', '2025-12-27-connect-debug-2');

function isProfitOrbitAppUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.hostname === 'profitorbit.io') return true;
    if (u.hostname.endsWith('.vercel.app')) return true;
    if (u.hostname === 'localhost' && (u.port === '5173' || u.port === '5174')) return true;
    return false;
  } catch (_) {
    return false;
  }
}

// Track Mercari automation tabs to keep them hidden
const mercariAutomationTabs = new Set();

// Listen for tab activation and immediately hide Mercari automation tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (mercariAutomationTabs.has(activeInfo.tabId)) {
    console.log('🛡️ [TAB PROTECTION] Mercari automation tab activated, hiding immediately...');
    try {
      await chrome.tabs.update(activeInfo.tabId, { active: false });
      // Also move to end
      await chrome.tabs.move(activeInfo.tabId, { index: -1 }).catch(() => {});
    } catch (error) {
      console.warn('⚠️ [TAB PROTECTION] Could not hide tab:', error);
    }
  }
});

// Also listen for window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  
  // Check all Mercari automation tabs in this window
  try {
    const tabs = await chrome.tabs.query({ windowId: windowId });
    for (const tab of tabs) {
      if (mercariAutomationTabs.has(tab.id) && tab.active) {
        console.log('🛡️ [TAB PROTECTION] Mercari automation tab active in focused window, hiding...');
        await chrome.tabs.update(tab.id, { active: false });
        await chrome.tabs.move(tab.id, { index: -1 }).catch(() => {});
      }
    }
  } catch (error) {
    // Ignore errors
  }
});

// Clean up stored worker window ID when window is closed
chrome.windows.onRemoved.addListener(async (windowId) => {
  // Check if this was our stored worker window
  try {
    const stored = await chrome.storage.session.get(['mercariWorkerWindowId']);
    if (stored.mercariWorkerWindowId === windowId) {
      await chrome.storage.session.remove(['mercariWorkerWindowId']);
      console.log('🧹 [MERCARI] Worker window closed, removed from storage');
      
      // Also clean up any tracked tabs from this window
      try {
        const tabs = await chrome.tabs.query({ windowId: windowId });
        for (const tab of tabs) {
          mercariAutomationTabs.delete(tab.id);
        }
      } catch (e) {
        // Ignore errors
      }
    }
  } catch (e) {
    // Ignore errors
  }
});

// Also clean up when tabs are removed (backup)
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (mercariAutomationTabs.has(tabId)) {
    mercariAutomationTabs.delete(tabId);
  }
});

// Inject bridge script into Profit Orbit pages when they load
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (isProfitOrbitAppUrl(tab.url)) {
      console.log(`🔵 Background: Profit Orbit page loaded: ${tab.url}`);
      // Inject bridge script dynamically
      await ensureBridgeScriptInjected(tabId);
    }
  }
});

// Store login status for all marketplaces
let marketplaceStatus = {
  mercari: { loggedIn: false, userName: null, lastChecked: null },
  facebook: { loggedIn: false, userName: null, lastChecked: null },
  poshmark: { loggedIn: false, userName: null, lastChecked: null },
  ebay: { loggedIn: false, userName: null, lastChecked: null },
  etsy: { loggedIn: false, userName: null, lastChecked: null }
};

// Required headers to capture from Mercari API requests
const requiredHeaders = [
  'accept', 'accept-language', 'apollo-require-preflight', 'authorization', 
  'baggage', 'content-type', 'priority', 'sec-ch-ua', 'sec-ch-ua-mobile', 
  'sec-ch-ua-platform', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 
  'sentry-trace', 'x-app-version', 'x-csrf-token', 'x-de-device-token', 
  'x-double-web', 'x-ld-variants', 'x-platform', 'x-socure-device'
];

// Intercept Mercari API requests to capture headers
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    // Only intercept requests to Mercari's GraphQL API
    if (details.url.includes('mercari.com/v1/api')) {
      // Extract headers we need
      const capturedHeaders = {};
      
      if (details.requestHeaders) {
        for (const header of details.requestHeaders) {
          const headerName = header.name.toLowerCase();
          if (requiredHeaders.includes(headerName)) {
            capturedHeaders[headerName] = header.value;
          }
        }
      }
      
      // Store captured headers in chrome.storage for content script to access
      if (Object.keys(capturedHeaders).length > 0) {
        chrome.storage.local.set({ 
          mercariApiHeaders: capturedHeaders,
          mercariApiHeadersTimestamp: Date.now()
        }, () => {
          console.log('📡 [WEB REQUEST] Captured Mercari API headers:', Object.keys(capturedHeaders));
        });
        
        // Also send to content script if it's listening
        chrome.tabs.query({ url: 'https://www.mercari.com/*' }, (tabs) => {
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'MERCARI_HEADERS_CAPTURED',
              headers: capturedHeaders
            }).catch(() => {
              // Content script not ready, that's okay
            });
          }
        });
      }
    }
  },
  {
    urls: ['https://www.mercari.com/v1/api*'],
    types: ['xmlhttprequest']
  },
  ['requestHeaders']
);

console.log('📡 [WEB REQUEST] Network request interceptor installed for Mercari API');

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("🟣 Background: onMessage", {
    type: message?.type,
    message,
    sender: { id: sender?.id, url: sender?.url, origin: sender?.origin },
  });

  // Handle login status updates from any marketplace
  if (message.type?.endsWith('_LOGIN_STATUS')) {
    const marketplace = message.marketplace;
    
    if (marketplace && marketplaceStatus[marketplace] !== undefined) {
      // Update status
      marketplaceStatus[marketplace] = {
        ...message.data,
        lastChecked: Date.now()
      };
      
      // Persist to storage
      chrome.storage.local.set({ 
        marketplaceStatus,
        profit_orbit_marketplace_status: marketplaceStatus // Also save with React-friendly key
      }, () => {
        console.log(`${marketplace} status saved:`, marketplaceStatus[marketplace]);
      });
      
      // Notify Profit Orbit web app
      notifyProfitOrbit({
        type: 'MARKETPLACE_STATUS_UPDATE',
        marketplace: marketplace,
        data: marketplaceStatus[marketplace]
      });
      
      sendResponse({ success: true, marketplace });
    }
    return true;
  }
  
  if (message.type === 'GET_ALL_STATUS') {
    console.log('🔵 Background: GET_ALL_STATUS requested, returning:', marketplaceStatus);
    sendResponse({ status: marketplaceStatus });
    
    // Also update chrome.storage.local so React app can access it
    chrome.storage.local.set({ 
      profit_orbit_marketplace_status: marketplaceStatus 
    }, () => {
      console.log('🔵 Background: Marketplace status saved to chrome.storage.local');
    });
    
    return true;
  }
  
  if (message.type === 'GET_MARKETPLACE_STATUS') {
    const marketplace = message.marketplace;
    sendResponse({ 
      status: marketplaceStatus[marketplace] || { loggedIn: false }
    });
    return true;
  }

  // Handle Facebook listing request from bridge script
  if (message.type === 'CREATE_FACEBOOK_LISTING') {
    (async () => {
      try {
        const listingData = message.listingData;
        
        // Helper function to check if content script is ready
        const isContentScriptReady = async (tabId) => {
          for (let i = 0; i < 5; i++) {
            try {
              const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
              if (response && response.status === 'ready') {
                return true;
              }
            } catch (error) {
              if (i === 4 || 
                  !error.message?.includes('Receiving end does not exist') &&
                  !error.message?.includes('Could not establish connection')) {
                return false;
              }
            }
            
            if (i < 4) {
              await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
            }
          }
          return false;
        };
        
        // Helper function to send message with retry
        const sendMessageWithRetry = async (tabId, message, maxRetries = 3) => {
          for (let i = 0; i < maxRetries; i++) {
            try {
              const response = await chrome.tabs.sendMessage(tabId, message);
              return { success: true, response };
            } catch (error) {
              const isLastRetry = i === maxRetries - 1;
              const isConnectionError = error.message?.includes('Receiving end does not exist') ||
                                       error.message?.includes('Could not establish connection');
              
              if (isLastRetry || !isConnectionError) {
                return { success: false, error: error.message };
              }
              
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
        };
        
        // Find Facebook tab or create new one (work silently like Vendoo)
        const tabs = await chrome.tabs.query({ url: 'https://www.facebook.com/*' });
        
        let targetTab = null;
        
        if (tabs.length > 0) {
          // Try to use existing Facebook tab
          const facebookTab = tabs[0];
          
          // Check if tab is in a valid state
          const tabInfo = await chrome.tabs.get(facebookTab.id);
          if (tabInfo.status === 'complete' && tabInfo.url?.startsWith('https://www.facebook.com')) {
            // Check if content script is ready
            const isReady = await isContentScriptReady(facebookTab.id);
            if (isReady) {
              targetTab = facebookTab;
            }
          }
        }
        
        // If no valid tab found, create a new one (hidden in background like Vendoo)
        if (!targetTab) {
          targetTab = await chrome.tabs.create({
            url: 'https://www.facebook.com/marketplace/create/',
            active: false
          });
          
          // Wait for page to load (silently, like Vendoo)
          await new Promise((resolve) => {
            const listener = (tabId, info) => {
              if (tabId === targetTab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
          
          // Reduced wait time - content script should be ready faster
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Send listing data with retry logic (silently, like Vendoo)
        const result = await sendMessageWithRetry(targetTab.id, {
          type: 'CREATE_LISTING',
          listingData: listingData
        });
        
        if (result.success) {
          sendResponse(result.response || { success: false, error: 'No response from Facebook content script' });
        } else {
          sendResponse({ 
            success: false, 
            error: 'Failed to communicate with Facebook tab. Please ensure you have a Facebook tab open and try again. Error: ' + result.error 
          });
        }
      } catch (error) {
        console.error('❌ Error in Facebook listing flow:', error);
        sendResponse({ success: false, error: error?.message || String(error) });
      }
    })();
    
    return true; // Keep channel open for async response
  }

  // Handle Mercari listing request from bridge script
  if (message.type === 'CREATE_MERCARI_LISTING') {
    const listingData = message.listingData;
    
    // Handle async response - Manifest V3 pattern
    (async () => {
      // Declare variables outside try block so they're accessible in catch
      let workerWindowId = null;
      let backgroundTab = null;
      
      try {
        // Helper function to check if content script is ready
        const isContentScriptReady = async (tabId, maxRetries = 5) => {
          for (let i = 0; i < maxRetries; i++) {
            try {
              // Try to ping the content script
              const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
              // Check if we got a valid response
              if (response && response.pong) {
                return true;
              }
            } catch (error) {
              // If it's not a connection error, don't retry
              if (!error.message?.includes('Receiving end does not exist') && 
                  !error.message?.includes('Could not establish connection')) {
                return false;
              }
            }
            
            if (i < maxRetries - 1) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
            }
          }
          return false;
        };
        
        // Helper function to send message with retry
        const sendMessageWithRetry = async (tabId, message, maxRetries = 3) => {
          for (let i = 0; i < maxRetries; i++) {
            try {
              const response = await chrome.tabs.sendMessage(tabId, message);
              return { success: true, response };
            } catch (error) {
              const isLastRetry = i === maxRetries - 1;
              const isConnectionError = error.message?.includes('Receiving end does not exist') ||
                                       error.message?.includes('Could not establish connection');
              
              if (isLastRetry || !isConnectionError) {
                return { success: false, error: error.message };
              }
              
              // Wait before retrying (silently)
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
        };
        
        // MV3-FRIENDLY APPROACH: Minimized popup window (effectively invisible)
        // User gesture ✅ (from website -> extension message)
        // Create popup window positioned off-screen - won't steal focus and is invisible
        
        // Try to get existing worker window ID from storage
        try {
          const stored = await chrome.storage.session.get(['mercariWorkerWindowId']);
          workerWindowId = stored.mercariWorkerWindowId;
        } catch (e) {
          console.log('📦 [MERCARI] No stored worker window ID');
        }
        
        // Check if stored window ID is still valid
        if (workerWindowId) {
          try {
            const window = await chrome.windows.get(workerWindowId, { populate: true });
            if (window && window.tabs && window.tabs.length > 0) {
              const tab = window.tabs[0];
              if (tab && tab.url && tab.url.includes('mercari.com')) {
                // Window exists and has Mercari tab - reuse it
                console.log('♻️ [MERCARI] Reusing existing worker window:', workerWindowId);
                backgroundTab = tab;
                
                // Update URL if needed (navigate to sell page)
                if (!tab.url.includes('/sell')) {
                  await chrome.tabs.update(tab.id, {
                    url: 'https://www.mercari.com/sell/'
                  });
                }
                
                // Ensure window stays off-screen and unfocused
                try {
                  await chrome.windows.update(workerWindowId, {
                    focused: false,
                    state: 'minimized'
                  });
                } catch (e) {
                  // Popup windows might not support state, just ensure unfocused
                  await chrome.windows.update(workerWindowId, {
                    focused: false
                  });
                }
              } else {
                // Window exists but wrong URL - update it
                console.log('🔄 [MERCARI] Worker window exists but wrong URL, updating...');
                await chrome.tabs.update(window.tabs[0].id, {
                  url: 'https://www.mercari.com/sell/'
                });
                backgroundTab = window.tabs[0];
                try {
                  await chrome.windows.update(workerWindowId, {
                    focused: false,
                    state: 'minimized'
                  });
                } catch (e) {
                  // Popup windows might not support state, just ensure unfocused
                  await chrome.windows.update(workerWindowId, {
                    focused: false
                  });
                }
              }
            }
          } catch (e) {
            // Window doesn't exist anymore - create new one
            console.log('⚠️ [MERCARI] Stored worker window no longer exists, creating new one...');
            workerWindowId = null;
          }
        }
        
        // Create new popup window if we don't have a valid one
        if (!backgroundTab) {
          console.log('🔧 [MERCARI] Creating minimized popup window...');
          const popupWindow = await chrome.windows.create({
            url: 'https://www.mercari.com/sell/',
            type: 'popup',
            focused: false, // Won't steal focus
            width: 1,
            height: 1,
            left: -10000, // Position off-screen
            top: -10000
            // Note: Popup windows don't support 'state' property
            // They are effectively invisible due to size and position
          });
          
          // Try to minimize the window after creation (if supported)
          try {
            await chrome.windows.update(popupWindow.id, { state: 'minimized' });
          } catch (e) {
            // Popup windows might not support minimization, that's okay
            console.log('ℹ️ [MERCARI] Could not minimize popup window (expected for popup type)');
          }
          
          workerWindowId = popupWindow.id;
          backgroundTab = popupWindow.tabs?.[0] || (await chrome.tabs.query({ windowId: workerWindowId }))[0];
          
          // Save worker window ID for future reuse
          try {
            await chrome.storage.session.set({ mercariWorkerWindowId: workerWindowId });
            console.log('💾 [MERCARI] Saved worker window ID:', workerWindowId);
          } catch (e) {
            console.warn('⚠️ [MERCARI] Failed to save worker window ID:', e);
          }
        }
        
        console.log('✅ [MERCARI] Worker window ready, tab ID:', backgroundTab.id);
        
        // Track this tab to keep it hidden (backup protection)
        mercariAutomationTabs.add(backgroundTab.id);
        
        // Wait for page to load
        await new Promise((resolve) => {
          const listener = (tabId, info) => {
            if (tabId === backgroundTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          
          // Timeout after 15 seconds
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 15000);
        });
        
        // Content script loads automatically via manifest.json
        // Wait for it to be ready
        console.log('⏳ [MERCARI] Waiting for content script to be ready...');
        let contentScriptReady = false;
        for (let i = 0; i < 8; i++) {
          try {
            const pingResponse = await chrome.tabs.sendMessage(backgroundTab.id, { type: 'PING' });
            if (pingResponse && pingResponse.pong) {
              contentScriptReady = true;
              console.log('✅ [MERCARI] Content script ready!');
              break;
            }
          } catch (e) {
            // Content script not ready yet, wait and retry
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        if (!contentScriptReady) {
          console.warn('⚠️ [MERCARI] Content script not ready, proceeding anyway...');
        }
        
        // Wait for React/DOM to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Send listing data to content script (it fills form, uploads images, submits)
        console.log('📤 [MERCARI] Sending listing data to content script...');
        const result = await sendMessageWithRetry(backgroundTab.id, {
          type: 'CREATE_LISTING',
          listingData: listingData
        });
        
        // Don't close the worker window - keep it for reuse
        // This prevents "new window" notifications on subsequent runs
        console.log('💾 [MERCARI] Keeping worker window for reuse:', workerWindowId, 'tab:', backgroundTab.id);
        
        if (result.success) {
          sendResponse(result.response || { success: false, error: 'No response from content script' });
        } else {
          sendResponse({ 
            success: false, 
            error: result.error || 'Failed to communicate with Mercari tab' 
          });
        }
      } catch (error) {
        console.error('❌ Error in Mercari listing flow:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', {
          message: error.message,
          name: error.name,
          workerWindowId: workerWindowId || 'none',
          backgroundTabId: backgroundTab?.id || 'none'
        });
        
        // Ensure we send a response even on error
        try {
          sendResponse({ 
            success: false, 
            error: error.message || 'Unknown error occurred during Mercari listing',
            details: error.stack ? error.stack.split('\n')[0] : undefined
          });
        } catch (sendError) {
          // Response already sent or channel closed
          console.warn('⚠️ Could not send error response:', sendError);
        }
      }
    })();
    
    return true; // Keep channel open for async response
  }
});

// Inject bridge script into Profit Orbit tabs if not already loaded
async function ensureBridgeScriptInjected(tabId) {
  try {
    console.log(`🔵 Background: Attempting to inject bridge script into tab ${tabId}`);
    
    // DON'T inject bridge script dynamically - it's already loaded via manifest.json content_scripts
    // Only inject the page API script (which needs to be in MAIN world)
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['profit-orbit-page-api.js'],
      world: 'MAIN' // Inject into page context
    });
    console.log(`✅ Background: Page API script injected into tab ${tabId}`);
  } catch (error) {
    console.log(`⚠️ Background: Could not inject page API script into tab ${tabId}:`, error.message);
    console.log(`⚠️ Background: Error details:`, error);
  }
}

// Notify Profit Orbit web app
async function notifyProfitOrbit(message) {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        'https://profitorbit.io/*',
        'https://*.vercel.app/*',
        'http://localhost:5173/*',
        'http://localhost:5174/*'
      ]
    });
    
    console.log(`Notifying ${tabs.length} Profit Orbit tab(s) with message:`, message);
    
    for (const tab of tabs) {
      try {
        // Ensure bridge script is injected first
        await ensureBridgeScriptInjected(tab.id);
        
        // Wait a bit for script to load
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await chrome.tabs.sendMessage(tab.id, message);
        console.log(`Message sent to tab ${tab.id}`);
      } catch (error) {
        // Tab might not be ready or bridge script not loaded
        console.log(`Could not send message to tab ${tab.id}:`, error.message);
        // Try injecting bridge script
        await ensureBridgeScriptInjected(tab.id);
      }
    }
  } catch (error) {
    console.error('Error notifying Profit Orbit:', error);
  }
}

// Listen for external messages from Profit Orbit web app
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('External message:', message, 'from:', sender.url);
  
  if (message.type === 'CHECK_EXTENSION_INSTALLED') {
    sendResponse({ 
      installed: true, 
      version: chrome.runtime.getManifest().version,
      name: 'Profit Orbit Crosslisting Assistant'
    });
    return true;
  }
  
  if (message.type === 'GET_ALL_MARKETPLACE_STATUS') {
    sendResponse({ status: marketplaceStatus });
    return true;
  }
  
  if (message.type === 'GET_MARKETPLACE_STATUS') {
    const marketplace = message.marketplace;
    sendResponse({ 
      status: marketplaceStatus[marketplace] || { loggedIn: false }
    });
    return true;
  }
  
  if (message.type === 'CREATE_LISTING') {
    const marketplace = message.marketplace;
    const listingData = message.listingData;
    
    // Find or open marketplace tab
    chrome.tabs.query({ url: getMarketplaceUrl(marketplace) }, (tabs) => {
      if (tabs.length > 0) {
        // Send to existing tab
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'CREATE_LISTING',
          listingData: listingData
        });
        sendResponse({ success: true, message: 'Listing creation started' });
      } else {
        // Open new tab for listing
        chrome.tabs.create({
          url: getSellPageUrl(marketplace),
          active: false
        }, (tab) => {
          // Wait for load, then send listing data
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {
                  type: 'CREATE_LISTING',
                  listingData: listingData
                });
              }, 1000);
            }
          });
        });
        sendResponse({ success: true, message: `Opening ${marketplace} to create listing` });
      }
    });
    return true;
  }
});

// Helper functions
function getMarketplaceUrl(marketplace) {
  const urls = {
    mercari: 'https://www.mercari.com/*',
    facebook: 'https://www.facebook.com/*',
    poshmark: 'https://www.poshmark.com/*',
    ebay: 'https://www.ebay.com/*',
    etsy: 'https://www.etsy.com/*'
  };
  return urls[marketplace] || 'https://www.mercari.com/*';
}

function getSellPageUrl(marketplace) {
  const urls = {
    mercari: 'https://www.mercari.com/sell/',
    facebook: 'https://www.facebook.com/marketplace/create',
    poshmark: 'https://poshmark.com/create-listing',
    ebay: 'https://www.ebay.com/sl/sell',
    etsy: 'https://www.etsy.com/your/shops/me/tools/listings/create'
  };
  return urls[marketplace] || '';
}

// Load saved status on startup
chrome.storage.local.get(['marketplaceStatus'], (result) => {
  if (result.marketplaceStatus) {
    marketplaceStatus = result.marketplaceStatus;
    console.log('Loaded saved marketplace status:', marketplaceStatus);
  }
});

// Periodically check active marketplace tabs
setInterval(async () => {
  for (const marketplace of ['mercari', 'facebook', 'poshmark', 'ebay', 'etsy']) {
    const tabs = await chrome.tabs.query({ url: getMarketplaceUrl(marketplace) });
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'CHECK_LOGIN' }).catch(() => {
        // Tab not ready
      });
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

// ============================================================================
// PLATFORM CONNECTION (Server-Side Listing Automation)
// ============================================================================

// API URL for listing automation (set by frontend or default)
let LISTING_API_URL = null;

// Cookie capture functions (inline version since we can't use ES6 imports in manifest v3)
// NOTE: Mercari relies on host-only cookies on https://www.mercari.com/, which may not be returned by
// chrome.cookies.getAll({ domain: 'mercari.com' }). Prefer URL-based queries and merge results.
async function exportCookies(domain, urls = []) {
  try {
    const buckets = [];

    // Domain-based bucket (catches domain cookies like .mercari.com)
    buckets.push(await chrome.cookies.getAll({ domain }));

    // URL-based buckets (catches host-only cookies like www.mercari.com, including __Host-* cookies)
    for (const url of urls) {
      try {
        buckets.push(await chrome.cookies.getAll({ url }));
      } catch (_) {
        // ignore
      }
    }

    const cookies = buckets.flat().filter(Boolean);
    const mapSameSite = (v) => {
      // chrome.cookies Cookie.sameSite: "no_restriction" | "lax" | "strict" | "unspecified"
      // Playwright expects: "Lax" | "Strict" | "None"
      if (!v) return undefined;
      const s = String(v).toLowerCase();
      if (s === 'lax') return 'Lax';
      if (s === 'strict') return 'Strict';
      if (s === 'no_restriction') return 'None';
      // unspecified -> omit (Playwright will default)
      return undefined;
    };

    const mapped = cookies.map((cookie) => {
      const expires =
        typeof cookie.expirationDate === 'number' ? cookie.expirationDate
        : typeof cookie.expires === 'number' ? cookie.expires
        : undefined;

      const sameSite = mapSameSite(cookie.sameSite);

      const isHostOnly = !!cookie.hostOnly || (typeof cookie.name === 'string' && cookie.name.startsWith('__Host-'));
      const cookiePath = cookie.path || '/';
      const cookieUrl = `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookiePath}`;

      // Send a Playwright-compatible cookie shape to the API/worker.
      // IMPORTANT: for host-only cookies (esp. __Host-*), Playwright must receive {url: ...}
      // so it does NOT set a Domain attribute (which would break __Host cookies).
      const out = {
        name: cookie.name,
        value: cookie.value,
        ...(isHostOnly ? { url: cookieUrl } : { domain: cookie.domain }),
        path: cookiePath,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
      };
      if (sameSite) out.sameSite = sameSite;
      if (typeof expires === 'number') out.expires = expires;
      return out;
    });

    // Dedupe so we don't send duplicates from domain+url buckets.
    // IMPORTANT: include `url` in the key because url-cookies and domain-cookies must coexist.
    const seen = new Set();
    const deduped = [];
    for (const c of mapped) {
      const key = `${c.name}::${c.url || ''}::${c.domain || ''}::${c.path || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(c);
    }
    return deduped;
  } catch (error) {
    console.error(`Error exporting cookies for ${domain}:`, error);
    throw error;
  }
}

async function getUserAgent() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => navigator.userAgent,
      });
      return results[0].result;
    }
    return navigator.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  } catch (error) {
    return navigator.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }
}

async function connectPlatform(platform, apiUrl, authToken) {
  try {
    const domainMap = {
      mercari: 'mercari.com',
      facebook: 'facebook.com',
    };

    const domain = domainMap[platform];
    if (!domain) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Export cookies
    const urls =
      platform === 'mercari'
        ? ['https://www.mercari.com/', 'https://www.mercari.com/sell/']
        : platform === 'facebook'
          ? ['https://www.facebook.com/']
          : [];
    const cookies = await exportCookies(domain, urls);
    const urlCookieCount = cookies.filter((c) => typeof c?.url === 'string' && c.url.startsWith('http')).length;
    console.log(`🍪 CONNECT_PLATFORM cookie export: platform=${platform} total=${cookies.length} urlCookies=${urlCookieCount}`);
    if (cookies.length === 0) {
      throw new Error(`No cookies found for ${domain}. Please log in to ${platform} first.`);
    }

    // Get user agent
    const userAgent = await getUserAgent();

    // Prepare payload
    const payload = {
      platform,
      cookies,
      userAgent,
      meta: {
        capturedAt: new Date().toISOString(),
        cookieCount: cookies.length,
      },
    };

    // Send to API
    const response = await fetch(`${apiUrl}/api/platform/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    // Always read raw text so we can show it in logs even if it's not JSON
    const text = await response.text().catch(() => '');
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      console.error('❌ CONNECT_PLATFORM failed', {
        platform,
        apiUrl,
        status: response.status,
        statusText: response.statusText,
        body: (text || '').slice(0, 800),
      });
      const msg =
        data?.error ||
        data?.message ||
        `API error: ${response.status}${text ? ` - ${text.slice(0, 300)}` : ''}`;
      const details = data?.details ? ` | details: ${data.details}` : '';
      const code = data?.code ? ` | code: ${data.code}` : '';
      throw new Error(`${msg}${details}${code}`);
    }

    // If API returned no JSON body, still treat as success
    return data || { success: true };
  } catch (error) {
    console.error(`Error connecting platform ${platform}:`, error);
    throw error;
  }
}

// Handle platform connection request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONNECT_PLATFORM') {
    (async () => {
      try {
        const { platform, apiUrl, authToken } = message;
        
        if (!apiUrl || !authToken) {
          throw new Error('API URL and auth token are required');
        }

        // Store API URL for future use
        LISTING_API_URL = apiUrl;

        const result = await connectPlatform(platform, apiUrl, authToken);
        sendResponse({ success: true, result });
      } catch (error) {
        console.error('Platform connection error:', error);
        sendResponse({ success: false, error: error?.message || String(error) });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (message.type === 'SET_LISTING_API_URL') {
    LISTING_API_URL = message.apiUrl;
    sendResponse({ success: true });
    return true;
  }
});

console.log('Profit Orbit Extension: Background initialized');
