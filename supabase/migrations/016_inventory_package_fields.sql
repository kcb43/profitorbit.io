-- Add package/shipping fields needed by CrosslistComposer.
-- Safe to run multiple times.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS package_details TEXT,
  ADD COLUMN IF NOT EXISTS package_weight TEXT,
  ADD COLUMN IF NOT EXISTS package_length TEXT,
  ADD COLUMN IF NOT EXISTS package_width TEXT,
  ADD COLUMN IF NOT EXISTS package_height TEXT;


