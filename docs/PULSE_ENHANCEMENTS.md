# 🚀 Pulse Page Enhancement Plan
## Inspired by Amazon Deal Tracking Bots

Based on analysis of 3 successful GitHub projects:
1. **Amazon-Deal-Scraper** - Discord bot with coupon API
2. **Amazon-Deal-Monitor** - Webhook-based deal alerts
3. **Amazon-WD-Alerts** - Warehouse deal tracking

---

## 🎯 Key Features We Can Implement

### **1. Smart Deal Detection** 🤖

**From: Amazon-Deal-Scraper & Amazon-Deal-Monitor**

**Features to Add:**
- ✅ Coupon detection (products with hidden coupons)
- ✅ Lightning deals (time-sensitive)
- ✅ Category-based filtering (Electronics, Home, etc.)
- ✅ Discount threshold alerts (50%+, 70%+, 90%+ off)
- ✅ Price history tracking (30 days, 90 days)
- ✅ Amazon Warehouse deals (open box, refurbished)

**Implementation:**

```javascript
// api/pulse/deal-detector.js
export async function detectDeals(watchlistItems) {
  const deals = [];
  
  for (const item of watchlistItems) {
    // Check for deep discounts (from Amazon-Deal-Monitor logic)
    const currentPrice = await fetchCurrentPrice(item.product_url);
    const discountPercent = ((item.initial_price - currentPrice) / item.initial_price) * 100;
    
    // Alert thresholds (configurable per user)
    const triggers = [
      { threshold: 50, priority: 'medium', icon: '🔥' },
      { threshold: 70, priority: 'high', icon: '⚡' },
      { threshold: 90, priority: 'urgent', icon: '🚨' }
    ];
    
    for (const trigger of triggers) {
      if (discountPercent >= trigger.threshold) {
        deals.push({
          ...item,
          dealType: `${trigger.threshold}%+ OFF`,
          priority: trigger.priority,
          icon: trigger.icon,
          savings: item.initial_price - currentPrice,
          percentOff: discountPercent.toFixed(0)
        });
        break;
      }
    }
    
    // Check for Amazon Warehouse deals (from Amazon-WD-Alerts)
    if (item.marketplace === 'amazon') {
      const warehouseDeal = await checkWarehouseDeal(item.product_url);
      if (warehouseDeal) {
        deals.push({
          ...item,
          dealType: 'WAREHOUSE DEAL',
          priority: 'high',
          icon: '📦',
          condition: warehouseDeal.condition,
          conditionDescription: warehouseDeal.description,
          savings: warehouseDeal.savings
        });
      }
    }
    
    // Check for coupons (from Amazon-Deal-Scraper)
    const coupon = await checkForCoupon(item.product_url);
    if (coupon) {
      deals.push({
        ...item,
        dealType: 'COUPON AVAILABLE',
        priority: 'medium',
        icon: '🎫',
        couponCode: coupon.code,
        couponDiscount: coupon.discount
      });
    }
  }
  
  return deals;
}
```

---

### **2. Advanced Filtering System** 🎯

**From: Amazon-Deal-Monitor filter logic**

**Features to Add:**
- ✅ Multi-criteria filters (price range + category + discount)
- ✅ "Isolated" priority filters (exclusive matching)
- ✅ Custom filter chains (if X then Y)
- ✅ Filter presets (save and reuse)

**UI Enhancement:**

```jsx
// New section in Pulse.jsx
<Card>
  <CardHeader>
    <CardTitle>Deal Filters</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* Filter Preset */}
      <div>
        <Label>Filter Preset</Label>
        <Select>
          <option>Electronics 70%+ Off</option>
          <option>Home & Kitchen $10-$50</option>
          <option>Warehouse Deals - Like New</option>
          <option>Lightning Deals - All</option>
          <option>Custom...</option>
        </Select>
      </div>
      
      {/* Category Filter */}
      <div>
        <Label>Categories</Label>
        <MultiSelect options={[
          'Electronics', 'Home & Kitchen', 'Toys & Games',
          'Sports & Outdoors', 'Beauty', 'Automotive'
        ]} />
      </div>
      
      {/* Price Range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Min Price</Label>
          <Input type="number" placeholder="$0" />
        </div>
        <div>
          <Label>Max Price</Label>
          <Input type="number" placeholder="$999" />
        </div>
      </div>
      
      {/* Discount Threshold */}
      <div>
        <Label>Minimum Discount</Label>
        <Slider min={0} max={100} step={5} defaultValue={[50]} />
        <span className="text-sm text-muted-foreground">50%+ off</span>
      </div>
      
      {/* Deal Types */}
      <div>
        <Label>Deal Types</Label>
        <div className="space-y-2">
          <Checkbox label="Regular Discounts" checked />
          <Checkbox label="Lightning Deals" checked />
          <Checkbox label="Warehouse Deals" checked />
          <Checkbox label="Coupons" checked />
          <Checkbox label="Prime Day Deals" />
        </div>
      </div>
      
      {/* Priority Filter (from Amazon-Deal-Monitor) */}
      <div>
        <Label>Priority Mode</Label>
        <Switch 
          checked={priorityMode}
          label="Only show deals matching ALL criteria"
        />
      </div>
    </div>
  </CardContent>
</Card>
```

---

### **3. Warehouse Deal Tracking** 📦

**From: Amazon-WD-Alerts**

**Key Insights:**
- Warehouse deals are open-box, returned items at huge discounts
- Condition tracking: Like New, Very Good, Good, Acceptable
- Uses XPath selectors to find warehouse-specific offers
- Tracks price changes on warehouse inventory

**Implementation:**

```javascript
// api/pulse/warehouse-tracker.js
export async function checkWarehouseDeal(amazonUrl) {
  // Extract ASIN from URL
  const asin = extractASIN(amazonUrl);
  
  // Build offers URL
  const offersUrl = `https://www.amazon.com/gp/offer-listing/${asin}`;
  
  // Use RapidAPI or direct scraping
  const response = await fetch(offersUrl);
  const html = await response.text();
  
  // Look for "Amazon Warehouse" seller
  const warehouseListing = parseWarehouseListing(html);
  
  if (warehouseListing) {
    return {
      found: true,
      condition: warehouseListing.condition, // "Like New", "Very Good", etc.
      description: warehouseListing.conditionNote,
      price: warehouseListing.price,
      savings: warehouseListing.originalPrice - warehouseListing.price,
      percentOff: ((warehouseListing.originalPrice - warehouseListing.price) / warehouseListing.originalPrice * 100).toFixed(0),
      url: `${offersUrl}?f_new=true&f_used=true`
    };
  }
  
  return null;
}

function parseWarehouseListing(html) {
  // XPath/CSS selectors from Amazon-WD-Alerts config
  const selectors = {
    warehouseIndicator: "img[alt='Amazon Warehouse']",
    price: ".olpOfferPrice",
    condition: ".olpCondition",
    conditionNote: ".comments"
  };
  
  // Parse and return data
  // (Use cheerio or similar for server-side HTML parsing)
}
```

**UI Display:**

```jsx
// Warehouse Deal Card
<Card className="border-2 border-orange-500">
  <CardHeader className="bg-orange-50">
    <div className="flex items-center gap-2">
      <Badge className="bg-orange-500">📦 WAREHOUSE DEAL</Badge>
      <Badge variant="outline">Like New</Badge>
    </div>
  </CardHeader>
  <CardContent className="pt-4">
    <h3 className="font-semibold">Sony WH-1000XM5 Headphones</h3>
    <div className="mt-2 space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Original:</span>
        <span className="line-through">$399.99</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Warehouse:</span>
        <span className="text-2xl font-bold text-green-600">$249.99</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Savings:</span>
        <span className="text-green-600 font-semibold">$150 (38% off)</span>
      </div>
    </div>
    <div className="mt-3 p-2 bg-muted rounded text-sm">
      <strong>Condition:</strong> Like New
      <p className="text-xs text-muted-foreground mt-1">
        Item is in original packaging, may have been opened. Fully functional.
      </p>
    </div>
    <Button className="w-full mt-3" onClick={() => window.open(deal.url)}>
      View Deal <ExternalLink className="ml-2 h-4 w-4" />
    </Button>
  </CardContent>
</Card>
```

---

### **4. Scheduled Monitoring & Notifications** ⏰

**From: All three repos**

**Features:**
- ✅ Automatic price checks every 6 hours
- ✅ Instant notifications on deal detection
- ✅ Email + Push notifications (optional)
- ✅ Discord webhook integration (for power users)

**Vercel Cron Job Enhancement:**

```javascript
// vercel.json
{
  "crons": [
    {
      "path": "/api/pulse/scan-deals",
      "schedule": "0 */6 * * *"  // Every 6 hours
    },
    {
      "path": "/api/pulse/scan-lightning-deals",
      "schedule": "*/15 * * * *"  // Every 15 minutes for time-sensitive
    },
    {
      "path": "/api/pulse/scan-warehouse-deals",
      "schedule": "0 */12 * * *"  // Every 12 hours (warehouse inventory changes slower)
    }
  ]
}
```

```javascript
// api/pulse/scan-lightning-deals.js
export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Scan for lightning deals (time-sensitive)
  const lightningDeals = await fetchLightningDeals();
  
  // Match against user watchlists
  const matches = await matchDealsToWatchlists(lightningDeals);
  
  // Send INSTANT notifications
  for (const match of matches) {
    await sendNotification(match.userId, {
      title: '⚡ LIGHTNING DEAL ALERT!',
      body: `${match.product} is ${match.percentOff}% off for the next ${match.timeRemaining}!`,
      priority: 'urgent',
      url: match.productUrl
    });
  }
  
  res.json({ success: true, alertsSent: matches.length });
}
```

---

### **5. Deal Categories & Smart Grouping** 📊

**From: Amazon-Deal-Monitor categories**

**Categories to Track:**
```javascript
const DEAL_CATEGORIES = {
  'Electronics': ['Computers', 'Phones', 'Cameras', 'Audio'],
  'Home & Kitchen': ['Appliances', 'Furniture', 'Decor'],
  'Toys & Games': ['Action Figures', 'Board Games', 'LEGO'],
  'Sports & Outdoors': ['Fitness', 'Camping', 'Sports Equipment'],
  'Beauty & Personal Care': ['Skincare', 'Makeup', 'Hair Care'],
  'Automotive': ['Parts', 'Tools', 'Accessories'],
  'Fashion': ['Clothing', 'Shoes', 'Accessories'],
  'Books': ['Fiction', 'Non-Fiction', 'Textbooks'],
  'Pet Supplies': ['Food', 'Toys', 'Health'],
  'Baby Products': ['Diapers', 'Toys', 'Gear']
};
```

**UI Tabs:**

```jsx
<Tabs defaultValue="all">
  <TabsList className="grid grid-cols-5 md:grid-cols-10">
    <TabsTrigger value="all">All Deals</TabsTrigger>
    <TabsTrigger value="electronics">📱 Electronics</TabsTrigger>
    <TabsTrigger value="home">🏠 Home</TabsTrigger>
    <TabsTrigger value="toys">🎮 Toys</TabsTrigger>
    <TabsTrigger value="sports">⚽ Sports</TabsTrigger>
    <TabsTrigger value="beauty">💄 Beauty</TabsTrigger>
    <TabsTrigger value="warehouse">📦 Warehouse</TabsTrigger>
    <TabsTrigger value="lightning">⚡ Lightning</TabsTrigger>
    <TabsTrigger value="coupons">🎫 Coupons</TabsTrigger>
    <TabsTrigger value="prime">🔵 Prime Day</TabsTrigger>
  </TabsList>
  
  <TabsContent value="all">
    <DealGrid deals={allDeals} />
  </TabsContent>
  
  {/* ...other tabs... */}
</Tabs>
```

---

### **6. Price History Visualization** 📈

**From: All repos mention price tracking**

**Features:**
- ✅ 30/60/90 day price charts
- ✅ Lowest price in history indicator
- ✅ Price drop alerts
- ✅ "Good time to buy" recommendations

**Implementation:**

```jsx
// Price History Chart (already have Recharts)
<Card>
  <CardHeader>
    <CardTitle>Price History - Sony WH-1000XM5</CardTitle>
  </CardHeader>
  <CardContent>
    <LineChart width={600} height={300} data={priceHistory}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="price" stroke="#8884d8" />
      <ReferenceLine 
        y={lowestPrice} 
        label="All-Time Low" 
        stroke="green" 
        strokeDasharray="3 3" 
      />
    </LineChart>
    
    {currentPrice === lowestPrice && (
      <Alert className="mt-4 bg-green-50 border-green-500">
        <TrendingDown className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>✅ BEST PRICE EVER!</strong> This is the lowest price in the last 90 days.
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

---

## 🔧 Technical Implementation Plan

### **Phase 1: Core Deal Detection** (Week 1-2)

1. ✅ **Warehouse Deal Tracker**
   - Add `/api/pulse/warehouse-deals` endpoint
   - XPath/CSS selectors for warehouse listings
   - Condition parsing (Like New, Very Good, etc.)

2. ✅ **Lightning Deal Scanner**
   - 15-minute cron job
   - Time-remaining parser
   - Instant notifications

3. ✅ **Coupon Detector**
   - Check for hidden coupons
   - Coupon code extraction
   - Auto-apply logic

### **Phase 2: Filtering & Categories** (Week 3)

1. ✅ **Category System**
   - Add category to `price_watchlist` table
   - Category-based filtering
   - Tab navigation UI

2. ✅ **Advanced Filters**
   - Multi-criteria filter builder
   - Filter presets (save/load)
   - Priority mode (AND vs OR logic)

### **Phase 3: Notifications & Alerts** (Week 4)

1. ✅ **Email Notifications**
   - SendGrid/Resend integration
   - Email templates
   - Frequency controls

2. ✅ **Push Notifications** (Optional)
   - Web Push API
   - Mobile notifications
   - Discord webhooks (for power users)

### **Phase 4: Analytics & Insights** (Week 5)

1. ✅ **Price History Charts**
   - Store historical prices (already have `price_history` table)
   - Visualization with Recharts
   - Statistical analysis

2. ✅ **Deal Quality Score**
   - Algorithm: discount % + price history + time sensitivity
   - "Hot Deal" badges
   - Recommendations

---

## 📊 Database Schema Updates

```sql
-- Add new columns to price_watchlist table
ALTER TABLE price_watchlist ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE price_watchlist ADD COLUMN IF NOT EXISTS deal_type TEXT; -- 'regular', 'warehouse', 'lightning', 'coupon'
ALTER TABLE price_watchlist ADD COLUMN IF NOT EXISTS priority_mode BOOLEAN DEFAULT false;

-- Add new deal_filters table
CREATE TABLE IF NOT EXISTS deal_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  criteria JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new warehouse_deals table
CREATE TABLE IF NOT EXISTS warehouse_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asin TEXT NOT NULL,
  product_name TEXT,
  condition TEXT, -- 'Like New', 'Very Good', 'Good', 'Acceptable'
  condition_note TEXT,
  price DECIMAL(10,2),
  original_price DECIMAL(10,2),
  savings DECIMAL(10,2),
  percent_off INTEGER,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  INDEX idx_warehouse_asin (asin),
  INDEX idx_warehouse_detected (detected_at DESC)
);
```

---

## 🎯 Quick Wins (Implement First)

1. **Warehouse Deal Badge** (1 day)
   - Add orange "📦 WAREHOUSE" badge to deals
   - Show condition + savings

2. **Deal Type Icons** (1 day)
   - ⚡ Lightning
   - 📦 Warehouse
   - 🎫 Coupon
   - 🔥 Hot Deal

3. **Category Tabs** (2 days)
   - Filter by Electronics, Home, etc.
   - Visual category icons

4. **Discount Badges** (1 day)
   - Color-coded: 50% (yellow), 70% (orange), 90% (red)
   - Pulsing animation for urgent deals

---

## 🚀 Priority Features (MVP)

**Must Have:**
1. ✅ Warehouse deal tracking
2. ✅ Category filtering
3. ✅ Discount threshold alerts (50%+, 70%+)
4. ✅ Price history charts

**Nice to Have:**
5. Lightning deal scanner (15-min cron)
6. Coupon detector
7. Email notifications
8. Discord webhooks

**Future:**
9. AI-powered deal recommendations
10. Mobile app
11. Browser extension

---

## 📝 Summary

**What We Learned from GitHub Repos:**

1. **Amazon-Deal-Scraper**: 
   - Coupon detection via reverse-engineered API
   - Filter system with MongoDB
   - 6-hour check interval

2. **Amazon-Deal-Monitor**:
   - Advanced filter logic (priority/isolated mode)
   - Discord webhook notifications
   - Category-based organization

3. **Amazon-WD-Alerts**:
   - Warehouse deal XPath selectors
   - Condition tracking (Like New, Very Good, etc.)
   - Shell notifications + speech output

**Our Implementation:**
- ✅ Use FREE APIs (RapidAPI/SerpAPI) instead of scraping
- ✅ Store in Supabase (already have schema)
- ✅ Vercel Cron for scheduled checks
- ✅ React UI with real-time updates
- ✅ Email/Push notifications

**Next Steps:**
1. Add warehouse deal detection endpoint
2. Implement category filtering in UI
3. Create lightning deal cron job (15 min)
4. Add deal type badges & icons

---

**Ready to implement! Which feature should we start with?** 🚀
