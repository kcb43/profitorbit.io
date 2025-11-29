/**
 * eBay Integration
 * 
 * Handles listing, updating, and delisting items on eBay.
 * Uses eBay Trading API and requires OAuth authentication.
 */

import { BaseIntegration } from '../base/BaseIntegration.js';

export class EbayIntegration extends BaseIntegration {
  constructor(config = {}) {
    super('ebay', {
      maxRequestsPerMinute: 5000, // eBay's rate limit (varies by API)
      ...config,
    });
  }

  /**
   * Transform inventory item to eBay format
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
      sku,
      shippingOptions,
    } = itemData;

    // Get image URLs
    const imageUrls = photos.map(photo => 
      photo.imageUrl || photo.preview || photo
    ).filter(Boolean);

    return {
      Title: title || itemData.item_name,
      Description: description || itemData.notes || '',
      StartPrice: {
        '#': parseFloat(price) || 0,
        '@currencyID': 'USD',
      },
      ConditionID: this.mapCondition(condition),
      CategoryID: category || '',
      Quantity: quantity,
      SKU: sku || '',
      PictureDetails: {
        PictureURL: imageUrls,
      },
      ShippingDetails: this.mapShippingOptions(shippingOptions),
      ItemSpecifics: this.buildItemSpecifics(itemData),
    };
  }

  /**
   * Map condition to eBay condition ID
   */
  mapCondition(condition) {
    const conditionMap = {
      'new': 1000, // New
      'new_with_tags': 1000,
      'new_without_tags': 1500, // New other
      'like_new': 2750, // Like New
      'excellent': 3000, // Used - Excellent
      'very_good': 4000, // Used - Very Good
      'good': 5000, // Used - Good
      'fair': 6000, // Used - Acceptable
      'poor': 7000, // For parts or not working
    };

    return conditionMap[condition?.toLowerCase()] || 5000; // Default to Good
  }

  /**
   * Map shipping options to eBay format
   */
  mapShippingOptions(shippingOptions) {
    // This should be implemented based on eBay's shipping requirements
    return {
      ShippingType: 'Flat',
      ShippingServiceOptions: [
        {
          ShippingService: 'USPSPriority',
          ShippingServiceCost: {
            '#': 0,
            '@currencyID': 'USD',
          },
          ShippingServicePriority: 1,
        },
      ],
    };
  }

  /**
   * Build eBay ItemSpecifics
   */
  buildItemSpecifics(itemData) {
    const specifics = [];

    if (itemData.brand) {
      specifics.push({
        Name: 'Brand',
        Value: [itemData.brand],
      });
    }

    if (itemData.size) {
      specifics.push({
        Name: 'Size',
        Value: [itemData.size],
      });
    }

    return {
      NameValueList: specifics,
    };
  }

  /**
   * List an item on eBay
   */
  async listItem(itemData, userTokens) {
    try {
      await this.checkRateLimit();
      await this.validateToken(userTokens.access_token);

      // Transform item data
      const ebayData = this.transformItemData(itemData);

      // Call eBay Trading API via our API route
      const response = await fetch('/api/ebay/listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'AddItem',
          userToken: userTokens.access_token,
          itemData: ebayData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create eBay listing');
      }

      const result = await response.json();

      await this.logSync('list', 'success', {
        listingId: result.ItemID,
      });

      return {
        success: true,
        listingId: result.ItemID,
        listingUrl: `https://www.ebay.com/itm/${result.ItemID}`,
        fees: result.Fees,
        message: 'Listing created successfully',
      };
    } catch (error) {
      const errorInfo = this.handleError(error, 'listItem');
      await this.logSync('list', 'error', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * Update an existing eBay listing
   */
  async updateItem(listingId, itemData, userTokens) {
    try {
      await this.checkRateLimit();
      await this.validateToken(userTokens.access_token);

      // Transform item data
      const ebayData = this.transformItemData(itemData);
      ebayData.ItemID = listingId;

      // Call eBay Trading API via our API route
      const response = await fetch('/api/ebay/listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'ReviseItem',
          userToken: userTokens.access_token,
          itemData: ebayData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update eBay listing');
      }

      const result = await response.json();

      await this.logSync('update', 'success', {
        listingId,
      });

      return {
        success: true,
        listingId,
        message: 'Listing updated successfully',
      };
    } catch (error) {
      const errorInfo = this.handleError(error, 'updateItem');
      await this.logSync('update', 'error', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * Delist an item from eBay
   */
  async delistItem(listingId, userTokens) {
    try {
      await this.checkRateLimit();
      await this.validateToken(userTokens.access_token);

      // Call eBay Trading API via our API route
      const response = await fetch('/api/ebay/listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'EndItem',
          userToken: userTokens.access_token,
          itemId: listingId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delist eBay item');
      }

      const result = await response.json();

      await this.logSync('delist', 'success', {
        listingId,
      });

      return {
        success: true,
        listingId,
        message: 'Listing ended successfully',
      };
    } catch (error) {
      const errorInfo = this.handleError(error, 'delistItem');
      await this.logSync('delist', 'error', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * Get listing status from eBay
   */
  async getListingStatus(listingId, userTokens) {
    try {
      await this.checkRateLimit();
      await this.validateToken(userTokens.access_token);

      // Call eBay Trading API via our API route
      const response = await fetch('/api/ebay/listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'GetItem',
          userToken: userTokens.access_token,
          itemId: listingId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get eBay listing status');
      }

      const result = await response.json();
      const item = result.Item;

      return {
        listingId,
        status: item.ListingStatus || 'Active',
        sellingState: item.SellingStatus?.SellingState || 'Active',
        data: item,
      };
    } catch (error) {
      const errorInfo = this.handleError(error, 'getListingStatus');
      throw errorInfo;
    }
  }

  /**
   * Sync sold items from eBay
   */
  async syncSoldItems(userTokens, since = null) {
    try {
      await this.checkRateLimit();
      await this.validateToken(userTokens.access_token);

      // Call eBay Trading API to get sold items
      const response = await fetch('/api/ebay/listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'GetMyeBaySelling',
          userToken: userTokens.access_token,
          soldList: {
            Include: true,
            TimeFrom: since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync eBay sold items');
      }

      const result = await response.json();
      const soldItems = result.SoldList?.OrderTransactionArray?.OrderTransaction || [];

      await this.logSync('sync_sales', 'success', {
        soldItemsCount: soldItems.length,
      });

      return soldItems.map(item => ({
        listingId: item.Item?.ItemID,
        soldAt: item.Transaction?.CreatedDate,
        data: item,
      }));
    } catch (error) {
      const errorInfo = this.handleError(error, 'syncSoldItems');
      await this.logSync('sync_sales', 'error', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * Validate eBay access token
   */
  async validateToken(accessToken) {
    await super.validateToken(accessToken);

    // eBay tokens are validated by making a simple API call
    // This is handled by the API route
    return true;
  }
}

