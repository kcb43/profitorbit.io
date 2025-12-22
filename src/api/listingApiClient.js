/**
 * API Client for Render API (Listing Automation Service)
 * Handles platform connections and listing job management
 */

const LISTING_API_URL =
  import.meta.env.VITE_LISTING_API_URL ||
  'https://profitorbit-api.fly.dev';

/**
 * Get authentication token from Supabase session
 */
async function getAuthToken() {
  try {
    const { supabase } = await import('./supabaseClient');
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const token = await getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${LISTING_API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Platform Connection API
 */
export const platformApi = {
  /**
   * Connect a platform (via Chrome extension)
   * The extension should call this with cookies
   */
  async connect(platform, cookies, userAgent) {
    return apiRequest('/api/platform/connect', {
      method: 'POST',
      body: JSON.stringify({
        platform,
        cookies,
        userAgent,
        meta: {
          capturedAt: new Date().toISOString(),
        },
      }),
    });
  },

  /**
   * Get connection status for all platforms
   */
  async getStatus() {
    const result = await apiRequest('/api/platform/status');
    return result.platforms || [];
  },

  /**
   * Disconnect a platform
   */
  async disconnect(platform) {
    return apiRequest(`/api/platform/disconnect/${platform}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Listing Jobs API
 */
export const listingJobsApi = {
  /**
   * Create a new listing job
   * @param {string} inventoryItemId - Inventory item ID (optional)
   * @param {string[]} platforms - Array of platform IDs (e.g., ['mercari', 'facebook'])
   * @param {object} payload - Listing data (title, description, price, images, etc.)
   */
  async createJob(inventoryItemId, platforms, payload) {
    return apiRequest('/api/listings/create-job', {
      method: 'POST',
      body: JSON.stringify({
        inventory_item_id: inventoryItemId || null,
        platforms,
        payload,
      }),
    });
  },

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId) {
    const result = await apiRequest(`/api/listings/jobs/${jobId}`);
    return result.job;
  },

  /**
   * List all jobs for current user
   */
  async listJobs(status = null) {
    const params = status ? `?status=${status}` : '';
    const result = await apiRequest(`/api/listings/jobs${params}`);
    return result.jobs || [];
  },
};

export default {
  platform: platformApi,
  jobs: listingJobsApi,
};


