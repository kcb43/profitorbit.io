import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

/**
 * Extract size information from an item title so we can compare base titles
 * without penalizing different-size variants of the same product.
 *
 * Returns { sizeValue: string|null, baseTitle: string }
 */
function extractSizeFromText(text) {
  if (!text) return { sizeValue: null, baseTitle: '' };

  let working = text.trim();
  let sizeValue = null;

  // Order matters — try most specific patterns first

  // "Size 10", "Size 10.5", "Sz 10", "US 10", "EU 42"
  const explicitSize = working.match(/\b(?:size|sz|us|eu)\s*[:\-]?\s*(\d+\.?\d*\s*[a-z]?)/i);
  if (explicitSize) {
    sizeValue = explicitSize[1].trim();
    working = working.replace(explicitSize[0], ' ');
  }

  // Waist×Inseam: "32x30", "34×32"
  if (!sizeValue) {
    const waistInseam = working.match(/\b(\d{2,}\s*[x×X]\s*\d{2,})\b/);
    if (waistInseam) {
      sizeValue = waistInseam[1].replace(/\s+/g, '');
      working = working.replace(waistInseam[0], ' ');
    }
  }

  // Letter sizes at word boundary: XS, S, M, L, XL, XXL, 2XL, 3XL, XXXL
  if (!sizeValue) {
    const letterSize = working.match(/\b(X{1,3}[SL]|XXL|2XL|3XL|4XL)\b/i);
    if (letterSize) {
      sizeValue = letterSize[1].toUpperCase();
      working = working.replace(letterSize[0], ' ');
    }
  }

  // Standalone single letter sizes — only S, M, L when surrounded by separators or end-of-string
  // e.g. "Nike Hoodie - M", "Adidas Tee (L)"
  if (!sizeValue) {
    const singleLetter = working.match(/[\s\-\(\/,]+([SML])\s*[\)\s\-\/,]*$/i);
    if (singleLetter) {
      sizeValue = singleLetter[1].toUpperCase();
      working = working.replace(singleLetter[0], ' ');
    }
  }

  // Trailing numeric shoe size: "Jordan 1 Retro 10.5", but avoid matching model numbers
  // Only match if it's a standalone number at the end
  if (!sizeValue) {
    const trailingNum = working.match(/\s(\d{1,2}\.5?)\s*$/);
    if (trailingNum) {
      const num = parseFloat(trailingNum[1]);
      // Shoe sizes are typically 4-16, avoid matching years/model numbers
      if (num >= 4 && num <= 16) {
        sizeValue = trailingNum[1];
        working = working.replace(trailingNum[0], ' ');
      }
    }
  }

  // Clean up base title
  const baseTitle = working.replace(/\s+/g, ' ').replace(/[\-\(\)\/,]+\s*$/, '').trim();

  return { sizeValue, baseTitle };
}

/**
 * Calculate word overlap similarity between two titles.
 * Filters out words ≤2 chars to avoid noise.
 */
function titleSimilarity(titleA, titleB) {
  const wordsA = new Set(titleA.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(titleB.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 0;
  const common = [...wordsA].filter(w => wordsB.has(w));
  const maxWords = Math.max(wordsA.size, wordsB.size);
  return maxWords > 0 ? (common.length / maxWords) * 100 : 0;
}

/**
 * POST /api/inventory/check-duplicates
 *
 * Size-aware inventory duplicate detection + sales duplicate detection.
 * Returns grouped results for both.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    // ── Inventory duplicates ──────────────────────────────────────────
    const { data: invItems, error: invErr } = await supabase
      .from('inventory_items')
      .select('id, item_name, purchase_price, image_url, images, status, quantity, quantity_sold, size, created_at, ebay_item_id, mercari_item_id, facebook_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (invErr) {
      console.error('Error fetching inventory:', invErr);
      return res.status(500).json({ error: 'Failed to fetch inventory' });
    }

    // Pre-compute size extraction for every item
    const sizeMap = new Map();
    for (const item of invItems) {
      sizeMap.set(item.id, extractSizeFromText(item.item_name || ''));
    }

    // Build adjacency: which items are duplicates of each other
    const SIMILARITY_THRESHOLD = 60;
    const edges = []; // [idxA, idxB]

    for (let i = 0; i < invItems.length; i++) {
      for (let j = i + 1; j < invItems.length; j++) {
        const a = invItems[i];
        const b = invItems[j];

        // 1. Marketplace ID exact match
        if (
          (a.ebay_item_id && a.ebay_item_id === b.ebay_item_id) ||
          (a.mercari_item_id && a.mercari_item_id === b.mercari_item_id) ||
          (a.facebook_item_id && a.facebook_item_id === b.facebook_item_id)
        ) {
          edges.push([i, j]);
          continue;
        }

        // 2. Size-aware title comparison
        const sizeA = sizeMap.get(a.id);
        const sizeB = sizeMap.get(b.id);

        // Both have sizes but they differ → NOT duplicates
        if (sizeA.sizeValue && sizeB.sizeValue && sizeA.sizeValue.toLowerCase() !== sizeB.sizeValue.toLowerCase()) {
          continue;
        }

        // Also check the item's `size` field if titles didn't have embedded sizes
        if (!sizeA.sizeValue && !sizeB.sizeValue && a.size && b.size && a.size.toLowerCase() !== b.size.toLowerCase()) {
          continue;
        }

        // Compare base titles
        const baseTitleA = sizeA.baseTitle || (a.item_name || '');
        const baseTitleB = sizeB.baseTitle || (b.item_name || '');
        const sim = titleSimilarity(baseTitleA, baseTitleB);

        if (sim >= SIMILARITY_THRESHOLD) {
          edges.push([i, j]);
        }
      }
    }

    // Union-Find to group connected duplicates
    const parent = invItems.map((_, i) => i);
    function find(x) { return parent[x] === x ? x : (parent[x] = find(parent[x])); }
    function union(a, b) { parent[find(a)] = find(b); }

    for (const [a, b] of edges) {
      union(a, b);
    }

    // Collect groups
    const groupsMap = new Map();
    for (let i = 0; i < invItems.length; i++) {
      const root = find(i);
      if (!groupsMap.has(root)) groupsMap.set(root, []);
      groupsMap.get(root).push(invItems[i]);
    }

    const inventoryDuplicates = [];
    for (const items of groupsMap.values()) {
      if (items.length >= 2) {
        inventoryDuplicates.push({ items });
      }
    }

    // ── Sales duplicates ──────────────────────────────────────────────
    const { data: salesItems, error: salesErr } = await supabase
      .from('sales')
      .select('id, item_name, selling_price, sale_price, sale_date, platform, image_url, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (salesErr) {
      console.error('Error fetching sales:', salesErr);
      return res.status(500).json({ error: 'Failed to fetch sales' });
    }

    // Group by normalized (name + price + date)
    const saleGroups = new Map();
    for (const sale of salesItems) {
      const name = (sale.item_name || '').toLowerCase().trim();
      const price = sale.selling_price ?? sale.sale_price ?? 0;
      const date = sale.sale_date || '';
      const key = `${name}|${Number(price).toFixed(2)}|${date}`;

      if (!saleGroups.has(key)) saleGroups.set(key, []);
      saleGroups.get(key).push(sale);
    }

    const saleDuplicates = [];
    for (const items of saleGroups.values()) {
      if (items.length >= 2) {
        saleDuplicates.push({ items });
      }
    }

    return res.status(200).json({
      success: true,
      inventoryDuplicates,
      saleDuplicates,
    });
  } catch (error) {
    console.error('Check duplicates error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
