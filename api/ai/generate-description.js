/**
 * AI-powered description generator API endpoint
 * Uses OpenAI or Anthropic to generate product descriptions based on similar items
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, brand, category, similarDescriptions, condition, numVariations = 3 } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

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

    // Build context from similar descriptions
    const contextText = similarDescriptions && similarDescriptions.length > 0
      ? `Here are some example descriptions from similar items:\n\n${similarDescriptions.slice(0, 5).map((desc, i) => `${i + 1}. ${desc}`).join('\n\n')}`
      : '';

    // Build the prompt
    const prompt = `You are an expert at writing compelling product descriptions for online marketplaces like eBay, Etsy, Mercari, and Facebook Marketplace.

${contextText ? `${contextText}\n\n` : ''}Generate ${numVariations} different, unique product descriptions for the following item:

Title: ${title}
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

Return ONLY the descriptions, one per line, numbered 1-${numVariations}. Do not include any other text or formatting.`;

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
              content: 'You are a helpful assistant that generates product descriptions for online marketplaces.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.8, // Higher temperature for more variety
          n: 1,
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
        .slice(0, numVariations);
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
        .slice(0, numVariations);
    }

    // If we got fewer descriptions than requested, generate more
    if (descriptions.length < numVariations) {
      // For now, just return what we have
      // In production, you might want to make additional API calls
    }

    return res.status(200).json({ descriptions });
  } catch (error) {
    console.error('Error generating descriptions:', error);
    return res.status(500).json({
      error: 'Failed to generate descriptions',
      details: error.message,
    });
  }
}

