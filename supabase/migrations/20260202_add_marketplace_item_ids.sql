-- Add marketplace item ID columns for duplicate detection
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS facebook_item_id TEXT,
ADD COLUMN IF NOT EXISTS mercari_item_id TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_facebook_item_id 
ON inventory_items(facebook_item_id) 
WHERE facebook_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_mercari_item_id 
ON inventory_items(mercari_item_id) 
WHERE mercari_item_id IS NOT NULL;

-- Add unique constraints per user (prevent same marketplace item being imported twice)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_facebook_item_unique 
ON inventory_items(user_id, facebook_item_id) 
WHERE facebook_item_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_mercari_item_unique 
ON inventory_items(user_id, mercari_item_id) 
WHERE mercari_item_id IS NOT NULL AND deleted_at IS NULL;

-- Add comments
COMMENT ON COLUMN inventory_items.facebook_item_id IS 'Facebook Marketplace listing ID for duplicate detection';
COMMENT ON COLUMN inventory_items.mercari_item_id IS 'Mercari item ID for duplicate detection';
