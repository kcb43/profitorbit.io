-- Orben Deal Intelligence System
-- Creates all tables for deal ingestion, scoring, and universal product search

-- ==========================================
-- 1. Deal Sources Registry
-- ==========================================
CREATE TABLE IF NOT EXISTS deal_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rss', 'affiliate_feed', 'retailer_api', 'manual_only')),
  base_url TEXT,
  rss_url TEXT,
  enabled BOOLEAN DEFAULT true,
  poll_interval_minutes INTEGER DEFAULT 30,
  last_polled_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  fail_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deal_sources_enabled ON deal_sources(enabled) WHERE enabled = true;
CREATE INDEX idx_deal_sources_last_polled ON deal_sources(last_polled_at);

-- ==========================================
-- 2. Deals (Canonical normalized deals)
-- ==========================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES deal_sources(id) ON DELETE CASCADE,
  source_item_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  merchant TEXT,
  category TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'USD',
  original_price NUMERIC,
  coupon_code TEXT,
  shipping_price NUMERIC,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  hash TEXT UNIQUE NOT NULL, -- dedupe key
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  roi_estimate NUMERIC,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Critical indexes for performance
CREATE UNIQUE INDEX idx_deals_hash ON deals(hash);
CREATE INDEX idx_deals_status_score ON deals(status, score DESC) WHERE status = 'active';
CREATE INDEX idx_deals_posted_at ON deals(posted_at DESC);
CREATE INDEX idx_deals_merchant ON deals(merchant);
CREATE INDEX idx_deals_category ON deals(category);
CREATE INDEX idx_deals_source_id ON deals(source_id);
CREATE INDEX idx_deals_title_search ON deals USING gin(to_tsvector('english', title));

-- ==========================================
-- 3. Deal Events (Audit trail)
-- ==========================================
CREATE TABLE IF NOT EXISTS deal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('created', 'updated', 'expired', 'flagged', 'score_changed')),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deal_events_deal_id ON deal_events(deal_id);
CREATE INDEX idx_deal_events_created_at ON deal_events(created_at DESC);

-- ==========================================
-- 4. Deal Ingestion Runs (Track polling)
-- ==========================================
CREATE TABLE IF NOT EXISTS deal_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES deal_sources(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  items_seen INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ingestion_runs_source ON deal_ingestion_runs(source_id);
CREATE INDEX idx_ingestion_runs_started ON deal_ingestion_runs(started_at DESC);
CREATE INDEX idx_ingestion_runs_status ON deal_ingestion_runs(status);

-- ==========================================
-- 5. Deal Submissions (Manual/community)
-- ==========================================
CREATE TABLE IF NOT EXISTS deal_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  price NUMERIC,
  merchant TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_submissions_user ON deal_submissions(user_id);
CREATE INDEX idx_submissions_status ON deal_submissions(status);
CREATE INDEX idx_submissions_created ON deal_submissions(created_at DESC);

-- ==========================================
-- 6. Deal Saves (User watchlist)
-- ==========================================
CREATE TABLE IF NOT EXISTS deal_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, deal_id)
);

CREATE INDEX idx_deal_saves_user ON deal_saves(user_id);
CREATE INDEX idx_deal_saves_deal ON deal_saves(deal_id);
CREATE INDEX idx_deal_saves_created ON deal_saves(created_at DESC);

-- ==========================================
-- 7. Search Snapshots (Cache search results)
-- ==========================================
CREATE TABLE IF NOT EXISTS search_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  providers TEXT[] NOT NULL DEFAULT '{}',
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_search_snapshots_user ON search_snapshots(user_id);
CREATE INDEX idx_search_snapshots_expires ON search_snapshots(expires_at);
CREATE INDEX idx_search_snapshots_query ON search_snapshots(query);

-- Clean up expired snapshots (optional function)
CREATE OR REPLACE FUNCTION cleanup_expired_search_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM search_snapshots WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 8. Updated_at trigger for deals
-- ==========================================
CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deals_updated_at();

-- ==========================================
-- RLS POLICIES (Row Level Security)
-- ==========================================

-- Deal Sources: readable by authenticated, writable by service role only
ALTER TABLE deal_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view deal sources" ON deal_sources FOR SELECT USING (true);
CREATE POLICY "Service role can manage deal sources" ON deal_sources FOR ALL USING (auth.role() = 'service_role');

-- Deals: readable by all, writable by service role only
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active deals" ON deals FOR SELECT USING (status = 'active' OR auth.role() = 'service_role');
CREATE POLICY "Service role can manage deals" ON deals FOR ALL USING (auth.role() = 'service_role');

-- Deal Events: readable by authenticated, writable by service role
ALTER TABLE deal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view deal events" ON deal_events FOR SELECT USING (true);
CREATE POLICY "Service role can create events" ON deal_events FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Deal Ingestion Runs: readable by authenticated, writable by service role
ALTER TABLE deal_ingestion_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ingestion runs" ON deal_ingestion_runs FOR SELECT USING (true);
CREATE POLICY "Service role can manage runs" ON deal_ingestion_runs FOR ALL USING (auth.role() = 'service_role');

-- Deal Submissions: users can read their own, insert their own, admins/service can update
ALTER TABLE deal_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their submissions" ON deal_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create submissions" ON deal_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can manage submissions" ON deal_submissions FOR ALL USING (auth.role() = 'service_role');

-- Deal Saves: users can manage their own saves
ALTER TABLE deal_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their saves" ON deal_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create saves" ON deal_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete saves" ON deal_saves FOR DELETE USING (auth.uid() = user_id);

-- Search Snapshots: users can read their own, service role can write
ALTER TABLE search_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their snapshots" ON search_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage snapshots" ON search_snapshots FOR ALL USING (auth.role() = 'service_role');

-- ==========================================
-- Seed: Initial deal source
-- ==========================================
INSERT INTO deal_sources (name, type, base_url, rss_url, enabled, notes)
VALUES (
  'DealCatcher',
  'rss',
  'https://www.dealcatcher.com',
  'https://www.dealcatcher.com/feed/',
  true,
  'General deals RSS feed - reseller focused'
) ON CONFLICT DO NOTHING;

-- ==========================================
-- Helper function: Get feed with filters
-- ==========================================
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
  merchant TEXT,
  category TEXT,
  url TEXT,
  image_url TEXT,
  price NUMERIC,
  currency TEXT,
  original_price NUMERIC,
  coupon_code TEXT,
  score INTEGER,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.merchant,
    d.category,
    d.url,
    d.image_url,
    d.price,
    d.currency,
    d.original_price,
    d.coupon_code,
    d.score,
    d.posted_at,
    d.created_at
  FROM deals d
  WHERE d.status = 'active'
    AND d.score >= min_score_val
    AND (search_query IS NULL OR d.title ILIKE '%' || search_query || '%')
    AND (filter_merchant IS NULL OR d.merchant ILIKE '%' || filter_merchant || '%')
    AND (filter_category IS NULL OR d.category ILIKE '%' || filter_category || '%')
  ORDER BY d.posted_at DESC NULLS LAST, d.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON TABLE deal_sources IS 'Registry of deal syndication sources (RSS, APIs, affiliates)';
COMMENT ON TABLE deals IS 'Canonical normalized deals from all sources';
COMMENT ON TABLE deal_events IS 'Audit log for deal lifecycle events';
COMMENT ON TABLE deal_ingestion_runs IS 'Track each polling/ingestion run';
COMMENT ON TABLE deal_submissions IS 'Manual deal submissions from employees/users';
COMMENT ON TABLE deal_saves IS 'User watchlist/saved deals';
COMMENT ON TABLE search_snapshots IS 'Cached universal product search results';
