# Test SerpAPI Integration
# This script tests that SerpAPI is working correctly

$baseUrl = "https://orben-api.fly.dev"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2hsY3docGFqb3J6YmxlYWJhdmNyLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MmJkYjFhYS1iMmQyLTQwMDEtODBlZi0xMTk2ZTU1NjNjYjkiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzcyODQ4MDI1LCJpYXQiOjE3NzEwMjAyMTUsImVtYWlsIjoiY2FzZXlAYmFyZXJldGFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoiY2FzZXlAYmFyZXJldGFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiODJiZGIxYWEtYjJkMi00MDAxLTgwZWYtMTE5NmU1NTYzY2I5In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NzEwMjAyMTV9XSwic2Vzc2lvbl9pZCI6IjNmMzk3Njg0LWU0NzEtNDU0ZS05OWQyLTZmMDFkNzE0MGZmMCIsImlzX2Fub255bW91cyI6ZmFsc2V9.nfJQI9c9pqVVaKZaLTmFCbR8JrOmqBDbwB76Qj-6nMw"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing SerpAPI Integration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Search with SerpAPI (google provider)
Write-Host "Test 1: Searching for 'nike shoes' with SerpAPI..." -ForegroundColor Yellow
$query1 = "nike shoes"
$encodedQuery = [uri]::EscapeDataString($query1)
$url1 = "${baseUrl}/v1/search?q=${encodedQuery}&country=US&providers=google&limit=10"

try {
    $response1 = Invoke-RestMethod -Uri $url1 -Method Get -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } -TimeoutSec 30
    
    Write-Host "Success: Search successful!" -ForegroundColor Green
    Write-Host "  Total items: $($response1.items.Length)" -ForegroundColor White
    Write-Host "  Providers: $($response1.providers -join ', ')" -ForegroundColor White
    
    if ($response1.items.Length -gt 0) {
        Write-Host "  First item:" -ForegroundColor White
        Write-Host "    - Title: $($response1.items[0].title)" -ForegroundColor Gray
        Write-Host "    - Price: `$$($response1.items[0].price)" -ForegroundColor Gray
        Write-Host "    - Merchant: $($response1.items[0].merchant)" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error: Search failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Search with pagination
Write-Host "Test 2: Testing pagination (page 2)..." -ForegroundColor Yellow
$url2 = "${baseUrl}/v1/search?q=${encodedQuery}&country=US&providers=google&limit=10&page=2"

try {
    $response2 = Invoke-RestMethod -Uri $url2 -Method Get -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } -TimeoutSec 30
    
    Write-Host "Success: Pagination successful!" -ForegroundColor Green
    Write-Host "  Total items: $($response2.items.Length)" -ForegroundColor White
    
    if ($response2.items.Length -gt 0) {
        Write-Host "  First item on page 2:" -ForegroundColor White
        Write-Host "    - Title: $($response2.items[0].title)" -ForegroundColor Gray
        
        # Check if different from page 1
        if ($response1.items[0].title -ne $response2.items[0].title) {
            Write-Host "  Success: Different results from page 1 (good!)" -ForegroundColor Green
        } else {
            Write-Host "  Warning: Same results as page 1 (possible issue)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "Error: Pagination test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SerpAPI Test Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
