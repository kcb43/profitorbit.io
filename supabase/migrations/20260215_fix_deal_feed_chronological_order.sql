-- Fix deal feed sorting: Show newest deals first (chronological order)
-- Change ORDER BY from score-first to date-first

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
  FROM deals d
  WHERE d.status = 'active'
    AND d.score >= min_score_val
    AND (filter_merchant IS NULL OR d.merchant = filter_merchant)
    AND (filter_category IS NULL OR d.category = filter_category)
    AND (search_query IS NULL OR d.title ILIKE '%' || search_query || '%')
  ORDER BY d.posted_at DESC, d.score DESC  -- ✅ CHANGED: Date first (newest at top), then score
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

COMMENT ON FUNCTION get_deal_feed IS 'Returns active deals sorted by date (newest first), then by score. Shows latest deals at the top.';
