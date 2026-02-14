# Orben Provider Mapping & Configuration

## Universal Search Providers

### Confirmed Providers (V1)

1. **eBay Finding API** (Primary)
2. **RapidAPI Google Shopping** (Secondary)

---

## Provider Details

### 1. eBay Finding API

**Cost:** Free  
**Limits:** 5,000 calls/day per application  
**API Docs:** https://developer.ebay.com/devzone/finding/Concepts/FindingAPIGuide.html  

**Implementation:** `orben-search-worker/index.js` → `EbayProvider`

**Required Keys:**
- `EBAY_APP_ID` (from eBay Developer Console)
- `EBAY_CERT_ID` (optional for production)
- `EBAY_DEV_ID` (optional for production)

**API Endpoint:**
```
https://svcs.ebay.com/services/search/FindingService/v1
```

**Response Fields Mapped:**
```javascript
{
  title: item.title[0],
  url: item.viewItemURL[0],
  price: parseFloat(item.sellingStatus[0].currentPrice[0].__value__),
  currency: item.sellingStatus[0].currentPrice[0]['@currencyId'],
  merchant: 'eBay',
  image_url: item.galleryURL[0],
  condition: item.condition[0].conditionDisplayName[0],
  shipping: parseFloat(item.shippingInfo[0].shippingServiceCost[0].__value__)
}
```

**Cache TTL:** 6 hours  
**Redis Key Pattern:** `search:ebay:{country}:{md5(query)}`

---

### 2. RapidAPI Google Shopping

**Cost:** Free tier: 100 requests/month, Paid: $10/mo for 1,000 requests  
**Limits:** 100 req/mo free, then 1,000/mo on Basic plan  
**API Docs:** https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-product-search  

**Implementation:** `orben-search-worker/index.js` → `RapidApiGoogleProvider`

**Required Keys:**
- `RAPIDAPI_KEY` (from RapidAPI dashboard)

**API Endpoint:**
```
https://real-time-product-search.p.rapidapi.com/search
```

**Request Headers:**
```javascript
{
  'X-RapidAPI-Key': RAPIDAPI_KEY,
  'X-RapidAPI-Host': 'real-time-product-search.p.rapidapi.com'
}
```

**Response Fields Mapped:**
```javascript
{
  title: item.product_title,
  url: item.product_link,
  price: parseFloat(item.offer?.price),
  currency: 'USD',
  merchant: item.source || 'Google',
  image_url: item.product_photos[0],
  rating: item.product_rating
}
```

**Cache TTL:** 24 hours (longer because of low quota)  
**Redis Key Pattern:** `search:google:{country}:{md5(query)}`

---

## Provider Priority & Fallback Strategy

### Default Behavior (Frontend)

When user searches, call **both providers in parallel** for maximum results:

```javascript
// Frontend example
const response = await fetch('/v1/search?q=iPhone+15&providers=ebay,google');
```

### Rate Limiting Strategy

| Provider | Free Daily Limit | Cost per 1000 | Action on Limit |
|----------|-----------------|---------------|-----------------|
| eBay | 5,000 | Free | Disable for 1 hour, show message |
| Google (RapidAPI) | 100/month | $10 | Fall back to eBay only |

### Cache Strategy

```javascript
// Waterfall approach
1. Check Redis cache (instant)
2. If miss, call eBay (cheap, high quota)
3. If eBay fails/slow, call Google (backup)
4. Cache result for 6-24h
```

---

## Provider Interface (TypeScript)

```typescript
export interface SearchResultItem {
  title: string;
  url: string;
  price?: number;
  currency?: string;
  merchant?: string;
  image_url?: string;
  source: string; // 'ebay' | 'google' | 'oxylabs'
  condition?: string;
  shipping?: number;
  rating?: number;
}

export interface Provider {
  name: string;
  search(
    query: string, 
    opts: { country: string; limit: number }
  ): Promise<SearchResultItem[]>;
}
```

---

## Provider Configuration (Environment)

### orben-search-worker secrets

```bash
# Required
EBAY_APP_ID=YourAppId123
EBAY_CERT_ID=YourCertId456 (optional)
EBAY_DEV_ID=YourDevId789 (optional)

# Required for Google provider
RAPIDAPI_KEY=your_rapidapi_key_here

# Optional (not using Oxylabs in V1)
# OXYLABS_USERNAME=user
# OXYLABS_PASSWORD=pass
```

### Default Frontend Call

```javascript
// src/pages/ProductSearch.jsx
const providers = ['ebay', 'google']; // Default both enabled
```

---

## Testing Each Provider

### Test eBay Provider

```bash
# Via search worker directly
curl -X POST https://orben-search-worker.fly.dev/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "iPhone 15 Pro",
    "providers": ["ebay"],
    "country": "US",
    "userId": "test-user-id"
  }'
```

**Expected:** 10-20 eBay listings with prices

### Test Google Provider

```bash
curl -X POST https://orben-search-worker.fly.dev/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "LEGO Star Wars",
    "providers": ["google"],
    "country": "US",
    "userId": "test-user-id"
  }'
```

**Expected:** Google Shopping results from multiple merchants

### Test Both (Parallel)

```bash
curl -X POST https://orben-search-worker.fly.dev/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "PlayStation 5",
    "providers": ["ebay", "google"],
    "country": "US",
    "userId": "test-user-id"
  }'
```

**Expected:** Combined results from both providers

---

## Future Providers (V2)

### Potential Additions

| Provider | Type | Cost | Value |
|----------|------|------|-------|
| **Walmart Open API** | Official | Free (approval) | High - retailer inventory |
| **Best Buy API** | Official | Free (approval) | High - open-box deals |
| **Amazon Product Advertising** | Official | Free (affiliate) | High - but complex |
| **Oxylabs** | Premium scraper | $49+/mo | Medium - backup only |
| **ScraperAPI Google Shopping** | Alternative | $29/mo | Medium - alternative to RapidAPI |

### Implementation Pattern

Each new provider just needs:

```javascript
// orben-search-worker/index.js
class WalmartProvider extends SearchProvider {
  constructor() {
    super('walmart');
    this.apiKey = process.env.WALMART_API_KEY;
  }

  async search(query, opts) {
    // Call Walmart API
    // Map to SearchResultItem[]
    return results;
  }
}

// Register it
providers.walmart = new WalmartProvider();
```

Then users can call: `?providers=ebay,google,walmart`

---

## Cost Estimates (Monthly)

### Current Setup (eBay + Google)

| Provider | Usage | Cost |
|----------|-------|------|
| eBay API | 5,000/day free | $0 |
| RapidAPI Google | 100/mo free | $0 |
| RapidAPI Google | 1,000/mo paid | $10 |

**Total:** $0-10/month depending on search volume

### With Caching

- First search: Calls API
- Repeat searches (6-24h window): Instant cache hit
- **Expected cache hit rate:** 60-80%
- **Effective cost reduction:** 5x cheaper

**Example:** 1,000 searches/day = 200 API calls = well within free limits

---

## Provider Response Time Benchmarks

| Provider | Cold Call | Cached | Notes |
|----------|-----------|--------|-------|
| eBay | 500-1500ms | <10ms | Fast, reliable |
| Google/RapidAPI | 1000-3000ms | <10ms | Slower, cache heavily |
| Redis lookup | <5ms | <5ms | Always instant |

**Frontend timeout:** 20 seconds (handles slow providers gracefully)

---

## Quota Management

### Redis Counters

```javascript
// Daily user quota
quota:user:{userId}:20260213 = 45  // TTL: 24h

// Daily provider quota
quota:provider:ebay:20260213 = 523  // TTL: 24h
```

### Limits (Configurable)

```javascript
const USER_DAILY_LIMIT = 100;      // Per user
const PROVIDER_DAILY_LIMIT = 1000; // Per provider
```

### When Quota Exceeded

```json
{
  "providers": [
    {
      "provider": "google",
      "error": "User quota exceeded: 101/100"
    }
  ],
  "items": []
}
```

Frontend shows: "Daily search limit reached. Please try again tomorrow."

---

## Summary

✅ **eBay** - Primary, free 5k/day, fast, reliable  
✅ **Google/RapidAPI** - Secondary, free 100/mo, good coverage  
✅ **Cache-first** - 60-80% hit rate = massive savings  
✅ **Parallel calls** - Both providers simultaneously  
✅ **Quota tracking** - Prevents overages  
✅ **Extensible** - Easy to add more providers  

**Cost:** $0-10/month for 1000+ searches/day with caching
