# Smart Search Routing - Settings Guide

## Location

**Settings → General Preferences → Smart Search Routing**

## Visual Guide

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    SETTINGS PAGE                     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌─────────────────────────────────────────────────────┐
│  ⚙️  General Preferences                            │
│     Customize your experience                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Skip Delete Confirmation              [   OFF  ]  │
│  Skip the second "Are you sure?" dialog            │
│  when deleting items                               │
│                                                     │
│  ─────────────────────────────────────────────     │
│                                                     │
│  Smart Search Routing                  [   ON   ]  │  ← NEW!
│  Automatically use premium search                  │
│  (Oxylabs) for high-value products                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## What It Does

### When ENABLED (ON) - Default
```
You search for "iPhone 15 Pro"
        ↓
Backend detects high-value keyword
        ↓
Automatically uses:
  • eBay (free)
  • Oxylabs (premium, accurate results)
        ↓
Best results, optimized cost
```

**Benefits:**
- ✓ Automatic premium search for valuable items
- ✓ Cost-optimized (only uses premium when worth it)
- ✓ Better results for high-value searches
- ✓ No manual provider selection needed

**When It Triggers Oxylabs:**
- iphone, macbook, ipad, airpods
- playstation, ps5, xbox, nintendo switch
- gpu, rtx, camera, laptop, gaming pc
- rolex, omega, cartier

### When DISABLED (OFF)
```
You search for "iPhone 15 Pro"
        ↓
Uses ONLY providers you checked in search UI
        ↓
If you checked "eBay" only:
  • Only eBay results
  • No automatic premium upgrade
        ↓
Full manual control, predictable costs
```

**Benefits:**
- ✓ Full control over which providers run
- ✓ Predictable costs (no surprise premium searches)
- ✓ Useful for testing specific providers
- ✓ Good for cost-conscious testing

## How to Change It

### Step 1: Open Settings
1. Click your user menu
2. Select "Settings"

### Step 2: Find the Toggle
1. Scroll to "General Preferences" section
2. Look for "Smart Search Routing"

### Step 3: Toggle On/Off
- **Toggle ON (blue):** Smart routing enabled
- **Toggle OFF (gray):** Smart routing disabled

### Step 4: Confirmation
You'll see a toast notification:
```
✓ Smart Routing Enabled
  Will use premium search for high-value items
  (iPhone, MacBook, etc.)
```
or
```
✓ Smart Routing Disabled
  Will only use providers you explicitly select.
```

## Testing It

### Test 1: With Smart Routing ON
1. Enable smart routing in Settings
2. Go to Product Search
3. Search for "MacBook Pro"
4. Check the results - should see providers: `ebay, oxylabs`
5. Oxylabs used automatically for high-value item ✓

### Test 2: With Smart Routing OFF
1. Disable smart routing in Settings
2. Go to Product Search
3. Uncheck all providers EXCEPT eBay
4. Search for "MacBook Pro"
5. Check the results - should ONLY see eBay (no auto Oxylabs) ✓

## Technical Details

### Storage
```javascript
// Stored in localStorage
key: 'orben_disable_smart_routing'
value: 'true' or 'false'
```

### API Request
```javascript
// Smart routing ENABLED
fetch('/v1/search?q=iPhone&providers=auto')

// Smart routing DISABLED  
fetch('/v1/search?q=iPhone&providers=ebay,google')
```

### Backend Logic
```javascript
if (requestedProviders.includes('auto')) {
  // Smart routing enabled
  if (isHighValueQuery(query)) {
    return ['ebay', 'oxylabs'];
  } else {
    return ['ebay'];
  }
} else {
  // Smart routing disabled - use explicit providers
  return requestedProviders;
}
```

## Cost Impact

### Smart Routing ON (Recommended)
```
Monthly estimate (1000 searches):
  800 regular searches → eBay only (free)
  200 high-value searches → eBay + Oxylabs ($20)
  
Total: ~$20/month
```

### Smart Routing OFF (Manual)
```
Monthly estimate (1000 searches):
  If you always select eBay only → $0/month
  If you always select Oxylabs → $100/month
  
Total: Depends on your selections
```

## When to Use Each

### Use Smart Routing ON (Recommended) When:
- ✓ You want best results automatically
- ✓ You search for mix of regular and high-value items
- ✓ You want cost optimization
- ✓ You trust the automatic detection

### Use Smart Routing OFF When:
- ✓ You're testing specific providers
- ✓ You want predictable costs
- ✓ You only use one provider
- ✓ You want full manual control

## FAQ

**Q: Does this affect eBay searches?**  
A: No, eBay is always included (when working). This only controls when Oxylabs is added.

**Q: Can I still manually select providers?**  
A: Yes! Even with smart routing ON, you can uncheck providers in the search UI.

**Q: Will this cost more money?**  
A: Smart routing actually SAVES money by only using premium search when needed.

**Q: What if I want to use Oxylabs for everything?**  
A: Turn smart routing OFF, then always check "Oxylabs" in the search UI.

**Q: Does this setting persist?**  
A: Yes, it's saved in localStorage and persists across sessions.

## Default Behavior

**For Most Users (Smart Routing ON):**
- Regular searches → Free (eBay)
- High-value searches → Best results (eBay + Oxylabs)
- Cost-optimized automatically

**For Power Users (Smart Routing OFF):**
- YOU choose every provider
- Full control, predictable costs
- Good for testing/debugging

## Summary

**Setting Added:** ✓  
**Location:** Settings → General Preferences  
**Default:** ON (smart routing enabled)  
**Purpose:** Control automatic premium search usage  
**Cost Impact:** Optimized when ON, manual when OFF  
**Recommendation:** Keep ON unless you need manual control
