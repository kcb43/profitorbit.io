/**
 * GET /api/reports/analytics-pdf?range=lifetime|90d|180d|365d&from=YYYY-MM-DD&to=YYYY-MM-DD&token=...
 *
 * Returns a self-contained, print-optimised HTML page with:
 *   - Summary KPI cards
 *   - Platform performance table
 *   - Category breakdown table
 *   - Monthly trend table (last 12 months)
 *   - Insights callouts
 *
 * Open in a browser tab and use Ctrl-P / ⌘-P to save as PDF.
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseRange(range) {
  const r = String(range || 'lifetime').toLowerCase();
  if (r === '90d')  return { kind: 'days', days: 90,  label: 'Last 90 Days' };
  if (r === '180d') return { kind: 'days', days: 180, label: 'Last 180 Days' };
  if (r === '365d') return { kind: 'days', days: 365, label: 'Last 12 Months' };
  return { kind: 'lifetime', label: 'All Time' };
}

function isoDate(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

function monthKey(isoDateStr) { return String(isoDateStr || '').slice(0, 7); }

function fmt$( n ) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0); }
function fmtPct( n ) { return `${Number(n || 0).toFixed(1)}%`; }
function fmtNum( n ) { return new Intl.NumberFormat('en-US').format(n || 0); }
function fmtMo( mk ) {
  try {
    const [y, m] = mk.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
  } catch { return mk; }
}
function platformLabel(k) {
  const MAP = { ebay: 'eBay', mercari: 'Mercari', facebook_marketplace: 'Facebook', poshmark: 'Poshmark', etsy: 'Etsy', amazon: 'Amazon', offerup: 'OfferUp', offer_up: 'OfferUp', depop: 'Depop' };
  return MAP[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ') : 'Other');
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchAnalytics(userId, range, fromOverride, toOverride) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  let fromIso = null;
  let toIso = toOverride || null;

  if (fromOverride) {
    fromIso = fromOverride;
  } else if (range.kind === 'days') {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - (range.days - 1));
    fromIso = isoDate(start);
  }

  const totals = { salesCount: 0, totalProfit: 0, totalRevenue: 0, totalFees: 0, totalShipping: 0, totalCost: 0 };
  const byMonth    = new Map();
  const byCategory = new Map();
  const byPlatform = new Map();
  let saleSpeedCount = 0, saleSpeedTotal = 0;
  let highestProfitSale = null, fastestSale = null;

  const pageSize = 1000;
  let offset = 0;

  while (true) {
    let q = supabase
      .from('sales')
      .select('id,item_name,purchase_date,sale_date,platform,category,profit,selling_price,sale_price,purchase_price,shipping_cost,platform_fees,other_costs')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sale_date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (fromIso) q = q.gte('sale_date', fromIso);
    if (toIso)   q = q.lte('sale_date', toIso);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) break;

    for (const r of rows) {
      const saleDate = r?.sale_date ? String(r.sale_date) : null;
      if (!saleDate) continue;

      const profit     = Number(r.profit           || 0) || 0;
      const revenue    = Number(r.selling_price ?? r.sale_price ?? 0) || 0;
      const cost       = Number(r.purchase_price   || 0) || 0;
      const shipping   = Number(r.shipping_cost    || 0) || 0;
      const fees       = Number(r.platform_fees    || 0) || 0;
      const category   = (r.category && String(r.category).trim()) ? String(r.category) : 'Uncategorized';
      const platform   = r.platform ? String(r.platform) : 'other';

      totals.salesCount  += 1;
      totals.totalProfit += profit;
      totals.totalRevenue+= revenue;
      totals.totalFees   += fees;
      totals.totalShipping += shipping;
      totals.totalCost   += cost;

      // Sale speed
      if (r.purchase_date) {
        try {
          const pd = new Date(String(r.purchase_date));
          const sd = new Date(String(saleDate));
          if (!isNaN(pd) && !isNaN(sd)) {
            const days = Math.max(0, Math.round((sd - pd) / 86400000));
            saleSpeedCount++;
            saleSpeedTotal += days;
            if (!fastestSale || days < fastestSale.days)
              fastestSale = { name: r.item_name, days, date: saleDate };
          }
        } catch {}
      }
      if (!highestProfitSale || profit > highestProfitSale.profit)
        highestProfitSale = { name: r.item_name, profit, date: saleDate };

      // Monthly
      const mk = monthKey(saleDate);
      if (mk) {
        const e = byMonth.get(mk) || { mk, revenue: 0, profit: 0, fees: 0, count: 0 };
        e.revenue += revenue; e.profit += profit; e.fees += fees; e.count++;
        byMonth.set(mk, e);
      }

      // Category
      const cat = byCategory.get(category) || { name: category, count: 0, revenue: 0, profit: 0 };
      cat.count++; cat.revenue += revenue; cat.profit += profit;
      byCategory.set(category, cat);

      // Platform
      const plat = byPlatform.get(platform) || { key: platform, count: 0, revenue: 0, profit: 0, fees: 0, shipping: 0 };
      plat.count++; plat.revenue += revenue; plat.profit += profit; plat.fees += fees; plat.shipping += shipping;
      byPlatform.set(platform, plat);
    }

    offset += rows.length;
    if (rows.length < pageSize) break;
  }

  const avgProfit    = totals.salesCount ? totals.totalProfit / totals.salesCount : 0;
  const profitMargin = totals.totalRevenue ? (totals.totalProfit / totals.totalRevenue) * 100 : 0;
  const avgSaleSpeed = saleSpeedCount ? saleSpeedTotal / saleSpeedCount : 0;

  const series = Array.from(byMonth.values())
    .sort((a, b) => a.mk > b.mk ? 1 : -1)
    .slice(-12);

  const platforms = Array.from(byPlatform.values())
    .sort((a, b) => b.profit - a.profit);

  const categories = Array.from(byCategory.values())
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 12);

  return {
    totals: { ...totals, avgProfit, profitMargin, avgSaleSpeed },
    series,
    platforms,
    categories,
    insights: { highestProfitSale, fastestSale },
  };
}

// ─── HTML template ────────────────────────────────────────────────────────────

function buildHtml({ data, rangeLabel, generatedAt, from, to }) {
  const { totals, series, platforms, categories, insights } = data;

  const dateRangeStr = from && to
    ? `${from} → ${to}`
    : from
    ? `From ${from}`
    : rangeLabel;

  const kpis = [
    { label: 'Total Revenue',   value: fmt$(totals.totalRevenue),   sub: `${fmtNum(totals.salesCount)} sales` },
    { label: 'Net Profit',      value: fmt$(totals.totalProfit),    sub: `Margin ${fmtPct(totals.profitMargin)}` },
    { label: 'Avg Per Sale',    value: fmt$(totals.avgProfit),      sub: 'avg net profit / sale' },
    { label: 'Platform Fees',   value: fmt$(totals.totalFees),      sub: `${totals.totalRevenue ? fmtPct(totals.totalFees / totals.totalRevenue * 100) : '—'} of revenue` },
    { label: 'Shipping Costs',  value: fmt$(totals.totalShipping),  sub: `${totals.totalRevenue ? fmtPct(totals.totalShipping / totals.totalRevenue * 100) : '—'} of revenue` },
    { label: 'Avg Days to Sell',value: totals.avgSaleSpeed ? `${Math.round(totals.avgSaleSpeed)}d` : '—', sub: 'from purchase to sale' },
  ];

  const kpiHtml = kpis.map(k => `
    <div class="kpi">
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>`).join('');

  const platformRows = platforms.map((p, i) => {
    const margin = p.revenue ? (p.profit / p.revenue * 100) : 0;
    const pctOfTotal = totals.totalRevenue ? (p.revenue / totals.totalRevenue * 100) : 0;
    const barW = Math.min(100, pctOfTotal).toFixed(1);
    return `
    <tr>
      <td><strong>${platformLabel(p.key)}</strong></td>
      <td class="num">${fmtNum(p.count)}</td>
      <td class="num">${fmt$(p.revenue)}</td>
      <td class="num">${fmt$(p.fees)}</td>
      <td class="num">${fmt$(p.profit)}</td>
      <td class="num">${fmtPct(margin)}</td>
      <td style="min-width:90px">
        <div class="bar-bg"><div class="bar-fill" style="width:${barW}%"></div></div>
        <span class="bar-pct">${fmtPct(pctOfTotal)}</span>
      </td>
    </tr>`;
  }).join('');

  const categoryRows = categories.map((c) => {
    const margin = c.revenue ? (c.profit / c.revenue * 100) : 0;
    const pctOfProfit = totals.totalProfit > 0 ? (c.profit / totals.totalProfit * 100) : 0;
    return `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td class="num">${fmtNum(c.count)}</td>
      <td class="num">${fmt$(c.revenue)}</td>
      <td class="num">${fmt$(c.profit)}</td>
      <td class="num">${fmtPct(margin)}</td>
      <td class="num">${fmtPct(pctOfProfit)}</td>
    </tr>`;
  }).join('');

  const monthlyRows = series.map((m) => {
    const margin = m.revenue ? (m.profit / m.revenue * 100) : 0;
    return `
    <tr>
      <td><strong>${fmtMo(m.mk)}</strong></td>
      <td class="num">${fmtNum(m.count)}</td>
      <td class="num">${fmt$(m.revenue)}</td>
      <td class="num">${fmt$(m.fees)}</td>
      <td class="num">${fmt$(m.profit)}</td>
      <td class="num">${fmtPct(margin)}</td>
    </tr>`;
  }).join('');

  const insightCards = [
    insights.highestProfitSale && { emoji: '🏆', title: 'Best Flip', body: `${insights.highestProfitSale.name || 'Unknown'}`, sub: `${fmt$(insights.highestProfitSale.profit)} profit · ${insights.highestProfitSale.date || ''}` },
    insights.fastestSale      && { emoji: '⚡', title: 'Fastest Sale', body: `${insights.fastestSale.name || 'Unknown'}`, sub: `${insights.fastestSale.days} day${insights.fastestSale.days !== 1 ? 's' : ''} · ${insights.fastestSale.date || ''}` },
    platforms[0]              && { emoji: '📦', title: 'Top Platform', body: platformLabel(platforms[0].key), sub: `${fmt$(platforms[0].profit)} profit · ${fmtNum(platforms[0].count)} sales` },
    categories[0]             && { emoji: '🏷️', title: 'Top Category', body: categories[0].name, sub: `${fmt$(categories[0].profit)} profit · ${fmtNum(categories[0].count)} sales` },
  ].filter(Boolean).map(c => `
    <div class="insight-card">
      <div class="insight-emoji">${c.emoji}</div>
      <div>
        <div class="insight-title">${c.title}</div>
        <div class="insight-body">${c.body}</div>
        <div class="insight-sub">${c.sub}</div>
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Orben Analytics Report · ${rangeLabel}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 12px;
    color: #0f172a;
    background: #fff;
    line-height: 1.5;
  }

  /* ── Layout ── */
  .page { max-width: 960px; margin: 0 auto; padding: 32px 24px 48px; }

  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #0ea5e9; }
  .header-left h1 { font-size: 22px; font-weight: 700; color: #0ea5e9; letter-spacing: -0.5px; }
  .header-left .subtitle { font-size: 13px; color: #64748b; margin-top: 2px; }
  .header-right { text-align: right; font-size: 11px; color: #64748b; }
  .header-right .range-badge { display: inline-block; background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; border-radius: 20px; padding: 2px 12px; font-weight: 600; font-size: 12px; margin-bottom: 4px; }

  /* ── KPI grid ── */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
  .kpi-value { font-size: 22px; font-weight: 700; color: #0ea5e9; }
  .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-top: 2px; }
  .kpi-sub   { font-size: 10px; color: #94a3b8; margin-top: 2px; }

  /* ── Sections ── */
  .section { margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #0ea5e9; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  thead tr { background: #f1f5f9; }
  th { text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #64748b; padding: 7px 10px; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f8fafc; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .bar-bg { height: 6px; background: #e2e8f0; border-radius: 3px; margin-bottom: 2px; }
  .bar-fill { height: 6px; background: #0ea5e9; border-radius: 3px; }
  .bar-pct { font-size: 10px; color: #64748b; }

  /* ── Insights ── */
  .insights-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .insight-card { display: flex; gap: 12px; align-items: flex-start; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
  .insight-emoji { font-size: 20px; line-height: 1; flex-shrink: 0; }
  .insight-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
  .insight-body  { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
  .insight-sub   { font-size: 11px; color: #64748b; margin-top: 1px; }

  /* ── Footer ── */
  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }

  /* ── Print ── */
  @media print {
    body { font-size: 11px; }
    .page { padding: 0; max-width: 100%; }
    .no-print { display: none !important; }
    .section { page-break-inside: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    .kpi-grid { page-break-inside: avoid; }
    .insights-grid { page-break-inside: avoid; }
    @page { margin: 16mm 14mm; size: A4 portrait; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>Orben Analytics Report</h1>
      <div class="subtitle">${dateRangeStr}</div>
    </div>
    <div class="header-right">
      <div class="range-badge">${rangeLabel}</div>
      <div>Generated ${generatedAt}</div>
      <div style="margin-top:6px" class="no-print">
        <button onclick="window.print()" style="background:#0ea5e9;color:#fff;border:none;border-radius:6px;padding:5px 14px;font-size:11px;cursor:pointer;font-weight:600;">⬇ Save as PDF</button>
      </div>
    </div>
  </div>

  <!-- KPI Summary -->
  <div class="section">
    <div class="section-title">Performance Summary</div>
    <div class="kpi-grid">${kpiHtml}</div>
  </div>

  <!-- Platform Performance -->
  ${platforms.length ? `
  <div class="section">
    <div class="section-title">Platform Performance</div>
    <table>
      <thead><tr>
        <th>Platform</th><th class="num">Sales</th><th class="num">Revenue</th><th class="num">Fees</th><th class="num">Net Profit</th><th class="num">Margin</th><th>Share</th>
      </tr></thead>
      <tbody>${platformRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Category Breakdown -->
  ${categories.length ? `
  <div class="section">
    <div class="section-title">Category Breakdown</div>
    <table>
      <thead><tr>
        <th>Category</th><th class="num">Sales</th><th class="num">Revenue</th><th class="num">Net Profit</th><th class="num">Margin</th><th class="num">% of Profit</th>
      </tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Monthly Trend -->
  ${series.length ? `
  <div class="section">
    <div class="section-title">Monthly Trend (Last 12 Months)</div>
    <table>
      <thead><tr>
        <th>Month</th><th class="num">Sales</th><th class="num">Revenue</th><th class="num">Fees</th><th class="num">Net Profit</th><th class="num">Margin</th>
      </tr></thead>
      <tbody>${monthlyRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Insights -->
  ${insightCards ? `
  <div class="section">
    <div class="section-title">Highlights</div>
    <div class="insights-grid">${insightCards}</div>
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <span>Orben · orben.io</span>
    <span>This report is confidential. Generated ${generatedAt}</span>
  </div>

</div>
<script>
  // Auto-print when opened directly (not in iframe)
  if (window.self === window.top) {
    window.addEventListener('load', () => setTimeout(() => window.print(), 600));
  }
</script>
</body>
</html>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).send('<h1>401 – Authentication required</h1><p>Open this URL from within Orben.</p>');

  const range       = parseRange(req.query.range);
  const fromOverride = req.query.from || null;
  const toOverride   = req.query.to   || null;

  let data;
  try {
    data = await fetchAnalytics(userId, range, fromOverride, toOverride);
  } catch (err) {
    return res.status(500).send(`<h1>Error generating report</h1><pre>${err.message}</pre>`);
  }

  const generatedAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const html = buildHtml({ data, rangeLabel: range.label, generatedAt, from: fromOverride, to: toOverride });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="orben-analytics-${range.kind === 'days' ? range.days + 'd' : 'lifetime'}.html"`);
  return res.status(200).send(html);
}
