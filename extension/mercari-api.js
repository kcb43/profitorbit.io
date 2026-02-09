/**
 * Mercari API Module for Profit Orbit Extension
 * Handles fetching user's Mercari listings via GraphQL API
 * Version: 3.1.0-user-items-query
 */

console.log('🟣 Mercari API module loading (v3.1.0-user-items-query)...');

// NEW: GraphQL query for user items (correct query for sold & available items)
// This is the query Mercari uses on the "Complete" and "Active" pages
const USER_ITEMS_QUERY = {
  operationName: "userItemsQuery",
  variables: {
    userItemsInput: {
      sellerId: null, // Will be populated dynamically
      status: "on_sale", // "on_sale" or "sold_out"
      keyword: "",
      sortBy: "created",
      sortType: "desc",
      page: 1,
      includeTotalCount: true
    }
  },
  extensions: {
    persistedQuery: {
      sha256Hash: "de32fb1b4a2727c67de3f242224d5647a5db015cd5f075fc4aee10d9c43ecce7",
      version: 1
    }
  }
};

// DEPRECATED: Old searchQuery (doesn't work for sold items)
const SEARCH_QUERY_OLD = {
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
 * Scrape posted date from Mercari item page
 * Mercari's search API doesn't return timestamps, so we scrape from the HTML
 */
async function scrapeMercariItemDate(itemId) {
  try {
    console.log(`📅 Scraping posted date for Mercari item ${itemId}...`);
    
    const url = `https://www.mercari.com/us/item/${itemId}/`;
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch item page ${itemId}: HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Try to find date in __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const item = nextData?.props?.pageProps?.item;
        
        // Look for created, updated, or any timestamp field
        if (item?.created) {
          const timestamp = typeof item.created === 'number' ? item.created : parseInt(item.created);
          const date = new Date(timestamp * 1000).toISOString();
          console.log(`✅ Found created date in __NEXT_DATA__: ${date}`);
          return date;
        }
        
        if (item?.updated) {
          const timestamp = typeof item.updated === 'number' ? item.updated : parseInt(item.updated);
          const date = new Date(timestamp * 1000).toISOString();
          console.log(`✅ Found updated date in __NEXT_DATA__: ${date}`);
          return date;
        }
        
        // Check for other possible date fields
        const dateFields = ['createdAt', 'updatedAt', 'listedAt', 'postedAt', 'timestamp'];
        for (const field of dateFields) {
          if (item?.[field]) {
            const timestamp = typeof item[field] === 'number' ? item[field] : parseInt(item[field]);
            if (!isNaN(timestamp)) {
              const date = new Date(timestamp * 1000).toISOString();
              console.log(`✅ Found ${field} in __NEXT_DATA__: ${date}`);
              return date;
            }
          }
        }
        
        // Log available fields for debugging
        if (item) {
          const allFields = Object.keys(item);
          const possibleDateFields = allFields.filter(key => 
            key.toLowerCase().includes('date') ||
            key.toLowerCase().includes('time') ||
            key.toLowerCase().includes('created') ||
            key.toLowerCase().includes('updated')
          );
          if (possibleDateFields.length > 0) {
            console.log(`🔍 Found possible date fields:`, possibleDateFields);
            possibleDateFields.forEach(field => {
              console.log(`  ${field}:`, item[field]);
            });
          }
        }
      } catch (e) {
        console.error(`❌ Failed to parse __NEXT_DATA__ for date:`, e);
      }
    }
    
    // NEW: Search ALL script tags for date timestamps (not just __NEXT_DATA__)
    // Mercari embeds date data in other script tags as JSON
    console.log(`🔍 Searching all script tags for date timestamps...`);
    const scriptMatches = html.matchAll(/<script[^>]*>(.*?)<\/script>/gs);
    
    for (const scriptMatch of scriptMatches) {
      const scriptContent = scriptMatch[1];
      
      // Look for "created":timestamp or "updated":timestamp patterns
      const createdMatch = scriptContent.match(/"(?:created|createdAt|created_at)":\s*(\d{10,13})/);
      const updatedMatch = scriptContent.match(/"(?:updated|updatedAt|updated_at)":\s*(\d{10,13})/);
      
      // Prefer 'updated' over 'created' (updated is more recent = posted date)
      if (updatedMatch) {
        const timestamp = parseInt(updatedMatch[1]);
        // Check if it's in milliseconds or seconds
        const date = timestamp > 10000000000 
          ? new Date(timestamp).toISOString() 
          : new Date(timestamp * 1000).toISOString();
        console.log(`✅ Found 'updated' timestamp in script tag: ${timestamp} = ${date}`);
        return date;
      }
      
      if (createdMatch) {
        const timestamp = parseInt(createdMatch[1]);
        const date = timestamp > 10000000000 
          ? new Date(timestamp).toISOString() 
          : new Date(timestamp * 1000).toISOString();
        console.log(`✅ Found 'created' timestamp in script tag: ${timestamp} = ${date}`);
        return date;
      }
    }
    
    console.log(`⚠️ No date timestamps found in script tags`);
    
    // Fallback: Look for "Posted X days ago" or "Listed on [date]" text in HTML
    const relativeTimePatterns = [
      /Posted\s+(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago/i,
      /Listed\s+(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago/i,
      /"posted":"([^"]+)"/i,
      /"listed":"([^"]+)"/i
    ];
    
    // Also look for "Listed on [date]" patterns (like Facebook)
    const listedOnPatterns = [
      /Listed\s+on\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Listed\s+on\s+(\d{4}-\d{2}-\d{2})/i,
      /Listed\s+on\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
      /Posted\s+on\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Posted\s+on\s+(\d{4}-\d{2}-\d{2})/i,
      /Posted\s+on\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i
    ];
    
    // Check for "Listed on [date]" first (absolute dates)
    for (const pattern of listedOnPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        try {
          const date = new Date(match[1]).toISOString();
          console.log(`✅ Found "Listed on" date via regex: ${match[1]} = ${date}`);
          return date;
        } catch (e) {
          console.log(`⚠️ Failed to parse date: ${match[1]}`);
        }
      }
    }
    
    for (const pattern of relativeTimePatterns) {
      const match = html.match(pattern);
      if (match) {
        if (match.length === 3) {
          // Relative time like "5 days ago"
          const amount = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          const now = new Date();
          
          switch(unit) {
            case 'second':
              now.setSeconds(now.getSeconds() - amount);
              break;
            case 'minute':
              now.setMinutes(now.getMinutes() - amount);
              break;
            case 'hour':
              now.setHours(now.getHours() - amount);
              break;
            case 'day':
              now.setDate(now.getDate() - amount);
              break;
            case 'week':
              now.setDate(now.getDate() - (amount * 7));
              break;
            case 'month':
              now.setMonth(now.getMonth() - amount);
              break;
          }
          
          const date = now.toISOString();
          console.log(`✅ Found relative date via regex: ${amount} ${unit}s ago = ${date}`);
          return date;
        } else if (match[1]) {
          // Absolute date string
          const date = new Date(match[1]).toISOString();
          console.log(`✅ Found date string via regex: ${date}`);
          return date;
        }
      }
    }
    
    console.log(`⚠️ Could not find posted date for item ${itemId}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error scraping date for item ${itemId}:`, error);
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
 * Fetch Mercari listings via GraphQL API using userItemsQuery
 * NEW: Uses the correct query that Mercari's own UI uses
 */
async function fetchMercariListings({ page = 1, status = 'on_sale' } = {}) {
  try {
    console.log('📡 Fetching Mercari listings via userItemsQuery...', { page, status });

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

    // Convert status string to Mercari's expected status format
    let mercariStatus;
    if (status === 'sold') {
      mercariStatus = 'sold_out';
    } else if (status === 'on_sale' || status === 'all') {
      // For 'all', we'll need to fetch both separately and merge
      mercariStatus = 'on_sale';
    } else {
      mercariStatus = 'on_sale'; // Default
    }

    // Prepare query using userItemsQuery (the correct query!)
    const query = {
      ...USER_ITEMS_QUERY,
      variables: {
        userItemsInput: {
          sellerId: parseInt(sellerId, 10),
          status: mercariStatus,
          keyword: "",
          sortBy: "created",
          sortType: "desc",
          page: page,
          includeTotalCount: true
        }
      }
    };
    
    console.log('🔑 Using seller ID:', sellerId, '-> parseInt:', parseInt(sellerId, 10));
    console.log('📊 Status mapping:', status, '->', mercariStatus);

    // Make the GraphQL request using GET method (like Mercari does)
    const queryParams = new URLSearchParams({
      operationName: query.operationName,
      variables: JSON.stringify(query.variables),
      extensions: JSON.stringify(query.extensions)
    });
    
    const url = `https://www.mercari.com/v1/api?${queryParams.toString()}`;

    console.log('📡 Making GET request to Mercari API...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'x-csrf-token': csrfToken,
        'accept': '*/*',
        'apollo-require-preflight': 'true',
        'x-app-version': '1',
        'x-double-web': '1',
        'x-platform': 'web',
      },
      credentials: 'include'
    });

    console.log('📥 GraphQL response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 Raw userItemsQuery response:', data);

    // NEW: Parse userItems response structure (different from search response)
    if (!data.data?.userItems) {
      console.error('❌ Unexpected response structure:', data);
      throw new Error('Invalid response structure from Mercari API');
    }

    const userItems = data.data.userItems;
    const items = userItems.items || [];
    const totalCount = userItems.totalCount || 0;
    const hasMore = userItems.hasMore || false;

    console.log('✅ Fetched', items.length, 'Mercari listings (total:', totalCount, ', hasMore:', hasMore, ')');
    console.log('📦 Sample item from userItemsQuery:', items[0]); // Log full item structure
    
    // DEBUG: Log ALL keys available in the first item
    if (items[0]) {
      console.log('🔍 ALL available fields in item:', Object.keys(items[0]));
      
      // Check for common fields
      const fieldsToCheck = [
        'id', 'name', 'price', 'status', 'photos', 'description',
        'created', 'updated', 'itemCondition', 'brand', 'itemCategory',
        'itemSize', 'color', 'favorites', 'numLikes', 'autoLiked'
      ];
      
      fieldsToCheck.forEach(field => {
        if (items[0].hasOwnProperty(field)) {
          console.log(`🔍   ${field}:`, typeof items[0][field], items[0][field]);
        }
      });
    }

    // Transform to our format with all available information
    const listings = await Promise.all(items.map(async (item, index) => {
      const listing = {
        itemId: item.id,
        title: item.name,
        price: item.price ? (item.price / 100) : 0, // Convert cents to dollars
        originalPrice: item.originalPrice ? (item.originalPrice / 100) : null,
        status: item.status,
        imageUrl: item.photos?.[0]?.imageUrl || item.photos?.[0]?.thumbnail || null,
        pictureURLs: (item.photos || []).map(p => p.imageUrl || p.thumbnail).filter(Boolean),
        
        // Detailed information from userItemsQuery
        description: item.description || null,
        condition: item.itemCondition?.name || null,
        brand: item.brand?.name || null,
        category: item.itemCategory?.name || null,
        categoryPath: (item.itemCategoryHierarchy || []).map(c => c.name).join(' > ') || null,
        size: item.itemSize?.name || null,
        color: item.color || null,
        
        // NEW: Additional metadata we can now capture
        favorites: item.favorites || 0,
        numLikes: item.numLikes || 0,
        autoLiked: item.autoLiked || false,
        
        // Posted/listed date (use created or updated timestamp)
        startTime: item.created ? new Date(item.created * 1000).toISOString() : 
                   item.updated ? new Date(item.updated * 1000).toISOString() : null,
        listingDate: item.created ? new Date(item.created * 1000).toISOString() :
                     item.updated ? new Date(item.updated * 1000).toISOString() : null,
        imported: false // Will be updated by frontend
      };
      
      // Debug log for date fields on first item
      if (index === 0) {
        console.log('🕐 Date field debug:', {
          itemId: item.id,
          raw_created: item.created,
          raw_updated: item.updated,
          startTime: listing.startTime,
          listingDate: listing.listingDate
        });
      }
      
      // If description is empty, try to scrape it from the page
      if (!listing.description || listing.description.length === 0) {
        console.log(`📝 Description empty for ${item.id}, attempting to scrape from page...`);
        const scrapedDesc = await scrapeMercariItemDescription(item.id);
        if (scrapedDesc) {
          listing.description = scrapedDesc;
        }
      }
      
      // If date is missing (API doesn't provide it), scrape from the page
      if (!listing.startTime) {
        console.log(`📅 Date missing for ${item.id}, attempting to scrape from page...`);
        const scrapedDate = await scrapeMercariItemDate(item.id);
        if (scrapedDate) {
          listing.startTime = scrapedDate;
          listing.listingDate = scrapedDate;
          console.log(`✅ Set scraped date for ${item.id}: ${scrapedDate}`);
        }
      }
      
      // Log first item details for debugging
      if (index === 0) {
        console.log('📦 First listing sample:', {
          itemId: listing.itemId,
          title: listing.title?.substring(0, 50),
          price: listing.price,
          status: listing.status,
          startTime: listing.startTime,
          listingDate: listing.listingDate,
          description: listing.description?.substring(0, 100),
          condition: listing.condition,
          brand: listing.brand,
          category: listing.category,
          size: listing.size,
          favorites: listing.favorites,
          numLikes: listing.numLikes
        });
      }
      
      return listing;
    }));

    // If status is 'all', we need to fetch both on_sale and sold_out
    if (status === 'all' && mercariStatus === 'on_sale') {
      console.log('🔄 Status is "all", fetching sold items as well...');
      
      // Recursively fetch sold items (page 1 only for now)
      const soldResult = await fetchMercariListings({ page: 1, status: 'sold' });
      
      if (soldResult.success) {
        // Merge the results
        const allListings = [...listings, ...soldResult.listings];
        
        console.log('✅ Combined on_sale + sold:', allListings.length, 'total items');
        
        return {
          success: true,
          listings: allListings,
          pagination: {
            currentPage: page,
            pageSize: listings.length + soldResult.listings.length,
            totalCount: totalCount + soldResult.pagination.totalCount,
            hasNext: hasMore || soldResult.pagination.hasNext
          }
        };
      }
    }

    return {
      success: true,
      listings,
      pagination: {
        currentPage: page,
        pageSize: items.length,
        totalCount,
        hasNext: hasMore
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
    scrapeMercariItemDescription, // Export for manual testing
    scrapeMercariItemDate // Export for manual testing
  };
}
