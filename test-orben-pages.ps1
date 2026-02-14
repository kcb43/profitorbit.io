# Test Orben Pages - Quick Status Check

Write-Host "=== ORBEN PAGES STATUS CHECK ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Deals Feed (No Auth Required)
Write-Host "1. Testing Deals Feed..." -NoNewline
try {
    $response = Invoke-RestMethod -Uri "https://orben-api.fly.dev/v1/deals/feed?limit=5" -Method GET -ErrorAction Stop
    if ($response.items.Count -gt 0) {
        Write-Host " ✓ Working ($($response.items.Count) deals)" -ForegroundColor Green
    } else {
        Write-Host " ⚠️ Working but empty" -ForegroundColor Yellow
    }
} catch {
    Write-Host " ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Product Search (Requires Auth Token)
Write-Host "2. Testing Product Search..." -NoNewline
Write-Host " Requires login (skipping direct test)" -ForegroundColor Gray

# Test 3: Check Vercel Deployment
Write-Host "3. Checking Vercel deployment..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "https://profitorbit.io/deals" -Method GET -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host " ✓ Page accessible" -ForegroundColor Green
    }
} catch {
    Write-Host " ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== AUTHENTICATION STATUS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "The 401 error you're seeing is from /api/profile, NOT the Orben pages." -ForegroundColor Yellow
Write-Host "This is likely a separate API call from your main app layout." -ForegroundColor Yellow
Write-Host ""
Write-Host "To test Product Search:" -ForegroundColor White
Write-Host "  1. Make sure you're logged into Profit Orbit" -ForegroundColor White
Write-Host "  2. Go to /product-search" -ForegroundColor White
Write-Host "  3. Enter a query (e.g., 'iPhone')" -ForegroundColor White
Write-Host "  4. Click Search" -ForegroundColor White
Write-Host ""
Write-Host "If you see 'Please log in to search', then:" -ForegroundColor Yellow
Write-Host "  - Check if Supabase session is valid" -ForegroundColor White
Write-Host "  - Try logging out and back in" -ForegroundColor White
Write-Host "  - Check browser console for auth errors" -ForegroundColor White
