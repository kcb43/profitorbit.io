/**
 * POST /api/ai/generate-description
 *
 * AI-powered description generator.
 *
 * Accepts either:
 *   A) Legacy mode: { marketplace, inputDescription, title, brand, category, condition, similarDescriptions, numVariations }
 *   B) Structured mode: { platform, title, condition, existingDescription, itemFacts, keywords, numVariations }
 *
 * Fulfillment profile (pickup/shipping details) is fetched server-side from
 * user_fulfillment_profiles using the caller's JWT, so the AI only ever
 * uses what the user has actually saved in their settings.
 *
 * Returns: { descriptions: string[], bulletPoints?: string[], suggestedKeywords?: string[], warnings?: string[] }
 */

import { createClient } from '@supabase/supabase-js';

// ── CORS ──────────────────────────────────────────────────────────────────────

function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== "string") return false;
  if (origin === "https://profitorbit.io") return true;
  if (/^https:\/\/([a-z0-9-]+\.)?profitorbit\.io$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  if (/^http:\/\/localhost:\d+$/i.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/i.test(origin)) return true;
  return false;
}

function setCors(req, res) {
  const origin = req.headers?.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── Supabase (service role — for reading fulfillment profile server-side) ─────

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function platformToneRules(platform) {
  const p = String(platform || "general").toLowerCase();
  if (p === "ebay") {
    return [
      'Tone: professional, clear, confident.',
      'Structure: short paragraphs + simple bullet points under "Features & Details" and "Specifications".',
      'Avoid slang. Buyers scan fast — put the most important specs early.',
    ].join(' ');
  }
  if (p === "facebook" || p === "fb") {
    return [
      'Tone: casual and friendly (Facebook Marketplace style).',
      'Short paragraphs, easy to skim. A little conversational is fine.',
      'End with the pickup/shipping line (if provided).',
    ].join(' ');
  }
  if (p === "mercari") {
    return [
      'Tone: casual and straightforward (Mercari style).',
      'Mostly bullet points + a short closing paragraph. ~900-1000 chars preferred.',
      'No fluff, no filler.',
    ].join(' ');
  }
  if (p === "etsy") {
    return [
      'Tone: descriptive and buyer-friendly (Etsy style). Slightly warm, not cheesy.',
      'Tell a mini story about the item, then list specifics.',
    ].join(' ');
  }
  if (p === "poshmark") {
    return [
      'Tone: style-forward and social (Poshmark style).',
      'Lead with condition + brand + style, then size, then why it is a great pick.',
    ].join(' ');
  }
  return 'Tone: neutral and broadly usable across marketplaces.';
}

/** Fetch the user's fulfillment profile from Supabase using their JWT. */
async function getFulfillmentProfile(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // Verify JWT and get user
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data } = await supabase
    .from('user_fulfillment_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return data || null;
}

/** Build the fulfillment line to append to a description. */
function buildFulfillmentLine(profile, platform) {
  if (!profile) return null;

  const p = String(platform || '').toLowerCase();

  // Platform-specific override takes priority
  const override = profile.platform_notes?.[p];
  if (override && typeof override === 'string' && override.trim()) {
    return override.trim();
  }

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

/** Deterministic keyword extraction from structured item data. */
function extractDeterministicKeywords(title = '', itemFacts = {}, existingKeywords = []) {
  const tokens = new Set();

  // From existing keywords
  for (const kw of existingKeywords) {
    if (kw && typeof kw === 'string') tokens.add(kw.trim());
  }

  // Brand
  if (itemFacts.brand) tokens.add(itemFacts.brand);

  // Series / franchise
  if (itemFacts.series) tokens.add(itemFacts.series);

  // Material, scale, category keywords
  for (const field of ['material', 'scale', 'category']) {
    if (itemFacts[field]) tokens.add(itemFacts[field]);
  }

  // Significant title words (> 3 chars, not stop-words)
  const STOP = new Set(['the','and','for','with','from','this','that','into','they','have','been','will','your','about','more','also','than','then','when','what','like','some','very','just','over','such','only','same','each','most','must','made','many','both','long','these','those','after','before','other','well','good','used','best','high','low','new','old','buy','sell','set','lot','get','got','can','use','all','one','two','per','are','our','its','any']);
  const words = title.replace(/[^a-zA-Z0-9:\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w.toLowerCase()));
  for (const w of words) {
    if (/[A-Z]/.test(w[0]) || w.length > 5) tokens.add(w);
  }

  return [...tokens].filter(Boolean).slice(0, 15);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};

    // ── Detect mode ───────────────────────────────────────────────────────────
    const isStructured = !!(body.itemFacts || body.platform || body.keywords);

    // ── Shared fields ─────────────────────────────────────────────────────────
    const platform     = String(body.platform || body.marketplace || 'general').toLowerCase();
    const title        = String(body.title || '').trim();
    const condition    = String(body.condition || '').trim();
    const brand        = String(body.brand || body.itemFacts?.brand || '').trim();
    const category     = String(body.category || '').trim();
    const numVariations = Math.max(1, Math.min(6, Number(body.numVariations) || 3));

    // Legacy / structured descriptions seed
    const inputDescription   = String(body.inputDescription || body.existingDescription || '').trim();
    const hasSeedDescription = inputDescription.length > 0;

    // ── Fetch fulfillment profile from Supabase ───────────────────────────────
    const fulfillmentProfile = await getFulfillmentProfile(req.headers.authorization || '').catch(() => null);
    const fulfillmentLine    = buildFulfillmentLine(fulfillmentProfile, platform);

    // ── Build itemFacts block ─────────────────────────────────────────────────
    const itemFacts = body.itemFacts || {};
    const itemFactsLines = Object.entries(itemFacts)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim())
      .map(([k, v]) => `  ${k}: ${v}`);

    // ── Keyword handling ──────────────────────────────────────────────────────
    const incomingKeywords = Array.isArray(body.keywords) ? body.keywords : [];
    const deterministicKws = isStructured
      ? extractDeterministicKeywords(title, itemFacts, incomingKeywords)
      : incomingKeywords;

    // ── Similar descriptions context (legacy back-compat) ─────────────────────
    const contextLines = Array.isArray(body.similarDescriptions)
      ? body.similarDescriptions.filter(Boolean).slice(0, 6).map(String)
      : [];
    const contextBlock = contextLines.length > 0
      ? (hasSeedDescription
          ? `Reference examples (tone/structure only — do NOT copy facts):\n${contextLines.map((d, i) => `${i + 1}. ${d.slice(0, 500)}`).join('\n')}`
          : `Similar products (titles — use to understand product type):\n${contextLines.map((t, i) => `${i + 1}. ${t.slice(0, 200)}`).join('\n')}`)
      : '';

    // ── Check API key ─────────────────────────────────────────────────────────
    const openaiApiKey   = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!openaiApiKey && !anthropicApiKey) {
      return res.status(500).json({ error: 'AI API key not configured.' });
    }
    const useOpenAI = !!openaiApiKey;
    const apiKey = useOpenAI ? openaiApiKey : anthropicApiKey;

    // ── Validate inputs ───────────────────────────────────────────────────────
    if (!hasSeedDescription && !title) {
      return res.status(400).json({ error: 'Provide a title or existing description.' });
    }

    const warnings = [];
    if (!condition) warnings.push('Condition not provided — omit or say "see photos".');
    if (!brand && !itemFacts.brand) warnings.push('Brand not provided.');
    if (itemFactsLines.length === 0 && !hasSeedDescription) warnings.push('No item facts provided — description will be limited.');

    // ── Build the prompt ──────────────────────────────────────────────────────
    const toneRules = platformToneRules(platform);

    const fulfillmentInstruction = fulfillmentLine
      ? `Fulfillment line (include verbatim at the end of the description): "${fulfillmentLine}"`
      : `Do NOT include any pickup, shipping, or return/payment details.`;

    const systemPrompt = [
      'You write marketplace listing descriptions.',
      'RULES:',
      '  - Never invent facts. If a detail is not in the input, omit it or write "see photos."',
      '  - Do not mention price.',
      `  - ${fulfillmentInstruction}`,
      `  - Platform: ${platform}. ${toneRules}`,
      isStructured
        ? `  - Return STRICT JSON with keys: description (string), bulletPoints (string[]), suggestedKeywords (string[]), warnings (string[]).`
        : '  - Return only a numbered list of descriptions. No extra text.',
    ].join('\n');

    const userPromptParts = [
      `Title: ${title || '(unknown)'}`,
      condition  ? `Condition: ${condition}` : '',
      brand      ? `Brand: ${brand}` : '',
      category   ? `Category: ${category}` : '',
      itemFactsLines.length > 0 ? `Item facts:\n${itemFactsLines.join('\n')}` : '',
      deterministicKws.length > 0 ? `Keywords to work in: ${deterministicKws.join(', ')}` : '',
      hasSeedDescription ? `\nExisting description (rewrite into ${numVariations} improved version${numVariations > 1 ? 's' : ''}):\n${inputDescription}` : `\nGenerate ${numVariations} distinct, compelling description${numVariations > 1 ? 's' : ''}.`,
      contextBlock ? `\n${contextBlock}` : '',
    ].filter(Boolean).join('\n');

    // ── Call AI ───────────────────────────────────────────────────────────────
    let rawContent = '';

    if (useOpenAI) {
      const openaiBody = {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPromptParts },
        ],
        temperature: hasSeedDescription ? 0.5 : 0.8,
        max_tokens: isStructured ? 1500 : 1200,
        n: 1,
      };

      // Force JSON output in structured mode
      if (isStructured) {
        openaiBody.response_format = { type: 'json_object' };
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(openaiBody),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${err.error?.message || JSON.stringify(err)}`);
      }
      const data = await response.json();
      rawContent = data.choices[0]?.message?.content || '';
    } else {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: isStructured ? 1500 : 1200,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPromptParts }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${err.error?.message || JSON.stringify(err)}`);
      }
      const data = await response.json();
      rawContent = data.content[0]?.text || '';
    }

    // ── Parse response ────────────────────────────────────────────────────────
    if (isStructured) {
      // Try to parse JSON from the AI response
      let parsed = null;
      try {
        // Strip markdown fences if present
        const cleaned = rawContent.replace(/^```(?:json)?\n?/m, '').replace(/\n?```\s*$/m, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        // AI didn't return valid JSON — treat its output as a plain description
        parsed = {
          description: rawContent.trim(),
          bulletPoints: [],
          suggestedKeywords: [],
          warnings: ['AI returned unstructured text; JSON parsing failed.'],
        };
      }

      // Merge AI keyword suggestions with deterministic ones (AI adds, doesn't replace)
      const aiKeywords = Array.isArray(parsed.suggestedKeywords) ? parsed.suggestedKeywords : [];
      const mergedKeywords = [...new Set([...deterministicKws, ...aiKeywords])].slice(0, 30);

      // The main descriptions array for back-compat
      const descriptions = parsed.description
        ? [parsed.description]
        : [];

      return res.status(200).json({
        // Structured output
        description:       parsed.description || '',
        bulletPoints:      Array.isArray(parsed.bulletPoints) ? parsed.bulletPoints : [],
        suggestedKeywords: mergedKeywords,
        warnings:          [...warnings, ...(Array.isArray(parsed.warnings) ? parsed.warnings : [])],
        // Legacy back-compat
        descriptions,
      });
    }

    // ── Legacy mode: parse numbered list ─────────────────────────────────────
    const descriptions = rawContent
      .split('\n')
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, numVariations);

    return res.status(200).json({ descriptions });

  } catch (error) {
    console.error('Error generating descriptions:', error);
    const msg = String(error?.message || error);
    return res.status(500).json({ error: msg, details: msg });
  }
}
