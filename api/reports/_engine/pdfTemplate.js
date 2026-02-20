/**
 * PDF Template Generator
 * Returns a fully self-contained HTML string that looks great when printed.
 * The page auto-triggers window.print() on load.
 */

const PLATFORM_NAMES = {
  ebay: 'eBay',
  facebook_marketplace: 'Facebook Marketplace',
  mercari: 'Mercari',
  poshmark: 'Poshmark',
  etsy: 'Etsy',
  offer_up: 'OfferUp',
};

const PDF_MAX_ROWS = 500;

function fmt(value, format) {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
    case 'percent':
      return `${(Number(value) || 0).toFixed(1)}%`;
    case 'number':
      return new Intl.NumberFormat('en-US').format(Number(value) || 0);
    case 'date':
      return value ? String(value).slice(0, 10) : '—';
    default:
      return PLATFORM_NAMES[String(value)] || String(value);
  }
}

function filterSummaryText(filters) {
  const parts = [];
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom || 'All time';
    const to   = filters.dateTo   || 'today';
    parts.push(`${from} → ${to}`);
  }
  if (filters.marketplace) parts.push(PLATFORM_NAMES[filters.marketplace] || filters.marketplace);
  if (filters.ageBucket)   parts.push(`${filters.ageBucket} days`);
  if (filters.status)      parts.push(filters.status);
  return parts.length > 0 ? parts.join(' · ') : 'All data';
}

export function buildPdfHtml(reportDef, filters, rows, metrics, options = {}) {
  const { includeMetrics = true, includeItemList = true } = options;

  const displayRows   = rows.slice(0, PDF_MAX_ROWS);
  const wasTruncated  = rows.length > PDF_MAX_ROWS;
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const filterText    = filterSummaryText(filters);
  const metDef        = reportDef.metricsDefinition || [];

  const cols = reportDef.columns;

  // Build metrics grid HTML
  const metricsHtml = (includeMetrics && metDef.length > 0) ? `
    <div class="metrics-grid">
      ${metDef.map((m) => {
        const v = metrics?.[m.key];
        return `<div class="metric-card">
          <div class="metric-label">${m.label}</div>
          <div class="metric-value">${v !== undefined ? fmt(v, m.format) : '—'}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  // Build table HTML
  const tableHtml = includeItemList ? `
    <table>
      <thead>
        <tr>${cols.map((c) => `<th class="${['currency','number','percent'].includes(c.format) ? 'right' : ''}">${c.label}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${displayRows.map((row, i) => `
          <tr class="${i % 2 === 0 ? 'even' : ''}">
            ${cols.map((c) => `<td class="${['currency','number','percent'].includes(c.format) ? 'right' : ''}">${fmt(row[c.key], c.format)}</td>`).join('')}
          </tr>`).join('')}
      </tbody>
    </table>
    ${wasTruncated ? `<div class="truncation-note">⚠ Showing first ${PDF_MAX_ROWS} of ${rows.length} rows. Download Excel for the complete dataset.</div>` : ''}
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${reportDef.title} — Orben Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 11px;
    color: #1a1a1a;
    background: #fff;
    padding: 24px 32px;
    line-height: 1.4;
  }

  /* ─── Header ─── */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 16px;
    border-bottom: 2px solid #2ecc71;
    margin-bottom: 20px;
  }
  .brand {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #2ecc71;
    text-transform: uppercase;
  }
  .report-title {
    font-size: 22px;
    font-weight: 700;
    color: #1a1a1a;
    margin-top: 4px;
  }
  .meta {
    text-align: right;
    font-size: 10px;
    color: #888;
  }
  .meta strong { color: #444; }

  /* ─── Filter summary ─── */
  .filter-bar {
    background: #f5f5f5;
    border-left: 3px solid #2ecc71;
    padding: 8px 12px;
    margin-bottom: 20px;
    font-size: 10px;
    color: #555;
  }
  .filter-bar strong { color: #1a1a1a; }

  /* ─── Metrics grid ─── */
  .metrics-section { margin-bottom: 24px; }
  .section-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
    margin-bottom: 10px;
  }
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
  }
  .metric-card {
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 10px 12px;
    background: #fafafa;
  }
  .metric-label {
    font-size: 9px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }
  .metric-value {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a1a;
  }

  /* ─── Table ─── */
  .table-section { margin-bottom: 24px; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  thead th {
    background: #1a1a2e;
    color: #fff;
    text-align: left;
    padding: 7px 8px;
    font-weight: 600;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  thead th.right { text-align: right; }
  tbody td {
    padding: 6px 8px;
    border-bottom: 1px solid #f0f0f0;
    color: #333;
  }
  tbody td.right { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr.even td { background: #f9f9f9; }
  tbody tr:last-child td { border-bottom: none; }

  .truncation-note {
    margin-top: 8px;
    font-size: 10px;
    color: #e67e22;
    background: #fef9f0;
    border: 1px solid #f5d8b0;
    border-radius: 4px;
    padding: 6px 10px;
  }

  /* ─── Footer ─── */
  .footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e5e5e5;
    font-size: 9px;
    color: #aaa;
    display: flex;
    justify-content: space-between;
  }

  /* ─── Print button (hidden when printing) ─── */
  .print-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #2ecc71;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(46,204,113,0.4);
    z-index: 9999;
  }
  .print-btn:hover { background: #27ae60; }

  /* ─── Print media ─── */
  @media print {
    body { padding: 0; }
    .print-btn { display: none !important; }
    .header { page-break-after: avoid; }
    .metrics-grid { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    @page { margin: 15mm 12mm; size: landscape; }
  }
</style>
</head>
<body>

<button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>

<!-- Header -->
<div class="header">
  <div>
    <div class="brand">Orben · ProfitOrbit</div>
    <div class="report-title">${reportDef.title}</div>
  </div>
  <div class="meta">
    <div>Generated <strong>${generatedDate}</strong></div>
    <div style="margin-top:4px">${displayRows.length} row${displayRows.length !== 1 ? 's' : ''}${wasTruncated ? ` (truncated from ${rows.length})` : ''}</div>
  </div>
</div>

<!-- Filter summary -->
<div class="filter-bar">
  <strong>Filters:</strong> ${filterText}
</div>

${includeMetrics && metricsHtml ? `
<!-- Metrics -->
<div class="metrics-section">
  <div class="section-label">Summary Metrics</div>
  ${metricsHtml}
</div>
` : ''}

${includeItemList && tableHtml ? `
<!-- Data table -->
<div class="table-section">
  <div class="section-label">Data (${displayRows.length} rows)</div>
  ${tableHtml}
</div>
` : ''}

<!-- Footer -->
<div class="footer">
  <span>ProfitOrbit · profitorbit.io</span>
  <span>Report: ${reportDef.id} · ${filterText}</span>
</div>

<script>
  // Auto-print after a short delay so styles render
  setTimeout(() => window.print(), 600);
</script>
</body>
</html>`;
}
