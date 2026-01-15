/**
 * Receipt scan endpoint (vision → structured fields)
 *
 * This is a lightweight alternative to the full Python app in
 * https://github.com/datasciencecampus/receipt_scanner?tab=readme-ov-file
 *
 * Input: { imageBase64, fileName? }
 * Output: { merchant, purchase_date, total, line_items[] }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    const { imageBase64, fileName } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const prompt = `You are a receipt parsing engine.
Extract the following fields from the receipt image:
- merchant (string)
- purchase_date (YYYY-MM-DD if possible, else empty string)
- total (number as string, e.g. "23.45", else empty string)
- line_items (array of { name: string, price: string })

Return ONLY valid JSON with exactly these keys. Do not include markdown.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.0,
        messages: [
          { role: 'system', content: 'Return only JSON.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
              ...(fileName ? [{ type: 'text', text: `Filename: ${fileName}` }] : []),
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      return res.status(500).json({ error: 'Receipt scan failed', details: err });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return res.status(500).json({ error: 'Model did not return valid JSON', raw: content });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    console.error('Receipt scan error:', e);
    return res.status(500).json({ error: 'Internal error', details: String(e?.message || e) });
  }
}


