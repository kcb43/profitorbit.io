# Fix Orben Deal Sources
# Remove duplicates, test RSS feeds, add missing sources

$SUPABASE_URL = "https://hlcwhpajorzbleabavcr.supabase.co"
$SUPABASE_KEY = "sb_publishable_AmJEyN9K_q2OJAUCGiO3eA_NZYf6rXm"
$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type" = "application/json"
}

Write-Host "=== ORBEN DEAL SOURCES FIX ===" -ForegroundColor Cyan
Write-Host ""

# 1. Get all current sources
Write-Host "1. Fetching current sources..." -ForegroundColor Yellow
$sources = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/deal_sources?select=*" -Headers $headers -Method GET

Write-Host "   Found $($sources.Count) sources" -ForegroundColor Green
Write-Host ""

# 2. Find and remove duplicates
Write-Host "2. Checking for duplicates..." -ForegroundColor Yellow
$grouped = $sources | Group-Object name
$duplicates = $grouped | Where-Object { $_.Count -gt 1 }

if ($duplicates) {
    Write-Host "   Found $($duplicates.Count) duplicate source names:" -ForegroundColor Red
    foreach ($dup in $duplicates) {
        Write-Host "      - $($dup.Name) ($($dup.Count) entries)" -ForegroundColor Red
        
        # Keep the one with last_success_at, delete others
        $toKeep = $dup.Group | Sort-Object @{Expression={if($_.last_success_at){1}else{0}}; Descending=$true} | Select-Object -First 1
        $toDelete = $dup.Group | Where-Object { $_.id -ne $toKeep.id }
        
        foreach ($item in $toDelete) {
            Write-Host "      Deleting duplicate ID: $($item.id)" -ForegroundColor Gray
            try {
                Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/deal_sources?id=eq.$($item.id)" -Headers $headers -Method DELETE | Out-Null
            } catch {
                Write-Host "      ERROR: $_" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "   No duplicates found" -ForegroundColor Green
}
Write-Host ""

# 3. Test RSS feeds
Write-Host "3. Testing RSS feeds..." -ForegroundColor Yellow
$rssSources = $sources | Where-Object { $_.type -eq 'rss' -and $_.rss_url } | Sort-Object -Unique -Property name

foreach ($source in $rssSources) {
    Write-Host "   Testing: $($source.name)" -NoNewline
    try {
        $response = Invoke-WebRequest -Uri $source.rss_url -Method GET -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host " ✓" -ForegroundColor Green
        } else {
            Write-Host " ✗ (Status: $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host " ✗ (Error: $($_.Exception.Message))" -ForegroundColor Red
    }
}
Write-Host ""

# 4. Add missing Reddit sources
Write-Host "4. Adding Reddit sources..." -ForegroundColor Yellow

$redditSources = @(
    @{ name="Reddit - r/buildapcsales"; url="https://www.reddit.com/r/buildapcsales/.rss" },
    @{ name="Reddit - r/frugalmalefashion"; url="https://www.reddit.com/r/frugalmalefashion/.rss" },
    @{ name="Reddit - r/GameDeals"; url="https://www.reddit.com/r/GameDeals/.rss" },
    @{ name="Reddit - r/deals"; url="https://www.reddit.com/r/deals/.rss" },
    @{ name="Reddit - r/consoledeals"; url="https://www.reddit.com/r/consoledeals/.rss" }
)

foreach ($reddit in $redditSources) {
    Write-Host "   Adding: $($reddit.name)" -NoNewline
    
    # Check if exists
    $exists = $sources | Where-Object { $_.name -eq $reddit.name }
    if ($exists) {
        Write-Host " (already exists)" -ForegroundColor Gray
        continue
    }
    
    $body = @{
        name = $reddit.name
        type = "rss"
        base_url = "https://reddit.com"
        rss_url = $reddit.url
        enabled = $true
        poll_interval_minutes = 30
        notes = "Reddit community deals"
    } | ConvertTo-Json
    
    try {
        Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/deal_sources" -Headers $headers -Method POST -Body $body | Out-Null
        Write-Host " ✓" -ForegroundColor Green
    } catch {
        Write-Host " ✗ ($($_.Exception.Message))" -ForegroundColor Red
    }
}
Write-Host ""

# 5. Add Kinja Deals and other missing sources
Write-Host "5. Adding other missing sources..." -ForegroundColor Yellow

$additionalSources = @(
    @{ name="Kinja Deals"; url="https://deals.kinja.com/rss"; base="https://deals.kinja.com" },
    @{ name="The Verge Deals"; url="https://www.theverge.com/rss/deals/index.xml"; base="https://www.theverge.com" },
    @{ name="CNET Deals"; url="https://www.cnet.com/rss/deals/"; base="https://www.cnet.com" },
    @{ name="Wirecutter Deals"; url="https://www.nytimes.com/wirecutter/rss/deals/"; base="https://www.nytimes.com/wirecutter" }
)

foreach ($src in $additionalSources) {
    Write-Host "   Adding: $($src.name)" -NoNewline
    
    $exists = $sources | Where-Object { $_.name -eq $src.name }
    if ($exists) {
        Write-Host " (already exists)" -ForegroundColor Gray
        continue
    }
    
    $body = @{
        name = $src.name
        type = "rss"
        base_url = $src.base
        rss_url = $src.url
        enabled = $true
        poll_interval_minutes = 45
        notes = "Curated tech and lifestyle deals"
    } | ConvertTo-Json
    
    try {
        Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/deal_sources" -Headers $headers -Method POST -Body $body | Out-Null
        Write-Host " ✓" -ForegroundColor Green
    } catch {
        Write-Host " ✗ ($($_.Exception.Message))" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "=== FIX COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Check fly logs: fly logs -a orben-deal-worker" -ForegroundColor White
Write-Host "  2. The worker will pick up new sources on next poll (within 60 seconds)" -ForegroundColor White
Write-Host "  3. Failed sources may need manual RSS URL fixes" -ForegroundColor White

