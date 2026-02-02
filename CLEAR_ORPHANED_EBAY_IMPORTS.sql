-- Clear imported status for eBay items that have sales records deleted
-- This will re-enable the import button for those items

-- OPTION 1: View what will be deleted (DRY RUN)
-- Run this first to see what records exist:
SELECT id, item_name, ebay_transaction_id, sale_date, deleted_at
FROM sales
WHERE platform = 'eBay'
AND ebay_transaction_id IS NOT NULL
AND deleted_at IS NOT NULL;

-- OPTION 2: Actually delete the soft-deleted records (RECOMMENDED)
-- This permanently removes sales that were previously deleted:
-- DELETE FROM sales
-- WHERE platform = 'eBay'
-- AND ebay_transaction_id IS NOT NULL
-- AND deleted_at IS NOT NULL;

-- OPTION 3: Clear ebay_transaction_id from deleted sales (keeps records)
-- This keeps the deleted sales but clears the transaction ID so items can be re-imported:
-- UPDATE sales 
-- SET ebay_transaction_id = NULL 
-- WHERE platform = 'eBay'
-- AND ebay_transaction_id IS NOT NULL
-- AND deleted_at IS NOT NULL;
