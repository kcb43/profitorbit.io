---
title: "Troubleshooting: Import Missed Items"
description: "Why some listings don't import and what you can do about it."
tags: ["troubleshooting", "import", "inventory"]
updatedAt: "2026-02-20"
createdAt: "2026-02-10"
category: "Troubleshooting"
order: 220
difficulty: "beginner"
estimatedTime: 5
isFeatured: false
isNew: false
---

# Troubleshooting: Import Missed Items

After running an import, you might notice some listings are missing. This is more common than you'd think and usually has a simple explanation.

## Most common reasons

### 1. The listing is in a non-active state

Orben imports **active** listings — items currently for sale. Items that are:
- Ended (listing expired)
- Sold
- Draft / saved but not posted
- Scheduled but not live yet

...will not be imported.

**Fix:** Check your marketplace dashboard and confirm the items are actually active/live.

### 2. Rate limiting

Marketplaces limit how many data requests Orben can make per hour. If you have a very large inventory (500+ items), the first import might only get 200–300 items.

**Fix:** Wait 30–60 minutes and run the import again. Orben picks up where it left off.

### 3. The marketplace session expired mid-import

If your Mercari session expired partway through a large import, the import stops silently.

**Fix:**
1. Reconnect Mercari (Settings → Marketplace Connections)
2. Run the import again

### 4. Item format not recognized

Occasionally an item has an unusual format that Orben can't parse (e.g., a bundle listing with unusual structure).

**Fix:** These items typically need to be added manually via **Add Inventory Item**.

### 5. Already imported (but you can't find it)

The item may already be in your inventory but filtered out of your current view.

**Fix:**
1. Go to Inventory
2. Clear any active filters (search, status, platform)
3. Search for the item title
4. Check the "Sold" tab — it may have sold before the import ran

## Running a fresh import

If you want to do a clean re-import:
1. Go to Import
2. Click **Full Import** (not incremental)
3. This pulls everything from scratch

Note: This doesn't delete existing inventory — it just adds any new items.
