/**
 * POST /api/ai/generate-description
 *
 * Generates comprehensive, platform-specific marketplace descriptions
 * for eBay, Mercari, and Facebook — plus a tag list and category suggestions —
 * in one AI call.
 *
 * Accepts:
 *   { inputDescription, title, brand, category, condition, platform?, numVariations? }
 *
 * Returns:
 *   { ebay, mercari, facebook, tags, suggestedCategories, warnings, descriptions (legacy compat) }
 *
 * Fulfillment profile (pickup/shipping) is fetched server-side from
 * user_fulfillment_profiles using the caller's JWT.
 */

import { createClient } from '@supabase/supabase-js';

// ── CORS ──────────────────────────────────────────────────────────────────────

function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  if (origin === 'https://orben.io') return true;
  if (/^https:\/\/([a-z0-9-]+\.)?profitorbit\.io$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  if (/^http:\/\/localhost:\d+$/i.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/i.test(origin)) return true;
  return false;
}

function setCors(req, res) {
  const origin = req.headers?.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Supabase ─────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Fulfillment helpers ───────────────────────────────────────────────────────

async function getFulfillmentProfile(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data } = await supabase
    .from('user_fulfillment_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  return data || null;
}

/**
 * Build the fulfillment line for a specific platform.
 * Platform-specific override takes priority over global pickup/shipping settings.
 */
function buildFulfillmentLine(profile, platform) {
  if (!profile) return null;
  const p = String(platform || '').toLowerCase();

  // Platform-specific override wins (but not special flags like ebay_emojis)
  const override = profile.platform_notes?.[p];
  if (override && typeof override === 'string' && override.trim()) return override.trim();

  // Fall back to global settings
  const parts = [];
  if (profile.pickup_enabled && profile.pickup_location_line) {
    parts.push(profile.pickup_location_line.trim());
    if (profile.pickup_notes) parts.push(profile.pickup_notes.trim());
  }
  if (profile.shipping_enabled && profile.shipping_notes) {
    parts.push(profile.shipping_notes.trim());
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Detect shipping speed/cost keywords from the eBay note or global shipping note.
 * Returns a hint string like "Free Shipping" or "Next Day Shipping" for the AI to use in eBay titles.
 */
function detectEbayShippingKeyword(profile) {
  if (!profile) return null;
  const text = [
    profile.platform_notes?.ebay || '',
    profile.shipping_notes || '',
  ].join(' ').toLowerCase();

  if (/free\s*ship/i.test(text) || /ships?\s*free/i.test(text)) return 'Free Shipping';
  if (/same[\s-]?day/i.test(text)) return 'Same Day Shipping';
  if (/next[\s-]?day|overnight|1[\s-]?day\s*ship/i.test(text)) return 'Next Day Shipping';
  if (/2[\s-]?day\s*ship/i.test(text)) return '2-Day Shipping';
  if (/fast[\s-]?ship/i.test(text)) return 'Fast Shipping';
  return null;
}

// ── Build the AI prompt ───────────────────────────────────────────────────────

function buildPrompt({
  title,
  condition,
  brand,
  category,
  inputDescription,
  itemFacts,
  ebayFulfillment,
  mercariFulfillment,
  facebookFulfillment,
  ebayUseEmojis,
  ebayShippingKeyword,
}) {
  const ebayEmojiInstruction = ebayUseEmojis
    ? `  • Use relevant emojis immediately before each section heading (e.g. ✅ Features & Details:, 📦 Specifications:, 🏷️ Condition:).`
    : `  • Do NOT use emojis in the eBay description.`;

  const ebayShippingHint = ebayShippingKeyword
    ? `  • The seller offers "${ebayShippingKeyword}". Include this in the eBay description's closing section and note it where appropriate for SEO.`
    : '';

  const ebayFulfillmentLine = ebayFulfillment
    ? `  • End with this fulfillment line verbatim: "${ebayFulfillment}"`
    : '';

  const mercariFulfillmentLine = mercariFulfillment
    ? `  • End with this line: "${mercariFulfillment}"`
    : '';

  const facebookFulfillmentLine = facebookFulfillment
    ? `  • End with this pickup/shipping line verbatim: "${facebookFulfillment}"`
    : '  • Do NOT include pickup or shipping details unless they were provided in the input.';

  const systemPrompt = `You are a professional marketplace listing copywriter.

STRICT RULES:
- Never invent or assume facts not provided in the input. If a detail is missing, omit it entirely.
- Do not mention price.
- Return ONLY a single valid JSON object — no markdown fences, no explanation, no extra text.
- Each description must be complete and polished, ready to paste directly into the marketplace.
- Honor ALL fulfillment lines exactly as written — do not paraphrase them.

OUTPUT FORMAT (valid JSON, all keys required):
{
  "ebay": "...",
  "mercari": "...",
  "facebook": "...",
  "tags": ["tag1", "tag2", ...],
  "ebaySuggestedCategories": ["Category > Subcategory > Leaf", ...],
  "mercariSuggestedCategories": ["Category > Subcategory", ...],
  "facebookSuggestedCategories": ["Category > Subcategory", ...]
}

PLATFORM REQUIREMENTS:

eBay — professional, detail-focused, SEO-friendly:
  • Lead with 2-3 sentence overview that sells the product
  • "Features & Details:" section with bullet points (•) for every notable feature
  • "Specifications:" section listing all measurable details (dimensions, material, quantity, scale, etc.)
  • Close with condition statement
  • Minimum 400 characters. Use paragraph breaks between sections.
${ebayEmojiInstruction}
${ebayShippingHint}
${ebayFulfillmentLine}

Mercari — casual, scannable, ~900-1,000 characters:
  • Open with "Condition: [value]" line
  • Bullet points (•) for all key features and specs — be thorough
  • Close with a 2-3 sentence paragraph that adds personality and summarizes why it is a good buy
  • Stay within 900-1,000 characters
${mercariFulfillmentLine}

Facebook Marketplace — casual, conversational, friendly:
  • Open with a condition/brand hook (e.g. "Brand New –" or "Excellent condition –")
  • 2-3 natural sentences describing what you are selling and why it is great
  • Bullet points (•) for key features
${facebookFulfillmentLine}

Tags — search-optimized:
  • 15-25 tags, each as a separate string in the JSON array
  • Include: brand, product type, key descriptors, synonyms, category terms
  • Mix specific (exact product names) and broad (category-level) terms

ebaySuggestedCategories — 3-5 eBay-specific category breadcrumbs:
  • Use eBay's actual category hierarchy (e.g. "Clothing, Shoes & Accessories > Men > Men's Clothing > Shirts")
  • 3 to 5 paths, most specific first
  • Format: "Parent > Subcategory > Leaf" (use " > " as separator)

mercariSuggestedCategories — 3-5 Mercari-specific category breadcrumbs:
  • Use Mercari's actual category hierarchy (e.g. "Electronics > Computers & Laptops > Laptops")
  • 3 to 5 paths, most specific first
  • Format: "Parent > Subcategory > Leaf"

facebookSuggestedCategories — 3-5 Facebook Marketplace category breadcrumbs:
  • Use Facebook Marketplace's actual category hierarchy (e.g. "Electronics > Phones > Smartphones")
  • 3 to 5 paths, most specific first
  • Format: "Parent > Subcategory > Leaf"`;

  const userLines = [
    title     ? `Title: ${title}` : '',
    brand     ? `Brand: ${brand}` : '',
    category  ? `Category: ${category}` : '',
    condition ? `Condition: ${condition}` : '',
    itemFacts && Object.keys(itemFacts).length > 0
      ? `Item details:\n${Object.entries(itemFacts).filter(([,v]) => v).map(([k,v]) => `  ${k}: ${v}`).join('\n')}`
      : '',
    inputDescription
      ? `\nExisting description to rewrite into all three platform formats:\n---\n${inputDescription}\n---`
      : '',
  ].filter(Boolean).join('\n');

  return { systemPrompt, userPrompt: userLines };
}

// ── Call OpenAI ───────────────────────────────────────────────────────────────

async function callOpenAI(apiKey, systemPrompt, userPrompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${err.error?.message || response.statusText}`);
  }
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// ── Call Anthropic ────────────────────────────────────────────────────────────

async function callAnthropic(apiKey, systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${err.error?.message || response.statusText}`);
  }
  const data = await response.json();
  return data.content[0]?.text || '';
}

// ── Parse AI response ─────────────────────────────────────────────────────────

function parseResponse(rawContent) {
  const cleaned = rawContent
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    return {
      ebay: cleaned,
      mercari: '',
      facebook: '',
      tags: [],
      suggestedCategories: [],
      _parseError: true,
    };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};

    const title            = String(body.title || '').trim();
    const condition        = String(body.condition || '').trim();
    const brand            = String(body.brand || body.itemFacts?.brand || '').trim();
    const category         = String(body.category || '').trim();
    const inputDescription = String(body.inputDescription || body.existingDescription || '').trim();
    const itemFacts        = body.itemFacts || {};

    if (!inputDescription && !title) {
      return res.status(400).json({ error: 'Provide a title or existing description.' });
    }

    // Fetch fulfillment profile and build per-platform lines
    const fulfillmentProfile = await getFulfillmentProfile(req.headers.authorization || '').catch(() => null);

    const ebayFulfillment     = buildFulfillmentLine(fulfillmentProfile, 'ebay');
    const mercariFulfillment  = buildFulfillmentLine(fulfillmentProfile, 'mercari');
    const facebookFulfillment = buildFulfillmentLine(fulfillmentProfile, 'facebook');
    const ebayUseEmojis       = Boolean(fulfillmentProfile?.platform_notes?.ebay_emojis);
    const ebayShippingKeyword = detectEbayShippingKeyword(fulfillmentProfile);

    const openaiApiKey    = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!openaiApiKey && !anthropicApiKey) {
      return res.status(500).json({ error: 'AI API key not configured.' });
    }

    const { systemPrompt, userPrompt } = buildPrompt({
      title,
      condition,
      brand,
      category,
      inputDescription,
      itemFacts,
      ebayFulfillment,
      mercariFulfillment,
      facebookFulfillment,
      ebayUseEmojis,
      ebayShippingKeyword,
    });

    const rawContent = openaiApiKey
      ? await callOpenAI(openaiApiKey, systemPrompt, userPrompt)
      : await callAnthropic(anthropicApiKey, systemPrompt, userPrompt);

    const parsed = parseResponse(rawContent);

    const warnings = [];
    if (!condition) warnings.push('Condition not provided — descriptions may be generic.');
    if (!brand && !itemFacts.brand) warnings.push('Brand not provided.');
    if (parsed._parseError) warnings.push('AI response could not be fully parsed — showing partial output.');

    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter(Boolean) : [];

    const parseCats = (key) =>
      Array.isArray(parsed[key]) ? parsed[key].filter(Boolean).slice(0, 5) : [];

    const ebaySuggestedCategories     = parseCats('ebaySuggestedCategories');
    const mercariSuggestedCategories  = parseCats('mercariSuggestedCategories');
    const facebookSuggestedCategories = parseCats('facebookSuggestedCategories');

    // Legacy fallback: old single-array field (kept for backward compat)
    const suggestedCategories = parseCats('suggestedCategories').length > 0
      ? parseCats('suggestedCategories')
      : ebaySuggestedCategories;

    const ebay     = String(parsed.ebay     || '').trim();
    const mercari  = String(parsed.mercari  || '').trim();
    const facebook = String(parsed.facebook || '').trim();

    return res.status(200).json({
      ebay,
      mercari,
      facebook,
      tags,
      ebaySuggestedCategories,
      mercariSuggestedCategories,
      facebookSuggestedCategories,
      suggestedCategories, // legacy compat
      warnings,
      descriptions: [ebay, mercari, facebook].filter(Boolean),
    });

  } catch (error) {
    console.error('Error generating descriptions:', error);
    const msg = String(error?.message || error);
    return res.status(500).json({ error: msg, details: msg });
  }
}
