-- Add brand column to inventory_items so CrosslistComposer can save brand without schema errors.
-- Safe to run multiple times.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS brand TEXT;


