-- HOTFIX: Fix get_deal_feed function - remove non-existent 'source' column
-- Generated: 2026-02-14
-- Issue: Function tries to SELECT d.source which doesn't exist
-- Solution: Remove 'source' from RETURNS TABLE and SELECT statement

DROP FUNCTION IF EXISTS public.get_deal_feed(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_deal_feed(
  search_query TEXT DEFAULT NULL,
  filter_merchant TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL,
  min_score_val INTEGER DEFAULT 0,
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  url TEXT,
  image_url TEXT,
  price NUMERIC,
  original_price NUMERIC,
  merchant TEXT,
  category TEXT,
  score INT,
  posted_at TIMESTAMP WITH TIME ZONE,
  coupon_code TEXT
  -- Removed: source TEXT (column doesn't exist in deals table)
  -- Note: deals table has source_id UUID, not source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.url,
    d.image_url,
    d.price,
    d.original_price,
    d.merchant,
    d.category,
    d.score,
    d.posted_at,
    d.coupon_code
    -- Removed: d.source (doesn't exist)
  FROM deals d
  WHERE d.status = 'active'
    AND d.score >= min_score_val
    AND (filter_merchant IS NULL OR d.merchant = filter_merchant)
    AND (filter_category IS NULL OR d.category = filter_category)
    AND (search_query IS NULL OR d.title ILIKE '%' || search_query || '%')
  ORDER BY d.score DESC, d.posted_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

COMMENT ON FUNCTION get_deal_feed IS 'Secure deal feed with search_path protection. Returns active deals without source column.';

-- Test the fix
SELECT * FROM get_deal_feed(
  search_query := NULL,
  filter_merchant := NULL,
  filter_category := NULL,
  min_score_val := 0,
  page_limit := 5,
  page_offset := 0
);
