/**
 * Marketplace Listings API
 * CRUD for the marketplace_listings table — tracks which inventory items
 * are listed on which marketplaces with their platform-specific IDs.
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // GET — list marketplace listings for a user (optionally filtered by inventory_item_id)
    if (req.method === 'GET') {
      const { inventory_item_id, marketplace } = req.query || {};

      let query = supabase
        .from('marketplace_listings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (inventory_item_id) query = query.eq('inventory_item_id', inventory_item_id);
      if (marketplace) query = query.eq('marketplace', marketplace);

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    // POST — upsert a marketplace listing
    if (req.method === 'POST') {
      const {
        inventory_item_id,
        marketplace,
        marketplace_listing_id,
        marketplace_listing_url,
        status = 'active',
        listed_at,
        metadata,
      } = req.body;

      if (!inventory_item_id || !marketplace) {
        return res.status(400).json({ error: 'inventory_item_id and marketplace are required' });
      }

      const { data, error } = await supabase
        .from('marketplace_listings')
        .upsert(
          {
            user_id: userId,
            inventory_item_id,
            marketplace,
            marketplace_listing_id: marketplace_listing_id || null,
            marketplace_listing_url: marketplace_listing_url || null,
            status,
            listed_at: listed_at || new Date().toISOString(),
            metadata: metadata || {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'inventory_item_id,marketplace' }
        )
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    }

    // PUT — update status or metadata of an existing listing
    if (req.method === 'PUT') {
      const { id, inventory_item_id, marketplace, ...updates } = req.body;

      // Allow lookup by id OR by (inventory_item_id + marketplace)
      let query = supabase.from('marketplace_listings').update({
        ...updates,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);

      if (id) {
        query = query.eq('id', id);
      } else if (inventory_item_id && marketplace) {
        query = query.eq('inventory_item_id', inventory_item_id).eq('marketplace', marketplace);
      } else {
        return res.status(400).json({ error: 'id or (inventory_item_id + marketplace) required' });
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    // DELETE — remove a marketplace listing record
    if (req.method === 'DELETE') {
      const { id, inventory_item_id, marketplace } = req.query || {};

      let query = supabase.from('marketplace_listings').delete().eq('user_id', userId);

      if (id) {
        query = query.eq('id', id);
      } else if (inventory_item_id && marketplace) {
        query = query.eq('inventory_item_id', inventory_item_id).eq('marketplace', marketplace);
      } else {
        return res.status(400).json({ error: 'id or (inventory_item_id + marketplace) required' });
      }

      const { error } = await query;
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Marketplace listings API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
