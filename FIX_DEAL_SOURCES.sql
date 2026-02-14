# Orben Deal Sources - Manual Fix SQL

Run these SQL queries in Supabase SQL Editor in order:

## Step 1: Delete Duplicates (Keep Most Successful)
```sql
-- Delete duplicate Slickdeals (keep the one with most recent success)
DELETE FROM deal_sources 
WHERE id = '88326fea-2f87-467d-87c6-f284cd40b26e';

-- Delete duplicate Brad's Deals
DELETE FROM deal_sources 
WHERE id = 'a5a1f0f5-21fa-406a-b5ec-dbc730a7d890';

-- Delete duplicate Woot
DELETE FROM deal_sources 
WHERE id = 'f904076c-c98c-4a44-9b87-96181823c5e1';

-- Delete duplicate TechBargains
DELETE FROM deal_sources 
WHERE id = 'b86208c7-7358-4c82-bf52-3fe9f45c00c3';

-- Delete duplicate DealNews
DELETE FROM deal_sources 
WHERE id = 'cfef921c-9db5-4455-b21f-0265e73879d3';

-- Delete duplicate DealCatcher
DELETE FROM deal_sources 
WHERE id = '50f24031-03c4-4032-8692-c11e514d7786';

-- Delete duplicate Manual Submissions
DELETE FROM deal_sources 
WHERE id = 'dde3509b-a314-4a46-8322-49476e331a83';
```

## Step 2: Add Reddit Sources (No Conflict Check)
```sql
-- Add Reddit sources
INSERT INTO deal_sources (name, type, base_url, rss_url, enabled, poll_interval_minutes, notes)
VALUES 
  ('Reddit - r/buildapcsales', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/buildapcsales/.rss', true, 30, 'PC components and tech deals'),
  ('Reddit - r/frugalmalefashion', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/frugalmalefashion/.rss', true, 30, 'Mens fashion deals'),
  ('Reddit - r/GameDeals', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/GameDeals/.rss', true, 30, 'Video game deals'),
  ('Reddit - r/deals', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/deals/.rss', true, 30, 'General deals'),
  ('Reddit - r/consoledeals', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/consoledeals/.rss', true, 30, 'Console gaming deals');
```

## Step 3: Add Other Missing Sources
```sql
INSERT INTO deal_sources (name, type, base_url, rss_url, enabled, poll_interval_minutes, notes)
VALUES 
  ('Kinja Deals', 'rss', 'https://deals.kinja.com', 'https://deals.kinja.com/rss', true, 45, 'Gizmodo media deals'),
  ('The Verge Deals', 'rss', 'https://www.theverge.com', 'https://www.theverge.com/rss/deals/index.xml', true, 45, 'Tech deals from The Verge'),
  ('CNET Deals', 'rss', 'https://www.cnet.com', 'https://www.cnet.com/rss/deals/', true, 45, 'CNET curated tech deals'),
  ('Wirecutter Deals', 'rss', 'https://www.nytimes.com/wirecutter', 'https://www.nytimes.com/wirecutter/rss/deals/', true, 60, 'NYT Wirecutter deals');
```

## Step 4: Reset Fail Counts (Give Failed Sources Another Try)
```sql
UPDATE deal_sources
SET fail_count = 0
WHERE fail_count >= 3;
```

## Step 5: Add Unique Constraint (Prevents Future Duplicates)
```sql
-- Add unique constraint on name
ALTER TABLE deal_sources
ADD CONSTRAINT deal_sources_name_unique UNIQUE (name);
```

---

## Quick Copy-Paste (All Steps Combined)
```sql
-- Step 1: Remove duplicates
DELETE FROM deal_sources WHERE id IN (
  '88326fea-2f87-467d-87c6-f284cd40b26e',
  'a5a1f0f5-21fa-406a-b5ec-dbc730a7d890',
  'f904076c-c98c-4a44-9b87-96181823c5e1',
  'b86208c7-7358-4c82-bf52-3fe9f45c00c3',
  'cfef921c-9db5-4455-b21f-0265e73879d3',
  '50f24031-03c4-4032-8692-c11e514d7786',
  'dde3509b-a314-4a46-8322-49476e331a83'
);

-- Step 2: Add Reddit sources
INSERT INTO deal_sources (name, type, base_url, rss_url, enabled, poll_interval_minutes, notes)
VALUES 
  ('Reddit - r/buildapcsales', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/buildapcsales/.rss', true, 30, 'PC deals'),
  ('Reddit - r/frugalmalefashion', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/frugalmalefashion/.rss', true, 30, 'Fashion deals'),
  ('Reddit - r/GameDeals', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/GameDeals/.rss', true, 30, 'Game deals'),
  ('Reddit - r/deals', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/deals/.rss', true, 30, 'General deals'),
  ('Reddit - r/consoledeals', 'rss', 'https://reddit.com', 'https://www.reddit.com/r/consoledeals/.rss', true, 30, 'Console deals');

-- Step 3: Add other sources
INSERT INTO deal_sources (name, type, base_url, rss_url, enabled, poll_interval_minutes, notes)
VALUES 
  ('Kinja Deals', 'rss', 'https://deals.kinja.com', 'https://deals.kinja.com/rss', true, 45, 'Gizmodo deals'),
  ('The Verge Deals', 'rss', 'https://www.theverge.com', 'https://www.theverge.com/rss/deals/index.xml', true, 45, 'Tech deals'),
  ('CNET Deals', 'rss', 'https://www.cnet.com', 'https://www.cnet.com/rss/deals/', true, 45, 'CNET deals'),
  ('Wirecutter Deals', 'rss', 'https://www.nytimes.com/wirecutter', 'https://www.nytimes.com/wirecutter/rss/deals/', true, 60, 'Wirecutter deals');

-- Step 4: Reset fail counts
UPDATE deal_sources SET fail_count = 0 WHERE fail_count >= 3;

-- Step 5: Add unique constraint
ALTER TABLE deal_sources ADD CONSTRAINT deal_sources_name_unique UNIQUE (name);
```

---

## What This Does:
1. **Removes 7 duplicate entries** (keeps the best performing ones)
2. **Adds 5 Reddit sources** (huge deal volume)
3. **Adds 4 tech/lifestyle sources** (quality curated deals)
4. **Resets fail counts** (gives failed RSS feeds another chance)
5. **Prevents future duplicates** (unique constraint on name)

After running this, your deal worker will automatically pick up the new sources within 60 seconds!
