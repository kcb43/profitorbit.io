---
title: "Import Your Inventory"
description: "Pull your active listings from connected marketplaces into Orben's inventory system."
tags: ["getting-started", "import", "inventory"]
updatedAt: "2026-02-20"
createdAt: "2026-02-10"
category: "Getting Started"
order: 20
difficulty: "beginner"
estimatedTime: 5
isFeatured: false
isNew: false
---

# Import Your Inventory

Importing pulls your active marketplace listings into Orben so you can manage them from one place, track profit, and crosslist easily.

## Prerequisites

You need at least one marketplace connected before importing. See [Connect Mercari](/training/connect-mercari) or [Connect eBay](/training/connect-ebay).

## Running an import

1. Click **Import** in the left sidebar
2. Select which marketplace(s) to import from
3. Click **Run Import**
4. Wait for the import to complete (usually 1–5 minutes)

Orben will show a progress indicator and notify you when done.

## What gets imported

Each imported listing includes:
- Title and description
- Photos
- Current price
- Listing condition
- Marketplace-specific fields (size, brand, category)

What does **not** get imported automatically:
- Purchase price (you add this manually for profit tracking)
- Internal notes or tags

## Duplicate handling

If you import the same item twice, Orben detects the duplicate by marketplace item ID and skips it. Your existing inventory record is preserved.

## Partial imports

Sometimes not all items import on the first run. This can happen if:
- The marketplace API is rate-limited (Orben will retry)
- An item has a format Orben doesn't recognize yet
- The marketplace session expired mid-import

If you're missing items, wait 10 minutes and run the import again. See also: [Why import missed items](/training/troubleshooting-import-missed-items).

## After importing

Once your inventory is populated:
- Set purchase prices on items you want to track profit on
- Add items to crosslist queues
- Review any items flagged with issues
