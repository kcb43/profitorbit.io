/**
 * Crosslisting Engine
 * 
 * Orchestrates listing, updating, and delisting items across multiple marketplaces.
 * This is the core Vendoo-style crosslisting system.
 */

import { FacebookIntegration } from '@/integrations/facebook/FacebookIntegration';
import { EbayIntegration } from '@/integrations/ebay/EbayIntegration';
import { MercariIntegration } from '@/integrations/mercari/MercariIntegration';
import { PoshmarkIntegration } from '@/integrations/poshmark/PoshmarkIntegration';
import { base44 } from '@/api/base44Client';

class CrosslistingEngine {
  constructor() {
    this.integrations = {
      facebook: new FacebookIntegration(),
      ebay: new EbayIntegration(),
      mercari: new MercariIntegration(),
      poshmark: new PoshmarkIntegration(),
    };
  }

  /**
   * Get integration instance for a marketplace
   */
  getIntegration(marketplace) {
    const integration = this.integrations[marketplace];
    if (!integration) {
      throw new Error(`Integration for ${marketplace} not found`);
    }
    return integration;
  }

  /**
   * Get user's marketplace accounts
   */
  async getMarketplaceAccounts(userId) {
    try {
      // This will use Base44 MarketplaceAccount entity when schema is added
      // For now, we'll use localStorage as a fallback
      const accounts = {};
      
      // Check Facebook
      const facebookToken = localStorage.getItem('facebook_access_token');
      if (facebookToken) {
        const tokenData = JSON.parse(facebookToken);
        accounts.facebook = {
          marketplace: 'facebook',
          access_token: tokenData.access_token,
          expires_at: tokenData.expires_at,
          isActive: tokenData.expires_at > Date.now(),
        };
      }

      // Check eBay
      const ebayToken = localStorage.getItem('ebay_user_token');
      if (ebayToken) {
        const tokenData = JSON.parse(ebayToken);
        accounts.ebay = {
          marketplace: 'ebay',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: tokenData.expires_at,
          isActive: tokenData.expires_at > Date.now(),
        };
      }

      return accounts;
    } catch (error) {
      console.error('Error getting marketplace accounts:', error);
      return {};
    }
  }

  /**
   * List an item on a single marketplace
   */
  async listItemOnMarketplace(inventoryItemId, marketplace, userTokens, options = {}) {
    try {
      const integration = this.getIntegration(marketplace);
      
      // Get inventory item data
      const inventoryItem = await base44.entities.InventoryItem.get(inventoryItemId);
      if (!inventoryItem) {
        throw new Error(`Inventory item ${inventoryItemId} not found`);
      }

      // Transform item data for marketplace
      const itemData = {
        title: inventoryItem.item_name,
        description: inventoryItem.notes || inventoryItem.item_name,
        price: inventoryItem.purchase_price * (options.priceMultiplier || 1.5), // Default 1.5x markup
        condition: inventoryItem.condition || 'good',
        brand: inventoryItem.brand || '',
        category: inventoryItem.category || '',
        photos: inventoryItem.image_url ? [{ imageUrl: inventoryItem.image_url }] : [],
        quantity: inventoryItem.quantity || 1,
        sku: inventoryItem.sku || inventoryItem.id,
        ...options.marketplaceSpecificData,
      };

      // List item
      const result = await integration.listItem(itemData, userTokens);

      // Save marketplace listing record
      await this.saveMarketplaceListing({
        inventory_item_id: inventoryItemId,
        marketplace,
        marketplace_listing_id: result.listingId,
        marketplace_listing_url: result.listingUrl,
        status: 'active',
        listed_at: new Date().toISOString(),
        metadata: result,
      });

      // Update inventory item
      await base44.entities.InventoryItem.update(inventoryItemId, {
        status: 'listed',
        marketplace_listings: [
          ...(inventoryItem.marketplace_listings || []),
          result.listingId,
        ],
      });

      return result;
    } catch (error) {
      console.error(`Error listing item on ${marketplace}:`, error);
      throw error;
    }
  }

  /**
   * List an item on multiple marketplaces (crosslist)
   */
  async crosslistItem(inventoryItemId, marketplaces, userTokens, options = {}) {
    const results = {
      success: [],
      errors: [],
    };

    // Get user's marketplace accounts
    const accounts = await this.getMarketplaceAccounts();
    
    // List on each marketplace
    for (const marketplace of marketplaces) {
      try {
        const account = accounts[marketplace];
        if (!account || !account.isActive) {
          results.errors.push({
            marketplace,
            error: 'Account not connected or token expired',
          });
          continue;
        }

        const result = await this.listItemOnMarketplace(
          inventoryItemId,
          marketplace,
          {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            ...userTokens,
          },
          options
        );

        results.success.push({
          marketplace,
          ...result,
        });
      } catch (error) {
        results.errors.push({
          marketplace,
          error: error.message || error.error || 'Unknown error',
          details: error,
        });
      }
    }

    return results;
  }

  /**
   * Delist an item from a marketplace
   */
  async delistItemFromMarketplace(listingId, marketplace, userTokens) {
    try {
      const integration = this.getIntegration(marketplace);
      const result = await integration.delistItem(listingId, userTokens);

      // Update marketplace listing record
      await this.updateMarketplaceListing(listingId, {
        status: 'removed',
        delisted_at: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      console.error(`Error delisting item from ${marketplace}:`, error);
      throw error;
    }
  }

  /**
   * Delist an item from all marketplaces
   */
  async delistItemEverywhere(inventoryItemId, userTokens) {
    // Get all marketplace listings for this item
    const listings = await this.getMarketplaceListings(inventoryItemId);
    const results = {
      success: [],
      errors: [],
    };

    for (const listing of listings) {
      if (listing.status === 'active') {
        try {
          const result = await this.delistItemFromMarketplace(
            listing.marketplace_listing_id,
            listing.marketplace,
            userTokens
          );
          results.success.push({
            marketplace: listing.marketplace,
            ...result,
          });
        } catch (error) {
          results.errors.push({
            marketplace: listing.marketplace,
            error: error.message || error.error || 'Unknown error',
          });
        }
      }
    }

    // Update inventory item status
    await base44.entities.InventoryItem.update(inventoryItemId, {
      status: 'available',
    });

    return results;
  }

  /**
   * Bulk list items across marketplaces
   */
  async bulkListItems(inventoryItemIds, marketplaces, userTokens, options = {}) {
    const results = {
      success: [],
      errors: [],
      total: inventoryItemIds.length,
      processed: 0,
    };

    // Process items with rate limiting
    for (const itemId of inventoryItemIds) {
      try {
        const result = await this.crosslistItem(itemId, marketplaces, userTokens, options);
        results.success.push({
          itemId,
          ...result,
        });
        results.processed++;
      } catch (error) {
        results.errors.push({
          itemId,
          error: error.message || error.error || 'Unknown error',
        });
        results.processed++;
      }

      // Add delay to avoid rate limits
      if (options.delayBetweenItems) {
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenItems));
      }
    }

    return results;
  }

  /**
   * Bulk delist items
   */
  async bulkDelistItems(inventoryItemIds, marketplaces, userTokens) {
    const results = {
      success: [],
      errors: [],
      total: inventoryItemIds.length,
      processed: 0,
    };

    for (const itemId of inventoryItemIds) {
      try {
        if (marketplaces.length === 0) {
          // Delist from all marketplaces
          const result = await this.delistItemEverywhere(itemId, userTokens);
          results.success.push({
            itemId,
            ...result,
          });
        } else {
          // Delist from specific marketplaces
          const listings = await this.getMarketplaceListings(itemId);
          for (const listing of listings) {
            if (marketplaces.includes(listing.marketplace) && listing.status === 'active') {
              try {
                const result = await this.delistItemFromMarketplace(
                  listing.marketplace_listing_id,
                  listing.marketplace,
                  userTokens
                );
                results.success.push({
                  itemId,
                  marketplace: listing.marketplace,
                  ...result,
                });
              } catch (error) {
                results.errors.push({
                  itemId,
                  marketplace: listing.marketplace,
                  error: error.message || error.error || 'Unknown error',
                });
              }
            }
          }
        }
        results.processed++;
      } catch (error) {
        results.errors.push({
          itemId,
          error: error.message || error.error || 'Unknown error',
        });
        results.processed++;
      }
    }

    return results;
  }

  /**
   * Relist an item (delist then list again)
   */
  async relistItem(inventoryItemId, marketplaces, userTokens, options = {}) {
    // First delist
    await this.delistItemEverywhere(inventoryItemId, userTokens);
    
    // Then list again
    return await this.crosslistItem(inventoryItemId, marketplaces, userTokens, options);
  }

  /**
   * Bulk relist items
   */
  async bulkRelistItems(inventoryItemIds, marketplaces, userTokens, options = {}) {
    const results = {
      success: [],
      errors: [],
      total: inventoryItemIds.length,
      processed: 0,
    };

    for (const itemId of inventoryItemIds) {
      try {
        const result = await this.relistItem(itemId, marketplaces, userTokens, options);
        results.success.push({
          itemId,
          ...result,
        });
        results.processed++;
      } catch (error) {
        results.errors.push({
          itemId,
          error: error.message || error.error || 'Unknown error',
        });
        results.processed++;
      }
    }

    return results;
  }

  /**
   * Save marketplace listing record
   */
  async saveMarketplaceListing(listingData) {
    // This will use Base44 MarketplaceListing entity when schema is added
    // For now, we'll store in localStorage as a fallback
    try {
      const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
      listings.push({
        ...listingData,
        id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem('marketplace_listings', JSON.stringify(listings));
    } catch (error) {
      console.error('Error saving marketplace listing:', error);
    }
  }

  /**
   * Upsert marketplace listing record (prevents "forgetting" across pages).
   * Keyed by (inventory_item_id + marketplace).
   */
  async upsertMarketplaceListing(listingData) {
    try {
      const inventoryItemId = listingData?.inventory_item_id;
      const marketplace = listingData?.marketplace;
      if (!inventoryItemId || !marketplace) return;

      const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
      const idx = listings.findIndex(
        (l) => l?.inventory_item_id === inventoryItemId && l?.marketplace === marketplace
      );

      const now = new Date().toISOString();
      const next = {
        ...listingData,
        inventory_item_id: inventoryItemId,
        marketplace,
        updated_at: now,
      };

      if (idx !== -1) {
        listings[idx] = { ...listings[idx], ...next };
      } else {
        listings.push({
          ...next,
          id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created_at: now,
        });
      }
      localStorage.setItem('marketplace_listings', JSON.stringify(listings));
    } catch (error) {
      console.error('Error upserting marketplace listing:', error);
    }
  }

  async removeMarketplaceListingForItem(inventoryItemId, marketplace) {
    try {
      const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
      const next = listings.filter(
        (l) => !(l?.inventory_item_id === inventoryItemId && l?.marketplace === marketplace)
      );
      localStorage.setItem('marketplace_listings', JSON.stringify(next));
    } catch (error) {
      console.error('Error removing marketplace listing:', error);
    }
  }

  /**
   * Update marketplace listing record
   */
  async updateMarketplaceListing(listingId, updates) {
    try {
      const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
      const index = listings.findIndex(l => l.marketplace_listing_id === listingId);
      if (index !== -1) {
        listings[index] = {
          ...listings[index],
          ...updates,
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem('marketplace_listings', JSON.stringify(listings));
      }
    } catch (error) {
      console.error('Error updating marketplace listing:', error);
    }
  }

  /**
   * Get marketplace listings for an item
   */
  async getMarketplaceListings(inventoryItemId) {
    try {
      const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
      return listings.filter(l => l.inventory_item_id === inventoryItemId);
    } catch (error) {
      console.error('Error getting marketplace listings:', error);
      return [];
    }
  }

  /**
   * Sync sold items from all connected marketplaces
   */
  async syncSoldItems(userTokens) {
    const accounts = await this.getMarketplaceAccounts();
    const allSoldItems = [];

    for (const [marketplace, account] of Object.entries(accounts)) {
      if (!account.isActive) continue;

      try {
        const integration = this.getIntegration(marketplace);
        const soldItems = await integration.syncSoldItems({
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          ...userTokens,
        });

        allSoldItems.push(...soldItems.map(item => ({
          ...item,
          marketplace,
        })));
      } catch (error) {
        console.error(`Error syncing sold items from ${marketplace}:`, error);
      }
    }

    // Process sold items - mark inventory as sold and auto-delist
    for (const soldItem of allSoldItems) {
      try {
        // Find inventory item by listing ID
        const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
        const listing = listings.find(l => l.marketplace_listing_id === soldItem.listingId);
        
        if (listing) {
          // Update inventory item status
          await base44.entities.InventoryItem.update(listing.inventory_item_id, {
            status: 'sold',
          });

          // Auto-delist from other marketplaces if enabled
          const inventoryItem = await base44.entities.InventoryItem.get(listing.inventory_item_id);
          if (inventoryItem?.auto_delist_on_sale) {
            await this.delistItemEverywhere(listing.inventory_item_id, userTokens);
          }
        }
      } catch (error) {
        console.error('Error processing sold item:', error);
      }
    }

    return allSoldItems;
  }
}

// Export singleton instance
export const crosslistingEngine = new CrosslistingEngine();
export default crosslistingEngine;

