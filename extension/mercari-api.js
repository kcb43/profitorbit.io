/**
 * Mercari API Module for Profit Orbit Extension
 * Handles fetching user's Mercari listings via GraphQL API
 */

// GraphQL query for fetching user items
const USER_ITEMS_QUERY = {
  operationName: "userItemsQuery",
  variables: {
    userItemsInput: {
      sellerId: null, // Will be populated dynamically
      status: "on_sale",
      keyword: "",
      sortBy: "updated",
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
 * Fetch detailed information for a single Mercari item
 */
async function fetchMercariItemDetails(itemId, bearerToken, csrfToken) {
  try {
    console.log(`🔍 Fetching details for Mercari item ${itemId}...`);
    
    const query = {
      operationName: "itemQuery",
      variables: {
        id: itemId
      },
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
      console.error(`❌ Failed to fetch item ${itemId}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.data?.item) {
      console.error(`❌ No item data for ${itemId}`);
      return null;
    }

    const item = data.data.item;
    
    // Extract detailed information
    const details = {
      description: item.description || null,
      condition: item.condition || null,
      brand: item.brand?.name || null,
      category: item.itemCategory?.name || null,
      size: item.size || null,
      // Additional metadata
      shippingFromState: item.shippingFromState || null,
      shippingPayer: item.shippingPayer || null,
      weight: item.weight || null,
      color: item.color || null,
    };

    console.log(`✅ Fetched details for item ${itemId}:`, {
      hasDescription: !!details.description,
      descriptionLength: details.description?.length,
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

    // Prepare query with seller ID
    const query = {
      ...USER_ITEMS_QUERY,
      variables: {
        ...USER_ITEMS_QUERY.variables,
        userItemsInput: {
          ...USER_ITEMS_QUERY.variables.userItemsInput,
          sellerId: parseInt(sellerId, 10),
          status,
          page
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

    if (!data.data?.userItems?.items) {
      console.error('❌ Unexpected response structure:', data);
      throw new Error('Invalid response structure from Mercari API');
    }

    const items = data.data.userItems.items;
    const pagination = data.data.userItems.pagination;

    console.log('✅ Fetched', items.length, 'Mercari listings');
    console.log('📄 Pagination:', pagination);

    // Fetch detailed information for each item
    console.log('🔍 Fetching detailed information for all items...');
    const detailsPromises = items.map(item => 
      fetchMercariItemDetails(item.id, bearerToken, csrfToken)
    );
    const itemDetails = await Promise.all(detailsPromises);
    const successfulDetails = itemDetails.filter(Boolean).length;
    console.log(`✅ Fetched details for ${successfulDetails} of ${items.length} items`);
    
    if (successfulDetails === 0) {
      console.warn('⚠️ No detailed information retrieved - items will have basic data only');
    }

    // Transform to our format with detailed information
    const listings = items.map((item, index) => {
      const details = itemDetails[index] || {};
      
      const listing = {
        itemId: item.id,
        title: item.name,
        price: item.price ? (item.price / 100) : 0, // Convert cents to dollars
        originalPrice: item.originalPrice ? (item.originalPrice / 100) : null,
        status: item.status,
        imageUrl: item.photos?.[0]?.imageUrl || item.photos?.[0]?.thumbnail || null,
        pictureURLs: (item.photos || []).map(p => p.imageUrl || p.thumbnail).filter(Boolean),
        numLikes: item.engagement?.numLikes || 0,
        numViews: item.engagement?.itemPv || 0,
        updated: item.updated ? new Date(item.updated * 1000).toISOString() : null,
        listingDate: item.updated ? new Date(item.updated * 1000).toISOString() : null,
        startTime: item.updated ? new Date(item.updated * 1000).toISOString() : null,
        // Detailed fields from item details query
        description: details.description || null,
        condition: details.condition || null,
        brand: details.brand || null,
        category: details.category || null,
        size: details.size || null,
        color: details.color || null,
        imported: false // Will be updated by frontend
      };
      
      // Log first item details for debugging
      if (index === 0) {
        console.log('📦 First listing sample:', {
          itemId: listing.itemId,
          title: listing.title?.substring(0, 50),
          hasDescription: !!listing.description,
          descriptionLength: listing.description?.length,
          condition: listing.condition,
          brand: listing.brand,
          size: listing.size
        });
      }
      
      return listing;
    });

    return {
      success: true,
      listings,
      pagination: {
        currentPage: pagination.currentPage,
        pageSize: pagination.pageSize,
        totalCount: pagination.totalCount,
        hasNext: pagination.hasNext
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
    fetchMercariItemDetails
  };
}
