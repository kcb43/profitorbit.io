# CSP Compliance Guide for All Marketplaces

## Overview

All marketplaces (Mercari, Facebook, eBay, Poshmark, Etsy) must follow CSP-safe patterns to avoid Content Security Policy violations.

## Critical Rules

### ✅ DO:
1. **Use web_accessible_resources** - Load scripts via `src=chrome-extension://` URLs
2. **Use postMessage** - Communicate between page context and content script
3. **Use chrome.runtime.sendMessage** - Communicate between content script and background
4. **Wait for DOM confirmation** - Don't mark items as listed until confirmed
5. **Use pathname.startsWith()** - For route detection, not `includes()`

### ❌ DON'T:
1. **Inline scripts** - `script.textContent = "..."` is blocked by CSP
2. **innerHTML with scripts** - CSP blocks this
3. **eval() or Function()** - CSP blocks dynamic code execution
4. **Optimistic state** - Don't mark "listed" until confirmed
5. **Exact path matching** - Use `startsWith()` for routes

## Architecture

### Current Setup (CSP-Safe)

```
Profit Orbit Web App (orben.io)
  ↓
profit-orbit-bridge.js (content script)
  ↓
profit-orbit-page-api.js (web_accessible_resource, loaded via src=)
  ↓
window.postMessage() → content script
  ↓
chrome.runtime.sendMessage() → background
  ↓
content.js (on marketplace pages)
```

### Marketplace Pages (Mercari, Facebook, eBay, etc.)

```
Marketplace Page (mercari.com, facebook.com, etc.)
  ↓
content.js (content script - runs in isolated world)
  ↓
chrome.runtime.sendMessage() → background
  ↓
DOM manipulation (no inline scripts)
```

## Marketplace-Specific Notes

### Mercari ✅
- **CSP Level**: Moderate
- **Route Detection**: `pathname.startsWith('/sell')`
- **Status**: Fixed - no inline scripts

### Facebook Marketplace ⚠️
- **CSP Level**: **STRICTEST** (stricter than Mercari)
- **Route Detection**: `pathname.startsWith('/marketplace/create')` or `/marketplace/sell`
- **Status**: Must ensure no inline scripts
- **Note**: Facebook has very strict CSP - any inline script will fail

### eBay ✅
- **CSP Level**: Moderate
- **Route Detection**: `pathname.startsWith('/sl/sell')` or `/sell`
- **Status**: Should work with same pattern

### Poshmark & Etsy
- **CSP Level**: Moderate
- **Status**: Follow same patterns

## Implementation Checklist

### For Each Marketplace:

- [ ] No inline script injection
- [ ] Route detection uses `pathname.startsWith()`
- [ ] DOM confirmation before marking as listed
- [ ] Error handling for CSP violations
- [ ] postMessage for page ↔ content script communication
- [ ] chrome.runtime.sendMessage for content ↔ background

## Testing CSP Compliance

### Check for CSP Violations:

1. Open DevTools → Console
2. Look for errors like:
   - `Refused to execute inline script because it violates CSP`
   - `Refused to evaluate a string as JavaScript because 'unsafe-eval'`
   - `Refused to create a worker`

### Verify Script Loading:

```javascript
// In page context (Profit Orbit web app)
console.log('Bridge loaded:', window.__PROFIT_ORBIT_BRIDGE_LOADED);
console.log('API exists:', typeof window.ProfitOrbitExtension !== 'undefined');
console.log('listItem exists:', typeof window.ProfitOrbitExtension?.listItem === 'function');
```

## Current Status

### ✅ Fixed:
- Mercari: Removed inline script injection
- Mercari: Fixed route detection
- Mercari: Added listItem() method
- Mercari: Added LIST_ITEM message handler

### ⚠️ To Verify:
- Facebook: Ensure no inline scripts in content.js
- Facebook: Verify route detection
- eBay: Ensure no inline scripts
- eBay: Verify route detection

## Future Improvements

1. **Separate page-api files per marketplace** (optional):
   - `profit-orbit-page-api-mercari.js`
   - `profit-orbit-page-api-facebook.js`
   - `profit-orbit-page-api-ebay.js`
   
   Currently not needed - single file works for all.

2. **DOM-ready confirmation hooks**:
   - Wait for specific DOM elements before marking success
   - Verify listing URL exists before confirmation
   - Check for error messages before marking as listed

3. **Better error handling**:
   - Catch CSP violations gracefully
   - Provide user feedback on CSP errors
   - Fallback mechanisms

## Example: CSP-Safe Script Injection

### ❌ WRONG (CSP Violation):
```javascript
const script = document.createElement('script');
script.textContent = 'window.flag = true;'; // BLOCKED BY CSP
document.head.appendChild(script);
```

### ✅ CORRECT (CSP-Safe):
```javascript
// In manifest.json web_accessible_resources
const script = document.createElement('script');
script.src = chrome.runtime.getURL('profit-orbit-page-api.js'); // ✅ Allowed
document.head.appendChild(script);
```

## Example: Route Detection

### ❌ WRONG:
```javascript
if (window.location.href.includes('/sell')) { // Too broad
  // ...
}
```

### ✅ CORRECT:
```javascript
const isOnSellPage = window.location.hostname.endsWith('mercari.com') && 
                     window.location.pathname.startsWith('/sell');
if (isOnSellPage) {
  // Handles /sell, /sell/, /sell/create, etc.
}
```

## Confirmation Flow

### Current Flow (Optimistic - Needs Fix):
```
App → Extension: LIST_ITEM
Extension → Page: postMessage
Page → DOM: Fill form
❌ App marks as "listed" immediately
```

### Correct Flow (CSP-Safe):
```
App → Extension: LIST_ITEM
Extension → Page: postMessage  
Page → DOM: Fill form
Page → Extension: LISTING_SUCCESS (with URL)
Extension → App: ✅ Confirmed listed
App marks as "listed" only after confirmation
```

## Resources

- [Chrome Extension CSP](https://developer.chrome.com/docs/extensions/mv3/content_scripts/#isolated_world)
- [Web Accessible Resources](https://developer.chrome.com/docs/extensions/mv3/manifest/web_accessible_resources/)
- [postMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)

