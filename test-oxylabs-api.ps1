# Test Oxylabs API - PowerShell Version

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
    context = @(
        @{
            key = "results_language"
            value = "en"
        }
    )
} | ConvertTo-Json -Depth 5

Write-Host "Testing Oxylabs API..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "https://realtime.oxylabs.io/v1/queries" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "✓ API Response Received" -ForegroundColor Green
    Write-Host ""
    
    # Check job status
    if ($response.job.status) {
        Write-Host "Job Status: $($response.job.status)" -ForegroundColor $(if($response.job.status -eq 'done'){'Green'}else{'Yellow'})
    }
    
    # Check for results
    if ($response.results) {
        Write-Host "Results Count: $($response.results.Count)" -ForegroundColor Green
        
        # Check for shopping results
        $content = $response.results[0].content
        if ($content.results.organic) {
            Write-Host "Organic Results: $($content.results.organic.Count)" -ForegroundColor Green
        }
        if ($content.results.shopping) {
            Write-Host "Shopping Results: $($content.results.shopping.Count)" -ForegroundColor Green
            Write-Host ""
            Write-Host "First Shopping Result:" -ForegroundColor Cyan
            $first = $content.results.shopping[0]
            Write-Host "  Title: $($first.title)"
            Write-Host "  Price: $($first.price)"
            Write-Host "  Merchant: $($first.merchant.name)"
        }
    } else {
        Write-Host "⚠ No results returned" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Full Response:" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 5
    }
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:" -ForegroundColor Gray
        Write-Host $responseBody
    }
}

