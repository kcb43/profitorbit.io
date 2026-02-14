Write-Host "`n=== TESTING FIXED SEARCH SYSTEM ===`n" -ForegroundColor Green

# Test 1: eBay (regular product - free)
Write-Host "Test 1: Regular Search (eBay only)" -ForegroundColor Cyan
$body1 = @{
    query = "Nintendo Switch games"
    providers = @("ebay")
    userId = "test-user"
    limit = 5
} | ConvertTo-Json

$result1 = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $body1

Write-Host "Results: $($result1.items.Count)" -ForegroundColor $(if ($result1.items.Count -gt 0) { "Green" } else { "Red" })
Write-Host "Providers: $($result1.providers | ConvertTo-Json -Compress)" -ForegroundColor Gray

if ($result1.items.Count -gt 0) {
    $result1.items | Select-Object -First 3 | ForEach-Object {
        Write-Host "  [$($_.source)] $($_.title)"
        Write-Host "    Price: `$$($_.price) | Condition: $($_.condition)"
    }
}

# Test 2: High-value product (Smart routing: eBay + Oxylabs)
Write-Host "`nTest 2: High-Value Search (Smart Routing)" -ForegroundColor Cyan
$body2 = @{
    query = "iPhone 15 Pro Max"
    userId = "test-user"
    limit = 8
} | ConvertTo-Json

$result2 = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $body2

Write-Host "Results: $($result2.items.Count)" -ForegroundColor $(if ($result2.items.Count -gt 0) { "Green" } else { "Yellow" })
Write-Host "Smart Routing: $($result2.smartRouting)" -ForegroundColor Gray
Write-Host "Providers used:" -ForegroundColor Gray

$result2.providers | ForEach-Object {
    $color = if ($_.count -gt 0) { "Green" } else { "Red" }
    Write-Host "  [$($_.provider)] Count: $($_.count) | Cached: $($_.cached)" -ForegroundColor $color
}

if ($result2.items.Count -gt 0) {
    Write-Host "`nSample results:"
    $result2.items | Select-Object -First 5 | ForEach-Object {
        Write-Host "  [$($_.source)] $($_.title)"
        if ($_.price) {
            Write-Host "    `$$($_.price) - $($_.merchant)"
        }
    }
}

# Test 3: Explicit multi-provider
Write-Host "`nTest 3: Multi-Provider (eBay + Oxylabs)" -ForegroundColor Cyan
$body3 = @{
    query = "MacBook Pro M3"
    providers = @("ebay", "oxylabs")
    userId = "test-user"
    limit = 10
} | ConvertTo-Json

$result3 = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $body3

Write-Host "Total results: $($result3.items.Count)" -ForegroundColor Yellow
Write-Host "Providers:" -ForegroundColor Gray

$result3.providers | ForEach-Object {
    Write-Host "  [$($_.provider)] $($_.count) results $(if ($_.cached) { '(cached)' } else { '(fresh)' })"
}

Write-Host "`n=== TESTS COMPLETE ===`n" -ForegroundColor Green

Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  eBay: $(if ($result1.items.Count -gt 0) { 'WORKING ✅' } else { 'Check logs ⚠️' })"
Write-Host "  Oxylabs: $(if ($result2.providers | Where-Object { $_.provider -eq 'oxylabs' -and $_.count -gt 0 }) { 'WORKING ✅' } else { 'Needs fix ⚠️' })"
Write-Host "  Smart Routing: $(if ($result2.smartRouting) { 'ENABLED ✅' } else { 'DISABLED' })"
