/**
 * Crosslisting Engine
 *
 * Orchestrates listing, updating, and delisting items across multiple marketplaces.
 * Uses Supabase marketplace_listings table as primary store,
 * with localStorage as a fast cache / offline fallback.
 */

import { FacebookIntegration } from '@/integrations/facebook/FacebookIntegration';
import { EbayIntegration } from '@/integrations/ebay/EbayIntegration';
import { MercariIntegration } from '@/integrations/mercari/MercariIntegration';
import { PoshmarkIntegration } from '@/integrations/poshmark/PoshmarkIntegration';
import { apiClient } from '@/api/base44Client';

const LS_KEY = 'marketplace_listings';

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

  // ─── API helpers (DB-first, localStorage fallback) ───────────────────

  /**
   * Call the marketplace-listings API. Returns null on failure (fallback to LS).
   */
  async _apiCall(method, params = {}, body = null) {
    try {
      const qs = new URLSearchParams(params).toString();
      const url = `/api/marketplace-listings${qs ? `?${qs}` : ''}`;
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  // ─── localStorage helpers (cache / offline fallback) ─────────────────

  _lsRead() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  }

  _lsWrite(listings) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(listings)); } catch {}
  }

  // ─── Public CRUD methods ─────────────────────────────────────────────

  /**
   * Get user's marketplace accounts
   */
  async getMarketplaceAccounts(userId) {
    try {
      const accounts = {};

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

      const inventoryItem = await apiClient.entities.InventoryItem.get(inventoryItemId);
      if (!inventoryItem) {
        throw new Error(`Inventory item ${inventoryItemId} not found`);
      }

      const itemData = {
        title: inventoryItem.item_name,
        description: inventoryItem.notes || inventoryItem.item_name,
        price: inventoryItem.purchase_price * (options.priceMultiplier || 1.5),
        condition: inventoryItem.condition || 'good',
        brand: inventoryItem.brand || '',
        category: inventoryItem.category || '',
        photos: inventoryItem.image_url ? [{ imageUrl: inventoryItem.image_url }] : [],
        quantity: inventoryItem.quantity || 1,
        sku: inventoryItem.sku || inventoryItem.id,
        ...options.marketplaceSpecificData,
      };

      const result = await integration.listItem(itemData, userTokens);

      // Save to DB (and LS cache)
      await this.upsertMarketplaceListing({
        inventory_item_id: inventoryItemId,
        marketplace,
        marketplace_listing_id: result.listingId,
        marketplace_listing_url: result.listingUrl,
        status: 'active',
        listed_at: new Date().toISOString(),
        metadata: result,
      });

      // Update inventory item
      await apiClient.entities.InventoryItem.update(inventoryItemId, {
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

    const accounts = await this.getMarketplaceAccounts();

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

    await apiClient.entities.InventoryItem.update(inventoryItemId, {
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

    for (const itemId of inventoryItemIds) {
      try {
        const result = await this.crosslistItem(itemId, marketplaces, userTokens, options);
        results.success.push({ itemId, ...result });
        results.processed++;
      } catch (error) {
        results.errors.push({ itemId, error: error.message || 'Unknown error' });
        results.processed++;
      }
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
          const result = await this.delistItemEverywhere(itemId, userTokens);
          results.success.push({ itemId, ...result });
        } else {
          const listings = await this.getMarketplaceListings(itemId);
          for (const listing of listings) {
            if (marketplaces.includes(listing.marketplace) && listing.status === 'active') {
              try {
                const result = await this.delistItemFromMarketplace(
                  listing.marketplace_listing_id,
                  listing.marketplace,
                  userTokens
                );
                results.success.push({ itemId, marketplace: listing.marketplace, ...result });
              } catch (error) {
                results.errors.push({
                  itemId,
                  marketplace: listing.marketplace,
                  error: error.message || 'Unknown error',
                });
              }
            }
          }
        }
        results.processed++;
      } catch (error) {
        results.errors.push({ itemId, error: error.message || 'Unknown error' });
        results.processed++;
      }
    }

    return results;
  }

  /**
   * Relist an item (delist then list again)
   */
  async relistItem(inventoryItemId, marketplaces, userTokens, options = {}) {
    await this.delistItemEverywhere(inventoryItemId, userTokens);
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
        results.success.push({ itemId, ...result });
        results.processed++;
      } catch (error) {
        results.errors.push({ itemId, error: error.message || 'Unknown error' });
        results.processed++;
      }
    }

    return results;
  }

  // ─── Marketplace listing persistence (DB + LS cache) ─────────────────

  /**
   * Save a new marketplace listing record.
   * Writes to DB first, then updates LS cache.
   */
  async saveMarketplaceListing(listingData) {
    const dbResult = await this._apiCall('POST', {}, listingData);

    const listings = this._lsRead();
    listings.push({
      ...listingData,
      id: dbResult?.id || `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    });
    this._lsWrite(listings);
  }

  /**
   * Upsert marketplace listing record (prevents "forgetting" across pages).
   * Keyed by (inventory_item_id + marketplace).
   */
  async upsertMarketplaceListing(listingData) {
    const inventoryItemId = listingData?.inventory_item_id;
    const marketplace = listingData?.marketplace;
    if (!inventoryItemId || !marketplace) return;

    // Try DB
    await this._apiCall('POST', {}, listingData);

    // Update LS cache
    const listings = this._lsRead();
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
    this._lsWrite(listings);
  }

  async removeMarketplaceListingForItem(inventoryItemId, marketplace) {
    await this._apiCall('DELETE', { inventory_item_id: inventoryItemId, marketplace });

    const listings = this._lsRead();
    const next = listings.filter(
      (l) => !(l?.inventory_item_id === inventoryItemId && l?.marketplace === marketplace)
    );
    this._lsWrite(next);
  }

  /**
   * Update marketplace listing record
   */
  async updateMarketplaceListing(listingId, updates) {
    const listings = this._lsRead();
    const existing = listings.find(l => l.marketplace_listing_id === listingId);

    if (existing?.inventory_item_id && existing?.marketplace) {
      await this._apiCall('PUT', {}, {
        inventory_item_id: existing.inventory_item_id,
        marketplace: existing.marketplace,
        ...updates,
      });
    }

    const index = listings.findIndex(l => l.marketplace_listing_id === listingId);
    if (index !== -1) {
      listings[index] = {
        ...listings[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      this._lsWrite(listings);
    }
  }

  /**
   * Get marketplace listings for an item.
   * Tries DB first, falls back to LS cache.
   */
  async getMarketplaceListings(inventoryItemId) {
    if (inventoryItemId) {
      const dbData = await this._apiCall('GET', { inventory_item_id: inventoryItemId });
      if (Array.isArray(dbData) && dbData.length > 0) {
        return dbData;
      }
    }

    // Fallback to LS cache
    const listings = this._lsRead();
    if (inventoryItemId) {
      return listings.filter(l => l.inventory_item_id === inventoryItemId);
    }
    return listings;
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
        // Try DB-backed lookup first, then LS fallback
        const allListings = await this.getMarketplaceListings(null);
        const listing = allListings.find(l => l.marketplace_listing_id === soldItem.listingId);

        if (listing) {
          await apiClient.entities.InventoryItem.update(listing.inventory_item_id, {
            status: 'sold',
          });

          const inventoryItem = await apiClient.entities.InventoryItem.get(listing.inventory_item_id);
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
