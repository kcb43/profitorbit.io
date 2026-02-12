-- Add sales grouping and quantity tracking
-- This allows tracking multiple sales of the same inventory item (multi-quantity listings)

-- Add quantity sold field to sales table (defaults to 1 for existing sales)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS quantity_sold INTEGER DEFAULT 1;

-- Add sale group identifier (for linking related sales)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_group_id UUID;

-- Add index for grouping queries
CREATE INDEX IF NOT EXISTS idx_sales_inventory_id ON sales(inventory_id) WHERE inventory_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_sale_group_id ON sales(sale_group_id) WHERE sale_group_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN sales.quantity_sold IS 'Number of units sold in this transaction (from multi-quantity listings)';
COMMENT ON COLUMN sales.sale_group_id IS 'Links related sales together (e.g., multiple sales of the same item from a multi-quantity listing)';
