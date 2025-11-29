# Crosslisting System Database Schema

This document defines the Base44 entity schemas needed for the Vendoo-style crosslisting system.

## Required Entities

### 1. MarketplaceAccount
Stores OAuth tokens and connection info for each marketplace per user.

```json
{
  "name": "MarketplaceAccount",
  "type": "object",
  "properties": {
    "marketplace": {
      "type": "string",
      "enum": ["facebook", "ebay", "mercari", "poshmark", "depop"],
      "description": "The marketplace platform"
    },
    "user_id": {
      "type": "string",
      "description": "User ID (from auth system)"
    },
    "access_token": {
      "type": "string",
      "description": "Encrypted OAuth access token"
    },
    "refresh_token": {
      "type": "string",
      "description": "Encrypted OAuth refresh token (if available)"
    },
    "token_expires_at": {
      "type": "string",
      "format": "date-time",
      "description": "When the access token expires"
    },
    "account_id": {
      "type": "string",
      "description": "Marketplace-specific account ID (e.g., eBay username, Facebook Page ID)"
    },
    "account_name": {
      "type": "string",
      "description": "Display name for the account (e.g., 'My eBay Store', 'Facebook Page Name')"
    },
    "is_active": {
      "type": "boolean",
      "default": true,
      "description": "Whether this account connection is active"
    },
    "last_sync_at": {
      "type": "string",
      "format": "date-time",
      "description": "Last time we synced listings from this marketplace"
    },
    "metadata": {
      "type": "object",
      "description": "Additional marketplace-specific data (JSON)"
    }
  },
  "required": ["marketplace", "user_id"],
  "rls": {
    "write": true
  }
}
```

### 2. MarketplaceListing
Tracks which inventory items are listed on which marketplaces.

```json
{
  "name": "MarketplaceListing",
  "type": "object",
  "properties": {
    "inventory_item_id": {
      "type": "string",
      "description": "Reference to InventoryItem"
    },
    "marketplace": {
      "type": "string",
      "enum": ["facebook", "ebay", "mercari", "poshmark", "depop"],
      "description": "The marketplace platform"
    },
    "marketplace_account_id": {
      "type": "string",
      "description": "Reference to MarketplaceAccount"
    },
    "marketplace_listing_id": {
      "type": "string",
      "description": "The listing ID returned by the marketplace API"
    },
    "marketplace_listing_url": {
      "type": "string",
      "description": "Direct URL to the listing on the marketplace"
    },
    "status": {
      "type": "string",
      "enum": ["draft", "active", "sold", "ended", "removed", "error"],
      "default": "draft",
      "description": "Current status of the listing"
    },
    "listed_at": {
      "type": "string",
      "format": "date-time",
      "description": "When the item was listed"
    },
    "sold_at": {
      "type": "string",
      "format": "date-time",
      "description": "When the item was sold (if applicable)"
    },
    "delisted_at": {
      "type": "string",
      "format": "date-time",
      "description": "When the item was delisted"
    },
    "sync_status": {
      "type": "string",
      "enum": ["synced", "pending", "error"],
      "default": "pending",
      "description": "Sync status with marketplace"
    },
    "last_synced_at": {
      "type": "string",
      "format": "date-time",
      "description": "Last time we synced this listing"
    },
    "error_message": {
      "type": "string",
      "description": "Error message if listing failed"
    },
    "metadata": {
      "type": "object",
      "description": "Marketplace-specific listing data (JSON)"
    }
  },
  "required": ["inventory_item_id", "marketplace", "marketplace_account_id"],
  "rls": {
    "write": true
  }
}
```

### 3. SyncLog
Tracks all sync operations for debugging and auditing.

```json
{
  "name": "SyncLog",
  "type": "object",
  "properties": {
    "marketplace": {
      "type": "string",
      "enum": ["facebook", "ebay", "mercari", "poshmark", "depop"],
      "description": "The marketplace platform"
    },
    "marketplace_account_id": {
      "type": "string",
      "description": "Reference to MarketplaceAccount"
    },
    "inventory_item_id": {
      "type": "string",
      "description": "Reference to InventoryItem (if applicable)"
    },
    "marketplace_listing_id": {
      "type": "string",
      "description": "Reference to MarketplaceListing (if applicable)"
    },
    "operation": {
      "type": "string",
      "enum": ["list", "update", "delist", "relist", "sync_status", "sync_sales"],
      "description": "The operation performed"
    },
    "status": {
      "type": "string",
      "enum": ["success", "error", "pending"],
      "description": "Operation status"
    },
    "error_message": {
      "type": "string",
      "description": "Error message if operation failed"
    },
    "response_data": {
      "type": "object",
      "description": "Response data from marketplace API (JSON)"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "When the sync operation occurred"
    }
  },
  "required": ["marketplace", "operation", "status"],
  "rls": {
    "write": true
  }
}
```

### 4. Update InventoryItem Entity

Add these fields to the existing InventoryItem entity:

```json
{
  "marketplace_listings": {
    "type": "array",
    "description": "Array of marketplace listing IDs (for quick reference)",
    "items": {
      "type": "string"
    }
  },
  "crosslist_enabled": {
    "type": "boolean",
    "default": false,
    "description": "Whether this item should be crosslisted to multiple marketplaces"
  },
  "auto_delist_on_sale": {
    "type": "boolean",
    "default": true,
    "description": "Automatically delist from other marketplaces when sold on one"
  }
}
```

## Implementation Notes

1. **Encryption**: Access tokens and refresh tokens should be encrypted at rest
2. **Indexing**: Create indexes on:
   - `marketplace_account_id` in MarketplaceListing
   - `inventory_item_id` in MarketplaceListing
   - `marketplace` + `status` in MarketplaceListing
3. **RLS**: All entities should have Row Level Security enabled for user isolation

