# Crosslisting System Documentation

## Overview

This document describes the Vendoo-style crosslisting system built into ProfitPulse. The system allows users to create an item once and list it across multiple marketplaces (Facebook Marketplace, eBay, Mercari, Poshmark, etc.) with a single click.

## Architecture

### Core Components

1. **Base Integration Class** (`src/integrations/base/BaseIntegration.js`)
   - Abstract base class for all marketplace integrations
   - Handles rate limiting, error handling, token validation
   - Provides consistent interface: `listItem()`, `updateItem()`, `delistItem()`, `getListingStatus()`, `syncSoldItems()`

2. **Marketplace Integrations** (`src/integrations/{marketplace}/`)
   - `FacebookIntegration.js` - Facebook Marketplace integration
   - `EbayIntegration.js` - eBay integration
   - `MercariIntegration.js` - Stub (requires API access)
   - `PoshmarkIntegration.js` - Stub (requires API access)

3. **Crosslisting Engine** (`src/services/CrosslistingEngine.js`)
   - Orchestrates crosslisting operations
   - Manages marketplace accounts and tokens
   - Handles bulk operations
   - Syncs sold items across marketplaces

4. **Unified Listing Form** (`src/components/UnifiedListingForm.jsx`)
   - Single master form for entering item details
   - Supports photos, pricing, condition, shipping options
   - Saves to central inventory

5. **Dashboard & UI** (`src/pages/`)
   - `CrosslistDashboard.jsx` - Main dashboard showing listing status per marketplace
   - `MarketplaceConnect.jsx` - Connection center for marketplace accounts

## Database Schema

See `CROSSLISTING_SCHEMA.md` for complete schema definitions. Required entities:

- **MarketplaceAccount** - Stores OAuth tokens per marketplace per user
- **MarketplaceListing** - Tracks which items are listed where
- **SyncLog** - Audits all sync operations
- **InventoryItem** (updated) - Added crosslisting fields

## Usage Flow

### 1. Connect Marketplaces

1. Navigate to **Marketplace Connect** page
2. Click "Connect" for each marketplace you want to use
3. Complete OAuth flow
4. Tokens are stored securely

### 2. Create Item

1. Navigate to **Crosslist Dashboard**
2. Click "New Item"
3. Fill out unified listing form:
   - Title, description, price
   - Condition, brand, category
   - Photos (up to 12)
   - Shipping options
   - Crosslisting settings
4. Save item

### 3. Crosslist Item

1. In **Crosslist Dashboard**, find your item
2. Click "List" button for desired marketplace(s)
3. Item is automatically transformed and listed
4. Status badges show listing status per marketplace

### 4. Bulk Operations

1. Select multiple items using checkboxes
2. Click "Bulk Actions"
3. Choose action: List, Delist, or Relist
4. Select marketplaces
5. Execute - items are processed with rate limiting

### 5. Auto-Delist on Sale

When an item is sold on one marketplace:
1. System detects sale via sync
2. If `auto_delist_on_sale` is enabled, automatically removes from other marketplaces
3. Updates inventory status to "sold"

## API Reference

### CrosslistingEngine

```javascript
import { crosslistingEngine } from '@/services/CrosslistingEngine';

// List item on single marketplace
await crosslistingEngine.listItemOnMarketplace(
  inventoryItemId,
  'facebook',
  userTokens,
  options
);

// Crosslist to multiple marketplaces
await crosslistingEngine.crosslistItem(
  inventoryItemId,
  ['facebook', 'ebay'],
  userTokens,
  options
);

// Delist from all marketplaces
await crosslistingEngine.delistItemEverywhere(
  inventoryItemId,
  userTokens
);

// Bulk list
await crosslistingEngine.bulkListItems(
  [itemId1, itemId2],
  ['facebook', 'ebay'],
  userTokens,
  { delayBetweenItems: 1000 }
);

// Sync sold items
await crosslistingEngine.syncSoldItems(userTokens);
```

### Marketplace Integration

```javascript
import { FacebookIntegration } from '@/integrations/facebook/FacebookIntegration';

const integration = new FacebookIntegration();

// List item
const result = await integration.listItem(itemData, userTokens);
// Returns: { success, listingId, listingUrl, pageId, pageName }

// Delist item
await integration.delistItem(listingId, userTokens);

// Get status
const status = await integration.getListingStatus(listingId, userTokens);
```

## Adding a New Marketplace

### Step 1: Create Integration Class

Create `src/integrations/{marketplace}/{Marketplace}Integration.js`:

```javascript
import { BaseIntegration } from '../base/BaseIntegration.js';

export class MarketplaceIntegration extends BaseIntegration {
  constructor(config = {}) {
    super('marketplace', {
      maxRequestsPerMinute: 100,
      ...config,
    });
  }

  transformItemData(itemData) {
    // Transform inventory item to marketplace format
    return {
      // Marketplace-specific fields
    };
  }

  async listItem(itemData, userTokens) {
    await this.checkRateLimit();
    await this.validateToken(userTokens.access_token);
    
    // Implement listing logic
    // Return: { success, listingId, listingUrl }
  }

  async updateItem(listingId, itemData, userTokens) {
    // Implement update logic
  }

  async delistItem(listingId, userTokens) {
    // Implement delist logic
  }

  async getListingStatus(listingId, userTokens) {
    // Implement status check
  }

  async syncSoldItems(userTokens, since = null) {
    // Implement sold items sync
  }
}
```

### Step 2: Add to CrosslistingEngine

Update `src/services/CrosslistingEngine.js`:

```javascript
import { MarketplaceIntegration } from '@/integrations/marketplace/MarketplaceIntegration';

// In constructor:
this.integrations = {
  // ... existing
  marketplace: new MarketplaceIntegration(),
};
```

### Step 3: Add OAuth Routes

Create OAuth routes in `api/{marketplace}/`:
- `auth.js` - Initiate OAuth
- `callback.js` - Handle OAuth callback
- `refresh-token.js` - Refresh tokens

### Step 4: Update UI

1. Add marketplace to `MARKETPLACES` array in `MarketplaceConnect.jsx`
2. Add marketplace column to `CrosslistDashboard.jsx`
3. Add icon and color constants

### Step 5: Update Schema

Add marketplace to enum in Base44 entities:
- `MarketplaceAccount.marketplace`
- `MarketplaceListing.marketplace`
- `SyncLog.marketplace`

## Error Handling

All integrations use consistent error handling:

```javascript
{
  error: 'AUTHENTICATION_FAILED' | 'RATE_LIMIT_EXCEEDED' | 'API_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR',
  message: 'Human-readable error message',
  retryable: boolean,
  status?: number, // HTTP status code if applicable
}
```

## Rate Limiting

Each integration enforces rate limits:
- Facebook: 200 requests/minute
- eBay: 5000 requests/minute
- Mercari/Poshmark: 100 requests/minute (estimated)

The engine adds delays between bulk operations to avoid rate limits.

## Token Management

- Tokens stored in localStorage (client-side) or Base44 MarketplaceAccount entity (server-side)
- Automatic token refresh when expired
- Token validation before each API call
- Clear error messages when tokens are invalid

## Security Considerations

1. **OAuth Tokens**: Should be encrypted at rest (implement encryption layer)
2. **API Keys**: Never expose in client-side code
3. **Rate Limiting**: Enforced to prevent abuse
4. **User Isolation**: Row Level Security (RLS) ensures users only see their own data

## Future Enhancements

1. **Background Jobs**: Use queue system for bulk operations
2. **Webhooks**: Receive real-time updates from marketplaces
3. **Smart Pricing**: Auto-adjust prices based on marketplace
4. **Template System**: Save marketplace-specific listing templates
5. **Analytics**: Track performance per marketplace
6. **Auto-Relist**: Automatically relist ended items

## Troubleshooting

### "Account Not Connected" Error
- Go to Marketplace Connect page
- Reconnect the marketplace account
- Verify OAuth tokens are valid

### "Rate Limit Exceeded" Error
- Wait for rate limit window to reset
- Reduce bulk operation size
- Increase delay between items

### "Listing Failed" Error
- Check marketplace-specific requirements (photos, fields, etc.)
- Verify item data is complete
- Check marketplace API status
- Review error message for specific issue

### Token Expiration
- Tokens auto-refresh when possible
- If refresh fails, user must reconnect
- Long-lived tokens (60 days for Facebook) reduce reconnection frequency

## Support

For marketplace-specific issues:
- **Facebook**: Check [Facebook Developers Documentation](https://developers.facebook.com/docs/marketplace)
- **eBay**: Check [eBay Developer Documentation](https://developer.ebay.com/)
- **Mercari/Poshmark**: API access required - contact marketplace for business API access

