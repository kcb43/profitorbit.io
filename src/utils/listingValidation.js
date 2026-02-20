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

/**
 * Issue schema for normalized validation results
 * @typedef {Object} Issue
 * @property {'ebay'|'mercari'|'facebook'} marketplace
 * @property {string} field - Field name (e.g., "categoryId", "condition")
 * @property {'missing'|'invalid'|'incomplete_path'|'mismatch'} type
 * @property {'blocking'|'warning'} severity
 * @property {string} message - Human-readable error message
 * @property {Array<{id: string, label: string}>} [options] - Dropdown options
 * @property {{id?: string, label?: string, confidence?: number}} [suggested] - AI suggestion
 * @property {'general'|'ebay'|'mercari'|'facebook'} patchTarget - Which form to patch
 */

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
  { id: 'Flat', label: 'Flat' },
  { id: 'Calculated', label: 'Calculated' },
  { id: 'FreightFlat', label: 'Freight Flat' },
  { id: 'Free', label: 'Free' }
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
  { id: 'prepaid', label: 'Mercari Prepaid (Buyer pays shipping)' },
  { id: 'seller_ship', label: 'Seller ships (Seller pays shipping)' }
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
  
  // Condition validation
  if (!ebayForm.condition) {
    issues.push({
      marketplace: 'ebay',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Condition is required',
      options: CONDITION_OPTIONS.ebay,
      patchTarget: 'ebay'
    });
  }
  
  // Brand validation (eBay brand or general brand)
  if (!ebayForm.ebayBrand && !generalForm.brand) {
    issues.push({
      marketplace: 'ebay',
      field: 'ebayBrand',
      type: 'missing',
      severity: 'blocking',
      message: 'Brand is required',
      patchTarget: 'ebay'
    });
  }
  
  // Color validation
  if (!ebayForm.color) {
    issues.push({
      marketplace: 'ebay',
      field: 'color',
      type: 'missing',
      severity: 'blocking',
      message: 'Color is required',
      patchTarget: 'ebay'
    });
  }
  
  // Shipping validations
  if (!ebayForm.handlingTime) {
    issues.push({
      marketplace: 'ebay',
      field: 'handlingTime',
      type: 'missing',
      severity: 'blocking',
      message: 'Handling Time is required',
      options: HANDLING_TIME_OPTIONS,
      patchTarget: 'ebay'
    });
  }
  
  if (!ebayForm.shippingService) {
    issues.push({
      marketplace: 'ebay',
      field: 'shippingService',
      type: 'missing',
      severity: 'blocking',
      message: 'Shipping Service is required',
      options: SHIPPING_SERVICE_OPTIONS,
      patchTarget: 'ebay'
    });
  }
  
  if (!ebayForm.shippingCostType) {
    issues.push({
      marketplace: 'ebay',
      field: 'shippingCostType',
      type: 'missing',
      severity: 'blocking',
      message: 'Shipping Cost Type is required',
      options: SHIPPING_COST_TYPE_OPTIONS,
      patchTarget: 'ebay'
    });
  }
  
  if (!ebayForm.shippingMethod) {
    issues.push({
      marketplace: 'ebay',
      field: 'shippingMethod',
      type: 'missing',
      severity: 'blocking',
      message: 'Shipping Method is required',
      options: SHIPPING_METHOD_OPTIONS,
      patchTarget: 'ebay'
    });
  }
  
  if (!ebayForm.shippingCost) {
    issues.push({
      marketplace: 'ebay',
      field: 'shippingCost',
      type: 'missing',
      severity: 'blocking',
      message: 'Shipping Cost is required',
      patchTarget: 'ebay'
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
  
  // Condition validation
  if (!mercariForm.condition && !generalForm.condition) {
    issues.push({
      marketplace: 'mercari',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Condition is required',
      options: CONDITION_OPTIONS.mercari,
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
      severity: 'blocking',
      message: 'Brand is required. Type a brand name, or set "noBrand" to true to skip.',
      patchTarget: 'mercari'
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
  
  return issues;
}

/**
 * Validate Facebook form fields
 * @param {Object} generalForm - General form data
 * @param {Object} facebookForm - Facebook-specific form data
 * @returns {Issue[]} Array of validation issues
 */
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
      message: 'Facebook category is required',
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
  
  // Condition validation
  if (!facebookForm.condition && !generalForm.condition) {
    issues.push({
      marketplace: 'facebook',
      field: 'condition',
      type: 'missing',
      severity: 'blocking',
      message: 'Condition is required',
      options: CONDITION_OPTIONS.facebook,
      patchTarget: 'facebook'
    });
  }
  
  // Size validation - REQUIRED for clothing/shoes categories
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
