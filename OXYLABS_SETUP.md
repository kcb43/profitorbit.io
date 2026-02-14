# 🔧 Setting Up Oxylabs for Universal Search

## Overview

Oxylabs offers high-quality Google Shopping data via their **E-Commerce Scraper API**. This is better than RapidAPI for several reasons:
- ✅ More accurate product data
- ✅ Better parsing of complex pages
- ✅ Supports multiple e-commerce sites (Amazon, eBay, Google Shopping, etc.)
- ✅ Build custom scrapers for any site
- ✅ Residential proxies (looks like real users)
- ✅ No rate limits (pay per request)

---

## 🎯 What You Get with Oxylabs

### Google Shopping Search
- Search query → Full product listings
- Pricing from multiple merchants
- Product images, ratings, reviews
- Availability status
- Merchant information

### Universal Scraping
- Scrape ANY e-commerce site
- Custom scraper builder
- HTML/JSON output
- Screenshot capability

---

## 💰 Pricing

**Pay-as-you-go:**
- Google Shopping: ~$0.50-1.00 per search
- Custom scraping: ~$1-3 per page
- No monthly minimum
- Free trial: $300 credits

**Better for:**
- Quality over quantity
- When you need accurate data
- Custom scraping needs

**RapidAPI (current):**
- Free: 100 searches/month
- Better for: High volume, testing

---

## 🚀 Setup Guide

### Step 1: Sign Up for Oxylabs

1. Go to: https://oxylabs.io/products/scraper-api/ecommerce
2. Click **"Start Free Trial"** ($300 credits)
3. Create account
4. Verify email

### Step 2: Get API Credentials

1. Log in to: https://dashboard.oxylabs.io/
2. Go to **Dashboard** → **API Users**
3. Create a new API user (or use default)
4. Copy:
   - **Username** (looks like: `username_12345`)
   - **Password** (random string)

### Step 3: Set Credentials on Fly.io

```powershell
# Set Oxylabs credentials
fly secrets set OXYLABS_USERNAME="your_username_here" -a orben-search-worker
fly secrets set OXYLABS_PASSWORD="your_password_here" -a orben-search-worker

# Wait 30 seconds for restart
Start-Sleep -Seconds 30
```

### Step 4: Test Oxylabs

```powershell
# Test Oxylabs search
$body = @{
    query = "iPhone 15 Pro"
    providers = @("oxylabs")
    userId = "test-oxylabs"
    limit = 5
} | ConvertTo-Json

$result = Invoke-RestMethod `
    -Uri "https://orben-search-worker.fly.dev/search" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Oxylabs Results: $($result.items.Count)" -ForegroundColor Green
$result.items | ForEach-Object {
    Write-Host "- $($_.title): `$$($_.price)"
}
```

---

## 🛠️ Improving Search Worker for Oxylabs

Our current Oxylabs implementation uses Google Shopping. Let me enhance it to support **custom scraping** for any e-commerce site:

### Enhanced Features:

1. **Google Shopping** (existing)
   - Product search queries
   - Multi-merchant pricing

2. **Amazon Scraping** (new)
   - Direct Amazon search
   - Product details pages
   - Pricing + availability

3. **eBay Scraping** (backup for API)
   - Scrape eBay search results
   - Fallback if API fails

4. **Custom Site Scraping** (advanced)
   - Any e-commerce URL
   - Extract: price, title, images
   - Build your own scrapers

---

## 🎯 Recommended Search Provider Strategy

### For Maximum Value:

**Primary Providers:**
1. **eBay API** (Free, 5000/day) - ✅ Already configured
   - Use for: General product search
   - Cost: $0

2. **RapidAPI/Google** (Free, 100/month) - ✅ Already configured
   - Use for: Quick Google Shopping checks
   - Cost: $0

3. **Oxylabs** (Paid, unlimited) - 🆕 Recommend adding
   - Use for: High-value searches where accuracy matters
   - Cost: ~$0.50-1.00 per search
   - When: User searches for expensive items (>$100)

### Smart Search Logic:

**Implement tiered search:**

```javascript
// Pseudo-code for smart search
if (query includes high-value keywords like "iPhone", "MacBook", "PS5") {
  // Use Oxylabs for accurate data
  providers = ["oxylabs", "ebay"]
} else {
  // Use free tier
  providers = ["ebay", "google"]
}

// Cache results for 6 hours to reduce API costs
```

---

## 📊 Cost Analysis

### Scenario: 1000 searches/month

**Option 1: eBay + RapidAPI (Current)**
- eBay: Free (up to 5000/day)
- RapidAPI: Free (100/month), then $15/1000
- **Total:** $0-15/month

**Option 2: eBay + Oxylabs (Recommended)**
- eBay: Free (general searches)
- Oxylabs: $0.50 × 100 high-value searches = $50
- **Total:** $50/month (but better data quality)

**Option 3: All Three (Best)**
- eBay: Free (bulk searches)
- RapidAPI: Free tier (100 searches)
- Oxylabs: $0.50 × 50 premium searches = $25
- **Total:** $25/month (optimized)

---

## 🚀 Implementation Plan

### Phase 1: Add Oxylabs Credentials (5 minutes)

```powershell
# Sign up at oxylabs.io (free trial - $300 credits)
# Get credentials from dashboard
fly secrets set OXYLABS_USERNAME="your_username" -a orben-search-worker
fly secrets set OXYLABS_PASSWORD="your_password" -a orben-search-worker
```

### Phase 2: Test All Providers (5 minutes)

```powershell
# Test script
.\test-all-search-providers.ps1
```

### Phase 3: Implement Smart Routing (Optional)

Update the API to route expensive searches to Oxylabs:

```javascript
// In orben-api/index.js
const estimatedValue = estimateProductValue(query);

if (estimatedValue > 100) {
  // High-value product - use Oxylabs
  providers = ["oxylabs", "ebay"];
} else {
  // Regular product - use free tier
  providers = ["ebay", "google"];
}
```

---

## 🎯 My Recommendation

**For Universal Product Search:**

1. **Keep eBay** - Free, high volume, good for general search ✅
2. **Keep RapidAPI** - Free 100/month, good for Google Shopping ✅
3. **Add Oxylabs** - Pay per search, use for high-value/accurate queries 🆕

**Smart strategy:**
- 90% of searches → eBay (free)
- 9% of searches → RapidAPI (free tier)
- 1% of searches → Oxylabs (when accuracy matters)

**Cost:** ~$10-25/month for excellent search coverage

---

## ✅ Next Steps

1. **Sign up for Oxylabs free trial:** https://oxylabs.io/products/scraper-api/ecommerce
2. **Get credentials** from dashboard
3. **Set secrets:**
   ```powershell
   fly secrets set OXYLABS_USERNAME="your_user" -a orben-search-worker
   fly secrets set OXYLABS_PASSWORD="your_pass" -a orben-search-worker
   ```
4. **Test:** Run search with `providers: ["oxylabs"]`
5. **Compare results** from all three providers

---

## 🔍 Debugging Current Search Issues

Before adding Oxylabs, let's fix eBay and RapidAPI:

**eBay has PRD** - ✅ Good!

**Let's test RapidAPI subscription:**

1. Go to: https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-product-search
2. Click **"My Apps"** → Check if subscribed
3. If not subscribed:
   - Click **"Subscribe to Test"**
   - Choose **"Basic"** (FREE - 100 searches)
   - Copy your API key
4. Update key:
   ```powershell
   fly secrets set RAPIDAPI_KEY="your_actual_key" -a orben-search-worker
   ```

**Then restart and test again.**

---

## 📞 Want Me To:

1. ✅ Set up Oxylabs integration? (I'll enhance the code)
2. ✅ Debug why eBay/RapidAPI return 0 results?
3. ✅ Implement smart routing (use Oxylabs for high-value searches)?
4. ✅ Create comparison tool to test all 3 providers side-by-side?

**Let me know which you want to tackle first!** 🚀

My recommendation: **First fix eBay/RapidAPI (should work), then add Oxylabs for premium searches.**
