# Fix RapidAPI Search - 0 Results Issue

## Problem
Product search returns **0 results** even though the API responds with 200 OK.

## Root Cause
Your `RAPIDAPI_KEY` environment variable is set in Fly.io, but it's likely:
- ❌ Invalid/expired key
- ❌ Not subscribed to the "Real-Time Product Search" API
- ❌ Wrong API key (from a different RapidAPI account)

## Solution: Get a Valid RapidAPI Key

### Step 1: Go to RapidAPI
1. Visit: https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-product-search
2. Log in or create an account

### Step 2: Subscribe to the API
1. Click **"Subscribe to Test"** button
2. Choose the **BASIC plan** (free, 100 requests/month, no credit card required)
3. Click **"Subscribe"**

### Step 3: Get Your API Key
1. After subscribing, you'll see the API playground
2. On the right side, look for **"Code Snippets"**
3. Find the line: `'X-RapidAPI-Key': 'YOUR-API-KEY-HERE'`
4. Copy your API key (looks like: `a1b2c3d4e5msh...`)

### Step 4: Test Your Key (Optional but Recommended)
```powershell
# Run this to verify your key works:
.\test-rapidapi.ps1 "paste-your-api-key-here"
```

If you see "✅ SUCCESS!" and a list of products, your key is valid!

### Step 5: Update Fly.io Secret
```powershell
# Replace YOUR-API-KEY-HERE with your actual key
fly secrets set RAPIDAPI_KEY="YOUR-API-KEY-HERE" -a orben-search-worker
```

Example:
```powershell
fly secrets set RAPIDAPI_KEY="a1b2c3d4e5msh6f7g8h9i0jklmnopqrstuv" -a orben-search-worker
```

### Step 6: Wait for Deployment
The search worker will automatically restart with the new key (takes ~30 seconds).

### Step 7: Test Product Search
1. Go to: https://profitorbit.io/product-search
2. Search for: "iPhone 15"
3. You should see 20 real products!

## Troubleshooting

### Still Getting 0 Results?
1. **Check browser console** for error messages
2. **Check Fly.io logs**:
   ```powershell
   fly logs -a orben-search-worker | Select-Object -Last 50
   ```
   Look for lines with `[Google/RapidAPI]`

### Common Error Messages

**"You are not subscribed to this API"**
- You need to subscribe to the BASIC plan (free)
- Go back to Step 2 above

**"Invalid API Key"**
- Copy the key again from RapidAPI dashboard
- Make sure you didn't include quotes or extra spaces

**"Rate Limit Exceeded"**
- You hit the 100 requests/month limit on BASIC plan
- Upgrade to PRO plan ($50/mo for 20K requests)
- Or wait until next month

## Alternative: Use a Test Key (Temporary)

If you don't want to create a RapidAPI account right now, you can temporarily use Oxylabs for testing:

```powershell
# This will make search use Oxylabs google_search (returns articles, not products)
# Not ideal, but at least you'll see some results
```

**Note**: This is NOT recommended for production - the results won't be product listings.

## What Plan Should You Get?

### For Testing/Development:
- **BASIC**: Free (100 requests/month) ✅

### For Production (Light Usage):
- **PRO**: $50/month (20,000 requests)
- Covers ~100-200 active users

### For Scale (200K+ users):
- **MEGA**: $150/month (200,000 requests)
- Covers 10,000-50,000 active users
- Overage: $0.001 per request ($1 per 1,000 searches)

---

## Quick Start Commands

```powershell
# 1. Test your RapidAPI key
.\test-rapidapi.ps1 "your-key-here"

# 2. If test passes, update Fly.io
fly secrets set RAPIDAPI_KEY="your-key-here" -a orben-search-worker

# 3. Watch deployment
fly status -a orben-search-worker

# 4. Test product search
# Go to: https://profitorbit.io/product-search
```

---

**Next Steps**: Get your RapidAPI key and update the secret. Search should work within 1 minute!
