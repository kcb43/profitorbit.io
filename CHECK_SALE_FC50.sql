-- Check the sale record that was just created
SELECT
  id,
  item_name,
  platform,
  -- eBay identifiers
  ebay_transaction_id,
  ebay_order_id,
  ebay_buyer_username,
  -- Fully displayed fields
  tracking_number,
  shipping_carrier,
  delivery_date,
  shipped_date,
  item_condition,
  -- Hidden fields (check if they exist)
  buyer_address,
  payment_method,
  payment_status,
  payment_date,
  item_location,
  buyer_notes,
  created_at
FROM sales
WHERE id = 'fc50bc88-26de-4f6b-aa2a-a058b0963d2e';
