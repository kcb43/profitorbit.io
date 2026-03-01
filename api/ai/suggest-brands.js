/**
 * POST /api/ai/suggest-brands
 *
 * Given a product title (and optional category), returns 3-5 likely brand names
 * sourced from the AI's knowledge of resale marketplace brands.
 *
 * Accepts:  { title: string, category?: string }
 * Returns:  { brands: string[] }
 */

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

// ── AI helpers ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a brand identification expert for resale marketplaces (eBay, Mercari, Poshmark, Depop).
Given a product title, return the 3-5 most likely real brand names that could match this item.
Rules:
- Only suggest real, established brands (no generic terms like "unbranded" or "no brand")
- Order by most likely first
- If the title already contains a brand name, include it as the first suggestion
- If the item is clearly generic/unbranded (e.g. "generic phone case"), return an empty array
- Return ONLY valid JSON with no markdown: {"brands": ["Brand1", "Brand2", "Brand3"]}`;

async function callOpenAI(apiKey, title, category) {
  const userPrompt = `Product title: "${title}"${category ? `\nCategory hint: ${category}` : ''}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 120,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI error: ${err.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.choices[0]?.message?.content || '{}';
}

async function callAnthropic(apiKey, title, category) {
  const userPrompt = `Product title: "${title}"${category ? `\nCategory hint: ${category}` : ''}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 120,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic error: ${err.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.content[0]?.text || '{}';
}

function parseBrands(raw) {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed.brands)
      ? parsed.brands.filter(b => typeof b === 'string' && b.trim()).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { title, category } = req.body || {};

  if (!title || String(title).trim().length < 3) {
    res.status(400).json({ error: 'title must be at least 3 characters', brands: [] });
    return;
  }

  const openaiKey  = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!openaiKey && !anthropicKey) {
    res.status(500).json({ error: 'No AI API key configured', brands: [] });
    return;
  }

  try {
    const raw = openaiKey
      ? await callOpenAI(openaiKey, String(title).trim(), category || '')
      : await callAnthropic(anthropicKey, String(title).trim(), category || '');

    const brands = parseBrands(raw);
    res.status(200).json({ brands });
  } catch (err) {
    console.error('[suggest-brands]', err.message);
    res.status(500).json({ error: 'Brand suggestion failed', brands: [] });
  }
}
