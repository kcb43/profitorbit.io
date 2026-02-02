-- Debug script to understand orphaned import status issue
-- Run each query separately in Supabase SQL Editor

-- Query 1: Check if deleted_at column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales' 
AND column_name = 'deleted_at';

-- Query 2: See ALL eBay sales (deleted or not)
SELECT 
  id, 
  item_name, 
  ebay_transaction_id, 
  ebay_order_id,
  sale_date,
  created_at,
  CASE 
    WHEN deleted_at IS NOT NULL THEN 'DELETED'
    ELSE 'ACTIVE'
  END as status
FROM sales
WHERE platform = 'eBay'
AND ebay_transaction_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Query 3: Check if there are ANY soft-deleted sales at all
SELECT COUNT(*) as soft_deleted_count
FROM sales
WHERE deleted_at IS NOT NULL;

-- Query 4: Check sales table structure for user
SELECT 
  id,
  item_name,
  platform,
  ebay_transaction_id,
  created_at
FROM sales
WHERE user_id = '82bdb1aa-b2d2-4001-80ef-1196e5563cb9'
AND platform = 'eBay'
ORDER BY created_at DESC
LIMIT 10;
