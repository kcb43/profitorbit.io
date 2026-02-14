# Direct Oxylabs Test (bypassing our worker)

Write-Host "`n=== TESTING OXYLABS DIRECTLY ===" -ForegroundColor Green

# Test 1: Amazon Product (as shown in their example)
Write-Host "`nTest 1: Amazon Product Lookup" -ForegroundColor Cyan

$amazonBody = @{
    source = "amazon_product"
    query = "B07FZ8S74R"
    geo_location = "90210"
    parse = $true
} | ConvertTo-Json

try {
    $amazonResult = Invoke-RestMethod `
        -Uri "https://realtime.oxylabs.io/v1/queries" `
        -Method POST `
        -Headers @{ "Content-Type" = "application/json" } `
        -Credential (New-Object System.Management.Automation.PSCredential("orben_CWkEg", (ConvertTo-SecureString "y5J24L+fcLORKC1O" -AsPlainText -Force))) `
        -Body $amazonBody

    Write-Host "✅ Amazon test successful!" -ForegroundColor Green
    Write-Host "Job ID: $($amazonResult.job_id)" -ForegroundColor Gray
    if ($amazonResult.results) {
        $product = $amazonResult.results[0].content
        Write-Host "Product: $($product.title)" -ForegroundColor White
        Write-Host "Price: $($product.price)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Amazon test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Google Shopping Search
Write-Host "`nTest 2: Google Shopping Search" -ForegroundColor Cyan

$googleBody = @{
    source = "google_shopping_search"
    query = "iPhone 15 Pro"
    domain = "com"
    geo_location = "United States"
    parse = $true
} | ConvertTo-Json

try {
    $googleResult = Invoke-RestMethod `
        -Uri "https://realtime.oxylabs.io/v1/queries" `
        -Method POST `
        -Headers @{ "Content-Type" = "application/json" } `
        -Credential (New-Object System.Management.Automation.PSCredential("orben_CWkEg", (ConvertTo-SecureString "y5J24L+fcLORKC1O" -AsPlainText -Force))) `
        -Body $googleBody

    Write-Host "✅ Google Shopping test successful!" -ForegroundColor Green
    Write-Host "Job ID: $($googleResult.job_id)" -ForegroundColor Gray
    
    if ($googleResult.results -and $googleResult.results[0].content.results.organic) {
        $products = $googleResult.results[0].content.results.organic
        Write-Host "Found $($products.Count) products:`n" -ForegroundColor Yellow
        
        $products | Select-Object -First 5 | ForEach-Object {
            Write-Host "  - $($_.title)"
            Write-Host "    Price: $($_.price_str) | Merchant: $($_.merchant.name)"
        }
    }
} catch {
    Write-Host "❌ Google Shopping test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Response)" -ForegroundColor Gray
}

# Test 3: Check Account Balance
Write-Host "`nTest 3: Check Account Usage" -ForegroundColor Cyan

try {
    # Note: Oxylabs doesn't have a direct balance API in free trial
    # But we can see if requests are working
    Write-Host "✅ If tests above worked, your account is active!" -ForegroundColor Green
} catch {
    Write-Host "Check your dashboard at: https://dashboard.oxylabs.io/" -ForegroundColor Yellow
}

Write-Host "`n=== DIRECT TESTS COMPLETE ===" -ForegroundColor Green
