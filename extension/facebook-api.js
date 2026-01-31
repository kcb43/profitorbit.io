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
async function fetchFacebookListings({ dtsg, cookies, count = 50, cursor = null, onProgress = null }) {
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
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
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
    
    // Extract listings from GraphQL response - all data is already here!
    const edges = data.viewer?.marketplace_listing_sets?.edges || [];
    
    // DEBUG: Log the full response structure for the first item
    if (edges.length > 0) {
      const firstListing = edges[0]?.node?.first_listing;
      if (firstListing) {
        console.log('🔍 DEBUG: All available fields in first listing:', Object.keys(firstListing));
        console.log('🔍 DEBUG: First listing full object (JSON):', JSON.stringify(firstListing, null, 2));
        
        // Check specific fields we're looking for
        console.log('🔍 DEBUG: Field check:', {
          has_story_description: 'story_description' in firstListing,
          has_redacted_description: 'redacted_description' in firstListing,
          has_marketplace_listing_category: 'marketplace_listing_category' in firstListing,
          has_custom_title_with_condition_and_brand: 'custom_title_with_condition_and_brand' in firstListing,
          has_custom_sub_titles_with_rendering_flags: 'custom_sub_titles_with_rendering_flags' in firstListing,
        });
      }
    }
    
    const listings = edges.map((edge, index) => {
      const listing = edge.node?.first_listing;
      if (!listing) return null;
      
      console.log(`📦 [${index + 1}] Processing listing ${listing.id}...`);
      
      // Send progress update
      if (onProgress) {
        onProgress(index + 1, edges.length, `Processing listing ${index + 1} of ${edges.length}...`);
      }
      
      // Extract description from multiple possible fields (in priority order)
      const description = listing.story_description || 
                         listing.redacted_description?.text || 
                         listing.marketplace_listing_title || 
                         '';
      
      // Extract category
      const category = listing.marketplace_listing_category?.name || null;
      
      // Extract condition from custom_title_with_condition_and_brand
      const condition = listing.custom_title_with_condition_and_brand?.condition || null;
      
      // Extract brand from custom_title_with_condition_and_brand
      const brand = listing.custom_title_with_condition_and_brand?.brand || null;
      
      // Extract size from custom_sub_titles_with_rendering_flags
      const size = listing.custom_sub_titles_with_rendering_flags?.find(s => s.rendering_style === 'SIZE')?.subtitle || null;
      
      const result = {
        itemId: listing.id,
        title: listing.marketplace_listing_title || listing.base_marketplace_listing_title || '',
        price: parseFloat(listing.formatted_price?.text?.replace(/[^0-9.]/g, '') || '0'),
        imageUrl: listing.primary_listing_photo?.image?.uri || '',
        pictureURLs: listing.primary_listing_photo?.image?.uri ? [listing.primary_listing_photo.image.uri] : [],
        listingUrl: listing.story?.url || `https://www.facebook.com/marketplace/item/${listing.id}/`,
        source: 'facebook',
        status: listing.is_sold ? 'sold' : listing.is_pending ? 'pending' : 'available',
        description: description,
        category: category,
        condition: condition,
        brand: brand,
        size: size,
        imported: false,
        creationTime: listing.creation_time,
        listingDate: listing.creation_time ? new Date(listing.creation_time * 1000).toISOString() : new Date().toISOString(),
        startTime: listing.creation_time ? new Date(listing.creation_time * 1000).toISOString() : new Date().toISOString(),
        categoryId: listing.marketplace_listing_category_id,
      };
      
      console.log(`✅ Extracted full data for ${listing.id}:`, {
        hasDescription: !!description,
        hasCategory: !!category,
        hasCondition: !!condition,
        hasBrand: !!brand,
        hasSize: !!size,
      });
      
      return result;
    }).filter(Boolean);
    
    console.log(`✅ Extracted ${listings.length} Facebook listings (basic data) from GraphQL API`);
    console.log(`📦 Sample listing (basic):`, listings[0]);
    
    // Now scrape detailed information for each listing
    console.log('🔍 Starting detailed scraping for each listing...');
    const detailedListings = await scrapeDetailedListings(listings, onProgress);
    
    console.log('📦 Final listings with detailed data sample:', detailedListings[0]);
    
    return {
      success: true,
      listings: detailedListings,
      total: detailedListings.length,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Error fetching Facebook listings:', error);
    throw error;
  }
}

/**
 * Scrape detailed information for each listing by visiting its page
 * This mimics Vendoo's approach: "Getting req body through scrapping"
 */
async function scrapeDetailedListings(basicListings, onProgress) {
  console.log(`🔍 Scraping detailed info for ${basicListings.length} listings...`);
  
  const detailedListings = [];
  
  for (let i = 0; i < basicListings.length; i++) {
    const listing = basicListings[i];
    
    try {
      console.log(`🔍 [${i + 1}/${basicListings.length}] Scraping details for listing ${listing.itemId}...`);
      
      // Update progress
      if (onProgress) {
        onProgress(i + 1, basicListings.length, `Fetching details for listing ${i + 1}...`);
      }
      
      // Open the listing page in a new tab
      const tab = await chrome.tabs.create({
        url: listing.listingUrl,
        active: false, // Don't switch to the tab
      });
      
      console.log(`📄 Opened tab ${tab.id} for ${listing.listingUrl}`);
      
      // Wait for the page to load
      await waitForTabLoad(tab.id);
      
      // Small delay to ensure content script is ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Send message to content script to scrape the page
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'SCRAPE_FACEBOOK_LISTING'
      });
      
      // Close the tab
      await chrome.tabs.remove(tab.id);
      
      if (response && response.success && response.data) {
        const scrapedData = response.data;
        console.log(`✅ Scraped data for ${listing.itemId}:`, scrapedData);
        
        // Merge scraped data with basic listing data
        const detailedListing = {
          ...listing,
          description: scrapedData.description || listing.description,
          category: scrapedData.category || listing.category,
          categoryPath: scrapedData.categoryPath || [],
          condition: scrapedData.condition || listing.condition,
          brand: scrapedData.brand || listing.brand,
          size: scrapedData.size || listing.size,
          location: scrapedData.location || null,
          // If we got a better title from scraping, use it
          title: scrapedData.title || listing.title,
          // If we got a better price from scraping, use it
          price: scrapedData.price ? parseFloat(scrapedData.price) : listing.price,
        };
        
        detailedListings.push(detailedListing);
        console.log(`✅ Enhanced listing ${listing.itemId} with scraped data`);
      } else {
        console.warn(`⚠️ Could not scrape details for ${listing.itemId}, using basic data`);
        detailedListings.push(listing);
      }
      
    } catch (error) {
      console.error(`❌ Error scraping listing ${listing.itemId}:`, error);
      // If scraping fails, use the basic listing data
      detailedListings.push(listing);
    }
    
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`✅ Completed detailed scraping for ${detailedListings.length} listings`);
  return detailedListings;
}

/**
 * Wait for a tab to finish loading
 */
async function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const checkTab = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          resolve();
        } else {
          setTimeout(checkTab, 500);
        }
      } catch (error) {
        // Tab might have been closed
        resolve();
      }
    };
    checkTab();
  });
}

// Main export (use self instead of window for service worker compatibility)
self.__facebookApi = {
  getFacebookAuth,
  fetchFacebookListings,
};

console.log('✅ Facebook API client loaded');
