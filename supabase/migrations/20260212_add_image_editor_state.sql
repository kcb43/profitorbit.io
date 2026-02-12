-- Add image_editor_state column to inventory_items table
-- This stores the Filerobot design state for each edited image

ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS image_editor_state TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN inventory_items.image_editor_state IS 'JSON string storing Filerobot Image Editor design states keyed by image URL';
