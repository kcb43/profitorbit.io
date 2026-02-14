# Test Script for Provider Selection

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "COMPREHENSIVE SEARCH PROVIDER TEST" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

# Test 1: eBay with correct credentials
Write-Host "Test 1: eBay with NEW credentials..." -ForegroundColor Cyan
$body1 = @{
    query = "Nintendo Switch OLED"
    userId = "test-ebay"
    providers = "ebay"
    limit = 10
} | ConvertTo-Json

try {
    $result1 = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $body1
    Write-Host "  Status: SUCCESS" -ForegroundColor Green
    Write-Host "  Items: $($result1.items.Count)" -ForegroundColor Yellow
    if ($result1.items.Count -gt 0) {
        Write-Host "  Sample:" -ForegroundColor Gray
        $result1.items | Select-Object -First 2 | ForEach-Object {
            Write-Host "    • $($_.title)" -ForegroundColor White
            Write-Host "      Price: `$$($_.price)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  Status: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# Test 2: Oxylabs only (manual mode)
Write-Host "Test 2: Oxylabs ONLY (manual selection)..." -ForegroundColor Cyan
$body2 = @{
    query = "Sony PlayStation 5 console"
    userId = "test-oxylabs"
    providers = "oxylabs"
    limit = 15
} | ConvertTo-Json

try {
    $result2 = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $body2
    Write-Host "  Status: SUCCESS" -ForegroundColor Green
    Write-Host "  Items: $($result2.items.Count)" -ForegroundColor Yellow
    Write-Host "  Providers used: $($result2.providers.provider -join ', ')" -ForegroundColor Gray
    if ($result2.items.Count -gt 0) {
        Write-Host "  Sample:" -ForegroundColor Gray
        $result2.items | Select-Object -First 3 | ForEach-Object {
            Write-Host "    • $($_.title)" -ForegroundColor White
        }
    }
} catch {
    Write-Host "  Status: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# Test 3: Both providers (manual mode)
Write-Host "Test 3: BOTH providers (manual selection)..." -ForegroundColor Cyan
$body3 = @{
    query = "Apple AirPods Pro 2"
    userId = "test-both"
    providers = "ebay,oxylabs"
    limit = 20
} | ConvertTo-Json

try {
    $result3 = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $body3
    Write-Host "  Status: SUCCESS" -ForegroundColor Green
    Write-Host "  Items: $($result3.items.Count)" -ForegroundColor Yellow
    Write-Host "  Providers used: $($result3.providers.provider -join ', ')" -ForegroundColor Gray
    
    # Group by source
    $ebayCount = ($result3.items | Where-Object { $_.source -eq 'ebay' }).Count
    $oxylabsCount = ($result3.items | Where-Object { $_.source -eq 'oxylabs' }).Count
    Write-Host "    eBay: $ebayCount items" -ForegroundColor Yellow
    Write-Host "    Oxylabs: $oxylabsCount items" -ForegroundColor Yellow
} catch {
    Write-Host "  Status: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# Test 4: Auto mode (smart routing)
Write-Host "Test 4: AUTO mode (smart routing)..." -ForegroundColor Cyan
$body4 = @{
    query = "MacBook Pro M3 laptop"
    userId = "test-auto"
    providers = "auto"
    limit = 20
} | ConvertTo-Json

try {
    $result4 = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $body4
    Write-Host "  Status: SUCCESS" -ForegroundColor Green
    Write-Host "  Items: $($result4.items.Count)" -ForegroundColor Yellow
    Write-Host "  Smart Routing: $($result4.smartRouting)" -ForegroundColor Magenta
    Write-Host "  Auto-selected providers: $($result4.providers.provider -join ', ')" -ForegroundColor Gray
} catch {
    Write-Host "  Status: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "TEST COMPLETE" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
