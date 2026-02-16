# DEBUG: Smart Listing Not Showing

## Issue
Smart Listing section not appearing on Crosslist page even though:
- ✅ Code is integrated
- ✅ .env.local has flags
- ✅ Server restarted
- ✅ No build errors

## Debug Steps

### Step 1: Check Browser Console

Open browser console (F12) and look for:
```
🎯 Smart Listing Feature Flag: true/false
🎯 Environment: { ... }
```

### Step 2: Verify Feature Flag

In browser console, run:
```javascript
// Check if feature is enabled
import.meta.env.VITE_SMART_LISTING_ENABLED
// Should return: "true"

// Check features module
import('@/config/features').then(f => console.log(f.FEATURES))
// Should show: { SMART_LISTING_ENABLED: true, ... }
```

### Step 3: Check Component Rendering

In console, check if SmartListingSection component exists:
```javascript
// Search DOM for Smart Listing
document.querySelector('[class*="Smart"]')
document.body.innerText.includes('Smart Listing')
```

### Step 4: Hard Refresh

1. Clear cache: Ctrl+Shift+Delete
2. Hard refresh: Ctrl+Shift+R
3. Or open in incognito: Ctrl+Shift+N

### Step 5: Check .env.local Format

The file should have NO leading spaces:
```
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=sb_...
SUPABASE_SERVICE_ROLE_KEY=sb_...
VITE_ORBEN_API_URL=https://...

VITE_SMART_LISTING_ENABLED=true
VITE_AI_SUGGESTIONS_ENABLED=true
VITE_DEBUG_SMART_LISTING=true

OPENAI_API_KEY=sk-...
```

**NOT like this (with leading spaces):**
```
   VITE_SUPABASE_URL=https://...   ← WRONG!
```

### Step 6: Verify Import Path

Check if `@/config/features` resolves correctly.

In `vite.config.js` or `tsconfig.json`, verify `@` alias:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Common Causes

1. **Leading/trailing spaces in .env.local** ← Most common!
2. **Server not restarted after .env.local change**
3. **Import path resolution issue**
4. **React hooks running but component not rendering**
5. **Conditional logic preventing render**

## Quick Fix: Manual Enable in Browser

As a workaround, you can enable it manually in browser console:
```javascript
localStorage.setItem('feature_overrides', JSON.stringify({
  SMART_LISTING_ENABLED: true
}));
// Then refresh page
```

## Next Steps

1. Check console logs for the 🎯 debug message
2. Verify .env.local has NO leading spaces
3. Try manual localStorage enable
4. Report back what you see in console
