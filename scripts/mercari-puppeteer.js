// Note: This script uses CommonJS (require) even though package.json has "type": "module"
// If you get module errors, rename this file to mercari-puppeteer.cjs
const puppeteer = require('puppeteer');

/**
 * Mercari Crosslisting Automation with Puppeteer
 * 
 * This script automates the Mercari listing creation process.
 * It can be extended for Facebook Marketplace later.
 * 
 * Usage:
 *   node scripts/mercari-puppeteer.js
 * 
 * Or with data:
 *   node scripts/mercari-puppeteer.js --title "Item Title" --price "29.99"
 */

// Default listing data structure
const defaultListingData = {
  title: "Test Item",
  description: "This is a test listing created with Puppeteer automation.",
  price: "29.99",
  condition: "Like New",
  brand: "Nike",
  category: "Women > Clothing > Tops & Blouses", // Mercari category path
  size: "M",
  color: "Black",
  shipsFrom: "90210", // Zip code
  deliveryMethod: "prepaid", // "prepaid" or "ship_on_own"
  smartOffers: false,
  photos: [] // Array of file paths
};

/**
 * Main function to create a Mercari listing
 */
async function createMercariListing(listingData = defaultListingData) {
  console.log('🚀 Starting Mercari listing automation...');
  console.log('📋 Listing data:', listingData);
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to Mercari sell page
    console.log('🌐 Navigating to Mercari sell page...');
    await page.goto('https://www.mercari.com/sell/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for form to be ready
    console.log('⏳ Waiting for form to load...');
    await page.waitForSelector('[data-testid="Title"], #sellName', { timeout: 10000 });

    // Fill in the form fields
    await fillMercariForm(page, listingData);

    // Wait a bit for all changes to take effect
    console.log('⏳ Waiting 2s for form to update...');
    await page.waitForTimeout(2000);

    // Submit the form (optional - comment out if you want to review before submitting)
    // await submitMercariForm(page);

    console.log('✅ Form filling complete!');
    console.log('💡 Review the form in the browser before submitting manually.');
    
    // Keep browser open for review (remove this if you want auto-close)
    console.log('⏸️  Browser will stay open for 30 seconds for review...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Error during automation:', error);
    throw error;
  } finally {
    // Uncomment to auto-close browser
    // await browser.close();
  }
}

/**
 * Fill Mercari form fields using Puppeteer
 */
async function fillMercariForm(page, data) {
  console.log('📝 Starting to fill form fields...');

  try {
    // 1. TITLE
    if (data.title) {
      console.log('  → Setting title:', data.title);
      const titleSelector = '[data-testid="Title"]';
      const titleInput = await page.$(titleSelector) || await page.$('#sellName');
      
      if (titleInput) {
        await titleInput.click({ clickCount: 3 }); // Select all existing text
        await titleInput.type(data.title, { delay: 50 }); // Type with delay to seem more human
        await page.waitForTimeout(300);
        console.log('  ✓ Title set');
      } else {
        console.warn('  ⚠️ Title input not found');
      }
    }

    // 2. DESCRIPTION
    if (data.description) {
      console.log('  → Setting description...');
      const descSelector = '[data-testid="Description"]';
      const descInput = await page.$(descSelector) || await page.$('#sellDescription');
      
      if (descInput) {
        await descInput.click({ clickCount: 3 });
        await descInput.type(data.description, { delay: 30 });
        await page.waitForTimeout(300);
        console.log('  ✓ Description set');
      } else {
        console.warn('  ⚠️ Description input not found');
      }
    }

    // 3. CATEGORY - Multi-level selection
    if (data.category) {
      console.log('  → Setting category:', data.category);
      const categoryParts = data.category.split(' > ').map(part => part.trim());
      
      for (let level = 0; level < categoryParts.length; level++) {
        const categoryPart = categoryParts[level];
        console.log(`    → Selecting level ${level}: "${categoryPart}"`);
        
        const categoryTestId = level === 0 ? 'CategoryL0' : `CategoryL${level}`;
        const success = await selectMercariDropdown(page, categoryTestId, categoryPart);
        
        if (success) {
          console.log(`    ✓ Level ${level} selected`);
          // Wait for next level to load
          if (level < categoryParts.length - 1) {
            await page.waitForTimeout(1000);
          }
        } else {
          console.error(`    ❌ Failed to select level ${level}`);
          break;
        }
      }
    }

    // 4. BRAND
    if (data.brand) {
      console.log('  → Setting brand:', data.brand);
      const brandSuccess = await selectMercariDropdown(page, 'Brand', data.brand, true);
      if (brandSuccess) {
        console.log('  ✓ Brand set');
      }
    }

    // 5. CONDITION
    if (data.condition) {
      console.log('  → Setting condition:', data.condition);
      const conditionSuccess = await selectMercariDropdown(page, 'Condition', data.condition);
      if (conditionSuccess) {
        console.log('  ✓ Condition set');
      }
    }

    // 6. COLOR
    if (data.color) {
      console.log('  → Setting color:', data.color);
      const colorSuccess = await selectMercariDropdown(page, 'Color', data.color);
      if (colorSuccess) {
        console.log('  ✓ Color set');
      }
    }

    // 7. SIZE
    if (data.size) {
      console.log('  → Setting size:', data.size);
      const sizeInput = await page.$('[data-testid="Size"]') || 
                        await page.$('input[name*="size" i]');
      if (sizeInput) {
        await sizeInput.click({ clickCount: 3 });
        await sizeInput.type(data.size, { delay: 50 });
        await page.waitForTimeout(300);
        console.log('  ✓ Size set');
      }
    }

    // 8. SHIPS FROM (zip code)
    if (data.shipsFrom) {
      console.log('  → Setting ships from:', data.shipsFrom);
      // Try to click Edit button first if it exists
      const editButton = await page.$('[data-testid="ShipsFromEditButton"]');
      if (editButton) {
        await editButton.click();
        await page.waitForTimeout(500);
      }
      
      const zipInput = await page.$('input[name*="zip" i]') || 
                       await page.$('input[placeholder*="zip" i]');
      if (zipInput) {
        await zipInput.click({ clickCount: 3 });
        await zipInput.type(data.shipsFrom, { delay: 50 });
        await page.waitForTimeout(300);
        console.log('  ✓ Ships from set');
      }
    }

    // 9. DELIVERY METHOD
    if (data.deliveryMethod) {
      console.log('  → Setting delivery method:', data.deliveryMethod);
      const deliveryText = data.deliveryMethod === 'prepaid' ? 'Prepaid' : 'Ship on your own';
      const deliverySuccess = await selectMercariDropdown(page, 'ShippingMethod', deliveryText, true);
      if (deliverySuccess) {
        console.log('  ✓ Delivery method set');
      }
    }

    // 10. PRICE
    if (data.price) {
      console.log('  → Setting price:', data.price);
      const priceInput = await page.$('[data-testid="Price"]') || 
                         await page.$('#Price');
      if (priceInput) {
        await priceInput.click({ clickCount: 3 });
        await priceInput.type(data.price, { delay: 50 });
        await page.waitForTimeout(300);
        console.log('  ✓ Price set');
      }
    }

    // 11. SMART OFFERS TOGGLE
    if (data.smartOffers !== undefined) {
      console.log(`  → Setting Smart Offers: ${data.smartOffers}`);
      const smartOffersToggle = await page.$('[data-testid*="SmartOffers"]') ||
                                await page.$('input[type="checkbox"][name*="smart" i]') ||
                                await page.$('button[aria-label*="Smart Offers" i]');
      
      if (smartOffersToggle) {
        const isChecked = await page.evaluate(el => {
          return el.checked || el.getAttribute('aria-checked') === 'true';
        }, smartOffersToggle);
        
        if (data.smartOffers !== isChecked) {
          await smartOffersToggle.click();
          await page.waitForTimeout(300);
          console.log(`  ✓ Smart Offers ${data.smartOffers ? 'enabled' : 'disabled'}`);
        }
      }
    }

    // 12. PHOTOS - File upload
    if (data.photos && data.photos.length > 0) {
      console.log(`  → Uploading ${data.photos.length} photo(s)...`);
      const fileInput = await page.$('input[type="file"]');
      
      if (fileInput) {
        // Puppeteer file upload
        await fileInput.uploadFile(...data.photos);
        await page.waitForTimeout(1000);
        console.log('  ✓ Photos uploaded');
      } else {
        console.warn('  ⚠️ File input not found - photos may need manual upload');
      }
    }

    console.log('✅ All form fields filled!');
    return true;

  } catch (error) {
    console.error('❌ Error filling form:', error);
    throw error;
  }
}

/**
 * Helper: Select option from Mercari dropdown
 */
async function selectMercariDropdown(page, testId, optionText, partialMatch = false) {
  try {
    // Find the dropdown button/trigger
    const dropdownSelector = `[data-testid="${testId}"]`;
    const dropdown = await page.$(dropdownSelector);
    
    if (!dropdown) {
      console.warn(`    ⚠️ Dropdown [${testId}] not found`);
      return false;
    }

    // Click to open dropdown
    await dropdown.click();
    await page.waitForTimeout(500); // Wait for dropdown to open

    // Wait for dropdown options to appear
    await page.waitForSelector('[role="option"], [role="listbox"] li, .dropdown-item', { timeout: 3000 });

    // Find and click the option
    const optionSelector = partialMatch
      ? `[role="option"]:has-text("${optionText}"), li:has-text("${optionText}")`
      : `[role="option"]:has-text("${optionText}"), li:has-text("${optionText}")`;

    // Try multiple approaches to find the option
    const optionFound = await page.evaluate((text, partial) => {
      const options = Array.from(document.querySelectorAll('[role="option"], [role="listbox"] li, .dropdown-item, [data-testid*="Option"]'));
      
      for (const option of options) {
        const optionText = option.textContent?.trim() || '';
        const matches = partial 
          ? optionText.toLowerCase().includes(text.toLowerCase())
          : optionText.toLowerCase() === text.toLowerCase();
        
        if (matches) {
          option.click();
          return true;
        }
      }
      return false;
    }, optionText, partialMatch);

    if (optionFound) {
      await page.waitForTimeout(300);
      return true;
    } else {
      console.warn(`    ⚠️ Option "${optionText}" not found in dropdown [${testId}]`);
      return false;
    }

  } catch (error) {
    console.error(`    ❌ Error selecting from dropdown [${testId}]:`, error.message);
    return false;
  }
}

/**
 * Submit the Mercari form
 */
async function submitMercariForm(page) {
  console.log('📤 Attempting to submit form...');
  
  try {
    // Find the List button
    const submitBtn = await page.$('[data-testid="ListButton"]') ||
                      await page.$('button[type="submit"]');
    
    if (!submitBtn) {
      console.error('❌ Submit button not found');
      return { success: false, error: 'List button not found' };
    }

    // Check if button is enabled
    const isEnabled = await page.evaluate(btn => {
      return !btn.disabled && btn.offsetParent !== null;
    }, submitBtn);

    if (!isEnabled) {
      console.warn('⚠️ Submit button is disabled - form may be invalid');
      return { success: false, error: 'Submit button is disabled' };
    }

    // Click submit
    await submitBtn.click();
    await page.waitForTimeout(2000);
    
    console.log('✅ Form submitted!');
    return { success: true };

  } catch (error) {
    console.error('❌ Error submitting form:', error);
    return { success: false, error: error.message };
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const data = { ...defaultListingData };
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    
    if (key && value) {
      // Convert string numbers to numbers
      if (key === 'price') {
        data[key] = value;
      } else if (key === 'smartOffers') {
        data[key] = value === 'true';
      } else if (key === 'photos') {
        data[key] = value.split(',');
      } else {
        data[key] = value;
      }
    }
  }
  
  return data;
}

// Run if called directly
if (require.main === module) {
  const listingData = parseArgs();
  createMercariListing(listingData)
    .then(() => {
      console.log('🎉 Automation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Automation failed:', error);
      process.exit(1);
    });
}

// Export for use as module
module.exports = {
  createMercariListing,
  fillMercariForm,
  submitMercariForm,
  selectMercariDropdown
};

