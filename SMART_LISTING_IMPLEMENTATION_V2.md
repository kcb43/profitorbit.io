# Orben Smart Listing Layer (V2) — Cursor-Ready Implementation Checklist

**Updated with exact category system details from codebase analysis**

Prime directive: **Do not break the existing per-marketplace listing flow.** We are not replacing category systems. We're only changing how the user experiences crosslisting and adding preflight + centralized fixes so the only new failures are "missing/invalid field/category selections."

---

## 0) What we're building (in 1 paragraph)

We will keep your current General → (eBay / Mercari / Facebook) forms and existing listing pipeline exactly as-is, but add a **"List to All" preflight layer** and a single **"Fixes" dialog** that:

- reads the current General form + marketplace-specific form data,
- validates required fields/categories using your existing validators,
- auto-suggests the closest valid option (especially categories) using a cheap LLM only when needed, and
- lets the user apply the remaining fixes in one place, then submits to your existing "create listing job(s)" logic.

---

## 1) Key constraints (do not violate)

### ✅ Keep these unchanged:

**Existing category selection UIs & data models:**

- **eBay**: 
  - API: `useEbayCategoryTreeId`, `useEbayCategorySuggestions`, `useEbayCategories`
  - Files: `src/hooks/useEbayCategorySuggestions.js`, `api/ebay/taxonomy.js`
  - Validation: leaf category required, aspects loaded dynamically
  - Storage: `categoryId` (numeric), `categoryName` (full path string)

- **Mercari**: 
  - Tree: `MERCARI_CATEGORIES` constant in `src/pages/CrosslistComposer.jsx` (lines 124-4150+)
  - Structure: 3-level hierarchy (L0 → L1 → L2), ~10 top-level, hundreds of subcategories
  - Validation: must select leaf category with no more subcategories
  - Storage: `mercariCategoryId` (leaf ID), `mercariCategory` (path string like "Women > Dresses > Above knee, mini")
  - Helper: `flattenMercariCategories()` for search

- **Facebook**: 
  - Inherits eBay tree from General form
  - Mapper: `api/utils/categoryMapper.js` with `FACEBOOK_CATEGORY_NAMES` (70+ ID mappings) and `CATEGORY_KEYWORDS` (priority-based)
  - Storage: `category` (eBay path), `categoryId` (eBay ID)
  - Import mapping: Facebook numeric IDs → human names → Orben predefined categories

- **Internal Orben categories (21)**: 
  - Defined in `src/pages/AddInventoryItem.jsx` lines 42-65
  - Used for: inventory organization, Facebook import mapping, internal categorization

**Existing posting/job creation functions:**
- eBay listing: uses extension via `ext.createEbayListing()`
- Mercari listing: uses extension via `ext.createMercariListing()`
- Facebook listing: uses extension via `ext.createFacebookListing()`
- All in `src/pages/CrosslistComposer.jsx` submit handlers

**Existing extension auth + session:**
- Extension communication via `window.postMessage`
- Token storage in extension session
- Auth validation per marketplace

### ✅ Allowed changes:

- Add a new CTA ("List to All Selected") + dialog overlay UX
- Add a preflight function that uses your existing validation rules
- Add small utility code to read and patch form states centrally
- Add lightweight AI suggestion endpoints (optional, behind flag)

---

## 2) Terminology (aligned with your current architecture)

### Existing systems you already have

**General Form category:** 
- Uses eBay category tree via `useEbayCategories(categoryTreeId, generalCurrentCategoryId, ...)`
- Shared navigation state: `generalCategoryPath` array
- Storage: `generalForm.category`, `generalForm.categoryId`

**eBay Form category:** 
- Uses eBay tree with separate state: `selectedCategoryPath`, `ebayCurrentCategoryId`
- Override allowed (independent from General)
- Validation: `ebayCategoriesData`, `isLoadingEbayCategories`

**Mercari Form category:** 
- Tree: `MERCARI_CATEGORIES` constant
- Navigation state: `mercariCategoryPath` array
- Leaf validation in submit handler (lines ~37289-37322)
- Storage: `mercariForm.mercariCategoryId`, `mercariForm.mercariCategory`

**Facebook Form category:** 
- Inherits from General: `facebookForm.category || generalForm.category`
- Same eBay tree UI as General
- Navigation state: shares `generalCategoryPath`
- Storage: `facebookForm.category`, `facebookForm.categoryId`

**Internal Orben categories (21):**
```javascript
PREDEFINED_CATEGORIES = [
  "Antiques", "Books, Movies & Music", "Clothing & Apparel", 
  "Collectibles", "Electronics", "Gym/Workout", "Health & Beauty",
  "Home & Garden", "Jewelry & Watches", "Kitchen", "Makeup",
  "Mic/Audio Equipment", "Motorcycle", "Motorcycle Accessories",
  "Pets", "Pool Equipment", "Shoes/Sneakers", "Sporting Goods",
  "Stereos & Speakers", "Tools", "Toys & Hobbies", "Yoga"
]
```

### New "Smart Layer" concepts (thin, non-breaking)

**Preflight:** runs your validations across selected marketplaces BEFORE listing

**Fixes Dialog:** shows only missing/invalid fields per marketplace

**Patches:** small diffs applied to marketplace forms (not new payloads)

---

## 3) Feature flag first (safety net)

### 3.1 Add a feature flag

`SMART_LISTING_ENABLED` (env or user flag)

- When OFF → current listing UI works unchanged
- When ON → new "List to All" button + Fixes Dialog appears

**Cursor Task:**
```javascript
// Add to src/config.js or wherever feature flags live
export const FEATURES = {
  SMART_LISTING_ENABLED: import.meta.env.VITE_SMART_LISTING_ENABLED === 'true',
  // ... existing flags
}
```

---

## 4) UI/UX changes (without rewriting forms)

### 4.1 Add a "List to All Selected" CTA

In `src/pages/CrosslistComposer.jsx`:

**Current structure:**
- Individual "List to [Marketplace]" buttons per tab
- Submit handlers: `handleSubmit("ebay")`, `handleSubmit("mercari")`, `handleSubmit("facebook")`

**Add:**
```javascript
// Near line ~36900+ where submit buttons are
{FEATURES.SMART_LISTING_ENABLED && (
  <>
    {/* Marketplace multi-select */}
    <div className="mb-4">
      <Label>List to marketplaces:</Label>
      <div className="flex gap-2">
        <Checkbox id="select-ebay" checked={selectedMarketplaces.includes('ebay')} 
                  onCheckedChange={(checked) => toggleMarketplace('ebay', checked)} />
        <Label htmlFor="select-ebay">eBay</Label>
        {/* ... similar for mercari, facebook */}
      </div>
    </div>
    
    {/* List to All button */}
    <Button onClick={handleListToSelected} size="lg" className="w-full">
      List to {selectedMarketplaces.length} Selected Marketplace(s)
    </Button>
  </>
)}
```

**On click logic:**
```javascript
const handleListToSelected = async () => {
  // 1. Run preflight
  const preflightResult = await preflightSelectedMarketplaces(selectedMarketplaces);
  
  // 2. If no issues → submit through existing handlers
  if (preflightResult.fixesNeeded.length === 0) {
    for (const marketplace of selectedMarketplaces) {
      await handleSubmit(marketplace); // Use existing submit logic
    }
    return;
  }
  
  // 3. Else → open Fixes Dialog
  setFixesDialogData(preflightResult);
  setFixesDialogOpen(true);
};
```

### 4.2 Fixes Dialog requirements

**Component structure:**
```javascript
<FixesDialog open={fixesDialogOpen} onClose={() => setFixesDialogOpen(false)}>
  <div className="grid grid-cols-[200px_1fr]">
    {/* Left: Marketplaces list with status */}
    <div className="border-r">
      {preflightResult.ready.map(mp => (
        <div key={mp} className="flex items-center gap-2">
          <CheckCircle className="text-green-500" />
          <span>{mp}</span>
        </div>
      ))}
      {preflightResult.fixesNeeded.map(({marketplace, issues}) => (
        <button onClick={() => setActiveFixMarketplace(marketplace)}>
          {issues.some(i => i.severity === 'blocking') 
            ? <XCircle className="text-red-500" /> 
            : <AlertCircle className="text-yellow-500" />}
          <span>{marketplace}</span>
        </button>
      ))}
    </div>
    
    {/* Right: Issues panel for selected marketplace */}
    <div className="p-4">
      {activeFixMarketplace && (
        <IssuesList 
          issues={preflightResult.fixesNeeded.find(f => f.marketplace === activeFixMarketplace)?.issues} 
          onApplyFix={handleApplyFix}
        />
      )}
    </div>
  </div>
  
  {/* Footer */}
  <div className="flex justify-between">
    <Button variant="outline" onClick={() => setFixesDialogOpen(false)}>Cancel</Button>
    <Button 
      onClick={handleListNow} 
      disabled={preflightResult.fixesNeeded.some(f => f.issues.some(i => i.severity === 'blocking'))}
    >
      List Now
    </Button>
  </div>
</FixesDialog>
```

**Key requirement:** No full forms inside the dialog. It's a targeted "diff/patch" UI showing only fields with issues.

---

## 5) Preflight engine (the heart of this, but safe)

### 5.1 Preflight must use your existing validation rules

**Current validation locations in `CrosslistComposer.jsx`:**

- **eBay validation** (~lines 36700-36900): checks photos, title, category leaf, price, shipping
- **Mercari validation** (~lines 37200-37370): checks category complete path, brand/no-brand, condition
- **Facebook validation** (~lines 37050-37100): checks category, condition, size (for clothing/shoes)

**Cursor Task:** Extract into reusable functions

```javascript
// New file: src/utils/listingValidation.js

export function validateEbayForm(generalForm, ebayForm, categoryTreeId) {
  const issues = [];
  const form = { ...generalForm, ...ebayForm }; // Merge with override
  
  // Photos validation
  const photos = ebayForm.photos?.length > 0 ? ebayForm.photos : generalForm.photos;
  if (!photos || photos.length === 0) {
    issues.push({
      marketplace: 'ebay',
      field: 'photos',
      type: 'missing',
      severity: 'blocking',
      message: 'At least one photo is required',
      patchTarget: 'ebay'
    });
  }
  
  // Category validation - must be leaf
  if (!ebayForm.categoryId && !generalForm.categoryId) {
    issues.push({
      marketplace: 'ebay',
      field: 'categoryId',
      type: 'missing',
      severity: 'blocking',
      message: 'Please select a complete category path',
      patchTarget: 'ebay'
    });
  }
  // Check if leaf category (no subcategories)
  // Use ebayCategoriesData to validate
  
  // Title validation
  if (!form.title) {
    issues.push({
      marketplace: 'ebay',
      field: 'title',
      type: 'missing',
      severity: 'blocking',
      message: 'Title is required',
      patchTarget: 'general'
    });
  }
  
  // Price validation
  if (!form.price || Number(form.price) <= 0) {
    issues.push({
      marketplace: 'ebay',
      field: 'price',
      type: 'missing',
      severity: 'blocking',
      message: 'Valid price is required',
      patchTarget: 'general'
    });
  }
  
  // Condition validation (required for eBay)
  if (!ebayForm.condition) {
    issues.push({
      marketplace: 'ebay',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Condition is required',
      patchTarget: 'ebay'
    });
  }
  
  return issues;
}

export function validateMercariForm(generalForm, mercariForm) {
  const issues = [];
  
  // Photos validation
  const photos = mercariForm.photos?.length > 0 ? mercariForm.photos : generalForm.photos;
  if (!photos || photos.length === 0) {
    issues.push({
      marketplace: 'mercari',
      field: 'photos',
      type: 'missing',
      severity: 'blocking',
      message: 'At least one photo is required',
      patchTarget: 'mercari'
    });
  }
  
  // Category validation - MUST be complete path (leaf category)
  if (!mercariForm.mercariCategory || !mercariForm.mercariCategoryId) {
    issues.push({
      marketplace: 'mercari',
      field: 'mercariCategory',
      type: 'missing',
      severity: 'blocking',
      message: 'Please select a complete Mercari category path (including all subcategories)',
      patchTarget: 'mercari'
    });
  } else {
    // Check if category is complete (no more subcategories)
    // Use existing logic from CrosslistComposer lines ~37289-37322
    const categoryComplete = checkMercariCategoryComplete(
      mercariForm.mercariCategoryId, 
      mercariForm.mercariCategory
    );
    if (!categoryComplete) {
      issues.push({
        marketplace: 'mercari',
        field: 'mercariCategory',
        type: 'incomplete_path',
        severity: 'blocking',
        message: 'Please select all subcategories until you reach a final category',
        patchTarget: 'mercari'
      });
    }
  }
  
  // Title validation
  if (!mercariForm.title && !generalForm.title) {
    issues.push({
      marketplace: 'mercari',
      field: 'title',
      type: 'missing',
      severity: 'blocking',
      message: 'Title is required',
      patchTarget: 'general'
    });
  }
  
  // Price validation
  const price = mercariForm.price || generalForm.price;
  if (!price || Number(price) <= 0) {
    issues.push({
      marketplace: 'mercari',
      field: 'price',
      type: 'missing',
      severity: 'blocking',
      message: 'Valid price is required',
      patchTarget: 'general'
    });
  }
  
  // Condition validation
  if (!mercariForm.condition && !generalForm.condition) {
    issues.push({
      marketplace: 'mercari',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Condition is required',
      patchTarget: 'mercari'
    });
  }
  
  // Brand validation (either brand OR noBrand must be set)
  const brand = mercariForm.brand || generalForm.brand;
  if (!brand && !mercariForm.noBrand) {
    issues.push({
      marketplace: 'mercari',
      field: 'brand',
      type: 'missing',
      severity: 'warning',
      message: 'Brand is recommended (or check "No Brand")',
      patchTarget: 'mercari'
    });
  }
  
  return issues;
}

export function validateFacebookForm(generalForm, facebookForm) {
  const issues = [];
  
  // Photos validation
  const photos = facebookForm.photos?.length > 0 ? facebookForm.photos : generalForm.photos;
  if (!photos || photos.length === 0) {
    issues.push({
      marketplace: 'facebook',
      field: 'photos',
      type: 'missing',
      severity: 'blocking',
      message: 'At least one photo is required',
      patchTarget: 'facebook'
    });
  }
  
  // Category validation (inherits from General if empty)
  const category = facebookForm.category || generalForm.category;
  const categoryId = facebookForm.categoryId || generalForm.categoryId;
  
  if (!category || !categoryId) {
    issues.push({
      marketplace: 'facebook',
      field: 'category',
      type: 'missing',
      severity: 'blocking',
      message: 'Please select a category',
      patchTarget: 'facebook'
    });
  }
  
  // Title validation
  if (!facebookForm.title && !generalForm.title) {
    issues.push({
      marketplace: 'facebook',
      field: 'title',
      type: 'missing',
      severity: 'blocking',
      message: 'Title is required',
      patchTarget: 'general'
    });
  }
  
  // Price validation
  const price = facebookForm.price || generalForm.price;
  if (!price || Number(price) <= 0) {
    issues.push({
      marketplace: 'facebook',
      field: 'price',
      type: 'missing',
      severity: 'blocking',
      message: 'Valid price is required',
      patchTarget: 'general'
    });
  }
  
  // Condition validation
  if (!facebookForm.condition && !generalForm.condition) {
    issues.push({
      marketplace: 'facebook',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Condition is required',
      patchTarget: 'facebook'
    });
  }
  
  // Size validation - REQUIRED for clothing/shoes categories
  const categoryLower = category?.toLowerCase() || '';
  if (categoryLower.includes('clothing') || 
      categoryLower.includes('shoes') || 
      categoryLower.includes('apparel')) {
    if (!facebookForm.size && !generalForm.size) {
      issues.push({
        marketplace: 'facebook',
        field: 'size',
        type: 'missing',
        severity: 'blocking',
        message: 'Size is required for clothing/shoes',
        patchTarget: 'facebook'
      });
    }
  }
  
  return issues;
}

// Helper function for Mercari category validation
function checkMercariCategoryComplete(categoryId, categoryPath) {
  if (!categoryId) return false;
  
  // Navigate through MERCARI_CATEGORIES using the path
  // This is the existing logic from CrosslistComposer.jsx lines ~37289-37322
  let currentLevel = MERCARI_CATEGORIES;
  const pathParts = categoryPath.split(' > ');
  
  for (const part of pathParts) {
    const found = Object.values(currentLevel).find(cat => cat.name === part);
    if (!found) return false;
    
    // If this is the last part of the path, check if it has subcategories
    if (part === pathParts[pathParts.length - 1]) {
      // If it has subcategories, it's not complete
      if (found.subcategories && Object.keys(found.subcategories).length > 0) {
        return false;
      }
      return true; // No subcategories = complete
    }
    
    currentLevel = found.subcategories || {};
  }
  
  return true;
}
```

### 5.2 Issue schema (normalized across marketplaces)

```typescript
type Issue = {
  marketplace: "ebay" | "mercari" | "facebook";
  field: string;                 // e.g. "categoryId", "condition", "shipping", "size"
  type: "missing" | "invalid" | "incomplete_path" | "mismatch";
  severity: "blocking" | "warning";
  message: string;

  // For dropdown fields
  options?: Array<{ id: string; label: string }>;
  suggested?: { id?: string; label?: string; confidence?: number };

  // Where it lives
  patchTarget: "general" | "ebay" | "mercari" | "facebook";
};
```

### 5.3 Preflight result shape

```typescript
type PreflightResult = {
  ready: Marketplace[];
  fixesNeeded: Array<{
    marketplace: Marketplace;
    issues: Issue[];
  }>;
};
```

**Implementation:**

```javascript
// In CrosslistComposer.jsx or new file: src/utils/preflightEngine.js

export async function preflightSelectedMarketplaces(
  selectedMarketplaces,
  generalForm,
  ebayForm,
  mercariForm,
  facebookForm,
  categoryTreeId
) {
  const ready = [];
  const fixesNeeded = [];
  
  for (const marketplace of selectedMarketplaces) {
    let issues = [];
    
    switch (marketplace) {
      case 'ebay':
        issues = validateEbayForm(generalForm, ebayForm, categoryTreeId);
        break;
      case 'mercari':
        issues = validateMercariForm(generalForm, mercariForm);
        break;
      case 'facebook':
        issues = validateFacebookForm(generalForm, facebookForm);
        break;
    }
    
    if (issues.length === 0) {
      ready.push(marketplace);
    } else {
      fixesNeeded.push({ marketplace, issues });
    }
  }
  
  return { ready, fixesNeeded };
}
```

---

## 6) Category handling rules (do not break current category systems)

**This is the most important part.**

### 6.1 eBay category suggestions

**You already have:**
- `useEbayCategorySuggestions(categoryTreeId, query)` in `src/hooks/useEbayCategorySuggestions.js`
- Tree navigation via `useEbayCategories(categoryTreeId, categoryId)`
- Breadcrumb state: `selectedCategoryPath` array
- Aspects loading: `useEbayCategoryAspects(categoryTreeId, categoryId)`

**Smart layer behavior (safe):**

If category missing/incomplete for eBay:
1. Show issue `incomplete_path` / `missing`
2. Call existing suggestion API with title keywords:
   ```javascript
   const { data: suggestions } = useEbayCategorySuggestions(
     categoryTreeId, 
     generalForm.title || ebayForm.title
   );
   ```
3. Show suggestions in Fixes Dialog
4. User selects one → patch `ebayForm.categoryId`/`ebayForm.categoryName`
5. Aspects load automatically (existing behavior)

**✅ Do not invent a new eBay category list. Use the eBay taxonomy API you already trust.**

### 6.2 Mercari categories

**Mercari uses:**
- `MERCARI_CATEGORIES` constant (lines 124-4150+ in `CrosslistComposer.jsx`)
- 3-level hierarchy: L0 (top like "Women", "Men") → L1 (like "Dresses") → L2 (like "Above knee, mini")
- Leaf ID requirement (no more subcategories)
- Helper: `flattenMercariCategories(categories, parentPath = [])` (lines ~34996-35018)
- Search state: `mercariCategorySearchValue`, `allMercariCategories` (flattened)

**Smart layer behavior (safe):**

If Mercari category missing:
1. Show Mercari category picker in dialog (reuse existing breadcrumb component)
2. Optionally add search using existing `flattenMercariCategories()` logic
3. User selects leaf category → patch:
   ```javascript
   mercariForm.mercariCategoryId = "149"
   mercariForm.mercariCategory = "Women > Dresses > Above knee, mini"
   ```
4. Validate complete path with existing `checkMercariCategoryComplete()` logic

**AI assistance (optional):**
- Only to rank top N results from search
- Input: title/description
- Candidates: results from `allMercariCategories` search
- Output: ranked list, user confirms

**✅ Do not "map" Mercari categories automatically unless user confirms—Mercari's tree is strict.**

### 6.3 Facebook categories (current truth: it reuses eBay tree)

**Facebook form stores:**
- `category` (eBay path string from General form)
- `categoryId` (eBay category ID from General form)
- Plus FB-specific: `condition`, `size`, `color`, `itemType`, `megapixels`

**Inheritance pattern (existing):**
```javascript
// From CrosslistComposer.jsx lines ~37097, 37676
categoryId: facebookForm.categoryId || generalForm.categoryId,
category: facebookForm.category || generalForm.category,
```

**Smart layer behavior (safe):**

If FB category missing:
1. Inherit from General form exactly as you already do:
   ```javascript
   facebookForm.category ||= generalForm.category
   facebookForm.categoryId ||= generalForm.categoryId
   ```
2. If still missing, show eBay category suggestions (same as General/eBay)
3. User selects → patch `facebookForm.category`/`facebookForm.categoryId`

**Important note:**
- Your current system uses **eBay tree for Facebook** categories
- Your `categoryMapper.js` is for **import mapping** (Facebook → Orben internal categories)
- Do NOT introduce new FB native taxonomy IDs at this stage
- If FB requires different selection later (e.g., "Figurines" → "Figure"), treat it as:
  - Field mismatch issue
  - Let user pick closest available option in existing eBay tree
  - Or add FB-native taxonomy as separate milestone (carefully planned)

**✅ Keep FB piggybacking on eBay tree for now. Changing this requires careful planning.**

### 6.4 Internal Orben predefined categories (21)

**Location:** `src/pages/AddInventoryItem.jsx` lines 42-65

**Current usage:**
- Inventory organization
- Facebook import mapping (`api/utils/categoryMapper.js`)
- Dropdown in Add Inventory form

**Smart layer use:**
- Use as "fast first guess" / UI hint
- Help with category keyword suggestions
- Don't force into marketplace listings unless needed
- Keep as separate field if showing in listing page

**Example AI prompt enhancement:**
```javascript
// When suggesting eBay/FB category
const systemPrompt = `
Given this item, suggest the best category from these options.
Internal hint: This item is tagged as "${generalForm.orbenCategory}" in our system.
`;
```

---

## 7) AI integration (OPTION 1 — simple similarity, not training)

**Use AI only to pick the best similar option from an allowed set, and only when needed.**

### 7.1 AI should never output arbitrary categories

AI is constrained to:

- **Orben predefined 21 categories** → internal hint only
- **eBay category suggestions** → from eBay API (AI ranks among them)
- **Mercari leaf options** → from `flattenMercariCategories()` (AI ranks among top N)
- **FB category** → from eBay tree suggestions (same as eBay)

**So AI becomes a "ranking helper," not a source of truth.**

### 7.2 Endpoints (optional but recommended)

```javascript
// POST /api/ai/rank-options
// Use for: "Given title/desc, choose best option among these 20–50 candidates"

// Request
{
  "text": "Dragon Ball Z Resin Figurine",
  "field": "mercariCategory",
  "options": [
    {"id":"149","label":"Women > Dresses > Above knee, mini"},
    {"id":"XXXX","label":"Toys & Hobbies > Figurines"},
    {"id":"YYYY","label":"Collectibles > Figurines"},
    // ... up to 50 candidates from search
  ]
}

// Response
{
  "best": {"id":"XXXX","label":"Toys & Hobbies > Figurines"},
  "confidence": 0.88,
  "alternates": [
    {"id":"YYYY","label":"Collectibles > Figurines","confidence":0.72}
  ]
}
```

**Implementation notes:**
- Use cheap model (GPT-4o-mini, Claude Haiku, Gemini Flash)
- System prompt: "You are a product categorization expert. Select the BEST matching category from the provided options."
- Context: item title, description, price, condition, existing Orben category hint
- Output: JSON with selection + confidence

**✅ This does not change your category systems. It just picks the closest valid option.**

---

## 8) Attribute extraction schema (keep light, marketplace-aware)

Store extracted attributes without forcing them into marketplace forms until needed.

### 8.1 Canonical attributes JSON

```typescript
type Attributes = {
  brand?: string;
  color?: string;
  size?: string;        // Keep string to avoid marketplace conflicts
  material?: string;
  gender?: "Men"|"Women"|"Unisex"|"Kids";
  franchise?: string;   // For collectibles
  character?: string;
  model?: string;
};
```

**Storage:** Add to `generalForm` or inventory item metadata:
```javascript
generalForm.extractedAttributes = { brand: "Nike", color: "Black", size: "10", ... }
```

### 8.2 How attributes get used

1. **Preflight detects missing required field** (e.g., FB size)
2. **If attribute exists in canonical attributes** → suggest patch in Fixes Dialog
3. **User confirms** → patch marketplace form field
4. **No auto-fill without confirmation**

**Example:**
```javascript
// In validateFacebookForm
if (!facebookForm.size && generalForm.extractedAttributes?.size) {
  issues.push({
    marketplace: 'facebook',
    field: 'size',
    type: 'missing',
    severity: 'blocking',
    message: 'Size is required for clothing/shoes',
    suggested: { 
      label: generalForm.extractedAttributes.size, 
      confidence: 0.9 
    },
    patchTarget: 'facebook'
  });
}
```

---

## 9) Confidence UX behavior (to avoid bad autofill)

**Applies to AI suggestions only.**

### Threshold behavior:

- **≥ 0.85**: Preselect suggestion in dialog, no warning
- **0.70–0.84**: Preselect but show "Suggested" badge + show alternates
- **< 0.70**: Do not preselect; show "Pick one" UI

### Blocking issues:

For blocking issues (category leaf, required field):
- **Require explicit confirmation** if confidence < 0.75
- Show "Please confirm this selection" message
- Disable "List now" until user clicks confirm

### Visual indicators:

```javascript
// In Fixes Dialog
{issue.suggested && (
  <div className="mt-2 p-3 border rounded">
    {issue.suggested.confidence >= 0.85 ? (
      <Badge variant="success">Auto-suggested</Badge>
    ) : issue.suggested.confidence >= 0.70 ? (
      <Badge variant="warning">Suggested (please review)</Badge>
    ) : (
      <Badge variant="secondary">Low confidence - please confirm</Badge>
    )}
    <div className="mt-2">
      <strong>{issue.suggested.label}</strong>
      {issue.suggested.confidence < 0.85 && (
        <Button size="sm" onClick={() => applyPatch(issue)}>
          Confirm & Apply
        </Button>
      )}
    </div>
  </div>
)}
```

---

## 10) Cost reduction plan (~70%+) tailored to your flow

Because you already have category sources, AI usage can be tiny.

### ✅ Implement all:

**1. Don't call AI unless there is an issue**
```javascript
if (preflightResult.ready.length === selectedMarketplaces.length) {
  // All valid, no AI call needed
  return submitListings();
}
```

**2. Rank only small candidate sets**
```javascript
// eBay: ask eBay suggestions API first; send top 10–25 to AI ranker
const ebaySuggestions = await getEbayCategorySuggestions(title);
const topCandidates = ebaySuggestions.slice(0, 25);
const ranked = await rankOptions({ text: title + description, options: topCandidates });

// Mercari: use search to get top 25; AI ranks those
const searchResults = allMercariCategories.filter(cat => 
  cat.label.toLowerCase().includes(searchTerm.toLowerCase())
).slice(0, 25);
const ranked = await rankOptions({ text: title + description, options: searchResults });
```

**3. Fingerprint cache**
```javascript
// Cache key
const fingerprint = normalize(title + description + price + condition);
const cacheKey = `rank:${fingerprint}:${hashOptions(options)}`;

// Check cache before AI call
const cached = await cache.get(cacheKey);
if (cached) return cached;

const result = await aiRankOptions(...);
await cache.set(cacheKey, result, { ttl: 86400 }); // 24hr
```

**4. Never do per-marketplace "full" AI calls**
- AI only ranks options from existing sources
- AI never generates categories from scratch
- Mapping/validation does the rest

### Expected savings:

- **Before:** AI call on every keystroke, every field, every marketplace = 100+ calls per listing
- **After:** AI call only when issue detected + options available = 1-3 calls per listing
- **Reduction:** ~70-95% depending on listing quality

---

## 11) Implementation tasks (copy/paste to Cursor)

### Phase 1 — Refactor validations into reusable preflight

**Task 1.1:** Extract eBay validation
```
- Open src/pages/CrosslistComposer.jsx
- Find eBay submit handler validation logic (~lines 36700-36900)
- Extract to src/utils/listingValidation.js::validateEbayForm()
- Return normalized Issue[] array
- Test: call validateEbayForm with current form state, verify issues match
```

**Task 1.2:** Extract Mercari validation
```
- Find Mercari submit handler validation logic (~lines 37200-37370)
- Extract to src/utils/listingValidation.js::validateMercariForm()
- Include checkMercariCategoryComplete helper
- Return normalized Issue[] array
```

**Task 1.3:** Extract Facebook validation
```
- Find Facebook submit handler validation logic (~lines 37050-37100)
- Extract to src/utils/listingValidation.js::validateFacebookForm()
- Include size validation for clothing/shoes categories
- Return normalized Issue[] array
```

**Task 1.4:** Create preflight engine
```
- Create src/utils/preflightEngine.js
- Implement preflightSelectedMarketplaces() function
- Takes: selectedMarketplaces[], generalForm, ebayForm, mercariForm, facebookForm, categoryTreeId
- Returns: PreflightResult { ready[], fixesNeeded[] }
- Use validation functions from Task 1.1-1.3
```

### Phase 2 — Fixes Dialog (patch form state, don't create new payloads)

**Task 2.1:** Create Fixes Dialog component
```
- Create src/components/FixesDialog.jsx
- Props: open, onClose, preflightResult, onApplyFix, onListNow
- Left panel: marketplaces list with status icons
- Right panel: IssuesList component for selected marketplace
- Footer: Cancel + List Now buttons
- Disable List Now if blocking issues remain
```

**Task 2.2:** Create IssuesList component
```
- Create src/components/IssuesList.jsx
- Shows each issue with:
  - Icon based on severity (blocking = red X, warning = yellow !)
  - Field name + message
  - Fix UI based on field type:
    - Text input for missing text fields
    - Dropdown for category/condition/etc
    - Checkbox for boolean fields
  - If suggested value exists, show with confidence badge
  - "Apply" button to patch form
```

**Task 2.3:** Add "List to Selected" UI
```
- In CrosslistComposer.jsx, add marketplace multi-select checkboxes
- Add "List to [N] Selected Marketplace(s)" button
- Feature flag: only show if SMART_LISTING_ENABLED
- Wire up to handleListToSelected function
```

**Task 2.4:** Implement patch application logic
```
- In CrosslistComposer.jsx, add handleApplyFix function:
  - Takes: issue, newValue
  - Updates appropriate form state based on issue.patchTarget
  - Re-runs preflight to update issues list
- Add handleListNow function:
  - Validates all issues resolved
  - Calls existing handleSubmit for each ready marketplace
```

### Phase 3 — Category resolution helpers using existing systems

**Task 3.1:** eBay category issue UI
```
- In IssuesList.jsx, for field === 'categoryId':
  - Reuse existing eBay category suggestion hook
  - Call useEbayCategorySuggestions(categoryTreeId, title)
  - Show suggestions as selectable list
  - On select: patch ebayForm.categoryId + categoryName
  - Show breadcrumb navigation if user wants to browse tree
```

**Task 3.2:** Mercari category issue UI
```
- For field === 'mercariCategory':
  - Reuse existing breadcrumb picker component
  - Or show searchable dropdown using allMercariCategories (flattened)
  - On select: validate leaf category, patch mercariForm fields
  - Show error if incomplete path selected
```

**Task 3.3:** Facebook category issue UI
```
- For field === 'category':
  - First try inheriting from General form
  - If still missing, show eBay category suggestions (same as Task 3.1)
  - On select: patch facebookForm.category + categoryId
```

**Task 3.4:** Add category validation helpers
```
- In listingValidation.js:
  - isEbayCategoryLeaf(categoryId, categoriesData)
  - isMercariCategoryLeaf(categoryId, categoryPath)
  - Use in validation functions to detect incomplete_path issues
```

### Phase 4 — Optional AI ranker (safe, minimal, cheap)

**Task 4.1:** Create AI rank endpoint
```
- Create api/ai/rank-options.js
- POST /api/ai/rank-options
- Takes: { text, field, options[] }
- Calls OpenAI/Anthropic/Google with cheap model
- System prompt: categorization expert, select best from options
- Returns: { best, confidence, alternates[] }
- Feature flag: AI_SUGGESTIONS_ENABLED
```

**Task 4.2:** Add fingerprint caching
```
- Install hash library (crypto built-in)
- Create cacheKey from fingerprint + options hash
- Use Redis or in-memory cache
- TTL: 24 hours
- Check cache before AI call
```

**Task 4.3:** Integrate AI ranking into category suggestions
```
- In IssuesList.jsx, when showing category options:
  - If AI_SUGGESTIONS_ENABLED and confidence needed
  - Call /api/ai/rank-options with candidates
  - Show ranked results with confidence badges
  - Preselect based on confidence threshold (section 9)
```

**Task 4.4:** Add cost tracking
```
- Log each AI call with:
  - fingerprint
  - tokens used
  - cost
  - result confidence
- Create dashboard to monitor usage
- Alert if daily cost exceeds threshold
```

### Phase 5 — Attributes (suggest, don't force)

**Task 5.1:** Add attributes to General form
```
- In CrosslistComposer.jsx, add extractedAttributes field:
  generalForm.extractedAttributes = { brand, color, size, material, ... }
- Populate from existing form fields or AI extraction
```

**Task 5.2:** Use attributes in suggestions
```
- In validateFacebookForm, when size missing:
  - Check generalForm.extractedAttributes?.size
  - If exists, add as suggested value in issue
- Similar for other required fields across marketplaces
```

**Task 5.3:** Optional: AI attribute extraction
```
- Create api/ai/extract-attributes.js
- POST /api/ai/extract-attributes
- Takes: { title, description, photos? }
- Returns: Attributes JSON
- Call once per item, cache by fingerprint
- Show in UI as "auto-detected" fields
```

### Phase 6 — Safety and rollback

**Task 6.1:** Add feature flags
```
- Create src/config/features.js:
  - SMART_LISTING_ENABLED (main toggle)
  - AI_SUGGESTIONS_ENABLED (AI features)
- Load from env vars or user settings
- Gate all new UI/logic behind flags
```

**Task 6.2:** Add comprehensive logging
```
- Log preflight results:
  - Which marketplaces passed/failed
  - Top 5 blocking issues
  - Time to complete preflight
- Log fixes applied:
  - Issue type
  - Suggested vs manual fix
  - Time spent in dialog
- Log listing outcomes:
  - Success/failure per marketplace
  - Errors encountered
- Send to analytics (PostHog, Amplitude, etc)
```

**Task 6.3:** Keep old listing flow available
```
- Keep individual "List to eBay/Mercari/Facebook" buttons
- They use existing submit handlers unchanged
- Smart listing is additive, not replacement
- If issues with new flow, user can fall back
```

**Task 6.4:** Add error boundaries
```
- Wrap FixesDialog in ErrorBoundary
- If dialog crashes, show error + close button
- User can still use old listing flow
- Log errors to monitoring (Sentry, etc)
```

---

## 12) Testing checklist (regression-focused)

### ✅ Must pass (existing flows unchanged):

**Test 1:** Listing to eBay only works exactly as before
```
- Fill General form with valid data
- Switch to eBay tab
- Click "List to eBay" button (old button)
- Verify listing created successfully
- Verify payload matches previous format
```

**Test 2:** Listing to Mercari only works exactly as before
```
- Fill General form
- Switch to Mercari tab
- Select complete Mercari category path
- Click "List to Mercari" button
- Verify listing created successfully
```

**Test 3:** Listing to Facebook only works exactly as before
```
- Fill General form with category
- Switch to Facebook tab
- Category should inherit from General
- Click "List to Facebook" button
- Verify listing created successfully
```

**Test 4:** Feature flag OFF hides new UI
```
- Set SMART_LISTING_ENABLED = false
- Verify "List to Selected" button hidden
- Verify only old buttons visible
- Verify all functionality works as before
```

### ✅ New expected behavior:

**Test 5:** Preflight with no issues bypasses dialog
```
- Fill all required fields for eBay + Mercari
- Select both marketplaces
- Click "List to Selected"
- Verify listings created immediately (no dialog shown)
```

**Test 6:** Preflight with issues opens dialog
```
- Fill General form, leave eBay category empty
- Select eBay marketplace
- Click "List to Selected"
- Verify Fixes Dialog opens
- Verify eBay shows blocking issue for category
```

**Test 7:** Category validation - eBay incomplete path
```
- Select eBay category with subcategories (not leaf)
- Run preflight
- Verify incomplete_path issue shown
- Verify suggestions offered
- Select leaf category
- Verify issue resolved
```

**Test 8:** Category validation - Mercari incomplete path
```
- Select Mercari L1 category (has subcategories)
- Run preflight
- Verify incomplete_path issue shown
- Select complete path to L2 leaf
- Verify issue resolved
```

**Test 9:** Facebook category inheritance
```
- Fill General form with category
- Leave Facebook category empty
- Run preflight for Facebook
- Verify no category issue (inherited from General)
- Verify listing uses General category
```

**Test 10:** Size required for clothing/shoes
```
- Select Facebook category "Clothing & Apparel"
- Leave size empty
- Run preflight
- Verify blocking issue for size field
- Fill size
- Verify issue resolved
```

**Test 11:** AI suggestions (if enabled)
```
- Leave category empty
- Run preflight with AI_SUGGESTIONS_ENABLED
- Verify suggested categories shown
- Verify confidence badge displayed
- Verify alternates available if confidence < 0.85
```

**Test 12:** Dialog state management
```
- Open Fixes Dialog with issues
- Fix some issues
- Verify issues list updates
- Verify "List now" enabled when all blocking resolved
- Click "List now"
- Verify listings created for ready marketplaces
```

**Test 13:** Patch application
```
- Apply fix in dialog
- Verify form state updated
- Switch to marketplace tab
- Verify field shows applied value
- Verify inherited values preserved
```

---

## 13) What Cursor should NOT do

### ❌ Do not replace eBay taxonomy logic with your own list
- Keep using `useEbayCategorySuggestions` hook
- Keep using eBay Taxonomy API (`/api/ebay/taxonomy`)
- Do not hardcode eBay categories

### ❌ Do not change Mercari category IDs or tree structure
- `MERCARI_CATEGORIES` is source of truth
- Do not modify IDs or paths
- Do not add categories not from Mercari website

### ❌ Do not introduce new FB taxonomy IDs unless separately planned
- Facebook currently uses eBay tree (this is intentional)
- `categoryMapper.js` is for import mapping only
- Do not create FB-native category system without approval

### ❌ Do not change existing job creation / posting payload contracts
- Keep calling same extension methods:
  - `ext.createEbayListing(payload)`
  - `ext.createMercariListing(payload)`
  - `ext.createFacebookListing(payload)`
- Do not modify payload structure
- Do not change field names or formats

### ❌ Do not auto-fill fields without user confirmation
- Always show suggestions in dialog
- Require explicit "Apply" or "Confirm" action
- Especially for low-confidence suggestions (<0.75)

### ❌ Do not break form inheritance patterns
- Facebook inherits from General (keep this)
- eBay/Mercari can override General (keep this)
- Do not change `inheritGeneral` logic

### ❌ Do not remove or hide existing listing buttons
- Keep individual marketplace buttons
- Smart listing is additive
- Old flow must remain functional

---

## 14) File reference quick map

**Category systems:**
- eBay: `src/hooks/useEbayCategorySuggestions.js`, `api/ebay/taxonomy.js`
- Mercari: `src/pages/CrosslistComposer.jsx` lines 124-4150+
- Facebook: inherits eBay, `api/utils/categoryMapper.js` for imports
- Orben (21): `src/pages/AddInventoryItem.jsx` lines 42-65

**Validation logic:**
- Current: `src/pages/CrosslistComposer.jsx` submit handlers
- New: `src/utils/listingValidation.js` (to be created)

**Preflight:**
- `src/utils/preflightEngine.js` (to be created)

**UI components:**
- Main composer: `src/pages/CrosslistComposer.jsx`
- Fixes dialog: `src/components/FixesDialog.jsx` (to be created)
- Issues list: `src/components/IssuesList.jsx` (to be created)

**AI endpoints:**
- `/api/ai/rank-options.js` (to be created)
- `/api/ai/extract-attributes.js` (optional)

**Config:**
- Feature flags: `src/config/features.js` (to be created)

---

## 15) Success metrics

**Before smart listing:**
- Listing failure rate: ~30-40% (missing fields, wrong categories)
- Time per crosslist: 5-10 minutes (manual copy/paste)
- Category selection errors: High (especially Mercari)

**After smart listing:**
- Listing failure rate target: <5% (only true errors)
- Time per crosslist target: 2-3 minutes (preflight + batch submit)
- Category selection accuracy: 90%+ (with AI suggestions)
- AI cost: <$0.05 per listing (with caching)

**Track:**
- Preflight pass rate (ready without issues)
- Top 10 blocking issues
- AI suggestion acceptance rate
- Time spent in Fixes Dialog
- Cost per AI call
- Overall listing success rate

---

## 16) Rollout plan

**Week 1:** Phase 1-2 (Validation refactor + Fixes Dialog)
- Extract validations
- Build preflight engine
- Create Fixes Dialog UI
- No AI, just manual fixes
- Test with feature flag OFF

**Week 2:** Phase 3 (Category helpers)
- Add category issue UI for each marketplace
- Test with real category data
- Verify no regression

**Week 3:** Phase 4-5 (AI + Attributes)
- Add AI rank endpoint
- Add caching
- Test with sample data
- Monitor costs

**Week 4:** Phase 6 (Safety + Launch)
- Add logging/monitoring
- Run regression tests
- Enable for beta users
- Gather feedback
- Full rollout

---

## 17) Emergency rollback procedure

If critical issues arise:

1. **Immediate:** Set `SMART_LISTING_ENABLED=false` in env
2. **Verify:** Old listing flow works for all users
3. **Investigate:** Check logs for error patterns
4. **Fix:** Address issues in isolated feature branch
5. **Re-enable:** After thorough testing, flip flag back ON

**Critical issue indicators:**
- Listing success rate drops >10%
- Error rate spikes in production
- User complaints about broken functionality
- Extension communication failures
- Category validation false positives

---

**END OF IMPLEMENTATION GUIDE**

This guide is tailored to your exact codebase structure. Follow phases sequentially, test thoroughly, and always maintain the ability to roll back.
