# SerpAPI Google Shopping - Ready to Test! 🎉

## What Was Fixed

### The Problem
- Backend was using `engine=google` with `tbm=shop` parameter
- This old API doesn't return `immersive_product_page_token` 
- Without the token, we couldn't fetch direct merchant links

### The Solution  
- Changed to `engine=google_shopping` (correct Google Shopping API)
- This API returns `immersive_product_page_token` for each product
- Token is used to fetch direct merchant links via Immersive Product API

## How It Works Now

### 1. Initial Search (Google Shopping API)
```
User searches "legos" 
  ↓
Backend calls: engine=google_shopping&q=legos
  ↓
Returns: 10-40 products with metadata + immersive_product_page_token
```

**Metadata Included:**
- ⭐ `rating` (e.g., 4.6)
- 💬 `reviews` (e.g., 18,000 reviews)
- 📝 `snippet` (e.g., "Great quality (124 reviews)")
- 🚚 `delivery` (e.g., "Free delivery on $35+")
- 🏷️ `tag` (e.g., "22% OFF")
- 💰 `old_price` + `price` (for savings calculation)
- 📍 `extensions` (e.g., ["Nearby, 12 mi", "In stock"])
- 🛍️ `multiple_sources` (indicates multiple sellers)
- 🎯 `position`, `badge` (ranking and special badges)

### 2. Pre-fetch Merchant Links (Immersive Product API)
```
Frontend receives products with tokens
  ↓
For each product with immersive_product_page_token:
  ↓
Backend calls: engine=google_immersive_product&page_token=<token>
  ↓
Returns: sellers_results with REAL direct links
```

**Example Merchant Offer:**
```json
{
  "name": "Walmart",
  "link": "https://www.walmart.com/ip/...",  // ← REAL direct link!
  "price": "$6.97",
  "extracted_price": 6.97,
  "original_price": "$8.97",
  "discount": "22% off",
  "rating": 4.3,
  "reviews": 4312,
  "shipping": "+ $6.99",
  "total": "$13.96"
}
```

### 3. Display on Frontend
```
Product Card shows:
  ✓ All metadata from initial search
  ✓ "Buy at Walmart" button (green) with direct link
  ✓ "+2 more stores" expandable section
  ✓ Price comparisons across merchants
```

## Expected User Experience

### Search Results Load
1. User types "nintendo switch"
2. Results appear with full metadata (ratings, reviews, delivery, etc.)
3. Each card shows "Finding stores..." (spinner)

### Merchant Links Load (1-3 seconds later)
4. Buttons update to "Buy at Walmart" / "Buy at Target" (green)
5. Clicking button goes DIRECTLY to walmart.com/target.com product page
6. "+2 more stores" section appears for products with multiple sellers

### Fallback (if token missing or fetch fails)
7. Button shows "View Item" (purple) linking to Google Shopping page

## Testing Checklist

### ✅ Backend is Deployed
- `orben-search-worker` deployed with `engine=google_shopping`
- Debug logging enabled to show `immersive_product_page_token`

### 🧪 Test Now
1. Go to: https://profitorbit.io/product-search
2. Search for: `"lego star wars"` or `"airpods pro"` (not cached)
3. Open Console (F12) and look for:
   - `[SerpAPI] First product fields: {hasImmersiveToken: true}`
   - `[Prefetch] Fetching offers for X items with tokens`
   - `[Prefetch] Successfully fetched X offers`

### ✅ Success Indicators
- ⭐ Ratings and reviews display on cards
- 🚚 Delivery info shows
- 🏷️ Discount tags appear (if applicable)
- 💰 Old prices with savings calculation
- 🛒 "Buy at [Merchant]" green buttons with direct links
- 📦 "+X more stores" expandable sections

### ❌ Failure Indicators (and fixes)
- "No items with immersive tokens" → Check SerpAPI response format
- "Finding stores..." never resolves → Check `/v1/product/offers` endpoint
- 401 errors → Check auth token
- Generic "View Item" buttons only → Immersive API not returning offers

## API Endpoints

### Search
```
POST https://orben-api.fly.dev/v1/search
{
  "q": "legos",
  "providers": ["auto"],
  "country": "US",
  "page": 1,
  "limit": 10
}
```

### Product Offers (new)
```
POST https://orben-api.fly.dev/v1/product/offers
{
  "immersive_product_page_token": "eyJlaSI6..."
}
```

## Logs to Monitor

### Success Pattern
```
[SmartRouting] Auto mode - Using SerpAPI Google Shopping
[SerpAPI] Searching for: "legos"
[SerpAPI] Request completed {"hasShoppingResults":true,"shoppingCount":40}
[SerpAPI] First product fields: {"hasImmersiveToken":true}
[SerpAPI] Transformed 40 items
[Prefetch] Fetching offers for 10 items with tokens
[SerpAPI] Fetching product offers for token: eyJlaSI6...
[SerpAPI] Product offers response {"hasOffers":true,"offerCount":5}
```

### Failure Pattern (old - should NOT see this)
```
[SmartRouting] Auto mode - Using RapidAPI Google Shopping  ← Wrong!
[Prefetch] No items with immersive tokens                   ← Missing tokens!
```

## Next Steps if Working

1. ✅ Test pagination ("Load More" button)
2. ✅ Test cached results (search same query twice)
3. ✅ Deploy frontend with npm run build
4. ✅ Monitor SerpAPI quota usage
5. ✅ Add error handling for quota exceeded
6. ✅ Consider caching merchant offers in Redis (30min TTL)

## Cost Considerations

### SerpAPI Pricing
- Google Shopping search: 0.5 credits per search
- Immersive Product API: 1 credit per product detail fetch
- Example: Search with 10 products = 0.5 + (10 × 1) = 10.5 credits
- Free tier: 100 searches/month

### Optimization Ideas
1. Cache immersive product results (30min)
2. Only fetch offers for first 5 products (not all 10)
3. Lazy load offers on card hover/click
4. Show "View all stores" button to fetch on-demand

---

## Deploy Frontend

Once confirmed working:
```bash
npm run build
# Deploys to profitorbit.io
```
