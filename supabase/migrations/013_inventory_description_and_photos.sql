-- Add inventory item description + rich photos for crosslist/photo editor persistence
-- Safe to run multiple times.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Rich photo objects (stable ids). Example element:
-- { "id": "photo_123", "imageUrl": "...", "isMain": true, "fileName": "..." }
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;


