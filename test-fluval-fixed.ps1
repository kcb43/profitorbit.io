# Test fluval search after cache flush
$url = "https://orben-search-worker.fly.dev/search"

$body = @{
    query = "fluval"
    userId = "test-user-123"
    providers = @("auto")
    country = "US"
    limit = 20
} | ConvertTo-Json

Write-Host "Testing fluval search after cache flush..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 35
    
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Items found: $($response.items.Count)" -ForegroundColor Cyan
    Write-Host "Providers: $($response.providers | ConvertTo-Json)" -ForegroundColor Yellow
    
    if ($response.items.Count -gt 0) {
        Write-Host ""
        Write-Host "First 3 items:" -ForegroundColor Yellow
        $response.items[0..2] | ForEach-Object {
            Write-Host "  - $($_.title) - `$$($_.price)" -ForegroundColor White
        }
    }
} catch {
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
