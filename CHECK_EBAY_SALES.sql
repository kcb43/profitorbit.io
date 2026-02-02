-- Simple check: See what eBay sales exist for your account
-- Run this in Supabase SQL Editor

SELECT 
  id,
  item_name,
  ebay_transaction_id,
  ebay_order_id,
  sale_date,
  created_at
FROM sales
WHERE user_id = '82bdb1aa-b2d2-4001-80ef-1196e5563cb9'
AND platform = 'eBay'
ORDER BY created_at DESC;

-- If you see sales here that you already deleted, 
-- those are the ones causing the "imported" status to stick.
-- Copy the ebay_transaction_id values and let me know what you see.
