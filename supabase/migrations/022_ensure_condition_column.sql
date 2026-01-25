-- Ensure condition column exists in inventory_items table
-- This should already exist from 001_initial_schema.sql but adding as a safety measure

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS condition TEXT;

-- Add index for faster filtering by condition
CREATE INDEX IF NOT EXISTS idx_inventory_items_condition 
ON inventory_items(condition) 
WHERE condition IS NOT NULL;
