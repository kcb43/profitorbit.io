# Force Reload Chrome Extension - Mercari Date Scraping

## ⚠️ Critical Issue: Chrome is Caching Old Extension Files

Your console logs show that the date scraping code is NOT running, even though the code is in place. This means Chrome is using a **cached version** of the old extension files.

## 🔄 FORCE RELOAD Steps (Do ALL of These):

### Step 1: Completely Remove and Re-Add Extension

**Don't just click the reload button - that doesn't always clear the cache!**

1. Go to `chrome://extensions/`
2. Find "Profit Orbit - Crosslisting Assistant"
3. Click **"Remove"** button (Yes, completely remove it!)
4. Close all Chrome tabs
5. **Restart Chrome** (Fully close and reopen)
6. Go to `chrome://extensions/` again
7. Enable "Developer mode" (top right toggle)
8. Click "Load unpacked"
9. Select your `f:\bareretail\extension` folder
10. The extension should now show **Version 3.0.4**

### Step 2: Verify Version is Loaded

Open the browser console (F12) and run:
```javascript
// This should appear in console on page load
// Look for: 🟣 Mercari API module loading (v3.0.4-date-scraping)...
```

If you DON'T see this log message, the old cached version is still loaded!

### Step 3: Clear All Caches

```javascript
// Run in console (F12)
localStorage.removeItem('profit_orbit_mercari_listings');
localStorage.removeItem('profit_orbit_last_mercari_scrape_result');
console.log('✅ Cleared all Mercari caches');
```

### Step 4: Hard Reload Profit Orbit Page

- Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac) to hard reload
- Or: Open DevTools (F12), right-click the reload button, select "Empty Cache and Hard Reload"

### Step 5: Test Mercari Sync

1. Go to Import page: https://profitorbit.io/import?source=mercari
2. Click "Get Latest Mercari Items"
3. Watch the console for these logs:

**Expected logs (NEW version):**
```
🟣 Mercari API module loading (v3.0.4-date-scraping)...
📅 Date missing for m85955812918, attempting to scrape from page...
📅 Scraping posted date for Mercari item m85955812918...
✅ Found created date in __NEXT_DATA__: 2026-01-03T15:30:00.000Z
✅ Set scraped date for m85955812918: 2026-01-03T15:30:00.000Z
```

**If you see this (OLD version - BAD):**
```
❌ No date scraping logs at all
❌ startTime: null
❌ listingDate: null
```

### Step 6: Verify Dates in UI

After successful sync, you should see:
```
Posted: Jan 15, 2026 · $51.00 · View Item ID
```

## 🔍 Debugging

### Check Extension Version:
```javascript
// Run in console
chrome.runtime.getManifest().version
// Should return: "3.0.4"
```

### Check if Scraping Function Exists:
```javascript
// This should work now:
self.__mercariApi.scrapeMercariItemDate('m85955812918').then(date => {
  console.log('Scraped date:', date);
});
```

### Check Background Script:
1. Go to `chrome://extensions/`
2. Find "Profit Orbit"
3. Click "service worker" link
4. Check console for: `🟣 Mercari API module loading (v3.0.4-date-scraping)...`

## ⚡ Why This Happened

Chrome's extension system **aggressively caches** JavaScript files for performance. Simply clicking "Reload" doesn't always clear the cache - especially for `importScripts` files like `mercari-api.js`.

The **only reliable way** to clear the cache is:
1. ✅ Remove and re-add extension
2. ✅ Restart Chrome
3. ✅ Version bump (we changed to 3.0.4)

## 📝 Changes Made

- `extension/manifest.json`: Bumped version to **3.0.4**
- `extension/mercari-api.js`: Added version log `v3.0.4-date-scraping` for verification
- Both files committed and pushed to GitHub

## Date: February 1, 2026
