# Adding New Marketplace Icons (eBay, Amazon, Facebook)

## SVG Format Recommendations

**Yes, SVG is the best format!** Here's what to use:

### SVG Specifications:
- **ViewBox**: Use `viewBox="0 0 24 24"` (standard icon size)
- **No width/height attributes**: Let CSS control the size
- **File naming**: Use lowercase with hyphens (e.g., `ebay-logo.svg`, `amazon-logo.svg`, `facebook-logo.svg`)

### Example SVG Structure:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <!-- Your icon paths/shapes here -->
</svg>
```

**Important**: Don't include `width` or `height` attributes in the SVG - the viewBox is enough. CSS/Tailwind classes will control the display size.

## Icon Sizes Used in the App

The app uses various sizes depending on context:
- **Small icons**: `w-4 h-4` (16px) - inline text, badges
- **Medium icons**: `w-5 h-5` (20px) or `w-6 h-6` (24px) - buttons, cards
- **Large icons**: `w-10 h-10` (40px) or `w-12 h-12` (48px) - headers, featured sections

## Steps to Add New Icons

### 1. Add SVG Files to Assets Folder

Place your new SVG files in: `src/assets/`
- `ebay-logo.svg` (or replace existing)
- `amazon-logo.svg` (new)
- `facebook-logo.svg` (or replace existing)

### 2. Files That Need to Be Updated

The following files reference eBay, Amazon, and Facebook icons and will need updates:

#### Primary Files:
1. **`src/pages/Dashboard.jsx`** - Line 39-82: `SUPPORTED_MARKETPLACES` array
2. **`src/pages/Settings.jsx`** - Line 17-22: Icon imports and `MARKETPLACES` array
3. **`src/pages/Crosslist.jsx`** - Line 68-83: `MARKETPLACES` array with icon URLs
4. **`src/pages/AddSale.jsx`** - Line 36-42: `platformIcons` object
5. **`src/pages/SalesHistory.jsx`** - Line 45-51: `platformIcons` object
6. **`src/components/reports/PlatformComparison.jsx`** - Line 14-20: `platformIcons` object
7. **`src/pages/MarketIntelligenceDetail.jsx`** - Line 29-54: `MARKETPLACE_INFO` (uses Lucide icons, may want to switch to SVGs)

#### Other Files That May Reference Icons:
- `src/components/dashboard/PlatformBreakdown.jsx`
- `src/components/dashboard/mosaic/PlatformDonutCard.jsx`
- `src/components/dashboard/mosaic/PlatformRevenueTableCard.jsx`
- `src/components/dashboard/RecentSales.jsx`

### 3. Import Pattern

After adding SVG files to `src/assets/`, import them like this:

```javascript
import ebayLogo from "@/assets/ebay-logo.svg";
import amazonLogo from "@/assets/amazon-logo.svg";
import facebookLogo from "@/assets/facebook-logo.svg";
```

### 4. Usage Pattern

Icons are typically used in one of two ways:

**Option A: As image source (most common)**
```jsx
<img src={ebayLogo} alt="eBay" className="w-10 h-10 object-contain" />
```

**Option B: In an object/array**
```javascript
const platformIcons = {
  ebay: ebayLogo,
  amazon: amazonLogo,
  facebook_marketplace: facebookLogo,
};
```

## Current Icon Locations Summary

### eBay Icon Used In:
- Dashboard marketplace cards
- Settings marketplace connections
- Crosslist marketplace selector
- Add Sale platform selector
- Sales History platform badges
- Reports platform comparison
- Platform breakdown charts

### Facebook Icon Used In:
- Dashboard marketplace cards
- Settings marketplace connections
- Crosslist marketplace selector
- Add Sale platform selector
- Sales History platform badges
- Reports platform comparison
- Platform breakdown charts

### Amazon Icon Used In:
- Market Intelligence detail page (Pulse)
- May be referenced in other areas

## Next Steps

1. **Add your SVG files** to `src/assets/` folder
2. **Let me know when they're added** and I can help update all the files to use the new icons
3. **Or if you prefer**, I can create a script to find and replace all icon references automatically

## Quick Reference: Icon Sizes by Context

| Context | Size Class | Pixel Size |
|---------|-----------|------------|
| Small badges/inline | `w-4 h-4` | 16px |
| Buttons/icons | `w-5 h-5` | 20px |
| Card headers | `w-6 h-6` | 24px |
| Large cards | `w-10 h-10` | 40px |
| Featured sections | `w-12 h-12` | 48px |
