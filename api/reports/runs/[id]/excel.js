/**
 * GET /api/reports/runs/:id/excel
 * Generate and stream an Excel workbook for the given report run.
 * Re-executes the query using stored filters (up to 10k rows).
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../../../_utils/auth.js';
import { getReportDefinition } from '../../_engine/registry.js';
import { executeReport } from '../../_engine/runner.js';
import { buildWorkbook } from '../../_engine/excelBuilder.js';

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

  // Load the run record to get report type + filters
  const { data: run, error: runErr } = await supabase
    .from('report_runs')
    .select('report_id, filters, status')
    .eq('id', runId)
    .eq('user_id', userId)
    .single();

  if (runErr || !run) return res.status(404).json({ error: 'Run not found' });
  if (run.status !== 'completed') return res.status(400).json({ error: 'Run is not completed yet' });

  const def = getReportDefinition(run.report_id);
  if (!def) return res.status(400).json({ error: `Unknown report: ${run.report_id}` });

  try {
    // Re-execute with full row limit for Excel
    const { rows, metrics } = await executeReport(supabase, userId, run.report_id, run.filters, { limit: 50000 });

    const buffer = await buildWorkbook(def, run.filters, rows, metrics);

    const filename = `${def.id}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error('[reports/excel]', err);
    return res.status(500).json({ error: err.message });
  }
}
