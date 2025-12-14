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

    // 11. SMART PRICING (check first - it's ON by default)
    if (data.smartPricing !== undefined) {
      console.log(`  → Setting Smart Pricing: ${data.smartPricing}`);
      let smartPricingToggle = await page.$('[data-testid*="SmartPricing" i]') ||
                               await page.$('input[type="checkbox"][name*="smart" i][name*="pricing" i]') ||
                               await page.$('button[aria-label*="Smart Pricing" i]');
      
      // Try finding by text if not found
      if (!smartPricingToggle) {
        smartPricingToggle = await page.evaluateHandle(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const pricingElement = elements.find(el => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes('smart pricing');
          });
          if (pricingElement) {
            const container = pricingElement.closest('div, label, form');
            if (container) {
              return container.querySelector('input[type="checkbox"], button, [role="switch"]');
            }
          }
          return null;
        });
      }
      
      if (smartPricingToggle && smartPricingToggle.asElement()) {
        const isChecked = await page.evaluate(el => {
          return el.checked || 
                 el.getAttribute('aria-checked') === 'true' ||
                 el.classList.contains('checked') ||
                 el.getAttribute('aria-pressed') === 'true' ||
                 el.getAttribute('data-state') === 'checked';
        }, smartPricingToggle);
        
        console.log(`    Current state: ${isChecked ? 'ON' : 'OFF'}, Desired: ${data.smartPricing ? 'ON' : 'OFF'}`);
        
        if (data.smartPricing !== isChecked) {
          await smartPricingToggle.click();
          await page.waitForTimeout(500);
          console.log(`  ✓ Smart Pricing ${data.smartPricing ? 'enabled' : 'disabled'}`);
          
          // If enabling, fill floor price
          if (data.smartPricing && data.floorPrice) {
            await page.waitForTimeout(500);
            const floorPriceInput = await page.$('input[placeholder*="floor" i]') ||
                                   await page.$('input[name*="floor" i]') ||
                                   await page.$('[data-testid*="Floor" i]');
            if (floorPriceInput) {
              await floorPriceInput.click({ clickCount: 3 });
              await floorPriceInput.type(String(data.floorPrice), { delay: 50 });
              console.log(`  ✓ Floor Price set: ${data.floorPrice}`);
            }
          }
        } else {
          console.log(`  ✓ Smart Pricing already ${data.smartPricing ? 'enabled' : 'disabled'}`);
        }
      }
    }

    // 12. SMART OFFERS
    if (data.smartOffers !== undefined) {
      console.log(`  → Setting Smart Offers: ${data.smartOffers}`);
      let smartOffersToggle = await page.$('[data-testid*="SmartOffers" i]') ||
                              await page.$('input[type="checkbox"][name*="smart" i][name*="offers" i]') ||
                              await page.$('button[aria-label*="Smart Offers" i]');
      
      // Try finding by text if not found
      if (!smartOffersToggle) {
        smartOffersToggle = await page.evaluateHandle(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const offersElement = elements.find(el => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes('smart offers');
          });
          if (offersElement) {
            const container = offersElement.closest('div, label, form');
            if (container) {
              return container.querySelector('input[type="checkbox"], button, [role="switch"]');
            }
          }
          return null;
        });
      }
      
      if (smartOffersToggle && smartOffersToggle.asElement()) {
        const isChecked = await page.evaluate(el => {
          return el.checked || 
                 el.getAttribute('aria-checked') === 'true' ||
                 el.classList.contains('checked') ||
                 el.getAttribute('aria-pressed') === 'true' ||
                 el.getAttribute('data-state') === 'checked';
        }, smartOffersToggle);
        
        if (data.smartOffers !== isChecked) {
          await smartOffersToggle.click();
          await page.waitForTimeout(500);
          console.log(`  ✓ Smart Offers ${data.smartOffers ? 'enabled' : 'disabled'}`);
          
          // If enabling, fill minimum price
          if (data.smartOffers && data.minimumPrice) {
            await page.waitForTimeout(500);
            const minimumPriceInput = await page.$('input[placeholder*="minimum" i]') ||
                                    await page.$('input[name*="minimum" i]') ||
                                    await page.$('[data-testid*="Minimum" i]');
            if (minimumPriceInput) {
              await minimumPriceInput.click({ clickCount: 3 });
              await minimumPriceInput.type(String(data.minimumPrice), { delay: 50 });
              console.log(`  ✓ Minimum Price set: ${data.minimumPrice}`);
            }
          }
        } else {
          console.log(`  ✓ Smart Offers already ${data.smartOffers ? 'enabled' : 'disabled'}`);
        }
      }
    }

    // 13. PHOTOS - This is why we use Puppeteer!
    if (data.photos && data.photos.length > 0) {
      console.log(`  → Uploading ${data.photos.length} photo(s)...`);
      
      // Try multiple selectors for file input
      let fileInput = await page.$('input[type="file"]') ||
                     await page.$('input[accept*="image"]') ||
                     await page.$('[data-testid*="Photo"] input[type="file"]') ||
                     await page.$('[data-testid*="photo"] input[type="file"]');
      
      if (!fileInput) {
        // Try clicking upload button first to reveal file input
        const uploadButton = await page.$('button[aria-label*="photo" i]') ||
                            await page.$('button[aria-label*="image" i]') ||
                            await page.$('[data-testid*="Photo"] button') ||
                            await page.$('[data-testid*="Upload"]');
        
        if (uploadButton) {
          console.log('  → Clicking upload button to reveal file input...');
          await uploadButton.click();
          await page.waitForTimeout(500);
          fileInput = await page.$('input[type="file"]');
        }
      }
      
      if (fileInput) {
        // Download/convert images from URLs or base64 to local file paths
        const photoPaths = await downloadPhotosIfNeeded(data.photos);
        
        if (photoPaths.length > 0) {
          console.log(`  → Uploading ${photoPaths.length} photo file(s)...`);
          
          // Puppeteer's uploadFile method - correct syntax: element.uploadFile(filePath)
          // For multiple files, Mercari file input should support multiple file selection
          // Upload all files at once if possible, otherwise one by one
          try {
            // Try uploading all files at once (if Mercari input supports multiple)
            if (photoPaths.length === 1) {
              await fileInput.uploadFile(photoPaths[0]);
            } else {
              // For multiple files, try uploading all at once
              // Some file inputs support multiple files via array
              await fileInput.uploadFile(...photoPaths);
            }
          } catch (error) {
            // If that fails, upload one by one
            for (const photoPath of photoPaths) {
              const currentFileInput = await page.$('input[type="file"]');
              if (currentFileInput) {
                await currentFileInput.uploadFile(photoPath);
                await page.waitForTimeout(500); // Small delay between uploads
              }
            }
          }
          
          // Wait for uploads to process - Mercari shows upload progress
          console.log('  → Waiting for photos to upload...');
          await page.waitForTimeout(4000); // Give Mercari more time to process uploads
          
          // Verify photos were uploaded by checking for image previews or upload indicators
          const photoPreviews = await page.$$('[data-testid*="Photo"] img, [data-testid*="photo"] img, .photo-preview img, img[alt*="photo" i]');
          if (photoPreviews.length > 0) {
            console.log(`  ✓ ${photoPreviews.length} photo(s) uploaded successfully`);
          } else {
            // Also check for upload progress indicators
            const uploadIndicators = await page.$$('[class*="upload"], [class*="progress"], [aria-label*="upload" i]');
            if (uploadIndicators.length === 0) {
              console.log('  ✓ Photos uploaded (verification pending)');
            } else {
              console.log('  → Photos are uploading...');
            }
          }
        } else {
          console.warn('  ⚠️ No valid photo paths found after processing');
        }
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
 * Download photos from URLs or convert base64 to files if needed
 * Returns array of local file paths
 */
async function downloadPhotosIfNeeded(photos) {
  // Import Node.js modules (works in both CommonJS and ES modules)
  let fs, path, https, http, os;
  
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
  
  try {
    const osModule = await import('os');
    os = osModule.default || osModule;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    os = require('os');
  }
  
  const tempPaths = [];
  const tempDir = os.tmpdir ? os.tmpdir() : '/tmp';
  
  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    
    // If it's already a local path, use it
    if (fs.existsSync(photo)) {
      tempPaths.push(photo);
      continue;
    }
    
    // If it's a base64 data URL, convert it to a file
    if (photo.startsWith('data:image/')) {
      try {
        const matches = photo.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          
          const tempPath = path.join(tempDir, `photo-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}.${ext}`);
          fs.writeFileSync(tempPath, buffer);
          tempPaths.push(tempPath);
          console.log(`  → Converted base64 image ${i + 1} to file`);
        }
      } catch (error) {
        console.error(`Failed to convert base64 photo ${i + 1}:`, error);
      }
      continue;
    }
    
    // If it's a URL, download it
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      try {
        // Determine file extension from URL or Content-Type
        const urlPath = new URL(photo).pathname;
        let ext = 'jpg'; // default
        if (urlPath.includes('.')) {
          const urlExt = path.extname(urlPath).substring(1).toLowerCase();
          if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(urlExt)) {
            ext = urlExt === 'jpeg' ? 'jpg' : urlExt;
          }
        }
        
        const tempPath = path.join(tempDir, `photo-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}.${ext}`);
        const file = fs.createWriteStream(tempPath);
        
        const protocol = photo.startsWith('https') ? https : http;
        
        await new Promise((resolve, reject) => {
          protocol.get(photo, (response) => {
            // Check if it's actually an image
            const contentType = response.headers['content-type'];
            if (contentType && !contentType.startsWith('image/')) {
              reject(new Error(`URL does not point to an image: ${contentType}`));
              return;
            }
            
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          }).on('error', (err) => {
            file.close();
            fs.unlinkSync(tempPath).catch(() => {}); // Delete partial file
            reject(err);
          });
        });
        
        // Verify file was created and has content
        const stats = fs.statSync(tempPath);
        if (stats.size > 0) {
          tempPaths.push(tempPath);
          console.log(`  → Downloaded photo ${i + 1} from URL (${stats.size} bytes)`);
        } else {
          fs.unlinkSync(tempPath);
          console.warn(`  ⚠️ Downloaded file is empty: ${photo}`);
        }
      } catch (error) {
        console.error(`Failed to download photo ${i + 1} from ${photo}:`, error.message);
      }
    } else {
      console.warn(`  ⚠️ Unknown photo format: ${photo.substring(0, 50)}...`);
    }
  }
  
  console.log(`  → Processed ${tempPaths.length} out of ${photos.length} photos`);
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

