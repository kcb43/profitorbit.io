-- Add zip_code field needed by CrosslistComposer (general.zip maps to inventory_items.zip_code).
-- Safe to run multiple times.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS zip_code TEXT;


