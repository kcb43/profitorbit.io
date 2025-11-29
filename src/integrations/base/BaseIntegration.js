/**
 * Base Integration Class
 * 
 * All marketplace integrations should extend this class to ensure
 * consistent interface and error handling.
 */

export class BaseIntegration {
  constructor(marketplaceName, config = {}) {
    this.marketplaceName = marketplaceName;
    this.config = config;
    this.rateLimiter = {
      requests: 0,
      resetAt: Date.now(),
      maxRequests: config.maxRequestsPerMinute || 60,
    };
  }

  /**
   * Check and enforce rate limits
   */
  async checkRateLimit() {
    const now = Date.now();
    if (now > this.rateLimiter.resetAt) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.resetAt = now + 60000; // Reset every minute
    }

    if (this.rateLimiter.requests >= this.rateLimiter.maxRequests) {
      const waitTime = this.rateLimiter.resetAt - now;
      throw new Error(
        `Rate limit exceeded for ${this.marketplaceName}. Please wait ${Math.ceil(waitTime / 1000)} seconds.`
      );
    }

    this.rateLimiter.requests++;
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken) {
    if (!accessToken) {
      throw new Error(`${this.marketplaceName} access token is required`);
    }

    // Check if token is expired
    // This should be implemented by each integration
    return true;
  }

  /**
   * Refresh access token if needed
   */
  async refreshToken(refreshToken) {
    // This should be implemented by each integration
    throw new Error('refreshToken must be implemented by integration');
  }

  /**
   * List an item on the marketplace
   * Must be implemented by each integration
   */
  async listItem(itemData, userTokens) {
    await this.checkRateLimit();
    await this.validateToken(userTokens.access_token);
    throw new Error('listItem must be implemented by integration');
  }

  /**
   * Update an existing listing
   * Must be implemented by each integration
   */
  async updateItem(listingId, itemData, userTokens) {
    await this.checkRateLimit();
    await this.validateToken(userTokens.access_token);
    throw new Error('updateItem must be implemented by integration');
  }

  /**
   * Delist/remove an item from the marketplace
   * Must be implemented by each integration
   */
  async delistItem(listingId, userTokens) {
    await this.checkRateLimit();
    await this.validateToken(userTokens.access_token);
    throw new Error('delistItem must be implemented by integration');
  }

  /**
   * Get listing status from marketplace
   * Must be implemented by each integration
   */
  async getListingStatus(listingId, userTokens) {
    await this.checkRateLimit();
    await this.validateToken(userTokens.access_token);
    throw new Error('getListingStatus must be implemented by integration');
  }

  /**
   * Sync sold items from marketplace
   * Must be implemented by each integration
   */
  async syncSoldItems(userTokens, since = null) {
    await this.checkRateLimit();
    await this.validateToken(userTokens.access_token);
    throw new Error('syncSoldItems must be implemented by integration');
  }

  /**
   * Transform inventory item to marketplace-specific format
   * Must be implemented by each integration
   */
  transformItemData(itemData) {
    throw new Error('transformItemData must be implemented by integration');
  }

  /**
   * Handle API errors consistently
   */
  handleError(error, operation) {
    console.error(`[${this.marketplaceName}] Error in ${operation}:`, error);

    if (error.response) {
      // API returned an error response
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        return {
          error: 'AUTHENTICATION_FAILED',
          message: 'Access token expired or invalid. Please reconnect your account.',
          retryable: false,
        };
      }

      if (status === 429) {
        return {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          retryable: true,
        };
      }

      return {
        error: 'API_ERROR',
        message: data?.error?.message || data?.message || 'API request failed',
        status,
        retryable: status >= 500, // Retry server errors
      };
    }

    if (error.request) {
      // Request was made but no response received
      return {
        error: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
        retryable: true,
      };
    }

    // Something else happened
    return {
      error: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      retryable: false,
    };
  }

  /**
   * Log sync operation
   */
  async logSync(operation, status, data = {}) {
    // This will be implemented to save to SyncLog entity
    console.log(`[${this.marketplaceName}] ${operation}: ${status}`, data);
  }
}

