---
title: "Troubleshooting: Mercari Won't Connect"
description: "Fix the most common reasons Mercari fails to connect or loses its connection in Orben."
tags: ["troubleshooting", "mercari", "marketplace-connection"]
updatedAt: "2026-02-20"
createdAt: "2026-02-10"
category: "Troubleshooting"
order: 200
difficulty: "beginner"
estimatedTime: 5
isFeatured: false
isNew: false
---

# Troubleshooting: Mercari Won't Connect

Mercari uses a session-based connection (not OAuth) which means it can be more finicky than eBay. Here are the most common issues and fixes.

## Error: "Connection failed"

**Cause:** Your Mercari session isn't active in the browser.

**Fix:**
1. Open a new tab and go to mercari.com
2. Log in to your account
3. Come back to Orben and try connecting again

Don't close the Mercari tab until the connection succeeds.

## Error: "Session expired"

**Cause:** Mercari sessions expire periodically (usually every few days to weeks).

**Fix:**
1. Go to Settings → Marketplace Connections
2. Click **Reconnect** next to Mercari
3. Log in to Mercari again
4. Return to Orben — the connection will be refreshed

## Mercari shows Connected but data isn't syncing

**Possible causes:**
- Your Mercari account has no active listings
- Your Mercari account is in a restricted state
- The session expired recently

**Fix:**
1. Go to Settings and disconnect Mercari
2. Wait 2 minutes
3. Reconnect using the steps above
4. Run a manual import

## Mercari connected but import shows wrong items

This happens when you have multiple Mercari accounts. Make sure you're logged into the correct Mercari account in the browser before connecting.

## Still stuck?

If none of these fixes work:
1. Clear your browser cookies for mercari.com
2. Log in to Mercari fresh
3. Try the connection again

If the problem persists, contact support via the chat button in the bottom right of the app.
