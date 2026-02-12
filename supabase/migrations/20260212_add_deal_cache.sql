-- Add deal_cache table for storing live Amazon deals
-- This reduces API calls by caching deal data for 30 minutes

CREATE TABLE IF NOT EXISTS deal_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asin VARCHAR(10) UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL,
  product_image_url TEXT,
  current_price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  discount_percentage INTEGER,
  deal_type VARCHAR(50), -- 'lightning', 'warehouse', 'price_drop', 'hot_deal'
  category VARCHAR(100),
  source VARCHAR(50), -- 'keepa', 'rapidapi', 'public'
  quality_score INTEGER DEFAULT 0,
  sales_rank INTEGER,
  num_reviews INTEGER,
  avg_rating DECIMAL(2,1),
  ends_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 minutes',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deal_cache_expires ON deal_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_deal_cache_quality ON deal_cache(quality_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_cache_deal_type ON deal_cache(deal_type, discount_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_deal_cache_category ON deal_cache(category, quality_score DESC);

-- Enable RLS
ALTER TABLE deal_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read cached deals (they're public Amazon data)
CREATE POLICY "Public read access to deal cache"
  ON deal_cache FOR SELECT
  USING (true);

-- Only the service role can write (via cron jobs)
CREATE POLICY "Service role can manage deal cache"
  ON deal_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Comment
COMMENT ON TABLE deal_cache IS 'Cached Amazon deals from various sources to reduce API costs';
