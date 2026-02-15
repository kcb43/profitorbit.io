-- Fix Deal Sources: Reduce polling intervals and reset last_polled_at
-- This will make sources poll more frequently for live feed updates

-- 1. Reset all last_polled_at to NULL so they poll immediately
UPDATE deal_sources
SET last_polled_at = NULL
WHERE enabled = true AND type = 'rss';

-- 2. Reduce poll intervals for more frequent updates
UPDATE deal_sources
SET poll_interval_minutes = 5
WHERE enabled = true 
  AND type = 'rss'
  AND poll_interval_minutes >= 20;

-- 3. Set Reddit sources to 3 minutes (they're fast)
UPDATE deal_sources
SET poll_interval_minutes = 3
WHERE enabled = true 
  AND name LIKE '%Reddit%';

-- 4. Verify changes
SELECT 
    name,
    type,
    enabled,
    poll_interval_minutes,
    last_polled_at,
    'READY TO POLL IMMEDIATELY' as status
FROM deal_sources
WHERE enabled = true AND type = 'rss'
ORDER BY poll_interval_minutes ASC, name;
