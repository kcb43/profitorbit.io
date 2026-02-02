-- Check if eBay transaction details were saved to sales table
SELECT 
  id,
  item_name,
  ebay_transaction_id,
  ebay_order_id,
  -- Fully displayed fields
  tracking_number,
  shipping_carrier,
  delivery_date,
  shipped_date,
  item_condition,
  -- Hidden fields
  buyer_address,
  payment_method,
  payment_status,
  payment_date,
  item_location,
  buyer_notes,
  ebay_buyer_username,
  created_at
FROM sales
WHERE user_id = '82bdb1aa-b2d2-4001-80ef-1196e5563cb9'
AND platform = 'eBay'
AND ebay_transaction_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
