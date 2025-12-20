/**
 * Background Service Worker
 * Manages state for all marketplace connections
 */

console.log('Profit Orbit Extension: Background script loaded');

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
  console.log('Background received message:', message, 'from sender:', sender);
  
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
      chrome.storage.local.set({ marketplaceStatus }, () => {
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
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep channel open for async response
  }

  // Handle Mercari listing request from bridge script
  if (message.type === 'CREATE_MERCARI_LISTING') {
    const listingData = message.listingData;
    
    // Handle async response - Manifest V3 pattern
    (async () => {
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
        
        // MV3-FRIENDLY APPROACH: Invisible background tab worker
        // User gesture ✅ (from website -> extension message)
        // Create background tab with active: false (invisible)
        console.log('🔧 [MERCARI] Creating invisible background tab...');
        
        // Create background tab (active: false = invisible, no user interruption)
        const backgroundTab = await chrome.tabs.create({
          url: 'https://www.mercari.com/sell/',
          active: false // CRITICAL: Tab is created but never becomes active/visible
        });
        
        console.log('✅ [MERCARI] Background tab created:', backgroundTab.id);
        
        // Ensure tab stays inactive (multiple safeguards)
        // Move tab to end of tab bar immediately
        try {
          await chrome.tabs.move(backgroundTab.id, { index: -1 });
        } catch (e) {
          // Ignore move errors
        }
        
        // Ensure tab stays inactive
        await chrome.tabs.update(backgroundTab.id, { active: false });
        
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
        
        // Close the background tab when done (cleanup)
        setTimeout(async () => {
          try {
            await chrome.tabs.remove(backgroundTab.id);
            console.log('🧹 [MERCARI] Background tab closed');
          } catch (e) {
            // Tab already closed or doesn't exist
          }
        }, 5000); // Close after 5 seconds (automation should be done by then)
        
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
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep channel open for async response
  }
});

// Notify Profit Orbit web app
async function notifyProfitOrbit(message) {
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://profitorbit.io/*', 'http://localhost:5173/*']
    });
    
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab not ready
      });
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

console.log('Profit Orbit Extension: Background initialized');
