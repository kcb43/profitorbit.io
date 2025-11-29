/**
 * Mercari Integration (Stub)
 * 
 * Placeholder for Mercari marketplace integration.
 * Mercari API access requires business approval and special permissions.
 */

import { BaseIntegration } from '../base/BaseIntegration.js';

export class MercariIntegration extends BaseIntegration {
  constructor(config = {}) {
    super('mercari', {
      maxRequestsPerMinute: 100, // Estimated rate limit
      ...config,
    });
  }

  transformItemData(itemData) {
    // TODO: Implement Mercari-specific transformation
    return itemData;
  }

  async listItem(itemData, userTokens) {
    throw new Error(
      'Mercari integration is not yet available. ' +
      'Mercari API requires business approval and special access. ' +
      'This feature will be available once API access is granted.'
    );
  }

  async updateItem(listingId, itemData, userTokens) {
    throw new Error('Mercari integration is not yet available.');
  }

  async delistItem(listingId, userTokens) {
    throw new Error('Mercari integration is not yet available.');
  }

  async getListingStatus(listingId, userTokens) {
    throw new Error('Mercari integration is not yet available.');
  }

  async syncSoldItems(userTokens, since = null) {
    throw new Error('Mercari integration is not yet available.');
  }
}

