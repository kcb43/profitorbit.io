# Fix Condition Column Missing Error

## Issue
Import is failing with error: `Could not find the 'condition' column of 'inventory_items' in the schema cache`

## Solution
Run the migration file to ensure the `condition` column exists.

## Steps to Fix:

### Option 1: Via Supabase Dashboard (Easiest)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste this SQL:

```sql
-- Ensure condition column exists in inventory_items table
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS condition TEXT;

-- Add index for faster filtering by condition
CREATE INDEX IF NOT EXISTS idx_inventory_items_condition 
ON inventory_items(condition) 
WHERE condition IS NOT NULL;
```

6. Click **Run** (or press Ctrl+Enter)
7. You should see "Success. No rows returned"

### Option 2: Via Supabase CLI
```bash
supabase db push
```

## Verify the Fix
After running the migration:
1. Go back to the Import page
2. Try importing an eBay item again
3. It should now work successfully!

## What This Does
- Adds the `condition` column if it doesn't exist
- Creates an index for better performance when filtering by condition
- The column stores item condition like "New", "Used", "Like New", etc. from eBay
