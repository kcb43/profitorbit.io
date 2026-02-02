-- Add funds_status column to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS funds_status TEXT;

-- Add comment
COMMENT ON COLUMN sales.funds_status IS 'eBay funds availability status (e.g., Available, OnHold, Processing)';
