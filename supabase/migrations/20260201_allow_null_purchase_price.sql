-- Make purchase_price nullable for Facebook/Mercari imports
-- Migration: Allow null purchase_price for marketplace imports where cost is unknown

-- Remove NOT NULL constraint from purchase_price
ALTER TABLE inventory_items 
ALTER COLUMN purchase_price DROP NOT NULL;

-- Add comment to explain why it can be null
COMMENT ON COLUMN inventory_items.purchase_price IS 'Purchase price/cost - can be null for marketplace imports (Facebook, Mercari) where the original cost is unknown';
