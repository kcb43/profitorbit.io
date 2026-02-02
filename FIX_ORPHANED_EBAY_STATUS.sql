-- Quick script to clear orphaned eBay import status
-- Run this in Supabase SQL Editor

-- STEP 1: See what will be affected (RUN THIS FIRST)
SELECT 
  id, 
  item_name, 
  ebay_transaction_id, 
  sale_date, 
  deleted_at,
  platform
FROM sales
WHERE platform = 'eBay'
AND ebay_transaction_id IS NOT NULL
AND deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- STEP 2: If you see results above, uncomment and run this to delete them:
/*
DELETE FROM sales
WHERE platform = 'eBay'
AND ebay_transaction_id IS NOT NULL
AND deleted_at IS NOT NULL;
*/

-- STEP 3: Verify deletion worked (should return 0 rows):
/*
SELECT COUNT(*) as orphaned_count
FROM sales
WHERE platform = 'eBay'
AND ebay_transaction_id IS NOT NULL
AND deleted_at IS NOT NULL;
*/
