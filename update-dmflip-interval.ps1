# Update DMFlip polling interval to 5 minutes

$SUPABASE_URL = "https://hlcwhpajorzbleabavcr.supabase.co"
$SUPABASE_KEY = "sb_publishable_AmJEyN9K_q2OJAUCGiO3eA_NZYf6rXm"
$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

Write-Host "Updating DMFlip polling interval to 5 minutes..." -ForegroundColor Cyan

try {
    $body = @{
        poll_interval_minutes = 5
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/deal_sources?name=eq.DMFlip" -Headers $headers -Method PATCH -Body $body
    
    Write-Host "✅ SUCCESS! DMFlip will now poll every 5 minutes" -ForegroundColor Green
    Write-Host ""
    Write-Host "Updated source:" -ForegroundColor Yellow
    $result | Format-List
} catch {
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.Exception -ForegroundColor Red
}
