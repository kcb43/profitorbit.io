/**
 * POST /api/ai/suggest-tags
 *
 * Given a product description, returns 10-20 search-optimized tags
 * for marketplace listings (eBay, Mercari, Etsy, etc.).
 *
 * Accepts:  { description: string }
 * Returns:  { tags: string[] }
 */

function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  if (origin === 'https://profitorbit.io') return true;
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

const SYSTEM_PROMPT = `You are a marketplace listing expert. Given a product description, suggest 10-20 search-optimized tags that help buyers find this item on eBay, Mercari, Etsy, etc.
Rules:
- Include brand, product type, key descriptors, synonyms, and category terms
- Mix specific (exact product names) and broad (category-level) terms
- Each tag should be 1-3 words, lowercase
- No duplicates or near-duplicates
- Return ONLY valid JSON with no markdown: {"tags": ["tag1", "tag2", ...]}`;

async function callOpenAI(apiKey, description) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Product description:\n${description}` },
      ],
      temperature: 0.4,
      max_tokens: 300,
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

async function callAnthropic(apiKey, description) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Product description:\n${description}` }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic error: ${err.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.content[0]?.text || '{}';
}

function parseTags(raw) {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed.tags) ? parsed.tags : [];
    return arr
      .filter(t => typeof t === 'string' && t.trim())
      .map(t => t.trim().toLowerCase())
      .slice(0, 20);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { description } = req.body || {};
  const desc = String(description || '').trim();

  if (desc.length < 20) {
    res.status(400).json({ error: 'description must be at least 20 characters', tags: [] });
    return;
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!openaiKey && !anthropicKey) {
    res.status(500).json({ error: 'No AI API key configured', tags: [] });
    return;
  }

  try {
    const raw = openaiKey
      ? await callOpenAI(openaiKey, desc)
      : await callAnthropic(anthropicKey, desc);

    const tags = parseTags(raw);
    res.status(200).json({ tags });
  } catch (err) {
    console.error('[suggest-tags]', err.message);
    res.status(500).json({ error: 'Tag suggestion failed', tags: [] });
  }
}
