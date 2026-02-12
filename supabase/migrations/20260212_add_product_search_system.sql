-- Universal Product Search & Price Intelligence System
-- Enables multi-marketplace product search, price tracking, and deal monitoring

-- Product search cache (reduce external API calls)
CREATE TABLE IF NOT EXISTS product_search_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_query TEXT NOT NULL,
  search_filters JSONB DEFAULT '{}',
  results JSONB NOT NULL,
  api_source VARCHAR(50), -- 'productapi', 'pricesapi', 'searchapi', 'manual'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 hour'
);

-- Price tracking watchlist
CREATE TABLE IF NOT EXISTS price_watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_url TEXT NOT NULL,
  product_title TEXT,
  product_image TEXT,
  product_brand TEXT,
  marketplace VARCHAR(50), -- 'amazon', 'ebay', 'walmart', 'bestbuy', etc.
  current_price DECIMAL(10,2),
  target_price DECIMAL(10,2),
  original_price DECIMAL(10,2), -- For discount calculation
  alert_enabled BOOLEAN DEFAULT TRUE,
  alert_frequency VARCHAR(20) DEFAULT 'once', -- 'once', 'daily', 'always'
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_alert_sent TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_url)
);

-- Price history for tracked items
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID REFERENCES price_watchlist(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  marketplace VARCHAR(50),
  availability VARCHAR(50), -- 'in_stock', 'out_of_stock', 'pre_order', 'limited'
  seller_name TEXT,
  condition VARCHAR(50), -- 'new', 'used', 'refurbished'
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deal alerts (for Pulse page)
CREATE TABLE IF NOT EXISTS deal_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_title TEXT NOT NULL,
  product_url TEXT NOT NULL,
  product_image TEXT,
  product_brand TEXT,
  marketplace VARCHAR(50),
  current_price DECIMAL(10,2),
  original_price DECIMAL(10,2),
  discount_percentage INTEGER,
  discount_amount DECIMAL(10,2),
  alert_type VARCHAR(50), -- 'price_drop', 'back_in_stock', 'deal', 'warehouse', 'clearance'
  deal_category VARCHAR(50), -- 'hot', 'trending', 'warehouse', 'clearance', 'lightning'
  profit_potential DECIMAL(10,2), -- Estimated profit if resold
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE, -- For time-sensitive deals
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User search preferences
CREATE TABLE IF NOT EXISTS user_search_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_marketplaces TEXT[] DEFAULT ARRAY['amazon', 'ebay', 'walmart', 'bestbuy'],
  excluded_marketplaces TEXT[] DEFAULT '{}',
  alert_frequency VARCHAR(20) DEFAULT 'daily', -- 'real_time', 'hourly', 'daily', 'weekly'
  min_discount_percentage INTEGER DEFAULT 20,
  max_price DECIMAL(10,2),
  min_profit_margin DECIMAL(10,2) DEFAULT 10.00,
  preferred_categories TEXT[],
  excluded_categories TEXT[],
  condition_preference VARCHAR(20) DEFAULT 'all', -- 'new', 'used', 'refurbished', 'all'
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved searches (for quick access)
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  search_name TEXT NOT NULL,
  search_query TEXT NOT NULL,
  search_filters JSONB DEFAULT '{}',
  auto_track BOOLEAN DEFAULT FALSE, -- Automatically add results to watchlist
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_cache_query ON product_search_cache(search_query);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON product_search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON price_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_enabled ON price_watchlist(user_id, alert_enabled) WHERE alert_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_price_history_watchlist ON price_history(watchlist_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_alerts_user_unread ON deal_alerts(user_id, is_read, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_deal_alerts_expires ON deal_alerts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id, last_used DESC);

-- RLS Policies
ALTER TABLE price_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_search_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own watchlist"
  ON price_watchlist FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their price history"
  ON price_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM price_watchlist 
    WHERE price_watchlist.id = price_history.watchlist_id 
    AND price_watchlist.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their own alerts"
  ON deal_alerts FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their preferences"
  ON user_search_preferences FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their saved searches"
  ON saved_searches FOR ALL
  USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE product_search_cache IS 'Caches product search results to reduce external API calls';
COMMENT ON TABLE price_watchlist IS 'User-created price tracking watchlist for products';
COMMENT ON TABLE price_history IS 'Historical price data for tracked products';
COMMENT ON TABLE deal_alerts IS 'Automated deal alerts shown in Pulse page';
COMMENT ON TABLE user_search_preferences IS 'User preferences for product search and deal alerts';
COMMENT ON TABLE saved_searches IS 'User saved search queries for quick access';
