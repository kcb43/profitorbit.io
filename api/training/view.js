/**
 * POST /api/training/view
 * Record a guide view (for analytics).
 * Accepts: { slug }
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.body || {};
  if (!slug) {
    return res.status(400).json({ error: 'Missing slug' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Resolve optional user
  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id || null;
  }

  try {
    await supabase.from('guide_views').insert({ slug, user_id: userId });
    return res.status(200).json({ success: true });
  } catch (err) {
    // Non-critical — don't fail the page load
    console.error('[training/view]', err);
    return res.status(200).json({ success: false });
  }
}
