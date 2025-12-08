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
    
    // Navigate to sell page if not already there
    if (!window.location.href.includes('/sell')) {
      window.location.href = 'https://www.mercari.com/sell/';
      
      // Wait for page to load, then retry
      window.addEventListener('load', () => {
        setTimeout(() => createMercariListing(listingData), 2000);
      }, { once: true });
      return;
    }
    
    // Wait for form to be ready (use actual Mercari selectors)
    await waitForElement('[data-testid="Title"], #sellName', 10000);
    
    // Fill in form fields
    console.log('📝 Starting to fill form fields...');
    const fillResult = await fillMercariForm(listingData);
    console.log('📝 Form fill result:', fillResult);
    
    // Wait a bit for all changes to take effect
    console.log('⏳ Waiting 2s for form to update...');
    await sleep(2000);
    
    // Submit the form
    console.log('📤 Attempting to submit form...');
    const submitResult = await submitMercariForm();
    
    console.log('Mercari listing submit result:', submitResult);
    return submitResult;
    
  } catch (error) {
    console.error('Error in Mercari listing automation:', error);
    return { success: false, error: error.message };
  }
}

// Helper: Click Mercari custom dropdown and select option
async function selectMercariDropdown(testId, optionText, partialMatch = false) {
  try {
    console.log(`Selecting from dropdown [${testId}]: ${optionText}`);
    
    // Find and click the dropdown trigger
    const dropdown = document.querySelector(`[data-testid="${testId}"]`);
    if (!dropdown) {
      console.warn(`Dropdown [${testId}] not found`);
      return false;
    }
    
    // Click to open dropdown
    dropdown.click();
    await sleep(500);
    
    // Wait for options to appear (they usually appear in a portal/overlay)
    // Mercari dropdowns render options in the DOM after clicking
    await sleep(300);
    
    // Try to find the option - Mercari uses various patterns
    // Look for elements with role="option" or in a listbox
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    
    let matchedOption = null;
    
    if (partialMatch) {
      matchedOption = options.find(opt => 
        opt.textContent.toLowerCase().includes(optionText.toLowerCase())
      );
    } else {
      matchedOption = options.find(opt => 
        opt.textContent.trim().toLowerCase() === optionText.toLowerCase()
      );
    }
    
    if (matchedOption) {
      console.log(`✓ Found option: ${matchedOption.textContent}`);
      matchedOption.click();
      await sleep(500);
      return true;
    } else {
      console.warn(`Option "${optionText}" not found in dropdown [${testId}]`);
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
    
    // 3. CATEGORY - Multi-level selection required
    // Mercari has CategoryL0, CategoryL1, CategoryL2, etc.
    if (data.category || data.categoryId) {
      console.log('🔍 Attempting category selection...');
      // This is complex - Mercari requires navigating through category hierarchy
      // For now, we'll attempt a basic selection
      // The user will need to manually complete if it fails
      const categorySuccess = await selectMercariDropdown('CategoryL0', data.category || 'Other', true);
      if (categorySuccess) {
        console.log('✓ Category selected (may need sub-categories)');
      } else {
        console.warn('⚠️ Category selection failed - may need manual intervention');
      }
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
      const conditionSuccess = await selectMercariDropdown('Condition', data.condition, false);
      if (conditionSuccess) {
        console.log('✓ Condition set:', data.condition);
      } else {
        console.warn('⚠️ Condition selection failed');
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
