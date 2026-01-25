-- Add ebay_item_id column to inventory_items table for import tracking

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS ebay_item_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_items_ebay_item_id 
ON inventory_items(ebay_item_id) 
WHERE ebay_item_id IS NOT NULL;

-- Add unique constraint to prevent duplicate imports
ALTER TABLE inventory_items 
ADD CONSTRAINT IF NOT EXISTS unique_user_ebay_item 
UNIQUE (user_id, ebay_item_id);
