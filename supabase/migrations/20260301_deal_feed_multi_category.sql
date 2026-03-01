-- Add multi-category filtering to the deal feed.
-- The new filter_categories TEXT[] param lets the frontend send an array of
-- category keys (e.g., '{amazon-deals,price-drops}') so users can toggle
-- which deal channels they see.

DROP FUNCTION IF EXISTS public.get_deal_feed(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_deal_feed(
  search_query TEXT DEFAULT NULL,
  filter_merchant TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL,
  min_score_val INTEGER DEFAULT 0,
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0,
  filter_categories TEXT[] DEFAULT NULL
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
  coupon_code TEXT,
  source_id TEXT
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
    d.coupon_code,
    d.source_id
  FROM deals d
  WHERE d.status = 'active'
    AND d.score >= min_score_val
    AND (filter_merchant IS NULL OR d.merchant = filter_merchant)
    AND (filter_category IS NULL OR d.category = filter_category)
    AND (filter_categories IS NULL OR d.category = ANY(filter_categories))
    AND (search_query IS NULL OR d.title ILIKE '%' || search_query || '%')
  ORDER BY d.posted_at DESC, d.score DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

COMMENT ON FUNCTION get_deal_feed IS 'Returns active deals sorted by date (newest first). Supports multi-category filtering via filter_categories array.';
