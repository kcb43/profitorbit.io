import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALLOWED_USER_ID = '82bdb1aa-b2d2-4001-80ef-1196e5563cb9';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseBase44InventoryIdFromNotes(notes) {
  const s = String(notes || '');
  const m = s.match(/Base44 inventory ID:\s*([^\s]+)/i);
  return m?.[1] || null;
}

function parseBase44LinkedInventoryIdFromSaleNotes(notes) {
  const s = String(notes || '');
  const m = s.match(/Base44 linked inventory ID:\s*([^\s]+)/i);
  return m?.[1] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (userId !== ALLOWED_USER_ID) return res.status(403).json({ error: 'Forbidden' });

  // Load inventory map (id -> fields) and unique name map (item_name -> fields) for this user.
  const invRes = await supabase
    .from('inventory_items')
    .select('id,item_name,purchase_date,source,category,notes')
    .eq('user_id', userId);

  if (invRes.error) return res.status(500).json({ error: invRes.error.message });
  const inventoryRows = Array.isArray(invRes.data) ? invRes.data : [];

  const invById = new Map();
  const invByNameBuckets = new Map(); // name -> array of inv rows
  const invByBase44Id = new Map(); // base44Id -> inv row
  for (const it of inventoryRows) {
    if (it?.id) invById.set(it.id, it);
    const name = it?.item_name ? String(it.item_name).trim() : '';
    if (!name) continue;
    if (!invByNameBuckets.has(name)) invByNameBuckets.set(name, []);
    invByNameBuckets.get(name).push(it);

    const b44 = parseBase44InventoryIdFromNotes(it?.notes);
    if (b44) invByBase44Id.set(b44, it);
  }
  const invByNameUnique = new Map();
  for (const [name, rows] of invByNameBuckets.entries()) {
    // Only allow name-based backfill if unambiguous.
    if (rows.length === 1) invByNameUnique.set(name, rows[0]);
  }

  // Iterate sales in pages (safety), only active rows, and only those missing fields.
  const pageSize = 1000;
  let offset = 0;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  while (true) {
    const salesRes = await supabase
      .from('sales')
        .select('id,inventory_id,item_name,purchase_date,source,category,notes')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sale_date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (salesRes.error) return res.status(500).json({ error: salesRes.error.message });
    const salesRows = Array.isArray(salesRes.data) ? salesRes.data : [];
    if (salesRows.length === 0) break;

    scanned += salesRows.length;

    const updates = [];
    for (const s of salesRows) {
      const needsPurchase = !s.purchase_date;
      const needsSource = !s.source;
      const needsCategory = !s.category;
      if (!needsPurchase && !needsSource && !needsCategory) {
        skipped += 1;
        continue;
      }

      let inv = null;
      if (s.inventory_id && invById.has(s.inventory_id)) {
        inv = invById.get(s.inventory_id);
      } else {
        // 1) Prefer Base44 "linked inventory id" tag (best signal for imported rows)
        const b44Linked = parseBase44LinkedInventoryIdFromSaleNotes(s?.notes);
        if (b44Linked && invByBase44Id.has(b44Linked)) {
          inv = invByBase44Id.get(b44Linked);
        } else {
          // 2) Fallback: name-based match only if unambiguous
          const name = s.item_name ? String(s.item_name).trim() : '';
          if (name && invByNameUnique.has(name)) inv = invByNameUnique.get(name);
        }
      }

      if (!inv) {
        skipped += 1;
        continue;
      }

      const patch = {};
      // If this sale came from Base44 and inventory_id is missing/invalid, link it now.
      if (!s.inventory_id && inv?.id) patch.inventory_id = inv.id;
      if (needsPurchase && inv.purchase_date) patch.purchase_date = inv.purchase_date;
      if (needsSource && inv.source) patch.source = inv.source;
      if (needsCategory && inv.category) patch.category = inv.category;

      if (Object.keys(patch).length === 0) {
        skipped += 1;
        continue;
      }

      updates.push({ id: s.id, patch });
    }

    // Apply updates in small batches
    for (const batch of chunk(updates, 50)) {
      // Run updates sequentially inside batch to keep it simple + reliable
      // eslint-disable-next-line no-await-in-loop
      for (const u of batch) {
        // eslint-disable-next-line no-await-in-loop
        const up = await supabase
          .from('sales')
          .update(u.patch)
          .eq('user_id', userId)
          .eq('id', u.id);
        if (!up.error) updated += 1;
      }
    }

    if (salesRows.length < pageSize) break;
    offset += salesRows.length;
  }

  return res.status(200).json({
    ok: true,
    userId,
    scanned,
    updated,
    skipped,
  });
}


