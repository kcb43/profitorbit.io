/**
 * Facebook Graph API Client
 * 
 * This client provides access to Facebook's Graph API for Marketplace operations.
 * Requires user authorization via OAuth 2.0.
 * 
 * API Documentation: https://developers.facebook.com/docs/marketplace
 */

// Facebook Configuration
const FACEBOOK_CONFIG = {
  baseUrl: 'https://graph.facebook.com/v18.0',
  appId: import.meta.env.VITE_FACEBOOK_APP_ID || '',
};

/**
 * Get stored Facebook access token from localStorage
 * @returns {Object|null} Token object with access_token and expires_at, or null
 */
function getStoredToken() {
  try {
    const tokenData = localStorage.getItem('facebook_access_token');
    if (!tokenData) return null;
    
    const token = JSON.parse(tokenData);
    
    // Check if token is expired
    if (token.expires_at && Date.now() >= token.expires_at) {
      console.warn('Facebook token expired');
      localStorage.removeItem('facebook_access_token');
      return null;
    }
    
    return token;
  } catch (error) {
    console.error('Error reading Facebook token:', error);
    return null;
  }
}

/**
 * Store Facebook access token in localStorage
 * @param {Object} tokenData - Token data from OAuth callback
 */
function storeToken(tokenData) {
  try {
    localStorage.setItem('facebook_access_token', JSON.stringify(tokenData));
  } catch (error) {
    console.error('Error storing Facebook token:', error);
  }
}

/**
 * Clear stored Facebook token
 */
function clearToken() {
  try {
    localStorage.removeItem('facebook_access_token');
  } catch (error) {
    console.error('Error clearing Facebook token:', error);
  }
}

/**
 * Refresh Facebook access token if needed
 * @returns {Promise<string|null>} New access token or null if refresh failed
 */
async function refreshTokenIfNeeded() {
  const token = getStoredToken();
  if (!token) return null;

  // Check if token expires in less than 7 days
  const expiresAt = token.expires_at || 0;
  const daysUntilExpiry = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry > 7) {
    // Token is still valid, return it
    return token.access_token;
  }

  // Token is expiring soon, try to refresh
  try {
    const response = await fetch('/api/facebook/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: token.access_token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to refresh token: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const newTokenData = await response.json();
    
    // Update stored token
    const updatedToken = {
      access_token: newTokenData.access_token,
      expires_in: newTokenData.expires_in,
      token_type: newTokenData.token_type || 'bearer',
      expires_at: newTokenData.expires_at * 1000, // Convert to milliseconds
    };
    storeToken(updatedToken);

    return updatedToken.access_token;
  } catch (error) {
    console.error('Error refreshing Facebook token:', error);
    // If refresh fails, clear token so user can re-authenticate
    clearToken();
    return null;
  }
}

/**
 * Get valid access token, refreshing if necessary
 * @returns {Promise<string>} Valid access token
 * @throws {Error} If no token is available
 */
async function getAccessToken() {
  const token = getStoredToken();
  
  if (!token) {
    throw new Error('Facebook access token not found. Please connect your Facebook account in Settings.');
  }

  // Try to refresh if needed
  const refreshedToken = await refreshTokenIfNeeded();
  if (refreshedToken) {
    return refreshedToken;
  }

  return token.access_token;
}

/**
 * Make an authenticated request to Facebook Graph API
 * @param {string} endpoint - API endpoint (e.g., '/me' or '/{page-id}/feed')
 * @param {Object} options - Request options
 * @returns {Promise<Object>} API response
 */
async function makeRequest(endpoint, options = {}) {
  const accessToken = await getAccessToken();
  
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${FACEBOOK_CONFIG.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  // Add access token to query params
  const urlObj = new URL(url);
  urlObj.searchParams.append('access_token', accessToken);

  const response = await fetch(urlObj.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    
    // Handle token expiration
    if (response.status === 401 || errorData.error?.code === 190) {
      clearToken();
      throw new Error('Facebook access token expired. Please reconnect your account in Settings.');
    }

    throw new Error(
      `Facebook API error: ${response.status} - ${errorData.error?.message || errorData.error || 'Unknown error'}`
    );
  }

  return await response.json();
}

/**
 * Get user's Facebook pages (required for Marketplace listings)
 * @returns {Promise<Array>} Array of pages the user manages
 */
export async function getUserPages() {
  try {
    const response = await makeRequest('/me/accounts', {
      method: 'GET',
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching user pages:', error);
    throw error;
  }
}

/**
 * Create a Marketplace listing on Facebook
 * 
 * Note: Facebook Marketplace API requires:
 * 1. App to be in "Live" mode
 * 2. Business verification
 * 3. App review for marketplace permissions
 * 
 * @param {Object} listingData - Listing data
 * @param {string} listingData.pageId - Facebook Page ID to post on behalf of
 * @param {string} listingData.title - Listing title
 * @param {string} listingData.description - Listing description
 * @param {number} listingData.price - Price in cents (e.g., 1000 = $10.00)
 * @param {string} listingData.currency - Currency code (e.g., 'USD')
 * @param {string} listingData.category - Category ID (optional)
 * @param {Array<string>} listingData.imageUrls - Array of image URLs
 * @param {string} listingData.location - Location string (optional)
 * @param {Object} listingData.locationData - Location object with latitude/longitude (optional)
 * @returns {Promise<Object>} Created listing data
 */
export async function createMarketplaceListing(listingData) {
  const {
    pageId,
    title,
    description,
    price,
    currency = 'USD',
    category,
    imageUrls = [],
    location,
    locationData,
  } = listingData;

  if (!pageId) {
    throw new Error('Page ID is required for Marketplace listings');
  }
  if (!title) {
    throw new Error('Title is required');
  }
  if (!description) {
    throw new Error('Description is required');
  }
  if (!price || price <= 0) {
    throw new Error('Valid price is required');
  }
  if (imageUrls.length === 0) {
    throw new Error('At least one image is required');
  }

  try {
    // Facebook Marketplace listings are created as posts on a Page
    // The API endpoint is: /{page-id}/feed
    
    const postData = {
      message: `${title}\n\n${description}\n\nPrice: ${currency} ${(price / 100).toFixed(2)}`,
      published: true,
    };

    // Add location if provided
    if (locationData && locationData.latitude && locationData.longitude) {
      postData.place = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
      };
    } else if (location) {
      postData.place = location;
    }

    // Create the post
    const postResponse = await makeRequest(`/${pageId}/feed`, {
      method: 'POST',
      body: JSON.stringify(postData),
    });

    // Note: Facebook Marketplace API has specific endpoints for marketplace listings
    // However, these require special permissions and app review.
    // For now, we're creating a post on the page which can be manually converted to a marketplace listing.
    // 
    // The proper endpoint would be:
    // POST /{page-id}/marketplace_listings
    // But this requires:
    // - pages_manage_metadata permission
    // - pages_manage_posts permission
    // - App review approval
    // - Business verification

    console.log('Marketplace listing created (as post):', postResponse);

    return {
      id: postResponse.id,
      postId: postResponse.id,
      success: true,
      message: 'Listing created successfully. Note: You may need to manually convert this post to a Marketplace listing on Facebook.',
    };
  } catch (error) {
    console.error('Error creating Marketplace listing:', error);
    throw error;
  }
}

/**
 * Delete/Unpublish a Marketplace listing
 * @param {string} listingId - The listing/post ID to delete
 * @param {string} pageId - The page ID that owns the listing
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteMarketplaceListing(listingId, pageId) {
  if (!listingId) {
    throw new Error('Listing ID is required');
  }
  if (!pageId) {
    throw new Error('Page ID is required');
  }

  try {
    // Delete the post/listing
    const response = await makeRequest(`/${listingId}`, {
      method: 'DELETE',
    });

    return {
      success: response.success || true,
      message: 'Listing deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting Marketplace listing:', error);
    throw error;
  }
}

/**
 * Get Marketplace listing details
 * @param {string} listingId - The listing ID
 * @returns {Promise<Object>} Listing details
 */
export async function getMarketplaceListing(listingId) {
  if (!listingId) {
    throw new Error('Listing ID is required');
  }

  try {
    const response = await makeRequest(`/${listingId}`, {
      method: 'GET',
    });

    return response;
  } catch (error) {
    console.error('Error fetching Marketplace listing:', error);
    throw error;
  }
}

/**
 * Get user's Marketplace listings
 * @param {string} pageId - The page ID
 * @returns {Promise<Array>} Array of listings
 */
export async function getMarketplaceListings(pageId) {
  if (!pageId) {
    throw new Error('Page ID is required');
  }

  try {
    // Note: This endpoint may require special permissions
    const response = await makeRequest(`/${pageId}/feed`, {
      method: 'GET',
    });

    return response.data || [];
  } catch (error) {
    console.error('Error fetching Marketplace listings:', error);
    throw error;
  }
}

/**
 * Check if user has connected Facebook account
 * @returns {boolean} True if token exists and is valid
 */
export function isConnected() {
  const token = getStoredToken();
  return token !== null && token.access_token && 
         (!token.expires_at || Date.now() < token.expires_at);
}

/**
 * Get connection status with details
 * @returns {Promise<Object>} Connection status object
 */
export async function getConnectionStatus() {
  const token = getStoredToken();
  
  if (!token) {
    return {
      connected: false,
      message: 'Not connected',
    };
  }

  // Check if token is expired
  if (token.expires_at && Date.now() >= token.expires_at) {
    return {
      connected: false,
      message: 'Token expired',
      expired: true,
    };
  }

  // Try to validate token by making a simple API call
  try {
    await makeRequest('/me', { method: 'GET' });
    return {
      connected: true,
      message: 'Connected',
      expiresAt: token.expires_at,
      daysUntilExpiry: token.expires_at 
        ? Math.floor((token.expires_at - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    };
  } catch (error) {
    return {
      connected: false,
      message: 'Token invalid',
      error: error.message,
    };
  }
}

// Export token management functions
export { getStoredToken, storeToken, clearToken, getAccessToken };

// Export configuration
export const facebookConfig = FACEBOOK_CONFIG;

