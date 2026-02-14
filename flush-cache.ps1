# Flush bad cache entries
$url = "https://orben-search-worker.fly.dev/admin/flush-cache"

$body = @{
    queries = @("fluval", "petco", "fluval test")
} | ConvertTo-Json

Write-Host "Flushing cache for bad entries..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
    
    Write-Host "SUCCESS!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
