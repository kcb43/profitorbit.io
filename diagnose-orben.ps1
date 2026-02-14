# Diagnose orben-api issues after security fixes
# 1. Test deal feed endpoint
# 2. Test product search speed

$ErrorActionPreference = 'Continue'

Write-Host "[START] Testing orben-api after security changes..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Deal Feed
Write-Host "[TEST 1] Deal Feed Endpoint" -ForegroundColor Yellow
Write-Host "-------------------------------"
$stopwatch1 = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $response1 = Invoke-WebRequest -Uri 'https://orben-api.fly.dev/v1/deals/feed?min_score=0&limit=5&offset=0' -Method GET -ErrorAction Stop
    $stopwatch1.Stop()
    
    $data1 = $response1.Content | ConvertFrom-Json
    
    Write-Host "[OK] Status: $($response1.StatusCode)" -ForegroundColor Green
    Write-Host "[OK] Time: $($stopwatch1.ElapsedMilliseconds)ms" -ForegroundColor Green
    Write-Host "[OK] Deals returned: $($data1.items.Count)" -ForegroundColor Green
    
    if ($data1.items.Count -gt 0) {
        Write-Host "[OK] First deal: $($data1.items[0].title)" -ForegroundColor Green
    }
} catch {
    $stopwatch1.Stop()
    Write-Host "[FAILED] after $($stopwatch1.ElapsedMilliseconds)ms" -ForegroundColor Red
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[STATUS] $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# Test 2: Product Search Speed
Write-Host "[TEST 2] Product Search Speed (fluval, 10 items)" -ForegroundColor Yellow
Write-Host "---------------------------------------------------"
$stopwatch2 = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $response2 = Invoke-WebRequest -Uri 'https://orben-api.fly.dev/v1/search?q=fluval&providers=auto&country=US&limit=10&cache_version=v6_limit_in_cache_key' -Method GET -ErrorAction Stop
    $stopwatch2.Stop()
    
    $data2 = $response2.Content | ConvertFrom-Json
    
    $timeInSeconds = [math]::Round($stopwatch2.ElapsedMilliseconds / 1000, 1)
    
    Write-Host "[OK] Status: $($response2.StatusCode)" -ForegroundColor Green
    Write-Host "[OK] Time: $($stopwatch2.ElapsedMilliseconds)ms ($timeInSeconds seconds)" -ForegroundColor Green
    Write-Host "[OK] Items returned: $($data2.items.Count)" -ForegroundColor Green
    Write-Host "[OK] Providers: $($data2.providers.provider -join ', ')" -ForegroundColor Green
    Write-Host "[OK] Cached: $($data2.providers[0].cached)" -ForegroundColor Green
    
    if ($data2.items.Count -gt 0) {
        Write-Host "[OK] First item: $($data2.items[0].title)" -ForegroundColor Green
    }
    
    # Performance check
    if ($stopwatch2.ElapsedMilliseconds -gt 10000) {
        Write-Host "[WARNING] Search took over 10 seconds!" -ForegroundColor Yellow
    }
} catch {
    $stopwatch2.Stop()
    Write-Host "[FAILED] after $($stopwatch2.ElapsedMilliseconds)ms" -ForegroundColor Red
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "[DONE] Diagnostics complete!" -ForegroundColor Cyan
