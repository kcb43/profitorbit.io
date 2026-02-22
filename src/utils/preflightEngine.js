/**
 * Preflight engine for validating multiple marketplaces before listing
 * Runs validation checks without actually posting to marketplaces
 */

import {
  validateEbayForm,
  validateMercariForm,
  validateFacebookForm,
  validateEtsyForm,
  generateSmartSuggestions,
} from './listingValidation';

/**
 * @typedef {Object} PreflightResult
 * @property {string[]} ready - Marketplaces that passed ALL checks (no blocking, no suggestions)
 * @property {Array<{marketplace: string, issues: Issue[]}>} fixesNeeded - Marketplaces with blocking issues or smart suggestions
 */

/**
 * Run preflight validation for selected marketplaces
 */
export async function preflightSelectedMarketplaces(
  selectedMarketplaces,
  generalForm,
  ebayForm,
  mercariForm,
  facebookForm,
  etsyForm = {},
  options = {}
) {
  // Support legacy callers that pass options as 6th arg (no etsyForm)
  if (etsyForm && typeof etsyForm === 'object' && !Array.isArray(etsyForm) &&
      (etsyForm.autoApplyHighConfidence !== undefined || etsyForm.onApplyPatch !== undefined ||
       etsyForm.categoryTreeId !== undefined || etsyForm.useAI !== undefined)) {
    options = etsyForm;
    etsyForm = {};
  }

  const {
    autoApplyHighConfidence = false,
    onApplyPatch = null,
    ...validationOptions
  } = options;

  const ready = [];
  const fixesNeeded = [];

  // Form map for smart suggestion generation
  const formByMarketplace = { ebay: ebayForm, mercari: mercariForm, facebook: facebookForm, etsy: etsyForm };

  for (const marketplace of selectedMarketplaces) {
    let issues = [];

    try {
      switch (marketplace) {
        case 'ebay':
          issues = validateEbayForm(generalForm, ebayForm, {
            categoryTreeId: validationOptions.categoryTreeId,
            categoriesData: validationOptions.ebayCategoriesData,
            ebayTypeAspect: validationOptions.ebayTypeAspect,
            ebayTypeValues: validationOptions.ebayTypeValues,
            ebayRequiredAspects: validationOptions.ebayRequiredAspects,
            isItemsIncludedRequired: validationOptions.isItemsIncludedRequired,
          });
          break;

        case 'mercari':
          issues = validateMercariForm(generalForm, mercariForm);
          break;

        case 'facebook':
          issues = validateFacebookForm(generalForm, facebookForm);
          break;

        case 'etsy':
          issues = validateEtsyForm(generalForm, etsyForm);
          break;

        default:
          issues.push({
            marketplace,
            field: '_marketplace',
            type: 'invalid',
            severity: 'blocking',
            message: `Unknown marketplace: ${marketplace}`,
            patchTarget: 'general',
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
        patchTarget: 'general',
      });
    }

    // Merge smart suggestions (fields that can be auto-filled from the general form).
    // Only add a suggestion if there is NOT already a blocking issue for that field
    // (the blocking issue already carries a `suggested` value).
    const smartSuggestions = generateSmartSuggestions(
      generalForm,
      formByMarketplace[marketplace] || {},
      marketplace
    );

    const existingBlockingFields = new Set(
      issues.filter(i => i.severity === 'blocking').map(i => i.field)
    );

    for (const suggestion of smartSuggestions) {
      if (!existingBlockingFields.has(suggestion.field)) {
        issues.push(suggestion);
      }
    }

    const blockingIssues  = issues.filter(i => i.severity === 'blocking');
    const suggestionIssues = issues.filter(i => i.severity === 'suggestion');

    if (blockingIssues.length === 0 && suggestionIssues.length === 0) {
      ready.push(marketplace);
    } else {
      fixesNeeded.push({ marketplace, issues });
    }
  }

  // If AI is enabled, enrich blocking issues with AI-generated suggestions
  // (only for issues that don't already have a client-side suggestion)
  if (validationOptions.useAI !== false && fixesNeeded.length > 0) {
    try {
      const aiSuggestions = await getAISuggestions(
        selectedMarketplaces,
        generalForm,
        ebayForm,
        mercariForm,
        facebookForm,
        etsyForm,
        fixesNeeded
      );

      for (const { marketplace, issues } of fixesNeeded) {
        const mpSuggestions = aiSuggestions[marketplace] || [];

        for (const issue of issues) {
          // Don't override a client-side suggestion with AI
          if (issue.suggested) continue;
          const aiSugg = mpSuggestions.find(s => s.field === issue.field);
          if (aiSugg) {
            issue.suggested = {
              label: aiSugg.value,
              confidence: aiSugg.confidence,
              reasoning: aiSugg.reasoning,
            };
          }
        }
      }

      // Auto-apply high-confidence suggestions if enabled
      if (autoApplyHighConfidence && onApplyPatch) {
        const fixesToApply = [];

        for (const { issues } of fixesNeeded) {
          for (const issue of issues) {
            if (issue.suggested && issue.suggested.confidence >= 0.85) {
              fixesToApply.push({ issue, value: issue.suggested.id || issue.suggested.label });
            }
          }
        }

        for (const { issue, value } of fixesToApply) {
          try {
            await onApplyPatch(issue, value);
          } catch (err) {
            console.error('Error auto-applying fix:', err);
          }
        }

        // Remove auto-applied issues and re-check readiness
        for (const marketplaceData of fixesNeeded) {
          marketplaceData.issues = marketplaceData.issues.filter(
            issue => !issue.suggested || issue.suggested.confidence < 0.85
          );
        }

        const updatedFixesNeeded = [];
        for (const marketplaceData of fixesNeeded) {
          const { marketplace, issues } = marketplaceData;
          const stillBlocking = issues.filter(i => i.severity === 'blocking');
          const stillSuggestions = issues.filter(i => i.severity === 'suggestion');

          if (stillBlocking.length === 0 && stillSuggestions.length === 0) {
            if (!ready.includes(marketplace)) ready.push(marketplace);
          } else {
            updatedFixesNeeded.push(marketplaceData);
          }
        }

        return { ready, fixesNeeded: updatedFixesNeeded };
      }
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
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
  etsyForm,
  fixesNeeded
) {
  try {
    // Only send blocking issues to the AI (suggestions are client-side only)
    const allIssues = fixesNeeded.flatMap(({ issues }) =>
      issues.filter(i => i.severity === 'blocking')
    );

    const response = await fetch('/api/ai/auto-fill-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generalForm,
        ebayForm,
        mercariForm,
        facebookForm,
        etsyForm,
        selectedMarketplaces,
        issues: allIssues,
      }),
    });

    if (!response.ok) throw new Error(`AI API error: ${response.status}`);

    const data = await response.json();
    return data.suggestions || {};
  } catch (error) {
    console.error('AI suggestions error:', error);
    return {};
  }
}

/**
 * Get a human-readable summary of preflight results
 */
export function getPreflightSummary(preflightResult) {
  const { ready, fixesNeeded } = preflightResult;

  if (fixesNeeded.length === 0) {
    return `All ${ready.length} marketplace(s) ready to list!`;
  }

  const blockingCount = fixesNeeded.reduce(
    (sum, mp) => sum + mp.issues.filter(i => i.severity === 'blocking').length,
    0
  );
  const suggestionCount = fixesNeeded.reduce(
    (sum, mp) => sum + mp.issues.filter(i => i.severity === 'suggestion').length,
    0
  );

  const parts = [];
  if (blockingCount > 0) parts.push(`${blockingCount} blocking issue${blockingCount !== 1 ? 's' : ''}`);
  if (suggestionCount > 0) parts.push(`${suggestionCount} smart suggestion${suggestionCount !== 1 ? 's' : ''}`);

  return `${ready.length} ready, ${fixesNeeded.length} need attention (${parts.join(', ')})`;
}

/**
 * Group issues by severity
 */
export function groupIssuesBySeverity(issues) {
  return {
    blocking:   issues.filter(i => i.severity === 'blocking'),
    warning:    issues.filter(i => i.severity === 'warning'),
    suggestion: issues.filter(i => i.severity === 'suggestion'),
  };
}

/**
 * Check if marketplace is ready to list (no blocking issues)
 * Suggestions do NOT block listing.
 */
export function isMarketplaceReady(issues) {
  return !issues.some(i => i.severity === 'blocking');
}

/**
 * Get field label for display
 */
export function getFieldLabel(field) {
  const fieldLabels = {
    photos: 'Photos',
    title: 'Title',
    description: 'Description',
    price: 'Price',
    quantity: 'Quantity',
    condition: 'Condition',
    brand: 'Brand',
    color: 'Color',
    size: 'Size',

    // eBay
    categoryId: 'Category',
    ebayBrand: 'Brand',
    buyItNowPrice: 'Buy It Now Price',
    handlingTime: 'Handling Time',
    shippingService: 'Shipping Service',
    shippingCostType: 'Shipping Cost Type',
    shippingMethod: 'Shipping Method',
    shippingCost: 'Shipping Cost',
    pricingFormat: 'Pricing Format',
    duration: 'Duration',
    itemType: 'Type / Model',
    returnWithin: 'Return Within',
    returnShippingPayer: 'Return Shipping Payer',
    returnRefundMethod: 'Return Refund Method',
    itemsIncluded: 'Items Included',

    // Mercari
    mercariCategory: 'Category',
    mercariCategoryId: 'Category',

    // Etsy
    color1: 'Primary Color',
    color2: 'Secondary Color',
    processingTime: 'Processing Time',
    renewalOption: 'Renewal Option',
    whoMade: 'Who Made It',
    whenMade: 'When Made',
    shippingProfile: 'Shipping Profile',

    // Facebook
    category: 'Category',

    // Special
    _connection: 'Connection',
    _error: 'Validation Error',
    _marketplace: 'Marketplace',
  };

  if (field.startsWith('customItemSpecifics.')) {
    const aspectName = field.replace('customItemSpecifics.', '').replace(/_/g, ' ');
    return aspectName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  return fieldLabels[field] || field;
}

/**
 * Get marketplace display name
 */
export function getMarketplaceName(marketplace) {
  const names = { ebay: 'eBay', mercari: 'Mercari', facebook: 'Facebook', etsy: 'Etsy' };
  return names[marketplace] || marketplace;
}
