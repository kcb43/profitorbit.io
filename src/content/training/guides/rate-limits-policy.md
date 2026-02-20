---
title: "Rate Limits & Sync Timing"
description: "How often Orben syncs data and why marketplace rate limits affect import speed."
tags: ["policy", "sync", "rate-limits"]
updatedAt: "2026-02-20"
createdAt: "2026-02-10"
category: "Policies & Limits"
order: 300
difficulty: "intermediate"
estimatedTime: 4
isFeatured: false
isNew: false
---

# Rate Limits & Sync Timing

Orben syncs with marketplaces frequently, but each platform limits how often we can request data. Here's what you need to know.

## Sync frequency

| Feature | Frequency |
|---------|-----------|
| Sales sync | Every 15–30 min |
| Inventory status check | Every 1–2 hours |
| Manual import | On demand |
| Deal feed refresh | Every 10 minutes |
| Traffic data (eBay) | Every 6 hours |

## Why rate limits exist

Marketplaces (eBay, Mercari, etc.) limit API access to prevent overloading their systems. Each platform has quotas like "1,000 requests per hour." When Orben hits a limit, it backs off and retries after a cooldown period.

This is normal and expected. It doesn't mean anything is wrong.

## What happens when a rate limit is hit

1. Orben pauses the current import or sync operation
2. A cooldown timer starts (usually 15–60 minutes)
3. The operation resumes automatically
4. You may see a partial import result until the cooldown clears

## How to work within limits

**Don't trigger multiple imports back-to-back.** This uses your quota faster without getting more data. Run one import and wait for it to fully complete.

**Use incremental sync.** The default "recent items" sync is much more efficient than a full re-import. Only use full re-import when you genuinely need it.

**Time your imports.** Marketplace API quotas often reset on the hour. If you ran out of quota, wait for the next hour mark and try again.

## Platform-specific notes

**eBay** — Uses official OAuth API. Quotas are generous (hundreds of thousands of calls/day for most endpoints).

**Mercari** — Session-based, no official API. More rate-limited and fragile. Keep your session active and don't run large imports too frequently.

**Facebook Marketplace** — Very strict on scraping. Import runs slowly to stay within acceptable limits.
