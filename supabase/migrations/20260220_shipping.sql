-- ─────────────────────────────────────────────────────────────────────────────
-- Shipping Module
-- Tables: shipping_addresses, parcel_presets, shipments, shipping_labels
-- ─────────────────────────────────────────────────────────────────────────────

-- ── shipping_addresses ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_addresses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label         text NOT NULL DEFAULT 'Home',
  name          text NOT NULL,
  company       text,
  street1       text NOT NULL,
  street2       text,
  city          text NOT NULL,
  state         text NOT NULL,
  zip           text NOT NULL,
  country       text NOT NULL DEFAULT 'US',
  phone         text,
  email         text,
  is_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_addresses" ON shipping_addresses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS shipping_addresses_user_id_idx ON shipping_addresses(user_id);

-- ── parcel_presets ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcel_presets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  length          numeric(8,2) NOT NULL DEFAULT 0,
  width           numeric(8,2) NOT NULL DEFAULT 0,
  height          numeric(8,2) NOT NULL DEFAULT 0,
  distance_unit   text NOT NULL DEFAULT 'in',
  weight          numeric(8,2) NOT NULL DEFAULT 0,
  mass_unit       text NOT NULL DEFAULT 'lb',
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE parcel_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_parcels" ON parcel_presets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS parcel_presets_user_id_idx ON parcel_presets(user_id);

-- ── shipments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source                text NOT NULL DEFAULT 'manual',   -- 'manual' | 'shippo'
  carrier               text,
  tracking_number       text,
  status                text NOT NULL DEFAULT 'unknown',  -- 'unknown' | 'pre_transit' | 'in_transit' | 'delivered' | 'exception' | 'returned'
  shippo_tracking_id    text,
  to_name               text,
  to_address            jsonb,
  from_address          jsonb,
  events                jsonb DEFAULT '[]'::jsonb,
  last_event_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_shipments" ON shipments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS shipments_user_id_idx ON shipments(user_id);
CREATE INDEX IF NOT EXISTS shipments_tracking_number_idx ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS shipments_shippo_tracking_id_idx ON shipments(shippo_tracking_id);

-- ── shipping_labels ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_labels (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id                 uuid REFERENCES shipments(id) ON DELETE SET NULL,
  shippo_shipment_object_id   text,
  shippo_transaction_id       text,
  rate_amount                 numeric(10,2),
  rate_currency               text DEFAULT 'USD',
  carrier                     text,
  servicelevel                text,
  label_url                   text,
  tracking_number             text,
  status                      text DEFAULT 'VALID',       -- 'VALID' | 'REFUNDED' | 'REFUND_PENDING'
  from_address                jsonb,
  to_address                  jsonb,
  parcel                      jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_labels" ON shipping_labels
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS shipping_labels_user_id_idx ON shipping_labels(user_id);
CREATE INDEX IF NOT EXISTS shipping_labels_shipment_id_idx ON shipping_labels(shipment_id);
