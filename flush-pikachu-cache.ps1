$body = @{
    queries = @("pikachu plush")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://orben-api.fly.dev/v1/admin/flush-cache" -Method POST -Body $body -ContentType "application/json"

Write-Host "Cache flush result:"
$response | ConvertTo-Json -Depth 10
