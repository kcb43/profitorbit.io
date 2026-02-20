/**
 * POST /api/reports/run
 * Create and immediately execute a report run.
 * Returns: { runId, status, preview, metrics, rowCount }
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';
import { runReport } from './_engine/runner.js';
import { getReportDefinition } from './_engine/registry.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { reportId, filters = {}, exportOptions = {} } = req.body || {};

  if (!reportId) return res.status(400).json({ error: 'reportId is required' });
  if (!getReportDefinition(reportId)) {
    return res.status(400).json({ error: `Unknown report: ${reportId}` });
  }

  try {
    const { run, metrics, rowCount, preview } = await runReport(supabase, userId, reportId, filters, exportOptions);

    return res.status(200).json({
      runId:    run.id,
      status:   run.status,
      rowCount,
      preview,
      metrics,
    });
  } catch (err) {
    console.error('[reports/run]', err);
    return res.status(500).json({ error: err.message });
  }
}
