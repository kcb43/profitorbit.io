/**
 * AI Auto-Fill Endpoint
 * Automatically fills missing marketplace-specific fields using AI.
 * Batches all missing fields into a single prompt per marketplace for speed.
 */

import OpenAI from 'openai';

// Top-level Facebook Marketplace categories (kept in sync with src/data/facebookCategories.js)
const FB_TOP_CATEGORIES = [
  'Vehicles', 'Bikes', 'Clothing & Accessories', 'Electronics',
  'Entertainment', 'Family', 'Free Stuff', 'Garden & Outdoor',
  'Hobbies', 'Home Goods', 'Home Improvement Supplies',
  'Home Sales', 'Musical Instruments', 'Office Supplies',
  'Pet Supplies', 'Sporting Goods', 'Toys & Games', 'Buy Nothing',
  'Rentals',
];

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!openai) {
    return res.status(503).json({
      error: 'AI service not configured. Please add OPENAI_API_KEY to environment.'
    });
  }

  try {
    const {
      generalForm,
      ebayForm,
      mercariForm,
      facebookForm,
      selectedMarketplaces,
      issues,
      ebayDefaults = {},
    } = req.body;

    console.log('AI Auto-Fill Request:', {
      marketplaces: selectedMarketplaces,
      issueCount: issues?.length || 0,
    });

    // Group issues by marketplace
    const issuesByMarketplace = {};
    for (const issue of issues || []) {
      if (!issuesByMarketplace[issue.marketplace]) {
        issuesByMarketplace[issue.marketplace] = [];
      }
      issuesByMarketplace[issue.marketplace].push(issue);
    }

    // Process all marketplaces IN PARALLEL
    const suggestions = {};
    const marketplaceForms = { ebay: ebayForm, mercari: mercariForm, facebook: facebookForm };

    const results = await Promise.all(
      selectedMarketplaces.map(async (marketplace) => {
        const marketplaceIssues = issuesByMarketplace[marketplace] || [];
        if (marketplaceIssues.length === 0) return { marketplace, suggestions: [] };

        console.log(`Processing ${marketplace}: ${marketplaceIssues.length} issues`);

        const result = await fillMarketplaceFields(
          marketplace,
          generalForm,
          marketplaceForms[marketplace],
          marketplaceIssues,
          marketplace === 'ebay' ? ebayDefaults : {}
        );

        return { marketplace, suggestions: result };
      })
    );

    for (const { marketplace, suggestions: s } of results) {
      if (s && s.length > 0) suggestions[marketplace] = s;
    }

    return res.status(200).json({ suggestions });

  } catch (error) {
    console.error('AI Auto-Fill Error:', error);
    return res.status(500).json({
      error: 'Failed to auto-fill fields',
      details: error.message
    });
  }
}

/**
 * Fill missing fields for a specific marketplace.
 * Uses saved defaults first, then batches remaining fields into a single AI call.
 */
async function fillMarketplaceFields(marketplace, generalForm, marketplaceForm, issues, savedDefaults = {}) {
  const suggestions = [];

  const context = {
    title: generalForm.title || '',
    description: generalForm.description || '',
    brand: generalForm.brand || '',
    condition: generalForm.condition || '',
    price: generalForm.price || '',
    category: generalForm.category || '',
  };

  // Separate issues into: those with saved defaults vs those needing AI
  const needsAI = [];
  for (const issue of issues) {
    if (issue.field.startsWith('_') || issue.field === 'photos') continue;

    if (savedDefaults[issue.field]) {
      suggestions.push({
        field: issue.field,
        value: savedDefaults[issue.field],
        confidence: 0.95,
        reasoning: 'From your saved shipping defaults',
      });
    } else {
      needsAI.push(issue);
    }
  }

  // Batch all AI-needed fields into one call
  if (needsAI.length > 0) {
    try {
      const aiSuggestions = await batchFillFields(marketplace, needsAI, context);
      suggestions.push(...aiSuggestions);
    } catch (error) {
      console.error(`Batch AI error for ${marketplace}:`, error);
      // Fallback: try individual fields with hardcoded defaults
      for (const issue of needsAI) {
        const fallback = getHardcodedDefault(marketplace, issue.field, context);
        if (fallback) suggestions.push(fallback);
      }
    }
  }

  return suggestions;
}

/**
 * Single AI call that fills ALL missing fields for a marketplace at once.
 */
async function batchFillFields(marketplace, issues, context) {
  const fieldNames = issues.map(i => i.field);

  // Check for hardcoded defaults first (no AI needed for shipping boilerplate)
  const results = [];
  const aiFields = [];

  for (const issue of issues) {
    const hardcoded = getHardcodedDefault(marketplace, issue.field, context);
    if (hardcoded) {
      results.push(hardcoded);
    } else {
      aiFields.push(issue);
    }
  }

  // If all fields had hardcoded defaults, skip AI call entirely
  if (aiFields.length === 0) return results;

  const fieldDescriptions = aiFields.map(issue => {
    const desc = getFieldDescription(marketplace, issue.field);
    return `- "${issue.field}": ${desc}`;
  }).join('\n');

  const categoryList = marketplace === 'facebook' ? `\nFacebook categories: ${FB_TOP_CATEGORIES.join(', ')}` : '';

  const prompt = `Product: "${context.title}"
Description: "${context.description}"
Brand: "${context.brand}"
Condition: "${context.condition}"
Price: $${context.price}
Category: "${context.category}"${categoryList}

For the ${marketplace} marketplace, suggest values for these missing fields:
${fieldDescriptions}

Return a JSON object with field names as keys and suggested values as string values.
Example: {"color": "Black", "size": "M"}
Return ONLY valid JSON, no markdown.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a product listing expert. Return only a JSON object with field values. Be concise and accurate.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 300,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) return results;

  try {
    const parsed = JSON.parse(raw);
    for (const issue of aiFields) {
      const value = parsed[issue.field];
      if (value !== undefined && value !== null && value !== '') {
        results.push({
          field: issue.field,
          value: String(value),
          confidence: calculateConfidence(issue.field, context),
          reasoning: `AI suggested based on: ${context.title || 'product information'}`,
        });
      }
    }
  } catch (e) {
    console.error('Failed to parse AI batch response:', e, raw);
  }

  return results;
}

/**
 * Hardcoded defaults for fields that don't need AI (shipping boilerplate, etc.)
 */
function getHardcodedDefault(marketplace, field, context) {
  if (marketplace === 'ebay') {
    const ebayDefaults = {
      handlingTime: '1 business day',
      shippingMethod: 'Standard: Small to medium items',
      shippingCostType: 'Flat: Same cost regardless of buyer location',
      shippingService: 'Standard Shipping (3 to 5 business days)',
      shippingCost: parseFloat(context.price) > 100 ? '0.00' : '5.99',
      duration: "Good 'Til Canceled",
      pricingFormat: 'fixed',
    };
    if (ebayDefaults[field]) {
      return {
        field,
        value: ebayDefaults[field],
        confidence: 0.9,
        reasoning: 'Standard eBay default',
      };
    }
  }

  return null;
}

/**
 * Human-readable field descriptions for the AI prompt
 */
function getFieldDescription(marketplace, field) {
  const descriptions = {
    color: 'Primary color of the item (e.g., "Black", "Blue")',
    size: 'Size of the item (e.g., "M", "L", "10", "One Size")',
    brand: 'Brand name of the item',
    condition: marketplace === 'facebook'
      ? 'Facebook condition enum: new | used_like_new | used_good | used_fair'
      : 'Item condition',
    category: marketplace === 'facebook'
      ? 'Best matching Facebook Marketplace category from the list above'
      : marketplace === 'mercari'
        ? 'Best matching Mercari top-level category: Women, Men, Kids, Home, Electronics, Beauty, Sports & Outdoors, Books, Toys & Collectibles, Tools, Other'
        : 'Product category',
    mercariCategory: 'Mercari top-level category: Women, Men, Kids, Home, Electronics, Beauty, Sports & Outdoors, Books, Toys & Collectibles, Tools, Other',
    itemType: 'Product type or style',
    model: 'Model name or number',
  };
  return descriptions[field] || `Value for the "${field}" field`;
}

/**
 * Calculate confidence score based on available context
 */
function calculateConfidence(field, context) {
  let score = 0.5;
  if (context.title && context.title.length > 10) score += 0.2;
  if (context.description && context.description.length > 50) score += 0.2;
  if (context.brand) score += 0.1;

  if (field === 'color' && context.title.match(/\b(black|white|red|blue|green|yellow|pink|gray|grey)\b/i)) {
    score += 0.2;
  }
  if (field === 'brand' && context.brand) {
    score = 0.95;
  }

  return Math.min(score, 0.95);
}
