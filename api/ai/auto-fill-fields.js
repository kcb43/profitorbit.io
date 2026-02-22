/**
 * AI Auto-Fill Endpoint
 * Automatically fills missing marketplace-specific fields using AI
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

/**
 * Auto-fill missing fields for all marketplaces
 * @param {Object} req.body
 * @param {Object} req.body.generalForm - General form data
 * @param {Object} req.body.ebayForm - eBay form data
 * @param {Object} req.body.mercariForm - Mercari form data
 * @param {Object} req.body.facebookForm - Facebook form data
 * @param {Array<string>} req.body.selectedMarketplaces - Marketplaces to fill
 * @param {Array<Issue>} req.body.issues - Validation issues to fill
 */
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

    // Process each marketplace
    const suggestions = {};
    
    for (const marketplace of selectedMarketplaces) {
      const marketplaceIssues = issuesByMarketplace[marketplace] || [];
      if (marketplaceIssues.length === 0) continue;

      console.log(`Processing ${marketplace}: ${marketplaceIssues.length} issues`);

      // Get suggestions for this marketplace
      const marketplaceSuggestions = await fillMarketplaceFields(
        marketplace,
        generalForm,
        { ebayForm, mercariForm, facebookForm }[`${marketplace}Form`],
        marketplaceIssues,
        marketplace === 'ebay' ? ebayDefaults : {}
      );

      suggestions[marketplace] = marketplaceSuggestions;
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
 * Fill missing fields for a specific marketplace
 */
async function fillMarketplaceFields(marketplace, generalForm, marketplaceForm, issues, savedDefaults = {}) {
  const suggestions = [];

  // Build context from general form
  const context = {
    title: generalForm.title || '',
    description: generalForm.description || '',
    brand: generalForm.brand || '',
    condition: generalForm.condition || '',
    price: generalForm.price || '',
    category: generalForm.category || '',
  };

  // Process each issue
  for (const issue of issues) {
    // Use saved default first if available (avoids unnecessary AI call)
    if (savedDefaults[issue.field]) {
      suggestions.push({
        field: issue.field,
        value: savedDefaults[issue.field],
        confidence: 0.95,
        reasoning: 'From your saved eBay shipping defaults',
      });
      continue;
    }

    try {
      const suggestion = await fillSingleField(
        marketplace,
        issue.field,
        context,
        marketplaceForm
      );

      if (suggestion) {
        suggestions.push({
          field: issue.field,
          value: suggestion.value,
          confidence: suggestion.confidence,
          reasoning: suggestion.reasoning,
        });
      }
    } catch (error) {
      console.error(`Error filling ${issue.field}:`, error);
    }
  }

  return suggestions;
}

/**
 * Fill a single field using AI
 */
async function fillSingleField(marketplace, field, context, marketplaceForm) {
  // Skip special fields
  if (field.startsWith('_')) return null;
  if (field === 'photos') return null; // Can't generate photos

  // Build prompt based on field type
  const prompt = buildFieldPrompt(marketplace, field, context);
  if (!prompt) return null;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cheap & fast model
      messages: [
        {
          role: 'system',
          content: 'You are a product listing expert. Provide accurate, concise suggestions for missing fields based on product information. Return ONLY the suggested value, nothing else.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Low temperature for consistent results
      max_tokens: 100,
    });

    const value = response.choices[0]?.message?.content?.trim();
    if (!value) return null;

    // Calculate confidence based on context quality
    const confidence = calculateConfidence(field, context);

    return {
      value,
      confidence,
      reasoning: `Suggested based on: ${context.title || 'product information'}`
    };

  } catch (error) {
    console.error(`OpenAI error for ${field}:`, error);
    return null;
  }
}

/**
 * Build prompt for specific field
 */
function buildFieldPrompt(marketplace, field, context) {
  const { title, description, brand, condition, price, category } = context;

  // Common prompts for all marketplaces
  const commonPrompts = {
    color: `Product: ${title}\nDescription: ${description}\n\nWhat is the primary color of this item? Answer with just the color name (e.g., "Black", "Blue", "Red").`,
    
    size: `Product: ${title}\nCategory: ${category}\n\nWhat size is this item? Answer with just the size (e.g., "M", "L", "XL", "10", "42").`,
    
    brand: `Product: ${title}\nDescription: ${description}\n\nWhat brand is this item? Answer with just the brand name.`,
  };

  // Marketplace-specific prompts
  if (marketplace === 'ebay') {
    const ebayPrompts = {
      handlingTime: `Return only: "1 business day"`,
      shippingMethod: `Return only: "Standard: Small to medium items"`,
      shippingCostType: `Return only: "Flat: Same cost regardless of buyer location"`,
      shippingService: `Return only: "Standard Shipping (3 to 5 business days)"`,
      shippingCost: price > 100 ? `Return only: "0.00"` : `Return only: "5.99"`,
      duration: `Return only: "Good 'Til Canceled"`,
      pricingFormat: `Return only: "fixed"`,
    };
    
    return ebayPrompts[field] || commonPrompts[field];
  }

  if (marketplace === 'mercari') {
    const mercariPrompts = {
      mercariCategory: `Product: ${title}\nDescription: ${description}\n\nFrom this Mercari category list, which category best fits this item?\nWomen > Men > Kids > Home > Electronics > Toys & Hobbies > Entertainment > Handmade > Sports & Outdoors > Office Supplies > Tools\n\nReturn ONLY the top-level category name that best matches.`,
    };
    
    return mercariPrompts[field] || commonPrompts[field];
  }

  if (marketplace === 'facebook') {
    const categoryList = FB_TOP_CATEGORIES.join(' | ');
    const facebookPrompts = {
      condition: `Product: ${title}\nCurrent condition: ${condition}\n\nMap this to Facebook condition: new | used_like_new | used_good | used_fair\nReturn only one of these exact values.`,
      category: `Product: "${title}"\nDescription: "${description}"\nGeneral category hint: "${category}"\nBrand: "${brand}"\n\nFrom this list of Facebook Marketplace categories, which one best fits this product?\n${categoryList}\n\nReturn ONLY the category name exactly as shown above.`,
    };
    
    return facebookPrompts[field] || commonPrompts[field];
  }

  return commonPrompts[field];
}

/**
 * Calculate confidence score based on available context
 */
function calculateConfidence(field, context) {
  let score = 0.5; // Base confidence

  // Higher confidence if we have rich context
  if (context.title && context.title.length > 10) score += 0.2;
  if (context.description && context.description.length > 50) score += 0.2;
  if (context.brand) score += 0.1;

  // Field-specific confidence adjustments
  if (field === 'color' && context.title.match(/\b(black|white|red|blue|green|yellow|pink|gray|grey)\b/i)) {
    score += 0.2;
  }

  if (field === 'brand' && context.brand) {
    score = 0.95; // Very high if brand already exists
  }

  return Math.min(score, 0.95); // Cap at 0.95
}
