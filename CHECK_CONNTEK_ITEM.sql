-- Check if Conntek item has deleted_at timestamp
SELECT 
  id,
  item_name,
  ebay_transaction_id,
  deleted_at,
  created_at
FROM sales
WHERE id = 'edd4c0a7-0dbe-4e5a-a537-fd24cc0197c4';

-- If deleted_at is NULL, then it was never soft-deleted
-- If deleted_at has a timestamp, the new backend code should filter it out
