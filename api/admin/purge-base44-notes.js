import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALLOWED_USER_ID = '82bdb1aa-b2d2-4001-80ef-1196e5563cb9';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req);
  if (!userId || userId !== ALLOWED_USER_ID) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const dryRun = req.body?.dryRun !== false; // default to dry run for safety

  try {
    const stats = { scanned: 0, matched: 0, cleared: 0, errors: 0 };
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data: rows, error } = await supabase
        .from('sales')
        .select('id, notes')
        .eq('user_id', userId)
        .not('notes', 'is', null)
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (!rows || rows.length === 0) break;

      stats.scanned += rows.length;

      // Find rows where notes contain "base44" (case-insensitive)
      const toUpdate = rows.filter(r => r.notes && /base44/i.test(r.notes));
      stats.matched += toUpdate.length;

      if (!dryRun && toUpdate.length > 0) {
        // For each matched row, strip the Base44 lines from the notes.
        // If the entire note is just Base44 references, set to null.
        for (const row of toUpdate) {
          const cleaned = row.notes
            .split('\n')
            .filter(line => !/base44/i.test(line))
            .join('\n')
            .trim();

          const newNotes = cleaned || null;

          const { error: updateErr } = await supabase
            .from('sales')
            .update({ notes: newNotes })
            .eq('id', row.id)
            .eq('user_id', userId);

          if (updateErr) {
            console.error(`Failed to update sale ${row.id}:`, updateErr.message);
            stats.errors++;
          } else {
            stats.cleared++;
          }
        }
      }

      if (rows.length < pageSize) break;
      offset += rows.length;
    }

    // Also do inventory items
    const invStats = { scanned: 0, matched: 0, cleared: 0, errors: 0 };
    offset = 0;

    while (true) {
      const { data: rows, error } = await supabase
        .from('inventory_items')
        .select('id, notes')
        .eq('user_id', userId)
        .not('notes', 'is', null)
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (!rows || rows.length === 0) break;

      invStats.scanned += rows.length;

      const toUpdate = rows.filter(r => r.notes && /base44/i.test(r.notes));
      invStats.matched += toUpdate.length;

      if (!dryRun && toUpdate.length > 0) {
        for (const row of toUpdate) {
          const cleaned = row.notes
            .split('\n')
            .filter(line => !/base44/i.test(line))
            .join('\n')
            .trim();

          const newNotes = cleaned || null;

          const { error: updateErr } = await supabase
            .from('inventory_items')
            .update({ notes: newNotes })
            .eq('id', row.id)
            .eq('user_id', userId);

          if (updateErr) {
            console.error(`Failed to update inventory ${row.id}:`, updateErr.message);
            invStats.errors++;
          } else {
            invStats.cleared++;
          }
        }
      }

      if (rows.length < pageSize) break;
      offset += rows.length;
    }

    return res.status(200).json({
      dryRun,
      sales: stats,
      inventory: invStats,
      message: dryRun
        ? `Dry run complete. Found ${stats.matched} sales and ${invStats.matched} inventory items with Base44 notes. Run with dryRun: false to purge.`
        : `Purged Base44 notes from ${stats.cleared} sales and ${invStats.cleared} inventory items.`,
    });
  } catch (err) {
    console.error('purge-base44-notes error:', err);
    return res.status(500).json({ error: err.message });
  }
}
