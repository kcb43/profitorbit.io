$apiKey = "82dd3ac77bc4b29fa1e4ab5c0de276b274f1ec5d3a9eef0cb9e1e9768b582f7e"

Write-Host "Testing SerpAPI Account Info..." -ForegroundColor Cyan
$accountResponse = Invoke-RestMethod -Uri "https://serpapi.com/account?api_key=$apiKey" -Method Get
Write-Host "Account Info:" -ForegroundColor Green
$accountResponse | ConvertTo-Json -Depth 5

Write-Host "`nTesting SerpAPI Search..." -ForegroundColor Cyan
try {
    $searchResponse = Invoke-RestMethod -Uri "https://serpapi.com/search?engine=google_shopping&q=test&api_key=$apiKey" -Method Get
    Write-Host "Search successful!" -ForegroundColor Green
    $searchResponse | ConvertTo-Json -Depth 2
} catch {
    Write-Host "Search failed with error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Error details:" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}
