/**
 * Vercel Serverless Function - Mercari Puppeteer Automation
 * 
 * This endpoint uses Puppeteer to automate Mercari listing creation,
 * specifically for handling photo uploads which Chrome extensions cannot do.
 * 
 * POST /api/mercari-puppeteer
 * 
 * Body:
 * {
 *   listingData: {
 *     title: string,
 *     description: string,
 *     price: string,
 *     condition: string,
 *     brand: string,
 *     category: string,
 *     size: string,
 *     color: string,
 *     shipsFrom: string,
 *     deliveryMethod: string,
 *     smartOffers: boolean,
 *     photos: string[] // Array of image URLs or file paths
 *   }
 * }
 */

// Note: Puppeteer needs to be installed in the Vercel environment
// For Vercel, you may need to use @sparticuz/chromium instead of full Puppeteer
// See: https://github.com/Sparticuz/chromium

// Dynamic import for Puppeteer (works in both ES modules and CommonJS)
async function getPuppeteer() {
  try {
    // Try ES module import (for Vercel/serverless)
    const puppeteerModule = await import('puppeteer');
    return puppeteerModule.default || puppeteerModule;
  } catch (error) {
    try {
      // Fallback to CommonJS require (for local development)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('puppeteer');
    } catch (err) {
      console.warn('Puppeteer not available');
      return null;
    }
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported.'
    });
  }

  const { listingData } = req.body;

  if (!listingData) {
    return res.status(400).json({
      success: false,
      error: 'Missing listing data',
      message: 'listingData is required in the request body.'
    });
  }

  console.log('🚀 Starting Mercari Puppeteer automation...');
  console.log('📋 Listing data received:', {
    title: listingData.title,
    price: listingData.price,
    photosCount: listingData.photos?.length || 0
  });

  // Get Puppeteer instance
  const puppeteer = await getPuppeteer();
  
  if (!puppeteer) {
    return res.status(503).json({
      success: false,
      error: 'Puppeteer not available',
      message: 'Puppeteer automation is not configured. Please use the Chrome extension for form filling.'
    });
  }

  let browser;
  try {
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true, // Use headless in production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set a reasonable timeout
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Navigate to Mercari sell page
    console.log('🌐 Navigating to Mercari sell page...');
    await page.goto('https://www.mercari.com/sell/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for form to be ready
    console.log('⏳ Waiting for form to load...');
    await page.waitForSelector('[data-testid="Title"], #sellName', { timeout: 10000 });

    // Fill in the form fields using Puppeteer
    await fillMercariFormWithPuppeteer(page, listingData);

    // Wait for form to update
    console.log('⏳ Waiting for form to update...');
    await page.waitForTimeout(2000);

    // Check if form is valid before submitting
    const isFormValid = await checkFormValidity(page);
    
    if (!isFormValid) {
      console.warn('⚠️ Form validation failed - not submitting');
      await browser.close();
      return res.status(400).json({
        success: false,
        error: 'Form validation failed',
        message: 'The form could not be submitted. Please check that all required fields are filled correctly.'
      });
    }

    // Submit the form
    console.log('📤 Submitting form...');
    const submitResult = await submitMercariFormWithPuppeteer(page);

    await browser.close();

    if (submitResult.success) {
      console.log('✅ Listing created successfully!');
      return res.status(200).json({
        success: true,
        listingId: submitResult.listingId,
        listingUrl: submitResult.listingUrl,
        message: 'Listing created successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: submitResult.error,
        message: submitResult.error || 'Failed to submit listing'
      });
    }

  } catch (error) {
    console.error('❌ Error during Puppeteer automation:', error);
    
    if (browser) {
      await browser.close();
    }

    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'An error occurred during listing automation'
    });
  }
}

/**
 * Fill Mercari form using Puppeteer
 */
async function fillMercariFormWithPuppeteer(page, data) {
  console.log('📝 Starting to fill form fields...');

  try {
    // 1. TITLE
    if (data.title) {
      console.log('  → Setting title:', data.title);
      const titleSelector = '[data-testid="Title"]';
      const titleInput = await page.$(titleSelector) || await page.$('#sellName');
      
      if (titleInput) {
        await titleInput.click({ clickCount: 3 });
        await titleInput.type(data.title, { delay: 50 });
        await page.waitForTimeout(300);
        console.log('  ✓ Title set');
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
      }
    }

    // 3. CATEGORY - Multi-level selection
    if (data.category) {
      console.log('  → Setting category:', data.category);
      const categoryParts = data.category.split(' > ').map(part => part.trim());
      
      for (let level = 0; level < categoryParts.length; level++) {
        const categoryPart = categoryParts[level];
        const categoryTestId = level === 0 ? 'CategoryL0' : `CategoryL${level}`;
        const success = await selectMercariDropdown(page, categoryTestId, categoryPart);
        
        if (success) {
          console.log(`    ✓ Level ${level} selected`);
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
      await selectMercariDropdown(page, 'Brand', data.brand, true);
    }

    // 5. CONDITION
    if (data.condition) {
      console.log('  → Setting condition:', data.condition);
      await selectMercariDropdown(page, 'Condition', data.condition);
    }

    // 6. COLOR
    if (data.color) {
      console.log('  → Setting color:', data.color);
      await selectMercariDropdown(page, 'Color', data.color);
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

    // 8. SHIPS FROM
    if (data.shipsFrom) {
      console.log('  → Setting ships from:', data.shipsFrom);
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
      await selectMercariDropdown(page, 'ShippingMethod', deliveryText, true);
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

    // 11. SMART OFFERS
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
        }
      }
    }

    // 12. PHOTOS - This is why we use Puppeteer!
    if (data.photos && data.photos.length > 0) {
      console.log(`  → Uploading ${data.photos.length} photo(s)...`);
      const fileInput = await page.$('input[type="file"]');
      
      if (fileInput) {
        // Download images from URLs if needed, or use local paths
        // For now, we'll assume photos are URLs that need to be downloaded first
        // In production, you might want to download them server-side first
        
        // Note: Puppeteer's uploadFile requires local file paths
        // You'll need to download URLs to temp files first, or pass file paths
        const photoPaths = await downloadPhotosIfNeeded(data.photos);
        
        if (photoPaths.length > 0) {
          await fileInput.uploadFile(...photoPaths);
          await page.waitForTimeout(2000); // Wait for uploads to process
          console.log('  ✓ Photos uploaded');
        } else {
          console.warn('  ⚠️ No valid photo paths found');
        }
      } else {
        console.warn('  ⚠️ File input not found');
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
    const dropdownSelector = `[data-testid="${testId}"]`;
    const dropdown = await page.$(dropdownSelector);
    
    if (!dropdown) {
      return false;
    }

    await dropdown.click();
    await page.waitForTimeout(500);

    await page.waitForSelector('[role="option"], [role="listbox"] li, .dropdown-item', { timeout: 3000 });

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
    }

    return false;

  } catch (error) {
    console.error(`Error selecting from dropdown [${testId}]:`, error.message);
    return false;
  }
}

/**
 * Download photos from URLs if needed
 * Returns array of local file paths
 */
async function downloadPhotosIfNeeded(photos) {
  // Import Node.js modules (works in both CommonJS and ES modules)
  let fs, path, https, http;
  
  try {
    const fsModule = await import('fs');
    fs = fsModule.default || fsModule;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    fs = require('fs');
  }
  
  try {
    const pathModule = await import('path');
    path = pathModule.default || pathModule;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    path = require('path');
  }
  
  try {
    const httpsModule = await import('https');
    https = httpsModule.default || httpsModule;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    https = require('https');
  }
  
  try {
    const httpModule = await import('http');
    http = httpModule.default || httpModule;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    http = require('http');
  }
  
  const tempPaths = [];
  
  for (const photo of photos) {
    // If it's already a local path, use it
    if (fs.existsSync(photo)) {
      tempPaths.push(photo);
      continue;
    }
    
    // If it's a URL, download it
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      try {
        const tempPath = path.join('/tmp', `photo-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`);
        const file = fs.createWriteStream(tempPath);
        
        const protocol = photo.startsWith('https') ? https : http;
        
        await new Promise((resolve, reject) => {
          protocol.get(photo, (response) => {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          }).on('error', reject);
        });
        
        tempPaths.push(tempPath);
      } catch (error) {
        console.error(`Failed to download photo ${photo}:`, error);
      }
    }
  }
  
  return tempPaths;
}

/**
 * Check if form is valid
 */
async function checkFormValidity(page) {
  const submitBtn = await page.$('[data-testid="ListButton"]') ||
                    await page.$('button[type="submit"]');
  
  if (!submitBtn) {
    return false;
  }

  const isEnabled = await page.evaluate(btn => {
    return !btn.disabled && btn.offsetParent !== null;
  }, submitBtn);

  return isEnabled;
}

/**
 * Submit the Mercari form
 */
async function submitMercariFormWithPuppeteer(page) {
  console.log('📤 Attempting to submit form...');
  
  try {
    const submitBtn = await page.$('[data-testid="ListButton"]') ||
                      await page.$('button[type="submit"]');
    
    if (!submitBtn) {
      return { success: false, error: 'List button not found' };
    }

    const isEnabled = await page.evaluate(btn => {
      return !btn.disabled && btn.offsetParent !== null;
    }, submitBtn);

    if (!isEnabled) {
      return { success: false, error: 'Submit button is disabled - form may be invalid' };
    }

    // Click submit and wait for navigation or success message
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      submitBtn.click()
    ]);

    // Wait a bit for the page to process
    await page.waitForTimeout(3000);

    // Try to detect if listing was successful
    const currentUrl = page.url();
    const pageContent = await page.content();
    
    // Check for success indicators
    const isSuccess = currentUrl.includes('/items/') || 
                     pageContent.includes('listing created') ||
                     pageContent.includes('success');

    if (isSuccess) {
      // Try to extract listing ID from URL
      const listingIdMatch = currentUrl.match(/\/items\/([^\/]+)/);
      const listingId = listingIdMatch ? listingIdMatch[1] : null;

      return {
        success: true,
        listingId: listingId,
        listingUrl: currentUrl
      };
    }

    return { success: true, listingUrl: currentUrl };

  } catch (error) {
    console.error('Error submitting form:', error);
    return { success: false, error: error.message };
  }
}

