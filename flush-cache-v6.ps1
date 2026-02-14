# Flush cache for testing - clears both v5 and v6 cache keys

$queries = @("fluval", "iphone 14")

$body = @{
    queries = $queries
} | ConvertTo-Json

Write-Host "`n=== Flushing cache for v6 testing ===" -ForegroundColor Cyan
Write-Host "Queries: $($queries -join ', ')" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri 'https://orben-search-worker.fly.dev/admin/flush-cache' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 10
    
    Write-Host "`n✓ Cache flush successful!" -ForegroundColor Green
    Write-Host "`nFlushed entries:" -ForegroundColor Cyan
    foreach ($entry in $response.flushed) {
        if ($entry.deleted) {
            Write-Host "  ✓ $($entry.query) (limit: $($entry.limit))" -ForegroundColor Green
        }
    }
    
    $totalFlushed = ($response.flushed | Where-Object { $_.deleted }).Count
    Write-Host "`nTotal cache entries cleared: $totalFlushed" -ForegroundColor Yellow
    
}
catch {
    Write-Host "`n✗ Cache flush failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
