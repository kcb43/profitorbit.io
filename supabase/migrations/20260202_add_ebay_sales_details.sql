-- Add eBay transaction and shipping details to sales table
-- These fields will be populated when importing sold items from eBay

-- Fully displayed fields in Sales History edit page
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shipping_carrier TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shipped_date TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS item_condition TEXT;

-- Hidden fields (shown behind "Additional Details" button)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS buyer_address JSONB; -- { name, street1, street2, city, state, zip, country, phone }
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS item_location TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS buyer_notes TEXT;

-- Add eBay identifiers for linking back to orders
ALTER TABLE sales ADD COLUMN IF NOT EXISTS ebay_order_id TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS ebay_transaction_id TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS ebay_buyer_username TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sales_tracking_number ON sales(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_ebay_order_id ON sales(ebay_order_id) WHERE ebay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_delivery_date ON sales(delivery_date) WHERE delivery_date IS NOT NULL;
