# Quick Testing Guide - Deal Feed Redesign

## How to Test

### 1. Start the Development Server
```bash
npm run dev
# or
yarn dev
```

### 2. Navigate to Deal Feed
- Go to: `http://localhost:5173/deals`
- Or click "Deal Feed" in the sidebar under "Orben Intelligence"

### 3. What to Check

#### ✅ Layout & Design
- [ ] Cards display horizontally (not in a grid)
- [ ] Each card has image/icon on left, content on right
- [ ] Spacing looks clean and professional
- [ ] Colors match the theme (dark/light mode)

#### ✅ Deal Badges
- [ ] High-scoring deals (90+) show 🚨 MEGA DEAL badge (red, pulsing)
- [ ] Medium-high deals (70-89) show ⚡ HOT DEAL badge (orange)
- [ ] Medium deals (50-69) show 🔥 GREAT DEAL badge (yellow)
- [ ] Score badges show correct colors (Green 70+, Yellow 50-69, Gray <50)

#### ✅ Discount Display
- [ ] Discount percentage shows with color coding:
  - Red background for 70%+ off
  - Orange for 50%+ off
  - Yellow for 25%+ off
  - Green for less than 25% off
- [ ] "Save $X.XX" amount displays correctly
- [ ] Original price shown with strikethrough

#### ✅ Image Handling
- [ ] Deals with images: Image displays correctly
- [ ] Deals WITHOUT images: Package icon (📦) shows instead
- [ ] No broken image icons
- [ ] Images are square and properly sized (16x16 mobile, 24x24 desktop)

#### ✅ Functionality
- [ ] "View Deal" button opens link in new tab
- [ ] Bookmark button works (saves/unsaves deals)
- [ ] Infinite scroll loads more deals automatically
- [ ] Loading skeleton shows while loading
- [ ] Empty state shows when no deals found

#### ✅ Mobile Responsive
Open DevTools → Toggle device toolbar (Ctrl+Shift+M)

- [ ] Cards stack vertically on mobile
- [ ] All text remains readable
- [ ] Buttons are touch-friendly
- [ ] Image/icon size appropriate for screen
- [ ] Badges scale down correctly (8px font on mobile, 10px desktop)

#### ✅ Stats Cards (Top of page)
- [ ] Active Deals count shows
- [ ] Saved Deals count shows
- [ ] Avg Score calculated correctly
- [ ] Hot Deals (70%+) count shows

#### ✅ Old Pulse Route
- [ ] Visiting `/Pulse` redirects to `/deals`
- [ ] No console errors during redirect
- [ ] Pulse removed from sidebar navigation

---

## Expected Behavior

### Loading State
```
┌──────────────────────────────────┐
│ [Gray box]  [Gray lines...]     │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ [Gray box]  [Gray lines...]     │
└──────────────────────────────────┘
```
*5 skeleton cards while loading*

### Loaded State
```
┌──────────────────────────────────────────┐
│ [Img/Icon]  Title here         Badges  │
│             $XX.XX  -XX% OFF            │
│             [View Deal] [💾]            │
└──────────────────────────────────────────┘
```
*Actual deal cards*

### Empty State
```
      📦
   No deals found
   Check back soon...
   [Refresh Deals]
```

---

## Test Scenarios

### Scenario 1: Normal Deals
- **Expected**: Image shows, price displays, badges appear
- **Action**: Scroll through deals
- **Result**: Smooth, professional appearance

### Scenario 2: No-Image Deals
- **Expected**: Package icon appears instead
- **Action**: Look for deals without images
- **Result**: Icon displays, no broken images

### Scenario 3: High-Score Deals
- **Expected**: MEGA/HOT/GREAT badge appears, badge might pulse
- **Action**: Find deal with score 70+
- **Result**: Appropriate badge shows

### Scenario 4: Mobile View
- **Expected**: Cards full width, all info visible
- **Action**: Resize browser to mobile width (< 640px)
- **Result**: Cards stack, text readable, buttons work

### Scenario 5: Infinite Scroll
- **Expected**: New deals load automatically
- **Action**: Scroll to bottom of page
- **Result**: "Loading more deals..." appears, new deals load

### Scenario 6: Save/Unsave
- **Expected**: Bookmark fills/unfills on click
- **Action**: Click bookmark icon on any deal
- **Result**: Icon fills, "Saved Deals" count increases

---

## Common Issues & Fixes

### Issue: Cards look weird
**Fix**: Hard refresh page (Ctrl + Shift + R)

### Issue: No deals showing
**Check**: 
1. API is running (`VITE_ORBEN_API_URL`)
2. Network tab for API errors
3. Console for JavaScript errors

### Issue: Images not loading
**Expected**: Package icon should show instead
**If not**: Check image `onError` handler

### Issue: Badges missing
**Check**: Deal has `score` field in API response

### Issue: Pulse page still works
**Expected**: Should redirect to /deals
**If not**: Clear cache and hard refresh

---

## Browser Testing

Recommended browsers:
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ Mobile Safari (iOS)
- ⚠️ Chrome Mobile (Android)

---

## Performance Check

Open DevTools → Performance tab

**Expected:**
- Page load: < 2 seconds
- Scroll: Smooth 60fps
- Card render: < 100ms per card

**Red flags:**
- Stuttering scroll
- Slow loading
- Memory leaks

---

## API Response Example

A deal should look like:
```json
{
  "id": "deal_123",
  "title": "iPhone 15 Pro Max",
  "url": "https://...",
  "image_url": "https://..." or null,
  "price": 899.99,
  "original_price": 1199.99,
  "score": 85,
  "merchant": "Best Buy",
  "category": "Electronics",
  "coupon_code": "SAVE20" or null,
  "source": "Reddit r/deals",
  "posted_at": "2026-02-14T12:00:00Z"
}
```

---

## Final Checklist

Before considering the task complete:

- [ ] All deals display correctly
- [ ] No JavaScript errors in console
- [ ] No broken images or icons
- [ ] Mobile view works perfectly
- [ ] Infinite scroll functions
- [ ] Bookmark feature works
- [ ] Stats cards show correct numbers
- [ ] /Pulse redirects to /deals
- [ ] Sidebar navigation updated (no Pulse)
- [ ] Loading states look good
- [ ] Empty state looks good
- [ ] Colors match theme
- [ ] Performance is smooth

---

## Success Criteria ✨

**The redesign is successful when:**

1. ✅ Every deal (with or without image) looks professional
2. ✅ The page feels "alive" and engaging
3. ✅ Information is easy to scan at a glance
4. ✅ Mobile experience is excellent
5. ✅ No broken UI elements
6. ✅ User feedback is positive

---

## Need Help?

If you find issues:

1. Check browser console for errors
2. Check network tab for failed requests
3. Try hard refresh (Ctrl + Shift + R)
4. Clear browser cache
5. Restart dev server

---

**Happy Testing! 🚀**
