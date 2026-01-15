/**
 * Receipt scan endpoint (vision → structured fields)
 *
 * This is a lightweight alternative to the full Python app in
 * https://github.com/datasciencecampus/receipt_scanner?tab=readme-ov-file
 *
 * Input: { imageBase64, fileName? }
 * Output: { merchant, purchase_date, total, payment_method, currency, suggested_title, line_items[] }
 */

function buildMockReceipt({ fileName } = {}) {
  // Deterministic-ish mock that still feels like a "real pipeline" output.
  const safeName = String(fileName || "").slice(0, 80);
  return {
    merchant: "Mock Merchant",
    purchase_date: "",
    total: "",
    payment_method: "",
    currency: "USD",
    suggested_title: safeName ? `Purchase from ${safeName}` : "Receipt purchase",
    line_items: [
      { name: safeName ? `Receipt image: ${safeName}` : "Sample item", price: "" },
      { name: "Another item", price: "" },
    ],
    // Extras (harmless if client ignores; useful for future UI):
    subtotal: "",
    tax: "",
    confidence: "mock",
  };
}

function extractJsonObject(text) {
  if (!text || typeof text !== "string") return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeReceiptPayload(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const lineItemsRaw = Array.isArray(obj.line_items) ? obj.line_items : [];
  const line_items = lineItemsRaw
    .filter(Boolean)
    .map((li) => ({
      name: li?.name ? String(li.name) : "",
      price: li?.price ? String(li.price) : "",
    }))
    .filter((li) => li.name || li.price);

  return {
    merchant: obj.merchant ? String(obj.merchant) : "",
    purchase_date: obj.purchase_date ? String(obj.purchase_date) : "",
    total: obj.total ? String(obj.total) : "",
    payment_method: obj.payment_method ? String(obj.payment_method) : "",
    currency: obj.currency ? String(obj.currency) : "USD",
    suggested_title: obj.suggested_title ? String(obj.suggested_title) : "",
    line_items,
    subtotal: obj.subtotal ? String(obj.subtotal) : "",
    tax: obj.tax ? String(obj.tax) : "",
    confidence: obj.confidence ? String(obj.confidence) : "",
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const mode = String(process.env.RECEIPT_SCANNER_MODE || "").toLowerCase(); // "mock" | "openai"

    const { imageBase64, fileName } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    // Always allow forcing mock mode (useful for development + demos).
    const forceMock =
      mode === "mock" ||
      req.query?.mock === "1" ||
      req.headers?.["x-receipt-scan-mock"] === "1" ||
      !openaiApiKey;

    if (forceMock) {
      return res.status(200).json(buildMockReceipt({ fileName }));
    }

    const prompt = `You are a receipt parsing engine.
Extract the following fields from the receipt image:
- merchant (string)
- purchase_date (YYYY-MM-DD if possible, else empty string)
- total (number as string, e.g. "23.45", else empty string)
- payment_method (string like "Visa", "Mastercard", "Cash", else empty string)
- currency (string like "USD", else "USD")
- suggested_title (short human-friendly title summarizing what was purchased; 3-8 words; no quotes; else empty string)
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
      // Fail soft: return a mock payload so the UI stays unblocked.
      return res.status(200).json({
        ...buildMockReceipt({ fileName }),
        confidence: "fallback",
        error: "Receipt scan failed",
        details: err,
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed =
      (() => {
        try {
          return JSON.parse(content);
        } catch {
          return extractJsonObject(content);
        }
      })() || null;

    if (!parsed) {
      // Fail soft: return mock payload so UI stays fast.
      return res.status(200).json({
        ...buildMockReceipt({ fileName }),
        confidence: "fallback",
        error: "Model did not return valid JSON",
        raw: content,
      });
    }

    return res.status(200).json(normalizeReceiptPayload(parsed));
  } catch (e) {
    console.error('Receipt scan error:', e);
    // Fail soft: return mock payload so UI stays unblocked.
    const message = String(e?.message || e);
    return res.status(200).json({
      ...buildMockReceipt(),
      confidence: "fallback",
      error: "Internal error",
      details: message,
    });
  }
}


