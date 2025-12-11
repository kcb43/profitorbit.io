/**
 * Content Script for All Marketplaces
 * Detects login and automates listings across multiple platforms
 */

console.log('Profit Orbit Extension: Content script loaded');

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

console.log(`Profit Orbit Extension: Running on ${MARKETPLACE}`);

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
  console.log(`${MARKETPLACE} login check:`, isLoggedIn ? 'Logged in' : 'Not logged in');
  
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
    if (message.type === 'CHECK_LOGIN') {
      const userInfo = getUserInfo();
      sendResponse({ status: userInfo });
      return true;
    }
    
    if (message.type === 'CREATE_LISTING') {
      console.log(`Creating ${MARKETPLACE} listing with data:`, message.listingData);
      
      // Run async listing creation
      createListing(message.listingData).then((result) => {
        console.log('Listing creation result:', result);
        sendResponse(result);
      }).catch((error) => {
        console.error('Listing creation error:', error);
        sendResponse({ success: false, error: error.message });
      });
      
      return true; // Keep channel open for async response
    }
  });

  // Initial check
  updateLoginStatus();
  
  console.log(`Profit Orbit Extension: Initialized for ${MARKETPLACE}`);
}

// Create listing on current marketplace
async function createListing(listingData) {
  console.log(`Creating ${MARKETPLACE} listing:`, listingData);
  
  if (MARKETPLACE === 'mercari') {
    return await createMercariListing(listingData);
  }
  
  // Other marketplaces to be implemented
  console.log(`Listing automation for ${MARKETPLACE} coming soon`);
  return {
    success: false,
    error: `${MARKETPLACE} listing automation not yet implemented`
  };
}

// Mercari-specific listing automation
async function createMercariListing(listingData) {
  try {
    console.log('Starting Mercari listing automation...', listingData);
    
    // Check if photos are present - if so, try Puppeteer API first (can handle photo uploads)
    const hasPhotos = listingData.photos && listingData.photos.length > 0;
    
    if (hasPhotos) {
      console.log('📸 Photos detected - attempting Puppeteer API first...');
      try {
        const puppeteerResult = await createMercariListingWithPuppeteer(listingData);
        // If Puppeteer succeeded, return early
        if (puppeteerResult.success && !puppeteerResult.requiresManualPhotoUpload) {
          return puppeteerResult;
        }
        // If Puppeteer failed but provided fallback, continue with extension method
        if (puppeteerResult.requiresManualPhotoUpload) {
          console.log('📝 Continuing with extension method (photos need manual upload)');
          // Continue to extension method below
        } else {
          // Puppeteer failed completely, fall through to extension method
          console.log('⚠️ Puppeteer failed, using extension method');
        }
      } catch (error) {
        console.error('Puppeteer error:', error);
        console.log('⚠️ Falling back to extension method');
        // Fall through to extension method
      }
    }
    
    // Use extension method (works for everything except photo uploads)
    console.log('📝 Using extension method for form filling');
    
    // Navigate to sell page if not already there
    if (!window.location.href.includes('/sell')) {
      console.log('🌐 Navigating to Mercari sell page...');
      window.location.href = 'https://www.mercari.com/sell/';
      
      // Wait for page to load, then retry
      window.addEventListener('load', () => {
        setTimeout(() => createMercariListing(listingData), 2000);
      }, { once: true });
      return { success: false, error: 'Navigating to sell page...', retrying: true };
    }
    
    // Wait for form to be ready (use actual Mercari selectors)
    console.log('⏳ Waiting for form to load...');
    await waitForElement('[data-testid="Title"], #sellName', 10000);
    
    // Fill in form fields
    console.log('📝 Starting to fill form fields...');
    const fillResult = await fillMercariForm(listingData);
    console.log('📝 Form fill result:', fillResult);
    
    // Wait a bit for all changes to take effect
    console.log('⏳ Waiting 2s for form to update...');
    await sleep(2000);
    
    // Check if photos are required but not uploaded
    const photoCount = document.querySelectorAll('[data-testid="Photo"]').length;
    const photosInData = listingData.photos && listingData.photos.length > 0;
    
    if (photoCount === 0 && !photosInData) {
      console.log('⚠️ No photos detected - Mercari requires at least one photo');
      console.log('✅ Form filled successfully! Please upload photos manually and click the List button.');
      return {
        success: true,
        message: 'Form filled successfully. Please upload at least one photo manually and click the List button.',
        requiresManualPhotoUpload: true,
        filled: true
      };
    }
    
    // If photos are in listingData but not uploaded yet, don't submit
    if (photosInData && photoCount === 0) {
      console.log('⚠️ Photos are in listing data but not uploaded yet');
      console.log('✅ Form filled! Please wait for photos to upload or upload manually, then click List button.');
      return {
        success: true,
        message: 'Form filled successfully. Photos need to be uploaded. Please upload photos manually and click the List button.',
        requiresManualPhotoUpload: true,
        filled: true
      };
    }
    
    // Submit the form (only if photos are present)
    console.log('📤 Attempting to submit form...');
    const submitResult = await submitMercariForm();
    
    console.log('Mercari listing submit result:', submitResult);
    return submitResult;
    
  } catch (error) {
    console.error('Error in Mercari listing automation:', error);
    return { success: false, error: error.message };
  }
}

// Use Puppeteer API for listings with photos
async function createMercariListingWithPuppeteer(listingData) {
  try {
    console.log('🤖 Calling Puppeteer API for Mercari listing...');
    
    // Get the API URL - try to get from storage or use default
    // For now, we'll use a configurable approach
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
      console.log('Using default API URL');
    }
    
    // Check if we're in development (this won't work on Mercari page, but that's okay)
    // The API should be accessible from the extension
    const fullApiUrl = `${apiUrl}/api/mercari-puppeteer`;
    console.log('Calling Puppeteer API at:', fullApiUrl);
    
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
      console.log('✅ Puppeteer automation completed successfully!');
      console.log('Listing ID:', result.listingId);
      console.log('Listing URL:', result.listingUrl);
      return result;
    } else {
      throw new Error(result.error || result.message || 'Puppeteer API request failed');
    }
    
  } catch (error) {
    console.error('❌ Error calling Puppeteer API:', error);
    console.log('⚠️ Puppeteer API failed, falling back to extension method');
    console.log('⚠️ Note: Photos will need to be uploaded manually');
    
    // Fallback to extension method - continue with form filling but skip photo upload
    // This allows the form to be filled, user can upload photos manually
    return await createMercariListingExtensionFallback(listingData);
  }
}

// Fallback to extension method when Puppeteer fails
async function createMercariListingExtensionFallback(listingData) {
  console.log('📝 Using extension fallback method (photos will need manual upload)');
  
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
  console.log('📝 Starting to fill form fields (extension method)...');
  const fillResult = await fillMercariForm(listingData);
  console.log('📝 Form fill result:', fillResult);
  
  // Wait a bit for all changes to take effect
  console.log('⏳ Waiting 2s for form to update...');
  await sleep(2000);
  
  // Don't auto-submit - let user review and upload photos manually
  console.log('✅ Form filled! Please upload photos manually and click List button.');
  return {
    success: true,
    message: 'Form filled successfully. Please upload photos manually and click the List button.',
    requiresManualPhotoUpload: true
  };
}

// Helper: Click Mercari custom dropdown and select option
async function selectMercariDropdown(testId, optionText, partialMatch = false) {
  try {
    console.log(`Selecting from dropdown [${testId}]: ${optionText}`);
    
    // Find and click the dropdown trigger - try multiple selectors
    let dropdown = document.querySelector(`[data-testid="${testId}"]`);
    
    // Fallback: if testId not found, try to find any category dropdown that's visible/active
    if (!dropdown && testId.startsWith('Category')) {
      // Try finding by aria attributes or class names
      dropdown = document.querySelector('[data-testid*="Category"]') ||
                 document.querySelector('[aria-haspopup="listbox"][id*="category"]') ||
                 document.querySelector('.SelectInputEl-sc-1buwe9t');
    }
    
    if (!dropdown) {
      console.warn(`Dropdown [${testId}] not found`);
      return false;
    }
    
    // Click to open dropdown
    dropdown.click();
    await sleep(600); // Increased wait time for dropdown to fully open
    
    // Wait for options to appear (they usually appear in a portal/overlay)
    // Mercari dropdowns render options in the DOM after clicking
    await sleep(400);
    
    // Try to find the option - Mercari uses various patterns
    // Look for elements with role="option" or in a listbox
    let options = Array.from(document.querySelectorAll('[role="option"]'));
    
    // If no options found, try alternative selectors
    if (options.length === 0) {
      options = Array.from(document.querySelectorAll('[data-testid*="Option"]')) ||
                Array.from(document.querySelectorAll('.SelectOption-sc-')) ||
                Array.from(document.querySelectorAll('li[class*="Option"]'));
    }
    
    // Clean option text for matching (remove extra whitespace, special chars)
    const cleanOptionText = optionText.trim().toLowerCase();
    
    let matchedOption = null;
    
    if (partialMatch) {
      matchedOption = options.find(opt => {
        const optText = opt.textContent.trim().toLowerCase();
        return optText.includes(cleanOptionText) || cleanOptionText.includes(optText);
      });
    } else {
      matchedOption = options.find(opt => {
        const optText = opt.textContent.trim().toLowerCase();
        return optText === cleanOptionText;
      });
    }
    
    if (matchedOption) {
      console.log(`✓ Found option: "${matchedOption.textContent.trim()}"`);
      matchedOption.click();
      await sleep(600); // Increased wait time after selection
      return true;
    } else {
      console.warn(`Option "${optionText}" not found in dropdown [${testId}]`);
      console.log(`Available options:`, options.slice(0, 5).map(opt => opt.textContent.trim()));
      // Click outside to close dropdown
      document.body.click();
      await sleep(300);
      return false;
    }
  } catch (error) {
    console.error(`Error selecting dropdown [${testId}]:`, error);
    return false;
  }
}

// Helper: Type into autocomplete/searchable dropdown
async function typeIntoMercariDropdown(testId, text) {
  try {
    console.log(`Typing into dropdown [${testId}]: ${text}`);
    
    const dropdown = document.querySelector(`[data-testid="${testId}"]`);
    if (!dropdown) {
      console.warn(`Dropdown [${testId}] not found`);
      return false;
    }
    
    // Click to open/focus
    dropdown.click();
    await sleep(300);
    
    // Try to find an input field within or after the dropdown
    const input = dropdown.querySelector('input') || 
                  document.querySelector(`[data-testid="${testId}"] + input`) ||
                  document.activeElement;
    
    if (input && input.tagName === 'INPUT') {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(500);
      
      // Press Enter to select
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await sleep(300);
      
      console.log(`✓ Typed and selected: ${text}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error typing into dropdown [${testId}]:`, error);
    return false;
  }
}

// Fill Mercari form fields
async function fillMercariForm(data) {
  console.log('Filling Mercari form with data:', data);
  
  try {
    // 1. TITLE
    const titleInput = document.querySelector('[data-testid="Title"]') || 
                      document.querySelector('#sellName');
    if (titleInput && data.title) {
      titleInput.value = data.title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
      console.log('✓ Title set:', data.title);
    }
    
    // 2. DESCRIPTION
    const descInput = document.querySelector('[data-testid="Description"]') ||
                     document.querySelector('#sellDescription');
    if (descInput && data.description) {
      descInput.value = data.description;
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
      descInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
      console.log('✓ Description set');
    }
    
    // 3. CATEGORY - Mercari-specific category (multi-level selection)
    if (data.mercariCategory) {
      console.log('🔍 Attempting Mercari category selection:', data.mercariCategory);
      
      // Split category path by " > " to get individual levels
      const categoryParts = data.mercariCategory.split(' > ').map(part => part.trim());
      console.log('📋 Category levels:', categoryParts);
      
      let categorySuccess = false;
      
      // Select each level sequentially
      for (let level = 0; level < categoryParts.length; level++) {
        const categoryPart = categoryParts[level];
        
        // Try multiple testId patterns - Mercari might reuse CategoryL0 or use CategoryL1, CategoryL2, etc.
        const possibleTestIds = level === 0 
          ? ['CategoryL0'] 
          : [`CategoryL${level}`, 'CategoryL0', `CategoryL${level - 1}`]; // Try level-specific first, then fallback
        
        console.log(`  → Selecting level ${level}: "${categoryPart}"`);
        
        let success = false;
        let usedTestId = null;
        
        // Try each possible testId
        for (const testId of possibleTestIds) {
          console.log(`    Trying dropdown [${testId}]...`);
          
          // Try exact match first
          success = await selectMercariDropdown(testId, categoryPart, false);
          
          if (!success) {
            console.warn(`    Exact match failed, trying partial match...`);
            // Try partial match
            success = await selectMercariDropdown(testId, categoryPart, true);
          }
          
          if (success) {
            usedTestId = testId;
            break; // Found it, stop trying other testIds
          }
        }
        
        if (success) {
          console.log(`  ✓ Level ${level} selected: ${categoryPart} (using ${usedTestId})`);
          
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
              if (nextDropdown) {
                console.log(`  → Found next level dropdown (using fallback selector)`);
              } else {
                console.warn(`  ⚠️ Next level dropdown not found yet, waiting...`);
                await sleep(1000);
              }
            }
          } else {
            // Last level selected successfully
            categorySuccess = true;
          }
        } else {
          console.error(`  ❌ Failed to select level ${level}: ${categoryPart}`);
          break; // Stop if any level fails
        }
      }
      
      if (categorySuccess) {
        console.log('✓ Mercari category fully selected:', data.mercariCategory);
      } else {
        console.error('❌ Category selection failed - could not complete all levels');
      }
    } else {
      console.warn('⚠️ No Mercari category provided - skipping category selection');
    }
    
    // 4. BRAND
    if (data.brand) {
      console.log('🔍 Attempting brand selection...');
      // Try typing first (Mercari brand is searchable)
      let brandSuccess = await typeIntoMercariDropdown('Brand', data.brand);
      if (!brandSuccess) {
        // Fallback to dropdown selection
        brandSuccess = await selectMercariDropdown('Brand', data.brand, true);
      }
      if (brandSuccess) {
        console.log('✓ Brand set:', data.brand);
      } else {
        console.warn('⚠️ Brand selection failed');
      }
    }
    
    // 5. CONDITION
    if (data.condition) {
      console.log('🔍 Attempting condition selection...');
      
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
      };
      
      const mercariCondition = conditionMap[data.condition] || data.condition;
      console.log(`  Mapping condition: "${data.condition}" → "${mercariCondition}"`);
      
      // Try exact match first
      let conditionSuccess = await selectMercariDropdown('Condition', mercariCondition, false);
      
      if (!conditionSuccess) {
        console.warn('  ⚠️ Exact match failed, trying partial match...');
        // Try partial match as fallback
        conditionSuccess = await selectMercariDropdown('Condition', mercariCondition, true);
      }
      
      if (conditionSuccess) {
        console.log('✓ Condition set:', mercariCondition);
      } else {
        console.warn('⚠️ Condition selection failed - condition may need manual selection');
      }
    }
    
    // 6. COLOR (if available)
    if (data.color) {
      console.log('🔍 Attempting color selection...');
      const colorSuccess = await selectMercariDropdown('Color', data.color, false);
      if (colorSuccess) {
        console.log('✓ Color set:', data.color);
      }
    }
    
    // 7. SIZE (text input)
    if (data.size) {
      const sizeInput = document.querySelector('[data-testid="Size"]') ||
                        document.querySelector('input[name*="size" i]');
      if (sizeInput) {
        sizeInput.value = data.size;
        sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(300);
        console.log('✓ Size set:', data.size);
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
        console.log('✓ Ships from set:', data.shipsFrom);
      }
    }
    
    // 9. DELIVERY METHOD
    if (data.deliveryMethod) {
      console.log('🔍 Attempting delivery method selection...');
      const deliveryText = data.deliveryMethod === 'prepaid' ? 'Prepaid' : 'Ship on your own';
      const deliverySuccess = await selectMercariDropdown('ShippingMethod', deliveryText, true);
      if (deliverySuccess) {
        console.log('✓ Delivery method set');
      }
    }
    
    // 10. PRICE (do this last as it often triggers validation)
    const priceInput = document.querySelector('[data-testid="Price"]') ||
                      document.querySelector('#Price') ||
                      document.querySelector('[name="sellPrice"]');
    if (priceInput && data.price) {
      priceInput.value = String(data.price);
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      priceInput.dispatchEvent(new Event('blur', { bubbles: true }));
      await sleep(500);
      console.log('✓ Price set:', data.price);
    }
    
    // 10.5. SMART PRICING & SMART OFFERS (after price is set)
    if (data.smartPricing !== undefined || data.smartOffers !== undefined) {
      await sleep(500); // Wait for price to process and toggles to appear
      
      // Smart Pricing toggle
      if (data.smartPricing !== undefined) {
        const smartPricingToggle = document.querySelector('[data-testid*="SmartPricing"]') ||
                                  document.querySelector('input[type="checkbox"][name*="smart" i][name*="pricing" i]') ||
                                  document.querySelector('input[type="checkbox"][aria-label*="Smart Pricing" i]') ||
                                  document.querySelector('button[aria-label*="Smart Pricing" i]');
        if (smartPricingToggle) {
          const isChecked = smartPricingToggle.checked || smartPricingToggle.getAttribute('aria-checked') === 'true';
          if (data.smartPricing !== isChecked) {
            smartPricingToggle.click();
            await sleep(300);
            console.log(`✓ Smart Pricing ${data.smartPricing ? 'enabled' : 'disabled'}`);
          }
        } else {
          console.warn('⚠️ Smart Pricing toggle not found');
        }
      }
      
      // Smart Offers toggle
      if (data.smartOffers !== undefined) {
        const smartOffersToggle = document.querySelector('[data-testid*="SmartOffers"]') ||
                                 document.querySelector('input[type="checkbox"][name*="smart" i][name*="offers" i]') ||
                                 document.querySelector('input[type="checkbox"][aria-label*="Smart Offers" i]') ||
                                 document.querySelector('button[aria-label*="Smart Offers" i]');
        if (smartOffersToggle) {
          const isChecked = smartOffersToggle.checked || smartOffersToggle.getAttribute('aria-checked') === 'true';
          if (data.smartOffers !== isChecked) {
            smartOffersToggle.click();
            await sleep(300);
            console.log(`✓ Smart Offers ${data.smartOffers ? 'enabled' : 'disabled'}`);
          }
        } else {
          console.warn('⚠️ Smart Offers toggle not found');
        }
      }
    }
    
    // 11. PHOTOS - Complex file upload
    // This requires special handling and may not work due to security restrictions
    if (data.photos && data.photos.length > 0) {
      console.warn('⚠️ Photo upload attempted but may require manual intervention');
      console.log(`Photos to upload: ${data.photos.length} files`);
      // Photo upload via extension is very limited due to security
      // User will likely need to upload photos manually
    }
    
    console.log('✅ Form filling complete - check for any warnings above');
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
async function submitMercariForm() {
  console.log('🔍 Checking form before submit...');
  
  // Check what fields are filled
  const titleInput = document.querySelector('[data-testid="Title"]') || document.querySelector('#sellName');
  const descInput = document.querySelector('[data-testid="Description"]') || document.querySelector('#sellDescription');
  const priceInput = document.querySelector('[data-testid="Price"]') || document.querySelector('#Price');
  const categoryDropdown = document.querySelector('[data-testid="CategoryL0"]');
  const conditionDropdown = document.querySelector('[data-testid="Condition"]');
  
  console.log('Form field check:', {
    title: titleInput?.value || 'MISSING',
    description: descInput?.value ? 'SET' : 'MISSING',
    price: priceInput?.value || 'MISSING',
    category: categoryDropdown?.textContent || 'MISSING',
    condition: conditionDropdown?.textContent || 'MISSING'
  });
  
  // Find the List button using actual Mercari selector
  const submitBtn = document.querySelector('[data-testid="ListButton"]') ||
                   document.querySelector('button[type="submit"]');
  
  if (!submitBtn) {
    console.error('❌ Submit button not found');
    return {
      success: false,
      error: 'List button not found on page'
    };
  }
  
  // Check if button is enabled (Mercari disables it if form is invalid)
  if (submitBtn.disabled) {
    console.error('❌ Submit button is disabled - checking for missing required fields...');
    
    // Try to identify what's missing
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
  
  console.log('✅ Submit button is enabled, clicking...');
  submitBtn.click();
  
  // Wait for navigation/success page
  console.log('⏳ Waiting for submission to complete...');
  await sleep(5000);
  
  // Try to detect success and extract listing URL
  const currentUrl = window.location.href;
  console.log('Current URL after submit:', currentUrl);
  
  if (currentUrl.includes('/item/')) {
    // Successfully created - URL contains item ID
    const listingId = currentUrl.split('/item/')[1]?.split('/')[0] || '';
    
    console.log('✅ SUCCESS! Listing created:', listingId);
    return {
      success: true,
      listingId: listingId,
      listingUrl: currentUrl
    };
  } else if (currentUrl.includes('/sell')) {
    // Still on sell page - check for error messages
    const errorMsg = document.querySelector('[class*="error"], [class*="Error"], [role="alert"]');
    const errorText = errorMsg?.textContent || 'Unknown validation error';
    
    console.error('❌ Still on sell page. Error:', errorText);
    return {
      success: false,
      error: `Listing failed: ${errorText}`
    };
  }
  
  // Unknown state
  console.warn('⚠️ Unknown state after submit');
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
