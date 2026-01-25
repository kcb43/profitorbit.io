-- Add ebay_offer_id column to inventory_items table for import tracking

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS ebay_offer_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_items_ebay_offer_id 
ON inventory_items(ebay_offer_id) 
WHERE ebay_offer_id IS NOT NULL;

-- Add unique constraint to prevent duplicate imports
-- Note: Using a partial unique constraint to allow NULL values
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_ebay_offer 
ON inventory_items(user_id, ebay_offer_id) 
WHERE ebay_offer_id IS NOT NULL;
