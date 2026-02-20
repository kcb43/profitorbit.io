/**
 * GET /api/reports/runs/:id
 * Return the status, metrics, preview, and file URLs for a report run.
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../../_utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const runId = req.query.id;
  if (!runId) return res.status(400).json({ error: 'Run ID required' });

  const { data, error } = await supabase
    .from('report_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Run not found' });

  return res.status(200).json({
    runId:     data.id,
    reportId:  data.report_id,
    status:    data.status,
    progress:  data.progress,
    rowCount:  data.row_count,
    metrics:   data.metrics,
    preview:   data.result_preview,
    files:     data.files,
    filters:   data.filters,
    createdAt: data.created_at,
    error:     data.error,
  });
}
