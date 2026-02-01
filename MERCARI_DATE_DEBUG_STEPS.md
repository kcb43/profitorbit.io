# Mercari Date Not Showing - Debugging Steps

## The Issue
The "Posted: [date]" text is not appearing for Mercari items on the Import page, even after reloading the extension and re-syncing.

## Step-by-Step Debugging Process

### Step 1: Run the Debug Script
1. Open the Profit Orbit Import page with Mercari selected
2. Open browser console (F12)
3. Copy and paste the entire contents of `DEBUG_MERCARI_DATE.js` into the console
4. Press Enter to run it
5. **Take a screenshot of the console output** and share it

This will show us:
- How many items are cached
- Whether items have `startTime` or `listingDate` fields
- The actual data structure

### Step 2: Verify Extension Reload
**IMPORTANT:** Simply clicking "reload" might not be enough. Try this method:

#### Method A: Hard Reload Extension
1. Go to `chrome://extensions/`
2. Find "Profit Orbit" extension
3. Click **"Remove"** (don't worry, we'll re-add it)
4. Close Chrome **completely** (check Task Manager to ensure no Chrome processes)
5. Reopen Chrome
6. Go to `chrome://extensions/`
7. Enable "Developer mode"
8. Click "Load unpacked"
9. Select your extension folder: `f:\bareretail\extension`
10. Verify it loaded by checking the extension list

#### Method B: Check Extension Files Directly
1. Go to `chrome://extensions/`
2. Find "Profit Orbit"
3. Click "Inspect views: service worker" or "background page"
4. In the console that opens, run:
```javascript
// This will show you the actual code from the loaded extension
console.log(self.__mercariApi.fetchMercariListings.toString().includes('startTime'));
```
If this returns `false`, the extension hasn't reloaded the new code.

### Step 3: Re-sync with Enhanced Logging
After reloading the extension properly:

1. Go to Profit Orbit Import page
2. Select Mercari source  
3. Open console (F12)
4. Click "Get Latest Mercari Items"
5. Watch the console for these specific logs:
   - `🕐 Date field debug:` - Shows raw date values from API
   - `📦 First listing sample:` - Should now include startTime/listingDate

**Take a screenshot of these logs** and share them.

### Step 4: Check React Query Cache
If the data is correct in localStorage but not showing in UI:

1. Open console on Import page
2. Run:
```javascript
// Check what React Query has cached
const queryClient = window.__REACT_QUERY_CLIENT__;
if (queryClient) {
  const data = queryClient.getQueryData(['mercari-listings', 'YOUR_USER_ID_HERE']);
  console.log('React Query cache:', data);
  console.log('First item has startTime?', data?.[0]?.startTime);
} else {
  console.log('React Query not accessible via window');
}
```

## What We're Looking For

The extension code at lines 455-458 of `mercari-api.js` should create:
```javascript
startTime: item.created ? new Date(item.created * 1000).toISOString() : 
           item.updated ? new Date(item.updated * 1000).toISOString() : null,
listingDate: item.created ? new Date(item.created * 1000).toISOString() :
             item.updated ? new Date(item.updated * 1000).toISOString() : null,
```

If `item.created` or `item.updated` are undefined, then **Mercari's API isn't returning those fields**, and we'll need to find an alternative field.

## Common Issues

1. **Extension not reloaded**: The new code isn't actually running
2. **Cache from old sync**: Old data without dates is still in localStorage
3. **API doesn't have dates**: Mercari changed their API response structure
4. **Field name changed**: Mercari renamed `created`/`updated` to something else

## Next Steps After Running Debug Script

Share the console output screenshots, and we'll know exactly which issue it is and how to fix it!

## Date: February 1, 2026
