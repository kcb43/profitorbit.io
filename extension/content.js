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
    return !!(
      document.querySelector('[data-testid="UserMenuButton"]') ||
      document.querySelector('.merUserMenu') ||
      document.querySelector('[aria-label*="Account"]') ||
      document.querySelector('a[href*="/mypage"]')
    );
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
    const userMenu = document.querySelector('[data-testid="UserMenuButton"]');
    return {
      userName: userMenu?.getAttribute('aria-label') || 'Mercari User',
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

// Send login status to background script AND update localStorage for web app
function updateLoginStatus() {
  try {
    const userInfo = getUserInfo();
    
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
      return;
    }
    
    // Send to background script
    chrome.runtime.sendMessage({
      type: `${MARKETPLACE?.toUpperCase()}_LOGIN_STATUS`,
      marketplace: MARKETPLACE,
      data: userInfo
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Extension was reloaded or context invalidated - this is normal
        console.log('Extension context changed - page needs refresh');
      } else {
        console.log('Login status sent:', response);
      }
    });
  } catch (error) {
    // Gracefully handle any errors
    console.log('Extension communication error (page may need refresh):', error.message);
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

// Helper to safely access chrome.storage with invalidated context handling
const safeChromeStorageGet = (keys, callback) => {
  if (!checkExtensionContext()) {
    console.warn('⚠️ [CHROME STORAGE] Extension context invalidated');
    if (callback) callback(null);
    return;
  }
  
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      console.warn('⚠️ [CHROME STORAGE] chrome.storage.local not available');
      if (callback) callback(null);
      return;
    }
    
    chrome.storage.local.get(keys, (result) => {
      try {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || '';
          if (errorMsg.includes('invalidated') || errorMsg.includes('Extension context')) {
            console.warn('⚠️ [CHROME STORAGE] Extension context invalidated');
            if (callback) callback(null);
            return;
          }
          console.warn('⚠️ [CHROME STORAGE] Error:', errorMsg);
          if (callback) callback(null);
          return;
        }
        
        if (callback) callback(result);
      } catch (error) {
        if (error.message && error.message.includes('invalidated')) {
          console.warn('⚠️ [CHROME STORAGE] Extension context invalidated');
        } else {
          console.error('❌ [CHROME STORAGE] Error processing result:', error);
        }
        if (callback) callback(null);
      }
    });
  } catch (error) {
    if (error.message && error.message.includes('invalidated')) {
      console.warn('⚠️ [CHROME STORAGE] Extension context invalidated');
    } else {
      console.error('❌ [CHROME STORAGE] Error accessing chrome.storage:', error);
    }
    if (callback) callback(null);
  }
};

// Load headers from chrome.storage on startup and periodically refresh
if (MARKETPLACE === 'mercari') {
  let headerRefreshInterval = null;
  let extensionContextValid = true;
  
  const loadHeadersFromStorage = () => {
    safeChromeStorageGet(['mercariApiHeaders'], (result) => {
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
    });
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
      if (extensionContextValid) {
        loadHeadersFromStorage();
      } else {
        clearInterval(headerRefreshInterval);
        headerRefreshInterval = null;
      }
    }, 5000);
  }
  
  console.log('📡 [HEADER INTERCEPT] Ready to receive headers from webRequest API');
}

// Check login on page load
if (MARKETPLACE) {
  window.addEventListener('load', () => {
    setTimeout(updateLoginStatus, 1500);
  });

  // Watch for login changes (SPA navigation)
  const observer = new MutationObserver(() => {
    clearTimeout(window.loginCheckTimeout);
    window.loginCheckTimeout = setTimeout(updateLoginStatus, 2000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PING') {
      // Simple ping to check if content script is ready
      sendResponse({ pong: true, marketplace: MARKETPLACE });
      return true;
    }
    
    if (message.type === 'CHECK_LOGIN') {
      const userInfo = getUserInfo();
      sendResponse({ status: userInfo });
      return true;
    }
    
    if (message.type === 'CREATE_LISTING') {
      // Run async listing creation
      createListing(message.listingData).then((result) => {
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

  // Initial check
  updateLoginStatus();
}

// Create listing on current marketplace
async function createListing(listingData) {
  if (MARKETPLACE === 'mercari') {
    return await createMercariListing(listingData);
  }
  
  // Other marketplaces to be implemented
  return {
    success: false,
    error: `${MARKETPLACE} listing automation not yet implemented`
  };
}

// Mercari-specific listing automation
async function createMercariListing(listingData) {
  try {
    console.log('🚀 [MERCARI] Starting listing creation...');
    const summaryData = {
      title: listingData.title,
      price: listingData.price,
      photosCount: listingData.photos?.length || 0,
      category: listingData.mercariCategory,
      condition: listingData.condition,
      brand: listingData.brand
    };
    console.log('📋 [MERCARI] Listing data:', summaryData);
    
    // Navigate to sell page if not already there
    if (!window.location.href.includes('/sell')) {
      console.log('🌐 [MERCARI] Navigating to sell page...');
      window.location.href = 'https://www.mercari.com/sell/';
      
      // Wait for page to load, then retry
      window.addEventListener('load', () => {
        setTimeout(() => createMercariListing(listingData), 2000);
      }, { once: true });
      return { success: false, error: 'Navigating to sell page...', retrying: true };
    }
    
    console.log('⏳ [MERCARI] Waiting for form to load...');
    // Wait for form to be ready (use actual Mercari selectors)
    await waitForElement('[data-testid="Title"], #sellName', 10000);
    console.log('✅ [MERCARI] Form loaded, starting to fill fields...');
    
    // Fill in form fields
    const fillResult = await fillMercariForm(listingData);
    console.log('✅ [MERCARI] Form fields filled successfully');
    
    // Wait a bit for all changes to take effect
    await sleep(2000);
    
    // Upload photos if present (using extension method with Mercari's GraphQL API)
    const hasPhotos = listingData.photos && listingData.photos.length > 0;
    if (hasPhotos) {
      console.log(`📸 [MERCARI] Starting photo upload for ${listingData.photos.length} photo(s)...`);
      
      // Wait a bit to ensure we've captured headers from Mercari's initial API calls
      if (!capturedMercariHeaders || Object.keys(capturedMercariHeaders).length === 0) {
        console.log('⏳ [MERCARI] Waiting for API headers to be captured...');
        await sleep(3000); // Wait 3 seconds for Mercari to make API calls
        
        // Check again
        if (!capturedMercariHeaders || Object.keys(capturedMercariHeaders).length === 0) {
          console.warn('⚠️ [MERCARI] No headers captured yet, proceeding with fallback headers');
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
          alert(`❌ Photo Upload Failed\n\n${JSON.stringify({ error: uploadResult.error }, null, 2)}`);
          return {
            success: false,
            error: `Photo upload failed: ${uploadResult.error}`,
            requiresManualPhotoUpload: true
          };
        }
        console.log(`✅ [MERCARI] All photos uploaded successfully! Upload IDs: ${uploadResult.uploadIds.join(', ')}`);
        // Upload IDs are stored in window.__mercariUploadIds for form submission
      } catch (error) {
        console.error('❌ [MERCARI] Photo upload error:', error);
        return {
          success: false,
          error: `Photo upload error: ${error.message}`,
          requiresManualPhotoUpload: true
        };
      }
    }
    
    // Check if photos are required but not uploaded
    const photoCount = document.querySelectorAll('[data-testid="Photo"]').length;
    const photosInData = listingData.photos && listingData.photos.length > 0;
    
    if (photoCount === 0 && !photosInData) {
      console.log('⚠️ [MERCARI] No photos provided, manual upload required');
      return {
        success: true,
        message: 'Form filled successfully. Please upload at least one photo manually and click the List button.',
        requiresManualPhotoUpload: true,
        filled: true
      };
    }
    
    // Handle any popups that might have appeared after photo upload
    console.log('🔍 [MERCARI] Checking for popups after photo upload...');
    await handleMercariPopups();
    await sleep(300); // Reduced wait time
    
    // Verify and re-set brand if needed (popups might have cleared it)
    if (listingData.brand) {
      console.log('🔍 [MERCARI] Verifying brand is still set...');
      const brandDropdown = document.querySelector('[data-testid="Brand"]');
      const brandValue = brandDropdown?.textContent?.trim() || brandDropdown?.value?.trim() || '';
      
      // Check if brand is empty or shows placeholder
      if (!brandValue || brandValue === 'Select brand' || brandValue === 'Brand' || brandValue.length < 2) {
        console.log('⚠️ [MERCARI] Brand appears to be missing, re-setting...');
        await setMercariBrand(listingData.brand);
        await sleep(500); // Reduced wait time
      } else {
        console.log(`✅ [MERCARI] Brand is still set: "${brandValue}"`);
      }
    }
    
    console.log('📤 [MERCARI] Submitting form immediately...');
    // Submit the form (only if photos are present) - brand verification happens inside
    const submitResult = await submitMercariForm(listingData.brand);
    
    if (submitResult.success) {
      console.log('✅ [MERCARI] Listing created successfully!', submitResult.listingUrl);
    } else {
      console.error('❌ [MERCARI] Form submission failed:', submitResult.error);
    }
    
    return submitResult;
    
  } catch (error) {
    console.error('❌ [MERCARI] Error during listing creation:', error);
    return { success: false, error: error.message };
  }
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
  if (!window.location.href.includes('/sell')) {
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
    await sleep(200);
    
    // Click to open dropdown
    dropdown.click();
    await sleep(800); // Wait for dropdown to fully open
    
    // Wait for options to appear (they usually appear in a portal/overlay)
    // Mercari dropdowns render options in the DOM after clicking
    // Try multiple times to find options
    let options = [];
    for (let attempt = 0; attempt < 5; attempt++) {
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
      
      await sleep(300);
    }
    
    if (options.length === 0) {
      // Click outside to close dropdown
      document.body.click();
      await sleep(300);
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
      await sleep(200);
      matchedOption.click();
      await sleep(600); // Wait after selection
      return true;
    } else {
      // Click outside to close dropdown
      document.body.click();
      await sleep(300);
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
    await sleep(200);
    
    // Click to open/focus
    console.log(`🖱️ [TYPE DROPDOWN ${testId}] Clicking dropdown to open...`);
    dropdown.click();
    await sleep(800); // Increased wait time for dropdown to open
    
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
    
    console.log(`🔍 [TYPE DROPDOWN ${testId}] Input found:`, input ? 'Yes' : 'No');
    
    if (input && input.tagName === 'INPUT') {
      console.log(`📝 [TYPE DROPDOWN ${testId}] Typing into input: "${text}"`);
      
      // Focus the input
      input.focus();
      await sleep(300);
      
      // Clear and set value
      input.value = '';
      
      // Type character by character to trigger autocomplete properly
      for (let i = 0; i < text.length; i++) {
        input.value = text.substring(0, i + 1);
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new Event('keydown', { bubbles: true, cancelable: true }));
        await sleep(100);
      }
      
      // Dispatch final events
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      
      await sleep(1200); // Wait for autocomplete suggestions
      
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
        await sleep(200);
        matchingOption.click();
        await sleep(500);
        return true;
      } else {
        console.log(`⚠️ [TYPE DROPDOWN ${testId}] No matching option found, trying Enter key...`);
        
        // If no matching option found, try pressing Enter to accept typed value
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        await sleep(500);
        
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
    
    // Wait a bit for page to fully load and make initial API calls
    console.log('⏳ [PHOTO UPLOAD] Waiting for page to initialize...');
    await sleep(2000);
    
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

        // Small delay between uploads
        if (i < photos.length - 1) {
          console.log(`⏳ [PHOTO UPLOAD] Waiting 500ms before next upload...`);
          await sleep(500);
        }

      } catch (error) {
        console.error(`❌ [PHOTO UPLOAD ${i + 1}/${photos.length}] Error:`, error);
        return { success: false, error: `Failed to upload photo ${i + 1}: ${error.message}` };
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
        
        // Find the file input element
        const fileInput = document.querySelector('input[data-testid="SellPhotoInput"]');
        
        if (!fileInput) {
          console.warn(`⚠️ [FILE INPUT] File input not found with data-testid="SellPhotoInput"`);
        } else {
          // Create a DataTransfer object to hold the files
          const dataTransfer = new DataTransfer();
          
          // Add each blob as a file to the DataTransfer
          photoBlobs.forEach((blob, index) => {
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
    // 1. TITLE
    console.log(`📝 [FORM FILL] Setting title: "${data.title}"`);
    const titleInput = document.querySelector('[data-testid="Title"]') || 
                      document.querySelector('#sellName');
    if (titleInput && data.title) {
      titleInput.value = data.title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
      console.log(`✅ [FORM FILL] Title set`);
    }
    
    // 2. DESCRIPTION
    console.log(`📝 [FORM FILL] Setting description...`);
    const descInput = document.querySelector('[data-testid="Description"]') ||
                     document.querySelector('#sellDescription');
    if (descInput && data.description) {
      descInput.value = data.description;
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
      descInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
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
          // Wait for next level dropdown to appear (if not the last level)
          if (level < categoryParts.length - 1) {
            await sleep(1000); // Give Mercari time to load next level
            // Check if any category dropdown is available for next level
            const nextLevelTestId = `CategoryL${level + 1}`;
            let nextDropdown = document.querySelector(`[data-testid="${nextLevelTestId}"]`);
            if (!nextDropdown) {
              // Try to find any category dropdown that might be the next level
              nextDropdown = document.querySelector('[data-testid*="Category"]') ||
                           document.querySelector('[aria-haspopup="listbox"][id*="category"]');
              if (!nextDropdown) {
                await sleep(1000);
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
    
    // 7. SIZE (text input)
    if (data.size) {
      const sizeInput = document.querySelector('[data-testid="Size"]') ||
                        document.querySelector('input[name*="size" i]');
      if (sizeInput) {
        sizeInput.value = data.size;
        sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(300);
      }
    }
    
    // 8. SHIPS FROM (zip code)
    if (data.shipsFrom) {
      // User may need to click Edit button first
      const editShipsFromBtn = document.querySelector('[data-testid="ShipsFromEditButton"]');
      if (editShipsFromBtn) {
        editShipsFromBtn.click();
        await sleep(500);
      }
      
      const zipInput = document.querySelector('input[name*="zip" i]') ||
                       document.querySelector('input[placeholder*="zip" i]');
      if (zipInput) {
        zipInput.value = data.shipsFrom;
        zipInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(300);
      }
    }
    
    // 9. DELIVERY METHOD
    if (data.deliveryMethod) {
      const deliveryText = data.deliveryMethod === 'prepaid' ? 'Prepaid' : 'Ship on your own';
      await selectMercariDropdown('ShippingMethod', deliveryText, true);
    }
    
    // 10. PRICE (do this last as it often triggers validation)
    console.log(`📝 [FORM FILL] Setting price: $${data.price}`);
    const priceInput = document.querySelector('[data-testid="Price"]') ||
                      document.querySelector('#Price') ||
                      document.querySelector('[name="sellPrice"]');
    if (priceInput && data.price) {
      priceInput.value = String(data.price);
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      priceInput.dispatchEvent(new Event('blur', { bubbles: true }));
      await sleep(500);
      console.log(`✅ [FORM FILL] Price set`);
    }
    
    // 10.5. SMART PRICING & SMART OFFERS (after price is set)
    if (data.smartPricing !== undefined || data.smartOffers !== undefined) {
      await sleep(1000); // Wait for price to process and toggles to appear
      
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
              await sleep(200);
              smartPricingToggle.click();
              await sleep(500); // Wait for toggle to activate and UI to update
              
              // If enabling Smart Pricing, look for Floor Price input
              if (data.smartPricing && data.floorPrice) {
                await sleep(500); // Wait for input field to appear
                
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
                  await sleep(300);
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
  // 1. Try typing first (Mercari brand is searchable)
  console.log(`🔍 [BRAND] Attempting method 1: typeIntoMercariDropdown`);
  brandSuccess = await typeIntoMercariDropdown('Brand', brand);
  console.log(`📋 [BRAND] Method 1 result:`, brandSuccess ? 'Success' : 'Failed');
  
  if (!brandSuccess) {
    // 2. If typing failed, try dropdown selection with exact match
    console.log(`🔍 [BRAND] Attempting method 2: selectMercariDropdown (exact match)`);
    brandSuccess = await selectMercariDropdown('Brand', brand, false);
    console.log(`📋 [BRAND] Method 2 result:`, brandSuccess ? 'Success' : 'Failed');
    
    if (!brandSuccess) {
      // 3. If exact match failed, try partial match
      console.log(`🔍 [BRAND] Attempting method 3: selectMercariDropdown (partial match)`);
      brandSuccess = await selectMercariDropdown('Brand', brand, true);
      console.log(`📋 [BRAND] Method 3 result:`, brandSuccess ? 'Success' : 'Failed');
      
      if (!brandSuccess && brand.includes(' ')) {
        // 4. Try with just the first word if brand has multiple words
        const firstWord = brand.split(' ')[0];
        console.log(`🔍 [BRAND] Attempting method 4: selectMercariDropdown (first word: "${firstWord}")`);
        brandSuccess = await selectMercariDropdown('Brand', firstWord, true);
        console.log(`📋 [BRAND] Method 4 result:`, brandSuccess ? 'Success' : 'Failed');
      }
    }
  }
  
  // Verify the brand was actually set
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

async function submitMercariForm(brandToVerify = null) {
  console.log('📤 [FORM SUBMIT] Looking for List button...');
  // Find the List button using actual Mercari selector
  const submitBtn = document.querySelector('[data-testid="ListButton"]') ||
                   document.querySelector('button[type="submit"]');
  
  if (!submitBtn) {
    console.error('❌ [FORM SUBMIT] List button not found');
    return {
      success: false,
      error: 'List button not found on page'
    };
  }
  
  console.log('✅ [FORM SUBMIT] List button found');
  
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
      await sleep(300); // Minimal wait
    }
  }
  
  // Re-fetch button right before clicking to ensure we have the latest state
  const finalSubmitBtn = document.querySelector('[data-testid="ListButton"]') ||
                         document.querySelector('button[type="submit"]');
  
  if (!finalSubmitBtn) {
    console.error('❌ [FORM SUBMIT] List button disappeared');
    return {
      success: false,
      error: 'List button not found on page'
    };
  }
  
  // Check if button is enabled (Mercari disables it if form is invalid)
  if (finalSubmitBtn.disabled) {
    console.warn('⚠️ [FORM SUBMIT] List button is disabled - checking form validation...');
    // Try to identify what's missing
    const titleInput = document.querySelector('[data-testid="Title"]') || document.querySelector('#sellName');
    const descInput = document.querySelector('[data-testid="Description"]') || document.querySelector('#sellDescription');
    const priceInput = document.querySelector('[data-testid="Price"]') || document.querySelector('#Price');
    const categoryDropdown = document.querySelector('[data-testid="CategoryL0"]');
    const conditionDropdown = document.querySelector('[data-testid="Condition"]');
    
    const missingFields = [];
    if (!titleInput?.value) missingFields.push('Title');
    if (!descInput?.value) missingFields.push('Description');
    if (!priceInput?.value) missingFields.push('Price');
    if (categoryDropdown?.textContent === 'Select category') missingFields.push('Category');
    if (conditionDropdown?.textContent === 'Select condition') missingFields.push('Condition');
    
    // Check for photo requirement
    const photoCount = document.querySelectorAll('[data-testid="Photo"]').length;
    if (photoCount === 0) missingFields.push('Photos (at least 1 required)');
    
    return {
      success: false,
      error: `Form incomplete. Missing: ${missingFields.join(', ')}`
    };
  }
  
  // Click immediately - use multiple methods for reliability
  console.log('🖱️ [FORM SUBMIT] Clicking List button immediately...');
  
  // Method 1: Direct click on button (immediate)
  finalSubmitBtn.click();
  
  // Method 2: Also trigger form submit event (backup, immediate)
  const form = finalSubmitBtn.closest('form');
  if (form) {
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);
  }
  
  // Method 3: Also dispatch mouse events for better compatibility (immediate)
  const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
  const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
  const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
  finalSubmitBtn.dispatchEvent(mouseDown);
  finalSubmitBtn.dispatchEvent(mouseUp);
  finalSubmitBtn.dispatchEvent(clickEvent);
  
  console.log('✅ [FORM SUBMIT] List button clicked');
  
  // Wait for navigation/success page
  await sleep(5000);
  
  // Try to detect success and extract listing URL
  const currentUrl = window.location.href;
  
  if (currentUrl.includes('/item/')) {
    // Successfully created - URL contains item ID
    const listingId = currentUrl.split('/item/')[1]?.split('/')[0] || '';
    
    return {
      success: true,
      listingId: listingId,
      listingUrl: currentUrl
    };
  } else if (currentUrl.includes('/sell')) {
    // Still on sell page - check for error messages
    const errorMsg = document.querySelector('[class*="error"], [class*="Error"], [role="alert"]');
    const errorText = errorMsg?.textContent || 'Unknown validation error';
    
    return {
      success: false,
      error: `Listing failed: ${errorText}`
    };
  }
  
  // Unknown state
  return {
    success: false,
    error: 'Unable to determine listing status'
  };
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
