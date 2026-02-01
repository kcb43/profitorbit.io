/**
 * Mercari API Module for Profit Orbit Extension
 * Handles fetching user's Mercari listings via GraphQL API
 */

// GraphQL query for searching user items (provides detailed information)
const SEARCH_QUERY = {
  operationName: "searchQuery",
  variables: {
    criteria: {
      length: 20, // Items per page
      itemStatuses: [1], // 1 = on_sale
      sellerIds: [] // Will be populated dynamically
    }
  },
  extensions: {
    persistedQuery: {
      sha256Hash: "d1c9e56a762346c60f7d4350caa950132454eacfe03f103588c7822fc3bb57f5",
      version: 1
    }
  }
};

/**
 * Get Mercari authentication tokens from storage
 */
async function getMercariAuth() {
  try {
    // Get stored tokens (new format)
    const storage = await chrome.storage.local.get([
      'mercari_bearer_token',
      'mercari_csrf_token',
      'mercari_seller_id',
      'mercari_tokens_timestamp',
      'mercariApiHeaders' // Old format from webRequest API
    ]);

    let bearerToken = storage.mercari_bearer_token;
    let csrfToken = storage.mercari_csrf_token;
    let sellerId = storage.mercari_seller_id;
    const timestamp = storage.mercari_tokens_timestamp || 0;
    const tokenAge = Date.now() - timestamp;
    
    // Fallback to old format if new format not available
    if (!bearerToken && storage.mercariApiHeaders) {
      console.log('🔄 Reading tokens from mercariApiHeaders (old format)');
      const headers = storage.mercariApiHeaders;
      
      if (headers.authorization && headers.authorization.startsWith('Bearer ')) {
        bearerToken = headers.authorization.substring(7);
        console.log('✅ Found bearer token in mercariApiHeaders');
      }
      
      if (headers['x-csrf-token']) {
        csrfToken = headers['x-csrf-token'];
        console.log('✅ Found CSRF token in mercariApiHeaders');
      }
      
      // Try to extract seller ID from stored headers or URL
      // We'll need to get this from the actual API call
    }

    console.log('🔑 Mercari token status:', {
      hasBearerToken: !!bearerToken,
      hasCsrfToken: !!csrfToken,
      hasSellerId: !!sellerId,
      tokenAge: Math.round(tokenAge / 1000 / 60) + ' minutes'
    });

    if (!bearerToken || !csrfToken) {
      console.log('⚠️ Mercari auth tokens missing');
      return { bearerToken: null, csrfToken: null, sellerId: null, needsRefresh: true };
    }
    
    // If we have tokens but no seller ID, we'll get it later - don't treat as needsRefresh
    if (!sellerId) {
      console.log('⚠️ Seller ID missing, will try to extract from tab URL');
    }

    // Tokens should be refreshed if older than 1 hour, but we'll try using them anyway
    if (tokenAge > 3600000) {
      console.log('⚠️ Mercari tokens are', Math.round(tokenAge / 1000 / 60), 'minutes old, but will try using them anyway...');
    }

    return { bearerToken, csrfToken, sellerId, needsRefresh: false };
  } catch (error) {
    console.error('❌ Error getting Mercari auth:', error);
    throw error;
  }
}

/**
 * Scrape description from Mercari item page
 * Since GraphQL API doesn't return descriptions, we need to fetch from the page
 */
async function scrapeMercariItemDescription(itemId) {
  try {
    console.log(`🔍 Scraping description for Mercari item ${itemId} from page...`);
    
    const url = `https://www.mercari.com/us/item/${itemId}/`;
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch item page ${itemId}: HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Try to find description in the HTML
    // Mercari embeds data in __NEXT_DATA__ script tag
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        
        // Navigate the Next.js data structure to find item description
        const item = nextData?.props?.pageProps?.item;
        
        if (item?.description) {
          console.log(`✅ Found description via __NEXT_DATA__: ${item.description.substring(0, 100)}...`);
          return item.description;
        }
        
        // Log structure to help debug
        console.log(`🔍 __NEXT_DATA__ structure:`, Object.keys(nextData));
        console.log(`🔍 pageProps:`, nextData?.props?.pageProps ? Object.keys(nextData.props.pageProps) : 'not found');
      } catch (e) {
        console.error(`❌ Failed to parse __NEXT_DATA__:`, e);
      }
    }
    
    // Fallback: try to find description in HTML with regex
    // Look for common patterns
    const descPatterns = [
      /<div[^>]*data-testid="item-description"[^>]*>(.*?)<\/div>/s,
      /<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>/si,
      /"description":"([^"]+)"/,
      /"description":\s*"([^"]+)"/
    ];
    
    for (const pattern of descPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let desc = match[1];
        // Decode HTML entities
        desc = desc.replace(/&quot;/g, '"')
                   .replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/\\n/g, '\n')
                   .replace(/\\r/g, '')
                   .replace(/\\"/g, '"');
        
        // Remove HTML tags if any
        desc = desc.replace(/<[^>]+>/g, '');
        
        if (desc.length > 10) { // Reasonable description length
          console.log(`✅ Found description via regex: ${desc.substring(0, 100)}...`);
          return desc;
        }
      }
    }
    
    console.log(`⚠️ Could not find description for item ${itemId}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error scraping description for item ${itemId}:`, error);
    return null;
  }
}

/**
 * Fetch detailed information for a single Mercari item
 * This is needed because searchQuery doesn't return full descriptions
 */
async function fetchMercariItemDetails(itemId, bearerToken, csrfToken) {
  try {
    console.log(`🔍 Fetching full details for Mercari item ${itemId}...`);
    
    // Full GraphQL query text (fallback if persisted query doesn't work)
    const queryText = `
      query itemQuery($id: ID!) {
        item(id: $id) {
          id
          name
          description
          status
          price
          originalPrice
          itemCondition {
            id
            name
          }
          brand {
            id
            name
          }
          itemCategory {
            id
            name
          }
          itemSize {
            id
            name
          }
          color
          photos {
            imageUrl
            thumbnail
          }
          seller {
            id
            sellerId
          }
        }
      }
    `;
    
    const query = {
      operationName: "itemQuery",
      variables: {
        id: itemId
      },
      query: queryText, // Send full query text
      extensions: {
        persistedQuery: {
          sha256Hash: "c772b09cd5c8b16d9a75fac4c93cf89a3cf1a8edb31ab86f9df62ef1cc9fff0e",
          version: 1
        }
      }
    };

    const timestamp = Date.now();
    const url = `https://www.mercari.com/v1/api?timestamp=${timestamp}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
        'apollo-require-preflight': 'true',
        'x-app-version': '1',
        'x-double-web': '1',
        'x-gql-migration': '1',
        'x-platform': 'web',
      },
      body: JSON.stringify(query),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch item ${itemId}: HTTP ${response.status}`);
      console.error(`Error response body:`, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        console.error(`Error JSON:`, errorJson);
      } catch (e) {
        // Not JSON
      }
      return null;
    }

    const data = await response.json();
    
    console.log(`📥 Full detail response for ${itemId}:`, data);
    
    if (!data.data?.item) {
      console.error(`❌ No item data for ${itemId}`);
      if (data.errors) {
        console.error(`GraphQL errors:`, JSON.stringify(data.errors, null, 2));
        data.errors.forEach((err, i) => {
          console.error(`Error ${i}:`, {
            message: err.message,
            path: err.path,
            extensions: err.extensions
          });
        });
      }
      console.error(`Full error response:`, JSON.stringify(data, null, 2));
      return null;
    }

    const item = data.data.item;
    
    // DEBUG: Log ALL fields to find description
    console.log(`🔍 ALL fields in itemQuery response:`, Object.keys(item));
    console.log(`🔍 Full item data:`, item);
    
    // Extract detailed information
    const details = {
      description: item.description || item.itemDescription || item.descriptionText || item.text || null,
      condition: item.condition || item.itemCondition?.name || null,
      brand: item.brand?.name || null,
      category: item.itemCategory?.name || null,
      size: item.size || item.itemSize?.name || null,
      color: item.color || null,
    };

    console.log(`✅ Fetched details for item ${itemId}:`, {
      hasDescription: !!details.description,
      descriptionLength: details.description?.length,
      descriptionPreview: details.description?.substring(0, 100),
      condition: details.condition,
      brand: details.brand,
      category: details.category,
      size: details.size
    });

    return details;
  } catch (error) {
    console.error(`❌ Error fetching details for item ${itemId}:`, error);
    return null;
  }
}

/**
 * Fetch Mercari listings via GraphQL API
 */
async function fetchMercariListings({ page = 1, status = 'on_sale' } = {}) {
  try {
    console.log('📡 Fetching Mercari listings via GraphQL API...', { page, status });

    // Get authentication tokens
    const { bearerToken, csrfToken, sellerId, needsRefresh } = await getMercariAuth();

    if (needsRefresh || !bearerToken || !csrfToken) {
      throw new Error('Mercari authentication tokens are missing. Please open Mercari.com in a tab first.');
    }
    
    // If we don't have seller ID from storage, we can't proceed
    // The seller ID must be captured from an intercepted API call
    if (!sellerId || isNaN(parseInt(sellerId, 10))) {
      throw new Error('Seller ID not available. Please navigate to your Mercari listings page to capture your seller ID.');
    }

    // Convert status string to itemStatuses array
    let itemStatuses;
    if (status === 'sold') {
      itemStatuses = [2]; // 2 = sold
    } else if (status === 'on_sale') {
      itemStatuses = [1]; // 1 = on_sale
    } else {
      // Default to on_sale if invalid status provided
      itemStatuses = [1];
    }

    // Calculate offset for pagination (0-indexed)
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    // Prepare query with seller ID, status, and pagination
    const query = {
      ...SEARCH_QUERY,
      variables: {
        criteria: {
          length: pageSize,
          offset: offset, // Add offset for pagination
          itemStatuses: itemStatuses, // Use dynamic status
          sellerIds: [parseInt(sellerId, 10)]
        }
      }
    };
    
    console.log('🔑 Using seller ID:', sellerId, '-> parseInt:', parseInt(sellerId, 10));

    // Make the GraphQL request
    const timestamp = Date.now();
    const url = `https://www.mercari.com/v1/api?timestamp=${timestamp}`;

    console.log('📡 Making request to:', url);
    console.log('📡 Query:', JSON.stringify(query, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
        'apollo-require-preflight': 'true',
        'x-app-version': '1',
        'x-double-web': '1',
        'x-gql-migration': '1',
        'x-platform': 'web',
      },
      body: JSON.stringify(query),
      credentials: 'include'
    });

    console.log('📥 GraphQL response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 Raw GraphQL response:', data);

    if (!data.data?.search?.itemsList) {
      console.error('❌ Unexpected response structure:', data);
      throw new Error('Invalid response structure from Mercari API');
    }

    const items = data.data.search.itemsList;
    const count = data.data.search.count;

    console.log('✅ Fetched', items.length, 'Mercari listings (total:', count, ')');
    console.log('📦 Sample item from searchQuery:', items[0]); // Log full item structure
    
    // DEBUG: Log ALL keys available in the first item to find description
    if (items[0]) {
      console.log('🔍 ALL available fields in item:', Object.keys(items[0]));
      console.log('🔍 Description field value:', items[0].description);
      console.log('🔍 Description field type:', typeof items[0].description);
      console.log('🔍 Description field length:', items[0].description?.length);
      
      // Check if there's any other field that might contain description
      const possibleDescFields = Object.keys(items[0]).filter(key => 
        key.toLowerCase().includes('desc') || 
        key.toLowerCase().includes('detail') ||
        key.toLowerCase().includes('text') ||
        key.toLowerCase().includes('body')
      );
      console.log('🔍 Possible description fields:', possibleDescFields);
      possibleDescFields.forEach(field => {
        console.log(`🔍   ${field}:`, items[0][field]);
      });
    }

    // Transform to our format with detailed information
    const listings = await Promise.all(items.map(async (item, index) => {
      const listing = {
        itemId: item.id,
        title: item.name,
        price: item.price ? (item.price / 100) : 0, // Convert cents to dollars
        originalPrice: item.originalPrice ? (item.originalPrice / 100) : null,
        status: item.status,
        imageUrl: item.photos?.[0]?.imageUrl || item.photos?.[0]?.thumbnail || null,
        pictureURLs: (item.photos || []).map(p => p.imageUrl || p.thumbnail).filter(Boolean),
        // Detailed information now available from searchQuery
        description: item.description || null,
        condition: item.itemCondition?.name || null,
        brand: item.brand?.name || null,
        category: item.itemCategory?.name || null,
        categoryPath: (item.itemCategoryHierarchy || []).map(c => c.name).join(' > ') || null,
        size: item.itemSize?.name || null,
        color: item.color || null,
        // Posted/listed date (use created or updated timestamp)
        startTime: item.created ? new Date(item.created * 1000).toISOString() : 
                   item.updated ? new Date(item.updated * 1000).toISOString() : null,
        listingDate: item.created ? new Date(item.created * 1000).toISOString() :
                     item.updated ? new Date(item.updated * 1000).toISOString() : null,
        imported: false // Will be updated by frontend
      };
      
      // If description is empty, try to scrape it from the page
      if (!listing.description || listing.description.length === 0) {
        console.log(`📝 Description empty for ${item.id}, attempting to scrape from page...`);
        const scrapedDesc = await scrapeMercariItemDescription(item.id);
        if (scrapedDesc) {
          listing.description = scrapedDesc;
        }
      }
      
      // Log first item details for debugging
      if (index === 0) {
        console.log('📦 First listing sample:', {
          itemId: listing.itemId,
          title: listing.title?.substring(0, 50),
          price: listing.price,
          description: listing.description?.substring(0, 100),
          condition: listing.condition,
          brand: listing.brand,
          category: listing.category,
          size: listing.size
        });
      }
      
      return listing;
    }));

    return {
      success: true,
      listings,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalCount: count,
        hasNext: (offset + listings.length) < count
      }
    };
  } catch (error) {
    console.error('❌ Error fetching Mercari listings:', error);
    return {
      success: false,
      error: error.message,
      listings: []
    };
  }
}

// Export for use in background script
if (typeof self !== 'undefined') {
  self.__mercariApi = {
    getMercariAuth,
    fetchMercariListings,
    fetchMercariItemDetails, // Export for debugging/detailed fetching
    scrapeMercariItemDescription // Export for manual testing
  };
}
