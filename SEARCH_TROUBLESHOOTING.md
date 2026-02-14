# 🔧 Universal Search Troubleshooting

## ⚠️ Current Issue: Search Returns 0 Results

### Diagnosis

Tested search for "PlayStation 5 console" via eBay:
```json
{
  "provider": "ebay",
  "cached": false,
  "count": 0
}
```

**This means:**
- ✅ Search worker is responding
- ✅ Request reached the eBay provider
- ❌ eBay API returned 0 items

**Likely causes:**
1. Invalid or expired `EBAY_APP_ID`
2. eBay API key not activated for production
3. eBay API rate limit exceeded
4. eBay API key for wrong environment (sandbox vs production)

---

## 🔍 How to Fix

### Step 1: Verify Your eBay API Key

1. Go to: https://developer.ebay.com/my/keys
2. Click on your application
3. Make sure you're looking at **"Production Keys"** (not Sandbox)
4. Copy the **"App ID (Client ID)"**

**Important:** The App ID should look like:
```
YourAppN-ameHere-PRD-a1234567-8910abcd
```

- Must contain `-PRD-` (for production) or `-SBX-` (for sandbox)
- Is about 40-50 characters long
- No spaces or special characters except hyphens

---

### Step 2: Update the eBay API Key on Fly.io

```powershell
# Replace with your ACTUAL App ID from eBay
fly secrets set EBAY_APP_ID="YourAppN-ameHere-PRD-a1234567-8910abcd" -a orben-search-worker

# Wait 30 seconds for restart
Start-Sleep -Seconds 30

# Verify it was set
fly secrets list -a orben-search-worker
```

---

### Step 3: Test Again

```powershell
# Test with a fresh query
$body = @{
    query = "Nintendo Switch OLED"
    providers = @("ebay")
    userId = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    limit = 5
} | ConvertTo-Json

$result = Invoke-RestMethod `
    -Uri "https://orben-search-worker.fly.dev/search" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

# Display results
if ($result.items.Count -gt 0) {
    Write-Host "✅ SUCCESS! Found $($result.items.Count) items" -ForegroundColor Green
    $result.items | Select-Object -First 3 | ForEach-Object {
        Write-Host "- $($_.title)"
        Write-Host "  Price: `$$($_.price) | $($_.merchant)`n"
    }
} else {
    Write-Host "❌ Still no results. Check logs:" -ForegroundColor Red
    Write-Host "   fly logs -a orben-search-worker" -ForegroundColor Yellow
}
```

---

### Step 4: Check Search Worker Logs

```powershell
fly logs -a orben-search-worker | Select-Object -Last 100

# Look for these patterns:
```

**Good signs (working):**
```
POST /search 200
```

**Bad signs (errors):**
```
[eBay] Search error: Invalid API key
[eBay] Search error: Request failed with status code 403
[eBay] Search error: Application ID is invalid
```

---

## 🆘 Common eBay API Issues

### Issue 1: Sandbox vs Production Keys

**Problem:** Using sandbox key in production

**Solution:**
- eBay has TWO sets of keys: Sandbox (testing) and Production (live)
- The App ID must contain `-PRD-` for production
- Get production keys from: https://developer.ebay.com/my/keys → "Production" tab

---

### Issue 2: API Not Activated

**Problem:** eBay app not approved for production

**Solution:**
1. Go to: https://developer.ebay.com/my/auth
2. Make sure your app status is **"Active"**
3. If it says "Pending", you may need to wait for approval
4. For immediate testing, use **Sandbox keys** and modify the search worker code

---

### Issue 3: Rate Limit Exceeded

**Problem:** Too many requests

**Solution:**
- Free eBay API allows 5,000 calls/day
- Check daily quota at: https://developer.ebay.com/my/api_usage
- Redis caching helps reduce API calls (6-hour cache)

---

### Issue 4: Invalid Request Format

**Problem:** Search worker sending wrong request format to eBay

**Solution:**
Check search worker logs for the exact error message

---

## 🧪 Alternative: Test with RapidAPI Google Search

If eBay isn't working, try Google Shopping via RapidAPI:

### Step 1: Get RapidAPI Key

1. Go to: https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-product-search
2. Click **"Subscribe to Test"**
3. Choose **"Basic"** plan (FREE - 100 searches/month)
4. Copy your **"X-RapidAPI-Key"**

### Step 2: Set on Fly.io

```powershell
fly secrets set RAPIDAPI_KEY="your_rapidapi_key_here" -a orben-search-worker

# Wait for restart
Start-Sleep -Seconds 30
```

### Step 3: Test Google Search

```powershell
$body = @{
    query = "iPhone 15 Pro"
    providers = @("google")  # Use Google instead of eBay
    userId = "test-user"
    limit = 5
} | ConvertTo-Json

$result = Invoke-RestMethod `
    -Uri "https://orben-search-worker.fly.dev/search" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Google search results: $($result.items.Count)"
$result.items | Select-Object -First 3 | ForEach-Object {
    Write-Host "- $($_.title): `$$($_.price)"
}
```

---

## ✅ Expected Working Result

When everything is configured correctly, you should see:

```powershell
✅ SUCCESS! Found 20 items

- Apple iPhone 15 Pro 256GB Natural Titanium (Unlocked)
  Price: $999.99 | eBay

- iPhone 15 Pro Max 512GB - Blue Titanium AT&T
  Price: $1199.00 | eBay

- NEW Apple iPhone 15 128GB All Colors GSM+CDMA Unlocked
  Price: $729.95 | eBay
```

---

## 📊 Debugging Checklist

- [ ] eBay App ID is production key (contains `-PRD-`)
- [ ] eBay App ID is correctly set on Fly.io
- [ ] eBay app status is "Active" (not "Pending")
- [ ] Search worker logs show no API errors
- [ ] Redis is connected (no ECONNRESET errors)
- [ ] Tried multiple different search queries
- [ ] Waited 30 seconds after setting secrets
- [ ] Alternative: RapidAPI key configured for Google search

---

## 🚀 Quick Test Script

Save this as `test-search.ps1`:

```powershell
Write-Host "🔍 Testing Universal Search..." -ForegroundColor Cyan

# Test 1: eBay
Write-Host "`n1️⃣ Testing eBay..." -ForegroundColor Yellow
$ebayBody = @{ query = "MacBook Pro M3"; providers = @("ebay"); userId = "test-$(Get-Random)"; limit = 3 } | ConvertTo-Json
try {
    $ebayResult = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $ebayBody
    if ($ebayResult.items.Count -gt 0) {
        Write-Host "   ✅ eBay working! Found $($ebayResult.items.Count) items" -ForegroundColor Green
    } else {
        Write-Host "   ❌ eBay returned 0 items - check EBAY_APP_ID" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ eBay error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Google (RapidAPI)
Write-Host "`n2️⃣ Testing Google Shopping..." -ForegroundColor Yellow
$googleBody = @{ query = "AirPods Pro"; providers = @("google"); userId = "test-$(Get-Random)"; limit = 3 } | ConvertTo-Json
try {
    $googleResult = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $googleBody
    if ($googleResult.items.Count -gt 0) {
        Write-Host "   ✅ Google working! Found $($googleResult.items.Count) items" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Google returned 0 items - check RAPIDAPI_KEY" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Google error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Tests complete!" -ForegroundColor Green
Write-Host "If both failed, check: fly logs -a orben-search-worker`n" -ForegroundColor Cyan
```

Run it:
```powershell
.\test-search.ps1
```

---

## 📞 Next Steps

1. **Check your eBay API key** - Make sure it's a production key
2. **Update the secret** if needed
3. **Test again** with the script above
4. **Check logs** if still failing: `fly logs -a orben-search-worker`
5. **Share logs** with me if you need help debugging

**Once one provider works, you can enable the frontend and start searching!** 🎯
