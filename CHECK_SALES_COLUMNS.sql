-- Check if the eBay sales detail columns exist in the sales table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales'
AND column_name IN (
  'tracking_number',
  'shipping_carrier',
  'delivery_date',
  'shipped_date',
  'item_condition',
  'buyer_address',
  'payment_method',
  'payment_status',
  'payment_date',
  'item_location',
  'buyer_notes',
  'ebay_order_id',
  'ebay_transaction_id',
  'ebay_buyer_username'
)
ORDER BY column_name;
