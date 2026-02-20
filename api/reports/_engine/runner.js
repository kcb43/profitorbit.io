/**
 * Report Runner
 * Executes a report definition: fetches rows, computes metrics, stores result.
 */

import { getReportDefinition } from './registry.js';

const PREVIEW_ROWS = 50;
const MAX_ROWS     = 10000;

/**
 * Execute a report and return { rows, metrics, rowCount }.
 * Does NOT touch the DB for run tracking — caller handles that.
 */
export async function executeReport(supabase, userId, reportId, filters, { limit = MAX_ROWS } = {}) {
  const def = getReportDefinition(reportId);
  if (!def) throw new Error(`Unknown report: ${reportId}`);

  const rows    = await def.fetchRows(supabase, userId, filters, { limit });
  const metrics = def.computeMetrics(rows);

  return {
    rows,
    metrics,
    rowCount: rows.length,
    preview:  rows.slice(0, PREVIEW_ROWS),
  };
}

/**
 * Full pipeline: create a report_run, execute, persist results.
 * Returns the completed report_run row.
 */
export async function runReport(supabase, userId, reportId, filters, exportOptions = {}) {
  const def = getReportDefinition(reportId);
  if (!def) throw new Error(`Unknown report: ${reportId}`);

  // Create the run record
  const { data: runRow, error: createErr } = await supabase
    .from('report_runs')
    .insert({
      user_id:        userId,
      report_id:      reportId,
      filters:        filters || {},
      export_options: exportOptions,
      status:         'running',
      progress:       5,
      started_at:     new Date().toISOString(),
    })
    .select()
    .single();

  if (createErr) throw new Error(`Failed to create run: ${createErr.message}`);

  const runId = runRow.id;

  try {
    const { rows, metrics, rowCount, preview } = await executeReport(supabase, userId, reportId, filters);

    // Mark complete
    const { data: updated, error: updateErr } = await supabase
      .from('report_runs')
      .update({
        status:         'completed',
        progress:       100,
        row_count:      rowCount,
        result_preview: preview,
        metrics,
        completed_at:   new Date().toISOString(),
      })
      .eq('id', runId)
      .select()
      .single();

    if (updateErr) throw new Error(`Failed to update run: ${updateErr.message}`);

    return { run: updated, rows, metrics, rowCount, preview };
  } catch (err) {
    // Mark failed
    await supabase
      .from('report_runs')
      .update({ status: 'failed', error: err.message })
      .eq('id', runId);

    throw err;
  }
}
