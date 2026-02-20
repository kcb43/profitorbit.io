-- ============================================================
-- Add free RSS feed sources to news_feeds.
-- These require no API key and provide immediate content.
-- query field = RSS URL for type='rss' feeds.
-- source_name is stored in the items at ingest time via feed.name.
-- ============================================================

INSERT INTO news_feeds (name, type, query, gl, hl, tags) VALUES
  -- Reddit communities (free RSS, no auth)
  ('r/flipping',      'rss', 'https://www.reddit.com/r/flipping/.rss?limit=25',   'us', 'en', ARRAY['trends','resale']),
  ('r/Mercari',       'rss', 'https://www.reddit.com/r/Mercari/.rss?limit=25',    'us', 'en', ARRAY['marketplace','mercari']),
  ('r/eBaySellerAdvice', 'rss', 'https://www.reddit.com/r/eBaySellerAdvice/.rss?limit=25', 'us', 'en', ARRAY['marketplace','ebay']),
  ('r/sneakers',      'rss', 'https://www.reddit.com/r/sneakers/.rss?limit=25',   'us', 'en', ARRAY['product','sneakers']),
  ('r/Poshmark',      'rss', 'https://www.reddit.com/r/Poshmark/.rss?limit=25',   'us', 'en', ARRAY['marketplace','poshmark']),
  ('r/Depop',         'rss', 'https://www.reddit.com/r/Depop/.rss?limit=25',      'us', 'en', ARRAY['marketplace','depop']),
  ('r/reselling',     'rss', 'https://www.reddit.com/r/reselling/.rss?limit=25',  'us', 'en', ARRAY['trends','resale']),
  ('r/Flippers',      'rss', 'https://www.reddit.com/r/Flippers/.rss?limit=25',   'us', 'en', ARRAY['trends','resale']),

  -- eBay announcements
  ('eBay Inc. Blog',  'rss', 'https://www.ebayinc.com/stories/rss.xml',           'us', 'en', ARRAY['marketplace','ebay'])
ON CONFLICT DO NOTHING;
