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

    // Intercept network requests to capture auth tokens
    let capturedAuthToken = null;
    let capturedCsrfToken = null;
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      const headers = request.headers();
      
      // Capture tokens from requests to Mercari API
      if (url.includes('mercari.com/v1/api') || url.includes('mercari.com/api')) {
        const authHeader = headers['authorization'] || headers['Authorization'];
        const csrfHeader = headers['x-csrf-token'] || headers['X-CSRF-Token'] || headers['x-csrf-token'];
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          capturedAuthToken = authHeader.replace('Bearer ', '').trim();
          console.log('🔑 Captured auth token from network request');
        }
        
        if (csrfHeader) {
          capturedCsrfToken = csrfHeader.trim();
          console.log('🔑 Captured CSRF token from network request');
        }
      }
      
      // Continue with the request
      request.continue();
    });
    
    // Also intercept responses to capture tokens from response headers
    page.on('response', (response) => {
      const url = response.url();
      const headers = response.headers();
      
      // Capture CSRF token from response headers (sometimes set via Set-Cookie)
      if (url.includes('mercari.com')) {
        const setCookieHeader = headers['set-cookie'];
        if (setCookieHeader) {
          const csrfMatch = setCookieHeader.match(/csrf-token=([^;]+)/i) || 
                           setCookieHeader.match(/X-CSRF-Token=([^;]+)/i);
          if (csrfMatch && !capturedCsrfToken) {
            capturedCsrfToken = csrfMatch[1];
            console.log('🔑 Captured CSRF token from response header');
          }
        }
      }
    });

    // Navigate to Mercari sell page
    console.log('🌐 Navigating to Mercari sell page...');
    await page.goto('https://www.mercari.com/sell/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for API calls to complete and capture tokens
    console.log('⏳ Waiting for API calls to capture authentication tokens...');
    await page.waitForTimeout(3000);
    
    // Log captured tokens (without exposing full token)
    if (capturedAuthToken) {
      console.log(`✓ Auth token captured: ${capturedAuthToken.substring(0, 20)}...`);
    } else {
      console.warn('⚠️ Auth token not captured from network requests');
    }
    
    if (capturedCsrfToken) {
      console.log(`✓ CSRF token captured: ${capturedCsrfToken.substring(0, 10)}...`);
    } else {
      console.warn('⚠️ CSRF token not captured from network requests');
    }

    // Wait for form to be ready
    console.log('⏳ Waiting for form to load...');
    await page.waitForSelector('[data-testid="Title"], #sellName', { timeout: 10000 });

    // Fill in the form fields using Puppeteer
    await fillMercariFormWithPuppeteer(page, listingData, {
      authToken: capturedAuthToken,
      csrfToken: capturedCsrfToken
    });

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
async function fillMercariFormWithPuppeteer(page, data, capturedTokens = {}) {
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
      // Use exact Mercari selector: data-testid="SmartPricingButton"
      let smartPricingToggle = await page.$('[data-testid="SmartPricingButton"]');
      
      if (smartPricingToggle) {
        // Mercari uses aria-pressed: "true" = ON, "false" = OFF
        const isChecked = await page.evaluate(el => {
          return el.getAttribute('aria-pressed') === 'true';
        }, smartPricingToggle);
        
        console.log(`    Current state: ${isChecked ? 'ON' : 'OFF'}, Desired: ${data.smartPricing ? 'ON' : 'OFF'}`);
        
        if (data.smartPricing !== isChecked) {
          await smartPricingToggle.click();
          await page.waitForTimeout(500);
          console.log(`  ✓ Smart Pricing ${data.smartPricing ? 'enabled' : 'disabled'}`);
          
          // If enabling, fill floor price using exact Mercari selectors
          if (data.smartPricing && data.floorPrice) {
            await page.waitForTimeout(500);
            let floorPriceInput = await page.$('[data-testid="SmartPricingFloorPrice"]') ||
                                 await page.$('#sellMinPriceForAutoPriceDrop') ||
                                 await page.$('input[placeholder*="floor" i]') ||
                                 await page.$('input[name*="floor" i]');
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

    // 13. PHOTOS - Upload using Mercari's GraphQL API
    if (data.photos && data.photos.length > 0) {
      console.log(`  → Uploading ${data.photos.length} photo(s) via GraphQL API...`);
      
      // Download/convert images from URLs or base64 to local file paths
      const photoPaths = await downloadPhotosIfNeeded(data.photos);
      
      if (photoPaths.length === 0) {
        console.warn('  ⚠️ No valid photo paths found after processing');
        return;
      }
      
      // Use captured tokens from network interception, or extract from page as fallback
      let authToken = capturedTokens.authToken;
      let csrfToken = capturedTokens.csrfToken;
      
      // If tokens weren't captured, try to extract from page
      if (!authToken || !csrfToken) {
        console.log('  → Tokens not captured from network, extracting from page...');
        const pageHeaders = await page.evaluate(() => {
          // Try to get authorization token from localStorage or sessionStorage
          let authToken = localStorage.getItem('auth_token') || 
                         localStorage.getItem('token') ||
                         localStorage.getItem('accessToken') ||
                         sessionStorage.getItem('auth_token') ||
                         sessionStorage.getItem('token');
          
          // If not found, check all cookies for JWT tokens (they start with 'eyJ')
          if (!authToken) {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
              const [name, value] = cookie.trim().split('=');
              // Check for JWT tokens (start with 'eyJ') or common token cookie names
              if (value && (value.startsWith('eyJ') || 
                           name.toLowerCase().includes('token') || 
                           name.toLowerCase().includes('auth') || 
                           name.toLowerCase().includes('access'))) {
                authToken = value;
                break;
              }
            }
          }
          
          // Try to get CSRF token from meta tag or cookie
          const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content ||
                           document.cookie.match(/csrf-token=([^;]+)/)?.[1] ||
                           document.cookie.match(/X-CSRF-Token=([^;]+)/)?.[1] ||
                           document.cookie.match(/csrf_token=([^;]+)/)?.[1];
          
          return {
            authToken,
            csrfToken,
            userAgent: navigator.userAgent
          };
        });
        
        if (!authToken) authToken = pageHeaders.authToken;
        if (!csrfToken) csrfToken = pageHeaders.csrfToken;
      } else {
        console.log('  → Using tokens captured from network requests');
      }
      
      if (!authToken) {
        throw new Error('Could not find authorization token. Please ensure you are logged into Mercari.');
      }
      
      if (!csrfToken) {
        throw new Error('Could not find CSRF token. Please ensure you are logged into Mercari.');
      }
      
      // Upload each photo using Mercari's GraphQL API
      const uploadIds = [];
      
      for (let i = 0; i < photoPaths.length; i++) {
        const photoPath = photoPaths[i];
        console.log(`  → Uploading photo ${i + 1}/${photoPaths.length}...`);
        
        try {
          // Read file as base64 for serialization
          let fs;
          try {
            const fsModule = await import('fs');
            fs = fsModule.default || fsModule;
          } catch {
            fs = require('fs');
          }
          
          const fileBuffer = fs.readFileSync(photoPath);
          const fileBase64 = fileBuffer.toString('base64');
          const fileName = photoPath.split('/').pop() || `photo-${i}.jpg`;
          
          // Determine MIME type from file extension
          const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
          const mimeType = ext === 'png' ? 'image/png' : 
                          ext === 'gif' ? 'image/gif' : 
                          ext === 'webp' ? 'image/webp' : 'image/jpeg';
          
          // Upload using page.evaluate to make fetch call in browser context
          const uploadResult = await page.evaluate(async ({ fileBase64, fileName, mimeType, authToken, csrfToken }) => {
            // Convert base64 to Blob
            const byteCharacters = atob(fileBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let j = 0; j < byteCharacters.length; j++) {
              byteNumbers[j] = byteCharacters.charCodeAt(j);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            
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
            // Mercari expects filename to be "blob" in the FormData
            formData.append('1', blob, 'blob');
            
            // Build headers with the provided tokens
            const fetchHeaders = {
              'accept': '*/*',
              'accept-language': 'en-US,en;q=0.9',
              'apollo-require-preflight': 'true',
              'x-platform': 'web',
              'x-double-web': '1',
              'x-app-version': '1'
            };
            
            if (csrfToken) {
              fetchHeaders['x-csrf-token'] = csrfToken;
            }
            
            if (authToken) {
              fetchHeaders['authorization'] = `Bearer ${authToken}`;
            }
            
            // Make fetch request
            const response = await fetch('https://www.mercari.com/v1/api', {
              method: 'POST',
              headers: fetchHeaders,
              credentials: 'include',
              body: formData
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
            }
            
            const result = await response.json();
            
            if (result.data?.uploadTempListingPhotos?.uploadIds?.[0]) {
              return {
                success: true,
                uploadId: result.data.uploadTempListingPhotos.uploadIds[0]
              };
            } else {
              console.error('Upload response:', result);
              throw new Error('No uploadId in response: ' + JSON.stringify(result));
            }
          }, {
            fileBase64,
            fileName,
            mimeType,
            authToken,
            csrfToken
          });
          
          if (uploadResult.success) {
            uploadIds.push(uploadResult.uploadId);
            console.log(`  ✓ Photo ${i + 1} uploaded successfully (ID: ${uploadResult.uploadId})`);
          } else {
            throw new Error(`Upload failed for photo ${i + 1}`);
          }
          
          // Small delay between uploads
          if (i < photoPaths.length - 1) {
            await page.waitForTimeout(500);
          }
          
        } catch (error) {
          console.error(`  ❌ Error uploading photo ${i + 1}:`, error.message);
          throw error;
        }
      }
      
      // Store uploadIds in page context for form submission
      await page.evaluate((ids) => {
        window.__mercariUploadIds = ids;
      }, uploadIds);
      
      console.log(`  ✓ All ${uploadIds.length} photo(s) uploaded successfully`);
      console.log(`  → Upload IDs: ${uploadIds.join(', ')}`);
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

