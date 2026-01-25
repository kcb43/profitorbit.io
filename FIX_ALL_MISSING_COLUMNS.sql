-- Comprehensive fix for missing columns in inventory_items table
-- Run this in Supabase SQL Editor to fix import errors

-- Add all missing columns that should exist from migrations
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS condition TEXT,
ADD COLUMN IF NOT EXISTS listing_price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS ebay_item_id TEXT,
ADD COLUMN IF NOT EXISTS ebay_offer_id TEXT,
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS colors TEXT[],
ADD COLUMN IF NOT EXISTS size TEXT,
ADD COLUMN IF NOT EXISTS weight NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS dimensions_length NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS dimensions_width NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS dimensions_height NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_condition 
ON inventory_items(condition) 
WHERE condition IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_ebay_item_id 
ON inventory_items(ebay_item_id) 
WHERE ebay_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_ebay_offer_id 
ON inventory_items(ebay_offer_id) 
WHERE ebay_offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_sku 
ON inventory_items(sku) 
WHERE sku IS NOT NULL;

-- Create unique constraints to prevent duplicate imports
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_ebay_item 
ON inventory_items(user_id, ebay_item_id) 
WHERE ebay_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_ebay_offer 
ON inventory_items(user_id, ebay_offer_id) 
WHERE ebay_offer_id IS NOT NULL;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_items' 
  AND column_name IN ('description', 'condition', 'listing_price', 'sku', 'ebay_item_id', 'ebay_offer_id')
ORDER BY column_name;
