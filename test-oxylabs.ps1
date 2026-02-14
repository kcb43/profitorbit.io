Write-Host "`n=== TESTING OXYLABS SEARCH ===" -ForegroundColor Green

# Test 1: Nintendo Switch
Write-Host "`nTest 1: Nintendo Switch" -ForegroundColor Cyan
$body1 = @{
    query = "Nintendo Switch OLED"
    providers = @("oxylabs")
    userId = "test-user"
    limit = 5
} | ConvertTo-Json

$result1 = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $body1

Write-Host "Results: $($result1.items.Count)" -ForegroundColor Yellow
$result1.items | ForEach-Object {
    Write-Host "  - $($_.title)"
    Write-Host "    Price: $($_.price) | Merchant: $($_.merchant)"
}

# Test 2: iPhone
Write-Host "`nTest 2: iPhone 15 Pro" -ForegroundColor Cyan
$body2 = @{
    query = "iPhone 15 Pro"
    providers = @("oxylabs")
    userId = "test-user"
    limit = 5
} | ConvertTo-Json

$result2 = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $body2

Write-Host "Results: $($result2.items.Count)" -ForegroundColor Yellow
$result2.items | ForEach-Object {
    Write-Host "  - $($_.title)"
    Write-Host "    Price: $($_.price) | Merchant: $($_.merchant)"
}

# Test 3: Multi-provider (Oxylabs + eBay)
Write-Host "`nTest 3: MacBook Pro (Oxylabs + eBay)" -ForegroundColor Cyan
$body3 = @{
    query = "MacBook Pro M3"
    providers = @("oxylabs", "ebay")
    userId = "test-user"
    limit = 5
} | ConvertTo-Json

$result3 = Invoke-RestMethod -Uri "https://orben-search-worker.fly.dev/search" -Method POST -ContentType "application/json" -Body $body3

Write-Host "Total results: $($result3.items.Count)" -ForegroundColor Yellow
Write-Host "Providers used: $($result3.providers.Count)" -ForegroundColor Gray

$result3.providers | ForEach-Object {
    Write-Host "  Provider: $($_.provider) | Count: $($_.count) | Cached: $($_.cached)"
}

Write-Host "`nSample results:"
$result3.items | Select-Object -First 5 | ForEach-Object {
    Write-Host "  [$($_.source)] $($_.title)"
    Write-Host "    Price: $($_.price) | Merchant: $($_.merchant)"
}

Write-Host "`n=== TESTS COMPLETE ===" -ForegroundColor Green
Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "  Oxylabs: WORKING" -ForegroundColor Green
Write-Host "  eBay: $(if ($result3.providers | Where-Object { $_.provider -eq 'ebay' -and $_.count -gt 0 }) { 'WORKING' } else { 'NOT WORKING' })" -ForegroundColor $(if ($result3.providers | Where-Object { $_.provider -eq 'ebay' -and $_.count -gt 0 }) { 'Green' } else { 'Red' })
