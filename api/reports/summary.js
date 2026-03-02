import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function parseRange(range) {
  const r = String(range || 'lifetime').toLowerCase();
  if (r === '90d') return { kind: 'days', days: 90 };
  if (r === '180d') return { kind: 'days', days: 180 };
  if (r === '365d' || r === '12m') return { kind: 'days', days: 365 };
  return { kind: 'lifetime' };
}

function startOfDayIso(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

function monthKey(isoDate) {
  return String(isoDate || '').slice(0, 7);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'User ID required' });

  const range = parseRange(req.query.range);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const taxYear = req.query.taxYear ? Number(req.query.taxYear) : now.getFullYear();
  const yearStart = new Date(taxYear, 0, 1);
  const yearStartIso = startOfDayIso(yearStart);
  const yearEndIso = startOfDayIso(new Date(taxYear + 1, 0, 1));

  let fromIso = null;
  let currentStart = null;
  let previousStart = null;

  if (range.kind === 'days') {
    currentStart = new Date(todayStart);
    currentStart.setDate(currentStart.getDate() - (range.days - 1));
    previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - range.days);
    fromIso = startOfDayIso(previousStart);
  } else {
    // Lifetime: we still only need to compute 12-month series + top lists, but totals should be lifetime.
    fromIso = null;
  }

  // Aggregate containers
  const totals = { salesCount: 0, totalProfit: 0, totalRevenue: 0 };
  const current = { salesCount: 0, totalProfit: 0, totalRevenue: 0, avgProfit: 0 };
  const previous = { salesCount: 0, totalProfit: 0, totalRevenue: 0, avgProfit: 0 };
  let saleSpeedCount = 0;
  let saleSpeedTotalDays = 0;

  let ytdProfit = 0;

  const byMonth = new Map(); // monthKey -> {monthKey, monthLabel, revenue, costs, profit}
  const byCategory = new Map(); // category -> {name, sales, revenue, profit}
  const byPlatform = new Map(); // platform -> {platformKey, sales, revenue, profit}

  let highestProfitSale = null;
  let fastestSale = null;

  const pageSize = 1000;
  let offset = 0;
  let fetched = 0;
  const maxRows = 250000; // hard safety

  while (true) {
    if (offset >= maxRows) break;

    let q = supabase
      .from('sales')
      .select('id,item_name,purchase_date,sale_date,platform,category,profit,selling_price,sale_price,purchase_price,shipping_cost,platform_fees,vat_fees,other_costs,deleted_at', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sale_date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (fromIso) q = q.gte('sale_date', fromIso);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    const rows = Array.isArray(data) ? data : [];
    fetched = rows.length;
    if (!fetched) break;

    for (const r of rows) {
      const saleDate = r?.sale_date ? String(r.sale_date) : null;
      if (!saleDate) continue;

      const profit = Number(r.profit || 0) || 0;
      const sellingPrice = Number(r.selling_price ?? r.sale_price ?? 0) || 0;
      const purchasePrice = Number(r.purchase_price || 0) || 0;
      const shipping = Number(r.shipping_cost || 0) || 0;
      const fees = Number(r.platform_fees || 0) || 0;
      const other = Number(r.other_costs || 0) || 0;
      const costs = purchasePrice + shipping + fees + other;

      const category = (r.category && String(r.category).trim()) ? String(r.category) : 'Uncategorized';
      const platform = r.platform ? String(r.platform) : 'other';

      // Lifetime totals always.
      totals.salesCount += 1;
      totals.totalProfit += profit;
      totals.totalRevenue += sellingPrice;

      // Year profit (YTD for current year, full year for past years)
      if (saleDate >= yearStartIso && saleDate < yearEndIso) ytdProfit += profit;

      // Range-window buckets
      if (range.kind === 'days') {
        if (saleDate >= startOfDayIso(currentStart)) {
          current.salesCount += 1;
          current.totalProfit += profit;
          current.totalRevenue += sellingPrice;
        } else if (saleDate >= startOfDayIso(previousStart) && saleDate < startOfDayIso(currentStart)) {
          previous.salesCount += 1;
          previous.totalProfit += profit;
          previous.totalRevenue += sellingPrice;
        }
      }

      // Sale speed
      if (r.purchase_date) {
        try {
          const pd = new Date(String(r.purchase_date));
          const sd = new Date(String(saleDate));
          if (!Number.isNaN(pd.getTime()) && !Number.isNaN(sd.getTime())) {
            const days = Math.max(0, Math.round((sd - pd) / (1000 * 60 * 60 * 24)));
            saleSpeedCount += 1;
            saleSpeedTotalDays += days;
            if (!fastestSale || days < fastestSale.days) {
              fastestSale = { id: r.id, item_name: r.item_name, days, sale_date: saleDate };
            }
          }
        } catch {}
      }

      // Biggest flip
      if (!highestProfitSale || profit > highestProfitSale.profit) {
        highestProfitSale = { id: r.id, item_name: r.item_name, profit, sale_date: saleDate };
      }

      // Monthly series (keep last 12 months in response)
      const mk = monthKey(saleDate);
      if (mk) {
        const existing = byMonth.get(mk) || { monthKey: mk, revenue: 0, costs: 0, profit: 0 };
        existing.revenue += sellingPrice;
        existing.costs += costs;
        existing.profit += profit;
        byMonth.set(mk, existing);
      }

      // Category/platform
      const cat = byCategory.get(category) || { name: category, sales: 0, revenue: 0, profit: 0 };
      cat.sales += 1;
      cat.revenue += sellingPrice;
      cat.profit += profit;
      byCategory.set(category, cat);

      const plat = byPlatform.get(platform) || { platformKey: platform, sales: 0, revenue: 0, profit: 0, totalShippingCost: 0, totalFees: 0 };
      plat.sales += 1;
      plat.revenue += sellingPrice;
      plat.profit += profit;
      plat.totalShippingCost += shipping;
      plat.totalFees += fees;
      byPlatform.set(platform, plat);
    }

    offset += fetched;
    if (fetched < pageSize) break;
  }

  current.avgProfit = current.salesCount ? current.totalProfit / current.salesCount : 0;
  previous.avgProfit = previous.salesCount ? previous.totalProfit / previous.salesCount : 0;

  const averageSaleSpeed = saleSpeedCount ? saleSpeedTotalDays / saleSpeedCount : 0;
  const avgProfit = totals.salesCount ? totals.totalProfit / totals.salesCount : 0;
  const profitMargin = totals.totalRevenue ? (totals.totalProfit / totals.totalRevenue) * 100 : 0;

  const change = current.totalProfit - previous.totalProfit;
  const changePct = previous.totalProfit > 0 ? (change / previous.totalProfit) * 100 : null;
  const avgChange = current.avgProfit - previous.avgProfit;
  const avgChangePct = previous.avgProfit > 0 ? (avgChange / previous.avgProfit) * 100 : null;

  const platforms = Array.from(byPlatform.values())
    .map((p) => ({
      ...p,
      avgProfit: p.sales ? p.profit / p.sales : 0,
      profitMargin: p.revenue ? (p.profit / p.revenue) * 100 : 0,
      averageShippingCost: p.sales ? p.totalShippingCost / p.sales : 0,
      averageFees: p.sales ? p.totalFees / p.sales : 0,
      transactionCount: p.sales,
    }))
    .sort((a, b) => b.profit - a.profit);

  const categories = Array.from(byCategory.values())
    .sort((a, b) => b.profit - a.profit);

  const topCategories = categories.slice(0, 6).map((c) => ({
    ...c,
    percentage: totals.totalProfit > 0 ? (c.profit / totals.totalProfit) * 100 : 0,
  }));

  const series = Array.from(byMonth.values())
    .sort((a, b) => (a.monthKey > b.monthKey ? 1 : -1))
    .slice(-12)
    .map((m) => ({
      monthKey: m.monthKey,
      month: m.monthKey,
      revenue: m.revenue,
      costs: m.costs,
      profit: m.profit,
    }));

  const topPlatform = platforms.length ? platforms[0] : null;
  const topCategory = categories.length ? categories[0] : null;

  return res.status(200).json({
    range: range.kind === 'days' ? `${range.days}d` : 'lifetime',
    totals: {
      totalProfit: totals.totalProfit,
      totalRevenue: totals.totalRevenue,
      salesCount: totals.salesCount,
      avgProfit,
      profitMargin,
      averageSaleSpeed,
    },
    comparison: range.kind === 'days' ? { previousProfit: previous.totalProfit, change, changePct, currentAvg: current.avgProfit, previousAvg: previous.avgProfit, avgChange, avgChangePct } : null,
    insights: {
      topPlatform,
      topCategory,
      highestProfitSale,
      fastestSale,
    },
    series,
    categories: topCategories,
    platforms,
    ytdProfit,
    taxYear,
  });
}


