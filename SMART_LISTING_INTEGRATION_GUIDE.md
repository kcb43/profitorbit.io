# Smart Listing Integration Guide

This guide explains how to integrate the Smart Listing components into `CrosslistComposer.jsx`.

## Files Created

✅ **Validation & Preflight:**
- `src/utils/listingValidation.js` - Reusable validation functions
- `src/utils/preflightEngine.js` - Preflight validation engine

✅ **UI Components:**
- `src/components/FixesDialog.jsx` - Main fixes dialog
- `src/components/IssuesList.jsx` - Issues list with fix UI

✅ **Configuration:**
- `src/config/features.js` - Feature flags system

✅ **Integration Hook:**
- `src/hooks/useSmartListing.js` - React hook for Smart Listing state/handlers

✅ **Environment:**
- `.env.example` - Added feature flag environment variables

## Integration Steps

### Step 1: Add Imports to CrosslistComposer.jsx

At the top of `CrosslistComposer.jsx`, add these imports:

```javascript
// Add after existing imports (around line 60)
import { useSmartListing } from '@/hooks/useSmartListing';
import FixesDialog from '@/components/FixesDialog';
import { useSmartListing as useSmartListingFeature } from '@/config/features';
import { Checkbox } from '@/components/ui/checkbox';
import { setMercariCategories } from '@/utils/listingValidation';
```

### Step 2: Setup MERCARI_CATEGORIES

Right after the MERCARI_CATEGORIES constant is defined (around line 125), add:

```javascript
// Initialize MERCARI_CATEGORIES for validation
setMercariCategories(MERCARI_CATEGORIES);
```

### Step 3: Initialize Smart Listing Hook

### Step 3: Initialize Smart Listing Hook

Inside the CrosslistComposer component (around line 34100 where other hooks are), add:

```javascript
// Initialize Smart Listing (feature-flagged)
const smartListingEnabled = useSmartListingFeature();

const {
  selectedMarketplaces,
  fixesDialogOpen,
  preflightResult,
  isSubmitting: isSmartSubmitting,
  toggleMarketplace,
  handleListToSelected,
  handleApplyFix,
  handleListNow,
  closeFixesDialog,
} = useSmartListing(
  {
    generalForm,
    ebayForm,
    mercariForm,
    facebookForm,
  },
  {
    categoryTreeId,
    ebayCategoriesData,
    ebayTypeAspect,
    ebayTypeValues,
    ebayRequiredAspects,
    isItemsIncludedRequired,
  },
  (marketplace, field, value) => {
    // Update form field
    if (marketplace === 'general') {
      setGeneralForm(prev => ({ ...prev, [field]: value }));
    } else if (marketplace === 'ebay') {
      setEbayForm(prev => ({ ...prev, [field]: value }));
    } else if (marketplace === 'mercari') {
      setMercariForm(prev => ({ ...prev, [field]: value }));
    } else if (marketplace === 'facebook') {
      setFacebookForm(prev => ({ ...prev, [field]: value }));
    }
  },
  handleListOnMarketplace // Pass existing submit handler
);
```

### Step 4: Add Smart Listing UI

Find the section where individual marketplace "List" buttons are rendered. This is typically near the bottom of each marketplace's form section.

**Add this BEFORE the existing individual marketplace buttons:**

```javascript
{/* Smart Listing: List to Multiple Marketplaces */}
{smartListingEnabled && (
  <div className="border-t pt-6 mt-6">
    <div className="mb-4">
      <h3 className="text-lg font-semibold mb-3">Smart Listing</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Select marketplaces and list to all at once with automatic validation
      </p>
      
      {/* Marketplace Selection */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
          <Checkbox
            id="select-ebay"
            checked={selectedMarketplaces.includes('ebay')}
            onCheckedChange={(checked) => toggleMarketplace('ebay', checked)}
          />
          <Label
            htmlFor="select-ebay"
            className="cursor-pointer flex-1 font-medium"
          >
            eBay
          </Label>
        </div>
        
        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
          <Checkbox
            id="select-mercari"
            checked={selectedMarketplaces.includes('mercari')}
            onCheckedChange={(checked) => toggleMarketplace('mercari', checked)}
          />
          <Label
            htmlFor="select-mercari"
            className="cursor-pointer flex-1 font-medium"
          >
            Mercari
          </Label>
        </div>
        
        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
          <Checkbox
            id="select-facebook"
            checked={selectedMarketplaces.includes('facebook')}
            onCheckedChange={(checked) => toggleMarketplace('facebook', checked)}
          />
          <Label
            htmlFor="select-facebook"
            className="cursor-pointer flex-1 font-medium"
          >
            Facebook
          </Label>
        </div>
      </div>
      
      {/* List to Selected Button */}
      <Button
        onClick={handleListToSelected}
        disabled={selectedMarketplaces.length === 0 || isSmartSubmitting || isSaving}
        className="w-full"
        size="lg"
      >
        <Rocket className="w-4 h-4 mr-2" />
        {isSmartSubmitting 
          ? 'Listing...' 
          : `List to ${selectedMarketplaces.length || 0} Selected Marketplace${selectedMarketplaces.length !== 1 ? 's' : ''}`
        }
      </Button>
      
      {selectedMarketplaces.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Will validate all fields and show any issues before listing
        </p>
      )}
    </div>
  </div>
)}

{/* Existing individual marketplace buttons below */}
```

### Step 5: Add FixesDialog Component

At the very end of the component's return statement (after all forms, before the closing tags), add:

```javascript
{/* Smart Listing: Fixes Dialog */}
{smartListingEnabled && (
  <FixesDialog
    open={fixesDialogOpen}
    onClose={closeFixesDialog}
    preflightResult={preflightResult}
    onApplyFix={handleApplyFix}
    onListNow={handleListNow}
    isSubmitting={isSmartSubmitting}
  />
)}
```

### Step 6: Enable Feature Flag

To test the Smart Listing feature, add to your `.env.local`:

```bash
VITE_SMART_LISTING_ENABLED=true
VITE_AI_SUGGESTIONS_ENABLED=false  # Keep AI off for initial testing
VITE_DEBUG_SMART_LISTING=true      # Enable debug logging
```

## Testing Checklist

### ✅ Phase 1: Basic Integration
- [ ] Import statements added without errors
- [ ] Hook initialized without errors
- [ ] Smart Listing UI section visible when feature flag enabled
- [ ] Smart Listing UI hidden when feature flag disabled
- [ ] Marketplace checkboxes work (can select/deselect)
- [ ] "List to Selected" button disabled when no marketplaces selected

### ✅ Phase 2: Validation
- [ ] Clicking "List to Selected" with valid data lists immediately
- [ ] Clicking "List to Selected" with missing fields shows FixesDialog
- [ ] FixesDialog shows correct issues for each marketplace
- [ ] FixesDialog shows blocking vs warning issues correctly
- [ ] Can close FixesDialog and return to form

### ✅ Phase 3: Fixes
- [ ] Can apply fixes from FixesDialog
- [ ] Fixes update form values correctly
- [ ] After applying fix, issue disappears from dialog
- [ ] "List Now" button disabled when blocking issues remain
- [ ] "List Now" button enabled when all blocking issues resolved

### ✅ Phase 4: Listing
- [ ] Clicking "List Now" calls existing submit handlers
- [ ] Successful listings show success toasts
- [ ] Failed listings show error toasts
- [ ] Dialog closes after all successful listings
- [ ] Can still use individual marketplace buttons (old flow)

### ✅ Phase 5: Regression
- [ ] Old individual marketplace listing still works
- [ ] eBay validation still works
- [ ] Mercari validation still works
- [ ] Facebook validation still works
- [ ] No console errors when feature flag OFF
- [ ] No console errors when feature flag ON

## Validation Rules Reference

### eBay Required Fields
- Photos (at least 1)
- Title
- Category (must be leaf node)
- Price (buyItNowPrice)
- Quantity
- Condition
- Brand (ebayBrand or general brand)
- Color
- Handling Time
- Shipping Service
- Shipping Cost Type
- Shipping Method
- Shipping Cost
- Pricing Format
- Duration
- Type/Model (if category requires it)
- Return policy fields (if acceptReturns is true)
- Items Included (if category requires it)
- Custom item specifics (if category requires them)

### Mercari Required Fields
- Photos (at least 1)
- Title
- Category (must be complete leaf path)
- Price
- Condition
- Brand (or noBrand checked)
- Mercari connection active

### Facebook Required Fields
- Photos (at least 1)
- Title
- Description
- Category (inherits from General if empty)
- Price
- Condition
- Size (for clothing/shoes categories only)
- Extension connected

## Troubleshooting

### Issue: "Cannot read property 'categoryTreeId' of undefined"
**Solution:** Make sure `categoryTreeId` is passed to the Smart Listing hook options

### Issue: FixesDialog shows but no issues displayed
**Solution:** Check console for validation errors, ensure MERCARI_CATEGORIES is exported

### Issue: "List Now" doesn't work
**Solution:** Verify `handleListOnMarketplace` is passed correctly to `useSmartListing`

### Issue: Applied fixes don't update the form
**Solution:** Check the `setMarketplaceForm` callback in Step 2, ensure it updates the correct form state

### Issue: Extension not available error
**Solution:** This is expected if extension not loaded, validation will catch it

## Next Steps

After basic integration is working:

1. **Phase 3: Category Helpers** - Add smart category suggestions (see SMART_LISTING_IMPLEMENTATION_V2.md Phase 3)
2. **Phase 4: AI Integration** - Add AI-powered category ranking (optional, see Phase 4)
3. **Phase 5: Attributes** - Add attribute extraction and suggestions (see Phase 5)

## File Locations

```
src/
├── components/
│   ├── FixesDialog.jsx           ✅ Created
│   └── IssuesList.jsx             ✅ Created
├── config/
│   └── features.js                ✅ Created
├── hooks/
│   └── useSmartListing.js         ✅ Created
└── utils/
    ├── listingValidation.js       ✅ Created
    └── preflightEngine.js         ✅ Created

.env.example                        ✅ Updated
```

## Support

If you encounter issues:
1. Check browser console for errors
2. Enable debug mode: `VITE_DEBUG_SMART_LISTING=true`
3. Check validation logs in console
4. Verify feature flag is enabled
5. Ensure all imports resolve correctly

---

**Status:** Phase 1 & 2 Complete ✅  
**Next:** Integrate into CrosslistComposer.jsx following steps above
