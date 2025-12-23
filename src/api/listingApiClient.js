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
    const mod = await import('./supabaseClient');
    console.log("AUTH DEBUG: supabaseClient module", mod);

    const supabase = mod.supabase;
    if (!supabase) {
      console.error("AUTH DEBUG: supabase is undefined");
      return null;
    }

    const { data, error } = await supabase.auth.getSession();
    console.log("AUTH DEBUG: session result", data, error);

    return data?.session?.access_token || null;
  } catch (error) {
    console.error('AUTH DEBUG: getAuthToken failed:', error);
    return null;
  }
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  console.log("API REQUEST DEBUG: Starting request", { endpoint, LISTING_API_URL });
  
  const token = await getAuthToken();
  console.log("API REQUEST DEBUG: Token retrieved", { hasToken: !!token, tokenLength: token?.length });
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  
  console.log("API REQUEST DEBUG: Request headers", { ...headers, Authorization: token ? 'Bearer ***' : 'missing' });
  console.log("API REQUEST DEBUG: Full URL", `${LISTING_API_URL}${endpoint}`);

  const response = await fetch(`${LISTING_API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  console.log("API REQUEST DEBUG: Response received", { status: response.status, ok: response.ok });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    console.error("API REQUEST DEBUG: Request failed", { status: response.status, error });
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


