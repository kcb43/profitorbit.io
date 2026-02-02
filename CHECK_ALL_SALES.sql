-- Check if there are ANY sales at all for this user
SELECT 
  id,
  item_name,
  platform,
  sale_date,
  created_at,
  deleted_at
FROM sales
WHERE user_id = '82bdb1aa-b2d2-4001-80ef-1196e5563cb9'
ORDER BY created_at DESC
LIMIT 10;
