-- Add Facebook category fields to inventory_items table
-- Migration: Add Facebook category metadata fields
-- NOTE: brand, condition, and size already exist from previous migrations

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS facebook_category_id TEXT,
ADD COLUMN IF NOT EXISTS facebook_category_name TEXT;

-- Add index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_inventory_items_facebook_category_id ON inventory_items(facebook_category_id);

-- Add comments
COMMENT ON COLUMN inventory_items.facebook_category_id IS 'Facebook Marketplace category ID (e.g., "1670493229902393")';
COMMENT ON COLUMN inventory_items.facebook_category_name IS 'Facebook Marketplace category name resolved from ID (e.g., "Home Improvement & Tools")';
