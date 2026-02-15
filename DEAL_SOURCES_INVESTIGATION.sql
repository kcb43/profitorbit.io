-- Investigation: Deal Sources Configuration
-- Check why deals aren't being scraped frequently

-- 1. Check all deal sources configuration
SELECT 
    name,
    type,
    enabled,
    poll_interval_minutes,
    last_polled_at,
    CASE 
        WHEN last_polled_at IS NULL THEN 'NEVER POLLED'
        WHEN last_polled_at + (poll_interval_minutes || ' minutes')::interval > NOW() THEN 'WAITING'
        ELSE 'READY TO POLL'
    END as poll_status,
    CASE 
        WHEN last_polled_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (NOW() - last_polled_at))/60 
        ELSE NULL 
    END as minutes_since_last_poll
FROM deal_sources
WHERE enabled = true
ORDER BY poll_interval_minutes ASC, name;

-- 2. Check recent deals ingested
SELECT 
    COUNT(*) as total_deals,
    COUNT(DISTINCT source) as unique_sources,
    MAX(created_at) as most_recent_deal,
    MIN(created_at) as oldest_deal,
    EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/60 as minutes_since_last_deal
FROM deals
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 3. Check deals by source (last 24 hours)
SELECT 
    source,
    COUNT(*) as deal_count,
    MAX(created_at) as last_deal_at,
    EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/60 as minutes_ago
FROM deals
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY deal_count DESC;

-- 4. Check if Reddit sources are working
SELECT 
    name,
    rss_url,
    last_polled_at,
    poll_interval_minutes
FROM deal_sources
WHERE enabled = true 
  AND name LIKE '%Reddit%'
ORDER BY name;

-- RECOMMENDATIONS:
-- If poll_interval_minutes is too high (20-60 min), reduce to 5-10 minutes for frequent updates
-- If Reddit sources are getting 403, we need to add User-Agent headers or use Reddit API
