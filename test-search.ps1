Write-Host "🔍 Testing Universal Search..." -ForegroundColor Cyan

# Test 1: eBay
Write-Host "`n1️⃣ Testing eBay..." -ForegroundColor Yellow
$ebayBody = @{ query = "MacBook Pro M3"; providers = @("ebay"); userId = "test-$(Get-Random)"; limit = 3 } | ConvertTo-Json
try {
    $ebayResult = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $ebayBody
    if ($ebayResult.items.Count -gt 0) {
        Write-Host "   ✅ eBay working! Found $($ebayResult.items.Count) items" -ForegroundColor Green
        $ebayResult.items | Select-Object -First 2 | ForEach-Object {
            Write-Host "   - $($_.title.Substring(0, [Math]::Min(60, $_.title.Length)))..." -ForegroundColor White
            Write-Host "     `$$($_.price)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ❌ eBay returned 0 items - check EBAY_APP_ID" -ForegroundColor Red
        Write-Host "   Provider response: $($ebayResult.providers | ConvertTo-Json -Compress)" -ForegroundColor Gray
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
        $googleResult.items | Select-Object -First 2 | ForEach-Object {
            Write-Host "   - $($_.title.Substring(0, [Math]::Min(60, $_.title.Length)))..." -ForegroundColor White
            Write-Host "     `$$($_.price)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️ Google returned 0 items - check RAPIDAPI_KEY" -ForegroundColor Yellow
        Write-Host "   Provider response: $($googleResult.providers | ConvertTo-Json -Compress)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Google error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "- If both failed: Check fly logs -a orben-search-worker" -ForegroundColor White
Write-Host "- If eBay failed: Verify EBAY_APP_ID is a production key (-PRD-)" -ForegroundColor White
Write-Host "- If Google failed: Verify RAPIDAPI_KEY is set and valid" -ForegroundColor White
Write-Host "`n✅ Once working, frontend search will work automatically!" -ForegroundColor Green
