# Test Oxylabs API - Simple Version

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
    source = "google_search"
    query = "iPhone 15"
    domain = "com"
    parse = $true
} | ConvertTo-Json

Write-Host "Testing Oxylabs API..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "https://realtime.oxylabs.io/v1/queries" -Method POST -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host "Status: OK" -ForegroundColor Green
    Write-Host "Job Status: $($response.job.status)"
    
    if ($response.results) {
        Write-Host "Results: $($response.results.Count)"
        $content = $response.results[0].content
        if ($content.results.shopping) {
            Write-Host "Shopping Results: $($content.results.shopping.Count)" -ForegroundColor Green
            $first = $content.results.shopping[0]
            Write-Host "`nFirst Result:"
            Write-Host "  Title: $($first.title)"
            Write-Host "  Price: $($first.price)"
        } else {
            Write-Host "No shopping results" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
