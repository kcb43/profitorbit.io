-- Add listing_price column to inventory_items table
-- This is the price at which the item will be listed on marketplaces
-- Different from purchase_price (what the seller paid)

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS listing_price DECIMAL(10, 2);

-- Add comment
COMMENT ON COLUMN inventory_items.listing_price IS 'The price at which this item will be listed for sale on marketplaces';
