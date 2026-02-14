# Test progressive loading: 20 items fast, then 50 items when scrolling
# This simulates the frontend behavior

Write-Host "`n=== Test 1: Initial search (should return 20 items in ~6-8 seconds) ===" -ForegroundColor Cyan

$body = @{
    q = "fluval"
    providers = "auto"
    country = "US"
    limit = "20"
    cache_version = "v5_rapidapi_configured"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6IlZ0UDFta0lqd2M4TmRDMlAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3BibW1manZrbXNweWl6YXFxdHBjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0ZTYwNTFlZC1mZDVkLTQzMjItOWJhMy1iNWYxNGFhMzk3YTAiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzM5NTc0MDg3LCJpYXQiOjE3Mzk1NzA0ODcsImVtYWlsIjoiY2FzZXlAdGhlYm90dG9tbGluZS5jbyIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJjYXNleUB0aGVib3R0b21saW5lLmNvIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjRlNjA1MWVkLWZkNWQtNDMyMi05YmEzLWI1ZjE0YWEzOTdhMCJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6Im90cCIsInRpbWVzdGFtcCI6MTczOTU3MDQ4N31dLCJzZXNzaW9uX2lkIjoiNGNlNWYxYmYtNTZhNy00ZmU2LWI5ODMtZWFhMzk0YTMxMDU0IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.1FKA4MgJd0xkNm1Y5VxDtbC9eVIDYNHr0HvO7K2iNlg"
    "Content-Type" = "application/json"
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $response = Invoke-RestMethod -Uri "https://orben-api.fly.dev/v1/search?q=fluval&providers=auto&country=US&limit=20&cache_version=v5_rapidapi_configured" -Method Get -Headers $headers -TimeoutSec 30
    $stopwatch.Stop()
    
    Write-Host "✓ Request completed in $($stopwatch.Elapsed.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Green
    Write-Host "  Items returned: $($response.items.Count)" -ForegroundColor Yellow
    Write-Host "  First 3 titles:" -ForegroundColor Cyan
    $response.items[0..2] | ForEach-Object { Write-Host "    - $($_.title)" -ForegroundColor White }
    
} catch {
    $stopwatch.Stop()
    Write-Host "✗ Request failed after $($stopwatch.Elapsed.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host "`n=== Test 2: Load more (should return 50 items in ~15-20 seconds) ===" -ForegroundColor Cyan

$stopwatch2 = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $response2 = Invoke-RestMethod -Uri "https://orben-api.fly.dev/v1/search?q=fluval&providers=auto&country=US&limit=50&cache_version=v5_rapidapi_configured" -Method Get -Headers $headers -TimeoutSec 40
    $stopwatch2.Stop()
    
    Write-Host "✓ Request completed in $($stopwatch2.Elapsed.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Green
    Write-Host "  Items returned: $($response2.items.Count)" -ForegroundColor Yellow
    Write-Host "  First 3 titles:" -ForegroundColor Cyan
    $response2.items[0..2] | ForEach-Object { Write-Host "    - $($_.title)" -ForegroundColor White }
    
} catch {
    $stopwatch2.Stop()
    Write-Host "✗ Request failed after $($stopwatch2.Elapsed.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Initial load (20 items): $($stopwatch.Elapsed.TotalSeconds.ToString('F2'))s" -ForegroundColor Yellow
Write-Host "Full load (50 items): $($stopwatch2.Elapsed.TotalSeconds.ToString('F2'))s" -ForegroundColor Yellow
Write-Host "Time saved: $([Math]::Round($stopwatch2.Elapsed.TotalSeconds - $stopwatch.Elapsed.TotalSeconds, 2))s faster!" -ForegroundColor Green
