/**
 * AI-powered description generator API endpoint
 * Uses OpenAI or Anthropic to generate description suggestions.
 *
 * Primary mode (new): rewrite suggestions based on the user's existing description,
 * tailored per marketplace tone (eBay = more professional; Facebook/Mercari = more chill).
 *
 * Back-compat mode: if inputDescription is missing, fall back to title-based generation.
 */

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function toneForMarketplace(marketplace) {
  const m = String(marketplace || "general").toLowerCase();
  if (m === "ebay") {
    return `Tone: professional, clear, confident. Use light structure (short paragraphs and/or simple bullet points). Avoid slang.`;
  }
  if (m === "facebook" || m === "fb") {
    return `Tone: casual and friendly (Facebook Marketplace style). Short, easy to skim. A little conversational is OK.`;
  }
  if (m === "mercari") {
    return `Tone: casual and straightforward (Mercari style). Short, readable, no fluff.`;
  }
  if (m === "etsy") {
    return `Tone: descriptive and buyer-friendly (Etsy style). Slightly warm, but not cheesy.`;
  }
  return `Tone: neutral and broadly usable across marketplaces.`;
}

export default async function handler(req, res) {
  setCors(req, res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      marketplace = "general",
      inputDescription,
      title,
      brand,
      category,
      condition,
      similarDescriptions,
      numVariations = 3,
    } = req.body || {};

    const seedDescription = typeof inputDescription === "string" ? inputDescription.trim() : "";
    const hasSeedDescription = seedDescription.length > 0;
    const safeNum = Math.max(1, Math.min(6, Number(numVariations) || 3));
    const safeTitle = typeof title === "string" ? title.trim() : "";

    // Check if AI API key is configured
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!openaiApiKey && !anthropicApiKey) {
      return res.status(500).json({ 
        error: 'AI API key not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.' 
      });
    }

    // Use OpenAI if available, otherwise Anthropic
    const useOpenAI = !!openaiApiKey;
    const apiKey = useOpenAI ? openaiApiKey : anthropicApiKey;

    // Build context from similar descriptions (optional)
    const contextText = Array.isArray(similarDescriptions) && similarDescriptions.length > 0
      ? `Optional reference examples from similar items:\n${similarDescriptions
          .filter(Boolean)
          .slice(0, 5)
          .map((desc, i) => `${i + 1}. ${String(desc).slice(0, 800)}`)
          .join('\n')}`
      : '';

    const prompt = hasSeedDescription
      ? `You rewrite product descriptions for online marketplaces.

${toneForMarketplace(marketplace)}

Task:
- Read the user's current description (below) and produce ${safeNum} improved variations for that marketplace.
- Keep the same facts. Do NOT invent details (measurements, model numbers, materials, accessories, flaws, etc.) not present in the input.
- Fix spelling/grammar, improve clarity, and make it easier to read.
- Do NOT include shipping, returns, or pricing.
- Output only the descriptions as a numbered list (1-${safeNum}). No extra text.

Context (optional):
Title: ${safeTitle || "(unknown)"}
${brand ? `Brand: ${brand}` : ""}
${category ? `Category: ${category}` : ""}
${condition ? `Condition: ${condition}` : ""}
${contextText ? `\n${contextText}` : ""}

User description:
${seedDescription}`
      : `You are an expert at writing compelling product descriptions for online marketplaces like eBay, Etsy, Mercari, and Facebook Marketplace.

${contextText ? `${contextText}\n\n` : ''}Generate ${safeNum} different, unique product descriptions for the following item:

Title: ${safeTitle}
${brand ? `Brand: ${brand}` : ''}
${category ? `Category: ${category}` : ''}
${condition ? `Condition: ${condition}` : ''}

Requirements:
- Each description should be unique and compelling
- Keep descriptions concise but informative (2-4 sentences)
- Focus on key features, benefits, and condition
- Use natural, engaging language
- Do NOT include pricing, shipping, or return policy details (those are handled separately)
- Make each variation different in tone and focus

Return ONLY the descriptions, one per line, numbered 1-${safeNum}. Do not include any other text or formatting.`;

    if (!hasSeedDescription && !safeTitle) {
      return res.status(400).json({ error: 'Description text is required (or provide a title).' });
    }

    let descriptions = [];

    if (useOpenAI) {
      // Use OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // Use gpt-4o-mini (cost-effective) or configure via OPENAI_MODEL env var
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that generates product description suggestions for online marketplaces.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: hasSeedDescription ? 0.6 : 0.8, // Lower temp for rewrites (less hallucination)
          n: 1,
          max_tokens: 900,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`OpenAI API error: ${errorData.error?.message || JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';
      
      // Parse the descriptions (numbered list)
      descriptions = content
        .split('\n')
        .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, safeNum);
    } else {
      // Use Anthropic API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307', // Fast and cost-effective
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Anthropic API error: ${errorData.error?.message || JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const content = data.content[0]?.text || '';
      
      // Parse the descriptions (numbered list)
      descriptions = content
        .split('\n')
        .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, safeNum);
    }

    // If we got fewer descriptions than requested, generate more
    if (descriptions.length < safeNum) {
      // For now, just return what we have
      // In production, you might want to make additional API calls
    }

    return res.status(200).json({ descriptions });
  } catch (error) {
    console.error('Error generating descriptions:', error);
    return res.status(500).json({
      error: 'Failed to generate descriptions',
      details: String(error?.message || error),
    });
  }
}

