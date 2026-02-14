# Fix Orben Deal Sources - Add Reddit and missing sources

$SUPABASE_URL = "https://hlcwhpajorzbleabavcr.supabase.co"
$SUPABASE_KEY = "sb_publishable_AmJEyN9K_q2OJAUCGiO3eA_NZYf6rXm"
$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type" = "application/json"
    "Prefer" = "return=minimal"
}

Write-Host "=== Adding Missing Deal Sources ===" -ForegroundColor Cyan

# Reddit sources
$redditSources = @(
    @{ name="Reddit - r/buildapcsales"; url="https://www.reddit.com/r/buildapcsales/.rss" },
    @{ name="Reddit - r/frugalmalefashion"; url="https://www.reddit.com/r/frugalmalefashion/.rss" },
    @{ name="Reddit - r/GameDeals"; url="https://www.reddit.com/r/GameDeals/.rss" },
    @{ name="Reddit - r/deals"; url="https://www.reddit.com/r/deals/.rss" },
    @{ name="Reddit - r/consoledeals"; url="https://www.reddit.com/r/consoledeals/.rss" }
)

foreach ($reddit in $redditSources) {
    Write-Host "Adding: $($reddit.name)..." -NoNewline
    
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
        Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/deal_sources" -Headers $headers -Method POST -Body $body -ErrorAction Stop | Out-Null
        Write-Host " Added!" -ForegroundColor Green
    } catch {
        if ($_.Exception.Message -like "*duplicate*" -or $_.Exception.Message -like "*unique*") {
            Write-Host " Already exists" -ForegroundColor Gray
        } else {
            Write-Host " Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Other missing sources
$otherSources = @(
    @{ name="Kinja Deals"; url="https://deals.kinja.com/rss"; base="https://deals.kinja.com" },
    @{ name="The Verge Deals"; url="https://www.theverge.com/rss/deals/index.xml"; base="https://www.theverge.com" },
    @{ name="CNET Deals"; url="https://www.cnet.com/rss/deals/"; base="https://www.cnet.com" },
    @{ name="Wirecutter Deals"; url="https://www.nytimes.com/wirecutter/rss/deals/"; base="https://www.nytimes.com/wirecutter" }
)

foreach ($src in $otherSources) {
    Write-Host "Adding: $($src.name)..." -NoNewline
    
    $body = @{
        name = $src.name
        type = "rss"
        base_url = $src.base
        rss_url = $src.url
        enabled = $true
        poll_interval_minutes = 45
        notes = "Curated deals"
    } | ConvertTo-Json
    
    try {
        Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/deal_sources" -Headers $headers -Method POST -Body $body -ErrorAction Stop | Out-Null
        Write-Host " Added!" -ForegroundColor Green
    } catch {
        if ($_.Exception.Message -like "*duplicate*" -or $_.Exception.Message -like "*unique*") {
            Write-Host " Already exists" -ForegroundColor Gray
        } else {
            Write-Host " Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`nDone! The deal worker will pick up new sources within 60 seconds." -ForegroundColor Cyan
