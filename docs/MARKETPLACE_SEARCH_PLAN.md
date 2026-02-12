# 🔍 Universal Product Search & Price Intelligence System

## Executive Summary
Transform Orben into a comprehensive price intelligence platform that searches across all major marketplaces, tracks prices, identifies deals, and alerts users to profit opportunities.

---

## 🎯 Project Goals

### Primary Objectives
1. **Universal Product Search** - Search any product across 100+ marketplaces
2. **Price Intelligence** - Real-time pricing, history, and discount tracking
3. **Deal Discovery** - Automated alerts for profitable opportunities
4. **Multi-Access Points** - Dashboard, Inventory, and Crosslist integration
5. **Enhanced Pulse Page** - Real-time deal monitoring and alerts

### User Stories
- "As a reseller, I want to search 'Nike Air Max' and instantly see prices across Amazon, eBay, Walmart, Best Buy, etc."
- "As a user, I want to see price history charts to identify the best time to buy"
- "As a reseller, I want automated alerts when items drop below my target buy price"
- "As a user, I want to compare marketplace fees to find the most profitable platform"

---

## 🏗️ Technical Architecture

### Phase 1: Backend Infrastructure (Week 1-2)

#### 1.1 Product Search API Layer
**Location**: `f:\bareretail\api\product-search\`

**Services to Integrate**:
- **Primary**: Product Search API (productapi.dev) - 20 free credits, AI-powered
- **Secondary**: PricesAPI (pricesapi.io) - 1,000 free calls/month
- **Fallback**: SearchAPI for Google Shopping - 100 free requests
- **Future**: Apify E-commerce Scraper (paid, $49/mo for scale)

**API Structure**:
```javascript
// api/product-search/search.js
POST /api/product-search/search
{
  "query": "Nike Air Max 90",
  "marketplaces": ["amazon", "ebay", "walmart", "all"],
  "filters": {
    "minPrice": 50,
    "maxPrice": 200,
    "condition": "new|used|all",
    "sortBy": "price|discount|marketplace"
  },
  "userId": "user_id"
}

// Response
{
  "results": [
    {
      "id": "prod_123",
      "title": "Nike Air Max 90",
      "marketplace": "amazon",
      "price": 129.99,
      "originalPrice": 159.99,
      "discount": 19,
      "currency": "USD",
      "condition": "new",
      "seller": "Amazon.com",
      "url": "https://amazon.com/...",
      "image": "https://...",
      "availability": "in_stock",
      "rating": 4.5,
      "reviewCount": 1234,
      "lastUpdated": "2026-02-12T10:00:00Z"
    }
  ],
  "totalResults": 47,
  "marketplacesSearched": ["amazon", "ebay", "walmart", "bestbuy"]
}
```

#### 1.2 Price History & Tracking
**Location**: `f:\bareretail\api\product-search\history.js`

```javascript
// Track price changes over time
POST /api/product-search/track
{
  "productUrl": "https://amazon.com/dp/B08...",
  "userId": "user_id",
  "targetPrice": 99.99,
  "alertEnabled": true
}

// Get price history
GET /api/product-search/history/:productId
{
  "history": [
    {"date": "2026-01-01", "price": 149.99, "marketplace": "amazon"},
    {"date": "2026-01-15", "price": 139.99, "marketplace": "amazon"},
    {"date": "2026-02-01", "price": 129.99, "marketplace": "amazon"}
  ],
  "lowestPrice": 119.99,
  "averagePrice": 137.50,
  "priceDropPercentage": -13.3
}
```

#### 1.3 Database Schema
**Migration**: `20260212_add_product_search_system.sql`

```sql
-- Product search cache (reduce API calls)
CREATE TABLE product_search_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_query TEXT NOT NULL,
  search_filters JSONB DEFAULT '{}',
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 hour'
);

-- Price tracking watchlist
CREATE TABLE price_watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_url TEXT NOT NULL,
  product_title TEXT,
  product_image TEXT,
  marketplace VARCHAR(50),
  current_price DECIMAL(10,2),
  target_price DECIMAL(10,2),
  alert_enabled BOOLEAN DEFAULT TRUE,
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_url)
);

-- Price history for tracked items
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID REFERENCES price_watchlist(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  marketplace VARCHAR(50),
  availability VARCHAR(50),
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deal alerts (for Pulse page)
CREATE TABLE deal_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_title TEXT NOT NULL,
  product_url TEXT NOT NULL,
  product_image TEXT,
  marketplace VARCHAR(50),
  current_price DECIMAL(10,2),
  original_price DECIMAL(10,2),
  discount_percentage INTEGER,
  alert_type VARCHAR(50), -- 'price_drop', 'back_in_stock', 'deal', 'warehouse'
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User search preferences
CREATE TABLE user_search_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_marketplaces TEXT[] DEFAULT ARRAY['amazon', 'ebay', 'walmart'],
  alert_frequency VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
  min_discount_percentage INTEGER DEFAULT 20,
  max_price DECIMAL(10,2),
  categories TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_search_cache_query ON product_search_cache(search_query);
CREATE INDEX idx_search_cache_expires ON product_search_cache(expires_at);
CREATE INDEX idx_watchlist_user ON price_watchlist(user_id);
CREATE INDEX idx_price_history_watchlist ON price_history(watchlist_id, checked_at DESC);
CREATE INDEX idx_deal_alerts_user_unread ON deal_alerts(user_id, is_read, created_at DESC);

-- RLS Policies
ALTER TABLE price_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_search_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own watchlist"
  ON price_watchlist FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their price history"
  ON price_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM price_watchlist 
    WHERE price_watchlist.id = price_history.watchlist_id 
    AND price_watchlist.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their own alerts"
  ON deal_alerts FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their preferences"
  ON user_search_preferences FOR ALL
  USING (auth.uid() = user_id);
```

---

### Phase 2: Frontend Components (Week 2-3)

#### 2.1 Universal Product Search Dialog
**Component**: `f:\bareretail\src\components\ProductSearchDialog.jsx`

**Features**:
- 🔍 **Search Bar** - Intelligent autocomplete with recent searches
- 🏪 **Marketplace Filters** - Multi-select with logos (Amazon, eBay, Walmart, etc.)
- 💰 **Price Range Slider** - Min/max with histogram
- 🎯 **Sort Options** - Price (low/high), Discount %, Marketplace, Rating
- 📊 **View Modes** - Grid (cards) or List (table)
- ⭐ **Quick Actions** - "Add to Watchlist", "Track Price", "Compare"

**UI Mock**:
```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search Products Across All Marketplaces                 │
├─────────────────────────────────────────────────────────────┤
│  Search: [Nike Air Max 90________________] [🔍 Search]      │
│                                                             │
│  Marketplaces: [📦Amazon] [🛒eBay] [🏬Walmart] [+5 more]  │
│  Price: $0 ═══●═════●═════ $500                            │
│  Condition: ○ All ● New ○ Used                             │
│  Sort by: [Price: Low to High ▾]              [Grid ≡]     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │[IMAGE]   │ │[IMAGE]   │ │[IMAGE]   │                   │
│  │Nike...   │ │Nike...   │ │Nike...   │                   │
│  │📦 $129.99│ │🛒 $139.95│ │🏬 $144.00│                   │
│  │-19% 🔥  │ │-12%      │ │-9%       │                   │
│  │[Track]   │ │[Track]   │ │[Track]   │                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 Product Detail View
**Component**: `f:\bareretail\src\components\ProductDetailView.jsx`

**Features**:
- 📸 **Image Gallery** - Primary + variants
- 💰 **Price Comparison Table** - All marketplaces side-by-side
- 📈 **Price History Chart** - Line chart showing 30/60/90 day trends
- ⚡ **Quick Actions** - "Buy Now", "Add to Watchlist", "Set Price Alert"
- 📊 **Profit Calculator** - Input buy price, see estimated profit per marketplace
- 🔔 **Alert Settings** - Set target price, notification preferences

#### 2.3 Price Watchlist Manager
**Component**: `f:\bareretail\src\components\PriceWatchlist.jsx`

**Features**:
- 📋 **Active Watches** - List of tracked products
- 🔔 **Alert Status** - "Price dropped!", "Back in stock!", "Target reached!"
- 📊 **Mini Charts** - Sparkline showing recent price movement
- ✏️ **Quick Edit** - Update target price, pause alerts
- 🗑️ **Bulk Actions** - Remove multiple, export list

---

### Phase 3: Integration Points (Week 3)

#### 3.1 Dashboard Integration
**Location**: `f:\bareretail\src\pages\Dashboard.jsx`

**New Widget**: "Product Search" prominently placed in hero section

```jsx
<Card className="col-span-full">
  <CardContent className="p-6">
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <h3 className="text-xl font-semibold mb-2">
          🔍 Search Products Across All Marketplaces
        </h3>
        <p className="text-muted-foreground">
          Find the best deals, track prices, and discover profitable opportunities
        </p>
      </div>
      <Button 
        size="lg" 
        onClick={() => setProductSearchOpen(true)}
        className="bg-blue-600 hover:bg-blue-700"
      >
        <Search className="mr-2" /> Search Now
      </Button>
    </div>
  </CardContent>
</Card>
```

#### 3.2 Inventory Page Integration
**Location**: `f:\bareretail\src\pages\Inventory.jsx`

**Replace** "Sold Listings Lookup" → "Compare Prices"
- Toolbar button: "Compare Prices Across Marketplaces"
- Context menu on items: "Search Similar Products"
- Auto-populate search from item name

#### 3.3 Crosslist Page Integration
**Location**: `f:\bareretail\src\pages\Crosslist.jsx`

**New Feature**: "Research Optimal Platform"
- Button on each item: "Find Best Platform"
- Shows: Current price on each marketplace
- Calculates: Net profit after fees
- Suggests: Best marketplace to list on

---

### Phase 4: Enhanced Pulse Page (Week 4)

#### 4.1 Deal Monitoring System
**Location**: `f:\bareretail\src\pages\Pulse.jsx`

**New Sections**:

1. **🔥 Hot Deals** - Real-time deals >30% off
2. **📉 Price Drops** - Tracked items that hit target price
3. **📦 Amazon Warehouse** - Damaged box deals
4. **💎 Hidden Gems** - High-margin opportunities
5. **⚡ Flash Deals** - Time-sensitive offers
6. **🎯 Personalized** - Based on user's search history

**Features**:
- **Auto-refresh** - Check every 5 minutes
- **Smart Filters** - Min discount %, category, marketplace
- **Quick Actions** - "Buy Now", "Add to Inventory", "Track"
- **Profit Estimator** - Show potential profit margin
- **Alert Bell** - Desktop notifications for major deals

#### 4.2 Background Deal Scraper
**Worker**: `f:\bareretail\api\workers\deal-scraper.js`

**Cron Jobs**:
```javascript
// Every 5 minutes - Check hot deals
*/5 * * * * - Run deal scanner

// Every hour - Check watchlist prices
0 * * * * - Run price checker

// Every day at 8 AM - Send deal digest email
0 8 * * * - Send daily deals summary
```

**Deal Sources**:
- Amazon Lightning Deals API
- eBay Daily Deals
- Walmart Rollback items
- Best Buy Deal of the Day
- Target Clearance
- Amazon Warehouse Deals

---

## 🛠️ Implementation Strategy

### Week 1: Backend Foundation
- [ ] Set up database schema (migrations)
- [ ] Integrate Product Search API
- [ ] Implement caching layer
- [ ] Create search endpoint
- [ ] Add price history tracking

### Week 2: Core UI Components
- [ ] Build ProductSearchDialog component
- [ ] Create ProductDetailView component
- [ ] Implement PriceWatchlist component
- [ ] Add marketplace logos and branding
- [ ] Design responsive layouts

### Week 3: Integration & Polish
- [ ] Add search button to Dashboard
- [ ] Replace Sold Listings in Inventory
- [ ] Integrate with Crosslist page
- [ ] Implement error handling
- [ ] Add loading states and skeletons

### Week 4: Pulse Enhancement
- [ ] Redesign Pulse page layout
- [ ] Implement deal monitoring
- [ ] Create background scraper
- [ ] Set up cron jobs
- [ ] Add notification system

---

## 💰 Cost Analysis

### API Costs (Monthly)
- **Product Search API**: Free tier (20 credits) → $29/mo (1,000 searches)
- **PricesAPI**: Free tier (1,000 calls) → $29/mo (10,000 calls)
- **SearchAPI**: Free tier (100 calls) → $49/mo (5,000 calls)
- **Apify E-commerce Scraper**: $49/mo (scale option)

**Estimated Monthly**: $0-$49 (free tiers) → $150-$200 (full scale)

### Cost Optimization Strategies
1. **Aggressive Caching** - Cache results for 1 hour, reduce API calls by 90%
2. **Smart Refresh** - Only update prices for tracked items
3. **Batch Requests** - Group multiple product lookups
4. **Free Tier Rotation** - Use multiple services to maximize free limits
5. **User Limits** - Implement search quotas (e.g., 50 searches/day per user)

---

## 🔒 Legal & Ethical Considerations

### Terms of Service Compliance
- ✅ **Product Search API** - Designed for commercial use
- ✅ **PricesAPI** - Legal aggregation service
- ⚠️ **Direct Scraping** - Use only as fallback, implement rate limiting
- ✅ **Amazon PA-API** - Use for affiliate links (follow TOS)

### Best Practices
- Respect robots.txt
- Implement exponential backoff
- Use proxies for direct scraping
- Cache aggressively to reduce load
- Add user-agent headers
- Follow rate limits strictly

---

## 📊 Success Metrics

### Key Performance Indicators
- **Search Accuracy**: >90% successful searches
- **Response Time**: <2 seconds average
- **Price Accuracy**: Within 5% of actual price
- **User Engagement**: 50%+ of users try search feature
- **Deal Discovery**: 100+ deals found per day
- **User Retention**: +20% due to value-add features

---

## 🚀 Future Enhancements (Phase 2)

1. **Chrome Extension** - Search products while browsing any site
2. **Mobile App** - Push notifications for price drops
3. **AI Price Predictor** - ML model for "best time to buy"
4. **Bulk Import** - CSV upload of products to track
5. **API for Users** - Let power users access data programmatically
6. **Social Features** - Share deals, collaborative watchlists
7. **Integration Hub** - Connect with keepa.com, camelcamelcamel
8. **Profit Calculator** - Factor in shipping, taxes, marketplace fees
9. **Historical Analytics** - "What if I bought this 6 months ago?"
10. **Deal Sharing Community** - Users submit and upvote deals

---

## 🔧 Technical Stack

### Frontend
- React + TypeScript
- TanStack Query for data fetching
- Recharts for price history graphs
- Lucide Icons for UI
- Tailwind CSS for styling
- shadcn/ui components

### Backend  
- Node.js serverless functions
- Supabase PostgreSQL
- Cron jobs for monitoring
- Redis for caching (future)

### External Services
- Product Search API (primary)
- PricesAPI (secondary)
- SearchAPI (fallback)
- Apify (scale solution)

---

## 📝 Next Steps

**Immediate Actions**:
1. ✅ Review and approve this plan
2. 🔑 Sign up for API keys (Product Search API, PricesAPI)
3. 📊 Create database migration
4. 🎨 Design UI mockups in Figma (optional)
5. 💻 Start Week 1 implementation

**Questions to Answer**:
- Which marketplaces are highest priority? (Amazon, eBay, Walmart, Best Buy?)
- What's the budget for API services? ($0, $50/mo, $200/mo?)
- How many searches per user per day? (Quota limits)
- Email notifications or in-app only?
- Mobile app planned? (Affects architecture)

---

**Ready to proceed?** Let me know and I'll start with Week 1: Database Schema + API Integration! 🚀
