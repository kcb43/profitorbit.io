-- Comprehensive Deal Sources Seed
-- 19+ curated deal aggregators, retailers, and RSS feeds for resellers

-- Clear existing demo data (optional)
-- DELETE FROM deals WHERE source_id IN (SELECT id FROM deal_sources);
-- DELETE FROM deal_sources;

-- Insert all deal sources
INSERT INTO deal_sources (name, type, base_url, rss_url, enabled, poll_interval_minutes, notes)
VALUES 
  -- Major Deal Aggregators (RSS available)
  (
    'Slickdeals Frontpage',
    'rss',
    'https://slickdeals.net',
    'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1',
    true,
    30,
    'Top community-voted deals - very high quality'
  ),
  
  (
    'DealNews',
    'rss',
    'https://www.dealnews.com',
    'https://www.dealnews.com/feed/rss',
    true,
    30,
    'Editor-curated deals across all categories'
  ),
  
  (
    'Brads Deals',
    'rss',
    'https://www.bradsdeals.com',
    'https://www.bradsdeals.com/deals/feed',
    true,
    30,
    'Human-curated, no junk deals'
  ),
  
  (
    'DealCatcher',
    'rss',
    'https://www.dealcatcher.com',
    'https://www.dealcatcher.com/feed/',
    true,
    30,
    'General deals RSS feed - reseller focused'
  ),
  
  (
    'Bens Bargains',
    'rss',
    'https://bensbargains.com',
    'https://www.bensbargains.com/rss/deals',
    true,
    30,
    'Long-running deal site with hot deals'
  ),
  
  (
    'Deals of America',
    'rss',
    'https://www.dealsofamerica.com',
    'https://www.dealsofamerica.com/rss.xml',
    true,
    30,
    'High-frequency deal updates'
  ),
  
  (
    'Clark Deals',
    'rss',
    'https://clarkdeals.com',
    'https://clarkdeals.com/feed/',
    true,
    45,
    'Consumer advocate Clark Howard deals'
  ),
  
  (
    'TechBargains',
    'rss',
    'https://www.techbargains.com',
    'https://www.techbargains.com/rss/deals.xml',
    true,
    30,
    'Tech-focused deals and coupons'
  ),
  
  (
    '9to5Toys',
    'rss',
    'https://9to5toys.com',
    'https://9to5toys.com/feed/',
    true,
    20,
    'Tech deals - Apple, LEGO, gaming, gadgets'
  ),
  
  -- Amazon-Focused Sites
  (
    'Woot',
    'rss',
    'https://www.woot.com',
    'https://www.woot.com/category.rss',
    true,
    60,
    'Amazon daily deals site'
  ),
  
  (
    'SaveYourDeals',
    'rss',
    'https://saveyourdeals.com',
    'https://saveyourdeals.com/feed/',
    true,
    45,
    'Curated Amazon deals'
  ),
  
  (
    'DMFlip',
    'rss',
    'https://dmflip.com',
    'https://dmflip.com/feed/',
    true,
    45,
    'Amazon affiliate deals for flippers'
  ),
  
  -- Retailer Clearance (may need scraping or manual)
  (
    'Target Clearance',
    'manual_only',
    'https://www.target.com/c/clearance/-/N-5q0ga',
    null,
    false,
    null,
    'Target clearance section - no RSS, requires manual submission or API'
  ),
  
  (
    'Macys Clearance',
    'manual_only',
    'https://www.macys.com/shop/sale/clearance-closeout?id=54698',
    null,
    false,
    null,
    'Macys clearance - no RSS, requires manual submission'
  ),
  
  -- Auction/Liquidation Sites
  (
    'HiBid Auctions',
    'manual_only',
    'https://hibid.com',
    null,
    false,
    null,
    'Liquidation auctions - no RSS, monitor via browser or manual'
  ),
  
  -- Travel Deals
  (
    'Travelzoo',
    'rss',
    'https://www.travelzoo.com',
    'https://www.travelzoo.com/rss/top20/',
    true,
    120,
    'Travel deals and experiences'
  ),
  
  -- Cashback/Coupon Sites (may have deals RSS)
  (
    'Rakuten Deals',
    'manual_only',
    'https://www.rakuten.com/coupons',
    null,
    false,
    null,
    'Rakuten hot deals - monitor manually, no public RSS'
  ),
  
  -- Community Forums (manual curation needed)
  (
    'Dans Deals Forum',
    'manual_only',
    'https://forums.dansdeals.com/index.php?board=26.0',
    null,
    false,
    null,
    'Community forum - high quality but requires manual monitoring'
  ),
  
  -- Manual Employee Submissions
  (
    'Manual Submissions',
    'manual_only',
    null,
    null,
    true,
    null,
    'Employee and user manual deal submissions'
  )
ON CONFLICT DO NOTHING;

-- ==========================================
-- Additional RSS feeds to consider adding later
-- ==========================================

/*
Future sources to explore:

RSS-capable:
- https://www.thekrazycouponlady.com/feed/
- https://hip2save.com/feed/
- https://www.offers.com/rss/
- https://deals.kinja.com/rss
- https://www.cnet.com/rss/deals/

Niche/Category-Specific:
- https://www.fatwallet.com/ (mostly defunct)
- https://deals.kinja.com/rss (Kinja Deals)
- https://www.retailmenot.com/ (no RSS, API possible)

Retailer-specific (need APIs or scraping):
- Walmart clearance
- Best Buy open-box
- Home Depot clearance
- Amazon Warehouse deals
*/

-- ==========================================
-- Views for monitoring sources
-- ==========================================

CREATE OR REPLACE VIEW deal_source_health AS
SELECT 
  ds.id,
  ds.name,
  ds.type,
  ds.enabled,
  ds.last_polled_at,
  ds.last_success_at,
  ds.fail_count,
  COUNT(d.id) as total_deals,
  COUNT(d.id) FILTER (WHERE d.status = 'active') as active_deals,
  AVG(d.score) FILTER (WHERE d.status = 'active') as avg_score,
  MAX(d.created_at) as last_deal_added
FROM deal_sources ds
LEFT JOIN deals d ON d.source_id = ds.id
GROUP BY ds.id, ds.name, ds.type, ds.enabled, ds.last_polled_at, ds.last_success_at, ds.fail_count
ORDER BY active_deals DESC;

COMMENT ON VIEW deal_source_health IS 'Health dashboard for all deal sources';

-- ==========================================
-- Helper function: Check RSS feed URLs
-- ==========================================

CREATE OR REPLACE FUNCTION active_rss_sources()
RETURNS TABLE (
  name TEXT,
  rss_url TEXT,
  last_polled_at TIMESTAMPTZ,
  fail_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.name,
    ds.rss_url,
    ds.last_polled_at,
    ds.fail_count
  FROM deal_sources ds
  WHERE ds.enabled = true 
    AND ds.type = 'rss'
    AND ds.rss_url IS NOT NULL
  ORDER BY ds.last_polled_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION active_rss_sources IS 'Lists all active RSS sources ready for polling';
