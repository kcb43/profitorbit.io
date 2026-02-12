-- Enhanced Pulse System - Database Schema
-- Based on Amazon Deal Tracking GitHub Repos
-- Adds warehouse deals, lightning deals, coupon tracking, and advanced filtering

-- 1. Update price_watchlist table with new columns
ALTER TABLE price_watchlist 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS deal_type TEXT DEFAULT 'regular', -- 'regular', 'warehouse', 'lightning', 'coupon'
ADD COLUMN IF NOT EXISTS priority_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS filter_criteria JSONB,
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS check_frequency_minutes INTEGER DEFAULT 360; -- 6 hours default

-- 2. Update deal_alerts table with enhanced fields
ALTER TABLE deal_alerts
ADD COLUMN IF NOT EXISTS deal_type TEXT DEFAULT 'regular',
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS condition TEXT, -- For warehouse deals: 'like_new', 'very_good', 'good', 'acceptable'
ADD COLUMN IF NOT EXISTS condition_note TEXT, -- Detailed condition description
ADD COLUMN IF NOT EXISTS savings_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS coupon_code TEXT,
ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS time_remaining TEXT, -- For lightning deals: "2 hours 15 minutes"
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deal_quality_score INTEGER DEFAULT 0; -- 0-100 score based on discount + rarity

-- 3. Create new deal_filters table (from Amazon-Deal-Monitor logic)
CREATE TABLE IF NOT EXISTS deal_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL, -- { "categories": [], "min_discount": 50, "deal_types": [], etc }
  is_active BOOLEAN DEFAULT true,
  is_isolated BOOLEAN DEFAULT false, -- Priority/exclusive mode (from Amazon-Deal-Monitor)
  notification_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_filters_user ON deal_filters(user_id) WHERE is_active = true;

-- 4. Create warehouse_deals table (from Amazon-WD-Alerts)
CREATE TABLE IF NOT EXISTS warehouse_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asin TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL,
  product_image_url TEXT,
  condition TEXT NOT NULL, -- 'like_new', 'very_good', 'good', 'acceptable'
  condition_note TEXT, -- Item-specific condition description
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) NOT NULL,
  savings DECIMAL(10,2) NOT NULL,
  percent_off INTEGER NOT NULL,
  marketplace TEXT DEFAULT 'amazon',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_available BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_asin ON warehouse_deals(asin) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_warehouse_detected ON warehouse_deals(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_percent_off ON warehouse_deals(percent_off DESC) WHERE is_available = true;

-- 5. Create lightning_deals table (from Amazon-Deal-Monitor logic)
CREATE TABLE IF NOT EXISTS lightning_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL, -- ASIN or marketplace-specific ID
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL,
  product_image_url TEXT,
  category TEXT,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) NOT NULL,
  savings DECIMAL(10,2) NOT NULL,
  percent_off INTEGER NOT NULL,
  marketplace TEXT DEFAULT 'amazon',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ NOT NULL,
  time_remaining_minutes INTEGER, -- Updated every check
  percent_claimed INTEGER DEFAULT 0, -- How much stock is claimed (0-100%)
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lightning_ends_at ON lightning_deals(ends_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_lightning_percent_off ON lightning_deals(percent_off DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_lightning_category ON lightning_deals(category);

-- 6. Create coupon_deals table (from Amazon-Deal-Scraper logic)
CREATE TABLE IF NOT EXISTS coupon_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL,
  product_image_url TEXT,
  category TEXT,
  price DECIMAL(10,2) NOT NULL,
  coupon_code TEXT, -- If explicit code needed
  coupon_discount DECIMAL(10,2), -- Fixed amount
  coupon_percent_off INTEGER, -- Percentage off
  final_price DECIMAL(10,2) NOT NULL, -- After coupon
  total_savings DECIMAL(10,2) NOT NULL,
  total_percent_off INTEGER NOT NULL,
  marketplace TEXT DEFAULT 'amazon',
  is_clippable BOOLEAN DEFAULT false, -- Can be clipped without code
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_available BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_product_id ON coupon_deals(product_id) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_coupon_total_percent_off ON coupon_deals(total_percent_off DESC) WHERE is_available = true;

-- 7. Create deal_categories table (from Amazon-Deal-Monitor categories)
CREATE TABLE IF NOT EXISTS deal_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  icon TEXT, -- Emoji or icon name
  parent_category_id UUID REFERENCES deal_categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Insert common categories
INSERT INTO deal_categories (name, display_name, icon) VALUES
  ('electronics', 'Electronics', '📱'),
  ('home_kitchen', 'Home & Kitchen', '🏠'),
  ('toys_games', 'Toys & Games', '🎮'),
  ('sports_outdoors', 'Sports & Outdoors', '⚽'),
  ('beauty_personal_care', 'Beauty & Personal Care', '💄'),
  ('automotive', 'Automotive', '🚗'),
  ('fashion', 'Fashion', '👗'),
  ('books', 'Books', '📚'),
  ('pet_supplies', 'Pet Supplies', '🐾'),
  ('baby_products', 'Baby Products', '🍼')
ON CONFLICT (name) DO NOTHING;

-- 8. Create user_notification_preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  email_frequency TEXT DEFAULT 'instant', -- 'instant', 'hourly', 'daily', 'weekly'
  push_enabled BOOLEAN DEFAULT false,
  discord_webhook_url TEXT,
  min_discount_threshold INTEGER DEFAULT 50, -- Only notify for deals >= 50% off
  deal_types JSONB DEFAULT '["regular", "warehouse", "lightning", "coupon"]'::jsonb,
  categories JSONB DEFAULT '[]'::jsonb, -- Empty = all categories
  quiet_hours_start TIME, -- e.g., '22:00'
  quiet_hours_end TIME, -- e.g., '07:00'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create deal_scan_log table (tracking background scans)
CREATE TABLE IF NOT EXISTS deal_scan_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_type TEXT NOT NULL, -- 'warehouse', 'lightning', 'coupon', 'regular'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  products_scanned INTEGER DEFAULT 0,
  deals_found INTEGER DEFAULT 0,
  alerts_created INTEGER DEFAULT 0,
  errors JSONB,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_deal_scan_log_type ON deal_scan_log(scan_type, started_at DESC);

-- 10. Row Level Security Policies
ALTER TABLE deal_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own deal filters"
  ON deal_filters
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own notification preferences"
  ON user_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id);

-- Public read access for deal tables (for browsing)
ALTER TABLE warehouse_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE lightning_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available warehouse deals"
  ON warehouse_deals FOR SELECT
  USING (is_available = true);

CREATE POLICY "Anyone can view active lightning deals"
  ON lightning_deals FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view available coupon deals"
  ON coupon_deals FOR SELECT
  USING (is_available = true);

CREATE POLICY "Anyone can view active categories"
  ON deal_categories FOR SELECT
  USING (is_active = true);

-- 11. Create helper functions

-- Function to calculate deal quality score (0-100)
CREATE OR REPLACE FUNCTION calculate_deal_quality_score(
  p_discount_percent INTEGER,
  p_deal_type TEXT,
  p_time_remaining_minutes INTEGER DEFAULT NULL,
  p_original_price DECIMAL DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  -- Base score from discount (max 60 points)
  score := LEAST(p_discount_percent, 100) * 0.6;
  
  -- Bonus for deal type (max 20 points)
  CASE p_deal_type
    WHEN 'lightning' THEN score := score + 20;
    WHEN 'warehouse' THEN score := score + 15;
    WHEN 'coupon' THEN score := score + 10;
    ELSE score := score + 5;
  END CASE;
  
  -- Urgency bonus for lightning deals (max 15 points)
  IF p_time_remaining_minutes IS NOT NULL THEN
    IF p_time_remaining_minutes <= 60 THEN
      score := score + 15; -- Less than 1 hour left!
    ELSIF p_time_remaining_minutes <= 360 THEN
      score := score + 10; -- Less than 6 hours left
    ELSIF p_time_remaining_minutes <= 1440 THEN
      score := score + 5; -- Less than 24 hours left
    END IF;
  END IF;
  
  -- Value bonus for high-value items (max 5 points)
  IF p_original_price IS NOT NULL AND p_original_price >= 100 THEN
    score := score + 5;
  END IF;
  
  RETURN LEAST(score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update time remaining for lightning deals
CREATE OR REPLACE FUNCTION update_lightning_deal_time_remaining()
RETURNS void AS $$
BEGIN
  UPDATE lightning_deals
  SET 
    time_remaining_minutes = GREATEST(0, EXTRACT(EPOCH FROM (ends_at - NOW())) / 60)::INTEGER,
    is_active = CASE 
      WHEN ends_at > NOW() THEN true 
      ELSE false 
    END,
    last_checked_at = NOW()
  WHERE is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 12. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_watchlist_category ON price_watchlist(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_watchlist_deal_type ON price_watchlist(deal_type);
CREATE INDEX IF NOT EXISTS idx_price_watchlist_last_checked ON price_watchlist(last_checked_at) WHERE notify_on_drop = true;

CREATE INDEX IF NOT EXISTS idx_deal_alerts_deal_type ON deal_alerts(deal_type);
CREATE INDEX IF NOT EXISTS idx_deal_alerts_category ON deal_alerts(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_alerts_quality_score ON deal_alerts(deal_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_deal_alerts_unread ON deal_alerts(user_id, is_read, created_at DESC) WHERE is_read = false;

COMMENT ON TABLE warehouse_deals IS 'Tracks Amazon Warehouse Deals (open-box, returned items) with condition ratings';
COMMENT ON TABLE lightning_deals IS 'Tracks time-sensitive Lightning Deals with expiration times';
COMMENT ON TABLE coupon_deals IS 'Tracks products with active coupons or promotional codes';
COMMENT ON TABLE deal_filters IS 'User-defined filters for deal alerts with priority/isolated mode support';
COMMENT ON TABLE deal_scan_log IS 'Logs all background scan operations for monitoring and debugging';
