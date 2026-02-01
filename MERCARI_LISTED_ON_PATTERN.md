# Mercari Date Scraping - "Listed on" Pattern Added

## ✅ Update: v3.0.5

Based on your feedback that Facebook uses "Listed on [date]", I've added similar patterns for Mercari.

## 🔄 New Date Patterns Added

The scraper now looks for:

### Absolute Date Patterns (checked FIRST):
- `Listed on 01/15/2026`
- `Listed on 2026-01-15`
- `Listed on Jan 15, 2026`
- `Listed on January 15, 2026`
- `Posted on 01/15/2026` (variations)

### Relative Date Patterns (checked SECOND):
- `Posted 5 days ago`
- `Listed 2 weeks ago`

## 🔄 How to Update:

### Option 1: Quick Reload (Try First)
1. Go to `chrome://extensions/`
2. Find "Profit Orbit"
3. Click the **reload** button (circular arrow)
4. Verify version shows **3.0.5**

### Option 2: Full Reload (If Quick Reload Doesn't Work)
1. Go to `chrome://extensions/`
2. **Remove** the extension
3. **Restart Chrome**
4. **Load unpacked** from `f:\bareretail\extension`
5. Verify version shows **3.0.5**

## ✅ How to Test:

1. Clear cache:
   ```javascript
   localStorage.removeItem('profit_orbit_mercari_listings');
   ```

2. Go to Import page → Mercari
3. Click "Get Latest Mercari Items"
4. Watch console for:
   ```
   🟣 Mercari API module loading (v3.0.5-listed-on-pattern)...
   📅 Scraping posted date for Mercari item...
   ✅ Found "Listed on" date via regex: Jan 15, 2026 = 2026-01-15T00:00:00.000Z
   ```

## 🎯 Expected Result:

If Mercari shows "Listed on [date]" on their item pages (like Facebook), the scraper will now extract it!

If dates still don't appear, please:
1. Run the debug scripts I provided earlier
2. Send me the console output so I can see what date format Mercari actually uses

## Date: February 1, 2026
