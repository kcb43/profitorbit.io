-- ============================================================
-- News System
-- Tables: news_feeds, news_items, news_user_state
-- ============================================================

-- ==========================================
-- 1. News Feeds (source of truth for ingestion)
-- ==========================================
CREATE TABLE IF NOT EXISTS news_feeds (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('serpapi_google_news', 'rss', 'manual')),
  query          TEXT,                         -- SerpAPI q param
  topic_token    TEXT,                         -- SerpAPI topic_token
  publication_token TEXT,                      -- SerpAPI publication_token
  gl             TEXT NOT NULL DEFAULT 'us',
  hl             TEXT NOT NULL DEFAULT 'en',
  so             INTEGER CHECK (so IN (0, 1)), -- 0 = relevance, 1 = date
  tags           TEXT[] NOT NULL DEFAULT '{}', -- e.g. ['marketplace','ebay']
  enabled        BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_news_feeds_enabled ON news_feeds(enabled) WHERE enabled = true;
CREATE INDEX idx_news_feeds_tags ON news_feeds USING GIN(tags);

-- ==========================================
-- 2. News Items (deduplicated articles)
-- ==========================================
CREATE TABLE IF NOT EXISTS news_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id      UUID NOT NULL REFERENCES news_feeds(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  summary      TEXT,
  source_name  TEXT,
  url          TEXT NOT NULL UNIQUE,           -- dedupe key
  thumbnail    TEXT,
  published_at TIMESTAMPTZ,
  iso_date     TIMESTAMPTZ,                   -- SerpAPI iso_date if present
  tags         TEXT[] NOT NULL DEFAULT '{}',
  raw          JSONB,                          -- original SerpAPI object
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_news_items_feed_id ON news_items(feed_id);
CREATE INDEX idx_news_items_published_at ON news_items(COALESCE(iso_date, published_at) DESC);
CREATE INDEX idx_news_items_tags ON news_items USING GIN(tags);
CREATE INDEX idx_news_items_created_at ON news_items(created_at DESC);

-- ==========================================
-- 3. News User State (badge + read tracking)
-- ==========================================
CREATE TABLE IF NOT EXISTS news_user_state (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 4. RLS Policies
-- ==========================================

ALTER TABLE news_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_user_state ENABLE ROW LEVEL SECURITY;

-- news_feeds: public read
CREATE POLICY "news_feeds_public_read" ON news_feeds
  FOR SELECT USING (true);

-- news_items: public read
CREATE POLICY "news_items_public_read" ON news_items
  FOR SELECT USING (true);

-- news_user_state: users manage their own row
CREATE POLICY "news_user_state_select" ON news_user_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "news_user_state_upsert" ON news_user_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "news_user_state_update" ON news_user_state
  FOR UPDATE USING (auth.uid() = user_id);

-- ==========================================
-- 5. Seed Curated Feeds
-- ==========================================

INSERT INTO news_feeds (name, type, query, gl, hl, so, tags) VALUES
  -- Marketplace News
  ('eBay Seller Policy Updates',        'serpapi_google_news', 'eBay seller policy changes fees updates',      'us', 'en', 1, ARRAY['marketplace','ebay']),
  ('Mercari Seller Updates',            'serpapi_google_news', 'Mercari seller shipping policy update',        'us', 'en', 1, ARRAY['marketplace','mercari']),
  ('Poshmark & Depop News',             'serpapi_google_news', 'Poshmark OR Depop seller update fees policy',  'us', 'en', 1, ARRAY['marketplace','poshmark','depop']),
  ('Marketplace Outages & Issues',      'serpapi_google_news', 'eBay OR Mercari OR Poshmark outage issues',   'us', 'en', 1, ARRAY['marketplace','outage']),

  -- Product News
  ('Sneaker & Streetwear Drops',        'serpapi_google_news', 'sneaker limited drop resale release date',    'us', 'en', 1, ARRAY['product','sneakers']),
  ('Electronics Restocks & Launches',   'serpapi_google_news', 'electronics restock launch GPU console',     'us', 'en', 1, ARRAY['product','electronics']),
  ('Luxury & Collectibles Market',      'serpapi_google_news', 'luxury goods collectibles resale market',    'us', 'en', 1, ARRAY['product','luxury','collectibles']),
  ('Product Recalls',                   'serpapi_google_news', 'product recall safety CPSC 2026',            'us', 'en', 1, ARRAY['product','recalls']),

  -- Trends / What''s Hot
  ('Best Resale Items This Week',       'serpapi_google_news', 'best items to resell this week 2026',        'us', 'en', 1, ARRAY['trends','resale']),
  ('Hot Reselling Trends',              'serpapi_google_news', 'hot reselling items trending resale profit',  'us', 'en', 1, ARRAY['trends','resale']),
  ('Limited Drops & Resale Flips',      'serpapi_google_news', 'limited drop resale flip profit',            'us', 'en', 1, ARRAY['trends','resale','drops']),
  ('Restock & Resale Opportunities',    'serpapi_google_news', 'restock resale opportunity flip',            'us', 'en', 1, ARRAY['trends','resale','restock'])
ON CONFLICT DO NOTHING;
