/**
 * Vercel Serverless Function - eBay Sold Listings Search via SerpAPI
 *
 * Handles two modes:
 *   GET /api/ebay/sold-search?q=<keyword>           → keyword search for completed/sold listings
 *   GET /api/ebay/sold-search?product_id=<itemId>   → rich product detail for a single listing
 */

const SERPAPI_BASE = 'https://serpapi.com/search';

// _ipg only accepts these values from SerpAPI's eBay engine
function sanitizePageSize(num) {
  const n = parseInt(num, 10);
  if (n <= 25) return '25';
  if (n <= 50) return '50';
  if (n <= 100) return '100';
  return '200';
}

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

  const { q, product_id, num = '50' } = req.query;

  try {
    // ── Mode 1: product detail ─────────────────────────────────────────────
    if (product_id) {
      const params = new URLSearchParams({
        engine: 'ebay_product',
        product_id,
        api_key: apiKey,
      });

      const response = await fetch(`${SERPAPI_BASE}?${params}`);
      const data = await response.json();

      if (!response.ok || data.error) {
        console.error('SerpAPI ebay_product error:', response.status, data.error);
        return res.status(response.ok ? 400 : response.status).json({
          error: data.error || 'SerpAPI request failed',
        });
      }

      return res.status(200).json(data);
    }

    // ── Mode 2: keyword sold-listings search ───────────────────────────────
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Missing required parameter: q or product_id' });
    }

    const params = new URLSearchParams({
      engine: 'ebay',
      _nkw: q.trim(),
      show_only: 'Complete,Sold', // SerpAPI eBay engine filter for completed + sold items
      _sop: '13',                 // sort: most recently ended first
      _ipg: sanitizePageSize(num),
      api_key: apiKey,
    });

    const response = await fetch(`${SERPAPI_BASE}?${params}`);
    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('SerpAPI ebay search error:', response.status, data.error);
      return res.status(response.ok ? 400 : response.status).json({
        error: data.error || 'SerpAPI request failed',
      });
    }

    // Normalise the organic_results array from the eBay SERP engine
    const raw = data.organic_results || [];
    const results = raw.map((item) => {
      // Price can be a flat value or a from/to range
      const price =
        item.price?.extracted ??
        item.price?.from?.extracted ??
        null;
      const originalPrice =
        item.price?.to?.extracted ?? null;

      return {
        product_id: item.product_id || null,
        title: item.title || '',
        price,
        priceRaw: item.price?.raw || item.price?.from?.raw || null,
        originalPrice,
        imageUrl: item.thumbnail || null,
        condition: item.condition || null,
        seller: item.seller?.username || null,
        sellerFeedback: item.seller?.positive_feedback_in_percentage || null,
        sellerReviews: item.seller?.reviews || null,
        shippingRaw: typeof item.shipping === 'string' ? item.shipping : null,
        isFreeShipping: typeof item.shipping === 'string'
          ? item.shipping.toLowerCase().includes('free')
          : false,
        returns: typeof item.returns === 'string' ? item.returns : null,
        watchers: item.extracted_watchers || null,
        watchersRaw: item.watchers || null,
        quantitySold: item.extracted_quantity_sold || null,
        quantitySoldRaw: item.quantity_sold || null,
        promotion: item.promotion || null,
        topRated: item.top_rated || false,
        productUrl: item.link || (item.product_id ? `https://www.ebay.com/itm/${item.product_id}` : null),
        buyingFormat: item.buying_format || null,
        extensions: item.extensions || [],
      };
    });

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
