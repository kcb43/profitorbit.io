# Dual API Strategy - Maximum Deal Coverage

## Overview

The system now fetches from **BOTH Keepa AND RapidAPI simultaneously** (plus public deals) to give you maximum deal coverage. This means you can see ALL available deals from all sources, then filter down based on quality.

---

## How It Works

### Parallel Fetching Strategy

```
User visits Pulse page
    ↓
API fetches from ALL sources at once (in parallel):
    ├─> Keepa API (if configured)
    ├─> RapidAPI (if configured)  
    └─> Public Amazon deals (always)
    ↓
Wait for ALL responses (Promise.all)
    ↓
Merge all results together
    ↓
Deduplicate by ASIN (keep highest quality)
    ↓
Score and sort deals
    ↓
Apply filters
    ↓
Return top N deals
```

### Previous Strategy (Waterfall):
```
Try Keepa → if < 20 deals → Try RapidAPI → if < 10 deals → Try Public
```
**Problem**: You miss deals if one source returns enough results

### New Strategy (Parallel):
```
Keepa + RapidAPI + Public → ALL AT ONCE → Merge & Deduplicate
```
**Benefit**: Maximum coverage, you see everything available

---

## API Source Performance Dashboard

The Pulse page now shows you EXACTLY what you're getting from each source:

```
┌─────────────────────────────────────────────────────────────┐
│  API Source Performance                          [Live Data] │
├─────────────────────────────────────────────────────────────┤
│  Keepa API [Active]     RapidAPI [Active]    Public [Always]│
│  Fetched: 47            Fetched: 32          Fetched: 2     │
│  After Dedup: 45        After Dedup: 28      After Dedup: 2 │
│  In Results: 40         In Results: 23       In Results: 2  │
├─────────────────────────────────────────────────────────────┤
│  Total deals fetched: 81                                    │
│  Duplicates removed: 6                                      │
│  Showing after filters: 65                                  │
└─────────────────────────────────────────────────────────────┘
```

### What This Tells You:

1. **Fetched**: Raw number of deals from each API
2. **After Dedup**: Unique deals after removing duplicates (same ASIN)
3. **In Results**: Deals that passed quality filters and made it to your screen
4. **Duplicates removed**: How many deals appeared in multiple sources
5. **Total showing**: Final count after all filtering

---

## Cost Analysis - Dual API Setup

### Option 1: RapidAPI Only (Budget)
**Cost**: $0-10/month
- Free tier: 100 requests/month
- Pro tier: $10/mo = 1,000 requests
**Deals**: ~30-50 per request
**Best for**: Testing, low volume

### Option 2: Keepa Only (Quality)
**Cost**: $20/month
- Starter: 500 tokens/day
**Deals**: ~50-100 per request with full history
**Best for**: Serious resellers wanting price history

### Option 3: BOTH APIs (Maximum Coverage) ⭐ **RECOMMENDED**
**Cost**: $30/month ($10 RapidAPI + $20 Keepa)
**Deals**: ~80-150 per request (deduplicated)
**Best for**: Maximum deal discovery

**Why Both?**
- Different deal coverage (not 100% overlap)
- Keepa has better price history
- RapidAPI has faster updates
- Redundancy if one API is down
- More categories and marketplaces

---

## Deduplication Logic

When the same product appears in multiple sources:

```javascript
ASIN: B08N5WRWNW (Echo Dot)

Keepa says:
  - Price: $24.99
  - Discount: 50%
  - Quality Score: 85
  - Has price history ✅

RapidAPI says:
  - Price: $24.99
  - Discount: 50%
  - Quality Score: 70
  - No price history ❌

System chooses: Keepa (higher quality score)
```

**Dedup Rule**: Keep the version with the highest quality score

---

## Quality Scoring (0-100)

The system scores each deal to determine which to show:

```javascript
Score = 
  Discount % * 0.4 (40%)          // 70% off = 28 points
  + Sales Rank bonus (20%)        // Top 100 = 20 points
  + Review Count bonus (20%)      // 1000+ reviews = 20 points
  + Rating bonus (20%)            // 4.5+ stars = 20 points
  + Lightning Deal bonus (10%)    // Time-sensitive = 10 points
  + Price Range bonus (10%)       // $20-200 sweet spot = 10 points
```

**Example**:
- Echo Dot: 50% off, rank #45, 15K reviews, 4.7★, regular price
- Score: 20 + 20 + 20 + 20 + 0 + 10 = **90/100** 🔥

---

## Filtering Down Results

After fetching from all sources, you can filter by:

### Built-in Filters:
1. **Deal Type**: Lightning, Warehouse, Coupon, Price Drop
2. **Category**: Electronics, Home, Toys, Sports, etc.
3. **Min Discount**: 25%, 50%, 70%, 90%
4. **Price Range**: $0-999
5. **Condition**: New, Like New, Very Good, Good
6. **Quality Score**: Automatically filters low-quality deals

### Advanced Filtering (in code):
```javascript
// Only show deals with:
- Quality score >= 60
- Discount >= 30%
- Rating >= 3.5 stars
- Reviews >= 10
- Price between $10-500
```

---

## Monitoring Your Setup

### Check API Usage:

**Keepa Dashboard**:
- Login to keepa.com
- Check "API Tokens" page
- See remaining tokens for today
- Monitor usage graph

**RapidAPI Dashboard**:
- Login to rapidapi.com
- Go to "My Apps"
- Check request count
- See rate limit status

### Optimize Costs:

**If seeing too many duplicates** (>50%):
- Consider dropping RapidAPI (Keepa has better coverage)
- Or drop Keepa (RapidAPI is cheaper)

**If not finding enough deals**:
- Add both APIs for maximum coverage
- Increase scan frequency (every 15 min vs 30 min)
- Add more categories

**If API costs too high**:
- Reduce scan frequency (hourly vs 30 min)
- Cache results for longer (1 hour vs 30 min)
- Focus on specific categories only

---

## Expected Results

### With Both APIs Configured:

**First scan (no cache)**:
```
Keepa: 47 deals
RapidAPI: 32 deals
Public: 2 deals
Total: 81 raw deals
After dedup: 75 unique deals
After quality filter: 65 showing
Duplicates: 6 (7% overlap)
```

**Why overlap is LOW**:
- Different API endpoints
- Different deal types prioritized
- Different update timing
- Complementary coverage

**Conclusion**: Using both gives you ~35% more deals than using just one!

---

## Real-Time Monitoring

The Pulse page shows you live statistics:

```
✅ Keepa Active: 40 deals
✅ RapidAPI Active: 23 deals  
✅ Public Active: 2 deals
📊 Total: 65 deals shown
🔄 Last refresh: 2 minutes ago
⏱️ Next refresh: 3 minutes
```

You can instantly see:
- Which APIs are working
- How many deals each provides
- If deduplication is working
- If filters are too aggressive

---

## Setup Instructions

### Step 1: Get Both API Keys

**Keepa** ($20/mo):
1. Go to https://keepa.com/#!api
2. Sign up for Starter plan
3. Copy API key

**RapidAPI** ($10/mo or free):
1. Go to https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-amazon-data
2. Subscribe to Pro plan (or start free)
3. Copy API key

### Step 2: Add to Vercel

```bash
KEEPA_API_KEY=your_keepa_key_here
RAPIDAPI_KEY=your_rapidapi_key_here
CRON_SECRET=random_string_here
```

### Step 3: Deploy & Monitor

- Deploy triggers automatically
- Visit Pulse page
- Check "API Source Performance" card
- Verify both APIs showing green "Active" badge

---

## Troubleshooting

**Only seeing RapidAPI deals?**
→ Keepa key not set or invalid

**Only seeing Keepa deals?**
→ RapidAPI key not set or invalid

**Seeing 0 deals?**
→ Check API keys, check usage limits

**High duplicate rate (>50%)?**
→ Normal for popular products, means good coverage!

**Low duplicate rate (<5%)?**
→ Great! Both APIs providing unique deals

---

## ROI Analysis

### Cost vs. Benefit

**Single API** ($10/mo RapidAPI):
- ~40 deals per request
- ~1,000 deals/day
- Cost per deal: $0.01

**Dual API** ($30/mo RapidAPI + Keepa):
- ~65 deals per request (+62% more!)
- ~1,500 deals/day
- Cost per deal: $0.02
- **Worth it if**: You find 1 extra profitable deal per month (pays for itself)

### Break-Even Analysis

If each deal has $5 potential profit margin:
- Need to find 6 extra deals/month to break even on $30
- At 500 extra deals/month, that's a 1.2% conversion rate needed
- Even at 0.1% conversion = profitable!

---

## Summary

✅ **Fetch from both APIs simultaneously**
✅ **Deduplicate automatically**  
✅ **Score and rank all deals**
✅ **Show real-time statistics**
✅ **Filter down to best deals**
✅ **Monitor API performance**

**Result**: Maximum deal coverage at optimal cost! 🚀

---

Ready to deploy? Just add both API keys and refresh Pulse page!
