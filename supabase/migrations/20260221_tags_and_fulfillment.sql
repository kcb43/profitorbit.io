-- ============================================================
-- Tags split + User Fulfillment Profile
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. inventory_items: add internal_tags + listing_keywords
-- ─────────────────────────────────────────────────────────────

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS internal_tags    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS listing_keywords TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_favorite      BOOLEAN DEFAULT false;

-- Indexes for tag filtering
CREATE INDEX IF NOT EXISTS idx_inventory_internal_tags    ON inventory_items USING GIN(internal_tags);
CREATE INDEX IF NOT EXISTS idx_inventory_listing_keywords ON inventory_items USING GIN(listing_keywords);
CREATE INDEX IF NOT EXISTS idx_inventory_is_favorite      ON inventory_items(user_id, is_favorite) WHERE is_favorite = true;

-- ─────────────────────────────────────────────────────────────
-- 2. User Fulfillment Profiles
-- One row per user. Controls whether AI generates pickup/shipping
-- lines and what those lines say.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_fulfillment_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Pickup
  pickup_enabled       BOOLEAN NOT NULL DEFAULT false,
  pickup_location_line TEXT,            -- "Pickup in Easton, MA 02356"
  pickup_notes         TEXT,            -- "Meet at police station, evenings only"

  -- Shipping
  shipping_enabled     BOOLEAN NOT NULL DEFAULT true,
  shipping_notes       TEXT,            -- "Ships next business day"

  -- Per-platform overrides (optional)
  -- { "facebook": "Pickup in Easton, MA. Can also ship.", "mercari": "Fast shipping.", "ebay": "Ships within 1 business day." }
  platform_notes       JSONB DEFAULT '{}',

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE user_fulfillment_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fulfillment_select_own" ON user_fulfillment_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fulfillment_insert_own" ON user_fulfillment_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fulfillment_update_own" ON user_fulfillment_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "fulfillment_delete_own" ON user_fulfillment_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_fulfillment_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fulfillment_updated_at
  BEFORE UPDATE ON user_fulfillment_profiles
  FOR EACH ROW EXECUTE FUNCTION update_fulfillment_updated_at();
