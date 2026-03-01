-- Migrate existing inventory items from old Orben categories to new Mercari-based categories.
-- Items that don't match any mapping go to "Uncategorized".

UPDATE inventory_items SET category = CASE category
  WHEN 'Antiques' THEN 'Vintage & Collectibles'
  WHEN 'Books, Movies & Music' THEN 'Books'
  WHEN 'Clothing & Apparel' THEN 'Women'
  WHEN 'Collectibles' THEN 'Vintage & Collectibles'
  WHEN 'Gym/Workout' THEN 'Sports & Outdoors'
  WHEN 'Health & Beauty' THEN 'Beauty'
  WHEN 'Home & Garden' THEN 'Home'
  WHEN 'Jewelry & Watches' THEN 'Women'
  WHEN 'Kitchen' THEN 'Home'
  WHEN 'Makeup' THEN 'Beauty'
  WHEN 'Mic/Audio Equipment' THEN 'Electronics'
  WHEN 'Motorcycle' THEN 'Other'
  WHEN 'Motorcycle Accessories' THEN 'Other'
  WHEN 'Pets' THEN 'Pet Supplies'
  WHEN 'Pool Equipment' THEN 'Garden & Outdoor'
  WHEN 'Shoes/Sneakers' THEN 'Men'
  WHEN 'Sporting Goods' THEN 'Sports & Outdoors'
  WHEN 'Stereos & Speakers' THEN 'Electronics'
  WHEN 'Toys & Hobbies' THEN 'Toys & Collectibles'
  WHEN 'Yoga' THEN 'Sports & Outdoors'
  ELSE category  -- Keep Electronics, Tools, and any already-correct categories as-is
END
WHERE category IN (
  'Antiques', 'Books, Movies & Music', 'Clothing & Apparel', 'Collectibles',
  'Gym/Workout', 'Health & Beauty', 'Home & Garden', 'Jewelry & Watches',
  'Kitchen', 'Makeup', 'Mic/Audio Equipment', 'Motorcycle', 'Motorcycle Accessories',
  'Pets', 'Pool Equipment', 'Shoes/Sneakers', 'Sporting Goods', 'Stereos & Speakers',
  'Toys & Hobbies', 'Yoga'
);

-- Also migrate sales table
UPDATE sales SET category = CASE category
  WHEN 'Antiques' THEN 'Vintage & Collectibles'
  WHEN 'Books, Movies & Music' THEN 'Books'
  WHEN 'Clothing & Apparel' THEN 'Women'
  WHEN 'Collectibles' THEN 'Vintage & Collectibles'
  WHEN 'Gym/Workout' THEN 'Sports & Outdoors'
  WHEN 'Health & Beauty' THEN 'Beauty'
  WHEN 'Home & Garden' THEN 'Home'
  WHEN 'Jewelry & Watches' THEN 'Women'
  WHEN 'Kitchen' THEN 'Home'
  WHEN 'Makeup' THEN 'Beauty'
  WHEN 'Mic/Audio Equipment' THEN 'Electronics'
  WHEN 'Motorcycle' THEN 'Other'
  WHEN 'Motorcycle Accessories' THEN 'Other'
  WHEN 'Pets' THEN 'Pet Supplies'
  WHEN 'Pool Equipment' THEN 'Garden & Outdoor'
  WHEN 'Shoes/Sneakers' THEN 'Men'
  WHEN 'Sporting Goods' THEN 'Sports & Outdoors'
  WHEN 'Stereos & Speakers' THEN 'Electronics'
  WHEN 'Toys & Hobbies' THEN 'Toys & Collectibles'
  WHEN 'Yoga' THEN 'Sports & Outdoors'
  ELSE category
END
WHERE category IN (
  'Antiques', 'Books, Movies & Music', 'Clothing & Apparel', 'Collectibles',
  'Gym/Workout', 'Health & Beauty', 'Home & Garden', 'Jewelry & Watches',
  'Kitchen', 'Makeup', 'Mic/Audio Equipment', 'Motorcycle', 'Motorcycle Accessories',
  'Pets', 'Pool Equipment', 'Shoes/Sneakers', 'Sporting Goods', 'Stereos & Speakers',
  'Toys & Hobbies', 'Yoga'
);
