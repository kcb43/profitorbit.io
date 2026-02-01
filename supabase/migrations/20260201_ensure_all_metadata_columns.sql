-- Ensure ALL metadata columns exist for inventory items
-- This is a comprehensive migration to add any missing columns

-- Add brand column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'brand') THEN
        ALTER TABLE inventory_items ADD COLUMN brand TEXT;
        RAISE NOTICE 'Added brand column';
    ELSE
        RAISE NOTICE 'brand column already exists';
    END IF;
END $$;

-- Add condition column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'condition') THEN
        ALTER TABLE inventory_items ADD COLUMN condition TEXT;
        RAISE NOTICE 'Added condition column';
    ELSE
        RAISE NOTICE 'condition column already exists';
    END IF;
END $$;

-- Add size column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'size') THEN
        ALTER TABLE inventory_items ADD COLUMN size TEXT;
        RAISE NOTICE 'Added size column';
    ELSE
        RAISE NOTICE 'size column already exists';
    END IF;
END $$;

-- Add listing_price column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'listing_price') THEN
        ALTER TABLE inventory_items ADD COLUMN listing_price DECIMAL(10, 2);
        RAISE NOTICE 'Added listing_price column';
    ELSE
        RAISE NOTICE 'listing_price column already exists';
    END IF;
END $$;

-- Add description column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'description') THEN
        ALTER TABLE inventory_items ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column';
    ELSE
        RAISE NOTICE 'description column already exists';
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN inventory_items.brand IS 'Brand name of the item';
COMMENT ON COLUMN inventory_items.condition IS 'Item condition (e.g., "New", "Used - Good")';
COMMENT ON COLUMN inventory_items.size IS 'Item size (e.g., "10.5", "M", "XL")';
COMMENT ON COLUMN inventory_items.listing_price IS 'The price at which this item will be listed for sale on marketplaces';
COMMENT ON COLUMN inventory_items.description IS 'Detailed description of the item';
