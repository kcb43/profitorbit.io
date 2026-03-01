-- Create marketplace_listings table
-- Replaces localStorage-based tracking with a proper DB table.
-- Each row links an inventory item to a specific marketplace listing.

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('ebay', 'facebook', 'mercari', 'poshmark', 'etsy')),
  marketplace_listing_id TEXT,          -- Platform's own listing/item ID
  marketplace_listing_url TEXT,         -- Direct URL to the listing
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'removed', 'processing', 'draft')),
  listed_at TIMESTAMPTZ,
  delisted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One listing per marketplace per inventory item
  UNIQUE(inventory_item_id, marketplace)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user
  ON marketplace_listings(user_id);

-- Index for looking up by marketplace item ID (dedup on import)
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_mid
  ON marketplace_listings(marketplace, marketplace_listing_id);

-- Index for inventory item lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_item
  ON marketplace_listings(inventory_item_id);

-- RLS policies
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketplace_listings_select ON marketplace_listings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY marketplace_listings_insert ON marketplace_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY marketplace_listings_update ON marketplace_listings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY marketplace_listings_delete ON marketplace_listings
  FOR DELETE USING (auth.uid() = user_id);

-- Also add facebook_item_id column to inventory_items if missing
-- (Mercari already has mercari_item_id, eBay has ebay_item_id, but Facebook was missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'facebook_item_id'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN facebook_item_id TEXT;
  END IF;
END $$;
