---
title: "Sync Sales"
description: "Set up automatic sale syncing so sold items appear in your Orben records without manual entry."
tags: ["getting-started", "sales", "sync"]
updatedAt: "2026-02-20"
createdAt: "2026-02-10"
category: "Getting Started"
order: 50
difficulty: "beginner"
estimatedTime: 3
isFeatured: false
isNew: false
---

# Sync Sales

Orben can automatically detect sales from your connected marketplaces so you don't have to manually log every transaction.

## How sync works

Once a marketplace is connected, Orben periodically checks for new sales and imports them. When a sale is detected:

1. The inventory item is marked as **Sold**
2. A sale record is created with the sale price, marketplace fees, and shipping cost
3. Net profit is calculated based on your recorded purchase price

## Enabling auto-sync

Go to **Settings → Sync Settings** and toggle on **Auto-sync sales** for each marketplace you want monitored.

Sync runs every 15–30 minutes in the background.

## Manual sync

If you need data immediately, go to **Import** and click **Sync Recent Sales**. This forces an immediate check.

## What data syncs

- Sale price
- Buyer shipping cost
- Marketplace fee (estimated from platform rules)
- Tracking number (when available)
- Sale timestamp

## What doesn't sync automatically

- Your purchase price (set on the inventory item before sale)
- Custom fees (set in Settings if you have business expenses to track)
- Shipping supplies cost

## Reconciling manually entered sales

If you've already logged a sale manually and it later syncs from the marketplace, Orben may create a duplicate. You can merge or delete the duplicate from the Sales History page.

## Sync timing per platform

| Platform | Sync frequency |
|----------|---------------|
| eBay | Every 15 min |
| Mercari | Every 30 min |
| Facebook | Every 30 min |
| Poshmark | Every 30 min |

> Exact timing may vary based on marketplace API rate limits.
