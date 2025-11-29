# Guide: Adding a New Marketplace Integration

This guide explains how to add support for a new marketplace to the crosslisting system.

## Step-by-Step Process

### Step 1: Research Marketplace API

1. **Find API Documentation**
   - Search for "{Marketplace} API documentation"
   - Look for official developer portals
   - Check for OAuth 2.0 support

2. **Understand Requirements**
   - What OAuth scopes are needed?
   - What endpoints exist for listing/delisting?
   - What rate limits apply?
   - What data format is required?

3. **Check API Access**
   - Is API access public or requires approval?
   - Do you need business verification?
   - Are there any fees or restrictions?

### Step 2: Create Integration Class

Create `src/integrations/{marketplace}/{Marketplace}Integration.js`:

```javascript
import { BaseIntegration } from '../base/BaseIntegration.js';

export class MarketplaceIntegration extends BaseIntegration {
  constructor(config = {}) {
    super('marketplace', {
      maxRequestsPerMinute: 100, // Adjust based on API limits
      ...config,
    });
  }

  /**
   * Transform inventory item to marketplace format
   */
  transformItemData(itemData) {
    return {
      // Map your inventory fields to marketplace fields
      title: itemData.title || itemData.item_name,
      description: itemData.description,
      price: parseFloat(itemData.price),
      // ... marketplace-specific fields
    };
  }

  /**
   * List an item
   */
  async listItem(itemData, userTokens) {
    await this.checkRateLimit();
    await this.validateToken(userTokens.access_token);

    // Transform data
    const marketplaceData = this.transformItemData(itemData);

    // Make API call
    const response = await fetch('https://api.marketplace.com/listings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userTokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(marketplaceData),
    });

    if (!response.ok) {
      throw this.handleError(await response.json(), 'listItem');
    }

    const result = await response.json();

    await this.logSync('list', 'success', { listingId: result.id });

    return {
      success: true,
      listingId: result.id,
      listingUrl: result.url,
      message: 'Listing created successfully',
    };
  }

  /**
   * Update an item
   */
  async updateItem(listingId, itemData, userTokens) {
    // Similar to listItem but use PUT/PATCH
  }

  /**
   * Delist an item
   */
  async delistItem(listingId, userTokens) {
    // DELETE request to marketplace API
  }

  /**
   * Get listing status
   */
  async getListingStatus(listingId, userTokens) {
    // GET request to check status
  }

  /**
   * Sync sold items
   */
  async syncSoldItems(userTokens, since = null) {
    // GET request to fetch sold items
  }

  /**
   * Validate token
   */
  async validateToken(accessToken) {
    await super.validateToken(accessToken);
    // Marketplace-specific validation
    return true;
  }
}
```

### Step 3: Add OAuth Routes

Create three files in `api/{marketplace}/`:

#### `auth.js`
```javascript
export default async function handler(req, res) {
  const clientId = process.env[`${MARKETPLACE}_CLIENT_ID`];
  const redirectUri = `${baseUrl}/api/${marketplace}/callback`;
  
  // Build OAuth URL
  const authUrl = `https://${marketplace}.com/oauth/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${redirectUri}&` +
    `response_type=code&` +
    `scope=${requiredScopes}`;
  
  res.redirect(authUrl);
}
```

#### `callback.js`
```javascript
export default async function handler(req, res) {
  const { code } = req.query;
  
  // Exchange code for token
  const tokenResponse = await fetch('https://api.marketplace.com/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      code,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
    }),
  });
  
  const tokenData = await tokenResponse.json();
  
  // Redirect to frontend with token
  res.redirect(`${frontendUrl}/CrosslistComposer?${marketplace}_auth_success=1&token=${encodeURIComponent(JSON.stringify(tokenData))}`);
}
```

#### `refresh-token.js`
```javascript
export default async function handler(req, res) {
  const { refresh_token } = req.body;
  
  // Exchange refresh token for new access token
  // Similar to callback.js
}
```

### Step 4: Update CrosslistingEngine

In `src/services/CrosslistingEngine.js`:

```javascript
import { MarketplaceIntegration } from '@/integrations/marketplace/MarketplaceIntegration';

// In constructor:
this.integrations = {
  // ... existing
  marketplace: new MarketplaceIntegration(),
};
```

### Step 5: Update UI Components

#### MarketplaceConnect.jsx

Add to `MARKETPLACES` array:
```javascript
{
  id: 'marketplace',
  name: 'Marketplace Name',
  icon: MarketplaceIcon,
  color: 'bg-brand-color',
  description: 'List items on Marketplace',
  requiredPermissions: ['scope1', 'scope2'],
  status: 'available',
}
```

#### CrosslistDashboard.jsx

Add marketplace column to table:
```javascript
// In MARKETPLACE_ICONS:
marketplace: MarketplaceIcon,

// In MARKETPLACE_COLORS:
marketplace: 'bg-brand-color',

// In table header and body:
<th>Marketplace</th>
<td>
  {/* Status badge and actions */}
</td>
```

### Step 6: Update Schema

Add marketplace to enum in Base44:

1. Go to Base44 Dashboard
2. Edit `MarketplaceAccount` entity
3. Add `'marketplace'` to `marketplace` enum
4. Repeat for `MarketplaceListing` and `SyncLog`

### Step 7: Add Environment Variables

In Vercel:
```bash
MARKETPLACE_CLIENT_ID=your_client_id
MARKETPLACE_CLIENT_SECRET=your_client_secret
```

In `.env.local`:
```bash
VITE_MARKETPLACE_CLIENT_ID=your_client_id
VITE_MARKETPLACE_CLIENT_SECRET=your_client_secret
```

### Step 8: Test Integration

1. **OAuth Flow**
   - Connect account
   - Verify token storage
   - Test token refresh

2. **Listing**
   - Create test item
   - List on marketplace
   - Verify listing appears

3. **Delisting**
   - Delist item
   - Verify removal

4. **Error Handling**
   - Test with invalid token
   - Test with missing fields
   - Test rate limiting

5. **Bulk Operations**
   - Test bulk list
   - Test bulk delist
   - Verify rate limiting works

## Common Patterns

### OAuth 2.0 Flow
Most marketplaces use OAuth 2.0:
1. Redirect to authorization URL
2. User grants permissions
3. Redirect back with code
4. Exchange code for token
5. Store token securely

### Token Refresh
- Some marketplaces provide refresh tokens
- Others require re-authentication
- Implement based on marketplace's system

### Data Transformation
Each marketplace has different field requirements:
- Price format (cents vs dollars)
- Condition values (enum vs free text)
- Category IDs (marketplace-specific)
- Photo requirements (count, size, format)

### Error Handling
Marketplaces return different error formats:
- Standardize to our error format
- Handle rate limits
- Handle authentication errors
- Provide user-friendly messages

## Testing Checklist

- [ ] OAuth connection works
- [ ] Token storage works
- [ ] Token refresh works (if applicable)
- [ ] Listing creates successfully
- [ ] Listing appears on marketplace
- [ ] Delisting removes listing
- [ ] Status sync works
- [ ] Sold items sync works
- [ ] Error handling works
- [ ] Rate limiting works
- [ ] Bulk operations work
- [ ] UI displays correctly

## Example: Adding Depop

```javascript
// 1. Create DepopIntegration.js
export class DepopIntegration extends BaseIntegration {
  constructor(config = {}) {
    super('depop', { maxRequestsPerMinute: 60 });
  }
  
  transformItemData(itemData) {
    return {
      name: itemData.title,
      description: itemData.description,
      price: Math.round(itemData.price * 100), // Depop uses cents
      brand: itemData.brand,
      condition: this.mapCondition(itemData.condition),
      photos: itemData.photos.map(p => p.imageUrl),
    };
  }
  
  async listItem(itemData, userTokens) {
    // Depop API implementation
  }
  // ... other methods
}

// 2. Add OAuth routes in api/depop/
// 3. Update CrosslistingEngine
// 4. Update UI components
// 5. Update schema enums
// 6. Add environment variables
```

## Resources

- [Base Integration Class](./src/integrations/base/BaseIntegration.js) - Reference implementation
- [Facebook Integration](./src/integrations/facebook/FacebookIntegration.js) - Example implementation
- [eBay Integration](./src/integrations/ebay/EbayIntegration.js) - Example implementation
- [Crosslisting Engine](./src/services/CrosslistingEngine.js) - How integrations are used

## Need Help?

- Check existing integrations for patterns
- Review [CROSSLISTING_DOCUMENTATION.md](./CROSSLISTING_DOCUMENTATION.md)
- Test with one item before bulk operations
- Use browser DevTools to debug API calls

