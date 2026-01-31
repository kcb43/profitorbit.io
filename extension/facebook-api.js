/**
 * Facebook GraphQL API Client
 * Makes direct API calls to Facebook GraphQL endpoint
 * 
 * Two-step process (just like Vendoo):
 * 1. MarketplaceYouSellingFastActiveSectionPaginationQuery - Initial sync (basic data)
 * 2. MarketplacePDPContainerQuery - Detailed data (description, condition, brand) on import
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
    
    console.log(`✅ Extracted ${listings.length} Facebook listings from GraphQL API`);
    console.log(`📦 Sample listing:`, listings[0]);
    
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

/**
 * NEW: Fetch detailed item data via GraphQL (just like Vendoo does!)
 * Uses MarketplacePDPContainerQuery to get full description, condition, brand, etc.
 * Called during import when user selects items - this is when we get full descriptions
 */
async function scrapeMultipleListings(listings, userId = null) {
  console.log(`🔍 [GRAPHQL] Fetching detailed data for ${listings.length} selected items via GraphQL API...`);
  
  try {
    // Get Facebook auth (cookies + dtsg)
    const { cookies, dtsg } = await getFacebookAuth();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // Fetch detailed data for each item using MarketplacePDPContainerQuery
    const detailedListings = await Promise.all(
      listings.map(async (listing) => {
        try {
          console.log(`📡 Fetching details for item ${listing.itemId}...`);
          
          // GraphQL query for individual item details (from Vendoo HAR logs)
          const variables = {
            targetId: listing.itemId,
            shouldShowBoostedFields: false,
            scale: 1,
          };
          
          const formData = new URLSearchParams();
          formData.append('variables', JSON.stringify(variables));
          formData.append('doc_id', '6097985476929977'); // MarketplacePDPContainerQuery from HAR logs
          formData.append('fb_api_req_friendly_name', 'MarketplacePDPContainerQuery');
          
          if (dtsg) {
            formData.append('fb_dtsg', dtsg);
          }
          
          const response = await fetch('https://www.facebook.com/api/graphql/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
              'Accept': '*/*',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            body: formData.toString(),
            credentials: 'include',
          });
          
          if (!response.ok) {
            console.error(`❌ Failed to fetch details for ${listing.itemId}: ${response.status}`);
            return listing; // Return original if fetch fails
          }
          
          const text = await response.text();
          
          // Parse newline-delimited JSON response
          const lines = text.trim().split('\n').filter(l => l.trim());
          let data = null;
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.data?.node) {
                data = parsed.data.node;
                break;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
          
          if (!data) {
            console.warn(`⚠️ No data found for ${listing.itemId}`);
            return listing;
          }
          
          // Extract detailed information from GraphQL response
          const description = data.redacted_description?.text || listing.description || '';
          
          // Log the attribute_data structure for debugging
          if (data.attribute_data && data.attribute_data.length > 0) {
            console.log(`🔍 attribute_data for ${listing.itemId}:`, JSON.stringify(data.attribute_data, null, 2));
          }
          
          // Extract condition from attribute_data
          let condition = listing.condition;
          const conditionAttr = data.attribute_data?.find(attr => 
            attr.label === 'Condition' || attr.label?.toLowerCase().includes('condition')
          );
          if (conditionAttr) {
            // Try multiple possible field names for the value
            condition = conditionAttr.value_label || conditionAttr.label || conditionAttr.value || condition;
            console.log(`🔍 Condition found:`, conditionAttr);
          }
          
          // Extract brand from attribute_data
          let brand = listing.brand;
          const brandAttr = data.attribute_data?.find(attr => 
            attr.label === 'Brand' || attr.label?.toLowerCase().includes('brand')
          );
          if (brandAttr) {
            // Try multiple possible field names for the value
            brand = brandAttr.value_label || brandAttr.label || brandAttr.value || brand;
            console.log(`🔍 Brand found:`, brandAttr);
          }
          
          // Category ID is in the response
          const categoryId = data.marketplace_listing_category_id || listing.categoryId;
          
          console.log(`✅ Fetched details for ${listing.itemId}:`, {
            hasDescription: !!description && description !== listing.title,
            descriptionLength: description?.length,
            hasCondition: !!condition,
            hasBrand: !!brand,
            categoryId,
          });
          
          return {
            ...listing,
            description,
            condition,
            brand,
            categoryId,
          };
          
        } catch (error) {
          console.error(`❌ Error fetching details for ${listing.itemId}:`, error);
          return listing; // Return original on error
        }
      })
    );
    
    console.log(`✅ Successfully fetched detailed data for ${detailedListings.length} items via GraphQL`);
    return detailedListings;
    
  } catch (error) {
    console.error(`❌ Error in GraphQL detail fetching:`, error);
    return listings; // Return original listings on error
  }
}

// Main export (use self instead of window for service worker compatibility)
self.__facebookApi = {
  getFacebookAuth,
  fetchFacebookListings,
  scrapeMultipleListings, // Now uses GraphQL MarketplacePDPContainerQuery for detailed data
};

console.log('✅ Facebook API client loaded (with GraphQL detail fetching)');
