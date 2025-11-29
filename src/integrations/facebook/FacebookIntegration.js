/**
 * Facebook Marketplace Integration
 * 
 * Handles listing, updating, and delisting items on Facebook Marketplace.
 * Requires OAuth authentication with pages_manage_posts permission.
 */

import { BaseIntegration } from '../base/BaseIntegration.js';
import { createMarketplaceListing, deleteMarketplaceListing, getUserPages } from '@/api/facebookClient';

export class FacebookIntegration extends BaseIntegration {
  constructor(config = {}) {
    super('facebook', {
      maxRequestsPerMinute: 200, // Facebook's rate limit
      ...config,
    });
  }

  /**
   * Transform inventory item to Facebook Marketplace format
   */
  transformItemData(itemData) {
    const {
      title,
      description,
      price,
      condition,
      brand,
      category,
      photos = [],
      quantity = 1,
      shippingPrice,
      meetUpLocation,
      allowOffers = true,
      localPickup = true,
    } = itemData;

    // Facebook requires price in cents
    const priceInCents = Math.round((parseFloat(price) || 0) * 100);

    // Get image URLs
    const imageUrls = photos.map(photo => 
      photo.imageUrl || photo.preview || photo
    ).filter(Boolean);

    if (imageUrls.length === 0) {
      throw new Error('At least one image is required for Facebook Marketplace');
    }

    return {
      title: title || itemData.item_name,
      description: description || itemData.notes || '',
      price: priceInCents,
      currency: 'USD',
      category: category || '',
      condition: this.mapCondition(condition),
      brand: brand || '',
      imageUrls,
      quantity,
      shippingPrice,
      meetUpLocation,
      allowOffers,
      localPickup,
    };
  }

  /**
   * Map condition to Facebook format
   */
  mapCondition(condition) {
    const conditionMap = {
      'new': 'NEW',
      'new_with_tags': 'NEW',
      'new_without_tags': 'NEW',
      'like_new': 'EXCELLENT',
      'excellent': 'EXCELLENT',
      'very_good': 'VERY_GOOD',
      'good': 'GOOD',
      'fair': 'FAIR',
      'poor': 'POOR',
    };

    return conditionMap[condition?.toLowerCase()] || 'GOOD';
  }

  /**
   * List an item on Facebook Marketplace
   */
  async listItem(itemData, userTokens) {
    try {
      await this.checkRateLimit();
      await this.validateToken(userTokens.access_token);

      // Get user's pages (required for Marketplace listings)
      const pages = await getUserPages();
      if (pages.length === 0) {
        throw new Error('No Facebook Pages found. You must manage at least one Page to create Marketplace listings.');
      }

      // Use the first page or the one specified in itemData
      const pageId = itemData.facebookPageId || pages[0].id;
      const page = pages.find(p => p.id === pageId);
      if (!page) {
        throw new Error(`Facebook Page ${pageId} not found`);
      }

      // Transform item data
      const facebookData = this.transformItemData(itemData);

      // Create listing
      const result = await createMarketplaceListing({
        pageId,
        ...facebookData,
      });

      // Log success
      await this.logSync('list', 'success', {
        listingId: result.id,
        pageId,
      });

      return {
        success: true,
        listingId: result.id,
        listingUrl: `https://www.facebook.com/marketplace/item/${result.id}`,
        pageId,
        pageName: page.name,
        message: result.message || 'Listing created successfully',
      };
    } catch (error) {
      const errorInfo = this.handleError(error, 'listItem');
      await this.logSync('list', 'error', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * Update an existing Facebook Marketplace listing
   */
  async updateItem(listingId, itemData, userTokens) {
    try {
      await this.checkRateLimit();
      await this.validateToken(userTokens.access_token);

      // Facebook Marketplace API doesn't have a direct update endpoint
      // We need to delist and relist, or use the Graph API to update the post
      // For now, we'll throw an error indicating this needs to be implemented
      // based on Facebook's current API capabilities

      throw new Error(
        'Facebook Marketplace update is not directly supported. ' +
        'Please delist and relist the item, or use Facebook\'s native editing tools.'
      );
    } catch (error) {
      const errorInfo = this.handleError(error, 'updateItem');
      await this.logSync('update', 'error', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * Delist an item from Facebook Marketplace
   */
  async delistItem(listingId, userTokens) {
    try {
      await this.checkRateLimit();
      await this.validateToken(userTokens.access_token);

      // Get page ID from listing metadata or user tokens
      const pageId = userTokens.pageId;
      if (!pageId) {
        throw new Error('Page ID is required to delist Facebook Marketplace items');
      }

      // Delete listing
      const result = await deleteMarketplaceListing(listingId, pageId);

      // Log success
      await this.logSync('delist', 'success', {
        listingId,
        pageId,
      });

      return {
        success: true,
        listingId,
        message: result.message || 'Listing deleted successfully',
      };
    } catch (error) {
      const errorInfo = this.handleError(error, 'delistItem');
      await this.logSync('delist', 'error', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * Get listing status from Facebook
   */
  async getListingStatus(listingId, userTokens) {
    try {
      await this.checkRateLimit();
      await this.validateToken(userTokens.access_token);

      // Import Facebook client
      const { getMarketplaceListing } = await import('@/api/facebookClient');
      const listing = await getMarketplaceListing(listingId);

      return {
        listingId,
        status: listing.status || 'active',
        data: listing,
      };
    } catch (error) {
      const errorInfo = this.handleError(error, 'getListingStatus');
      throw errorInfo;
    }
  }

  /**
   * Sync sold items from Facebook Marketplace
   */
  async syncSoldItems(userTokens, since = null) {
    try {
      await this.checkRateLimit();
      await this.validateToken(userTokens.access_token);

      // Get user's pages
      const pages = await getUserPages();
      const soldItems = [];

      // Check each page for sold items
      for (const page of pages) {
        try {
          const { getMarketplaceListings } = await import('@/api/facebookClient');
          const listings = await getMarketplaceListings(page.id);

          // Filter for sold items
          const pageSoldItems = listings
            .filter(listing => listing.status === 'sold')
            .map(listing => ({
              listingId: listing.id,
              pageId: page.id,
              soldAt: listing.updated_time || new Date().toISOString(),
              data: listing,
            }));

          soldItems.push(...pageSoldItems);
        } catch (error) {
          console.error(`Error syncing sold items for page ${page.id}:`, error);
        }
      }

      await this.logSync('sync_sales', 'success', {
        soldItemsCount: soldItems.length,
      });

      return soldItems;
    } catch (error) {
      const errorInfo = this.handleError(error, 'syncSoldItems');
      await this.logSync('sync_sales', 'error', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * Validate Facebook access token
   */
  async validateToken(accessToken) {
    await super.validateToken(accessToken);

    try {
      // Check if token is valid by making a simple API call
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me?access_token=${accessToken}`
      );

      if (!response.ok) {
        throw new Error('Invalid or expired Facebook access token');
      }

      return true;
    } catch (error) {
      throw new Error('Facebook access token validation failed');
    }
  }
}

