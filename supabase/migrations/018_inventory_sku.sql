-- Add sku field needed by CrosslistComposer (and marketplace forms).
-- Safe to run multiple times.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS sku TEXT;


