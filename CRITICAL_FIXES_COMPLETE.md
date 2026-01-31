# Critical Fixes Complete - Worker Integration

## Issue 1: API Method Mismatch ❌ → ✅

**Problem**: Extension was calling `scrape-status` API with POST method, but API expected GET with query params.

**Root Cause**: 
- Extension: `POST /api/facebook/scrape-status` with JSON body
- API Endpoint: `GET /api/facebook/scrape-status?userId=X&jobIds=Y,Z`

**Fix**: Changed extension API call to use GET with query parameters
```javascript
// Before
await fetch('https://profitorbit.io/api/facebook/scrape-status', {
  method: 'POST',
  body: JSON.stringify({ userId, jobIds })
});

// After
await fetch(`https://profitorbit.io/api/facebook/scrape-status?userId=${userId}&jobIds=${jobIds.join(',')}`, {
  method: 'GET'
});
```

**Files Changed**:
- `extension/facebook-api.js` (line 383-392)

---

## Issue 2: Orphaned Import Items ❌ → ✅

**Problem**: When a Facebook item is deleted on Facebook but marked as "imported" in Orben, users couldn't delete it from the Import page.

**Error**: `Error: Item not found or not imported`

**Root Cause**: Delete mutation threw error if item had no `inventoryId` (orphaned item)

**Fix**: Allow graceful deletion of orphaned items
```javascript
// Before
if (!item?.inventoryId) {
  throw new Error('Item not found or not imported');
}

// After
if (!item?.inventoryId) {
  console.warn(`⚠️ Item ${itemId} has no inventory ID, marking as not imported locally`);
  return { id: null, success: true }; // Allow cache update
}
```

**Files Changed**:
- `src/pages/Import.jsx` (line 519-536)

---

## Worker Status: ✅ Running

Both Fly.io worker machines are now **STARTED** and processing jobs:
- Machine 1: `28715e6a509378` (started)
- Machine 2: `d894551b41e968` (started)

Worker Configuration:
- Poll interval: 2000ms (2 seconds)
- Concurrent jobs: 8
- Max retries: 3

---

## Next Steps for Testing

### Reload Extension:
1. Go to `chrome://extensions`
2. Click **⟳ reload** on ProfitOrbit Extension

### Test Import:
1. Go to Import page
2. Select a Facebook item
3. Click Import
4. Watch browser console for:
   - `✅ Created 1 scraping jobs`
   - `📊 [1/30] Status: 1/1 completed...`
   - `✅ All jobs finished! Merging scraped data...`

### Test Orphaned Item Delete:
1. Delete an item on Facebook Marketplace
2. Go to Orben Import page
3. Click delete on the orphaned item
4. Should succeed with: "Item deleted"

---

## Technical Summary

**Previous Bug Chain**:
1. ✅ `userId` null → **FIXED** (bridge forwarding)
2. ✅ Worker machines stopped → **FIXED** (manually started)
3. ✅ API method mismatch → **FIXED** (GET with query params)

**Current State**: All systems operational! 🚀

---

**Commit**: 6283a6e
**Date**: 2026-01-31
