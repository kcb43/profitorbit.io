# How to Diagnose Why Bridge Script Isn't Loading

## Step 1: Verify Extension is Loaded Correctly

1. Go to `chrome://extensions/`
2. Find "Profit Orbit - Crosslisting Assistant"
3. Click "Details" or the extension card
4. Check for any errors (red text)
5. Verify the extension ID (you'll need this)

## Step 2: Check Content Script Registration

1. In `chrome://extensions/`, click "service worker" or "Inspect views: service worker"
2. This opens the extension's console
3. Look for logs starting with `=== PROFIT ORBIT BRIDGE SCRIPT LOADING ===`
4. If you DON'T see these logs, the content script isn't loading

## Step 3: Verify URL Matching

The manifest.json has these URL patterns:
- `https://orben.io/*`
- `http://localhost:5173/*`
- `http://localhost:5174/*`

**Check:**
1. What URL are you actually on? (Check browser address bar)
2. Does it match one of the patterns above?
3. Note: `https://orben.io` (no trailing slash) SHOULD match `https://orben.io/*`

## Step 4: Check for JavaScript Errors

1. Open the Profit Orbit page
2. Press F12 → Console tab
3. Look for ANY errors (red text)
4. Filter by "Profit Orbit" to see extension-related logs

## Step 5: Verify Files Exist

Check that these files exist in your extension folder:
- `extension/profit-orbit-bridge.js` ✅
- `extension/profit-orbit-page-api.js` ✅
- `extension/manifest.json` ✅

## Step 6: Test Content Script Manually

In the extension console (service worker), try:
```javascript
chrome.tabs.query({url: 'https://orben.io/*'}, (tabs) => {
  console.log('Found tabs:', tabs);
  if (tabs.length > 0) {
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      files: ['profit-orbit-bridge.js']
    });
  }
});
```

## Common Issues:

1. **Extension not reloaded**: After code changes, you MUST reload the extension
2. **Wrong URL**: Make sure you're on `https://orben.io` or localhost
3. **File missing**: Verify `profit-orbit-bridge.js` exists in extension folder
4. **Manifest error**: Check for JSON syntax errors in manifest.json
5. **CSP blocking**: Shouldn't be an issue since we use separate file, but check Network tab

## What to Report:

After reloading extension and refreshing page, report:
1. Do you see `=== PROFIT ORBIT BRIDGE SCRIPT LOADING ===` in extension console?
2. What URL are you on?
3. Any errors in extension console?
4. Any errors in page console?
5. Does `chrome.tabs.query` find your Profit Orbit tab?

