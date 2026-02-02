-- Fix orphaned eBay import status - Comprehensive solution
-- Run in Supabase SQL Editor

-- OPTION A: Hard delete all soft-deleted eBay sales (RECOMMENDED)
-- This permanently removes sales that were soft-deleted from Sales History page
DELETE FROM sales
WHERE platform = 'eBay'
AND ebay_transaction_id IS NOT NULL
AND deleted_at IS NOT NULL;

-- After running this, the Conntek item should no longer show as "imported"
-- on the eBay Import page.

-- OPTION B: If you want to see what will be deleted first (DRY RUN):
/*
SELECT 
  id,
  item_name,
  ebay_transaction_id,
  deleted_at
FROM sales
WHERE platform = 'eBay'
AND ebay_transaction_id IS NOT NULL
AND deleted_at IS NOT NULL;
*/
