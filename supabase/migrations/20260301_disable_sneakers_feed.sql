-- Disable r/sneakers feed (not relevant to reselling focus)
UPDATE news_feeds SET enabled = false WHERE name = 'r/sneakers';
