-- Add size field needed by CrosslistComposer (and some marketplace forms).
-- Safe to run multiple times.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS size TEXT;


