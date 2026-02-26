/**
 * Reusable validation functions for marketplace listings
 * Extracted from CrosslistComposer.jsx to enable preflight validation
 */

// Note: MERCARI_CATEGORIES will be passed in from CrosslistComposer
// This avoids circular imports
let MERCARI_CATEGORIES_CACHE = null;

export function setMercariCategories(categories) {
  MERCARI_CATEGORIES_CACHE = categories;
}

function getMercariCategories() {
  if (!MERCARI_CATEGORIES_CACHE) {
    console.warn('MERCARI_CATEGORIES not set. Call setMercariCategories() first.');
    return {};
  }
  return MERCARI_CATEGORIES_CACHE;
}

// ---------------------------------------------------------------------------
// Facebook categories cache (injected from CrosslistComposer to avoid circular imports)
// ---------------------------------------------------------------------------
let FACEBOOK_CATEGORIES_CACHE = null;

export function setFacebookCategories(categories) {
  FACEBOOK_CATEGORIES_CACHE = categories;
}

/**
 * Simple keyword-overlap score between two strings.
 * Returns a non-negative integer — higher is better.
 */
function keywordScore(source, target) {
  const srcTokens = source.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const tgtTokens = target.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  let score = 0;
  for (const t of srcTokens) {
    if (tgtTokens.some(w => w === t || w.startsWith(t) || t.startsWith(w))) score += 1;
  }
  return score;
}

/**
 * Find the best matching Facebook category for a free-form category string.
 * Returns { categoryId, categoryName, confidence } or null.
 */
export function suggestFacebookCategory(generalCategory) {
  if (!FACEBOOK_CATEGORIES_CACHE || !generalCategory) return null;

  let best = null;
  let bestScore = 0;

  for (const cat of FACEBOOK_CATEGORIES_CACHE) {
    // Top-level match
    const topScore = keywordScore(generalCategory, cat.categoryName);
    if (topScore > bestScore) {
      bestScore = topScore;
      best = { categoryId: cat.categoryId, categoryName: cat.categoryName };
    }

    // Subcategory match
    for (const sub of (cat.subcategories || [])) {
      // Score against the subcategory name and also the combined "Parent > Sub" path
      const subScore = Math.max(
        keywordScore(generalCategory, sub.categoryName),
        keywordScore(generalCategory, `${cat.categoryName} ${sub.categoryName}`)
      );
      if (subScore > bestScore) {
        bestScore = subScore;
        best = {
          categoryId: sub.categoryId,
          categoryName: `${cat.categoryName} > ${sub.categoryName}`,
        };
      }
    }
  }

  if (!best || bestScore === 0) return null;

  // Cap confidence at 0.88 – the AI endpoint may refine further
  const confidence = Math.min(0.5 + bestScore * 0.12, 0.88);
  return { ...best, confidence };
}

/**
 * Issue schema for normalized validation results
 * @typedef {Object} Issue
 * @property {'ebay'|'mercari'|'facebook'} marketplace
 * @property {string} field
 * @property {'missing'|'invalid'|'incomplete_path'|'mismatch'|'suggestion'} type
 * @property {'blocking'|'warning'|'suggestion'} severity
 * @property {string} message
 * @property {Array<{id: string, label: string}>} [options]
 * @property {{id?: string, label: string, confidence?: number, reasoning?: string, sourceField?: string, sourceValue?: string}} [suggested]
 * @property {'general'|'ebay'|'mercari'|'facebook'} patchTarget
 */

// ---------------------------------------------------------------------------
// Condition mapping: General form → marketplace-specific values
// ---------------------------------------------------------------------------
const CONDITION_MAP = {
  ebay: {
    'New With Tags/Box':       { id: 'New',                        label: 'New' },
    'New Without Tags/Box':    { id: 'New',                        label: 'New' },
    'New With Imperfections':  { id: 'Open Box',                   label: 'Open Box' },
    'Pre - Owned - Excellent': { id: 'Used',                       label: 'Used' },
    'Pre - Owned - Good':      { id: 'Used',                       label: 'Used' },
    'Pre - Owned - Fair':      { id: 'For parts or not working',   label: 'For parts or not working' },
  },
  mercari: {
    'New With Tags/Box':       { id: 'New',       label: 'New' },
    'New Without Tags/Box':    { id: 'New',       label: 'New' },
    'New With Imperfections':  { id: 'Like New',  label: 'Like New' },
    'Pre - Owned - Excellent': { id: 'Like New',  label: 'Like New' },
    'Pre - Owned - Good':      { id: 'Good',      label: 'Good' },
    'Pre - Owned - Fair':      { id: 'Fair',      label: 'Fair' },
  },
  facebook: {
    'New With Tags/Box':       { id: 'new',            label: 'New' },
    'New Without Tags/Box':    { id: 'new',            label: 'New' },
    'New With Imperfections':  { id: 'used_like_new',  label: 'Used - Like New' },
    'Pre - Owned - Excellent': { id: 'used_like_new',  label: 'Used - Like New' },
    'Pre - Owned - Good':      { id: 'used_good',      label: 'Used - Good' },
    'Pre - Owned - Fair':      { id: 'used_fair',      label: 'Used - Fair' },
  },
};

/**
 * Map a general-form condition string to the marketplace-specific option.
 * Returns { id, label } or null if no mapping exists.
 */
export function mapCondition(generalCondition, marketplace) {
  if (!generalCondition || !marketplace) return null;
  return CONDITION_MAP[marketplace]?.[generalCondition] ?? null;
}

// ---------------------------------------------------------------------------
// Smart suggestions: proactive suggestions derived from the general form
// ---------------------------------------------------------------------------

/**
 * Build a suggestion issue object.
 */
function makeSuggestion({ marketplace, field, patchTarget, options, suggested, message }) {
  return {
    marketplace,
    field,
    type: 'suggestion',
    severity: 'suggestion',
    message,
    patchTarget,
    options,
    suggested: { ...suggested, confidence: suggested.confidence ?? 0.92 },
  };
}

/**
 * Generate smart suggestions for marketplace-specific fields that can be
 * derived from the general form.  These appear as proactive "Smart Fill"
 * items in the review modal — never as blocking errors.
 *
 * @param {Object} generalForm
 * @param {Object} marketplaceForm  - The form for `marketplace`
 * @param {'ebay'|'mercari'|'facebook'} marketplace
 * @returns {Issue[]}
 */
export function generateSmartSuggestions(generalForm, marketplaceForm, marketplace) {
  const suggestions = [];

  // -------------------------------------------------------------------------
  // eBay suggestions
  // -------------------------------------------------------------------------
  if (marketplace === 'ebay') {
    // Condition
    if (!marketplaceForm.condition && generalForm.condition) {
      const mapped = mapCondition(generalForm.condition, 'ebay');
      if (mapped) {
        suggestions.push(makeSuggestion({
          marketplace: 'ebay', field: 'condition', patchTarget: 'ebay',
          options: CONDITION_OPTIONS.ebay,
          message: `Condition can be mapped from your general listing`,
          suggested: {
            id: mapped.id, label: mapped.label, confidence: 0.93,
            reasoning: `"${generalForm.condition}" → eBay "${mapped.label}"`,
            sourceField: 'condition', sourceValue: generalForm.condition,
          },
        }));
      }
    }

    // Brand
    if (!marketplaceForm.ebayBrand && !marketplaceForm.brand && generalForm.brand) {
      suggestions.push(makeSuggestion({
        marketplace: 'ebay', field: 'ebayBrand', patchTarget: 'ebay',
        message: `Brand can be copied from your general listing`,
        suggested: {
          label: generalForm.brand, confidence: 0.95,
          reasoning: `Using brand "${generalForm.brand}" from your general listing`,
          sourceField: 'brand', sourceValue: generalForm.brand,
        },
      }));
    }

    // Color
    if (!marketplaceForm.color && generalForm.color1) {
      suggestions.push(makeSuggestion({
        marketplace: 'ebay', field: 'color', patchTarget: 'ebay',
        message: `Color can be copied from your general listing`,
        suggested: {
          label: generalForm.color1, confidence: 0.90,
          reasoning: `Using color "${generalForm.color1}" from your general listing`,
          sourceField: 'color1', sourceValue: generalForm.color1,
        },
      }));
    }

    // Price
    if (!marketplaceForm.buyItNowPrice && generalForm.price) {
      suggestions.push(makeSuggestion({
        marketplace: 'ebay', field: 'buyItNowPrice', patchTarget: 'ebay',
        message: `Price can be copied from your general listing`,
        suggested: {
          label: String(generalForm.price), confidence: 0.95,
          reasoning: `Using price "$${generalForm.price}" from your general listing`,
          sourceField: 'price', sourceValue: generalForm.price,
        },
      }));
    }

    // Pricing format default
    if (!marketplaceForm.pricingFormat) {
      suggestions.push(makeSuggestion({
        marketplace: 'ebay', field: 'pricingFormat', patchTarget: 'ebay',
        options: PRICING_FORMAT_OPTIONS,
        message: `Recommended listing format`,
        suggested: {
          id: 'fixed', label: 'Fixed Price', confidence: 0.90,
          reasoning: 'Fixed Price is the standard format for Buy It Now listings',
        },
      }));
    }

    // Duration default
    if (!marketplaceForm.duration) {
      suggestions.push(makeSuggestion({
        marketplace: 'ebay', field: 'duration', patchTarget: 'ebay',
        options: DURATION_OPTIONS,
        message: `Recommended listing duration`,
        suggested: {
          id: "Good 'Til Canceled", label: "Good 'Til Canceled", confidence: 0.88,
          reasoning: "Good 'Til Canceled keeps your listing active until sold",
        },
      }));
    }

    // Handling time default
    if (!marketplaceForm.handlingTime) {
      suggestions.push(makeSuggestion({
        marketplace: 'ebay', field: 'handlingTime', patchTarget: 'ebay',
        options: HANDLING_TIME_OPTIONS,
        message: `Recommended handling time`,
        suggested: {
          id: '1 business day', label: '1 business day', confidence: 0.85,
          reasoning: '1 business day is the fastest handling time and improves search ranking',
        },
      }));
    }
  }

  // -------------------------------------------------------------------------
  // Mercari suggestions
  // -------------------------------------------------------------------------
  if (marketplace === 'mercari') {
    // Condition
    if (!marketplaceForm.condition && generalForm.condition) {
      const mapped = mapCondition(generalForm.condition, 'mercari');
      if (mapped) {
        suggestions.push(makeSuggestion({
          marketplace: 'mercari', field: 'condition', patchTarget: 'mercari',
          options: CONDITION_OPTIONS.mercari,
          message: `Condition can be mapped from your general listing`,
          suggested: {
            id: mapped.id, label: mapped.label, confidence: 0.93,
            reasoning: `"${generalForm.condition}" → Mercari "${mapped.label}"`,
            sourceField: 'condition', sourceValue: generalForm.condition,
          },
        }));
      }
    }

    // Brand
    if (!marketplaceForm.brand && generalForm.brand) {
      suggestions.push(makeSuggestion({
        marketplace: 'mercari', field: 'brand', patchTarget: 'mercari',
        message: `Brand can be copied from your general listing`,
        suggested: {
          label: generalForm.brand, confidence: 0.95,
          reasoning: `Using brand "${generalForm.brand}" from your general listing`,
          sourceField: 'brand', sourceValue: generalForm.brand,
        },
      }));
    }

    // Color
    if (!marketplaceForm.color && generalForm.color1) {
      suggestions.push(makeSuggestion({
        marketplace: 'mercari', field: 'color', patchTarget: 'mercari',
        message: `Color can be copied from your general listing`,
        suggested: {
          label: generalForm.color1, confidence: 0.90,
          reasoning: `Using color "${generalForm.color1}" from your general listing`,
          sourceField: 'color1', sourceValue: generalForm.color1,
        },
      }));
    }

    // Size
    if (!marketplaceForm.size && generalForm.size) {
      suggestions.push(makeSuggestion({
        marketplace: 'mercari', field: 'size', patchTarget: 'mercari',
        message: `Size can be copied from your general listing`,
        suggested: {
          label: generalForm.size, confidence: 0.90,
          reasoning: `Using size "${generalForm.size}" from your general listing`,
          sourceField: 'size', sourceValue: generalForm.size,
        },
      }));
    }
  }

  // -------------------------------------------------------------------------
  // Facebook suggestions
  // -------------------------------------------------------------------------
  if (marketplace === 'facebook') {
    // Condition
    if (!marketplaceForm.condition && generalForm.condition) {
      const mapped = mapCondition(generalForm.condition, 'facebook');
      if (mapped) {
        suggestions.push(makeSuggestion({
          marketplace: 'facebook', field: 'condition', patchTarget: 'facebook',
          options: CONDITION_OPTIONS.facebook,
          message: `Condition can be mapped from your general listing`,
          suggested: {
            id: mapped.id, label: mapped.label, confidence: 0.93,
            reasoning: `"${generalForm.condition}" → Facebook "${mapped.label}"`,
            sourceField: 'condition', sourceValue: generalForm.condition,
          },
        }));
      }
    }

    // Brand
    if (!marketplaceForm.brand && generalForm.brand) {
      suggestions.push(makeSuggestion({
        marketplace: 'facebook', field: 'brand', patchTarget: 'facebook',
        message: `Brand can be copied from your general listing`,
        suggested: {
          label: generalForm.brand, confidence: 0.95,
          reasoning: `Using brand "${generalForm.brand}" from your general listing`,
          sourceField: 'brand', sourceValue: generalForm.brand,
        },
      }));
    }

    // Size
    if (!marketplaceForm.size && generalForm.size) {
      suggestions.push(makeSuggestion({
        marketplace: 'facebook', field: 'size', patchTarget: 'facebook',
        message: `Size can be copied from your general listing`,
        suggested: {
          label: generalForm.size, confidence: 0.90,
          reasoning: `Using size "${generalForm.size}" from your general listing`,
          sourceField: 'size', sourceValue: generalForm.size,
        },
      }));
    }
  }

  // -------------------------------------------------------------------------
  // Etsy suggestions
  // -------------------------------------------------------------------------
  if (marketplace === 'etsy') {
    // Primary color — inherit from general if not set on Etsy form
    if (!marketplaceForm.color1 && generalForm.color1) {
      suggestions.push(makeSuggestion({
        marketplace: 'etsy', field: 'color1', patchTarget: 'etsy',
        message: `Primary color can be copied from your general listing`,
        suggested: {
          label: generalForm.color1, confidence: 0.93,
          reasoning: `Using primary color "${generalForm.color1}" from your general listing`,
          sourceField: 'color1', sourceValue: generalForm.color1,
        },
      }));
    }

    // Secondary color — prompt the user to add one if only a primary color is set
    if (!marketplaceForm.color2 && (marketplaceForm.color1 || generalForm.color1)) {
      suggestions.push({
        marketplace: 'etsy',
        field: 'color2',
        type: 'suggestion',
        severity: 'suggestion',
        patchTarget: 'etsy',
        message: `Etsy supports a secondary color — does your item have a second color?`,
        suggested: null,
      });
    }

    // Brand
    if (!marketplaceForm.brand && generalForm.brand) {
      suggestions.push(makeSuggestion({
        marketplace: 'etsy', field: 'brand', patchTarget: 'etsy',
        message: `Brand can be copied from your general listing`,
        suggested: {
          label: generalForm.brand, confidence: 0.92,
          reasoning: `Using brand "${generalForm.brand}" from your general listing`,
          sourceField: 'brand', sourceValue: generalForm.brand,
        },
      }));
    }
  }

  return suggestions;
}

// Dropdown options for common fields
const CONDITION_OPTIONS = {
  ebay: [
    { id: 'New', label: 'New' },
    { id: 'Open Box', label: 'Open Box' },
    { id: 'Used', label: 'Used' },
    { id: 'For parts or not working', label: 'For parts or not working' }
  ],
  mercari: [
    { id: 'New', label: 'New' },
    { id: 'Like New', label: 'Like New' },
    { id: 'Good', label: 'Good' },
    { id: 'Fair', label: 'Fair' },
    { id: 'Poor', label: 'Poor' }
  ],
  facebook: [
    { id: 'new', label: 'New' },
    { id: 'used_like_new', label: 'Used - Like New' },
    { id: 'used_good', label: 'Used - Good' },
    { id: 'used_fair', label: 'Used - Fair' }
  ],
  general: [
    { id: 'New With Tags/Box', label: 'New With Tags/Box' },
    { id: 'New Without Tags/Box', label: 'New Without Tags/Box' },
    { id: 'New With Imperfections', label: 'New With Imperfections' },
    { id: 'Pre - Owned - Excellent', label: 'Pre - Owned - Excellent' },
    { id: 'Pre - Owned - Good', label: 'Pre - Owned - Good' },
    { id: 'Pre - Owned - Fair', label: 'Pre - Owned - Fair' }
  ]
};

const SHIPPING_METHOD_OPTIONS = [
  { id: 'Standard: Small to medium items', label: 'Standard: Small to medium items' },
  { id: 'Local pickup only: Sell to buyer nears you', label: 'Local pickup only: Sell to buyer nears you' },
];

const HANDLING_TIME_OPTIONS = [
  { id: '1', label: '1 business day' },
  { id: '2', label: '2 business days' },
  { id: '3', label: '3 business days' },
  { id: '4', label: '4 business days' },
  { id: '5', label: '5 business days' }
];

const SHIPPING_SERVICE_OPTIONS = [
  { id: 'USPSPriority', label: 'USPS Priority Mail' },
  { id: 'USPSFirstClass', label: 'USPS First Class' },
  { id: 'USPSParcelSelect', label: 'USPS Parcel Select' },
  { id: 'USPSMedia', label: 'USPS Media Mail' },
  { id: 'UPSGround', label: 'UPS Ground' },
  { id: 'FedExHomeDelivery', label: 'FedEx Home Delivery' }
];

const PRICING_FORMAT_OPTIONS = [
  { id: 'fixed', label: 'Fixed Price' },
  { id: 'auction', label: 'Auction' }
];

const DURATION_OPTIONS = [
  { id: "Good 'Til Canceled", label: "Good 'Til Canceled" },
  { id: '30 Days', label: '30 Days' },
  { id: '7 Days', label: '7 Days' }
];

const SHIPPING_COST_TYPE_OPTIONS = [
  { id: 'Flat: Same cost regardless of buyer location', label: 'Flat: Same cost regardless of buyer location' },
  { id: 'Calculated: Cost varies based on buyer location', label: 'Calculated: Cost varies based on buyer location' }
];

const RETURN_WITHIN_OPTIONS = [
  { id: '30 days', label: '30 days' },
  { id: '60 days', label: '60 days' }
];

const RETURN_SHIPPING_PAYER_OPTIONS = [
  { id: 'Buyer', label: 'Buyer' },
  { id: 'Free for buyer, you pay', label: 'Free for buyer, you pay' }
];

const RETURN_REFUND_METHOD_OPTIONS = [
  { id: 'Full Refund', label: 'Full Refund' },
  { id: 'Full Refund or Replacement', label: 'Full Refund or Replacement' }
];

const MERCARI_DELIVERY_METHOD_OPTIONS = [
  { id: 'prepaid', label: 'Mercari Prepaid Label' },
  { id: 'ship_on_own', label: 'Ship on Your Own' },
];

/**
 * Helper: Check if Mercari category is a complete leaf node
 */
export function checkMercariCategoryComplete(categoryId, categoryPath) {
  if (!categoryId || !categoryPath) return false;
  
  // Navigate through MERCARI_CATEGORIES using the path
  const MERCARI_CATEGORIES = getMercariCategories();
  let currentLevel = MERCARI_CATEGORIES;
  const pathParts = categoryPath.split(' > ');
  
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    // Find the category in current level by name
    const found = Object.values(currentLevel).find(cat => cat.name === part);
    if (!found) return false;
    
    // If this is the last part, check if it has subcategories
    if (i === pathParts.length - 1) {
      // Check if the found category ID matches the selected categoryId
      if (found.id !== categoryId) return false;
      // Check if it's a leaf node (no subcategories)
      return !found.subcategories || Object.keys(found.subcategories).length === 0;
    }
    
    // Move to next level
    if (found.subcategories) {
      currentLevel = found.subcategories;
    } else {
      return false; // Path is incomplete - expected subcategories but none found
    }
  }
  
  return true;
}

/**
 * Validate eBay form fields
 * @param {Object} generalForm - General form data
 * @param {Object} ebayForm - eBay-specific form data
 * @param {Object} options - Validation options
 * @param {string} [options.categoryTreeId] - eBay category tree ID
 * @param {Object} [options.categoriesData] - Category tree data for leaf validation
 * @param {Object} [options.ebayTypeAspect] - Type aspect data
 * @param {Array} [options.ebayTypeValues] - Type aspect values
 * @param {Array} [options.ebayRequiredAspects] - Required item specifics
 * @param {boolean} [options.isItemsIncludedRequired] - Whether Items Included is required
 * @returns {Issue[]} Array of validation issues
 */
export function validateEbayForm(generalForm, ebayForm, options = {}) {
  const issues = [];
  const {
    categoryTreeId,
    categoriesData,
    ebayTypeAspect,
    ebayTypeValues = [],
    ebayRequiredAspects = [],
    isItemsIncludedRequired = false,
    ebayDefaults = {},
  } = options;
  
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
  const finalCategoryId = ebayForm.categoryId || generalForm.categoryId;
  if (!finalCategoryId || finalCategoryId === '0' || finalCategoryId === 0) {
    issues.push({
      marketplace: 'ebay',
      field: 'categoryId',
      type: 'missing',
      severity: 'blocking',
      message: 'Category is required for eBay listings',
      patchTarget: 'ebay'
    });
  } else if (categoriesData) {
    // Check if it's a leaf category (no subcategories)
    const categoryNode = categoriesData.categorySubtreeNode;
    if (categoryNode?.childCategoryTreeNodes && categoryNode.childCategoryTreeNodes.length > 0) {
      issues.push({
        marketplace: 'ebay',
        field: 'categoryId',
        type: 'incomplete_path',
        severity: 'blocking',
        message: 'Please select a final category (this category has subcategories)',
        patchTarget: 'ebay'
      });
    }
  }
  
  // Title validation
  if (!ebayForm.title && !generalForm.title) {
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
  const ebayPrice = ebayForm.buyItNowPrice || generalForm.price;
  const ebayPriceStr = String(ebayPrice || '').trim();
  const ebayPriceNum = Number(ebayPriceStr);
  
  if (!ebayPriceStr || ebayPriceStr === '' || ebayPriceStr === '0') {
    issues.push({
      marketplace: 'ebay',
      field: 'buyItNowPrice',
      type: 'missing',
      severity: 'blocking',
      message: 'Buy It Now Price is required',
      patchTarget: 'ebay'
    });
  } else if (isNaN(ebayPriceNum) || ebayPriceNum <= 0) {
    issues.push({
      marketplace: 'ebay',
      field: 'buyItNowPrice',
      type: 'invalid',
      severity: 'blocking',
      message: 'Price must be a valid number greater than 0',
      patchTarget: 'ebay'
    });
  }
  
  // Quantity validation
  if (!generalForm.quantity) {
    issues.push({
      marketplace: 'ebay',
      field: 'quantity',
      type: 'missing',
      severity: 'blocking',
      message: 'Quantity is required',
      patchTarget: 'general'
    });
  }
  
  // Condition validation — pre-suggest from general form condition mapping
  if (!ebayForm.condition) {
    const condMapped = generalForm.condition ? mapCondition(generalForm.condition, 'ebay') : null;
    issues.push({
      marketplace: 'ebay',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Condition is required for eBay',
      options: CONDITION_OPTIONS.ebay,
      patchTarget: 'ebay',
      suggested: condMapped ? {
        id: condMapped.id, label: condMapped.label, confidence: 0.92,
        reasoning: `"${generalForm.condition}" → eBay "${condMapped.label}"`,
        sourceField: 'condition', sourceValue: generalForm.condition,
      } : undefined,
    });
  }
  
  // Brand validation — pre-suggest from general form brand
  if (!ebayForm.ebayBrand && !generalForm.brand) {
    issues.push({
      marketplace: 'ebay',
      field: 'ebayBrand',
      type: 'missing',
      severity: 'blocking',
      message: 'Brand is required for eBay',
      patchTarget: 'ebay',
    });
  } else if (!ebayForm.ebayBrand && generalForm.brand) {
    // Brand is available from general form — add as a suggestion-aware blocking issue
    issues.push({
      marketplace: 'ebay',
      field: 'ebayBrand',
      type: 'missing',
      severity: 'blocking',
      message: 'eBay-specific brand is required',
      patchTarget: 'ebay',
      suggested: {
        label: generalForm.brand, confidence: 0.95,
        reasoning: `Using brand "${generalForm.brand}" from your general listing`,
        sourceField: 'brand', sourceValue: generalForm.brand,
      },
    });
  }
  
  // Color validation — pre-suggest from general form color
  if (!ebayForm.color) {
    issues.push({
      marketplace: 'ebay',
      field: 'color',
      type: 'missing',
      severity: 'blocking',
      message: 'Color is required for eBay',
      patchTarget: 'ebay',
      suggested: generalForm.color1 ? {
        label: generalForm.color1, confidence: 0.90,
        reasoning: `Using color "${generalForm.color1}" from your general listing`,
        sourceField: 'color1', sourceValue: generalForm.color1,
      } : undefined,
    });
  }
  
  // Shipping validations
  // Determine effective shipping mode to skip irrelevant fields
  const isLocalPickupOnly = ebayForm.shippingMethod?.startsWith('Local pickup');
  const isFreeShipping = ebayForm.freeShipping;

  if (!ebayForm.shippingMethod) {
    const def = ebayDefaults?.shippingMethod;
    issues.push({
      marketplace: 'ebay',
      field: 'shippingMethod',
      type: 'missing',
      severity: 'blocking',
      message: 'Shipping Method is required. Open the eBay form to select one and save it as your default.',
      options: SHIPPING_METHOD_OPTIONS,
      patchTarget: 'ebay',
      suggested: {
        id: def || 'Standard: Small to medium items',
        label: def || 'Standard: Small to medium items',
        confidence: def ? 0.95 : 0.80,
        reasoning: def
          ? 'From your saved eBay shipping defaults'
          : 'Standard shipping is the most common method for most items',
        isFromDefault: !!def,
      },
    });
  }

  if (!ebayForm.handlingTime) {
    const def = ebayDefaults?.handlingTime;
    issues.push({
      marketplace: 'ebay',
      field: 'handlingTime',
      type: 'missing',
      severity: 'blocking',
      message: 'Handling Time is required.',
      options: HANDLING_TIME_OPTIONS,
      patchTarget: 'ebay',
      suggested: {
        id: def || '1 business day',
        label: def || '1 business day',
        confidence: def ? 0.95 : 0.85,
        reasoning: def
          ? 'From your saved eBay shipping defaults'
          : '1 business day handling improves your eBay search ranking',
        isFromDefault: !!def,
      },
    });
  }

  if (!isLocalPickupOnly && !ebayForm.shippingCostType) {
    const def = ebayDefaults?.shippingCostType;
    issues.push({
      marketplace: 'ebay',
      field: 'shippingCostType',
      type: 'missing',
      severity: 'blocking',
      message: 'Shipping Cost Type is required.',
      options: SHIPPING_COST_TYPE_OPTIONS,
      patchTarget: 'ebay',
      suggested: {
        id: def || 'Flat: Same cost regardless of buyer location',
        label: def || 'Flat: Same cost regardless of buyer location',
        confidence: def ? 0.95 : 0.80,
        reasoning: def
          ? 'From your saved eBay shipping defaults'
          : 'Flat rate is the most common shipping cost type for sellers',
        isFromDefault: !!def,
      },
    });
  }

  if (!isLocalPickupOnly && !isFreeShipping && !ebayForm.shippingCost) {
    const def = ebayDefaults?.shippingCost;
    issues.push({
      marketplace: 'ebay',
      field: 'shippingCost',
      type: 'missing',
      severity: 'blocking',
      message: 'Shipping Cost is required, or enable Free Shipping in the eBay form.',
      patchTarget: 'ebay',
      suggested: def ? {
        id: def,
        label: `$${def}`,
        confidence: 0.90,
        reasoning: 'From your saved eBay shipping defaults',
        isFromDefault: true,
      } : undefined,
    });
  }

  if (!isLocalPickupOnly && !ebayForm.shippingService) {
    const def = ebayDefaults?.shippingService;
    issues.push({
      marketplace: 'ebay',
      field: 'shippingService',
      type: 'missing',
      severity: 'blocking',
      message: 'Shipping Service is required.',
      options: SHIPPING_SERVICE_OPTIONS,
      patchTarget: 'ebay',
      suggested: def ? {
        id: def, label: def, confidence: 0.95,
        reasoning: 'From your saved eBay shipping defaults',
        isFromDefault: true,
      } : {
        id: 'Standard Shipping (3 to 5 business days)',
        label: 'Standard Shipping (3 to 5 business days)',
        confidence: 0.80,
        reasoning: 'Standard Shipping is the most common service for everyday items',
      },
    });
  }
  
  // Listing format validations
  if (!ebayForm.pricingFormat) {
    issues.push({
      marketplace: 'ebay',
      field: 'pricingFormat',
      type: 'missing',
      severity: 'blocking',
      message: 'Pricing Format is required',
      options: PRICING_FORMAT_OPTIONS,
      patchTarget: 'ebay'
    });
  }
  
  if (!ebayForm.duration) {
    issues.push({
      marketplace: 'ebay',
      field: 'duration',
      type: 'missing',
      severity: 'blocking',
      message: 'Duration is required',
      options: DURATION_OPTIONS,
      patchTarget: 'ebay'
    });
  }
  
  // Type/Model validation (only if category selected and aspect exists)
  if (finalCategoryId && finalCategoryId !== '0' && ebayTypeAspect && ebayTypeValues.length > 0) {
    if (!ebayForm.itemType) {
      issues.push({
        marketplace: 'ebay',
        field: 'itemType',
        type: 'missing',
        severity: 'blocking',
        message: `${ebayTypeAspect.localizedAspectName || 'Model (Type)'} is required for this category`,
        patchTarget: 'ebay'
      });
    }
  }
  
  // Return policy validations (only when Accept Returns is enabled)
  if (ebayForm.acceptReturns) {
    if (!ebayForm.returnWithin) {
      issues.push({
        marketplace: 'ebay',
        field: 'returnWithin',
        type: 'missing',
        severity: 'blocking',
        message: 'Return Within is required when accepting returns',
        options: RETURN_WITHIN_OPTIONS,
        patchTarget: 'ebay'
      });
    }
    
    if (!ebayForm.returnShippingPayer) {
      issues.push({
        marketplace: 'ebay',
        field: 'returnShippingPayer',
        type: 'missing',
        severity: 'blocking',
        message: 'Return Shipping Payer is required when accepting returns',
        options: RETURN_SHIPPING_PAYER_OPTIONS,
        patchTarget: 'ebay'
      });
    }
    
    if (!ebayForm.returnRefundMethod) {
      issues.push({
        marketplace: 'ebay',
        field: 'returnRefundMethod',
        type: 'missing',
        severity: 'blocking',
        message: 'Return Refund Method is required when accepting returns',
        options: RETURN_REFUND_METHOD_OPTIONS,
        patchTarget: 'ebay'
      });
    }
  }
  
  // Items Included validation (category-specific)
  if (isItemsIncludedRequired && !ebayForm.itemsIncluded) {
    issues.push({
      marketplace: 'ebay',
      field: 'itemsIncluded',
      type: 'missing',
      severity: 'blocking',
      message: 'Items Included is required for this category',
      patchTarget: 'ebay'
    });
  }
  
  // Custom item specifics validation
  if (ebayRequiredAspects.length > 0) {
    ebayRequiredAspects.forEach(aspect => {
      const aspectName = (aspect.localizedAspectName || aspect.aspectName || aspect.name || '').toLowerCase().replace(/\s+/g, '_');
      if (!ebayForm.customItemSpecifics?.[aspectName]) {
        issues.push({
          marketplace: 'ebay',
          field: `customItemSpecifics.${aspectName}`,
          type: 'missing',
          severity: 'blocking',
          message: `${aspect.localizedAspectName || aspect.aspectName || aspect.name} is required for this category`,
          patchTarget: 'ebay'
        });
      }
    });
  }
  
  return issues;
}

/**
 * Validate Mercari form fields
 * @param {Object} generalForm - General form data
 * @param {Object} mercariForm - Mercari-specific form data
 * @returns {Issue[]} Array of validation issues
 */
export function validateMercariForm(generalForm, mercariForm, options = {}) {
  const mercariDefaults = options.mercariDefaults || {};
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
      message: 'Mercari category is required',
      patchTarget: 'mercari'
    });
  } else {
    // Check if category is complete (no more subcategories)
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
  const priceStr = String(price || '').trim();
  const priceNum = Number(priceStr);
  
  if (!priceStr || priceStr === '' || priceStr === '0') {
    issues.push({
      marketplace: 'mercari',
      field: 'price',
      type: 'missing',
      severity: 'blocking',
      message: 'Price is required',
      patchTarget: 'general'
    });
  } else if (priceNum <= 0 || isNaN(priceNum)) {
    issues.push({
      marketplace: 'mercari',
      field: 'price',
      type: 'invalid',
      severity: 'blocking',
      message: 'Price must be a valid number greater than 0',
      patchTarget: 'general'
    });
  }
  
  // Condition validation — pre-suggest from general form
  if (!mercariForm.condition && !generalForm.condition) {
    issues.push({
      marketplace: 'mercari',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Condition is required for Mercari',
      options: CONDITION_OPTIONS.mercari,
      patchTarget: 'mercari',
    });
  } else if (!mercariForm.condition && generalForm.condition) {
    const condMapped = mapCondition(generalForm.condition, 'mercari');
    issues.push({
      marketplace: 'mercari',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Mercari-specific condition is required',
      options: CONDITION_OPTIONS.mercari,
      patchTarget: 'mercari',
      suggested: condMapped ? {
        id: condMapped.id, label: condMapped.label, confidence: 0.92,
        reasoning: `"${generalForm.condition}" → Mercari "${condMapped.label}"`,
        sourceField: 'condition', sourceValue: generalForm.condition,
      } : undefined,
    });
  }
  
  // Brand validation
  const brand = mercariForm.brand || generalForm.brand;
  if (!brand && !mercariForm.noBrand) {
    issues.push({
      marketplace: 'mercari',
      field: 'brand',
      type: 'missing',
      severity: 'blocking',
      message: 'Brand is required. Enter a brand name or check "No Brand".',
      patchTarget: 'mercari',
    });
  } else if (!mercariForm.brand && generalForm.brand && !mercariForm.noBrand) {
    issues.push({
      marketplace: 'mercari',
      field: 'brand',
      type: 'missing',
      severity: 'blocking',
      message: 'Mercari-specific brand field is required',
      patchTarget: 'mercari',
      suggested: {
        label: generalForm.brand, confidence: 0.95,
        reasoning: `Using brand "${generalForm.brand}" from your general listing`,
        sourceField: 'brand', sourceValue: generalForm.brand,
      },
    });
  }
  
  // Connection validation
  const mercariConnected = typeof window !== 'undefined' && 
    localStorage.getItem('profit_orbit_mercari_connected') === 'true';
  if (!mercariConnected) {
    issues.push({
      marketplace: 'mercari',
      field: '_connection',
      type: 'invalid',
      severity: 'blocking',
      message: 'Mercari account not connected. Please connect in Settings.',
      patchTarget: 'mercari'
    });
  }

  // Ships From (zip) — use fulfillment defaults if missing
  const shipsFrom = mercariForm.shipsFrom || generalForm.zip;
  if (!shipsFrom || String(shipsFrom).trim().length < 5) {
    const defaultVal = mercariDefaults.shipsFrom;
    issues.push({
      marketplace: 'mercari',
      field: 'shipsFrom',
      type: 'missing',
      severity: 'blocking',
      message: 'Ships From (zip code) is required',
      patchTarget: 'mercari',
      suggested: defaultVal
        ? { label: defaultVal, confidence: 0.97, reasoning: 'From your saved Mercari defaults' }
        : (generalForm.zip ? { label: generalForm.zip, confidence: 0.9, reasoning: 'From your general zip' } : undefined),
    });
  }

  // Delivery Method — use fulfillment defaults if missing
  if (!mercariForm.deliveryMethod) {
    const defaultVal = mercariDefaults.deliveryMethod || 'prepaid';
    issues.push({
      marketplace: 'mercari',
      field: 'deliveryMethod',
      type: 'missing',
      severity: 'blocking',
      message: 'Delivery method is required',
      options: MERCARI_DELIVERY_METHOD_OPTIONS,
      patchTarget: 'mercari',
      suggested: {
        id: defaultVal,
        label: MERCARI_DELIVERY_METHOD_OPTIONS.find(o => o.id === defaultVal)?.label || defaultVal,
        confidence: 0.97,
        reasoning: mercariDefaults.deliveryMethod ? 'From your saved Mercari defaults' : 'Mercari Prepaid is most common',
      },
    });
  }

  // Smart Pricing & Smart Offers — always call out unless user disabled in fulfillment settings
  if (!mercariDefaults.smartPricingDisabled) {
    issues.push({
      marketplace: 'mercari',
      field: 'smartPricing',
      type: 'suggestion',
      severity: 'suggestion',
      message: 'Smart Pricing lets Mercari adjust your price for better visibility. Set per listing. To skip this, turn it off in Settings → Fulfillment → Mercari.',
      patchTarget: 'mercari',
    });
  }
  if (!mercariDefaults.smartOffersDisabled) {
    issues.push({
      marketplace: 'mercari',
      field: 'smartOffers',
      type: 'suggestion',
      severity: 'suggestion',
      message: 'Smart Offers lets buyers send offers. Set per listing. To skip this, turn it off in Settings → Fulfillment → Mercari.',
      patchTarget: 'mercari',
    });
  }
  
  return issues;
}

/**
 * Validate Facebook form fields
 * @param {Object} generalForm - General form data
 * @param {Object} facebookForm - Facebook-specific form data
 * @returns {Issue[]} Array of validation issues
 */
// Facebook delivery method options (IDs match CrosslistComposer form)
const FACEBOOK_DELIVERY_METHOD_OPTIONS = [
  { id: 'shipping_and_pickup', label: 'Shipping and Local Pickup' },
  { id: 'shipping_only', label: 'Shipping Only' },
  { id: 'local_pickup', label: 'Local Pickup Only' },
];

const FACEBOOK_SHIPPING_OPTION_OPTIONS = [
  { id: 'own_label', label: 'Ship on my own (own label)' },
  { id: 'prepaid', label: 'Facebook prepaid label' },
];

const FACEBOOK_CARRIER_OPTIONS = [
  { id: 'usps', label: 'USPS' },
  { id: 'ups', label: 'UPS' },
  { id: 'fedex', label: 'FedEx' },
];

export function validateFacebookForm(generalForm, facebookForm, options = {}) {
  const facebookDefaults = options.facebookDefaults || {};
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
    // Provide top-level Facebook categories as selectable options
    const fbCats = FACEBOOK_CATEGORIES_CACHE || [];
    const topLevelOptions = fbCats.map(c => ({ id: c.categoryId, label: c.categoryName }));

    // Try to pre-suggest a category from the general form's category text
    const suggestion = suggestFacebookCategory(generalForm.category || generalForm.title || '');

    const issue = {
      marketplace: 'facebook',
      field: 'category',
      type: 'missing',
      severity: 'blocking',
      message: 'Facebook Marketplace category is required',
      patchTarget: 'facebook',
      options: topLevelOptions.length > 0 ? topLevelOptions : undefined,
    };

    if (suggestion) {
      issue.suggested = {
        label: suggestion.categoryName,
        confidence: suggestion.confidence,
        reasoning: `Matched "${generalForm.category || generalForm.title}" → "${suggestion.categoryName}"`,
      };
    }

    issues.push(issue);
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
  const priceStr = String(price || '').trim();
  const priceNum = Number(priceStr);
  
  if (!priceStr || priceStr === '' || priceStr === '0') {
    issues.push({
      marketplace: 'facebook',
      field: 'price',
      type: 'missing',
      severity: 'blocking',
      message: 'Price is required',
      patchTarget: 'general'
    });
  } else if (priceNum <= 0 || isNaN(priceNum)) {
    issues.push({
      marketplace: 'facebook',
      field: 'price',
      type: 'invalid',
      severity: 'blocking',
      message: 'Price must be a valid number greater than 0',
      patchTarget: 'general'
    });
  }
  
  // Description validation
  if (!facebookForm.description && !generalForm.description) {
    issues.push({
      marketplace: 'facebook',
      field: 'description',
      type: 'missing',
      severity: 'blocking',
      message: 'Description is required',
      patchTarget: 'general'
    });
  }
  
  // Condition validation — pre-suggest from general form
  if (!facebookForm.condition && !generalForm.condition) {
    issues.push({
      marketplace: 'facebook',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Condition is required for Facebook Marketplace',
      options: CONDITION_OPTIONS.facebook,
      patchTarget: 'facebook',
    });
  } else if (!facebookForm.condition && generalForm.condition) {
    const condMapped = mapCondition(generalForm.condition, 'facebook');
    issues.push({
      marketplace: 'facebook',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Facebook-specific condition is required',
      options: CONDITION_OPTIONS.facebook,
      patchTarget: 'facebook',
      suggested: condMapped ? {
        id: condMapped.id, label: condMapped.label, confidence: 0.92,
        reasoning: `"${generalForm.condition}" → Facebook "${condMapped.label}"`,
        sourceField: 'condition', sourceValue: generalForm.condition,
      } : undefined,
    });
  }
  
  // Size validation — REQUIRED for clothing/shoes categories
  const categoryLower = (category || '').toLowerCase();
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
  
  // ---- Facebook-specific fields (not on general form) ----

  // Delivery Method — required
  if (!facebookForm.deliveryMethod) {
    const defaultVal = facebookDefaults.deliveryMethod;
    issues.push({
      marketplace: 'facebook',
      field: 'deliveryMethod',
      type: 'missing',
      severity: 'blocking',
      message: 'Delivery method is required for Facebook Marketplace',
      options: FACEBOOK_DELIVERY_METHOD_OPTIONS,
      patchTarget: 'facebook',
      suggested: defaultVal
        ? {
            id: defaultVal,
            label: FACEBOOK_DELIVERY_METHOD_OPTIONS.find(o => o.id === defaultVal)?.label || defaultVal,
            confidence: 0.97,
            reasoning: 'From your saved Facebook defaults',
          }
        : {
            id: 'shipping_and_pickup',
            label: 'Shipping and Local Pickup',
            confidence: 0.7,
            reasoning: 'Most sellers offer both shipping and local pickup',
          },
    });
  } else {
    const deliveryMethod = facebookForm.deliveryMethod;
    const hasShipping = deliveryMethod === 'shipping_only' || deliveryMethod === 'shipping_and_pickup';
    const isPrepaid = facebookForm.shippingOption === 'prepaid' || facebookForm.shippingOption === 'prepaid_label';

    // Shipping Option — if shipping enabled
    if (hasShipping && !facebookForm.shippingOption) {
      const defaultVal = facebookDefaults.shippingOption;
      issues.push({
        marketplace: 'facebook',
        field: 'shippingOption',
        type: 'missing',
        severity: 'blocking',
        message: 'Shipping option is required when shipping is enabled',
        options: FACEBOOK_SHIPPING_OPTION_OPTIONS,
        patchTarget: 'facebook',
        suggested: defaultVal
          ? {
              id: defaultVal,
              label: FACEBOOK_SHIPPING_OPTION_OPTIONS.find(o => o.id === defaultVal)?.label || defaultVal,
              confidence: 0.97,
              reasoning: 'From your saved Facebook defaults',
            }
          : {
              id: 'own_label',
              label: 'Ship on my own (own label)',
              confidence: 0.75,
              reasoning: 'Own label is the most common shipping option',
            },
      });
    }

    // Shipping Carrier — if own label
    if (hasShipping && !isPrepaid && !facebookForm.shippingCarrier) {
      const defaultVal = facebookDefaults.shippingCarrier;
      issues.push({
        marketplace: 'facebook',
        field: 'shippingCarrier',
        type: 'missing',
        severity: 'blocking',
        message: 'Shipping carrier is required when using own label',
        options: FACEBOOK_CARRIER_OPTIONS,
        patchTarget: 'facebook',
        suggested: defaultVal
          ? {
              id: defaultVal,
              label: FACEBOOK_CARRIER_OPTIONS.find(o => o.id === defaultVal)?.label || defaultVal,
              confidence: 0.97,
              reasoning: 'From your saved Facebook defaults',
            }
          : {
              id: 'usps',
              label: 'USPS',
              confidence: 0.7,
              reasoning: 'USPS is the most commonly used carrier',
            },
      });
    }

    // Shipping Rate — if own label and not free shipping
    if (hasShipping && !isPrepaid && !facebookForm.displayFreeShipping && !facebookForm.shippingPrice) {
      const defaultVal = facebookDefaults.shippingPrice;
      issues.push({
        marketplace: 'facebook',
        field: 'shippingPrice',
        type: 'missing',
        severity: 'warning',
        message: 'No shipping rate entered — buyers will see no price listed',
        patchTarget: 'facebook',
        suggested: defaultVal
          ? {
              id: defaultVal,
              label: defaultVal,
              confidence: 0.97,
              reasoning: 'From your saved Facebook defaults',
            }
          : undefined,
      });
    }
  }

  // Allow Offers — flag when shipping so user can decide (skip when form is Local Pickup or fulfillment is Pickup Only)
  const isLocalOnly = facebookForm.deliveryMethod === 'local_pickup';
  const hasShipping = facebookForm.deliveryMethod === 'shipping_only' || facebookForm.deliveryMethod === 'shipping_and_pickup';
  const fbPrefersPickupOnly = facebookDefaults.deliveryMethod === 'local_pickup';
  if (hasShipping && !fbPrefersPickupOnly && facebookForm.allowOffers && !facebookForm.minimumOfferPrice) {
    const defaultVal = facebookDefaults.minimumOfferPrice;
    if (defaultVal) {
      issues.push({
        marketplace: 'facebook',
        field: 'minimumOfferPrice',
        type: 'missing',
        severity: 'warning',
        message: 'Offers are enabled but no minimum offer price is set. To skip allow-offers prompts, set "Local Pickup Only" in Settings → Fulfillment → Facebook.',
        patchTarget: 'facebook',
        suggested: {
          id: defaultVal,
          label: defaultVal,
          confidence: 0.97,
          reasoning: 'From your saved Facebook defaults',
        },
      });
    }
  }

  // Extension connection validation
  const ext = typeof window !== 'undefined' && window?.ProfitOrbitExtension;
  if (!ext?.createFacebookListing) {
    issues.push({
      marketplace: 'facebook',
      field: '_connection',
      type: 'invalid',
      severity: 'blocking',
      message: 'Extension not available. Please refresh and ensure the Profit Orbit extension is enabled.',
      patchTarget: 'facebook'
    });
  }
  
  return issues;
}

// ---------------------------------------------------------------------------
// Etsy validation
// ---------------------------------------------------------------------------

/**
 * Validate Etsy form fields
 * @param {Object} generalForm
 * @param {Object} etsyForm
 * @returns {Issue[]} Array of validation issues
 */
export function validateEtsyForm(generalForm, etsyForm) {
  const issues = [];

  // Title
  const title = etsyForm.title || generalForm.title;
  if (!title || !title.trim()) {
    issues.push({
      marketplace: 'etsy',
      field: 'title',
      type: 'missing',
      severity: 'blocking',
      message: 'Title is required for Etsy',
      patchTarget: 'etsy',
    });
  }

  // Description
  const description = etsyForm.description || generalForm.description;
  if (!description || !description.trim()) {
    issues.push({
      marketplace: 'etsy',
      field: 'description',
      type: 'missing',
      severity: 'blocking',
      message: 'Description is required for Etsy',
      patchTarget: 'etsy',
    });
  }

  // Price
  const price = etsyForm.price || generalForm.price;
  if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    issues.push({
      marketplace: 'etsy',
      field: 'price',
      type: 'missing',
      severity: 'blocking',
      message: 'Price is required for Etsy',
      patchTarget: 'general',
    });
  }

  // Photos
  const photos = etsyForm.photos?.length > 0 ? etsyForm.photos : generalForm.photos;
  if (!photos || photos.length === 0) {
    issues.push({
      marketplace: 'etsy',
      field: 'photos',
      type: 'missing',
      severity: 'blocking',
      message: 'At least one photo is required for Etsy',
      patchTarget: 'etsy',
    });
  }

  return issues;
}
