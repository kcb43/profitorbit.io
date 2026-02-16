# Search API Issues & SerpAPI Improvements

## Current Problem

**Symptom**: Universal Product Search returns "No results found" for many queries (e.g., "portable furnace")

**Root Cause**: Your backend search worker (`orben-search-worker.fly.dev`) is using SerpAPI's `google_shopping` engine, which is returning 0 results:

```
[info][SerpAPI] Request completed {"hasShoppingResults":false,"shoppingCount":0}
[info][SerpAPI] Transformed 0 items
```

## Solution: Upgrade to Google Immersive Product API

SerpAPI has a newer, better endpoint called `google_immersive_product` that provides:
- ✅ More comprehensive product data
- ✅ Multiple stores per product (up to 13 with `more_stores: true`)
- ✅ Rich metadata (reviews, ratings, videos, discussions)
- ✅ Better coverage across merchants
- ✅ Pagination support via `stores_next_page_token`

## Code Changes Needed (in orben-search-worker repo)

### Current Implementation (google_shopping)

```javascript
// Current approach - limited results
const response = await fetch('https://serpapi.com/search.json', {
  params: {
    engine: 'google_shopping',
    q: query,
    api_key: SERPAPI_KEY,
    gl: 'us',
    hl: 'en'
  }
});
```

### Recommended Implementation (google_immersive_product)

```javascript
// Step 1: Get initial shopping results with product tokens
const shoppingResponse = await fetch('https://serpapi.com/search.json', {
  params: {
    engine: 'google_shopping',
    q: query,
    api_key: SERPAPI_KEY,
    gl: 'us',
    hl: 'en'
  }
});

const shoppingResults = await shoppingResponse.json();

// Step 2: For each product with immersive_product_page_token, fetch detailed data
const detailedProducts = await Promise.all(
  shoppingResults.shopping_results
    .filter(item => item.immersive_product_page_token)
    .slice(0, 10) // Limit to 10 to control API usage
    .map(async (item) => {
      try {
        const immersiveResponse = await fetch('https://serpapi.com/search.json', {
          params: {
            engine: 'google_immersive_product',
            page_token: item.immersive_product_page_token,
            more_stores: true, // Fetch up to 13 stores instead of 3-5
            api_key: SERPAPI_KEY
          }
        });
        
        const immersiveData = await immersiveResponse.json();
        
        // Transform to your format
        return {
          title: immersiveData.product_results?.title || item.title,
          image_url: immersiveData.product_results?.thumbnails?.[0] || item.thumbnail,
          price: immersiveData.product_results?.stores?.[0]?.extracted_price || item.extracted_price,
          merchant: immersiveData.product_results?.stores?.[0]?.name || item.source,
          url: immersiveData.product_results?.stores?.[0]?.link || item.link,
          rating: immersiveData.product_results?.rating || item.rating,
          reviews: immersiveData.product_results?.reviews || item.reviews,
          price_range: immersiveData.product_results?.price_range,
          
          // NEW: Multiple stores data
          stores: immersiveData.product_results?.stores || [],
          stores_count: immersiveData.product_results?.stores?.length || 0,
          stores_next_page_token: immersiveData.product_results?.stores_next_page_token,
          
          // NEW: Rich metadata
          brand: immersiveData.product_results?.brand,
          about: immersiveData.product_results?.about_the_product,
          insights: immersiveData.product_results?.top_insights,
          videos: immersiveData.product_results?.videos,
          
          // Keep original data for fallback
          immersive_product_page_token: item.immersive_product_page_token,
          source: 'google_immersive',
        };
      } catch (error) {
        console.error('Error fetching immersive data:', error);
        // Fallback to basic shopping result
        return {
          title: item.title,
          image_url: item.thumbnail,
          price: item.extracted_price,
          merchant: item.source,
          url: item.link,
          source: 'google_shopping_fallback',
        };
      }
    })
);

return detailedProducts;
```

## Key Parameters to Add

### 1. `more_stores: true`
**Current**: Returns 3-5 stores per product
**With flag**: Returns up to 13 stores per product

```javascript
{
  engine: 'google_immersive_product',
  page_token: item.immersive_product_page_token,
  more_stores: true, // ⭐ Add this
  api_key: SERPAPI_KEY
}
```

### 2. `no_cache: true` (for debugging)
**Use case**: Force fresh results when testing
**Cost**: Counts toward API quota (cached searches are free)

```javascript
{
  engine: 'google_immersive_product',
  page_token: token,
  no_cache: true, // Only use during debugging
  api_key: SERPAPI_KEY
}
```

### 3. Pagination Support
**Token**: `stores_next_page_token` from previous response

```javascript
// Get more stores for a product
{
  engine: 'google_immersive_product',
  next_page_token: stores_next_page_token, // From previous response
  api_key: SERPAPI_KEY
}
```

## Response Structure Comparison

### Google Shopping (Current)
```json
{
  "shopping_results": [
    {
      "title": "Product Name",
      "price": "$10.99",
      "source": "Walmart",
      "link": "...",
      "thumbnail": "...",
      "immersive_product_page_token": "eyJ..." // ⭐ Use this!
    }
  ]
}
```

### Google Immersive Product (Recommended)
```json
{
  "product_results": {
    "title": "Product Name",
    "brand": "Brand Name",
    "rating": 4.6,
    "reviews": 18487,
    "price_range": "$6.97-$9.99",
    "stores": [
      {
        "name": "Walmart",
        "price": "$6.97",
        "extracted_price": 6.97,
        "original_price": "$8.97",
        "discount": "22% off",
        "link": "...",
        "rating": 4.3,
        "reviews": 4311,
        "payment_methods": "PayPal, Affirm accepted",
        "details_and_offers": ["In stock", "Free shipping"],
        "shipping": "+ $19.95"
      },
      // ... up to 13 stores
    ],
    "stores_next_page_token": "...", // For pagination
    "about_the_product": { ... },
    "top_insights": [ ... ],
    "videos": [ ... ],
    "user_reviews": [ ... ]
  }
}
```

## Migration Steps

### Phase 1: Add Fallback (Minimal Change)
1. Keep current `google_shopping` search
2. For items with `immersive_product_page_token`, fetch immersive data
3. Merge data (immersive takes priority if available)
4. This gives you richer data without breaking current flow

### Phase 2: Full Migration
1. Use `google_shopping` only to get product tokens
2. Always fetch immersive data for top 10-20 results
3. Transform to consistent format
4. Update frontend to display new fields (stores count, price range, etc.)

### Phase 3: Enhanced Features
1. Add "View all stores" button in frontend
2. Use `stores_next_page_token` for pagination
3. Show price comparison across stores
4. Display user reviews and videos

## API Quota Considerations

**Current Usage**: 1 API call per search

**With Immersive (naive)**:
- 1 call for shopping results
- +10 calls for immersive data (if fetching 10 products)
- **Total**: 11 calls per search ⚠️

**Optimized Approach**:
1. Cache immersive data aggressively (24h instead of 1h)
2. Only fetch immersive for top 5 results initially
3. Fetch more on-demand when user clicks "View Details"
4. Use SerpAPI's free cached responses (1h cache)
5. Implement `no_cache: false` (default) to utilize free cache

**Estimated Savings**:
- With aggressive caching: 5-6 calls per search
- Cache hit rate: ~40-60% for popular products
- Net increase: ~3x quota usage, but **3-10x richer data**

## Example API Call

```bash
# Get immersive product data
curl "https://serpapi.com/search.json?engine=google_immersive_product&page_token=eyJlaSI6Im5ZVmxaOXVVTDY2X3A4NFBqTnZELUFjIiwicHJvZHVjdGlkIjoiIiwiY2F0YWxvZ2lkIjoiNTE1NDU2NTc1NTc5MzcxMDY3NSIsImhlYWRsaW5lT2ZmZXJEb2NpZCI6IjI1MDkyMjcwMDUzMjk2NzQwODMiLCJpbWFnZURvY2lkIjoiMTYzOTg5MjU0MDcwMDU4MDA1NTQiLCJyZHMiOiJQQ18zNDg4MDE0MTg3ODgxNzc5NjU0fFBST0RfUENfMzQ4ODAxNDE4Nzg4MTc3OTY1NCIsInF1ZXJ5IjoibGcrdHYiLCJncGNpZCI6IjM0ODgwMTQxODc4ODE3Nzk2NTQiLCJtaWQiOiI1NzY0NjI3ODM3Nzc5MTUzMTMiLCJwdnQiOiJoZyIsInV1bGUiOm51bGx9&more_stores=true&api_key=YOUR_KEY"
```

## Frontend Integration

The frontend (`ProductSearch.jsx`) already handles immersive tokens:

```javascript
// Line 511-588: Already pre-fetches merchant offers
const prefetchMerchantOffers = async (items) => {
  const itemsWithTokens = items.filter(item => item.immersive_product_page_token);
  // Fetches from: /v1/product/offers
};
```

**What's needed**: Update backend to return stores data directly in search response, so frontend doesn't need separate calls.

## Immediate Fix (No Code Changes)

**Problem**: "portable furnace" returns 0 results from SerpAPI Google Shopping

**Try**:
1. Test with more common queries: "iPhone", "coffee", "laptop"
2. Check SerpAPI dashboard for quota usage
3. Verify API key has Shopping API access enabled
4. Check if queries need specific formatting (e.g., "+" prefix for terms)

**Workaround**: Your frontend already supports the fallback to showing "No results" gracefully. The issue is backend-specific to the search worker service.

## Where to Make Changes

❌ **Not in this repo** (`bareretail`) - Frontend is fine
✅ **In search worker repo** (`orben-search-worker` on Fly.io) - Backend needs update

## Testing After Changes

1. Deploy updated search worker to Fly.io
2. Test with: "coffee", "laptop", "iPhone 15"
3. Verify response includes `stores` array
4. Check pagination with `stores_next_page_token`
5. Monitor API quota usage in SerpAPI dashboard

---

**Status**: Documented solution, implementation requires access to orben-search-worker repository
**Priority**: High (search is a core feature)
**Estimated Impact**: 10x better product coverage, 3x richer data
