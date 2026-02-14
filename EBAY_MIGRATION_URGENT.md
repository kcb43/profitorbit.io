# 🚨 URGENT: eBay Finding API Decommissioned

## Critical Issue Found

**eBay Finding API was DECOMMISSIONED on February 4, 2025** (10 days ago!)

This is why we're getting 500 errors - the API endpoint no longer exists.

Source: https://developer.ebay.com/develop/apis/api-deprecation-status

```
Finding API - All methods - Decommission Date: 2025/02/04
Shopping API - All methods - Decommission Date: 2025/02/04
Replacement: Browse API
```

---

## Migration Required: Finding API → Browse API

### Old API (DEAD):
```
https://svcs.ebay.com/services/search/FindingService/v1
❌ DECOMMISSIONED February 4, 2025
```

### New API (REQUIRED):
```
https://api.ebay.com/buy/browse/v1/item_summary/search
✅ Active and supported
```

---

## Key Differences

### Authentication:
- **Finding API:** App ID in URL parameter (simple)
- **Browse API:** OAuth 2.0 token required (more complex)

### Endpoint:
- **Finding API:** `findItemsAdvanced` operation
- **Browse API:** `/item_summary/search` endpoint

### Request Format:
**Finding API (OLD):**
```
GET https://svcs.ebay.com/services/search/FindingService/v1?
  OPERATION-NAME=findItemsAdvanced&
  SECURITY-APPNAME=YourAppID&
  keywords=Nintendo+Switch
```

**Browse API (NEW):**
```
GET https://api.ebay.com/buy/browse/v1/item_summary/search?q=Nintendo+Switch
Headers:
  Authorization: Bearer <access_token>
  X-EBAY-C-MARKETPLACE-ID: EBAY_US
```

---

## Implementation Steps

### Step 1: Get OAuth Token

The Browse API requires an OAuth 2.0 Application token.

**Get Client Credentials:**
```javascript
const getEbayToken = async () => {
  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString('base64');
  
  const response = await axios.post(
    'https://api.ebay.com/identity/v1/oauth2/token',
    'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      }
    }
  );
  
  return response.data.access_token;
};
```

### Step 2: Update EbayProvider Class

```javascript
class EbayProvider extends SearchProvider {
  constructor() {
    super('ebay');
    this.clientId = process.env.EBAY_CLIENT_ID;
    this.clientSecret = process.env.EBAY_CLIENT_SECRET;
    this.token = null;
    this.tokenExpiry = null;
  }

  async getToken() {
    // Return cached token if still valid
    if (this.token && this.tokenExpiry > Date.now()) {
      return this.token;
    }

    // Get new token
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString('base64');
    
    const response = await axios.post(
      'https://api.ebay.com/identity/v1/oauth2/token',
      'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        }
      }
    );
    
    this.token = response.data.access_token;
    // Token expires in 7200 seconds, cache for 7000 to be safe
    this.tokenExpiry = Date.now() + 7000000;
    
    return this.token;
  }

  async search(query, opts = {}) {
    const { country = 'US', limit = 20 } = opts;

    try {
      console.log(`[eBay] Searching for: "${query}" using Browse API`);
      
      // Get OAuth token
      const token = await this.getToken();
      
      // Call Browse API
      const response = await axios.get(
        'https://api.ebay.com/buy/browse/v1/item_summary/search',
        {
          params: {
            q: query,
            limit: limit
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': `EBAY_${country}`,
            'X-EBAY-C-ENDUSERCTX': `affiliateCampaignId=<your_campaign_id>`
          },
          timeout: 10000
        }
      );

      console.log(`[eBay] Response status: ${response.status}`);
      
      const items = response.data.itemSummaries || [];
      console.log(`[eBay] Found ${items.length} items`);

      // Map Browse API response to our format
      return items.map(item => ({
        title: item.title,
        url: item.itemWebUrl,
        price: parseFloat(item.price?.value),
        currency: item.price?.currency || 'USD',
        merchant: 'eBay',
        image_url: item.image?.imageUrl,
        source: this.name,
        condition: item.condition,
        shipping: item.shippingOptions?.[0]?.shippingCost?.value || null
      }));
    } catch (error) {
      console.error(`[eBay] Browse API error:`, error.message);
      if (error.response) {
        console.error(`[eBay] Status: ${error.response.status}`);
        console.error(`[eBay] Data:`, JSON.stringify(error.response.data));
      }
      return [];
    }
  }
}
```

### Step 3: Update Environment Variables

You need **both** Client ID and Client Secret (not just App ID):

```bash
# In eBay Developer Portal, get:
# - Client ID (like: BertsonB-ProfitPu-PRD-06e427756-fd86c26b)
# - Client Secret (like: PRD-06e427756abc123...)

# Update Fly secrets:
fly secrets set EBAY_CLIENT_ID="BertsonB-ProfitPu-PRD-06e427756-fd86c26b" -a orben-search-worker
fly secrets set EBAY_CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE" -a orben-search-worker
```

### Step 4: Get Your Client Secret

1. Go to: https://developer.ebay.com/my/keys
2. Click on your app: "BertsonB-ProfitPu-PRD"
3. Under "OAuth Credentials for Production":
   - Client ID: (you already have this)
   - **Client Secret:** Click "Show" to reveal it

---

## Response Format Comparison

### Finding API (OLD):
```json
{
  "findItemsAdvancedResponse": [{
    "searchResult": [{
      "item": [{
        "title": ["Nintendo Switch"],
        "sellingStatus": [{
          "currentPrice": [{"__value__": "299.99"}]
        }]
      }]
    }]
  }]
}
```

### Browse API (NEW):
```json
{
  "total": 1000,
  "limit": 20,
  "itemSummaries": [
    {
      "title": "Nintendo Switch",
      "price": {
        "value": "299.99",
        "currency": "USD"
      },
      "itemWebUrl": "https://www.ebay.com/itm/...",
      "image": {
        "imageUrl": "https://..."
      }
    }
  ]
}
```

Much cleaner!

---

## Benefits of Browse API

✅ **More features:** Better filtering, sorting, aspect filtering  
✅ **Better data:** More fields, better image quality  
✅ **Modern:** RESTful API with JSON  
✅ **Supported:** Active development, not deprecated  
✅ **Consistent:** Same auth as other modern eBay APIs  

---

## Migration Checklist

- [ ] Get Client Secret from eBay Developer Portal
- [ ] Update `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` in Fly secrets
- [ ] Update `EbayProvider` class in `orben-search-worker/index.js`
- [ ] Test OAuth token generation
- [ ] Test Browse API search
- [ ] Deploy to Fly.io
- [ ] Verify results in production

---

## Estimated Time

**Implementation:** 30-45 minutes  
**Testing:** 15 minutes  
**Total:** ~1 hour

---

## Next Steps

1. **Get your Client Secret** from https://developer.ebay.com/my/keys
2. I'll update the code to use Browse API
3. We deploy and test
4. eBay search works! ✨

---

## Why This Happened

eBay announced the deprecation in 2024 but only decommissioned on Feb 4, 2025. Since your app was created with the old API ID, it was configured for the Finding API which no longer exists.

**The good news:** The new Browse API is better in every way!
