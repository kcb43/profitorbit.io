# Fix Missing Columns in Supabase Database

## Issue
Import is failing with errors like:
- `Could not find the 'condition' column`
- `Could not find the 'description' column`

This happens when Supabase's schema cache is outdated or migrations weren't run.

## Quick Fix

### Step 1: Run the Fix SQL
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `FIX_ALL_MISSING_COLUMNS.sql` and paste it
6. Click **Run** (or press Ctrl+Enter)

### Step 2: Verify
You should see output showing the columns exist:
```
column_name     | data_type
----------------|----------
condition       | text
description     | text
ebay_item_id    | text
ebay_offer_id   | text
listing_price   | numeric
sku             | text
```

### Step 3: Test Import
1. Go back to the Import page
2. Try importing an eBay item again
3. It should now work! ✅

## What This Does
- Adds all missing columns from migrations that didn't run
- Creates indexes for better performance
- Adds unique constraints to prevent duplicate imports
- Refreshes Supabase's schema cache
- Verifies columns were created successfully

## If Still Having Issues
If you still get errors after running this:
1. Check the Supabase logs for more details
2. Try running migrations manually: `supabase db push`
3. Contact me with the exact error message
