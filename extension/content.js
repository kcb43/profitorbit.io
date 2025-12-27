/**
 * Content Script for All Marketplaces
 * Detects login and automates listings across multiple platforms
 */

// Detect which marketplace we're on
const MARKETPLACE = (() => {
  const hostname = window.location.hostname;
  if (hostname.includes('mercari.com')) return 'mercari';
  if (hostname.includes('facebook.com')) return 'facebook';
  if (hostname.includes('poshmark.com')) return 'poshmark';
  if (hostname.includes('ebay.com')) return 'ebay';
  if (hostname.includes('etsy.com')) return 'etsy';
  return null;
})();

// Marketplace-specific login detection
const LOGIN_DETECTORS = {
  mercari: () => {
    // Fast check: Check cookies first (fastest)
    const cookies = document.cookie;
    if (cookies.includes('mercari_session') || 
        cookies.includes('mercari_user') ||
        cookies.includes('mercari_auth') ||
        cookies.includes('_mercari_session')) {
      return true;
    }
    
    // Check localStorage for auth tokens
    try {
      const localStorageKeys = Object.keys(localStorage);
      if (localStorageKeys.some(key => 
        key.includes('mercari') && (key.includes('auth') || key.includes('token') || key.includes('session'))
      )) {
        return true;
      }
    } catch (e) {
      // localStorage might not be accessible
    }
    
    // Then check DOM elements (in order of most likely to appear first)
    const selectors = [
      '[data-testid="UserMenuButton"]',
      '.merUserMenu',
      '[aria-label*="Account"]',
      '[aria-label*="account"]',
      'a[href*="/mypage"]',
      '[data-testid="user-menu"]',
      'button[aria-label*="Account"]',
      'button[aria-label*="account"]',
      '[data-testid="header-user-menu"]',
      'header [href*="/mypage"]',
      'nav [href*="/mypage"]'
    ];
    
    for (const selector of selectors) {
      if (document.querySelector(selector)) {
        return true;
      }
    }
    
    // Check if we're NOT on login page (if we're on a protected page, we're logged in)
    const isLoginPage = window.location.pathname.includes('/login') || 
                        window.location.pathname.includes('/signin') ||
                        document.querySelector('form[action*="login"]') ||
                        document.querySelector('input[type="email"][name*="email"]');
    
    // If we're on a protected page (like /mypage, /sell, etc.) and not on login page, assume logged in
    const protectedPaths = ['/mypage', '/sell', '/purchases', '/settings', '/profile'];
    if (!isLoginPage && protectedPaths.some(path => window.location.pathname.includes(path))) {
      return true;
    }
    
    return false;
  },
  
  facebook: () => {
    return !!(
      document.querySelector('[data-pagelet="TopNavBar"]') ||
      document.querySelector('[aria-label="Account"]') ||
      document.cookie.includes('c_user=')
    );
  },
  
  poshmark: () => {
    return !!(
      document.querySelector('.user__details') ||
      document.querySelector('[data-test="header-user-menu"]') ||
      document.querySelector('a[href*="/closet/"]')
    );
  },
  
  ebay: () => {
    // Debug: log what we find
    const debugSelectors = {
      'gh-ug': document.querySelector('#gh-ug'),
      'gh-eb-My': document.querySelector('[id="gh-eb-My"]'),
      'myebay-link': document.querySelector('a[href*="/mye/myebay"]'),
      'signin-link': document.querySelector('a[href*="/signin"]'),
      'watchlist': document.querySelector('a[href*="/mye/myebay/watchlist"]'),
      'account-button': document.querySelector('button[aria-label*="Account"]'),
      'user-menu': document.querySelector('[data-test="user-menu"]')
    };
    
    console.log('eBay selectors found:', debugSelectors);
    
    // Check multiple eBay login indicators
    const hasUserGreeting = !!document.querySelector('#gh-ug');
    const hasMyEbay = !!document.querySelector('[id*="gh-eb-My"]') || !!document.querySelector('a[href*="/mye/myebay"]');
    const hasWatchlist = !!document.querySelector('a[href*="watchlist"]');
    const noSignInLink = !document.querySelector('a[href="/signin/"]');
    const hasAccountMenu = !!document.querySelector('button[aria-label*="Account"]');
    
    const isLoggedIn = hasUserGreeting || hasMyEbay || hasWatchlist || (noSignInLink && hasAccountMenu);
    
    console.log('eBay login indicators:', {
      hasUserGreeting,
      hasMyEbay,
      hasWatchlist,
      noSignInLink,
      hasAccountMenu,
      result: isLoggedIn
    });
    
    return isLoggedIn;
  },
  
  etsy: () => {
    return !!(
      document.querySelector('[data-account-nav]') ||
      document.querySelector('[data-ui="user-nav"]') ||
      document.querySelector('button[aria-label*="Account"]')
    );
  }
};

// Get user info for each marketplace
const USER_INFO_GETTERS = {
  mercari: () => {
    // Try multiple selectors to get username
    let userName = 'Mercari User';
    
    const userMenu = document.querySelector('[data-testid="UserMenuButton"]');
    if (userMenu) {
      userName = userMenu.getAttribute('aria-label') || 
                 userMenu.getAttribute('title') ||
                 userMenu.textContent?.trim() ||
                 'Mercari User';
    }
    
    // Try other selectors
    if (userName === 'Mercari User') {
      const accountLink = document.querySelector('a[href*="/mypage"]');
      if (accountLink) {
        userName = accountLink.textContent?.trim() || 
                   accountLink.getAttribute('aria-label') ||
                   'Mercari User';
      }
    }
    
    // Try to get from page title or meta tags
    if (userName === 'Mercari User') {
      const pageTitle = document.title;
      if (pageTitle && !pageTitle.includes('Mercari')) {
        userName = pageTitle.split('|')[0]?.trim() || 'Mercari User';
      }
    }
    
    return {
      userName: userName,
      marketplace: 'mercari'
    };
  },
  
  facebook: () => {
    const profileLink = document.querySelector('[aria-label="Account"]') || 
                       document.querySelector('a[href*="/profile/"]');
    return {
      userName: profileLink?.textContent?.trim() || 'Facebook User',
      marketplace: 'facebook'
    };
  },
  
  poshmark: () => {
    const userDetails = document.querySelector('.user__details');
    return {
      userName: userDetails?.textContent?.trim() || 'Poshmark User',
      marketplace: 'poshmark'
    };
  },
  
  ebay: () => {
    const userGreeting = document.querySelector('#gh-ug');
    const userName = userGreeting?.textContent?.replace('Hi', '').trim() || 'eBay User';
    return {
      userName,
      marketplace: 'ebay'
    };
  },
  
  etsy: () => {
    const accountNav = document.querySelector('[data-account-nav]');
    return {
      userName: accountNav?.getAttribute('aria-label') || 'Etsy User',
      marketplace: 'etsy'
    };
  }
};

// Check if user is logged in
function checkLogin() {
  if (!MARKETPLACE || !LOGIN_DETECTORS[MARKETPLACE]) {
    return false;
  }
  
  const isLoggedIn = LOGIN_DETECTORS[MARKETPLACE]();
  return isLoggedIn;
}

// Get user info
function getUserInfo() {
  if (!MARKETPLACE || !checkLogin()) {
    return { loggedIn: false, marketplace: MARKETPLACE };
  }
  
  const getter = USER_INFO_GETTERS[MARKETPLACE];
  const info = getter ? getter() : { userName: 'User' };
  
  return {
    loggedIn: true,
    ...info,
    timestamp: Date.now()
  };
}

// Cache login status to avoid repeated checks
let cachedLoginStatus = null;
let lastLoginCheck = 0;
const LOGIN_CHECK_CACHE_MS = 500; // Cache for 500ms

// Send login status to background script AND update localStorage for web app
function updateLoginStatus(force = false) {
  try {
    // Use cache if recent check was done (unless forced)
    const now = Date.now();
    if (!force && cachedLoginStatus && (now - lastLoginCheck) < LOGIN_CHECK_CACHE_MS) {
      return cachedLoginStatus;
    }
    
    const userInfo = getUserInfo();
    cachedLoginStatus = userInfo;
    lastLoginCheck = now;
    
    // Update localStorage so Profit Orbit web app can read it
    if (userInfo.loggedIn) {
      localStorage.setItem(`${MARKETPLACE}_session_detected`, 'true');
      localStorage.setItem(`${MARKETPLACE}_user_info`, JSON.stringify(userInfo));
    } else {
      localStorage.removeItem(`${MARKETPLACE}_session_detected`);
      localStorage.removeItem(`${MARKETPLACE}_user_info`);
    }
    
    // Check if extension context is still valid before sending message
    if (!chrome.runtime?.id) {
      console.log('Extension context invalidated - please refresh the page');
      return userInfo;
    }
    
    // Send to background script
    console.log(`Profit Orbit: Sending ${MARKETPLACE} login status:`, userInfo);
    chrome.runtime.sendMessage({
      type: `${MARKETPLACE?.toUpperCase()}_LOGIN_STATUS`,
      marketplace: MARKETPLACE,
      data: userInfo
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Extension was reloaded or context invalidated - this is normal
        console.log('Profit Orbit: Extension context changed -', chrome.runtime.lastError.message);
      } else {
        console.log('Profit Orbit: Login status sent successfully:', response);
      }
    });
    
    // Also update localStorage for Profit Orbit web app
    localStorage.setItem(`profit_orbit_${MARKETPLACE}_connected`, userInfo.loggedIn ? 'true' : 'false');
    if (userInfo.loggedIn && userInfo.userName) {
      localStorage.setItem(`profit_orbit_${MARKETPLACE}_user`, JSON.stringify({
        userName: userInfo.userName,
        marketplace: userInfo.marketplace
      }));
    }
    
    return userInfo;
  } catch (error) {
    // Gracefully handle any errors
    console.log('Extension communication error (page may need refresh):', error.message);
    return cachedLoginStatus || { loggedIn: false, marketplace: MARKETPLACE };
  }
}

// Store captured Mercari API headers (from webRequest API in background script)
let capturedMercariHeaders = null;

// Helper to check if extension context is still valid
const checkExtensionContext = () => {
  try {
    // Try to access chrome.runtime.id - if context is invalidated, this will throw
    if (chrome && chrome.runtime && chrome.runtime.id) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

// Track if we've already warned about invalidated context (to reduce noise)
let hasWarnedAboutInvalidContext = false;

// Helper to safely access chrome.storage with invalidated context handling
const safeChromeStorageGet = (keys, callback) => {
  try {
    if (!checkExtensionContext()) {
      // Silently handle invalidated context - don't log warnings (too noisy)
      if (callback) {
        try {
          callback(null);
        } catch (e) {
          // Silently ignore callback errors
        }
      }
      return;
    }
    
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      // Silently handle - don't log warnings
      if (callback) {
        try {
          callback(null);
        } catch (e) {
          // Silently ignore callback errors
        }
      }
      return;
    }
    
    try {
      chrome.storage.local.get(keys, (result) => {
        try {
          if (chrome.runtime.lastError) {
            // Silently handle errors - don't log or show stack traces
            if (callback) {
              try {
                callback(null);
              } catch (e) {
                // Silently ignore callback errors
              }
            }
            return;
          }
          
          if (callback) {
            try {
              callback(result);
            } catch (e) {
              // Silently ignore callback errors
            }
          }
        } catch (error) {
          // Silently handle callback errors - don't show stack traces
          if (callback) {
            try {
              callback(null);
            } catch (e) {
              // Silently ignore callback errors
            }
          }
        }
      });
    } catch (error) {
      // Silently handle errors - don't show stack traces
      if (callback) {
        try {
          callback(null);
        } catch (e) {
          // Silently ignore callback errors
        }
      }
    }
  } catch (error) {
    // Silently handle all errors - don't show stack traces
    if (callback) {
      try {
        callback(null);
      } catch (e) {
        // Silently ignore callback errors
      }
    }
  }
};

// Load headers from chrome.storage on startup and periodically refresh
if (MARKETPLACE === 'mercari') {
  let headerRefreshInterval = null;
  let extensionContextValid = true;
  
  const loadHeadersFromStorage = () => {
    try {
      safeChromeStorageGet(['mercariApiHeaders'], (result) => {
        try {
          if (!result) {
            // Context invalidated or error - stop refreshing
            extensionContextValid = false;
            if (headerRefreshInterval) {
              clearInterval(headerRefreshInterval);
              headerRefreshInterval = null;
            }
            return;
          }
          
          if (result.mercariApiHeaders) {
            capturedMercariHeaders = result.mercariApiHeaders;
            console.log('📡 [HEADER LOAD] Loaded Mercari API headers from storage:', capturedMercariHeaders);
          } else {
            console.log('📡 [HEADER LOAD] No headers found in storage yet');
          }
        } catch (error) {
          // Silently handle callback errors - don't show stack traces
          extensionContextValid = false;
          if (headerRefreshInterval) {
            clearInterval(headerRefreshInterval);
            headerRefreshInterval = null;
          }
        }
      });
    } catch (error) {
      // Silently handle errors - don't show stack traces
      extensionContextValid = false;
      if (headerRefreshInterval) {
        clearInterval(headerRefreshInterval);
        headerRefreshInterval = null;
      }
    }
  };
  
  // Load on startup (with a small delay to ensure chrome.storage is available)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(loadHeadersFromStorage, 100);
    });
  } else {
    setTimeout(loadHeadersFromStorage, 100);
  }
  
  // Refresh headers every 5 seconds (in case new requests come in)
  // Only set interval if extension context is valid
  if (checkExtensionContext()) {
    headerRefreshInterval = setInterval(() => {
      try {
        if (extensionContextValid && checkExtensionContext()) {
          loadHeadersFromStorage();
        } else {
          clearInterval(headerRefreshInterval);
          headerRefreshInterval = null;
        }
      } catch (error) {
        // Silently handle errors - don't show stack traces
        clearInterval(headerRefreshInterval);
        headerRefreshInterval = null;
        extensionContextValid = false;
      }
    }, 5000);
  }
  
  console.log('📡 [HEADER INTERCEPT] Ready to receive headers from webRequest API');
}

// Check login on page load
if (MARKETPLACE) {
  console.log(`Profit Orbit Extension: Initializing for ${MARKETPLACE}`);
  
  // Immediate check if DOM is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('Profit Orbit: Page already loaded - checking login status immediately');
    setTimeout(() => updateLoginStatus(true), 100);
  } else {
    // Fast check on DOMContentLoaded (faster than 'load')
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Profit Orbit: DOMContentLoaded - checking login status');
      updateLoginStatus(true);
    }, { once: true });
  }
  
  // Also check on full page load (fallback)
  window.addEventListener('load', () => {
    console.log('Profit Orbit: Page loaded - checking login status');
    updateLoginStatus(true);
  }, { once: true });

  // Poll every 3 seconds to catch login changes (especially for SPAs)
  const statusPollInterval = setInterval(() => {
    if (checkExtensionContext()) {
      updateLoginStatus(false); // Use cache if recent
    } else {
      clearInterval(statusPollInterval);
    }
  }, 3000);

  // Watch for login changes (SPA navigation) - with debouncing
  let mutationTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimeout);
    // Reduced delay from 2000ms to 300ms for faster detection
    mutationTimeout = setTimeout(() => {
      console.log('Profit Orbit: DOM mutation detected - checking login status');
      updateLoginStatus(true);
    }, 300);
  });

  // Only observe if body exists, otherwise wait
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    // Wait for body to exist
    const bodyObserver = new MutationObserver(() => {
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        bodyObserver.disconnect();
      }
    });
    bodyObserver.observe(document.documentElement, {
      childList: true
    });
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PING') {
      // Simple ping to check if content script is ready
      sendResponse({ pong: true, marketplace: MARKETPLACE });
      return true;
    }
    
    if (message.type === 'CHECK_LOGIN') {
      // Force update and return fresh status
      const userInfo = updateLoginStatus(true);
      sendResponse({ status: userInfo || getUserInfo() });
      return true;
    }
    
    if (message.type === 'CREATE_LISTING') {
      // Run async listing creation
      // Note: Background script already navigated tab to /sell/, so content script shouldn't navigate again
      createListing(message.listingData, { skipNavigation: true }).then((result) => {
        sendResponse(result);
      }).catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
      
      return true; // Keep channel open for async response
    }
    
    if (message.type === 'MERCARI_HEADERS_CAPTURED') {
      capturedMercariHeaders = message.headers;
      console.log('📡 [HEADER UPDATE] Received Mercari API headers from background:', capturedMercariHeaders);
      return false; // No response needed
    }
  });
  
  // Listen for LIST_ITEM messages from page API (window.postMessage)
  window.addEventListener('message', (event) => {
    // Only accept messages from same origin (page context)
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'PROFIT_ORBIT_LIST_ITEM') {
      console.log('📦 [LIST_ITEM] Received listing request from page API:', event.data.payload);
      
      const payload = event.data.payload;
      
      // Validate payload
      if (!payload || !payload.marketplace) {
        console.error('🔴 [LIST_ITEM] Invalid payload - missing marketplace');
        // Send error back to page
        window.postMessage({
          type: 'PROFIT_ORBIT_LIST_ITEM_RESPONSE',
          success: false,
          error: 'Invalid payload - missing marketplace',
          timestamp: Date.now()
        }, '*');
        return;
      }
      
      // Only handle Mercari for now
      if (payload.marketplace === 'mercari' && MARKETPLACE === 'mercari') {
        console.log('📦 [LIST_ITEM] Processing Mercari listing...');
        
        // Create listing and send response back to page
        createMercariListing(payload.listingData || payload, { skipNavigation: false })
          .then((result) => {
            console.log('📦 [LIST_ITEM] Listing result:', result);
            // Send success/failure back to page
            window.postMessage({
              type: 'PROFIT_ORBIT_LIST_ITEM_RESPONSE',
              success: result.success || false,
              result: result,
              timestamp: Date.now()
            }, '*');
          })
          .catch((error) => {
            console.error('🔴 [LIST_ITEM] Listing failed:', error);
            window.postMessage({
              type: 'PROFIT_ORBIT_LIST_ITEM_RESPONSE',
              success: false,
              error: error.message || 'Unknown error',
              timestamp: Date.now()
            }, '*');
          });
      } else {
        console.warn('⚠️ [LIST_ITEM] Marketplace mismatch or not supported:', payload.marketplace, 'current:', MARKETPLACE);
        window.postMessage({
          type: 'PROFIT_ORBIT_LIST_ITEM_RESPONSE',
          success: false,
          error: `Marketplace ${payload.marketplace} not supported on this page`,
          timestamp: Date.now()
        }, '*');
      }
    }
  });

  // Initial check
  updateLoginStatus();
}

// Create listing on current marketplace
async function createListing(listingData, options = {}) {
  if (MARKETPLACE === 'mercari') {
    return await createMercariListing(listingData, options);
  }
  
  if (MARKETPLACE === 'facebook') {
    return await createFacebookListing(listingData, options);
  }
  
  // Other marketplaces to be implemented
  return {
    success: false,
    error: `${MARKETPLACE} listing automation not yet implemented`
  };
}

// Prevent multiple simultaneous listing creations
let isCreatingMercariListing = false;

// Mercari-specific listing automation
async function createMercariListing(listingData, options = {}) {
  // Prevent multiple simultaneous calls
  if (isCreatingMercariListing) {
    // Silently return - don't log warning (user might click multiple times)
    return {
      success: false,
      error: 'Listing creation already in progress'
    };
  }
  
  isCreatingMercariListing = true;
  
  try {
    console.log('🚀 [MERCARI] Starting listing creation...');
    console.log('🧹 [MERCARI] Clearing any cached state...');
    
    // Clear any cached DOM references or state that might cause issues
    // Force garbage collection hint (if available)
    if (window.gc) {
      window.gc();
    }
    
    const summaryData = {
      title: listingData.title,
      price: listingData.price,
      photosCount: listingData.photos?.length || 0,
      category: listingData.mercariCategory,
      condition: listingData.condition,
      brand: listingData.brand
    };
    console.log('📋 [MERCARI] Listing data:', summaryData);
    console.log('📋 [MERCARI] Page state:', {
      url: window.location.href,
      readyState: document.readyState,
      timestamp: new Date().toISOString()
    });
    
    // Check if we're on Mercari sell page using proper route detection
    // Use pathname.startsWith to handle /sell, /sell/, /sell/create, etc.
    const isOnSellPage = window.location.hostname.endsWith('mercari.com') && 
                         window.location.pathname.startsWith('/sell');
    
    // Only navigate if not called from background script (which already navigated the tab)
    if (!options.skipNavigation && !isOnSellPage) {
      console.log('🌐 [MERCARI] Navigating to sell page in current tab...');
      // Store listing data in sessionStorage so we can retrieve it after navigation
      sessionStorage.setItem('__mercariPendingListing', JSON.stringify({ ...listingData, skipNavigation: false }));
      window.location.href = 'https://www.mercari.com/sell/';
      
      // Wait for page to load, then retry (reduced delay)
      window.addEventListener('load', () => {
        setTimeout(() => {
          const storedData = sessionStorage.getItem('__mercariPendingListing');
          if (storedData) {
            const data = JSON.parse(storedData);
            sessionStorage.removeItem('__mercariPendingListing');
            createMercariListing(data);
          }
        }, 300); // Reduced from 500ms to 300ms
      }, { once: true });
      return { success: false, error: 'Navigating to sell page...', retrying: true };
    }
    
    // If called from background script, ensure we're on the sell page (should already be)
    if (options.skipNavigation && !isOnSellPage) {
      console.warn('⚠️ [MERCARI] Expected to be on /sell page but not there. Waiting...');
      await sleep(300); // Reduced from 500ms to 300ms
      const stillOnSellPage = window.location.hostname.endsWith('mercari.com') && 
                              window.location.pathname.startsWith('/sell');
      if (!stillOnSellPage) {
        isCreatingMercariListing = false;
        return { success: false, error: 'Not on Mercari sell page' };
      }
    }
    
    console.log('⏳ [MERCARI] Waiting for form to load...');
    // Wait for form to be ready (use actual Mercari selectors) - optimized timeout
    await waitForElement('[data-testid="Title"], #sellName', 2000); // Reduced from 4000ms to 2000ms
    console.log('✅ [MERCARI] Form loaded, starting to fill fields...');
    
    // Fill in form fields
    const fillResult = await fillMercariForm(listingData);
    console.log('✅ [MERCARI] Form fields filled successfully');
    
    // No wait needed - form fields are set synchronously
    
    // Upload photos (required by Mercari)
    const hasPhotos = listingData.photos && listingData.photos.length > 0;
    if (hasPhotos) {
      console.log(`📸 [MERCARI] Starting photo upload for ${listingData.photos.length} photo(s)...`);

      // Ensure the photo uploader UI is opened (Mercari often hides the file input until you click
      // "Add up to 12 photos / drag and drop").
      try {
        await ensureMercariPhotoUploaderOpen();
      } catch (e) {
        console.warn('⚠️ [MERCARI] Could not explicitly open photo uploader UI:', e?.message || e);
      }
      
      // Headers should already be captured from page load - no wait needed
      if (!capturedMercariHeaders || Object.keys(capturedMercariHeaders).length === 0) {
        console.log('⏳ [MERCARI] Waiting for API headers to be captured...');
        await sleep(50); // Minimal wait - headers should be ready immediately
        
        // Check again
        if (!capturedMercariHeaders || Object.keys(capturedMercariHeaders).length === 0) {
          console.warn('⚠️ [MERCARI] No headers captured yet, proceeding with storage headers');
        } else {
          console.log(`✅ [MERCARI] Captured ${Object.keys(capturedMercariHeaders).length} headers from Mercari API`);
        }
      } else {
        console.log(`✅ [MERCARI] Using ${Object.keys(capturedMercariHeaders).length} captured headers`);
      }
      
      try {
        const uploadResult = await uploadMercariPhotos(listingData.photos);
        if (!uploadResult.success) {
          console.error('❌ [MERCARI] Photo upload failed:', uploadResult.error);
          return {
            success: false,
            error: `Photo upload failed: ${uploadResult.error}`
          };
        }
        console.log(`✅ [MERCARI] All photos uploaded successfully! Upload IDs: ${uploadResult.uploadIds.join(', ')}`);
        // Upload IDs are stored in window.__mercariUploadIds for form submission
      } catch (error) {
        console.error('❌ [MERCARI] Photo upload error:', error);
        return {
          success: false,
          error: `Photo upload error: ${error.message}`
        };
      }
    } else {
      // User expectation: photos should carry over from the app listing. Mercari requires at least one photo.
      return {
        success: false,
        error: 'No photos provided. Mercari requires at least 1 photo to list.',
      };
    }
    
    // Check if photos are required but not uploaded
    const photoCount =
      document.querySelectorAll('[data-testid="Photo"]').length ||
      document.querySelectorAll('img[src^="blob:"]').length;
    if (photoCount === 0) {
      return { success: false, error: 'Mercari did not register any uploaded photos.' };
    }
    
    // Handle any popups that might have appeared after photo upload (non-blocking)
    handleMercariPopups().catch(() => {}); // Don't wait for this
    
    // Verify and re-set brand if needed (popups might have cleared it) - parallel check
    if (listingData.brand) {
      console.log('🔍 [MERCARI] Verifying brand is still set...');
      const brandDropdown = document.querySelector('[data-testid="Brand"]');
      const brandValue = brandDropdown?.textContent?.trim() || brandDropdown?.value?.trim() || '';
      
      // Check if brand is empty or shows placeholder
      if (!brandValue || brandValue === 'Select brand' || brandValue === 'Brand' || brandValue.length < 2) {
        console.log('⚠️ [MERCARI] Brand appears to be missing, re-setting...');
        await setMercariBrand(listingData.brand);
        // No wait needed - brand is set synchronously
      } else {
        console.log(`✅ [MERCARI] Brand is still set: "${brandValue}"`);
      }
    }
    
    console.log('📤 [MERCARI] Submitting form immediately...');
    console.log('📋 [MERCARI] Form state before submission:', {
      url: window.location.href,
      readyState: document.readyState,
      timestamp: new Date().toISOString()
    });
    
    // Submit the form (only if photos are present) - brand verification happens inside
    const submitResult = await submitMercariForm(listingData.brand);
    
    console.log('📋 [MERCARI] Submission result:', submitResult);
    
    if (submitResult.success) {
      console.log('✅ [MERCARI] Listing created successfully!', submitResult.listingUrl);
      console.log('📋 [MERCARI] Listing ID:', submitResult.listingId);
    } else {
      // Only log as error if it's not a "might be processing" case
      if (submitResult.mightBeProcessing) {
        // Silently handle - don't log (often false positive, listing usually succeeds)
        // Frontend will show appropriate message
      } else {
        // Log actual errors - these are real failures
        if (!submitResult.error?.includes('might be processing') && 
            !submitResult.error?.includes('status unclear')) {
          console.error('❌ [MERCARI] Form submission failed:', submitResult.error);
        }
      }
    }
    
    // Reset flag on completion
    isCreatingMercariListing = false;
    return submitResult;
    
  } catch (error) {
    console.error('❌ [MERCARI] Error during listing creation:', error);
    // Reset flag on error
    isCreatingMercariListing = false;
    return { success: false, error: error.message };
  }
}

// Facebook Marketplace listing automation
async function createFacebookListing(listingData) {
  try {
    console.log('🚀 [FACEBOOK] Starting listing creation...');
    const summaryData = {
      title: listingData.title,
      price: listingData.price,
      photosCount: listingData.photos?.length || 0,
      category: listingData.category,
      condition: listingData.condition
    };
    console.log('📋 [FACEBOOK] Listing data:', summaryData);
    
    // Navigate to Marketplace create listing page if not already there
    // Use pathname.startsWith() for CSP-safe route detection (Facebook has strict CSP)
    const isOnMarketplacePage = window.location.hostname.endsWith('facebook.com') && 
                                (window.location.pathname.startsWith('/marketplace/create') || 
                                 window.location.pathname.startsWith('/marketplace/sell'));
    
    if (!isOnMarketplacePage) {
      console.log('🌐 [FACEBOOK] Navigating to Marketplace create page...');
      // Store listing data in sessionStorage so we can retrieve it after navigation
      sessionStorage.setItem('__facebookPendingListing', JSON.stringify(listingData));
      window.location.href = 'https://www.facebook.com/marketplace/create/';
      
      // Wait for page to load, then retry
      window.addEventListener('load', () => {
        setTimeout(() => {
          const storedData = sessionStorage.getItem('__facebookPendingListing');
          if (storedData) {
            const data = JSON.parse(storedData);
            sessionStorage.removeItem('__facebookPendingListing');
            createFacebookListing(data);
          }
        }, 500);
      }, { once: true });
      return { success: false, error: 'Navigating to Marketplace create page...', retrying: true };
    }
    
    console.log('⏳ [FACEBOOK] Waiting for form to load...');
    // Wait for form to be ready - Facebook uses various selectors
    await waitForElement('input[placeholder*="What are you selling"], textarea[placeholder*="Describe"], [aria-label*="Title"], [aria-label*="Price"]', 10000);
    console.log('✅ [FACEBOOK] Form loaded, starting to fill fields...');
    
    // Fill in form fields
    const fillResult = await fillFacebookForm(listingData);
    console.log('✅ [FACEBOOK] Form fields filled successfully');
    
    // Reduced wait time for form changes to take effect
    await sleep(500);
    
    // Upload photos if present
    const hasPhotos = listingData.photos && listingData.photos.length > 0;
    if (hasPhotos) {
      console.log(`📸 [FACEBOOK] Starting photo upload for ${listingData.photos.length} photo(s)...`);
      try {
        const uploadResult = await uploadFacebookPhotos(listingData.photos);
        if (!uploadResult.success) {
          console.error('❌ [FACEBOOK] Photo upload failed:', uploadResult.error);
          return {
            success: false,
            error: `Photo upload failed: ${uploadResult.error}`,
            requiresManualPhotoUpload: true
          };
        }
        console.log(`✅ [FACEBOOK] All photos uploaded successfully!`);
      } catch (error) {
        console.error('❌ [FACEBOOK] Photo upload error:', error);
        return {
          success: false,
          error: `Photo upload error: ${error.message}`,
          requiresManualPhotoUpload: true
        };
      }
    }
    
    // Wait a bit for photos to process
    await sleep(500); // Reduced from 1000ms to 500ms
    
    console.log('📤 [FACEBOOK] Submitting form...');
    // Submit the form
    const submitResult = await submitFacebookForm();
    
    if (submitResult.success) {
      console.log('✅ [FACEBOOK] Listing created successfully!', submitResult.listingUrl);
    } else {
      console.error('❌ [FACEBOOK] Form submission failed:', submitResult.error);
    }
    
    return submitResult;
    
  } catch (error) {
    console.error('❌ [FACEBOOK] Error during listing creation:', error);
    return { success: false, error: error.message };
  }
}

// Fill Facebook Marketplace form fields
async function fillFacebookForm(listingData) {
  console.log('📝 [FACEBOOK] Starting to fill form fields...');
  
  try {
    // 1. TITLE
    if (listingData.title) {
      console.log('  → Setting title:', listingData.title);
      const titleInput = document.querySelector('input[placeholder*="What are you selling"], input[aria-label*="Title"], input[aria-label*="Item name"]') ||
                        document.querySelector('input[type="text"]');
      if (titleInput) {
        titleInput.focus();
        titleInput.value = listingData.title;
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(100); // Reduced from 300ms to 100ms
        console.log('  ✓ Title set');
      }
    }
    
    // 2. PRICE
    if (listingData.price) {
      console.log('  → Setting price:', listingData.price);
      const priceInput = document.querySelector('input[placeholder*="Price"], input[aria-label*="Price"], input[type="number"]') ||
                         document.querySelector('input[name*="price" i]');
      if (priceInput) {
        priceInput.focus();
        priceInput.value = listingData.price.toString();
        priceInput.dispatchEvent(new Event('input', { bubbles: true }));
        priceInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(100); // Reduced from 300ms to 100ms
        console.log('  ✓ Price set');
      }
    }
    
    // 3. DESCRIPTION
    if (listingData.description) {
      console.log('  → Setting description:', listingData.description.substring(0, 50) + '...');
      const descInput = document.querySelector('textarea[placeholder*="Describe"], textarea[aria-label*="Description"]') ||
                       document.querySelector('textarea');
      if (descInput) {
        descInput.focus();
        descInput.value = listingData.description;
        descInput.dispatchEvent(new Event('input', { bubbles: true }));
        descInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(100); // Reduced from 300ms to 100ms
        console.log('  ✓ Description set');
      }
    }
    
    // 4. CATEGORY (if provided)
    if (listingData.category) {
      console.log('  → Setting category:', listingData.category);
      const categoryButton = document.querySelector('[aria-label*="Category"], button[aria-label*="Category"]') ||
                            document.querySelector('div[role="button"]:has-text("Category")');
      if (categoryButton) {
        categoryButton.click();
        await sleep(500);
        // Try to find and select the category
        const categoryOption = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"]'))
          .find(el => el.textContent?.toLowerCase().includes(listingData.category.toLowerCase()));
        if (categoryOption) {
          categoryOption.click();
          await sleep(300);
          console.log('  ✓ Category set');
        }
      }
    }
    
    // 5. CONDITION (if provided)
    if (listingData.condition) {
      console.log('  → Setting condition:', listingData.condition);
      const conditionButton = document.querySelector('[aria-label*="Condition"], button[aria-label*="Condition"]');
      if (conditionButton) {
        conditionButton.click();
        await sleep(500);
        const conditionOption = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"]'))
          .find(el => el.textContent?.toLowerCase().includes(listingData.condition.toLowerCase()));
        if (conditionOption) {
          conditionOption.click();
          await sleep(300);
          console.log('  ✓ Condition set');
        }
      }
    }
    
    // 6. LOCATION (if provided)
    if (listingData.location || listingData.zip) {
      console.log('  → Setting location:', listingData.location || listingData.zip);
      const locationInput = document.querySelector('input[placeholder*="Location"], input[aria-label*="Location"]');
      if (locationInput) {
        locationInput.focus();
        locationInput.value = listingData.location || listingData.zip || '';
        locationInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(500); // Wait for autocomplete
        // Select first suggestion if available
        const suggestion = document.querySelector('[role="option"], [role="menuitem"]');
        if (suggestion) {
          suggestion.click();
          await sleep(300);
        }
        console.log('  ✓ Location set');
      }
    }
    
    console.log('✅ [FACEBOOK] All form fields filled!');
    return true;
    
  } catch (error) {
    console.error('❌ [FACEBOOK] Error filling form:', error);
    throw error;
  }
}

// Upload photos to Facebook Marketplace
async function uploadFacebookPhotos(photos) {
  console.log('📸 [FACEBOOK PHOTO UPLOAD] Starting photo upload process...');
  
  if (!photos || photos.length === 0) {
    console.log('⚠️ [FACEBOOK PHOTO UPLOAD] No photos to upload');
    return { success: true, uploadIds: [] };
  }
  
  try {
    // Find the photo upload button/area
    const photoButton = document.querySelector('[aria-label*="Add photos"], [aria-label*="Upload"], input[type="file"]') ||
                       document.querySelector('div[role="button"]:has-text("Add photos")');
    
    if (!photoButton) {
      return { success: false, error: 'Photo upload button not found' };
    }
    
    // If it's a file input, use it directly
    if (photoButton.tagName === 'INPUT' && photoButton.type === 'file') {
      const fileInput = photoButton;
      
      // Convert photo URLs to File objects
      const files = [];
      for (const photo of photos) {
        const photoUrl = photo.preview || photo.imageUrl || photo;
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        files.push(file);
      }
      
      // Create a DataTransfer object to set files
      const dataTransfer = new DataTransfer();
      files.forEach(file => dataTransfer.items.add(file));
      fileInput.files = dataTransfer.files;
      
      // Trigger change event
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Wait for uploads to complete
      await sleep(500); // Reduced from 2000ms
      
      console.log('✅ [FACEBOOK PHOTO UPLOAD] Photos uploaded successfully!');
      return { success: true, uploadIds: [] };
    } else {
      // Click the button to open file picker (user will need to select files manually)
      photoButton.click();
      return { success: false, error: 'Manual photo upload required - file input not accessible', requiresManualUpload: true };
    }
    
  } catch (error) {
    console.error('❌ [FACEBOOK PHOTO UPLOAD] Error:', error);
    return { success: false, error: error.message };
  }
}

// Submit Facebook Marketplace form
async function submitFacebookForm() {
  console.log('📤 [FACEBOOK FORM SUBMIT] Looking for Publish button...');
  
  // Find the Publish/Post button
  const submitBtn = document.querySelector('[aria-label*="Publish"], [aria-label*="Post"], button:has-text("Publish"), button:has-text("Post")') ||
                   document.querySelector('div[role="button"]:has-text("Publish")') ||
                   document.querySelector('button[type="submit"]');
  
  if (!submitBtn) {
    console.error('❌ [FACEBOOK FORM SUBMIT] Publish button not found');
    return {
      success: false,
      error: 'Publish button not found on page'
    };
  }
  
  console.log('✅ [FACEBOOK FORM SUBMIT] Publish button found');
  
  // Check if button is disabled
  if (submitBtn.disabled || submitBtn.getAttribute('aria-disabled') === 'true') {
    console.warn('⚠️ [FACEBOOK FORM SUBMIT] Publish button is disabled - form may be incomplete');
    return {
      success: false,
      error: 'Form incomplete - please check required fields'
    };
  }
  
  // Click the button
  console.log('🖱️ [FACEBOOK FORM SUBMIT] Clicking Publish button...');
  submitBtn.click();
  
  // Wait for navigation or success message
  await sleep(2000);
  
  // Check if we navigated to a listing page or success page
  if (window.location.href.includes('/marketplace/item/') || window.location.href.includes('/marketplace/you/')) {
    const listingUrl = window.location.href;
    console.log('✅ [FACEBOOK FORM SUBMIT] Listing created successfully!');
    return {
      success: true,
      listingUrl: listingUrl,
      message: 'Listing created successfully'
    };
  }
  
  // If still on create page, might have succeeded but not navigated
  const successMessage = document.querySelector('[role="alert"], .success, [data-testid*="success"]');
  if (successMessage) {
    console.log('✅ [FACEBOOK FORM SUBMIT] Success message detected');
    return {
      success: true,
      message: 'Listing created successfully'
    };
  }
  
  return {
    success: true,
    message: 'Form submitted - please verify listing was created'
  };
}

// Use Puppeteer API for listings with photos
async function createMercariListingWithPuppeteer(listingData) {
  try {
    // Get the API URL - try to get from storage or use default
    let apiUrl = 'https://profitorbit.io'; // Default to production
    
    // Try to get from chrome.storage if available
    try {
      const stored = await new Promise((resolve) => {
        chrome.storage.sync.get(['puppeteerApiUrl'], (result) => {
          resolve(result.puppeteerApiUrl);
        });
      });
      if (stored) {
        apiUrl = stored;
      }
    } catch (e) {
      // If storage fails, use default
    }
    
    const fullApiUrl = `${apiUrl}/api/mercari-puppeteer`;
    
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listingData: listingData
      })
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      return result;
    } else {
      throw new Error(result.error || result.message || 'Puppeteer API request failed');
    }
    
  } catch (error) {
    // Fallback to extension method - continue with form filling but skip photo upload
    return await createMercariListingExtensionFallback(listingData);
  }
}

// Fallback to extension method when Puppeteer fails
async function createMercariListingExtensionFallback(listingData) {
  // Navigate to sell page if not already there
  // Check if on Mercari sell page using proper route detection
  const isOnSellPage = window.location.hostname.endsWith('mercari.com') && 
                       window.location.pathname.startsWith('/sell');
  if (!isOnSellPage) {
    window.location.href = 'https://www.mercari.com/sell/';
    
    // Wait for page to load, then retry
    window.addEventListener('load', () => {
      setTimeout(() => createMercariListingExtensionFallback(listingData), 2000);
    }, { once: true });
    return { success: false, error: 'Navigating to sell page...', retrying: true };
  }
  
  // Wait for form to be ready
  await waitForElement('[data-testid="Title"], #sellName', 10000);
  
  // Fill in form fields (without photos)
  const fillResult = await fillMercariForm(listingData);
  
  // Wait a bit for all changes to take effect
  await sleep(2000);
  
  // Don't auto-submit - let user review and upload photos manually
  return {
    success: true,
    message: 'Form filled successfully. Please upload photos manually and click the List button.',
    requiresManualPhotoUpload: true
  };
}

// Helper: Click Mercari custom dropdown and select option
async function selectMercariDropdown(testId, optionText, partialMatch = false) {
  try {
    
    // Find and click the dropdown trigger - try multiple selectors
    let dropdown = document.querySelector(`[data-testid="${testId}"]`);
    
    // Try alternative selectors if exact testId not found
    if (!dropdown) {
      // Try case-insensitive attribute selector
      dropdown = document.querySelector(`[data-testid*="${testId}" i]`);
    }
    
    // Try finding by label or aria-label
    if (!dropdown) {
      const labels = Array.from(document.querySelectorAll('label'));
      const matchingLabel = labels.find(label => 
        label.textContent?.toLowerCase().includes(testId.toLowerCase())
      );
      if (matchingLabel) {
        dropdown = matchingLabel.closest('div')?.querySelector('[role="button"], [role="combobox"], button, input');
      }
    }
    
    // Fallback: if testId not found, try to find any category dropdown that's visible/active
    if (!dropdown && testId.startsWith('Category')) {
      // Try finding by aria attributes or class names
      dropdown = document.querySelector('[data-testid*="Category"]') ||
                 document.querySelector('[aria-haspopup="listbox"][id*="category"]') ||
                 document.querySelector('.SelectInputEl-sc-1buwe9t');
    }
    
    if (!dropdown) {
      return false;
    }
    
    // Scroll into view if needed
    dropdown.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(50); // Reduced from 100ms
    
    // Click to open dropdown
    dropdown.click();
    // Brand dropdown needs more time to open
    const openWait = testId === 'Brand' ? 400 : 200;
    await sleep(openWait);
    
    // Wait for options to appear (they usually appear in a portal/overlay)
    // Mercari dropdowns render options in the DOM after clicking
    // Try multiple times to find options - Brand needs more attempts
    let options = [];
    const maxAttempts = testId === 'Brand' ? 8 : 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Try to find the option - Mercari uses various patterns
      // Look for elements with role="option" or in a listbox
      options = Array.from(document.querySelectorAll('[role="option"]'));
      
      // If no options found, try alternative selectors
      if (options.length === 0) {
        options = Array.from(document.querySelectorAll('[data-testid*="Option"]')) ||
                  Array.from(document.querySelectorAll('[data-testid*="option"]')) ||
                  Array.from(document.querySelectorAll('.SelectOption-sc-')) ||
                  Array.from(document.querySelectorAll('li[class*="Option"]')) ||
                  Array.from(document.querySelectorAll('div[class*="option" i]'));
      }
      
      // Also try finding options in any visible listbox or menu
      if (options.length === 0) {
        const listbox = document.querySelector('[role="listbox"]');
        if (listbox) {
          options = Array.from(listbox.querySelectorAll('*'));
        }
      }
      
      if (options.length > 0) {
        break;
      }
      
      // Brand needs more time between attempts
      const attemptWait = testId === 'Brand' ? 200 : 100;
      await sleep(attemptWait);
    }
    
    if (options.length === 0) {
      // Click outside to close dropdown
      document.body.click();
      await sleep(50); // Reduced from 150ms
      return false;
    }
    
    // Clean option text for matching (remove extra whitespace, special chars)
    const cleanOptionText = optionText.trim().toLowerCase().replace(/[^\w\s]/g, '');
    
    let matchedOption = null;
    
    if (partialMatch) {
      matchedOption = options.find(opt => {
        const optText = opt.textContent?.trim().toLowerCase().replace(/[^\w\s]/g, '') || '';
        return optText.includes(cleanOptionText) || cleanOptionText.includes(optText);
      });
    } else {
      matchedOption = options.find(opt => {
        const optText = opt.textContent?.trim().toLowerCase().replace(/[^\w\s]/g, '') || '';
        return optText === cleanOptionText;
      });
    }
    
    if (matchedOption) {
      matchedOption.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(50); // Reduced from 100ms
      matchedOption.click();
      await sleep(150); // Reduced from 300ms - selection happens quickly
      return true;
    } else {
      // Click outside to close dropdown
      document.body.click();
      await sleep(50); // Reduced from 150ms
      return false;
    }
  } catch (error) {
    console.error(`Error selecting dropdown [${testId}]:`, error);
    // Try to close dropdown if open
    try {
      document.body.click();
    } catch (e) {}
    return false;
  }
}

// Helper: Type into autocomplete/searchable dropdown
async function typeIntoMercariDropdown(testId, text) {
  try {
    console.log(`🔍 [TYPE DROPDOWN ${testId}] Starting, text: "${text}"`);
    let dropdown = document.querySelector(`[data-testid="${testId}"]`);
    
    // Try alternative selectors
    if (!dropdown) {
      dropdown = document.querySelector(`[data-testid*="${testId}" i]`);
    }
    
    if (!dropdown) {
      console.log(`❌ [TYPE DROPDOWN ${testId}] Dropdown not found`);
      return false;
    }
    
    console.log(`✅ [TYPE DROPDOWN ${testId}] Dropdown found`);
    
    // Scroll into view
    dropdown.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(50); // Reduced from 100ms
    
    // Click to open/focus - Brand dropdown needs more time
    console.log(`🖱️ [TYPE DROPDOWN ${testId}] Clicking dropdown to open...`);
    dropdown.click();
    // Brand dropdown needs more time to open and show input
    const waitTime = testId === 'Brand' ? 400 : 200;
    await sleep(waitTime);
    
    // Try to find an input field within or after the dropdown
    let input = dropdown.querySelector('input[type="text"]') ||
                dropdown.querySelector('input') ||
                document.querySelector(`[data-testid="${testId}"] input`) ||
                document.activeElement;
    
    // If still no input, try to find any input in the dropdown area
    if (!input || input.tagName !== 'INPUT') {
      const dropdownContainer = dropdown.closest('div') || dropdown.parentElement;
      if (dropdownContainer) {
        input = dropdownContainer.querySelector('input[type="text"]') || 
                dropdownContainer.querySelector('input');
      }
    }
    
    // Also try finding input by looking for search/autocomplete inputs
    if (!input || input.tagName !== 'INPUT') {
      input = document.querySelector('input[type="text"][placeholder*="brand" i]') ||
              document.querySelector('input[type="text"][placeholder*="search" i]') ||
              document.querySelector('input[autocomplete]') ||
              document.querySelector('[role="combobox"] input');
    }
    
    // For Brand specifically, wait a bit more and try again
    if ((!input || input.tagName !== 'INPUT') && testId === 'Brand') {
      await sleep(300);
      input = document.querySelector('input[type="text"][placeholder*="brand" i]') ||
              document.querySelector('input[type="text"][placeholder*="search" i]') ||
              document.querySelector('[role="combobox"] input') ||
              document.activeElement;
    }
    
    console.log(`🔍 [TYPE DROPDOWN ${testId}] Input found:`, input ? 'Yes' : 'No');
    
    if (input && input.tagName === 'INPUT') {
      console.log(`📝 [TYPE DROPDOWN ${testId}] Typing into input: "${text}"`);
      
      // Focus the input
      input.focus();
      await sleep(200); // Brand needs more time
      
      // Clear the input
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Fast input: Set value directly and trigger events (much faster than typing character-by-character)
      // This is how robots do it - instant value setting!
      input.value = text;
      
      // Trigger all necessary events for Mercari's React to detect the change
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
      
      // Also trigger focus/blur to ensure React sees the change
      input.dispatchEvent(new Event('focus', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      
      console.log(`⚡ [TYPE DROPDOWN ${testId}] Set value instantly (robot speed!): "${text}"`);
      
      // Wait for autocomplete to appear - Brand needs more time
      const autocompleteWait = testId === 'Brand' ? 500 : 200;
      await sleep(autocompleteWait);
      
      // Try to find and click the matching option
      const options = Array.from(document.querySelectorAll('[role="option"]'));
      console.log(`🔍 [TYPE DROPDOWN ${testId}] Found ${options.length} options`);
      
      const matchingOption = options.find(opt => {
        const optText = opt.textContent?.trim().toLowerCase();
        const searchText = text.toLowerCase();
        return optText && (optText.includes(searchText) || searchText.includes(optText));
      });
      
      if (matchingOption) {
        console.log(`✅ [TYPE DROPDOWN ${testId}] Found matching option: "${matchingOption.textContent?.trim()}"`);
        matchingOption.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(50); // Reduced from 100ms
        matchingOption.click();
        await sleep(150); // Reduced from 300ms
        return true;
      } else {
        console.log(`⚠️ [TYPE DROPDOWN ${testId}] No matching option found, trying Enter key...`);
        
        // If no matching option found, try pressing Enter to accept typed value
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        await sleep(150); // Reduced from 300ms
        
        // Check if value was accepted by checking dropdown value
        const dropdownAfter = document.querySelector(`[data-testid="${testId}"]`);
        const dropdownValue = dropdownAfter?.textContent?.trim() || dropdownAfter?.value?.trim() || '';
        console.log(`📋 [TYPE DROPDOWN ${testId}] Dropdown value after Enter: "${dropdownValue}"`);
        
        if (dropdownValue && dropdownValue.toLowerCase().includes(text.toLowerCase())) {
          console.log(`✅ [TYPE DROPDOWN ${testId}] Value accepted via Enter key`);
          return true;
        }
      }
    } else {
      console.log(`❌ [TYPE DROPDOWN ${testId}] Input field not found`);
    }
    
    return false;
  } catch (error) {
    console.error(`❌ [TYPE DROPDOWN ${testId}] Error:`, error);
    console.error(`Error typing into dropdown [${testId}]:`, error);
    return false;
  }
}

// Upload photos to Mercari using GraphQL API
async function uploadMercariPhotos(photos) {
  try {
    console.log('📸 [PHOTO UPLOAD] Starting photo upload process...');
    
    if (!photos || photos.length === 0) {
      console.log('⚠️ [PHOTO UPLOAD] No photos to upload');
      return { success: true, uploadIds: [] };
    }
    
    console.log(`📸 [PHOTO UPLOAD] Processing ${photos.length} photo(s)...`);
    
    // Reduced wait time - page should already be initialized
    console.log('⏳ [PHOTO UPLOAD] Waiting for page to initialize...');
    await sleep(200); // Reduced from 500ms to 200ms
    
    // Load headers from storage using the same pattern as loadHeadersFromStorage
    console.log('🔍 [PHOTO UPLOAD] Loading headers from storage...');
    let mercariHeaders = null;
    await new Promise((resolve) => {
      safeChromeStorageGet(['mercariApiHeaders'], (result) => {
        if (result && result.mercariApiHeaders) {
          mercariHeaders = result.mercariApiHeaders;
          console.log('📡 [PHOTO UPLOAD] Loaded Mercari API headers from storage:', mercariHeaders);
        } else {
          console.log('⚠️ [PHOTO UPLOAD] No headers found in storage');
        }
        resolve();
      });
    });
    
    if (!mercariHeaders || Object.keys(mercariHeaders).length === 0) {
      console.error('❌ [PHOTO UPLOAD] No headers found in storage. Please navigate to Mercari and wait for headers to be captured.');
      return { success: false, error: 'No headers found. Please ensure you are on a Mercari page and headers have been captured.' };
    }
    
    // Verify required headers are present
    if (!mercariHeaders['authorization']) {
      console.error('❌ [PHOTO UPLOAD] Authorization header not found in stored headers');
      return { success: false, error: 'Authorization header not found. Please ensure you are logged into Mercari and headers have been captured.' };
    }
    
    console.log(`✅ [PHOTO UPLOAD] Headers loaded from storage`);
    console.log(`   Headers count: ${Object.keys(mercariHeaders).length} headers`);
    console.log(`   Authorization: ${mercariHeaders['authorization']?.substring(0, 30)}...`);
    if (mercariHeaders['x-csrf-token']) {
      console.log(`   CSRF token: ${mercariHeaders['x-csrf-token']?.substring(0, 10)}...`);
    }

    const uploadIds = [];
    const photoBlobs = []; // Store JPG blobs for file input

    // Upload each photo
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      
      // Get photo URL (handle both string URLs and object with preview property)
      const photoUrl = typeof photo === 'string' ? photo : (photo.preview || photo.url);
      
      if (!photoUrl) {
        console.warn(`⚠️ [PHOTO UPLOAD ${i + 1}/${photos.length}] Photo has no URL, skipping`);
        continue;
      }

      try {
        console.log(`📥 [PHOTO UPLOAD ${i + 1}/${photos.length}] Fetching image from: ${photoUrl.substring(0, 50)}...`);
        // Fetch the image
        const imageResponse = await fetch(photoUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }

        const imageBlob = await imageResponse.blob();
        console.log(`✅ [PHOTO UPLOAD ${i + 1}/${photos.length}] Image fetched (${(imageBlob.size / 1024).toFixed(2)} KB)`);
        // Convert image to JPG format using Canvas API (Mercari requires .jpg)
        const img = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = URL.createObjectURL(imageBlob);
        });

        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Convert canvas to JPG Blob
        const jpgBlob = await new Promise((resolve) => {
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.95); // 95% quality
        });

        // Clean up object URL
        URL.revokeObjectURL(img.src);
        console.log(`✅ [PHOTO UPLOAD ${i + 1}/${photos.length}] Converted to JPG (${(jpgBlob.size / 1024).toFixed(2)} KB)`);
        
        // Store blob for file input
        photoBlobs.push(jpgBlob);

        // Create FormData
        const formData = new FormData();

        // GraphQL operation - matching Mercari's exact format
        const operations = {
          operationName: "uploadTempListingPhotos",
          variables: {
            input: {
              photos: [null]
            }
          },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: "9aa889ac01e549a01c66c7baabc968b0e4a7fa4cd0b6bd32b7599ce10ca09a10"
            }
          }
        };

        // Map file to operation
        const map = {
          "1": ["variables.input.photos.0"]
        };

        formData.append('operations', JSON.stringify(operations));
        formData.append('map', JSON.stringify(map));
        // Mercari expects filename to be "blob" in the FormData, and file must be .jpg
        formData.append('1', jpgBlob, 'blob');

        // Build headers - use headers from loadHeadersFromStorage (mercariHeaders)
        // Start with headers loaded from storage (captured by background script's webRequest API)
        const fetchHeaders = { ...mercariHeaders };
        
        console.log(`📡 [PHOTO UPLOAD ${i + 1}/${photos.length}] Using headers from storage (${Object.keys(fetchHeaders).length} headers)`);
        
        // Remove content-type if present (browser will set it with boundary for FormData)
        delete fetchHeaders['content-type'];
        
        // Log the complete request with all headers and parameters
        console.log(`📤 [PHOTO UPLOAD ${i + 1}/${photos.length}] Uploading to Mercari API...`);
        console.log(`📋 [PHOTO UPLOAD ${i + 1}/${photos.length}] Request URL: https://www.mercari.com/v1/api`);
        console.log(`📋 [PHOTO UPLOAD ${i + 1}/${photos.length}] Request Method: POST`);
        console.log(`📋 [PHOTO UPLOAD ${i + 1}/${photos.length}] Request Headers (${Object.keys(fetchHeaders).length}):`, fetchHeaders);
        console.log(`📋 [PHOTO UPLOAD ${i + 1}/${photos.length}] Operations:`, JSON.stringify(operations, null, 2));
        console.log(`📋 [PHOTO UPLOAD ${i + 1}/${photos.length}] Map:`, JSON.stringify(map, null, 2));
        console.log(`📋 [PHOTO UPLOAD ${i + 1}/${photos.length}] File: blob (${(jpgBlob.size / 1024).toFixed(2)} KB, type: image/jpeg)`);
        console.log(`📋 [PHOTO UPLOAD ${i + 1}/${photos.length}] Referrer: https://www.mercari.com/sell/`);
        console.log(`📋 [PHOTO UPLOAD ${i + 1}/${photos.length}] Mode: cors`);
        console.log(`📋 [PHOTO UPLOAD ${i + 1}/${photos.length}] Credentials: include`);
        
        // Make fetch request with ALL headers included
        const response = await fetch('https://www.mercari.com/v1/api', {
          method: 'POST',
          headers: fetchHeaders,
          referrer: 'https://www.mercari.com/sell/',
          mode: 'cors',
          credentials: 'include',
          body: formData
        });

        console.log(`📥 [PHOTO UPLOAD ${i + 1}/${photos.length}] Response received:`);
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [PHOTO UPLOAD ${i + 1}/${photos.length}] Upload failed: ${response.status} ${response.statusText}`);
          console.error(`   Error text: ${errorText.substring(0, 500)}`);
          
          // If CSRF error, reload headers from storage and retry
          if ((response.status === 403 || response.status === 401) && errorText.includes('csrf')) {
            console.log('🔄 [PHOTO UPLOAD] CSRF error detected, reloading headers from storage and retrying...');
            // Wait a moment for headers to be updated
            await sleep(1000);
            
            // Reload headers from storage
            let retryHeaders = null;
            await new Promise((resolve) => {
              safeChromeStorageGet(['mercariApiHeaders'], (result) => {
                if (result && result.mercariApiHeaders) {
                  retryHeaders = { ...result.mercariApiHeaders };
                  delete retryHeaders['content-type'];
                  console.log(`📡 [PHOTO UPLOAD] Reloaded headers from storage for retry`);
                }
                resolve();
              });
            });
            
            if (retryHeaders && retryHeaders['x-csrf-token']) {
              console.log(`📤 [PHOTO UPLOAD ${i + 1}/${photos.length}] Retrying with updated headers...`);
              const retryResponse = await fetch('https://www.mercari.com/v1/api', {
                method: 'POST',
                headers: retryHeaders,
                referrer: 'https://www.mercari.com/sell/',
                mode: 'cors',
                credentials: 'include',
                body: formData
              });
              
              console.log(`📥 [PHOTO UPLOAD ${i + 1}/${photos.length}] Retry response: ${retryResponse.status} ${retryResponse.statusText}`);
              
              if (retryResponse.ok) {
                const retryResult = await retryResponse.json();
                if (retryResult.data?.uploadTempListingPhotos?.uploadIds?.[0]) {
                  const uploadId = retryResult.data.uploadTempListingPhotos.uploadIds[0];
                  uploadIds.push(uploadId);
                  console.log(`✅ [PHOTO UPLOAD ${i + 1}/${photos.length}] Uploaded successfully after retry! Upload ID: ${uploadId}`);
                  
                  // Make kandoSuggestQuery request right after successful retry upload
                  try {
                    console.log(`🤖 [KANDO SUGGEST ${i + 1}/${photos.length}] Making kandoSuggestQuery request after retry...`);
                    
                    // Use the retry headers we already have
                    const kandoFormData = new FormData();
                    const kandoOperations = {
                      operationName: "kandoSuggestQuery",
                      variables: {
                        input: {
                          photoId: uploadId,
                          photo: null
                        }
                      },
                      extensions: {
                        persistedQuery: {
                          version: 1,
                          sha256Hash: "5311dbb78d8a2b30d218c0a1899d7b9948a4f3ee1ddd5fbd9807595c30109980"
                        }
                      }
                    };
                    const kandoMap = { "1": ["variables.input.photo"] };
                    kandoFormData.append('operations', JSON.stringify(kandoOperations));
                    kandoFormData.append('map', JSON.stringify(kandoMap));
                    kandoFormData.append('1', jpgBlob, 'blob');
                    
                    const kandoResponse = await fetch('https://www.mercari.com/v1/api', {
                      method: 'POST',
                      headers: retryHeaders,
                      referrer: 'https://www.mercari.com/sell/',
                      mode: 'cors',
                      credentials: 'include',
                      body: kandoFormData
                    });
                    
                    console.log(`📥 [KANDO SUGGEST ${i + 1}/${photos.length}] Response: ${kandoResponse.status} ${kandoResponse.statusText}`);
                    
                    if (kandoResponse.ok) {
                      const kandoResult = await kandoResponse.json();
                      console.log(`✅ [KANDO SUGGEST ${i + 1}/${photos.length}] Success:`, kandoResult);
                    } else {
                      const kandoErrorText = await kandoResponse.text();
                      console.warn(`⚠️ [KANDO SUGGEST ${i + 1}/${photos.length}] Failed: ${kandoResponse.status} - ${kandoErrorText.substring(0, 200)}`);
                    }
                  } catch (kandoError) {
                    console.warn(`⚠️ [KANDO SUGGEST ${i + 1}/${photos.length}] Error:`, kandoError);
                    // Don't fail the upload if kandoSuggestQuery fails
                  }
                  
                  continue; // Skip to next photo
                }
              }
            }
          }
          
          throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
        }

        const result = await response.json();
        console.log(`📋 [PHOTO UPLOAD ${i + 1}/${photos.length}] Response data:`, result);

        if (result.data?.uploadTempListingPhotos?.uploadIds?.[0]) {
          const uploadId = result.data.uploadTempListingPhotos.uploadIds[0];
          uploadIds.push(uploadId);
          console.log(`✅ [PHOTO UPLOAD ${i + 1}/${photos.length}] Uploaded successfully! Upload ID: ${uploadId}`);
          
          // Make kandoSuggestQuery request right after successful upload
          try {
            console.log(`🤖 [KANDO SUGGEST ${i + 1}/${photos.length}] Making kandoSuggestQuery request...`);
            
            // Reload headers from storage to ensure we have the latest
            let kandoHeaders = null;
            await new Promise((resolve) => {
              safeChromeStorageGet(['mercariApiHeaders'], (result) => {
                if (result && result.mercariApiHeaders) {
                  kandoHeaders = { ...result.mercariApiHeaders };
                  delete kandoHeaders['content-type'];
                }
                resolve();
              });
            });
            
            if (!kandoHeaders || Object.keys(kandoHeaders).length === 0) {
              console.warn(`⚠️ [KANDO SUGGEST ${i + 1}/${photos.length}] No headers found, skipping kandoSuggestQuery`);
            } else {
              const kandoFormData = new FormData();
              const kandoOperations = {
                operationName: "kandoSuggestQuery",
                variables: {
                  input: {
                    photoId: uploadId,
                    photo: null
                  }
                },
                extensions: {
                  persistedQuery: {
                    version: 1,
                    sha256Hash: "5311dbb78d8a2b30d218c0a1899d7b9948a4f3ee1ddd5fbd9807595c30109980"
                  }
                }
              };
              const kandoMap = { "1": ["variables.input.photo"] };
              kandoFormData.append('operations', JSON.stringify(kandoOperations));
              kandoFormData.append('map', JSON.stringify(kandoMap));
              kandoFormData.append('1', jpgBlob, 'blob');
              
              console.log(`📋 [KANDO SUGGEST ${i + 1}/${photos.length}] Request URL: https://www.mercari.com/v1/api`);
              console.log(`📋 [KANDO SUGGEST ${i + 1}/${photos.length}] Operations:`, JSON.stringify(kandoOperations, null, 2));
              console.log(`📋 [KANDO SUGGEST ${i + 1}/${photos.length}] Map:`, JSON.stringify(kandoMap, null, 2));
              
              const kandoResponse = await fetch('https://www.mercari.com/v1/api', {
                method: 'POST',
                headers: kandoHeaders,
                referrer: 'https://www.mercari.com/sell/',
                mode: 'cors',
                credentials: 'include',
                body: kandoFormData
              });
              
              console.log(`📥 [KANDO SUGGEST ${i + 1}/${photos.length}] Response: ${kandoResponse.status} ${kandoResponse.statusText}`);
              
              if (kandoResponse.ok) {
                const kandoResult = await kandoResponse.json();
                console.log(`✅ [KANDO SUGGEST ${i + 1}/${photos.length}] Success:`, kandoResult);
              } else {
                const kandoErrorText = await kandoResponse.text();
                console.warn(`⚠️ [KANDO SUGGEST ${i + 1}/${photos.length}] Failed: ${kandoResponse.status} - ${kandoErrorText.substring(0, 200)}`);
              }
            }
          } catch (kandoError) {
            console.warn(`⚠️ [KANDO SUGGEST ${i + 1}/${photos.length}] Error:`, kandoError);
            // Don't fail the upload if kandoSuggestQuery fails
          }
        } else {
          console.error(`❌ [PHOTO UPLOAD ${i + 1}/${photos.length}] Unexpected response:`, result);
          throw new Error('No uploadId in response: ' + JSON.stringify(result));
        }

        // Small delay between uploads - minimal wait
        if (i < photos.length - 1) {
          console.log(`⏳ [PHOTO UPLOAD] Waiting 50ms before next upload...`);
          await sleep(50); // Reduced from 100ms for faster uploads
        }

      } catch (error) {
        console.error(`❌ [PHOTO UPLOAD ${i + 1}/${photos.length}] Error:`, error);
        // Continue with next photo instead of failing completely
        console.warn(`⚠️ [PHOTO UPLOAD ${i + 1}/${photos.length}] Skipping this photo and continuing...`);
      }
    }

    // Store uploadIds in window for form submission
    window.__mercariUploadIds = uploadIds;
    console.log(`✅ [PHOTO UPLOAD] All ${uploadIds.length} photo(s) uploaded successfully!`);
    console.log(`📋 [PHOTO UPLOAD] Upload IDs stored: ${uploadIds.join(', ')}`);

    // Make sellQuery request after all photos are uploaded
    if (uploadIds.length > 0) {
      try {
        console.log(`📋 [SELL QUERY] Making sellQuery request with ${uploadIds.length} photo ID(s)...`);
        
        // Reload headers from storage to ensure we have the latest
        let sellQueryHeaders = null;
        await new Promise((resolve) => {
          safeChromeStorageGet(['mercariApiHeaders'], (result) => {
            if (result && result.mercariApiHeaders) {
              sellQueryHeaders = { ...result.mercariApiHeaders };
              // Set content-type to application/json for GET request
              sellQueryHeaders['content-type'] = 'application/json';
            }
            resolve();
          });
        });
        
        if (!sellQueryHeaders || Object.keys(sellQueryHeaders).length === 0) {
          console.warn(`⚠️ [SELL QUERY] No headers found, skipping sellQuery`);
        } else {
          // Build query parameters
          const variables = {
            sellInput: {
              shippingPayerId: 2,
              photoIds: uploadIds
            },
            shouldFetchSuggestedPrice: true,
            includeSuggestedShippingOptions: false
          };
          
          const extensions = {
            persistedQuery: {
              version: 1,
              sha256Hash: "563d5747ce3413a076648387bb173b383ba91fd31fc933ddf561d5eb37b4a1a5"
            }
          };
          
          const queryParams = new URLSearchParams({
            operationName: "sellQuery",
            variables: JSON.stringify(variables),
            extensions: JSON.stringify(extensions)
          });
          
          const sellQueryUrl = `https://www.mercari.com/v1/api?${queryParams.toString()}`;
          
          console.log(`📋 [SELL QUERY] Request URL: ${sellQueryUrl}`);
          console.log(`📋 [SELL QUERY] Variables:`, JSON.stringify(variables, null, 2));
          
          const sellQueryResponse = await fetch(sellQueryUrl, {
            method: 'GET',
            headers: sellQueryHeaders,
            referrer: 'https://www.mercari.com/sell/',
            mode: 'cors',
            credentials: 'include'
          });
          
          console.log(`📥 [SELL QUERY] Response: ${sellQueryResponse.status} ${sellQueryResponse.statusText}`);
          
          if (sellQueryResponse.ok) {
            const sellQueryResult = await sellQueryResponse.json();
            console.log(`✅ [SELL QUERY] Success:`, sellQueryResult);
          } else {
            const sellQueryErrorText = await sellQueryResponse.text();
            console.warn(`⚠️ [SELL QUERY] Failed: ${sellQueryResponse.status} - ${sellQueryErrorText.substring(0, 200)}`);
          }
        }
      } catch (sellQueryError) {
        console.warn(`⚠️ [SELL QUERY] Error:`, sellQueryError);
        // Don't fail the upload if sellQuery fails
      }
    }

    // Set uploaded photos to file input and trigger change event
    if (photoBlobs.length > 0) {
      try {
        console.log(`📁 [FILE INPUT] Setting ${photoBlobs.length} photo(s) to file input...`);
        
        // Ensure the photo uploader UI is opened (reveals file input)
        await ensureMercariPhotoUploaderOpen();

        // Find the file input element (try multiple selectors)
        const fileInput =
          document.querySelector('input[data-testid="SellPhotoInput"]') ||
          document.querySelector('input[type="file"][accept*="image"]') ||
          document.querySelector('input[type="file"]');
        
        if (!fileInput) {
          console.warn(`⚠️ [FILE INPUT] File input not found (SellPhotoInput / input[type=file])`);
        } else {
          // Create a DataTransfer object to hold the files
          const dataTransfer = new DataTransfer();
          
          // Add each blob as a file to the DataTransfer
          photoBlobs.slice(0, 12).forEach((blob, index) => {
            // Create a File object from the blob with a proper name
            const file = new File([blob], `photo-${index + 1}.jpg`, { type: 'image/jpeg' });
            dataTransfer.items.add(file);
          });
          
          // Set the files to the input
          fileInput.files = dataTransfer.files;
          
          console.log(`✅ [FILE INPUT] Set ${fileInput.files.length} file(s) to input`);
          
          // Trigger change event
          const changeEvent = new Event('change', { bubbles: true, cancelable: true });
          fileInput.dispatchEvent(changeEvent);
          
          console.log(`✅ [FILE INPUT] Change event triggered`);

          // Wait for thumbnails to appear so submit validation sees photos
          for (let attempt = 0; attempt < 20; attempt++) {
            const count =
              document.querySelectorAll('[data-testid="Photo"]').length ||
              document.querySelectorAll('img[src^="blob:"]').length;
            if (count > 0) break;
            await sleep(250);
          }
        }
      } catch (fileInputError) {
        console.warn(`⚠️ [FILE INPUT] Error setting files to input:`, fileInputError);
        // Don't fail the upload if file input fails
      }
    }

    return { success: true, uploadIds };

  } catch (error) {
    console.error('❌ [PHOTO UPLOAD] Fatal error:', error);
    return { success: false, error: error.message };
  }
}

// Fill Mercari form fields
async function fillMercariForm(data) {
  try {
    console.log('📝 [FORM FILL] Starting to fill form fields...');
    // Wrap entire form fill in try-catch to prevent errors from stopping the process
    // 1. TITLE - Set immediately, no wait needed
    console.log(`📝 [FORM FILL] Setting title: "${data.title}"`);
    const titleInput = document.querySelector('[data-testid="Title"]') || 
                      document.querySelector('#sellName');
    if (titleInput && data.title) {
      titleInput.value = data.title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`✅ [FORM FILL] Title set`);
    }
    
    // 2. DESCRIPTION - Set immediately, no wait needed
    console.log(`📝 [FORM FILL] Setting description...`);
    const descInput = document.querySelector('[data-testid="Description"]') ||
                     document.querySelector('#sellDescription');
    if (descInput && data.description) {
      descInput.value = data.description;
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
      descInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`✅ [FORM FILL] Description set`);
    }
    
    // 3. CATEGORY - Mercari-specific category (multi-level selection)
    if (data.mercariCategory) {
      console.log(`📝 [FORM FILL] Setting category: "${data.mercariCategory}"`);
      // Split category path by " > " to get individual levels
      const categoryParts = data.mercariCategory.split(' > ').map(part => part.trim());
      
      let categorySuccess = false;
      
      // Select each level sequentially
      for (let level = 0; level < categoryParts.length; level++) {
        const categoryPart = categoryParts[level];
        
        // Try multiple testId patterns - Mercari might reuse CategoryL0 or use CategoryL1, CategoryL2, etc.
        const possibleTestIds = level === 0 
          ? ['CategoryL0'] 
          : [`CategoryL${level}`, 'CategoryL0', `CategoryL${level - 1}`]; // Try level-specific first, then fallback
        
        let success = false;
        let usedTestId = null;
        
        // Try each possible testId
        for (const testId of possibleTestIds) {
          // Try exact match first
          success = await selectMercariDropdown(testId, categoryPart, false);
          
          if (!success) {
            // Try partial match
            success = await selectMercariDropdown(testId, categoryPart, true);
          }
          
          if (success) {
            usedTestId = testId;
            break; // Found it, stop trying other testIds
          }
        }
        
        if (success) {
          // Wait for next level dropdown to appear (if not the last level) - optimized wait
          if (level < categoryParts.length - 1) {
            await sleep(300); // Reduced from 1000ms - Mercari loads quickly
            // Check if any category dropdown is available for next level
            const nextLevelTestId = `CategoryL${level + 1}`;
            let nextDropdown = document.querySelector(`[data-testid="${nextLevelTestId}"]`);
            if (!nextDropdown) {
              // Try to find any category dropdown that might be the next level
              nextDropdown = document.querySelector('[data-testid*="Category"]') ||
                           document.querySelector('[aria-haspopup="listbox"][id*="category"]');
              if (!nextDropdown) {
                await sleep(300); // Reduced from 1000ms
              }
            }
          } else {
            // Last level selected successfully
            categorySuccess = true;
          }
        } else {
          break; // Stop if any level fails
        }
      }
      
      // Category selection completed (or failed silently)
    }
    
    // 4. BRAND
    if (data.brand) {
      await setMercariBrand(data.brand);
    }
    
    // 5. CONDITION
    if (data.condition) {
      console.log(`📝 [FORM FILL] Setting condition: "${data.condition}"`);
      // Map condition values to Mercari's expected format
      const conditionMap = {
        'New': 'New',
        'Like New': 'Like New',
        'Good': 'Good',
        'Fair': 'Fair',
        'Poor': 'Poor',
        // Also handle general form conditions
        'New With Tags/Box': 'New',
        'New Without Tags/Box': 'Like New',
        'Pre - Owned - Excellent': 'Like New',
        'Pre - Owned - Good': 'Good',
        'Pre - Owned - Fair': 'Fair',
        'Poor (Major flaws)': 'Poor',
        // Additional variations
        'Excellent': 'Like New',
        'Very Good': 'Good',
        'Acceptable': 'Fair',
        'Damaged': 'Poor',
      };
      
      const mercariCondition = conditionMap[data.condition] || data.condition;
      let conditionSuccess = false;
      
      // Try exact match first
      conditionSuccess = await selectMercariDropdown('Condition', mercariCondition, false);
      
      // If exact match failed, try partial match
      if (!conditionSuccess) {
        conditionSuccess = await selectMercariDropdown('Condition', mercariCondition, true);
      }
      
      // Try common Mercari condition variations
      if (!conditionSuccess) {
        const conditionVariations = [
          mercariCondition,
          mercariCondition.toLowerCase(),
          mercariCondition.toUpperCase(),
          mercariCondition.charAt(0).toUpperCase() + mercariCondition.slice(1).toLowerCase()
        ];
        
        for (const variation of conditionVariations) {
          if (variation !== mercariCondition) {
            conditionSuccess = await selectMercariDropdown('Condition', variation, true);
            if (conditionSuccess) break;
          }
        }
      }
    }
    
    // 6. COLOR (if available)
    if (data.color) {
      await selectMercariDropdown('Color', data.color, false);
    }
    
    // 7. SIZE (text input) - Set immediately, no wait needed
    if (data.size) {
      const sizeInput = document.querySelector('[data-testid="Size"]') ||
                        document.querySelector('input[name*="size" i]');
      if (sizeInput) {
        sizeInput.value = data.size;
        sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    
    // 8. SHIPS FROM (zip code) - Optimized waits
    if (data.shipsFrom) {
      // User may need to click Edit button first
      const editShipsFromBtn = document.querySelector('[data-testid="ShipsFromEditButton"]');
      if (editShipsFromBtn) {
        editShipsFromBtn.click();
        await sleep(200); // Reduced from 500ms
      }
      
      const zipInput = document.querySelector('input[name*="zip" i]') ||
                       document.querySelector('input[placeholder*="zip" i]');
      if (zipInput) {
        zipInput.value = data.shipsFrom;
        zipInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    
    // 9. DELIVERY METHOD
    if (data.deliveryMethod) {
      const deliveryText = data.deliveryMethod === 'prepaid' ? 'Prepaid' : 'Ship on your own';
      await selectMercariDropdown('ShippingMethod', deliveryText, true);
    }
    
    // 10. PRICE (do this last as it often triggers validation) - Optimized wait
    console.log(`📝 [FORM FILL] Setting price: $${data.price}`);
    const priceInput = document.querySelector('[data-testid="Price"]') ||
                      document.querySelector('#Price') ||
                      document.querySelector('[name="sellPrice"]');
    if (priceInput && data.price) {
      priceInput.value = String(data.price);
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      priceInput.dispatchEvent(new Event('blur', { bubbles: true }));
      await sleep(200); // Reduced from 500ms
      console.log(`✅ [FORM FILL] Price set`);
    }
    
    // 10.5. SMART PRICING & SMART OFFERS (after price is set) - Optimized wait
    if (data.smartPricing !== undefined || data.smartOffers !== undefined) {
      await sleep(300); // Reduced from 1000ms - toggles appear quickly
      
      // Smart Pricing toggle
      if (data.smartPricing !== undefined) {
        try {
          // Use the exact Mercari selector: data-testid="SmartPricingButton"
          let smartPricingToggle = document.querySelector('[data-testid="SmartPricingButton"]');
          
          if (smartPricingToggle) {
            // Check current state using aria-pressed (ON = "true", OFF = "false")
            const isChecked = smartPricingToggle.getAttribute('aria-pressed') === 'true';
            
            // Only toggle if state doesn't match desired state
            if (data.smartPricing !== isChecked) {
              smartPricingToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await sleep(50); // Reduced from 200ms
              smartPricingToggle.click();
              await sleep(200); // Reduced from 500ms - UI updates quickly
              
              // If enabling Smart Pricing, look for Floor Price input
              if (data.smartPricing && data.floorPrice) {
                await sleep(200); // Reduced from 500ms - input appears quickly
                
                // Use exact Mercari selectors for Floor Price
                let floorPriceInput = document.querySelector('[data-testid="SmartPricingFloorPrice"]') ||
                                     document.querySelector('#sellMinPriceForAutoPriceDrop') ||
                                     document.querySelector('input[placeholder*="floor" i]') ||
                                     document.querySelector('input[name*="floor" i]');
                
                if (floorPriceInput) {
                  floorPriceInput.focus();
                  floorPriceInput.value = String(data.floorPrice);
                  floorPriceInput.dispatchEvent(new Event('input', { bubbles: true }));
                  floorPriceInput.dispatchEvent(new Event('change', { bubbles: true }));
                  // No wait needed
                }
              }
            }
          }
        } catch (error) {
          // Silently continue if Smart Pricing fails
        }
      }
      
      // Smart Offers toggle
      if (data.smartOffers !== undefined) {
        try {
          // Try multiple selectors for Smart Offers toggle
          let smartOffersToggle = document.querySelector('[data-testid*="SmartOffers" i]') ||
                                 document.querySelector('[data-testid*="smart" i][data-testid*="offers" i]') ||
                                 document.querySelector('input[type="checkbox"][name*="smart" i][name*="offers" i]') ||
                                 document.querySelector('input[type="checkbox"][aria-label*="Smart Offers" i]') ||
                                 document.querySelector('button[aria-label*="Smart Offers" i]');
          
          // Try finding by text content - search more broadly
          if (!smartOffersToggle) {
            const allElements = Array.from(document.querySelectorAll('*'));
            const offersElement = allElements.find(el => {
              const text = el.textContent?.toLowerCase() || '';
              return text.includes('smart offers') && 
                     (el.tagName === 'LABEL' || el.tagName === 'SPAN' || el.tagName === 'DIV');
            });
            
            if (offersElement) {
              // Look for toggle near the text
              const container = offersElement.closest('div, label, form');
              if (container) {
                smartOffersToggle = container.querySelector('input[type="checkbox"], button, [role="switch"], [role="button"]') ||
                                   container.querySelector('[data-testid*="toggle"], [data-testid*="switch"]');
              }
              
              // Also try sibling elements
              if (!smartOffersToggle) {
                let sibling = offersElement.nextElementSibling;
                for (let i = 0; i < 3 && sibling; i++) {
                  smartOffersToggle = sibling.querySelector('input[type="checkbox"], button, [role="switch"]');
                  if (smartOffersToggle) break;
                  sibling = sibling.nextElementSibling;
                }
              }
            }
          }
          
          if (smartOffersToggle) {
            const isChecked = smartOffersToggle.checked || 
                            smartOffersToggle.getAttribute('aria-checked') === 'true' ||
                            smartOffersToggle.classList.contains('checked') ||
                            smartOffersToggle.getAttribute('aria-pressed') === 'true' ||
                            smartOffersToggle.getAttribute('data-state') === 'checked';
            
            if (data.smartOffers !== isChecked) {
              smartOffersToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await sleep(200);
              smartOffersToggle.click();
              await sleep(500); // Wait for toggle to activate and UI to update
              
              // If enabling Smart Offers, look for Minimum Price input
              if (data.smartOffers && data.minimumPrice) {
                await sleep(500); // Wait for input field to appear
                
                // Try to find minimum price input
                let minimumPriceInput = document.querySelector('input[placeholder*="minimum" i]') ||
                                     document.querySelector('input[placeholder*="lowest" i]') ||
                                     document.querySelector('input[name*="minimum" i]') ||
                                     document.querySelector('input[name*="min" i]') ||
                                     document.querySelector('[data-testid*="Minimum" i]') ||
                                     document.querySelector('[data-testid*="minimum" i]');
                
                // Try finding by label text
                if (!minimumPriceInput) {
                  const labels = Array.from(document.querySelectorAll('label, span, div'));
                  const minLabel = labels.find(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    return (text.includes('minimum') || text.includes('lowest')) && text.includes('price');
                  });
                  
                  if (minLabel) {
                    const container = minLabel.closest('div, form');
                    if (container) {
                      minimumPriceInput = container.querySelector('input[type="text"], input[type="number"]');
                    }
                  }
                }
                
                if (minimumPriceInput) {
                  minimumPriceInput.focus();
                  minimumPriceInput.value = String(data.minimumPrice);
                  minimumPriceInput.dispatchEvent(new Event('input', { bubbles: true }));
                  minimumPriceInput.dispatchEvent(new Event('change', { bubbles: true }));
                  await sleep(300);
                }
              }
            }
          }
        } catch (error) {
          // Silently continue if Smart Offers fails
        }
      }
    }
    
    // 11. PHOTOS - Uploaded via uploadMercariPhotos() function before form submission
    
    console.log('✅ [FORM FILL] All form fields filled successfully!');
    return true;
    
  } catch (error) {
    console.error('Error filling form:', error);
    throw error;
  }
}

// Helper: Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ensure Mercari's sell photo uploader UI is open (reveals the file input).
async function ensureMercariPhotoUploaderOpen() {
  // If the input is already present, we’re done.
  const existing =
    document.querySelector('input[data-testid="SellPhotoInput"]') ||
    document.querySelector('input[type="file"][accept*="image"]') ||
    document.querySelector('input[type="file"]');
  if (existing) return true;

  const candidates = [];
  candidates.push(...Array.from(document.querySelectorAll('button')));
  candidates.push(...Array.from(document.querySelectorAll('[role="button"]')));
  candidates.push(...Array.from(document.querySelectorAll('label')));
  candidates.push(...Array.from(document.querySelectorAll('div')));

  const matchText = (el) => {
    const t = (el?.textContent || '').trim().toLowerCase();
    if (!t) return false;
    if (t.includes('add up to') && t.includes('photos')) return true;
    if (t.includes('drag and drop') && t.includes('photos')) return true;
    if (t.includes('add photos')) return true;
    if (t.includes('add photo')) return true;
    return false;
  };

  const clickable = candidates.find((el) => matchText(el) && el.offsetParent !== null);
  if (clickable) {
    clickable.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(100);
    try {
      clickable.click();
    } catch (_) {
      // ignore
    }
    await sleep(250);
  }

  const after =
    document.querySelector('input[data-testid="SellPhotoInput"]') ||
    document.querySelector('input[type="file"][accept*="image"]') ||
    document.querySelector('input[type="file"]');
  return !!after;
}

// Submit Mercari form
// Helper function to set brand (reusable)
async function setMercariBrand(brand) {
  if (!brand) return false;
  
  console.log(`📝 [BRAND] Setting brand: "${brand}"`);
  
  // First, find the brand dropdown element
  let brandDropdown = document.querySelector('[data-testid="Brand"]');
  console.log(`🔍 [BRAND] Brand dropdown found:`, brandDropdown ? 'Yes' : 'No');
  
  if (!brandDropdown) {
    // Try alternative selectors
    brandDropdown = document.querySelector('[data-testid*="Brand" i]') ||
                    document.querySelector('[data-testid*="brand" i]');
    console.log(`🔍 [BRAND] Brand dropdown (alternative):`, brandDropdown ? 'Yes' : 'No');
  }
  
  if (!brandDropdown) {
    console.error(`❌ [BRAND] Brand dropdown not found on page`);
    return false;
  }
  
  // Log current state
  const currentValue = brandDropdown.textContent?.trim() || brandDropdown.value?.trim() || '';
  console.log(`📋 [BRAND] Current brand value: "${currentValue}"`);
  console.log(`📋 [BRAND] Dropdown element:`, brandDropdown);
  console.log(`📋 [BRAND] Dropdown classes:`, brandDropdown.className);
  console.log(`📋 [BRAND] Dropdown attributes:`, Array.from(brandDropdown.attributes).map(a => `${a.name}="${a.value}"`).join(', '));
  
  let brandSuccess = false;
  
  // Try multiple approaches - but stop as soon as one succeeds
  // Brand selection needs more time than other fields due to search/autocomplete
  
  // 1. Try typing first (Mercari brand is searchable) - give it more time
  console.log(`🔍 [BRAND] Attempting method 1: typeIntoMercariDropdown`);
  brandSuccess = await typeIntoMercariDropdown('Brand', brand);
  console.log(`📋 [BRAND] Method 1 result:`, brandSuccess ? 'Success' : 'Failed');
  
  // Verify after method 1
  if (brandSuccess) {
    await sleep(500); // Wait for UI to update
    const brandDropdownAfter = document.querySelector('[data-testid="Brand"]');
    const newValue = brandDropdownAfter?.textContent?.trim() || brandDropdownAfter?.value?.trim() || '';
    if (newValue && newValue !== 'Select brand' && newValue !== 'Brand' && newValue.length > 1 && 
        (newValue.toLowerCase().includes(brand.toLowerCase()) || brand.toLowerCase().includes(newValue.toLowerCase()))) {
      console.log(`✅ [BRAND] Brand set successfully via typing: "${brand}" -> "${newValue}"`);
      return true;
    } else {
      console.log(`⚠️ [BRAND] Method 1 reported success but value doesn't match, trying method 2...`);
      brandSuccess = false; // Reset to try next method
    }
  }
  
  if (!brandSuccess) {
    // 2. If typing failed, try dropdown selection with exact match
    console.log(`🔍 [BRAND] Attempting method 2: selectMercariDropdown (exact match)`);
    brandSuccess = await selectMercariDropdown('Brand', brand, false);
    console.log(`📋 [BRAND] Method 2 result:`, brandSuccess ? 'Success' : 'Failed');
    
    // Verify after method 2
    if (brandSuccess) {
      await sleep(500);
      const brandDropdownAfter = document.querySelector('[data-testid="Brand"]');
      const newValue = brandDropdownAfter?.textContent?.trim() || brandDropdownAfter?.value?.trim() || '';
      if (newValue && newValue !== 'Select brand' && newValue !== 'Brand' && newValue.length > 1) {
        console.log(`✅ [BRAND] Brand set successfully via exact match: "${brand}" -> "${newValue}"`);
        return true;
      } else {
        brandSuccess = false;
      }
    }
    
    if (!brandSuccess) {
      // 3. If exact match failed, try partial match
      console.log(`🔍 [BRAND] Attempting method 3: selectMercariDropdown (partial match)`);
      brandSuccess = await selectMercariDropdown('Brand', brand, true);
      console.log(`📋 [BRAND] Method 3 result:`, brandSuccess ? 'Success' : 'Failed');
      
      // Verify after method 3
      if (brandSuccess) {
        await sleep(500);
        const brandDropdownAfter = document.querySelector('[data-testid="Brand"]');
        const newValue = brandDropdownAfter?.textContent?.trim() || brandDropdownAfter?.value?.trim() || '';
        if (newValue && newValue !== 'Select brand' && newValue !== 'Brand' && newValue.length > 1) {
          console.log(`✅ [BRAND] Brand set successfully via partial match: "${brand}" -> "${newValue}"`);
          return true;
        } else {
          brandSuccess = false;
        }
      }
      
      if (!brandSuccess && brand.includes(' ')) {
        // 4. Try with just the first word if brand has multiple words
        const firstWord = brand.split(' ')[0];
        console.log(`🔍 [BRAND] Attempting method 4: selectMercariDropdown (first word: "${firstWord}")`);
        brandSuccess = await selectMercariDropdown('Brand', firstWord, true);
        console.log(`📋 [BRAND] Method 4 result:`, brandSuccess ? 'Success' : 'Failed');
        
        // Verify after method 4
        if (brandSuccess) {
          await sleep(500);
          const brandDropdownAfter = document.querySelector('[data-testid="Brand"]');
          const newValue = brandDropdownAfter?.textContent?.trim() || brandDropdownAfter?.value?.trim() || '';
          if (newValue && newValue !== 'Select brand' && newValue !== 'Brand' && newValue.length > 1) {
            console.log(`✅ [BRAND] Brand set successfully via first word: "${brand}" -> "${newValue}"`);
            return true;
          } else {
            brandSuccess = false;
          }
        }
      }
    }
  }
  
  // Final verification
  if (brandSuccess) {
    await sleep(500); // Wait for UI to update
    const brandDropdownAfter = document.querySelector('[data-testid="Brand"]');
    const newValue = brandDropdownAfter?.textContent?.trim() || brandDropdownAfter?.value?.trim() || '';
    console.log(`📋 [BRAND] Brand value after setting: "${newValue}"`);
    
    // Check if it actually changed
    if (newValue && newValue !== 'Select brand' && newValue !== 'Brand' && newValue.length > 1) {
      console.log(`✅ [BRAND] Brand set successfully: "${brand}" -> "${newValue}"`);
      return true;
    } else {
      console.warn(`⚠️ [BRAND] Brand setting reported success but value is still: "${newValue}"`);
      return false;
    }
  } else {
    // Log warning - brand is important
    console.warn(`⚠️ [BRAND] All methods failed to set brand: "${brand}"`);
    return false;
  }
}

// Helper function to wait for and close popups
async function handleMercariPopups() {
  console.log('🔍 [POPUP] Checking for popups...');
  
  // Common popup selectors in Mercari
  const popupSelectors = [
    '[role="dialog"]',
    '[class*="modal"]',
    '[class*="Modal"]',
    '[class*="popup"]',
    '[class*="Popup"]',
    '[class*="overlay"]',
    '[class*="Overlay"]',
    'div[aria-modal="true"]',
    '[data-testid*="modal"]',
    '[data-testid*="Modal"]',
    '[data-testid*="popup"]',
    '[data-testid*="Popup"]'
  ];
  
  let popupFound = false;
  let popupElement = null;
  
  // Check for existing popups
  for (const selector of popupSelectors) {
    popupElement = document.querySelector(selector);
    if (popupElement && window.getComputedStyle(popupElement).display !== 'none') {
      popupFound = true;
      console.log(`🔍 [POPUP] Found popup with selector: ${selector}`);
      break;
    }
  }
  
  // If no popup found, wait a bit and check again (popup might be appearing)
  if (!popupFound) {
    await sleep(500);
    for (const selector of popupSelectors) {
      popupElement = document.querySelector(selector);
      if (popupElement && window.getComputedStyle(popupElement).display !== 'none') {
        popupFound = true;
        console.log(`🔍 [POPUP] Found popup with selector: ${selector} (after wait)`);
        break;
      }
    }
  }
  
  if (popupFound && popupElement) {
    console.log('🔍 [POPUP] Popup detected, looking for close button...');
    
    // Try to find close button
    const closeButtonSelectors = [
      'button[aria-label*="close" i]',
      'button[aria-label*="Close" i]',
      'button[aria-label*="dismiss" i]',
      '[class*="close"]',
      '[class*="Close"]',
      '[data-testid*="close"]',
      '[data-testid*="Close"]',
      'button:has(svg[class*="close"])',
      'button:has(svg[class*="Close"])'
    ];
    
    let closeButton = null;
    for (const selector of closeButtonSelectors) {
      closeButton = popupElement.querySelector(selector) || document.querySelector(selector);
      if (closeButton) {
        console.log(`✅ [POPUP] Found close button with selector: ${selector}`);
        break;
      }
    }
    
    // If no close button found, try clicking outside or pressing Escape
    if (!closeButton) {
      console.log('⚠️ [POPUP] No close button found, trying Escape key...');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(300);
    } else {
      closeButton.click();
      console.log('✅ [POPUP] Close button clicked');
      await sleep(500);
    }
    
    // Wait for popup to disappear
    let attempts = 0;
    while (attempts < 10) {
      const stillVisible = popupElement && window.getComputedStyle(popupElement).display !== 'none';
      if (!stillVisible) {
        console.log('✅ [POPUP] Popup closed');
        break;
      }
      await sleep(200);
      attempts++;
    }
    
    return true;
  }
  
  return false;
}

// Prevent multiple submissions
let isSubmittingMercariForm = false;

async function submitMercariForm(brandToVerify = null) {
  // Prevent multiple simultaneous submissions
  if (isSubmittingMercariForm) {
    console.warn('⚠️ [FORM SUBMIT] Form submission already in progress, skipping...');
    return {
      success: false,
      error: 'Form submission already in progress'
    };
  }
  
  isSubmittingMercariForm = true;
  
  try {
    console.log('📤 [FORM SUBMIT] Starting form submission...');
    console.log('📋 [FORM SUBMIT] Current URL:', window.location.href);
    console.log('📋 [FORM SUBMIT] Page ready state:', document.readyState);
    
    // Force fresh DOM query (cache-busting) - wait a moment for any pending DOM updates
    await sleep(100);
    
    console.log('📤 [FORM SUBMIT] Looking for List button (fresh query)...');
    // Find the List button using actual Mercari selector - query fresh each time
    const findListButton = () => {
      const byTestId = document.querySelector('[data-testid="ListButton"]');
      if (byTestId) return byTestId;
      // Avoid invalid CSS pseudo selectors (e.g. :contains)
      const buttons = Array.from(document.querySelectorAll('button'));
      const byText = buttons.find((btn) => (btn.textContent || '').trim().toLowerCase() === 'list')
        || buttons.find((btn) => (btn.textContent || '').trim().toLowerCase().includes('list'));
      return byText || document.querySelector('button[type="submit"]');
    };

    const submitBtn = findListButton();
    
    if (!submitBtn) {
      console.error('❌ [FORM SUBMIT] List button not found');
      console.error('📋 [FORM SUBMIT] Available buttons:', Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim(),
        testId: b.getAttribute('data-testid'),
        type: b.type,
        disabled: b.disabled
      })));
      isSubmittingMercariForm = false;
      return {
        success: false,
        error: 'List button not found on page'
      };
    }
    
    console.log('✅ [FORM SUBMIT] List button found');
    console.log('📋 [FORM SUBMIT] Button details:', {
      text: submitBtn.textContent?.trim(),
      testId: submitBtn.getAttribute('data-testid'),
      type: submitBtn.type,
      disabled: submitBtn.disabled,
      visible: submitBtn.offsetParent !== null
    });
    
    // Quick popup check (non-blocking)
    handleMercariPopups().catch(() => {}); // Don't wait for this
    
    // Quick brand verification (only if needed)
    if (brandToVerify) {
      const brandDropdown = document.querySelector('[data-testid="Brand"]');
      const brandValue = brandDropdown?.textContent?.trim() || brandDropdown?.value?.trim() || '';
      
      // Only re-set if brand is actually missing
      if (!brandValue || brandValue === 'Select brand' || brandValue === 'Brand' || brandValue.length < 2) {
        console.log('⚠️ [FORM SUBMIT] Brand missing, re-setting quickly...');
        await setMercariBrand(brandToVerify);
        await sleep(200); // Reduced wait
      }
    }
    
    // Wait for Mercari's form validation to complete and button to become enabled
    // Mercari validates the form asynchronously, so we need to wait
    console.log('⏳ [FORM SUBMIT] Waiting for form validation to complete...');
    let finalSubmitBtn = null;
    let buttonEnabled = false;
    
    // Wait up to 5 seconds for button to become enabled
    for (let waitAttempt = 0; waitAttempt < 10; waitAttempt++) {
      await sleep(500); // Check every 500ms
      
      // Re-fetch button to get latest state
      finalSubmitBtn = findListButton();
      
      if (!finalSubmitBtn) {
        console.warn(`⚠️ [FORM SUBMIT] Button not found (attempt ${waitAttempt + 1}/10)`);
        continue;
      }
      
      // Check if button is enabled
      if (!finalSubmitBtn.disabled && finalSubmitBtn.offsetParent !== null) {
        buttonEnabled = true;
        console.log(`✅ [FORM SUBMIT] Button enabled after ${(waitAttempt + 1) * 500}ms`);
        break;
      }
      
      // Trigger validation by blurring active inputs (helps Mercari validate)
      if (waitAttempt === 2 || waitAttempt === 5) {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT') {
          activeElement.blur();
          activeElement.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        // Also trigger change events on all inputs to help validation
        const allInputs = document.querySelectorAll('input, textarea, select');
        allInputs.forEach(input => {
          if (input.value) {
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
    }
    
    if (!finalSubmitBtn) {
      console.error('❌ [FORM SUBMIT] List button not found after waiting');
      isSubmittingMercariForm = false;
      return {
        success: false,
        error: 'List button not found on page'
      };
    }
    
    // Check if button is enabled (Mercari disables it if form is invalid)
    if (!buttonEnabled && finalSubmitBtn.disabled) {
      console.warn('⚠️ [FORM SUBMIT] List button is disabled - checking form validation...');
      // Try to identify what's missing (fresh queries to avoid cache)
      const titleInput = document.querySelector('[data-testid="Title"]') || document.querySelector('#sellName');
      const descInput = document.querySelector('[data-testid="Description"]') || document.querySelector('#sellDescription');
      const priceInput = document.querySelector('[data-testid="Price"]') || document.querySelector('#Price');
      const categoryDropdown = document.querySelector('[data-testid="CategoryL0"]');
      const conditionDropdown = document.querySelector('[data-testid="Condition"]');
      const brandDropdown = document.querySelector('[data-testid="Brand"]');
      
      const missingFields = [];
      const fieldValues = {};
      
      if (!titleInput?.value) {
        missingFields.push('Title');
      } else {
        fieldValues.title = titleInput.value.substring(0, 50);
      }
      
      if (!descInput?.value) {
        missingFields.push('Description');
      } else {
        fieldValues.description = descInput.value.substring(0, 50);
      }
      
      if (!priceInput?.value) {
        missingFields.push('Price');
      } else {
        fieldValues.price = priceInput.value;
      }
      
      const categoryText = categoryDropdown?.textContent?.trim() || '';
      if (categoryText === 'Select category' || !categoryText || categoryText.length < 3) {
        missingFields.push('Category');
      } else {
        fieldValues.category = categoryText;
      }
      
      const conditionText = conditionDropdown?.textContent?.trim() || '';
      if (conditionText === 'Select condition' || !conditionText || conditionText.length < 3) {
        missingFields.push('Condition');
      } else {
        fieldValues.condition = conditionText;
      }
      
      const brandText = brandDropdown?.textContent?.trim() || brandDropdown?.value?.trim() || '';
      if (!brandText || brandText === 'Select brand' || brandText === 'Brand' || brandText.length < 2) {
        missingFields.push('Brand');
      } else {
        fieldValues.brand = brandText;
      }
      
      // Check for photo requirement
      const photoElements = document.querySelectorAll('[data-testid="Photo"], [class*="photo"], img[src*="mercari"]');
      const photoCount = photoElements.length;
      if (photoCount === 0) {
        missingFields.push('Photos (at least 1 required)');
      } else {
        fieldValues.photos = photoCount;
      }
      
      console.error('❌ [FORM SUBMIT] Form validation failed:', {
        missingFields,
        fieldValues,
        buttonDisabled: finalSubmitBtn.disabled,
        buttonVisible: finalSubmitBtn.offsetParent !== null
      });
      
      // Try one more time to trigger validation by clicking on form elements
      console.log('🔄 [FORM SUBMIT] Attempting to trigger validation one more time...');
      const titleInputRetry = document.querySelector('[data-testid="Title"]');
      const priceInputRetry = document.querySelector('[data-testid="Price"]');
      
      if (titleInputRetry) {
        titleInputRetry.focus();
        titleInputRetry.blur();
        titleInputRetry.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      if (priceInputRetry) {
        priceInputRetry.focus();
        priceInputRetry.blur();
        priceInputRetry.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      
      // Wait a bit more for validation
      await sleep(1000);
      
      // Check button again
      finalSubmitBtn = document.querySelector('[data-testid="ListButton"]');
      if (finalSubmitBtn && !finalSubmitBtn.disabled) {
        console.log('✅ [FORM SUBMIT] Button enabled after validation trigger!');
        buttonEnabled = true;
      } else {
        isSubmittingMercariForm = false;
        return {
          success: false,
          error: `Form incomplete. Missing: ${missingFields.join(', ')}`,
          details: { missingFields, fieldValues }
        };
      }
    }
    
    // Final check - ensure button is enabled before clicking
    if (!buttonEnabled && finalSubmitBtn.disabled) {
      console.error('❌ [FORM SUBMIT] Button still disabled after all attempts');
      isSubmittingMercariForm = false;
      return {
        success: false,
        error: 'List button is disabled - form validation failed',
        details: { missingFields, fieldValues }
      };
    }
    
    // Click ONCE - use direct click only (prevents multiple submissions)
    console.log('🖱️ [FORM SUBMIT] Clicking List button ONCE...');
    console.log('📋 [FORM SUBMIT] Button state before click:', {
      disabled: finalSubmitBtn.disabled,
      visible: finalSubmitBtn.offsetParent !== null,
      inViewport: finalSubmitBtn.getBoundingClientRect().top >= 0
    });
    
    // Scroll button into view if needed (cache-busting)
    if (finalSubmitBtn.getBoundingClientRect().top < 0 || finalSubmitBtn.getBoundingClientRect().bottom > window.innerHeight) {
      console.log('📜 [FORM SUBMIT] Scrolling button into view...');
      finalSubmitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(300);
    }
    
    // Store URL before click to detect navigation
    const urlBeforeClick = window.location.href;
    console.log('📋 [FORM SUBMIT] URL before click:', urlBeforeClick);
    
    // Use direct click - most reliable and prevents multiple submissions
    finalSubmitBtn.click();
    
    console.log('✅ [FORM SUBMIT] List button clicked (single click)');
    
    // Wait for navigation/success page - check multiple times (Mercari can be slow)
    let currentUrl = window.location.href;
    let attempts = 0;
    const maxAttempts = 6; // Check for up to 6 seconds
    
    while (attempts < maxAttempts && currentUrl.includes('/sell') && !currentUrl.includes('/item/')) {
      await sleep(1000); // Check every second
      currentUrl = window.location.href;
      attempts++;
      console.log(`📋 [FORM SUBMIT] Check ${attempts}/${maxAttempts}: URL = ${currentUrl}`);
    }
    
    console.log('📋 [FORM SUBMIT] Final URL:', currentUrl);
    console.log('📋 [FORM SUBMIT] URL changed:', currentUrl !== urlBeforeClick);
    
    if (currentUrl.includes('/item/')) {
      // Successfully created - URL contains item ID
      const listingId = currentUrl.split('/item/')[1]?.split('/')[0] || '';
      
      console.log('✅ [FORM SUBMIT] Success! Listing ID:', listingId);
      
      // Reset submission flag on success
      isSubmittingMercariForm = false;
      
      return {
        success: true,
        listingId: listingId,
        listingUrl: currentUrl
      };
    } else if (currentUrl.includes('/sell')) {
      // Still on sell page after multiple checks - might be an error OR still processing
      // Check if button is still there (if gone, might be processing)
      const stillHasButton = document.querySelector('[data-testid="ListButton"]') !== null;
      
      if (!stillHasButton) {
        // Button disappeared - might be processing, wait longer and check multiple times
        console.log('⏳ [FORM SUBMIT] List button disappeared, checking for success...');
        
        // Wait and check multiple times (Mercari can take a few seconds to redirect)
        for (let check = 0; check < 5; check++) {
          await sleep(1500); // Wait 1.5 seconds between checks
          currentUrl = window.location.href;
          
          // Check if we navigated to item page (success!)
          if (currentUrl.includes('/item/')) {
            const listingId = currentUrl.split('/item/')[1]?.split('/')[0] || '';
            console.log('✅ [FORM SUBMIT] Success detected! Listing ID:', listingId);
            isSubmittingMercariForm = false;
            return {
              success: true,
              listingId: listingId,
              listingUrl: currentUrl
            };
          }
          
          // Check for success indicators on the page
          const successIndicators = [
            document.querySelector('[class*="success"]'),
            document.querySelector('[class*="Success"]'),
            document.querySelector('[data-testid*="success"]'),
            document.querySelector('text*="Listing created"'),
            document.querySelector('text*="Item listed"'),
            document.querySelector('text*="Your item is live"')
          ].filter(el => el !== null);
          
          if (successIndicators.length > 0) {
            console.log('✅ [FORM SUBMIT] Success indicators found on page!');
            // Try to extract listing URL from page
            const listingLink = document.querySelector('a[href*="/item/"]');
            if (listingLink) {
              const listingUrl = listingLink.href;
              const listingId = listingUrl.split('/item/')[1]?.split('/')[0] || '';
              isSubmittingMercariForm = false;
              return {
                success: true,
                listingId: listingId,
                listingUrl: listingUrl
              };
            }
            // Even without URL, if we see success indicators, assume success
            isSubmittingMercariForm = false;
            return {
              success: true,
              message: 'Listing created successfully (success indicators detected)',
              url: currentUrl
            };
          }
          
          console.log(`⏳ [FORM SUBMIT] Check ${check + 1}/5: Still processing...`);
        }
        
        // After all checks, if still on sell page but button is gone, assume success
        // (Mercari sometimes doesn't redirect immediately but listing is created)
        currentUrl = window.location.href;
        if (!document.querySelector('[data-testid="ListButton"]')) {
          console.log('✅ [FORM SUBMIT] Button gone and no errors found - assuming success');
          isSubmittingMercariForm = false;
          return {
            success: true,
            message: 'Listing likely created successfully (button disappeared, no errors)',
            url: currentUrl
          };
        }
      }
      // Still on sell page - check for error messages (fresh query)
      const errorSelectors = [
        '[class*="error"]',
        '[class*="Error"]',
        '[role="alert"]',
        '[data-testid*="error"]',
        '[data-testid*="Error"]',
        '.error-message',
        '.validation-error'
      ];
      
      let errorMsg = null;
      let errorText = 'Unknown validation error';
      
      for (const selector of errorSelectors) {
        errorMsg = document.querySelector(selector);
        if (errorMsg && errorMsg.textContent?.trim()) {
          errorText = errorMsg.textContent.trim();
          break;
        }
      }
      
      // Also check for any visible error text
      if (!errorMsg) {
        const allText = document.body.textContent || '';
        const errorKeywords = ['error', 'failed', 'invalid', 'required', 'missing'];
        for (const keyword of errorKeywords) {
          if (allText.toLowerCase().includes(keyword)) {
            // Try to find the context
            const errorElements = Array.from(document.querySelectorAll('*')).filter(el => 
              el.textContent?.toLowerCase().includes(keyword) && 
              el.offsetParent !== null
            );
            if (errorElements.length > 0) {
              errorText = errorElements[0].textContent.trim().substring(0, 200);
              break;
            }
          }
        }
      }
      
      // Only log as error if we're confident it's actually an error
      // (not just processing - button disappearing is a good sign it's processing)
      if (stillHasButton) {
        console.error('❌ [FORM SUBMIT] Still on sell page after checks - error detected:', errorText);
        if (errorMsg) {
          console.error('📋 [FORM SUBMIT] Error element:', errorMsg);
        }
        
        // Reset submission flag on error
        isSubmittingMercariForm = false;
        
        return {
          success: false,
          error: `Listing failed: ${errorText}`,
          url: currentUrl
        };
      } else {
        // Button disappeared - might still be processing, but we'll return as unknown
        console.warn('⚠️ [FORM SUBMIT] Still on sell page but button disappeared - might be processing');
        isSubmittingMercariForm = false;
        return {
          success: false,
          error: 'Listing status unclear - please check Mercari manually',
          url: currentUrl,
          mightBeProcessing: true
        };
      }
    }
    
    // Unknown state - might still be processing, return as "might be processing"
    // Don't log as warning - this is often a false positive
    setTimeout(() => {
      isSubmittingMercariForm = false;
    }, 5000);
    
    return {
      success: false,
      error: 'Listing status unclear - please check Mercari manually',
      url: currentUrl,
      urlBeforeClick: urlBeforeClick,
      mightBeProcessing: true // Flag for frontend to handle gracefully
    };
  } catch (error) {
    // Reset flag on exception
    isSubmittingMercariForm = false;
    console.error('❌ [FORM SUBMIT] Error:', error);
    return {
      success: false,
      error: error.message || 'Form submission failed'
    };
  }
}

// Helper: Wait for element to appear
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found after ${timeout}ms`));
    }, timeout);
  });
}
