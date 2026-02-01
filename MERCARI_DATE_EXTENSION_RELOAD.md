# Mercari Posted Date - Extension Reload Required

## Issue
Mercari items on the Import page are missing the "Posted:" date even after syncing.

## Root Cause
The Chrome extension code has been updated to include the `startTime` and `listingDate` fields from Mercari's API. However, Chrome extensions load their JavaScript files once when the browser starts and cache them in memory.

## Solution
**You must reload the Chrome extension** for the updated code to take effect:

### Steps to Reload the Extension:

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top-right corner)
3. Find the "Profit Orbit" extension
4. Click the **reload icon** (circular arrow) button for the extension
5. Go back to your Profit Orbit app and re-sync Mercari items

### Alternative Method:
1. Go to `chrome://extensions/`
2. Click "Remove" on the Profit Orbit extension  
3. Click "Load unpacked" and select the extension folder again
4. Go back to your app and re-sync Mercari items

## What the Extension Code Does Now

The updated `extension/mercari-api.js` file now extracts posted dates from Mercari's GraphQL API:

```javascript
// Posted/listed date (use created or updated timestamp)
startTime: item.created ? new Date(item.created * 1000).toISOString() : 
           item.updated ? new Date(item.updated * 1000).toISOString() : null,
listingDate: item.created ? new Date(item.created * 1000).toISOString() :
             item.updated ? new Date(item.updated * 1000).toISOString() : null,
```

This converts Mercari's Unix timestamps (seconds since epoch) to ISO date strings that the Import page can display.

## Verification

After reloading the extension and re-syncing, you should see dates like:
- "Posted: Jan 15, 2026" for Mercari items
- "Listed: Jan 15, 2026" for Facebook items

## Date: February 1, 2026
