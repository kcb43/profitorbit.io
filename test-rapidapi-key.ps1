# Test RapidAPI Key - Product Search
# Usage: .\test-rapidapi-key.ps1 "your-rapidapi-key-here"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey
)

Write-Host "`n=== Testing RapidAPI Real-Time Product Search ===" -ForegroundColor Cyan
Write-Host "API: Real-Time Product Search v2" -ForegroundColor White
Write-Host "Test Query: 'Fluval'" -ForegroundColor White
Write-Host ""

$headers = @{
    "X-RapidAPI-Key" = $ApiKey
    "X-RapidAPI-Host" = "real-time-product-search.p.rapidapi.com"
}

try {
    Write-Host "📡 Sending request..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri "https://real-time-product-search.p.rapidapi.com/search-v2?q=Fluval&country=us&limit=10" `
        -Headers $headers `
        -Method GET `
        -TimeoutSec 15
    
    $products = $response.data.products
    
    if ($products.Count -gt 0) {
        Write-Host "✅ SUCCESS! Found $($products.Count) products" -ForegroundColor Green
        Write-Host ""
        Write-Host "First 3 products:" -ForegroundColor Cyan
        
        $products | Select-Object -First 3 | ForEach-Object {
            Write-Host "  • $($_.product_title)" -ForegroundColor White
            Write-Host "    Price: $($_.offer.price) | Merchant: $($_.offer.store_name)" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "🎉 Your RapidAPI key is VALID and working!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next step: Set this key in your search worker:" -ForegroundColor Yellow
        Write-Host "  fly secrets set RAPIDAPI_KEY=`"$ApiKey`" -a orben-search-worker" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️ Warning: API responded but returned 0 products" -ForegroundColor Yellow
        Write-Host "Response:" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 3
    }
    
} catch {
    Write-Host "❌ ERROR: Failed to connect to RapidAPI" -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
        
        if ($statusCode -eq 403) {
            Write-Host ""
            Write-Host "This usually means:" -ForegroundColor Yellow
            Write-Host "  1. Your API key is invalid or expired" -ForegroundColor White
            Write-Host "  2. You haven't subscribed to the API" -ForegroundColor White
            Write-Host "  3. You've exceeded your monthly quota (100 free)" -ForegroundColor White
            Write-Host ""
            Write-Host "Fix: Go to https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-product-search" -ForegroundColor Cyan
            Write-Host "     Click 'Subscribe to Test' and get a fresh API key" -ForegroundColor Cyan
        } elseif ($statusCode -eq 429) {
            Write-Host ""
            Write-Host "You've exceeded your monthly quota (100 requests on free tier)" -ForegroundColor Yellow
            Write-Host "Either wait until next month or upgrade to paid plan ($10/mo)" -ForegroundColor White
        }
    } else {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
