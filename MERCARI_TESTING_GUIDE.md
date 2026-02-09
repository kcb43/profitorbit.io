# Testing Mercari Sold Items Sync

## Critical Steps to Test

### 1. Reload the Extension
```
1. Open chrome://extensions/
2. Find "Profit Orbit Extension"
3. Click the reload icon 🔄
4. OR: Remove and re-add the extension from the unpacked folder
```

### 2. Clear All Caches
```
1. Close ALL Mercari tabs
2. Close ALL Profit Orbit tabs
3. Hard refresh Profit Orbit: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
4. Clear browser cache if needed (Ctrl+Shift+Delete)
```

### 3. Test the Sync
```
1. Open Profit Orbit Import page
2. Select "Mercari" as source
3. Select "All (On Sale & Sold Out)" from dropdown
4. Click "Get latest items"
5. Verify:
   ✅ Both on-sale AND sold items appear
   ✅ Green "Sold" badge appears on sold items
   ✅ Blue "On Sale" badge appears on active items
   ✅ No errors in console
```

### 4. Check Console Logs
Look for these logs to confirm new code is loaded:

**Extension Background:**
```
EXT BUILD: 2026-02-01-mercari-user-items-query
```

**Extension Bridge:**
```
🔵🔵🔵 BRIDGE BUILD: 2026-02-01-23-59-USER-ITEMS-QUERY 🔵🔵🔵
```

**Mercari API:**
```
🟣 Mercari API module loading (v3.1.0-user-items-query)...
📡 Fetching Mercari listings via userItemsQuery...
📊 Status mapping: all -> on_sale
✅ Fetched X Mercari listings (total: Y, hasMore: false)
```

### 5. Verify New Metadata
Open Console and check that items have new fields:
```javascript
// In console, after sync:
const mercariItems = JSON.parse(localStorage.getItem('mercari_listings_all'));
console.log('First item:', mercariItems[0]);

// Should see:
// - favorites: 5
// - numLikes: 3
// - autoLiked: false
// - startTime: "2025-12-15T..."
```

## Expected Behavior

### Status Dropdown
- "On Sale" - Shows only active items
- "Sold Out" - Shows only sold items  
- "All (On Sale & Sold Out)" - Shows both with status badges

### Status Badges
- **Sold** - Green badge on sold items
- **On Sale** - Blue badge on active items
- Only visible when "All" is selected

### What Changed
1. **API Query**: Now using `userItemsQuery` (the correct one!)
2. **Request Method**: GET instead of POST
3. **Status Values**: `"sold_out"` instead of `itemStatuses: [2]`
4. **Response Path**: `data.userItems` instead of `data.search`
5. **New Fields**: `favorites`, `numLikes`, `autoLiked`, `created`, `updated`

## Troubleshooting

### Problem: Still seeing old behavior
**Solution:**
1. Uninstall extension completely
2. Close ALL browser windows
3. Reopen browser
4. Reinstall extension from unpacked folder
5. Hard refresh Profit Orbit (Ctrl+Shift+R)

### Problem: Console shows old build identifier
**Solution:**
1. Check `chrome://extensions/` for other versions
2. Remove all copies of the extension
3. Restart Chrome
4. Install only ONE copy

### Problem: No sold items appear
**Solution:**
1. Check console for API errors
2. Verify you have sold items on Mercari
3. Check Network tab for `userItemsQuery` call
4. Look for `status: "sold_out"` in request

### Problem: Favorites/likes showing as 0
**Solution:**
This is normal if items don't have favorites/likes yet.
Check a popular sold item to see non-zero values.

## Success Indicators
✅ Build identifier shows `2026-02-01-mercari-user-items-query`  
✅ Console shows `userItemsQuery` instead of `searchQuery`  
✅ Both on_sale and sold items appear in "All" view  
✅ Status badges show correctly (green/blue)  
✅ New metadata fields are populated  
✅ No errors in console  

## Next Steps
Once this works:
- Test import to verify sold items save correctly
- Test "View Sales History" button on sold items
- Verify sold items show in Sales page
- Check that all metadata persists after import
