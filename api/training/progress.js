/**
 * GET  /api/training/progress?slug=ship-efficiently
 * POST /api/training/progress
 *      body: { playbookSlug, completedStepIds: string[], totalSteps: number }
 *
 * Manages playbook step completion for authenticated users.
 */

import { createClient } from '@supabase/supabase-js';

async function resolveUser(req, supabase) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
}

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const user = await resolveUser(req, supabase);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // ─── GET — fetch progress for one or all playbooks ───────────────────
  if (req.method === 'GET') {
    const { slug } = req.query;
    let query = supabase
      .from('playbook_progress')
      .select('*')
      .eq('user_id', user.id);
    if (slug) query = query.eq('playbook_slug', slug);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  // ─── POST — upsert progress ───────────────────────────────────────────
  if (req.method === 'POST') {
    const { playbookSlug, completedStepIds, totalSteps } = req.body || {};
    if (!playbookSlug || !Array.isArray(completedStepIds)) {
      return res.status(400).json({ error: 'Missing playbookSlug or completedStepIds' });
    }

    const isCompleted = typeof totalSteps === 'number' && completedStepIds.length >= totalSteps;

    const { error } = await supabase
      .from('playbook_progress')
      .upsert(
        {
          user_id: user.id,
          playbook_slug: playbookSlug,
          completed_step_ids: completedStepIds,
          completed_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,playbook_slug' }
      );

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
