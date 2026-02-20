/**
 * POST /api/training/feedback
 * Upsert a thumbs up/down vote on a training guide.
 * Accepts: { slug, vote: 'up'|'down', comment? }
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug, vote, comment } = req.body || {};

  if (!slug || !vote || !['up', 'down'].includes(vote)) {
    return res.status(400).json({ error: 'Missing or invalid fields: slug, vote (up|down)' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Resolve user from auth header (optional — we allow anonymous feedback too)
  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id || null;
  }

  try {
    if (userId) {
      // Upsert so the user can change their vote
      const { error } = await supabase
        .from('guide_feedback')
        .upsert(
          { user_id: userId, slug, vote, comment: comment || null },
          { onConflict: 'user_id,slug' }
        );
      if (error) throw error;
    } else {
      // Anonymous — just insert (no dedup)
      const { error } = await supabase
        .from('guide_feedback')
        .insert({ user_id: null, slug, vote, comment: comment || null });
      if (error) throw error;
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[training/feedback]', err);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }
}
