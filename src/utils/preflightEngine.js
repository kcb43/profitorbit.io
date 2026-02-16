/**
 * Preflight engine for validating multiple marketplaces before listing
 * Runs validation checks without actually posting to marketplaces
 */

import {
  validateEbayForm,
  validateMercariForm,
  validateFacebookForm,
} from './listingValidation';

/**
 * @typedef {Object} PreflightResult
 * @property {string[]} ready - Marketplaces that passed validation
 * @property {Array<{marketplace: string, issues: Issue[]}>} fixesNeeded - Marketplaces with issues
 */

/**
 * Run preflight validation for selected marketplaces
 * @param {string[]} selectedMarketplaces - Array of marketplace names ('ebay', 'mercari', 'facebook')
 * @param {Object} generalForm - General form data
 * @param {Object} ebayForm - eBay-specific form data
 * @param {Object} mercariForm - Mercari-specific form data
 * @param {Object} facebookForm - Facebook-specific form data
 * @param {Object} options - Additional validation options
 * @param {string} [options.categoryTreeId] - eBay category tree ID
 * @param {Object} [options.ebayCategoriesData] - eBay category tree data
 * @param {Object} [options.ebayTypeAspect] - eBay type aspect data
 * @param {Array} [options.ebayTypeValues] - eBay type aspect values
 * @param {Array} [options.ebayRequiredAspects] - eBay required aspects
 * @param {boolean} [options.isItemsIncludedRequired] - Whether Items Included is required for eBay
 * @param {boolean} [options.useAI] - Whether to use AI auto-fill (default: true if enabled)
 * @returns {PreflightResult} Validation results with AI suggestions
 */
export async function preflightSelectedMarketplaces(
  selectedMarketplaces,
  generalForm,
  ebayForm,
  mercariForm,
  facebookForm,
  options = {}
) {
  const ready = [];
  const fixesNeeded = [];
  
  for (const marketplace of selectedMarketplaces) {
    let issues = [];
    
    try {
      switch (marketplace) {
        case 'ebay':
          issues = validateEbayForm(generalForm, ebayForm, {
            categoryTreeId: options.categoryTreeId,
            categoriesData: options.ebayCategoriesData,
            ebayTypeAspect: options.ebayTypeAspect,
            ebayTypeValues: options.ebayTypeValues,
            ebayRequiredAspects: options.ebayRequiredAspects,
            isItemsIncludedRequired: options.isItemsIncludedRequired,
          });
          break;
          
        case 'mercari':
          issues = validateMercariForm(generalForm, mercariForm);
          break;
          
        case 'facebook':
          issues = validateFacebookForm(generalForm, facebookForm);
          break;
          
        default:
          // Unknown marketplace
          issues.push({
            marketplace,
            field: '_marketplace',
            type: 'invalid',
            severity: 'blocking',
            message: `Unknown marketplace: ${marketplace}`,
            patchTarget: 'general'
          });
      }
    } catch (error) {
      console.error(`Error validating ${marketplace}:`, error);
      issues.push({
        marketplace,
        field: '_error',
        type: 'invalid',
        severity: 'blocking',
        message: `Validation error: ${error.message}`,
        patchTarget: 'general'
      });
    }
    
    // Only filter out warnings if there are blocking issues
    const blockingIssues = issues.filter(issue => issue.severity === 'blocking');
    
    if (blockingIssues.length === 0) {
      ready.push(marketplace);
    } else {
      fixesNeeded.push({ marketplace, issues });
    }
  }
  
  // If AI is enabled and there are issues, get AI suggestions
  if (options.useAI !== false && fixesNeeded.length > 0) {
    try {
      const aiSuggestions = await getAISuggestions(
        selectedMarketplaces,
        generalForm,
        ebayForm,
        mercariForm,
        facebookForm,
        fixesNeeded
      );
      
      // Attach AI suggestions to issues
      for (const { marketplace, issues } of fixesNeeded) {
        const marketplaceSuggestions = aiSuggestions[marketplace] || [];
        
        for (const issue of issues) {
          const suggestion = marketplaceSuggestions.find(s => s.field === issue.field);
          if (suggestion) {
            issue.suggested = {
              label: suggestion.value,
              confidence: suggestion.confidence,
              reasoning: suggestion.reasoning,
            };
          }
        }
      }
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      // Continue without AI suggestions
    }
  }
  
  return { ready, fixesNeeded };
}

/**
 * Get AI suggestions for missing fields
 */
async function getAISuggestions(
  selectedMarketplaces,
  generalForm,
  ebayForm,
  mercariForm,
  facebookForm,
  fixesNeeded
) {
  try {
    // Flatten all issues
    const allIssues = fixesNeeded.flatMap(({ issues }) => issues);
    
    const response = await fetch('/api/ai/auto-fill-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generalForm,
        ebayForm,
        mercariForm,
        facebookForm,
        selectedMarketplaces,
        issues: allIssues,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.suggestions || {};
  } catch (error) {
    console.error('AI suggestions error:', error);
    return {};
  }
}

/**
 * Get a human-readable summary of preflight results
 * @param {PreflightResult} preflightResult
 * @returns {string} Summary message
 */
export function getPreflightSummary(preflightResult) {
  const { ready, fixesNeeded } = preflightResult;
  
  if (fixesNeeded.length === 0) {
    return `All ${ready.length} marketplace(s) ready to list!`;
  }
  
  const totalIssues = fixesNeeded.reduce((sum, mp) => sum + mp.issues.length, 0);
  const blockingCount = fixesNeeded.reduce(
    (sum, mp) => sum + mp.issues.filter(i => i.severity === 'blocking').length, 
    0
  );
  
  return `${ready.length} ready, ${fixesNeeded.length} need fixes (${blockingCount} blocking issue${blockingCount !== 1 ? 's' : ''})`;
}

/**
 * Group issues by severity
 * @param {Issue[]} issues
 * @returns {{blocking: Issue[], warning: Issue[]}}
 */
export function groupIssuesBySeverity(issues) {
  return {
    blocking: issues.filter(issue => issue.severity === 'blocking'),
    warning: issues.filter(issue => issue.severity === 'warning'),
  };
}

/**
 * Check if marketplace is ready to list (no blocking issues)
 * @param {Issue[]} issues
 * @returns {boolean}
 */
export function isMarketplaceReady(issues) {
  return !issues.some(issue => issue.severity === 'blocking');
}

/**
 * Get field label for display
 * @param {string} field
 * @returns {string}
 */
export function getFieldLabel(field) {
  const fieldLabels = {
    // General fields
    photos: 'Photos',
    title: 'Title',
    description: 'Description',
    price: 'Price',
    quantity: 'Quantity',
    condition: 'Condition',
    brand: 'Brand',
    
    // eBay fields
    categoryId: 'Category',
    ebayBrand: 'eBay Brand',
    color: 'Color',
    buyItNowPrice: 'Buy It Now Price',
    handlingTime: 'Handling Time',
    shippingService: 'Shipping Service',
    shippingCostType: 'Shipping Cost Type',
    shippingMethod: 'Shipping Method',
    shippingCost: 'Shipping Cost',
    pricingFormat: 'Pricing Format',
    duration: 'Duration',
    itemType: 'Type/Model',
    returnWithin: 'Return Within',
    returnShippingPayer: 'Return Shipping Payer',
    returnRefundMethod: 'Return Refund Method',
    itemsIncluded: 'Items Included',
    
    // Mercari fields
    mercariCategory: 'Category',
    mercariCategoryId: 'Category',
    
    // Facebook fields
    category: 'Category',
    size: 'Size',
    
    // Special fields
    _connection: 'Connection',
    _error: 'Validation Error',
    _marketplace: 'Marketplace',
  };
  
  // Handle custom item specifics
  if (field.startsWith('customItemSpecifics.')) {
    const aspectName = field.replace('customItemSpecifics.', '').replace(/_/g, ' ');
    return aspectName.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
  
  return fieldLabels[field] || field;
}

/**
 * Get marketplace display name
 * @param {string} marketplace
 * @returns {string}
 */
export function getMarketplaceName(marketplace) {
  const names = {
    ebay: 'eBay',
    mercari: 'Mercari',
    facebook: 'Facebook',
    etsy: 'Etsy',
  };
  return names[marketplace] || marketplace;
}
