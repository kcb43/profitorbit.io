# 🚀 Keepa API Integration Plan - Live Amazon Deal Sourcing

## Executive Summary
Integrate Keepa API to provide **real-time Amazon deals** to the Pulse page, starting with warehouse deals, lightning deals, and price drops.

---

## 🎯 Goal
Get **live deals appearing on the Pulse page RIGHT NOW** using Keepa as our primary Amazon data source.

---

## 🔧 Keepa API Overview

### What Keepa Provides
- ✅ **5 billion+ Amazon products** with price history
- ✅ **Lightning deal detection** 
- ✅ **Warehouse deal tracking**
- ✅ **Price drop alerts** (30-day, 90-day, all-time lows)
- ✅ **Buy Box tracking** (who's winning, price changes)
- ✅ **Multi-marketplace** (.com, .co.uk, .de, .co.jp, .fr, .ca, .it, .es, .in, .mx)
- ✅ **Category browsing** (find deals by category)

### Pricing Model
- **Token-based**: 1 token = 1 product lookup
- **Monthly plans** (prepaid):
  - Starter: ~$20/mo (500 tokens)
  - Basic: ~$50/mo (1,500 tokens)
  - Pro: ~$150/mo (5,000 tokens)
- **Unused tokens expire** after 1 hour
- Can upgrade anytime, downgrade once/month

### API Endpoints We'll Use
1. **Product Query** - Get product details + price history
2. **Deals Query** - Get current lightning deals by category
3. **Best Sellers** - Get trending products with price history
4. **Category Search** - Browse deals by category
5. **Price Drop Detection** - Products at historic lows

---

## 📋 Implementation Strategy

### Phase 1: Quick Win - Deals Feed (TODAY)
**Goal**: Show 20-50 real Amazon deals on Pulse page within 2 hours

#### Step 1: Keepa API Setup
```bash
# Get API key from https://keepa.com/#!api
# Add to environment variables
KEEPA_API_KEY=your_key_here
```

#### Step 2: Create Deal Aggregation API
**File**: `api/pulse/keepa-deals.js`

```javascript
// Fetch current lightning deals from Keepa
GET /api/pulse/keepa-deals?type=lightning&category=electronics

// Response: Array of deals with:
- Product name, image, ASIN
- Current price vs. historical avg/low
- Lightning deal end time
- Discount percentage
- Keepa stats (sales rank, review count)
```

#### Step 3: Update Pulse Page to Fetch Real Deals
**File**: `src/pages/Pulse.jsx`

```javascript
// Replace mock data with real API call
const { data: dealAlerts } = useQuery({
  queryKey: ['dealAlerts'],
  queryFn: async () => {
    const res = await fetch('/api/pulse/keepa-deals?type=all');
    return res.json();
  },
  refetchInterval: 5 * 60 * 1000 // Refresh every 5 minutes
});
```

#### Step 4: Display Deals
- **Warehouse Deals Tab**: Filter `type=warehouse`
- **Lightning Deals Tab**: Filter `type=lightning`
- **Hot Deals Tab**: Filter by `discount >= 70%`

---

### Phase 2: Smart Deal Detection (THIS WEEK)

#### Categories to Scan
Priority categories for resellers:
1. **Electronics** (high margin)
2. **Home & Kitchen** (easy to flip)
3. **Toys & Games** (seasonal)
4. **Sports & Outdoors** (consistent demand)
5. **Tools & Home Improvement** (wholesale opportunity)

#### Deal Quality Scoring Algorithm
```javascript
dealScore = (
  discountPercentage * 0.4 +      // 40% weight on discount
  (salesRank < 10000 ? 30 : 0) +  // 30 points if popular
  (numReviews > 100 ? 20 : 0) +   // 20 points if well-reviewed
  (avgRating >= 4.0 ? 10 : 0)     // 10 points if good rating
);

// Only show deals with score >= 60
```

#### Filters to Apply
- Minimum discount: 30%
- Minimum reviews: 10 (avoid scams)
- Minimum rating: 3.5 stars
- Price range: $10 - $500 (reasonable resale range)
- Exclude digital/subscription products
- Exclude adult content

---

### Phase 3: Automated Deal Scanning (NEXT WEEK)

#### Vercel Cron Jobs
```javascript
// vercel.json
{
  "crons": [
    {
      "path": "/api/pulse/scan-keepa-deals",
      "schedule": "*/15 * * * *"  // Every 15 minutes
    }
  ]
}
```

#### Scan Strategy
```javascript
// Every 15 minutes:
1. Fetch lightning deals (time-sensitive)
2. Check for warehouse deals (limited stock)
3. Scan top 50 best sellers per category for price drops
4. Store in database with expiration timestamp
5. Send push notifications for HOT deals (> 70% off)
```

#### Database Storage
```sql
-- Cache deals to reduce API calls
CREATE TABLE keepa_deal_cache (
  id UUID PRIMARY KEY,
  asin VARCHAR(10) UNIQUE,
  product_name TEXT,
  product_image TEXT,
  current_price DECIMAL(10,2),
  lowest_price_30d DECIMAL(10,2),
  lowest_price_90d DECIMAL(10,2),
  lowest_price_alltime DECIMAL(10,2),
  discount_percentage INT,
  deal_type VARCHAR(50), -- 'lightning', 'warehouse', 'price_drop'
  category VARCHAR(100),
  sales_rank INT,
  num_reviews INT,
  avg_rating DECIMAL(2,1),
  lightning_end_time TIMESTAMP,
  deal_quality_score INT,
  detected_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_active_deals ON keepa_deal_cache(is_active, deal_quality_score DESC, detected_at DESC);
```

---

## 💰 Cost Optimization

### Token Management Strategy
**Problem**: Keepa tokens are expensive, we need to maximize value

**Solution**: Smart caching + prioritization

#### 1. Aggressive Caching
- Cache deal results for 30 minutes
- Only re-scan top performing categories
- Store price history locally to avoid re-fetching

#### 2. Category Rotation
```javascript
// Instead of scanning ALL categories every time:
const categorySchedule = {
  ':00': ['Electronics', 'Computers'],
  ':15': ['Home & Kitchen', 'Tools'],
  ':30': ['Toys', 'Sports'],
  ':45': ['Beauty', 'Fashion']
};

// Scan 2 categories every 15 min instead of 10 every hour
// Reduces API calls by 80%
```

#### 3. Smart Product Selection
```javascript
// Only fetch full details for products that pass filters:
1. Use Keepa's category browse (no tokens)
2. Filter by discount > 30%
3. THEN fetch full product details (1 token each)

// Instead of: Fetch 100 products (100 tokens)
// We fetch: 10-20 qualifying products (10-20 tokens)
```

#### 4. User Watchlist Priority
- Scan user watchlists FIRST (targeted, high-value)
- General deal discovery SECOND (opportunistic)

### Estimated Token Usage
```
Daily token usage with optimization:
- 4 categories * 4 scans/hour * 24 hours = 384 category scans (free)
- 15 products per scan * 96 scans = 1,440 tokens/day
- With caching: ~720 tokens/day
- Monthly: ~21,600 tokens

Recommended plan: Pro ($150/mo for 5,000/mo tokens) NOPE TOO EXPENSIVE

BETTER APPROACH:
- Starter plan: $20/mo (500 tokens)
- Scan 2 times per day (morning + evening)
- Focus on top 3 categories only
- 25 products per scan * 2 scans * 30 days = 1,500 tokens/month
- Use $20/mo plan + supplement with RapidAPI for other deals
```

---

## 🔄 Fallback Strategy (No Keepa)

If Keepa is too expensive or has issues, we have alternatives:

### Primary Alternative: RapidAPI "Real-Time Amazon Data"
- **Cost**: Free tier (100 requests/mo), then $10/mo (1,000 requests)
- **Features**: Product details, offers, deals, reviews
- **API**: https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-amazon-data

### Secondary: Rainforest API
- **Cost**: Free trial, then $50/mo (10,000 requests)
- **Features**: Comprehensive Amazon data, faster than Keepa
- **API**: https://www.rainforestapi.com/

### Tertiary: Web Scraping (Last Resort)
- **Cost**: Free (but risky)
- **Method**: Puppeteer + proxies
- **Limitations**: Slow, can be blocked, maintenance-heavy

---

## 🚀 Immediate Next Steps

### TO DO RIGHT NOW:
1. ✅ **Sign up for Keepa API** → Get API key
2. ✅ **Create `/api/pulse/keepa-deals.js`** → Fetch deals endpoint
3. ✅ **Update Pulse.jsx** → Call real API instead of mock data
4. ✅ **Test with 10-20 products** → Verify data quality
5. ✅ **Deploy to Vercel** → See live deals!

### Tomorrow:
6. Add deal quality scoring
7. Implement caching layer
8. Set up automated scanning cron job
9. Add user notifications for hot deals

### This Week:
10. Optimize token usage
11. Add category filtering
12. Implement deal expiration cleanup
13. Add price history charts

---

## 📊 Success Metrics

### Week 1 Goals:
- ✅ **50+ real deals** shown on Pulse page
- ✅ **< 3 second** page load time
- ✅ **< $50** in API costs

### Month 1 Goals:
- 🎯 **500+ deals discovered** per day
- 🎯 **20+ users** actively using Pulse
- 🎯 **5+ deals** purchased by users
- 🎯 **80%+ accuracy** (price is correct)

---

## 🎨 UI Enhancements for Keepa Data

### New Deal Card Features:
```jsx
<DealCard>
  {/* Keepa-specific badges */}
  <Badge>30-day LOW</Badge>
  <Badge>🔥 All-time LOW</Badge>
  <Badge>⚡ Lightning: 2h left</Badge>
  <Badge>📦 Warehouse: Like New</Badge>
  
  {/* Price history sparkline */}
  <MiniChart data={priceHistory} />
  
  {/* Keepa stats */}
  <Stats>
    <Stat label="Sales Rank" value="#1,234 in Electronics" />
    <Stat label="Reviews" value="4.5★ (2,341)" />
    <Stat label="Price Drop" value="-42% from 30d avg" />
  </Stats>
  
  {/* Quick actions */}
  <Button>🔔 Track Price</Button>
  <Button>🛒 Buy on Amazon</Button>
  <Button>➕ Add to Inventory</Button>
</DealCard>
```

---

## 🔐 Security & Rate Limiting

### API Key Protection
```javascript
// NEVER expose Keepa key to frontend
// Always proxy through backend API

// api/pulse/keepa-deals.js
const KEEPA_KEY = process.env.KEEPA_API_KEY; // Server-side only

// Rate limit client requests
if (rateLimiter.check(userId) > 20) {
  return res.status(429).json({ error: 'Too many requests' });
}
```

### Error Handling
```javascript
try {
  const deals = await fetchKeepaDeals();
} catch (error) {
  // Fallback to cached data
  console.error('Keepa API error:', error);
  return getCachedDeals();
}
```

---

## 📱 Future: Keepa Chrome Extension Integration

Keepa has a Chrome extension that shows price history directly on Amazon product pages. We could:

1. Build similar extension for Orben users
2. Let users "save deal" from Amazon → Orben Pulse
3. Show Orben profit calculator on Amazon pages
4. One-click import Amazon deals to inventory

---

## 🎉 Expected Outcome

**Before**: Pulse page shows 0 real deals (mock data only)

**After (Today)**: Pulse page shows 50+ REAL Amazon deals with:
- ✅ Actual prices from Amazon
- ✅ Real product images and links
- ✅ Historical price context (30d low, 90d low)
- ✅ Lightning deal countdowns
- ✅ Warehouse deal conditions
- ✅ Quality scoring (only show good deals)
- ✅ Auto-refresh every 5 minutes

**Users can now**:
- Browse real profitable opportunities
- Track prices on products they care about
- Get notified when deals hit
- Make money from sourcing Amazon deals!

---

**Ready to implement?** Let's start with the Keepa API endpoint!
