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
    // Check if photos are present - if so, try Puppeteer API first (can handle photo uploads)
    const hasPhotos = listingData.photos && listingData.photos.length > 0;
    
    if (hasPhotos) {
      try {
        const puppeteerResult = await createMercariListingWithPuppeteer(listingData);
        // If Puppeteer succeeded, return early
        if (puppeteerResult.success && !puppeteerResult.requiresManualPhotoUpload) {
          return puppeteerResult;
        }
        // If Puppeteer failed but provided fallback, continue with extension method
        if (puppeteerResult.requiresManualPhotoUpload) {
          // Continue to extension method below
        } else {
          // Puppeteer failed completely, fall through to extension method
        }
      } catch (error) {
        // Fall through to extension method
      }
    }
    
    // Use extension method (works for everything except photo uploads)
    
    // Navigate to sell page if not already there
    if (!window.location.href.includes('/sell')) {
      window.location.href = 'https://www.mercari.com/sell/';
      
      // Wait for page to load, then retry
      window.addEventListener('load', () => {
        setTimeout(() => createMercariListing(listingData), 2000);
      }, { once: true });
      return { success: false, error: 'Navigating to sell page...', retrying: true };
    }
    
    // Wait for form to be ready (use actual Mercari selectors)
    await waitForElement('[data-testid="Title"], #sellName', 10000);
    
    // Fill in form fields
    const fillResult = await fillMercariForm(listingData);
    
    // Wait a bit for all changes to take effect
    await sleep(2000);
    
    // Check if photos are required but not uploaded
    const photoCount = document.querySelectorAll('[data-testid="Photo"]').length;
    const photosInData = listingData.photos && listingData.photos.length > 0;
    
    if (photoCount === 0 && !photosInData) {
      return {
        success: true,
        message: 'Form filled successfully. Please upload at least one photo manually and click the List button.',
        requiresManualPhotoUpload: true,
        filled: true
      };
    }
    
    // If photos are in listingData but not uploaded yet, don't submit
    if (photosInData && photoCount === 0) {
      return {
        success: true,
        message: 'Form filled successfully. Photos need to be uploaded. Please upload photos manually and click the List button.',
        requiresManualPhotoUpload: true,
        filled: true
      };
    }
    
    // Submit the form (only if photos are present)
    const submitResult = await submitMercariForm();
    
    return submitResult;
    
  } catch (error) {
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
    let dropdown = document.querySelector(`[data-testid="${testId}"]`);
    
    // Try alternative selectors
    if (!dropdown) {
      dropdown = document.querySelector(`[data-testid*="${testId}" i]`);
    }
    
    if (!dropdown) {
      return false;
    }
    
    // Scroll into view
    dropdown.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(200);
    
    // Click to open/focus
    dropdown.click();
    await sleep(500); // Wait for dropdown to open
    
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
    
    if (input && input.tagName === 'INPUT') {
      // Focus the input
      input.focus();
      await sleep(200);
      
      // Clear and set value
      input.value = '';
      input.value = text;
      
      // Dispatch events to trigger autocomplete
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
      
      await sleep(800); // Wait for autocomplete suggestions
      
      // Try to find and click the matching option
      const options = Array.from(document.querySelectorAll('[role="option"]'));
      const matchingOption = options.find(opt => 
        opt.textContent?.toLowerCase().includes(text.toLowerCase())
      );
      
      if (matchingOption) {
        matchingOption.click();
        await sleep(300);
        return true;
      }
      
      // If no matching option found, try pressing Enter
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await sleep(300);
      
      // Check if value was accepted
      if (input.value.toLowerCase().includes(text.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error typing into dropdown [${testId}]:`, error);
    return false;
  }
}

// Fill Mercari form fields
async function fillMercariForm(data) {
  try {
    // Wrap entire form fill in try-catch to prevent errors from stopping the process
    // 1. TITLE
    const titleInput = document.querySelector('[data-testid="Title"]') || 
                      document.querySelector('#sellName');
    if (titleInput && data.title) {
      titleInput.value = data.title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
    }
    
    // 2. DESCRIPTION
    const descInput = document.querySelector('[data-testid="Description"]') ||
                     document.querySelector('#sellDescription');
    if (descInput && data.description) {
      descInput.value = data.description;
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
      descInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
    }
    
    // 3. CATEGORY - Mercari-specific category (multi-level selection)
    if (data.mercariCategory) {
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
      let brandSuccess = false;
      
      // Try multiple approaches - but stop as soon as one succeeds
      // 1. Try typing first (Mercari brand is searchable)
      brandSuccess = await typeIntoMercariDropdown('Brand', data.brand);
      if (!brandSuccess) {
        // 2. If typing failed, try dropdown selection with exact match
        brandSuccess = await selectMercariDropdown('Brand', data.brand, false);
        if (!brandSuccess) {
          // 3. If exact match failed, try partial match
          brandSuccess = await selectMercariDropdown('Brand', data.brand, true);
          if (!brandSuccess && data.brand.includes(' ')) {
            // 4. Try with just the first word if brand has multiple words
            const firstWord = data.brand.split(' ')[0];
            brandSuccess = await selectMercariDropdown('Brand', firstWord, true);
          }
        }
      }
    }
    
    // 5. CONDITION
    if (data.condition) {
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
    const priceInput = document.querySelector('[data-testid="Price"]') ||
                      document.querySelector('#Price') ||
                      document.querySelector('[name="sellPrice"]');
    if (priceInput && data.price) {
      priceInput.value = String(data.price);
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      priceInput.dispatchEvent(new Event('blur', { bubbles: true }));
      await sleep(500);
    }
    
    // 10.5. SMART PRICING & SMART OFFERS (after price is set)
    if (data.smartPricing !== undefined || data.smartOffers !== undefined) {
      await sleep(1000); // Wait for price to process and toggles to appear
      
      // Smart Pricing toggle
      if (data.smartPricing !== undefined) {
        try {
          // Try multiple selectors for Smart Pricing toggle
          let smartPricingToggle = document.querySelector('[data-testid*="SmartPricing" i]') ||
                                   document.querySelector('[data-testid*="smart" i][data-testid*="pricing" i]') ||
                                   document.querySelector('input[type="checkbox"][name*="smart" i][name*="pricing" i]') ||
                                   document.querySelector('input[type="checkbox"][aria-label*="Smart Pricing" i]') ||
                                   document.querySelector('button[aria-label*="Smart Pricing" i]');
          
          // Try finding by text content - search more broadly
          if (!smartPricingToggle) {
            const allElements = Array.from(document.querySelectorAll('*'));
            const pricingElement = allElements.find(el => {
              const text = el.textContent?.toLowerCase() || '';
              return text.includes('smart pricing') && 
                     (el.tagName === 'LABEL' || el.tagName === 'SPAN' || el.tagName === 'DIV');
            });
            
            if (pricingElement) {
              // Look for toggle near the text
              const container = pricingElement.closest('div, label, form');
              if (container) {
                smartPricingToggle = container.querySelector('input[type="checkbox"], button, [role="switch"], [role="button"]') ||
                                    container.querySelector('[data-testid*="toggle"], [data-testid*="switch"]');
              }
              
              // Also try sibling elements
              if (!smartPricingToggle) {
                let sibling = pricingElement.nextElementSibling;
                for (let i = 0; i < 3 && sibling; i++) {
                  smartPricingToggle = sibling.querySelector('input[type="checkbox"], button, [role="switch"]');
                  if (smartPricingToggle) break;
                  sibling = sibling.nextElementSibling;
                }
              }
            }
          }
          
          if (smartPricingToggle) {
            // Check current state - Smart Pricing is ON by default on Mercari
            const isChecked = smartPricingToggle.checked || 
                            smartPricingToggle.getAttribute('aria-checked') === 'true' ||
                            smartPricingToggle.classList.contains('checked') ||
                            smartPricingToggle.getAttribute('aria-pressed') === 'true' ||
                            smartPricingToggle.getAttribute('data-state') === 'checked';
            
            // Only toggle if state doesn't match desired state
            if (data.smartPricing !== isChecked) {
              smartPricingToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await sleep(200);
              smartPricingToggle.click();
              await sleep(500); // Wait for toggle to activate and UI to update
              
              // If enabling Smart Pricing, look for Floor Price input
              if (data.smartPricing && data.floorPrice) {
                await sleep(500); // Wait for input field to appear
                
                // Try to find floor price input
                let floorPriceInput = document.querySelector('input[placeholder*="floor" i]') ||
                                     document.querySelector('input[placeholder*="minimum" i]') ||
                                     document.querySelector('input[name*="floor" i]') ||
                                     document.querySelector('input[name*="minimum" i]') ||
                                     document.querySelector('[data-testid*="Floor" i]') ||
                                     document.querySelector('[data-testid*="floor" i]');
                
                // Try finding by label text
                if (!floorPriceInput) {
                  const labels = Array.from(document.querySelectorAll('label, span, div'));
                  const floorLabel = labels.find(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    return text.includes('floor') && text.includes('price');
                  });
                  
                  if (floorLabel) {
                    const container = floorLabel.closest('div, form');
                    if (container) {
                      floorPriceInput = container.querySelector('input[type="text"], input[type="number"]');
                    }
                  }
                }
                
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
    
    // 11. PHOTOS - Handled by Puppeteer API, skip here
    // Extension method cannot upload photos due to browser security restrictions
    
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
  // Find the List button using actual Mercari selector
  const submitBtn = document.querySelector('[data-testid="ListButton"]') ||
                   document.querySelector('button[type="submit"]');
  
  if (!submitBtn) {
    return {
      success: false,
      error: 'List button not found on page'
    };
  }
  
  // Check if button is enabled (Mercari disables it if form is invalid)
  if (submitBtn.disabled) {
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
  
  submitBtn.click();
  
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
