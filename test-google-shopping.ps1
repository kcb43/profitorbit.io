# Test Oxylabs Google Shopping API

$username = "orben_CWkEg"
$password = "y5J24L+fcLORKC1O"
$pair = "${username}:${password}"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$base64 = [System.Convert]::ToBase64String($bytes)

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Basic $base64"
}

$body = @{
    source = "google_shopping_search"
    query = "iPhone 15"
    domain = "com"
    parse = $true
    context = @(
        @{
            key = "results_language"
            value = "en"
        }
    )
} | ConvertTo-Json -Depth 5

Write-Host "Testing Oxylabs Google Shopping API..." -ForegroundColor Cyan

$response = Invoke-RestMethod -Uri "https://realtime.oxylabs.io/v1/queries" -Method POST -Headers $headers -Body $body

Write-Host "Job Status: $($response.job.status)" -ForegroundColor Green
$content = $response.results[0].content
$organic = $content.results.organic

Write-Host "Shopping Results: $($organic.Count)" -ForegroundColor Green
Write-Host "`nFirst 5 Results:" -ForegroundColor Cyan

for ($i = 0; $i -lt [Math]::Min(5, $organic.Count); $i++) {
    $item = $organic[$i]
    Write-Host "`n$($i + 1). $($item.title)"
    Write-Host "   Price: $($item.price_str)"
    Write-Host "   Merchant: $($item.merchant.name)"
    Write-Host "   URL: $($item.url.substring(0, 60))..."
}
