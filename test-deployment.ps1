# Orben Deployment Test Script
# Run this after fixing Redis to verify everything works

Write-Host "🔍 Testing Orben Deployment..." -ForegroundColor Cyan
Write-Host ""

# Test 1: API Health
Write-Host "1️⃣ Testing API Health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "https://orben-api.fly.dev/v1/health" -ErrorAction Stop
    if ($health.ok) {
        Write-Host "   ✅ API is healthy" -ForegroundColor Green
    } else {
        Write-Host "   ❌ API returned unexpected response" -ForegroundColor Red
        Write-Host "   Response: $($health | ConvertTo-Json)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ API health check failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""

# Test 2: Search Worker
Write-Host "2️⃣ Testing Search Worker..." -ForegroundColor Yellow
try {
    $body = @{
        query = "iPhone"
        providers = @("ebay")
        userId = "test-user"
        limit = 5
    } | ConvertTo-Json

    $searchResult = Invoke-RestMethod `
        -Uri "https://orben-search-worker.fly.dev/search" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop

    if ($searchResult.results) {
        Write-Host "   ✅ Search worker responding" -ForegroundColor Green
        Write-Host "   Found $($searchResult.results.Count) results" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️ Search returned no results" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Search worker failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""

# Test 3: Deals API
Write-Host "3️⃣ Testing Deals API..." -ForegroundColor Yellow
try {
    $deals = Invoke-RestMethod -Uri "https://orben-api.fly.dev/v1/deals/feed?limit=5" -ErrorAction Stop
    
    if ($deals.total -eq 0) {
        Write-Host "   ℹ️  No deals yet (this is normal for first 30-60 minutes)" -ForegroundColor Cyan
    } else {
        Write-Host "   ✅ Found $($deals.total) deals in database" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Deals API failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""

# Test 4: Check Worker Logs
Write-Host "4️⃣ Checking Worker Logs..." -ForegroundColor Yellow
Write-Host "   Opening deal worker logs..." -ForegroundColor Gray
Write-Host ""

fly logs -a orben-deal-worker | Select-Object -Last 30

Write-Host ""
Write-Host "🔍 Log Check - Look for:" -ForegroundColor Cyan
Write-Host "   ✅ 'Redis connected successfully'" -ForegroundColor Gray
Write-Host "   ✅ 'Supabase connection verified'" -ForegroundColor Gray
Write-Host "   ✅ 'Polling X sources...'" -ForegroundColor Gray
Write-Host "   ❌ NO 'ECONNRESET' or Redis errors" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Tests Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. If you see Redis errors above, follow: FIX_REDIS.md" -ForegroundColor White
Write-Host "2. Wait 30-60 minutes for first deals to appear" -ForegroundColor White
Write-Host "3. Re-run this script to check for deals" -ForegroundColor White
Write-Host ""
Write-Host "📊 Monitor with: fly logs -a orben-deal-worker" -ForegroundColor Yellow
