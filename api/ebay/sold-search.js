/**
 * Vercel Serverless Function - eBay Sold Listings Search via SerpAPI
 *
 * Handles two modes:
 *   GET /api/ebay/sold-search?q=<keyword>           → keyword search for completed/sold listings
 *   GET /api/ebay/sold-search?product_id=<itemId>   → rich product detail for a single listing
 */

const SERPAPI_BASE = 'https://serpapi.com/search';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'SERPAPI_KEY is not configured on this server.' });
  }

  const { q, product_id, num = '30' } = req.query;

  try {
    // ── Mode 1: product detail ─────────────────────────────────────────────
    if (product_id) {
      const params = new URLSearchParams({
        engine: 'ebay_product',
        product_id,
        api_key: apiKey,
      });

      const response = await fetch(`${SERPAPI_BASE}?${params}`, { timeout: 12000 });
      if (!response.ok) {
        const text = await response.text();
        console.error('SerpAPI ebay_product error:', response.status, text);
        return res.status(response.status).json({ error: 'SerpAPI request failed', details: text });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // ── Mode 2: keyword sold-listings search ───────────────────────────────
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Missing required parameter: q or product_id' });
    }

    const params = new URLSearchParams({
      engine: 'ebay',
      _nkw: q.trim(),           // eBay keyword parameter
      LH_Sold: '1',             // sold listings only
      LH_Complete: '1',         // completed listings
      _sop: '13',               // sort: most recently ended first
      _ipg: String(Math.min(Number(num), 100)), // items per page, max 100
      api_key: apiKey,
    });

    const response = await fetch(`${SERPAPI_BASE}?${params}`, { timeout: 12000 });
    if (!response.ok) {
      const text = await response.text();
      console.error('SerpAPI ebay search error:', response.status, text);
      return res.status(response.status).json({ error: 'SerpAPI request failed', details: text });
    }

    const data = await response.json();

    // Normalise the organic_results array from the eBay SERP engine
    const raw = data.organic_results || [];
    const results = raw.map((item) => ({
      product_id: item.item_id || item.id || null,
      title: item.title || '',
      price: item.price?.extracted || item.price?.raw || null,
      priceRaw: item.price?.raw || null,
      originalPrice: item.price?.original?.extracted || null,
      imageUrl: item.thumbnail || item.image || null,
      condition: item.condition || null,
      seller: item.seller_info?.name || item.seller || null,
      sellerFeedback: item.seller_info?.positive_feedback_percent || null,
      sellerSales: item.seller_info?.num_of_reviews || null,
      shippingCost: item.shipping?.extracted || 0,
      shippingRaw: item.shipping?.raw || null,
      isFreeShipping: item.free_shipping || false,
      productUrl: item.link || `https://www.ebay.com/itm/${item.item_id}`,
      dateSold: item.completed_date || item.date || null,
      totalBids: item.bids || null,
      buyingFormat: item.buying_format || null,
      extensions: item.extensions || [],
    }));

    return res.status(200).json({
      total: data.search_information?.total_results || results.length,
      results,
      searchMetadata: {
        query: q.trim(),
        engine: 'ebay_sold',
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Error in /api/ebay/sold-search:', err);
    return res.status(500).json({ error: 'Internal error', details: err.message });
  }
}
