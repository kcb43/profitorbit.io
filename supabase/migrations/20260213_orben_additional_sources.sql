-- Additional deal sources seed
-- Run this after the main migration to add more RSS feeds

INSERT INTO deal_sources (name, type, base_url, rss_url, enabled, poll_interval_minutes, notes)
VALUES 
  -- Slickdeals
  (
    'Slickdeals Frontpage',
    'rss',
    'https://slickdeals.net',
    'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1',
    true,
    30,
    'Most popular deals from Slickdeals community'
  ),
  
  -- TechBargains
  (
    'TechBargains',
    'rss',
    'https://www.techbargains.com',
    'https://www.techbargains.com/rss/deals.xml',
    true,
    30,
    'Tech-focused deals'
  ),
  
  -- Brad's Deals
  (
    'Brads Deals',
    'rss',
    'https://www.bradsdeals.com',
    'https://www.bradsdeals.com/deals/feed',
    true,
    30,
    'Curated deals across categories'
  ),
  
  -- Woot
  (
    'Woot',
    'rss',
    'https://www.woot.com',
    'https://www.woot.com/category.rss',
    true,
    60,
    'Amazon-owned daily deals site'
  ),
  
  -- DealNews
  (
    'DealNews',
    'rss',
    'https://www.dealnews.com',
    'https://www.dealnews.com/features/RSS/',
    true,
    30,
    'Editor-picked deals'
  )
ON CONFLICT DO NOTHING;

-- Manual submission placeholder (for employee workflow)
INSERT INTO deal_sources (name, type, enabled, notes)
VALUES (
  'Manual Submissions',
  'manual_only',
  true,
  'Deals manually submitted by employees/users'
) ON CONFLICT DO NOTHING;

-- Create helpful views
CREATE OR REPLACE VIEW active_deals_summary AS
SELECT 
  ds.name as source_name,
  COUNT(d.id) as active_deals,
  AVG(d.score) as avg_score,
  MAX(d.created_at) as last_deal_added
FROM deal_sources ds
LEFT JOIN deals d ON d.source_id = ds.id AND d.status = 'active'
WHERE ds.enabled = true
GROUP BY ds.id, ds.name
ORDER BY active_deals DESC;

CREATE OR REPLACE VIEW recent_ingestion_summary AS
SELECT 
  ds.name as source_name,
  dir.status,
  dir.items_created,
  dir.items_updated,
  dir.items_seen,
  dir.started_at,
  dir.finished_at,
  EXTRACT(EPOCH FROM (dir.finished_at - dir.started_at)) as duration_seconds
FROM deal_ingestion_runs dir
JOIN deal_sources ds ON ds.id = dir.source_id
ORDER BY dir.started_at DESC
LIMIT 50;

COMMENT ON VIEW active_deals_summary IS 'Summary of active deals by source';
COMMENT ON VIEW recent_ingestion_summary IS 'Recent ingestion runs with performance metrics';
