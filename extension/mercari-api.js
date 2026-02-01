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
      ...SEARCH_QUERY,
      variables: {
        criteria: {
          length: 20, // Items per page
          itemStatuses: [1], // 1 = on_sale, 2 = sold
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

    // Transform to our format with detailed information
    const listings = items.map((item, index) => {
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
        imported: false // Will be updated by frontend
      };
      
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
    });

    return {
      success: true,
      listings,
      pagination: {
        currentPage: 1,
        pageSize: 20,
        totalCount: count,
        hasNext: count > listings.length
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
