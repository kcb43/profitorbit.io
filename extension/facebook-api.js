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
async function fetchFacebookListings({ dtsg, cookies, count = 50, cursor = null, statusFilter = 'all' }) {
  try {
    console.log('📡 Fetching Facebook listings via GraphQL API...', { count, cursor, statusFilter, hasDtsg: !!dtsg });
    
    // Build cookie header
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // Determine status array based on filter
    // Facebook uses: IN_STOCK for active, OUT_OF_STOCK for sold/out of stock items
    let statusArray;
    if (statusFilter === 'available' || statusFilter === 'active') {
      statusArray = ['IN_STOCK'];
    } else if (statusFilter === 'sold') {
      statusArray = ['OUT_OF_STOCK'];
    } else if (statusFilter === 'out_of_stock') {
      statusArray = ['OUT_OF_STOCK'];
    } else {
      // 'all' - fetch both active and sold items
      statusArray = ['IN_STOCK', 'OUT_OF_STOCK'];
    }
    
    console.log('📊 Using status filter:', { statusFilter, statusArray });
    
    // GraphQL query parameters
    // IMPORTANT: Facebook's MarketplaceYouSellingFastActiveSectionPaginationQuery
    // may limit sold items to recent items only (typically 10-50 items)
    // This appears to be a Facebook API limitation
    let queryState = 'LIVE';
    
    // For sold items, try to request more per page
    let requestCount = count;
    if (statusFilter === 'sold' || statusFilter === 'out_of_stock' || statusArray.includes('OUT_OF_STOCK')) {
      console.log('🕐 Requesting historical sold/out-of-stock items');
      requestCount = Math.max(count, 100); // Try to fetch 100 items per page minimum
    }
    
    const variables = {
      count: requestCount,
      state: queryState,
      status: statusArray,
      cursor,
      order: 'CREATION_TIMESTAMP_DESC',
      scale: 1,
      title_search: null,
    };
    
    const formData = new URLSearchParams();
    formData.append('variables', JSON.stringify(variables));
    
    // Use the updated doc_id for MarketplaceYouSellingFastActiveSectionPaginationQuery
    // This newer version (25467927229556480) properly supports pagination for all items including sold
    // The older version (6222877017763459) had pagination issues with sold items
    console.log(`📊 Fetching ${statusFilter} items with pagination support`);
    formData.append('doc_id', '25467927229556480'); // Updated doc_id with working pagination
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
    
    // Extract page info for pagination
    const pageInfo = data.viewer?.marketplace_listing_sets?.page_info;
    const hasNextPage = pageInfo?.has_next_page || false;
    const endCursor = pageInfo?.end_cursor || null;
    
    console.log('📄 Pagination info:', {
      hasNextPage,
      endCursor: endCursor ? endCursor.substring(0, 50) + '...' : null,
      currentCursor: cursor ? cursor.substring(0, 50) + '...' : null
    });
    
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
      
      // Determine status from multiple sources
      // Priority: is_sold flag > inventory_count/total_inventory > is_pending flag > default 'available'
      let itemStatus = 'available';
      
      if (listing.is_sold) {
        itemStatus = 'sold';
      } else if (listing.inventory_count === 0 && listing.total_inventory === 0) {
        // Items with zero inventory are out of stock
        itemStatus = 'out_of_stock';
      } else if (listing.inventory_item?.inventory_status === 'OUT_OF_STOCK') {
        itemStatus = 'out_of_stock';
      } else if (listing.is_pending) {
        itemStatus = 'out_of_stock'; // Pending items are also marked as out of stock
      } else if (listing.inventory_item?.inventory_status === 'IN_STOCK' || listing.inventory_count > 0) {
        itemStatus = 'available';
      }
      
      console.log(`🔍 [${index + 1}] Status detection:`, {
        itemId: listing.id,
        is_sold: listing.is_sold,
        inventory_count: listing.inventory_count,
        total_inventory: listing.total_inventory,
        inventory_status: listing.inventory_item?.inventory_status,
        is_pending: listing.is_pending,
        finalStatus: itemStatus
      });
      
      const result = {
        itemId: listing.id,
        title: listing.marketplace_listing_title || listing.base_marketplace_listing_title || '',
        price: parseFloat(listing.formatted_price?.text?.replace(/[^0-9.]/g, '') || '0'),
        imageUrl: listing.primary_listing_photo?.image?.uri || '',
        pictureURLs: listing.primary_listing_photo?.image?.uri ? [listing.primary_listing_photo.image.uri] : [],
        listingUrl: listing.story?.url || `https://www.facebook.com/marketplace/item/${listing.id}/`,
        source: 'facebook',
        status: itemStatus,
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
      hasNextPage,
      endCursor,
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
  
  // Common brand keywords to detect in titles/descriptions
  const BRAND_KEYWORDS = [
    'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour', 'New Balance', 'Converse', 'Vans',
    'Gucci', 'Prada', 'Louis Vuitton', 'Chanel', 'Versace', 'Balenciaga', 'Fendi',
    'Apple', 'Samsung', 'Sony', 'Microsoft', 'Dell', 'HP', 'Lenovo', 'Asus',
    'Lego', 'Mattel', 'Hasbro', 'Fisher-Price', 'Hot Wheels',
    'Zara', 'H&M', 'Forever 21', 'Gap', 'Old Navy', 'Lululemon', 'Athleta',
    'Coach', 'Michael Kors', 'Kate Spade', 'Tory Burch', 'Fossil',
    'Dyson', 'KitchenAid', 'Ninja', 'Instant Pot', 'Cuisinart',
    'Unbranded', 'Generic', 'No Brand'
  ];
  
  // Helper function to extract brand from text
  const extractBrandFromText = (text) => {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    for (const brand of BRAND_KEYWORDS) {
      if (lowerText.includes(brand.toLowerCase())) {
        return brand;
      }
    }
    return null;
  };
  
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
          // Using the exact variables that Vendoo sends
          const variables = {
            UFI2CommentsProvider_commentsKey: "MarketplacePDP",
            canViewCustomizedProfile: true,
            disableDoublePDPFieldFetchFix: false,
            feedbackSource: 56,
            feedLocation: "MARKETPLACE_MEGAMALL",
            location_latitude: 0,
            location_longitude: 0,
            location_radius: 0,
            location_vanity_page_id: "",
            pdpContext_isHoisted: false,
            pdpContext_trackingData: null,
            referralCode: null,
            relay_flight_marketplace_enabled: false,
            scale: 1,
            targetId: listing.itemId,
            useDefaultActor: false,
            __relay_internal__pv__GKMarketplacePdpUfiPerfH12022relayprovider: false,
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
          let target = null;
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              // MarketplacePDPContainerQuery has structure: data.viewer.marketplace_product_details_page.target
              if (parsed.data?.viewer?.marketplace_product_details_page?.target) {
                target = parsed.data.viewer.marketplace_product_details_page.target;
                console.log(`🔍 [DEBUG] Full target object keys:`, Object.keys(target));
                break;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
          
          if (!target) {
            console.warn(`⚠️ No target data found for ${listing.itemId}`);
            console.log(`⚠️ Response preview:`, text.substring(0, 500));
            return listing;
          }
          
          // Extract detailed information from GraphQL response
          const description = target.redacted_description?.text || listing.description || '';
          
          console.log(`🔍 [DEBUG] Description extraction for ${listing.itemId}:`, {
            hasRedactedDescription: !!target.redacted_description,
            redactedText: target.redacted_description?.text?.substring(0, 100),
            descriptionLength: description?.length,
          });
          
          // Log the attribute_data structure for debugging
          if (target.attribute_data && target.attribute_data.length > 0) {
            console.log(`🔍 attribute_data for ${listing.itemId}:`, JSON.stringify(target.attribute_data, null, 2));
          }
          
          // Extract condition from attribute_data
          // Structure: { attribute_name: "Condition", value: "used_good", label: "Used - Good" }
          let condition = listing.condition;
          const conditionAttr = target.attribute_data?.find(attr => 
            attr.attribute_name === 'Condition'
          );
          if (conditionAttr) {
            // Use the 'label' field which has the human-readable value
            condition = conditionAttr.label || condition;
            console.log(`🔍 Condition found:`, conditionAttr, '→', condition);
          }
          
          // Extract brand from attribute_data
          let brand = listing.brand;
          const brandAttr = target.attribute_data?.find(attr => 
            attr.attribute_name === 'Brand'
          );
          if (brandAttr) {
            // Use the 'label' field which has the brand name
            brand = brandAttr.label || brand;
            console.log(`🔍 Brand found in attributes:`, brandAttr, '→', brand);
          } else {
            // If no brand in attributes, try to extract from title
            const titleBrand = extractBrandFromText(listing.title);
            if (titleBrand) {
              brand = titleBrand;
              console.log(`🔍 Brand extracted from title:`, listing.title, '→', brand);
            }
            // Also try from description
            if (!brand && description) {
              const descBrand = extractBrandFromText(description);
              if (descBrand) {
                brand = descBrand;
                console.log(`🔍 Brand extracted from description → ${brand}`);
              }
            }
          }
          
          // Extract size from attribute_data (can be "Size", "Men's Shoe Size", "Women's Size", etc.)
          let size = listing.size;
          const sizeAttr = target.attribute_data?.find(attr => 
            attr.attribute_name && attr.attribute_name.toLowerCase().includes('size')
          );
          if (sizeAttr) {
            // Use the 'label' field which has the size value
            size = sizeAttr.label || size;
            console.log(`🔍 Size found:`, sizeAttr, '→', size);
          }
          
          // Category ID is in the response
          const categoryId = target.marketplace_listing_category_id || listing.categoryId;
          
          console.log(`✅ Fetched details for ${listing.itemId}:`, {
            hasDescription: !!description && description !== listing.title,
            descriptionLength: description?.length,
            hasCondition: !!condition,
            hasBrand: !!brand,
            hasSize: !!size,
            categoryId,
          });
          
          return {
            ...listing,
            description,
            condition,
            brand,
            size,
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
