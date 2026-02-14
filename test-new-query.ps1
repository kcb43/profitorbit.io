# Test with new query to avoid cache
$url = "https://orben-search-worker.fly.dev/search"

$body = @{
    query = "aquarium heater"
    userId = "test-user-456"
    providers = "auto"
    country = "US"
    limit = 20
} | ConvertTo-Json

Write-Host "Testing search with NEW query to bypass cache: aquarium heater" -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 35
    
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 5
    Write-Host ""
    Write-Host "Items found: $($response.items.Count)" -ForegroundColor Cyan
    
    if ($response.items.Count -gt 0) {
        Write-Host ""
        Write-Host "First item:" -ForegroundColor Yellow
        $response.items[0] | ConvertTo-Json -Depth 3
    }
} catch {
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body:" -ForegroundColor Red
        Write-Host $responseBody -ForegroundColor Red
    }
}
