/**
 * Facebook GraphQL API Client
 * Makes direct API calls to Facebook GraphQL endpoint - NO DOM scraping needed!
 */

// Get Facebook cookies and dtsg token
async function getFacebookAuth() {
  try {
    // Try to get specific cookies by name
    const cookieNames = ['c_user', 'xs', 'datr', 'sb', 'fr', 'wd', 'presence'];
    const cookies = [];
    
    for (const name of cookieNames) {
      try {
        const cookie = await chrome.cookies.get({
          url: 'https://www.facebook.com',
          name: name
        });
        if (cookie) {
          cookies.push(cookie);
          console.log(`✅ Found cookie: ${name}`);
        }
      } catch (e) {
        console.log(`⚠️ Could not get cookie ${name}:`, e.message);
      }
    }
    
    console.log('🍪 Total cookies found:', cookies.length);
    
    if (cookies.length === 0) {
      throw new Error('Not logged into Facebook - no cookies found. Please make sure you are logged into Facebook in your browser.');
    }
    
    // Check for essential cookies
    const cUser = cookies.find(c => c.name === 'c_user');
    const xs = cookies.find(c => c.name === 'xs');
    
    console.log('🍪 Cookie names found:', cookies.map(c => c.name).join(', '));
    
    if (!cUser || !xs) {
      throw new Error('Facebook login incomplete - missing authentication cookies (c_user or xs). Please log into Facebook in your browser.');
    }
    
    console.log('✅ Facebook cookies found:', {
      c_user: cUser.value,
      xs: xs.value.substring(0, 20) + '...',
      totalCookies: cookies.length,
    });
    
    // Get fb_dtsg token from storage (captured from Facebook page)
    let storage = await chrome.storage.local.get(['facebook_dtsg', 'facebook_dtsg_timestamp']);
    let dtsg = storage.facebook_dtsg;
    const dtsgTimestamp = storage.facebook_dtsg_timestamp || 0;
    const dtsgAge = Date.now() - dtsgTimestamp;
    
    console.log('🔑 fb_dtsg status:', {
      hasToken: !!dtsg,
      tokenAge: Math.round(dtsgAge / 1000 / 60) + ' minutes',
      tokenPreview: dtsg ? dtsg.substring(0, 30) + '...' : 'none'
    });
    
    // If no token, try to fetch it directly from Facebook
    if (!dtsg) {
      console.log('⚠️ fb_dtsg token missing, attempting to fetch from Facebook...');
      try {
        const response = await fetch('https://www.facebook.com/', {
          credentials: 'include'
        });
        const html = await response.text();
        
        console.log('📄 Fetched HTML length:', html.length, 'bytes');
        
        // Try multiple patterns to extract fb_dtsg from HTML
        const patterns = [
          /"dtsg":\{"token":"([^"]+)"/,
          /name="fb_dtsg" value="([^"]+)"/,
          /"token":"([^"]+)","async_get_token"/,
          /\["DTSGInitialData",\[\],\{"token":"([^"]+)"/,
          /"DTSGInitData".*?"token":"([^"]+)"/,
          /LSD.*?"token":"([^"]+)"/
        ];
        
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match?.[1]) {
            dtsg = match[1];
            console.log('✅ Found fb_dtsg using pattern:', pattern.source);
            break;
          }
        }
        
        // If still not found, log a sample of the HTML to help debug
        if (!dtsg) {
          const sample = html.substring(0, 1000);
          console.log('⚠️ Could not find fb_dtsg. HTML sample:', sample);
          console.log('⚠️ Searching for "dtsg" in HTML:', html.includes('dtsg'));
          console.log('⚠️ Searching for "DTSGInitialData" in HTML:', html.includes('DTSGInitialData'));
        }
        
        if (dtsg) {
          console.log('✅ Successfully extracted fb_dtsg from Facebook page:', dtsg.substring(0, 30) + '...');
          // Store it for future use
          await chrome.storage.local.set({
            'facebook_dtsg': dtsg,
            'facebook_dtsg_timestamp': Date.now(),
          });
        } else {
          console.log('⚠️ Could not find fb_dtsg in page HTML');
          return { cookies, dtsg: null, needsDtsgRefresh: true };
        }
      } catch (fetchError) {
        console.error('❌ Failed to fetch fb_dtsg:', fetchError);
        return { cookies, dtsg: null, needsDtsgRefresh: true };
      }
    }
    
    if (!dtsg) {
      console.log('⚠️ fb_dtsg token still missing after fetch attempt');
      return { cookies, dtsg: null, needsDtsgRefresh: true };
    }
    
    if (dtsgAge > 3600000) {
      console.log('⚠️ fb_dtsg token is', Math.round(dtsgAge / 1000 / 60), 'minutes old, but will try using it anyway...');
    } else {
      console.log('✅ fb_dtsg token is fresh');
    }
    
    console.log('✅ fb_dtsg token found:', dtsg.substring(0, 30) + '...');
    
    return { cookies, dtsg, needsDtsgRefresh: false };
    
  } catch (error) {
    console.error('❌ Error getting Facebook auth:', error);
    throw error;
  }
}

// Fetch listings via GraphQL API
async function fetchFacebookListings({ dtsg, cookies, count = 50, cursor = null }) {
  try {
    console.log('📡 Fetching Facebook listings via GraphQL API...', { count, cursor, hasDtsg: !!dtsg });
    
    // Build cookie header
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // GraphQL query parameters
    const variables = {
      count,
      state: 'LIVE',
      status: ['IN_STOCK'],
      cursor,
      order: 'CREATION_TIMESTAMP_DESC',
      scale: 1,
      title_search: null,
    };
    
    const formData = new URLSearchParams();
    formData.append('variables', JSON.stringify(variables));
    formData.append('doc_id', '6222877017763459'); // This is the doc_id from Vendoo's network log
    formData.append('fb_api_req_friendly_name', 'MarketplaceYouSellingFastActiveSectionPaginationQuery');
    
    // Only include fb_dtsg if we have it
    if (dtsg) {
      formData.append('fb_dtsg', dtsg);
      console.log('✅ Including fb_dtsg in request');
    } else {
      console.log('⚠️ Proceeding without fb_dtsg token (may fail)');
    }
    
    const response = await fetch('https://www.facebook.com/api/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        // Don't set Origin, Referer, or Sec-Fetch-* here - they're set by DNR rules
      },
      body: formData.toString(),
      credentials: 'include',
    });
    
    console.log('📥 GraphQL response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText.substring(0, 500));
      throw new Error(`Facebook API error: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log('📥 Raw GraphQL response length:', text.length);
    
    if (text.length === 0) {
      console.log('❌ Empty response from Facebook API - fb_dtsg token may be required');
      throw new Error('Empty response from Facebook API. The fb_dtsg CSRF token is required but could not be obtained.');
    }
    
    console.log('📥 Response preview:', text.substring(0, 200));
    
    // Parse response (it's newline-delimited JSON)
    const lines = text.trim().split('\n').filter(l => l.trim());
    let data = null;
    
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.data?.viewer?.marketplace_listing_sets) {
          data = parsed.data;
          break;
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
    
    if (!data) {
      throw new Error('No listing data in GraphQL response');
    }
    
    console.log('✅ GraphQL response parsed successfully');
    
    // Extract listings from GraphQL response
    const edges = data.viewer?.marketplace_listing_sets?.edges || [];
    const listings = edges.map(edge => {
      const listing = edge.node?.first_listing;
      if (!listing) return null;
      
      return {
        itemId: listing.id,
        title: listing.marketplace_listing_title || listing.base_marketplace_listing_title || '',
        price: parseFloat(listing.formatted_price?.text?.replace(/[^0-9.]/g, '') || '0'),
        imageUrl: listing.primary_listing_photo?.image?.uri || '',
        pictureURLs: listing.primary_listing_photo?.image?.uri ? [listing.primary_listing_photo.image.uri] : [],
        listingUrl: listing.story?.url || `https://www.facebook.com/marketplace/item/${listing.id}/`,
        source: 'facebook',
        status: listing.is_sold ? 'sold' : listing.is_pending ? 'pending' : 'available',
        description: listing.marketplace_listing_title || '',
        imported: false,
        creationTime: listing.creation_time,
        listingDate: listing.creation_time ? new Date(listing.creation_time * 1000).toISOString() : new Date().toISOString(),
        startTime: listing.creation_time ? new Date(listing.creation_time * 1000).toISOString() : new Date().toISOString(),
        categoryId: listing.marketplace_listing_category_id,
        needsDetails: true, // Flag that we need to fetch full details
      };
    }).filter(Boolean);
    
    console.log(`✅ Extracted ${listings.length} Facebook listings from API`);
    
    // Now fetch full details by navigating to each listing page
    // This is more reliable than trying to use GraphQL queries we don't have access to
    console.log(`📋 Fetching full details via content script injection for ${listings.length} listings...`);
    
    // Find or create a Facebook Marketplace tab
    const tabs = await chrome.tabs.query({ url: '*://www.facebook.com/marketplace/*' });
    let tab;
    
    if (tabs && tabs.length > 0) {
      tab = tabs[0];
      console.log(`✅ Using existing Facebook Marketplace tab ${tab.id}`);
    } else {
      // Create a new tab for scraping
      tab = await chrome.tabs.create({
        url: 'https://www.facebook.com/marketplace/you/selling',
        active: false // Keep it in background
      });
      console.log(`✅ Created new Facebook Marketplace tab ${tab.id}`);
      
      // Wait for tab to load
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Process listings one by one
    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];
      console.log(`📄 [${i + 1}/${listings.length}] Fetching details for ${listing.itemId}...`);
      
      try {
        // Navigate to the listing URL
        await chrome.tabs.update(tab.id, { url: listing.listingUrl });
        
        // Wait for page to load - reduced from 3s to 2s
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Inject script to extract data
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Extract description - Look for the main listing description
            const descriptionSelectors = [
              // Primary description container
              'div[class*="xz9dl7a"] span[dir="auto"]',
              'div[style*="overflow-wrap"] span[dir="auto"]',
              // Fallback selectors
              'div[class*="html-div"] > span',
              'span[dir="auto"][style*="text-align: start"]',
            ];
            
            let description = '';
            for (const selector of descriptionSelectors) {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                const text = el?.textContent?.trim();
                // Must be substantial text, not a label or menu item
                if (text && text.length > 50 && 
                    !text.includes('See translation') && 
                    !text.includes('Today\'s picks') &&
                    !text.includes('mi$') &&
                    !text.includes('Related products')) {
                  description = text;
                  break;
                }
              }
              if (description) break;
            }
            
            // Extract category - Look for category link
            let category = null;
            const categoryLink = document.querySelector('a[href*="/marketplace/category/"]');
            if (categoryLink) {
              const catText = categoryLink.textContent?.trim();
              // Avoid picking up other links
              if (catText && catText.length < 50 && !catText.includes('$') && !catText.includes('mi')) {
                category = catText;
              }
            }
            
            // Extract condition - Look for specific "Condition" label
            let condition = null;
            const allText = document.body.textContent;
            const conditionMatch = allText.match(/Condition[:\s]*(New|Used|Used - like new|Used - good|Used - fair)/i);
            if (conditionMatch) {
              condition = conditionMatch[1];
            }
            
            // Extract brand - Look for "Brand" label followed by value
            let brand = null;
            const brandMatch = allText.match(/Brand[:\s]*([A-Za-z0-9\s\-&]+?)(?:\n|$|Size|Condition|Category)/);
            if (brandMatch && brandMatch[1]) {
              const brandText = brandMatch[1].trim();
              // Avoid picking up long descriptions or unrelated text
              if (brandText.length < 100 && !brandText.includes('$') && !brandText.includes('mi')) {
                brand = brandText;
              }
            }
            
            // Extract size - Look for "Size" label followed by value
            let size = null;
            const sizeMatch = allText.match(/Size[:\s]*([A-Za-z0-9\s\-\.,/]+?)(?:\n|$|Brand|Condition|Category)/);
            if (sizeMatch && sizeMatch[1]) {
              const sizeText = sizeMatch[1].trim();
              // Avoid picking up long text
              if (sizeText.length < 100 && !sizeText.includes('$') && !sizeText.includes('Today')) {
                size = sizeText;
              }
            }
            
            return {
              description: description || null,
              category: category || null,
              condition: condition || null,
              brand: brand || null,
              size: size || null,
            };
          }
        });
        
        // Merge the extracted data into the listing
        if (result?.result) {
          const data = result.result;
          console.log(`✅ Extracted data for ${listing.itemId}:`, data);
          
          listing.description = data.description || listing.description;
          listing.category = data.category || listing.category;
          listing.condition = data.condition || null;
          listing.brand = data.brand || null;
          listing.size = data.size || null;
        }
        
      } catch (error) {
        console.error(`❌ Error fetching details for ${listing.itemId}:`, error);
      }
      
      // Small delay between requests - reduced from 500ms to 200ms
      if (i < listings.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`✅ All listing details fetched!`);
    console.log(`📦 Final listings sample:`, listings[0]);
    
    return {
      success: true,
      listings,
      total: listings.length,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Error fetching Facebook listings:', error);
    throw error;
  }
}

// Main export (use self instead of window for service worker compatibility)
self.__facebookApi = {
  getFacebookAuth,
  fetchFacebookListings,
};

console.log('✅ Facebook API client loaded');
