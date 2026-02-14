# Flush cache to allow 50-item refetch
$url = "https://orben-search-worker.fly.dev/admin/flush-cache"

$body = @{
    queries = @("fluval", "iphone 14")
} | ConvertTo-Json

Write-Host "Flushing cache to allow 50-item fetch..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
    
    Write-Host "SUCCESS! Cache flushed:" -ForegroundColor Green
    $response.flushed | ForEach-Object {
        Write-Host "  - $($_.query): $(if ($_.deleted) {'✅ Deleted'} else {'❌ Not found'})" -ForegroundColor $(if ($_.deleted) {'Green'} else {'Yellow'})
    }
} catch {
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
