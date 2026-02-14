# Product Search - 0 Results Fix (RapidAPI Key Issue)

**Date:** February 14, 2026  
**Issue:** Search returns 0 results for all queries  
**Root Cause:** `RAPIDAPI_KEY` environment variable not set or invalid

---

## The Problem

When you search "Fluval" on Orben, you get 0 results even though Google Shopping has plenty:

```
[ProductSearch] Results: {itemCount: 0, providers: [{provider: 'google', cached: false, count: 0}]}
```

The backend code returns an empty array when no API key is found (line 172-175 in `orben-search-worker/index.js`):

```javascript
if (!this.apiKey) {
  console.warn('[Google/RapidAPI] No API key configured');
  return [];  // ← THIS IS WHAT'S HAPPENING
}
```

---

## Solution: Set RapidAPI Key

### Step 1: Get Your RapidAPI Key

1. Go to: https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-product-search
2. Click **"Subscribe to Test"**
3. Select **FREE plan** (100 requests/month)
4. After subscribing, go to **"Code Snippets"** tab
5. Look for this line:
   ```
   'X-RapidAPI-Key': 'YOUR-KEY-HERE'
   ```
6. **Copy your API key** (looks like: `42d302e04bmshfdc015eb042fea8p1a7f34jsn96d38e01239a`)

---

### Step 2: Set the Environment Variable

#### If using Fly.io:

```powershell
fly secrets set RAPIDAPI_KEY="paste-your-key-here" -a orben-search-worker
```

#### If using Vercel/other platform:

Add environment variable:
- **Name**: `RAPIDAPI_KEY`
- **Value**: Your API key from step 1

---

### Step 3: Restart the Search Worker

The search worker will automatically restart and pick up the new key.

**Wait 30-60 seconds**, then test again!

---

## How to Test

### Option 1: Use the Frontend

1. Go to: https://profitorbit.io/product-search
2. Type: "iPhone 15"
3. Wait 2-3 seconds (auto-search)
4. **Expected:** 20-50 products from Google Shopping

### Option 2: Test API Directly

```powershell
# Get your token from localStorage in browser console:
# localStorage.getItem('sb-hlcwhpajorzbleabavcr-auth-token')

$token = "YOUR_SUPABASE_TOKEN"

Invoke-RestMethod -Uri "https://orben-api.fly.dev/v1/search?q=iPhone&providers=auto&limit=10" `
  -Headers @{"Authorization"="Bearer $token"} `
  -Method GET | ConvertTo-Json -Depth 5
```

**Expected output:**
```json
{
  "items": [
    {
      "title": "Apple iPhone 15 Pro Max...",
      "price": 899.99,
      "merchant": "Best Buy",
      ...
    },
    ... 19 more items
  ],
  "total": 20,
  "providers": [
    {"provider": "google", "cached": false, "count": 20}
  ]
}
```

---

## Verify in Logs

After setting the key, check Fly.io logs:

```powershell
fly logs -a orben-search-worker -n 50
```

**Look for:**
```
[Google/RapidAPI] Searching for: "iPhone"
[Google/RapidAPI] Response status: OK
[Google/RapidAPI] Found 20 products
```

**If you still see:**
```
[Google/RapidAPI] No API key configured
```

The environment variable didn't get set correctly. Try setting it again.

---

## Alternative: Use eBay Provider

If you don't want to create a RapidAPI account right now, you can temporarily use eBay:

### Set eBay App ID:

1. Go to: https://developer.ebay.com/my/keys
2. Create an application (sandbox is fine for testing)
3. Copy your **App ID (Client ID)**
4. Set it:

```powershell
fly secrets set EBAY_APP_ID="your-ebay-app-id-here" -a orben-search-worker
```

eBay will return fewer results (mostly used items), but it works without any additional signup.

---

## Why RapidAPI?

**RapidAPI** provides access to Google Shopping data, which includes:
- ✅ 100+ merchants (Amazon, Walmart, Best Buy, Target, etc.)
- ✅ Real-time pricing
- ✅ Product ratings and reviews
- ✅ Fast response (2-5 seconds)
- ✅ FREE tier: 100 searches/month

**Cost:**
- First 100 searches/month: **FREE**
- After that: **$10/month** for 1,000 searches (optional)

---

## Summary

1. **Get RapidAPI key** (2 minutes): https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-product-search
2. **Set environment variable**:
   ```
   fly secrets set RAPIDAPI_KEY="your-key" -a orben-search-worker
   ```
3. **Wait 60 seconds** for restart
4. **Test search** - Should now return 20-50 products!

That's it! Once the key is set, your Product Search will work exactly like Google Shopping. 🚀

---

## Troubleshooting

### Still getting 0 results after setting key?

1. **Check if key is actually set:**
   ```powershell
   fly secrets list -a orben-search-worker
   ```
   You should see: `RAPIDAPI_KEY = (set)`

2. **Check worker logs:**
   ```powershell
   fly logs -a orben-search-worker | Select-String -Pattern "RapidAPI|Search error"
   ```

3. **Verify your RapidAPI subscription:**
   - Go to: https://rapidapi.com/dashboard
   - Check if "Real-Time Product Search" is in your subscriptions
   - Make sure you haven't exceeded 100 requests/month

4. **Test RapidAPI directly:**
   ```powershell
   $headers = @{
       "X-RapidAPI-Key" = "your-key-here"
       "X-RapidAPI-Host" = "real-time-product-search.p.rapidapi.com"
   }
   
   Invoke-RestMethod -Uri "https://real-time-product-search.p.rapidapi.com/search-v2?q=iPhone&country=us&limit=10" `
       -Headers $headers `
       -Method GET
   ```
   
   If this returns products, your key is valid!

---

**Next Step:** Get your RapidAPI key and set the environment variable. Search should work within 60 seconds!
