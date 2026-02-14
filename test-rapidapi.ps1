# Test RapidAPI Real-Time Product Search
# Usage: .\test-rapidapi.ps1 "your-rapidapi-key-here"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey
)

Write-Host "`n=== Testing RapidAPI Real-Time Product Search ===" -ForegroundColor Cyan
Write-Host "API Key: $($ApiKey.Substring(0, 8))..." -ForegroundColor Gray

$headers = @{
    "X-RapidAPI-Key" = $ApiKey
    "X-RapidAPI-Host" = "real-time-product-search.p.rapidapi.com"
}

$params = @{
    q = "iPhone 15"
    country = "us"
    language = "en"
    limit = 10
}

try {
    Write-Host "`nSending request..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "https://real-time-product-search.p.rapidapi.com/search" `
        -Method GET `
        -Headers $headers `
        -Body $params `
        -TimeoutSec 15

    Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
    Write-Host "Status: $($response.status)"
    Write-Host "Request ID: $($response.request_id)"
    
    if ($response.data) {
        $count = $response.data.Count
        Write-Host "Products found: $count" -ForegroundColor Green
        
        if ($count -gt 0) {
            Write-Host "`nFirst 3 products:" -ForegroundColor Cyan
            for ($i = 0; $i -lt [Math]::Min(3, $count); $i++) {
                $product = $response.data[$i]
                Write-Host "  $($i+1). $($product.product_title)"
                Write-Host "     Price: $($product.offer.price) | Store: $($product.source)"
            }
        }
    } else {
        Write-Host "⚠️  No products returned" -ForegroundColor Yellow
    }

} catch {
    Write-Host "`n❌ FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)"
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "HTTP Status: $statusCode" -ForegroundColor Red
        
        if ($statusCode -eq 403) {
            Write-Host "`n⚠️  403 Forbidden - Possible causes:" -ForegroundColor Yellow
            Write-Host "   1. Invalid API key"
            Write-Host "   2. Not subscribed to Real-Time Product Search API"
            Write-Host "   3. API key doesn't have access to this endpoint"
        } elseif ($statusCode -eq 429) {
            Write-Host "`n⚠️  429 Too Many Requests - You hit the rate limit" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
