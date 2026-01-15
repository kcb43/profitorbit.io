-- Add color fields to inventory_items for CrosslistComposer.
-- Safe to run multiple times.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS color1 TEXT,
  ADD COLUMN IF NOT EXISTS color2 TEXT;


