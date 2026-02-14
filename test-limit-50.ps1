# Test with limit=50 to see what RapidAPI returns
$url = "https://orben-search-worker.fly.dev/search"

$body = @{
    query = "fluval"
    userId = "test-user-999"
    providers = @("auto")
    country = "US"
    limit = 50
} | ConvertTo-Json

Write-Host "Testing fluval with limit=50..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 35
    
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Items found: $($response.items.Count)" -ForegroundColor Cyan
    Write-Host "Providers: $($response.providers | ConvertTo-Json)" -ForegroundColor Yellow
    
    if ($response.items.Count -gt 0) {
        Write-Host ""
        Write-Host "Showing first 5 items:" -ForegroundColor Yellow
        $response.items[0..4] | ForEach-Object {
            Write-Host "  - $($_.title) - `$$($_.price)" -ForegroundColor White
        }
        Write-Host ""
        Write-Host "Total items returned: $($response.items.Count)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Now checking Fly.io logs for DEBUG-G message..." -ForegroundColor Yellow
