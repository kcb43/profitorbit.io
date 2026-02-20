/**
 * GET /api/reports/runs/:id/pdf
 * Return a printable HTML page for the report run.
 * Opens in a new tab — user prints to PDF via browser print dialog.
 *
 * Query params:
 *   token          - Supabase access token (required, passed as query param for browser navigation)
 *   includeMetrics - "0" to exclude metrics section
 *   includeList    - "0" to exclude data table
 */

import { createClient } from '@supabase/supabase-js';
import { getReportDefinition } from '../../_engine/registry.js';
import { executeReport } from '../../_engine/runner.js';
import { buildPdfHtml } from '../../_engine/pdfTemplate.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: accept token as query param (needed for direct browser navigation)
  const runId = req.query.id;
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) return res.status(401).send('<p>Authentication required</p>');
  if (!runId)  return res.status(400).send('<p>Run ID required</p>');

  // Verify token and get user
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).send('<p>Invalid or expired token</p>');

  // Load run
  const { data: run, error: runErr } = await supabase
    .from('report_runs')
    .select('report_id, filters, status, result_preview, metrics')
    .eq('id', runId)
    .eq('user_id', user.id)
    .single();

  if (runErr || !run) return res.status(404).send('<p>Run not found</p>');
  if (run.status !== 'completed') return res.status(400).send('<p>Run not completed yet</p>');

  const def = getReportDefinition(run.report_id);
  if (!def) return res.status(400).send(`<p>Unknown report: ${run.report_id}</p>`);

  try {
    // For PDF, re-execute but cap at 500 rows
    const { rows, metrics } = await executeReport(supabase, user.id, run.report_id, run.filters, { limit: 500 });

    const includeMetrics = req.query.includeMetrics !== '0';
    const includeList    = req.query.includeList !== '0';

    const html = buildPdfHtml(def, run.filters, rows, metrics, { includeMetrics, includeItemList: includeList });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[reports/pdf]', err);
    return res.status(500).send(`<p>Error generating PDF: ${err.message}</p>`);
  }
}
