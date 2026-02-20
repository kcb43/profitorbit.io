---
title: "Troubleshooting: Listing Button Does Nothing"
description: "What to do when clicking Post Listing or Crosslist doesn't seem to work."
tags: ["troubleshooting", "crosslist", "listing"]
updatedAt: "2026-02-20"
createdAt: "2026-02-10"
category: "Troubleshooting"
order: 210
difficulty: "beginner"
estimatedTime: 3
isFeatured: false
isNew: false
---

# Troubleshooting: Listing Button Does Nothing

If you click the crosslist or post button and nothing happens, here's what to check.

## Check 1 — Validation errors

The form may have validation errors that need to be fixed before posting. Scroll up — red error messages usually appear at the top or inline near required fields.

Common required fields:
- Title (min 10 characters for most platforms)
- At least 1 photo
- Price (must be > $0)
- Category selected

## Check 2 — Marketplace connection issue

If your marketplace connection expired, the button may silently fail.

**Fix:**
1. Go to **Settings → Marketplace Connections**
2. Check that the platform you're posting to shows **Active**
3. If it shows **Expired** or **Disconnected**, reconnect it
4. Come back and try posting again

## Check 3 — Browser extensions blocking the request

Some ad blockers and privacy extensions (uBlock Origin, Privacy Badger) can block the API calls Orben makes to marketplace platforms.

**Fix:**
1. Temporarily disable your ad blocker for profitorbit.io
2. Try posting again
3. If it works, whitelist the site in your extension settings

## Check 4 — Browser console errors

If you're comfortable with developer tools:
1. Press F12 to open the browser console
2. Try clicking the listing button again
3. Look for red error messages in the Console tab
4. If you see a specific error, include it when contacting support

## Check 5 — Try a different browser

Test in a fresh Chrome or Edge window (incognito mode) to rule out a browser-specific issue.

## Still not working?

Use the live chat button in the bottom right of the app and include:
- Which marketplace you're trying to post to
- What the item is
- Any error text you see (even if it disappears quickly)
