-- Clear imported status for eBay items that have sales records deleted
-- This will re-enable the import button for those items

-- First, let's see what would be affected (DRY RUN)
-- Uncomment the next 4 lines to see what will be cleared:
-- SELECT ebay_transaction_id, item_name, sale_date, deleted_at
-- FROM sales
-- WHERE platform = 'eBay'
-- AND deleted_at IS NOT NULL;

-- To actually clear the imported status:
-- This removes the sales records that were soft-deleted
DELETE FROM sales
WHERE platform = 'eBay'
AND ebay_transaction_id IS NOT NULL
AND deleted_at IS NOT NULL;

-- OPTIONAL: If you also want to clear ALL eBay transaction IDs from sales
-- to force a fresh import (WARNING: This will clear import history):
-- UPDATE sales SET ebay_transaction_id = NULL WHERE platform = 'eBay';
