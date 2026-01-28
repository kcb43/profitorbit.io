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

// Fetch individual listing details with full description
async function fetchListingDetails({ dtsg, cookies, listingId }) {
  try {
    console.log(`📡 Fetching details for listing ${listingId}...`);
    
    const variables = {
      category_id: "0",
      composer_mode: "EDIT_LISTING",
      delivery_types: ["in_person", "shipping_onsite"],
      has_prefetched_category: false,
      is_edit: true,
      listingId: listingId,
      scale: 1,
      should_prefill_b2c_jobs_address: false,
      should_prefill_c2c_jobs_address: true
    };
    
    const formData = new URLSearchParams();
    formData.append('variables', JSON.stringify(variables));
    formData.append('doc_id', '33414079394905543'); // CometMarketplaceComposerRootComponentQuery (EDIT query)
    formData.append('fb_api_req_friendly_name', 'CometMarketplaceComposerRootComponentQuery');
    
    if (dtsg) {
      formData.append('fb_dtsg', dtsg);
    }
    
    console.log(`📤 Request body:`, formData.toString().substring(0, 200) + '...');
    
    const response = await fetch('https://www.facebook.com/api/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: formData.toString(),
      credentials: 'include',
    });
    
    console.log(`📥 Response status for ${listingId}:`, response.status);
    
    if (!response.ok) {
      console.error(`❌ Bad response for ${listingId}:`, response.status, response.statusText);
      throw new Error(`Facebook API error: ${response.status}`);
    }
    
    const text = await response.text();
    console.log(`📥 Response length for ${listingId}:`, text.length, 'bytes');
    console.log(`📥 Response preview for ${listingId}:`, text.substring(0, 300));
    
    const lines = text.trim().split('\n').filter(l => l.trim());
    console.log(`📋 Found ${lines.length} JSON lines for ${listingId}`);
    
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        console.log(`🔍 Parsed line keys for ${listingId}:`, Object.keys(parsed));
        
        // The edit query returns data in a different structure
        // Look for: data.node.listing OR data.marketplace_listing_for_editing
        const listing = parsed.data?.node?.listing || 
                       parsed.data?.marketplace_listing_for_editing ||
                       parsed.data?.marketplace_listing;
        
        if (listing) {
          console.log(`✅ Found listing data for ${listingId}:`, {
            hasDescription: !!listing.marketplace_listing_description,
            hasRedactedDescription: !!listing.redacted_description,
            hasStoryDescription: !!listing.story_description,
            hasTitle: !!listing.marketplace_listing_title,
            hasCategory: !!listing.marketplace_listing_category,
            hasCustomTitle: !!listing.custom_title_with_condition_and_brand,
            allKeys: Object.keys(listing).slice(0, 20)
          });
          
          // Extract all possible fields
          const result = {
            description: listing.marketplace_listing_description || 
                        listing.story_description || 
                        listing.redacted_description?.text || 
                        listing.marketplace_listing_title || null,
            category: listing.marketplace_listing_category?.name || 
                     listing.listing_category?.name || null,
            condition: listing.custom_title_with_condition_and_brand?.condition || 
                      listing.condition || null,
            brand: listing.custom_title_with_condition_and_brand?.brand || 
                  listing.brand || null,
            size: listing.custom_sub_titles_with_rendering_flags?.find(s => s.rendering_style === 'SIZE')?.subtitle || 
                 listing.size || null,
          };
          
          console.log(`📦 Extracted data for ${listingId}:`, result);
          return result;
        }
      } catch (e) {
        console.log(`⚠️ Failed to parse line for ${listingId}:`, e.message);
        // Skip invalid JSON lines
      }
    }
    
    console.warn(`⚠️ No listing data found in response for ${listingId}`);
    console.warn(`⚠️ Response preview:`, text.substring(0, 500));
    return null;
  } catch (error) {
    console.error(`❌ Error fetching details for listing ${listingId}:`, error);
    return null;
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
    
    // Now fetch full details for each listing (in batches to avoid rate limiting)
    console.log(`📋 Fetching full details for ${listings.length} listings...`);
    
    const batchSize = 5;
    for (let i = 0; i < listings.length; i += batchSize) {
      const batch = listings.slice(i, i + batchSize);
      
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(listings.length / batchSize)}`, batch.map(l => l.itemId));
      
      const detailsPromises = batch.map(listing => 
        fetchListingDetails({ dtsg, cookies, listingId: listing.itemId })
      );
      
      const detailsResults = await Promise.all(detailsPromises);
      
      console.log(`📦 Batch results:`, detailsResults);
      
      // Merge details into listings
      batch.forEach((listing, idx) => {
        const details = detailsResults[idx];
        if (details) {
          console.log(`✅ Merging details for ${listing.itemId}:`, details);
          listing.description = details.description || listing.description;
          listing.category = details.category || listing.category;
          listing.condition = details.condition || null;
          listing.brand = details.brand || null;
          listing.size = details.size || null;
        } else {
          console.warn(`⚠️ No details returned for ${listing.itemId}`);
        }
        delete listing.needsDetails;
      });
      
      console.log(`✅ Fetched details for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(listings.length / batchSize)}`);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < listings.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
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
  fetchListingDetails,
};

console.log('✅ Facebook API client loaded');
