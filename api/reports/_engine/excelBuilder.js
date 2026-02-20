/**
 * Excel Workbook Builder (ExcelJS)
 * Generates a formatted .xlsx workbook from a report definition + data.
 */

import ExcelJS from 'exceljs';

// ─── Formatters ───────────────────────────────────────────────────────────────

const PLATFORM_NAMES = {
  ebay: 'eBay',
  facebook_marketplace: 'Facebook',
  mercari: 'Mercari',
  poshmark: 'Poshmark',
  etsy: 'Etsy',
  offer_up: 'OfferUp',
};

function formatCellValue(value, format) {
  if (value === null || value === undefined) return '';
  switch (format) {
    case 'currency':
      return typeof value === 'number' ? value : Number(value) || 0;
    case 'number':
      return typeof value === 'number' ? value : Number(value) || 0;
    case 'percent':
      return typeof value === 'number' ? value / 100 : (Number(value) || 0) / 100;
    case 'date':
      return value ? new Date(String(value)) : '';
    case 'text':
    default: {
      // Prettify platform names
      if (PLATFORM_NAMES[String(value)]) return PLATFORM_NAMES[String(value)];
      return String(value);
    }
  }
}

function getExcelNumFmt(format) {
  switch (format) {
    case 'currency': return '"$"#,##0.00';
    case 'percent':  return '0.00%';
    case 'number':   return '#,##0';
    case 'date':     return 'yyyy-mm-dd';
    default:         return '@';
  }
}

function filterSummaryText(reportDef, filters) {
  const parts = [];
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom || 'All time';
    const to   = filters.dateTo   || 'today';
    parts.push(`Date: ${from} → ${to}`);
  }
  if (filters.marketplace) {
    parts.push(`Platform: ${PLATFORM_NAMES[filters.marketplace] || filters.marketplace}`);
  }
  if (filters.ageBucket) {
    parts.push(`Age: ${filters.ageBucket} days`);
  }
  if (filters.status) {
    parts.push(`Status: ${filters.status}`);
  }
  return parts.length > 0 ? parts.join(' | ') : 'All data (no filters applied)';
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build an Excel workbook buffer.
 * @param {object} reportDef - The report definition object
 * @param {object} filters   - The filters used for this run
 * @param {Array}  rows      - The data rows
 * @param {object} metrics   - Computed metrics
 * @returns {Promise<Buffer>} - xlsx buffer
 */
export async function buildWorkbook(reportDef, filters, rows, metrics) {
  const workbook  = new ExcelJS.Workbook();
  workbook.creator = 'Orben / ProfitOrbit';
  workbook.created  = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Report', {
    views: [{ state: 'frozen', ySplit: 4 }],
    properties: { tabColor: { argb: 'FF2ECC71' } },
  });

  const cols  = reportDef.columns;
  const colCount = cols.length;

  // ─── Col widths (initial) ────────────────────────────────────────────────
  sheet.columns = cols.map((col) => ({
    key: col.key,
    width: Math.max(col.label.length + 4, 14),
  }));

  // ─── Row 1: Title + generated date ───────────────────────────────────────
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value    = reportDef.title;
  titleRow.getCell(colCount).value = `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;

  titleRow.getCell(1).font    = { bold: true, size: 14, color: { argb: 'FF1A1A1A' } };
  titleRow.getCell(colCount).font  = { size: 10, color: { argb: 'FF888888' } };
  titleRow.getCell(colCount).alignment = { horizontal: 'right' };
  titleRow.height = 22;

  // Merge title across first 3 cols
  if (colCount > 2) {
    sheet.mergeCells(1, 1, 1, Math.max(3, Math.floor(colCount / 2)));
  }

  // ─── Row 2: Filter summary ───────────────────────────────────────────────
  const filterRow = sheet.getRow(2);
  const filterText = filterSummaryText(reportDef, filters);
  filterRow.getCell(1).value = filterText;
  filterRow.getCell(1).font  = { italic: true, size: 10, color: { argb: 'FF666666' } };
  if (colCount > 1) {
    sheet.mergeCells(2, 1, 2, colCount);
  }
  filterRow.height = 16;

  // Row 3 spacer
  sheet.getRow(3).height = 8;

  // ─── Row 4: Column headers ───────────────────────────────────────────────
  const headerRow = sheet.getRow(4);
  cols.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.font  = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    cell.alignment = {
      horizontal: ['currency', 'number', 'percent'].includes(col.format) ? 'right' : 'left',
      vertical: 'middle',
    };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF2ECC71' } } };
  });
  headerRow.height = 24;

  // ─── Data rows ───────────────────────────────────────────────────────────
  const totalMap = {};  // track column totals for totals row
  cols.forEach((c) => {
    if (['currency', 'number'].includes(c.format)) totalMap[c.key] = 0;
  });

  rows.forEach((rowData, rowIndex) => {
    const dataRow = sheet.addRow(cols.map((col) => formatCellValue(rowData[col.key], col.format)));

    // Alternate row shading
    const fillColor = rowIndex % 2 === 0 ? 'FFF9F9F9' : 'FFFFFFFF';

    dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const col = cols[colNum - 1];
      if (!col) return;

      cell.numFmt = getExcelNumFmt(col.format);
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      cell.alignment = {
        horizontal: ['currency', 'number', 'percent'].includes(col.format) ? 'right' : 'left',
        vertical: 'middle',
        wrapText: col.key === 'item_name',
      };
    });

    dataRow.height = 18;

    // Accumulate totals
    cols.forEach((col) => {
      if (col.key in totalMap && typeof rowData[col.key] === 'number') {
        totalMap[col.key] += rowData[col.key];
      }
    });
  });

  // ─── Totals row ──────────────────────────────────────────────────────────
  if (rows.length > 0) {
    const totalsRow = sheet.addRow(
      cols.map((col, i) => {
        if (i === 0) return `TOTAL (${rows.length} rows)`;
        if (col.key in totalMap) return formatCellValue(totalMap[col.key], col.format);
        return '';
      })
    );

    totalsRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const col = cols[colNum - 1];
      cell.font = { bold: true, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
      cell.border = { top: { style: 'medium', color: { argb: 'FF2ECC71' } } };
      if (col) {
        cell.numFmt    = getExcelNumFmt(col.format);
        cell.alignment = { horizontal: ['currency', 'number', 'percent'].includes(col.format) ? 'right' : 'left' };
      }
    });
    totalsRow.height = 22;
  }

  // ─── Metrics sheet ───────────────────────────────────────────────────────
  if (metrics && Object.keys(metrics).length > 0) {
    const metSheet = workbook.addWorksheet('Metrics');
    metSheet.columns = [
      { key: 'label', width: 30 },
      { key: 'value', width: 20 },
    ];

    const metHeader = metSheet.addRow(['Metric', 'Value']);
    metHeader.font  = { bold: true };
    metHeader.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    metHeader.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    metHeader.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const metDef = reportDef.metricsDefinition || [];
    metDef.forEach((m) => {
      const raw = metrics[m.key];
      if (raw === undefined) return;
      const row = metSheet.addRow([m.label, raw]);
      row.getCell(2).numFmt = getExcelNumFmt(m.format);
    });
  }

  // ─── Auto-size columns (bounded) ─────────────────────────────────────────
  sheet.columns.forEach((col, i) => {
    const colDef = cols[i];
    if (!colDef) return;
    const maxWidth = Math.min(50, Math.max(col.width || 14, colDef.label.length + 4));
    col.width = maxWidth;
  });

  return workbook.xlsx.writeBuffer();
}
