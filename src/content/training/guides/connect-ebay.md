---
title: "Connect eBay"
description: "Authorize Orben with your eBay account using OAuth to sync listings, sales, and traffic reports."
tags: ["getting-started", "ebay", "marketplace-connection"]
updatedAt: "2026-02-20"
createdAt: "2026-02-10"
category: "Getting Started"
order: 11
difficulty: "beginner"
estimatedTime: 3
isFeatured: false
isNew: false
---

# Connect eBay

eBay uses OAuth for a secure, token-based connection. This means Orben never sees your eBay password — it gets a limited-access token instead.

## How to connect

1. Go to **Settings → Marketplace Connections**
2. Click **Connect** next to eBay
3. You'll be redirected to eBay's login page
4. Log in and click **I Agree** to authorize Orben
5. You'll be redirected back automatically

## What Orben can do with eBay access

- Import your active eBay listings into inventory
- Sync eBay sales automatically
- Fetch traffic data (views, watchers) for your listings
- Submit offers to buyers on eligible listings
- Crosslist items from inventory to eBay

## Token expiry

eBay tokens expire after 18 months. Orben will notify you when your token needs refreshing. If eBay data stops syncing, go to Settings and reconnect.

## Troubleshooting

**Redirected to eBay but nothing happened**
- Disable any popup blockers for profitorbit.io
- Try in an incognito/private window

**Import shows 0 items**
- Make sure your eBay account has active listings
- eBay import only pulls "active" listings (not ended or sold)
