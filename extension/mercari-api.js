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
    
    // If we don't have seller ID, try to extract it from the bearer token (JWT)
    let actualSellerId = sellerId;
    if (!actualSellerId) {
      console.log('⚠️ No seller ID stored, extracting from JWT token...');
      
      try {
        // JWT format: header.payload.signature
        // Decode the payload (middle part)
        const parts = bearerToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log('📦 JWT payload:', payload);
          
          // Mercari JWT structure: { b: "hash", data: { id, ... }, exp, iat }
          // The seller ID is likely in payload.data
          if (payload.data && payload.data.id) {
            actualSellerId = payload.data.id;
            console.log('✅ Extracted seller ID from JWT.data.id:', actualSellerId);
          } else if (payload.data && payload.data.sellerId) {
            actualSellerId = payload.data.sellerId;
            console.log('✅ Extracted seller ID from JWT.data.sellerId:', actualSellerId);
          } else if (payload.data && payload.data.userId) {
            actualSellerId = payload.data.userId;
            console.log('✅ Extracted seller ID from JWT.data.userId:', actualSellerId);
          } else {
            // Fallback: try root level fields
            actualSellerId = payload.sub || payload.userId || payload.sellerId || payload.id;
            if (actualSellerId) {
              console.log('✅ Extracted seller ID from JWT root:', actualSellerId);
            }
          }
          
          if (actualSellerId) {
            // Store it for next time
            chrome.storage.local.set({ 'mercari_seller_id': actualSellerId.toString() });
          }
        }
      } catch (e) {
        console.log('Could not decode JWT:', e);
      }
      
      // If still no seller ID, error out
      if (!actualSellerId) {
        throw new Error('Seller ID not found in JWT token. The authentication may have changed.');
      }
    }

    // Prepare query with seller ID
    const query = {
      ...USER_ITEMS_QUERY,
      variables: {
        ...USER_ITEMS_QUERY.variables,
        userItemsInput: {
          ...USER_ITEMS_QUERY.variables.userItemsInput,
          sellerId: parseInt(actualSellerId, 10),
          status,
          page
        }
      }
    };

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

    // Transform to our format
    const listings = items.map(item => ({
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
      imported: false // Will be updated by frontend
    }));

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
    fetchMercariListings
  };
}
