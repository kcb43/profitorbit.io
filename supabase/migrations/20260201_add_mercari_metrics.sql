-- Add Mercari item metrics (likes and views) to inventory_items table
-- These metrics are captured when syncing from Mercari and help track listing performance

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS mercari_likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mercari_views INTEGER DEFAULT 0;

-- Add indexes for potential filtering/sorting by performance metrics
CREATE INDEX IF NOT EXISTS idx_inventory_items_mercari_likes ON inventory_items(mercari_likes) WHERE mercari_likes > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_items_mercari_views ON inventory_items(mercari_views) WHERE mercari_views > 0;

-- Add comments
COMMENT ON COLUMN inventory_items.mercari_likes IS 'Number of likes/favorites on Mercari listing';
COMMENT ON COLUMN inventory_items.mercari_views IS 'Number of page views on Mercari listing (itemPv)';
