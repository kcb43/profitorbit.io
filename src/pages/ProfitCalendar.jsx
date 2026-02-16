
import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, TrendingUp, DollarSign, ShoppingBag } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  getDaysInMonth,
  isWithinInterval
} from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom'; // Assuming react-router-dom for Link
import { format as formatDate } from 'date-fns';

// Dummy createPageUrl for compilation. In a real app, this would be a real utility.
const createPageUrl = (url) => url;

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

export default function ProfitCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedSales, setSelectedSales] = useState([]);

  // Swipe / drag-to-change-month (mouse + touch)
  const swipeRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
    captured: false,
  });
  const suppressNextDayClickRef = useRef(false);

  const calendarWindow = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return { start, end };
  }, [currentMonth]);

  async function apiGetJson(path) {
    // Wait briefly for Supabase session hydration.
    let session = null;
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await supabase.auth.getSession();
      session = res?.data?.session || null;
      if (session?.access_token) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 150));
    }

    const headers = {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(session?.user?.id ? { 'x-user-id': session.user.id } : {}),
    };

    const resp = await fetch(path, { headers });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  const salesFields = [
    'id',
    'item_name',
    'image_url',
    'purchase_date',
    'sale_date',
    'platform',
    'profit',
    'deleted_at',
    'selling_price',
    'sale_price',
    'purchase_price',
    'shipping_cost',
    'platform_fees',
    'vat_fees',
    'other_costs',
  ].join(',');

  const { data: rawSales, isLoading, error } = useQuery({
    queryKey: ['sales', 'profitCalendar', format(calendarWindow.start, 'yyyy-MM-dd'), format(calendarWindow.end, 'yyyy-MM-dd')],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('sort', '-sale_date');
      // Only fetch sales for the visible calendar window (typically ~5-6 weeks).
      qs.set('from', format(calendarWindow.start, 'yyyy-MM-dd'));
      qs.set('to', format(calendarWindow.end, 'yyyy-MM-dd'));
      qs.set('limit', '2000');
      qs.set('fields', salesFields);
      const data = await apiGetJson(`/api/sales?${qs.toString()}`);
      if (Array.isArray(data) && data.length === 0) {
        const qs2 = new URLSearchParams();
        qs2.set('sort', '-sale_date');
        qs2.set('from', format(calendarWindow.start, 'yyyy-MM-dd'));
        qs2.set('to', format(calendarWindow.end, 'yyyy-MM-dd'));
        qs2.set('limit', '2000');
        return apiGetJson(`/api/sales?${qs2.toString()}`);
      }
      return data;
    },
    placeholderData: [],
  });

  // Filter out soft-deleted sales
  const sales = useMemo(() => {
    // Match SalesHistory semantics: parseISO + interval checks.
    // This is more tolerant of different `sale_date` string formats.
    return (rawSales ?? [])
      .filter((sale) => !sale.deleted_at)
      .filter((sale) => {
        if (!sale?.sale_date) return false;
        try {
          const d = parseISO(String(sale.sale_date));
          return isWithinInterval(d, { start: calendarWindow.start, end: calendarWindow.end });
        } catch {
          return false;
        }
      });
  }, [rawSales, calendarWindow]);

  // Helper functions for month navigation
  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  // Helper function for day click (dialog)
  const handleDayClick = (day, salesForDay) => {
    // If the user just swiped to change months, don't open the day dialog.
    if (suppressNextDayClickRef.current) {
      suppressNextDayClickRef.current = false;
      return;
    }
    setSelectedDay(day);
    setSelectedSales(salesForDay);
    setDialogOpen(true);
  };

  const onCalendarPointerDown = (e) => {
    // Only primary mouse button; allow touch/pen.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      captured: false,
    };
  };

  const onCalendarPointerMove = (e) => {
    const st = swipeRef.current;
    if (!st?.active) return;
    if (st.pointerId !== e.pointerId) return;

    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;

    const ACTIVATION_PX = 8; // prevent tiny jitters
    if (!st.moved && Math.hypot(dx, dy) >= ACTIVATION_PX) {
      st.moved = true;
    }

    // Only start pointer capture once we detect real horizontal drag intent.
    // Capturing too early can prevent individual day tiles from receiving normal click/tap events.
    if (st.moved && !st.captured && Math.abs(dx) > Math.abs(dy)) {
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId);
        st.captured = true;
      } catch (_) {
        // ignore
      }
    }

    // Prevent text selection while dragging with mouse when horizontal intent is clear.
    if (st.moved && e.pointerType === 'mouse' && Math.abs(dx) > Math.abs(dy)) {
      try {
        e.preventDefault();
      } catch (_) {}
    }
  };

  const onCalendarPointerEnd = (e) => {
    const st = swipeRef.current;
    if (!st?.active) return;
    if (st.pointerId !== e.pointerId) return;

    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;

    if (st.captured) {
      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch (_) {
        // ignore
      }
    }

    swipeRef.current.active = false;
    swipeRef.current.pointerId = null;
    swipeRef.current.captured = false;

    // Treat as swipe only if it's clearly horizontal and long enough.
    const SWIPE_TRIGGER_PX = 60;
    const HORIZONTAL_RATIO = 1.2; // dx must be > dy*ratio
    const isHorizontal = Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO;

    if (Math.abs(dx) >= SWIPE_TRIGGER_PX && isHorizontal) {
      // Suppress day click that would otherwise fire on pointer up.
      suppressNextDayClickRef.current = true;

      if (dx < 0) {
        handleNextMonth();
      } else {
        handlePreviousMonth();
      }
    }
  };

  // Re-evaluation of calendar data and profit aggregation
  const { profitByDay, calendarDays, maxDailyProfit } = useMemo(() => {
    const days = eachDayOfInterval({ start: calendarWindow.start, end: calendarWindow.end });

    // Aggregate sales data by day
    const aggregatedProfitByDay = {};
    sales.forEach(sale => {
      if (!sale?.sale_date) return;
      const formattedDate = String(sale.sale_date).slice(0, 10);
      if (!aggregatedProfitByDay[formattedDate]) {
        aggregatedProfitByDay[formattedDate] = { profit: 0, totalSpend: 0, sales: [] };
      }
      aggregatedProfitByDay[formattedDate].profit += (sale.profit || 0);
      aggregatedProfitByDay[formattedDate].totalSpend += (sale.purchase_price || 0);
      aggregatedProfitByDay[formattedDate].sales.push(sale);
    });

    const maxDaily = Object.values(aggregatedProfitByDay).reduce(
      (acc, { profit }) => Math.max(acc, profit || 0),
      0
    );

    return {
      profitByDay: aggregatedProfitByDay,
      calendarDays: days,
      maxDailyProfit: maxDaily
    };
  }, [sales, calendarWindow]);

  // Re-evaluation of monthly stats
  const { monthlyProfit, monthlySalesCount, avgDailyProfit, monthlyTotalSpend, monthlyRevenue, monthlyCosts, topSoldItems } = useMemo(() => {
    let totalProfit = 0;
    let totalSpend = 0;
    let totalRevenue = 0;
    let totalCosts = 0;
    let salesCount = 0;
    const daysInCurrentMonth = getDaysInMonth(currentMonth);

    // Filter sales only for the current month
    const salesInCurrentMonth = sales.filter(sale => {
      if (!sale?.sale_date) return false;
      const monthKey = format(currentMonth, 'yyyy-MM');
      return String(sale.sale_date).startsWith(monthKey);
    });

    salesInCurrentMonth.forEach(sale => {
      totalProfit += (sale.profit || 0);
      totalSpend += (sale.purchase_price || 0);
      totalRevenue += (sale.selling_price || 0);
      const cost = (sale.purchase_price || 0) + (sale.shipping_cost || 0) + (sale.platform_fees || 0) + (sale.other_costs || 0);
      totalCosts += cost;
      salesCount++;
    });

    // "Top sold" thumbnails (desktop only UI). Prefer higher profit; fallback on revenue, then recency.
    const top = [...salesInCurrentMonth]
      .sort((a, b) => {
        const ap = Number(a?.profit || 0);
        const bp = Number(b?.profit || 0);
        if (bp !== ap) return bp - ap;
        const ar = Number(a?.selling_price || 0);
        const br = Number(b?.selling_price || 0);
        if (br !== ar) return br - ar;
        return String(b?.sale_date || '').localeCompare(String(a?.sale_date || ''));
      })
      .slice(0, 12) // sample some top candidates
      .filter(Boolean)
      .map((s) => ({
        id: s?.id,
        item_name: s?.item_name,
        image_url: s?.image_url,
        profit: s?.profit,
        selling_price: s?.selling_price,
      }))
      .filter((s) => !!s?.id)
      .slice(0, 3);

    const averageDaily = daysInCurrentMonth > 0 ? totalProfit / daysInCurrentMonth : 0;

    return {
      monthlyProfit: totalProfit,
      monthlySalesCount: salesCount,
      avgDailyProfit: averageDaily,
      monthlyTotalSpend: totalSpend,
      monthlyRevenue: totalRevenue,
      monthlyCosts: totalCosts,
      topSoldItems: top,
    };
  }, [sales, currentMonth]);


  const getHeatLevel = (profit) => {
    if (!profit || maxDailyProfit === 0) return 'none';
    const ratio = profit / maxDailyProfit;
    if (ratio >= 0.75) return 'hot';
    if (ratio >= 0.5) return 'high';
    if (ratio >= 0.25) return 'mid';
    return 'low';
  };

  const heatStyles = {
    none: 'md:bg-muted md:text-muted-foreground',
    low: 'md:bg-green-50 md:text-green-700 md:border md:border-green-200 dark:md:bg-green-950/40 dark:md:text-green-400 dark:md:border-green-900',
    mid: 'md:bg-green-100 md:text-green-800 md:border md:border-green-300 dark:md:bg-green-900/50 dark:md:text-green-300 dark:md:border-green-800',
    high: 'md:bg-green-200 md:text-green-900 md:border md:border-green-400 dark:md:bg-green-800/60 dark:md:text-green-200 dark:md:border-green-700',
    hot: 'md:bg-green-300 md:text-green-950 md:border md:border-green-500 md:shadow-lg dark:md:bg-green-700/70 dark:md:text-green-100 dark:md:border-green-600 dark:md:shadow-green-500/20'
  };

  if (isLoading) {
    return <div className="p-4 sm:p-8 text-center text-gray-700 dark:text-gray-300">Loading calendar...</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-background">
      <div className="max-w-5xl mx-auto md:max-w-6xl lg:max-w-7xl">
        {error ? (
          <div className="mb-4">
            <Alert variant="destructive">
              <AlertDescription>
                Profit Calendar failed to load sales: {String(error?.message || error)}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Profit Calendar</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track your daily profits at a glance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-6">
          {/* Calendar */}
          <Card className="border-0 shadow-lg mb-4 lg:mb-0 lg:col-span-8">
            <CardHeader className="border-b bg-card p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="text-lg sm:text-xl text-foreground">
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousMonth}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToday}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextMonth}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <div className="hidden md:flex items-center justify-between px-6 py-4 border-b bg-card/50">
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span className="uppercase tracking-wide text-xs text-muted-foreground">Month Total</span>
                <span className="text-lg font-semibold text-green-600 dark:text-green-400">${monthlyProfit.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">Avg / Day</span>
                <span className="text-lg font-semibold text-green-600 dark:text-green-400">${avgDailyProfit.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {[
                  { label: 'Low', color: 'bg-green-200 border border-green-400 dark:bg-green-900/50 dark:border-green-700' },
                  { label: 'Mid', color: 'bg-green-300 border border-green-500 dark:bg-green-800/60 dark:border-green-600' },
                  { label: 'High', color: 'bg-green-400 border border-green-600 dark:bg-green-700/70 dark:border-green-500' },
                  { label: 'Hot', color: 'bg-green-500 border border-green-700 dark:bg-green-600/80 dark:border-green-400' }
                ].map((item) => (
                  <span key={item.label} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <CardContent className="p-2 sm:p-3 md:px-6 md:py-5">
              <div
                className="select-none touch-pan-y"
                style={{ touchAction: 'pan-y' }}
                onPointerDown={onCalendarPointerDown}
                onPointerMove={onCalendarPointerMove}
                onPointerUp={onCalendarPointerEnd}
                onPointerCancel={onCalendarPointerEnd}
              >
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-2 md:gap-2 md:mb-3">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div
                      key={day}
                      className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-1 uppercase"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2">
                  {calendarDays.map((day, index) => {
                    const dayData = profitByDay[format(day, 'yyyy-MM-dd')];
                    const profit = dayData?.profit || 0;
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    const heatLevel = getHeatLevel(profit);

                    return (
                      <div
                        key={index}
                        onClick={() => dayData && handleDayClick(day, dayData.sales)}
                        className={`
                          rounded-lg text-center flex flex-col justify-between items-center
                          p-1 md:p-1.5
                          h-12 sm:h-14 md:h-16 lg:h-14 xl:h-16
                          ${!isCurrentMonth ? 'opacity-30' : ''}
                          ${isToday ? 'ring-2 ring-blue-500 md:ring-emerald-400/70' : ''}
                          ${dayData ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}
                          ${profit > 0 ? 'bg-green-50 dark:bg-emerald-900/30' : 'bg-gray-50 dark:bg-card/50'}
                          ${heatStyles[heatLevel]}
                        `}
                      >
                        <div
                          className={`text-[10px] sm:text-xs font-medium md:text-sm ${
                            dayData
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {format(day, 'd')}
                        </div>
                        {dayData && (
                          <div className="text-[9px] sm:text-[10px] font-bold text-green-600 dark:text-green-400 md:text-sm">
                            ${profit.toFixed(0)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Desktop KPIs (use horizontal space; avoid vertical scrolling) */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="profit-calendar-this-month rounded-2xl border bg-card p-4 shadow-lg">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">This Month</div>

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">Top sold</div>
                  <div className="text-[11px] text-muted-foreground">Tap to view details</div>
                </div>

                {Array.isArray(topSoldItems) && topSoldItems.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {topSoldItems.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="profit-calendar-item-btn group relative overflow-hidden rounded-xl border bg-card hover:border-primary/50 transition-colors"
                        onClick={() => {
                          window.location.href = `/SoldItemDetail?id=${encodeURIComponent(s.id)}&expandFees=true`;
                        }}
                        title={s?.item_name || 'View sold item'}
                      >
                        <img
                          src={s.image_url || DEFAULT_IMAGE_URL}
                          alt={s?.item_name || 'Sold item'}
                          className="h-20 xl:h-24 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                          <div className="truncate text-[11px] font-medium text-white">
                            {s?.item_name || 'Sold item'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground">
                    No sold items with photos yet.
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="profit-calendar-stat-card rounded-xl border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Profit
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">${monthlyProfit.toFixed(2)}</div>
                </div>
                <div className="profit-calendar-stat-card rounded-xl border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShoppingBag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Sales
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{monthlySalesCount}</div>
                </div>
                <div className="profit-calendar-stat-card rounded-xl border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Avg / Day
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">${avgDailyProfit.toFixed(2)}</div>
                </div>
                <div className="profit-calendar-stat-card rounded-xl border bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Revenue</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">${Math.round(monthlyRevenue || 0).toLocaleString()}</div>
                </div>
                <div className="profit-calendar-stat-card rounded-xl border bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Costs</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">${Math.round(monthlyCosts || 0).toLocaleString()}</div>
                </div>
                <div className="profit-calendar-stat-card rounded-xl border bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Margin</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    {monthlyRevenue ? `${Math.round((monthlyProfit / monthlyRevenue) * 1000) / 10}%` : '0%'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile/tablet KPIs remain below calendar */}
        <div className="lg:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">This Month</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">${monthlyProfit.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Sales Count</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{monthlySalesCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Avg Daily</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">${avgDailyProfit.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
            <div className="rounded-2xl border bg-card p-4 shadow-lg">
              <div className="text-sm text-muted-foreground">Revenue</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">${Math.round(monthlyRevenue || 0).toLocaleString()}</div>
              <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">This month</div>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-lg">
              <div className="text-sm text-muted-foreground">Costs</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">${Math.round(monthlyCosts || 0).toLocaleString()}</div>
              <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">This month</div>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-lg">
              <div className="text-sm text-muted-foreground">Profit Margin</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">
                {monthlyRevenue ? `${Math.round((monthlyProfit / monthlyRevenue) * 1000) / 10}%` : '0%'}
              </div>
              <div className="mt-2 text-xs text-green-600 dark:text-green-400">This month</div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex flex-col w-[calc(100dvw-1rem)] max-w-[calc(100dvw-1rem)] sm:max-w-2xl top-2 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[calc(100dvh-1rem)] sm:max-h-[80vh] overflow-hidden p-4 sm:p-6">
          <DialogHeader className="text-left pr-10 flex-shrink-0">
            <DialogTitle className="text-foreground break-words whitespace-normal">
              Sales on {selectedDay && format(selectedDay, 'MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="po-scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-6 pt-2">
            {selectedSales.map(sale => (
              <Card key={sale.id} className="hover:shadow-md transition-shadow border border-border/60 rounded-xl mb-4">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                      <img
                        src={sale?.image_url || DEFAULT_IMAGE_URL}
                        alt={sale?.item_name || 'Sold item'}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground break-words whitespace-normal line-clamp-2">
                            {sale.item_name}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Sold for ${Number(sale.selling_price ?? 0).toFixed(2)}
                          </p>
                        </div>
                        <Badge className={`${sale.profit >= 0 ? "bg-green-600" : "bg-red-600"} text-white flex-shrink-0`}>
                          {sale.profit >= 0 ? "+" : "-"}${Math.abs(sale.profit ?? 0).toFixed(2)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="h-px bg-border/70" />
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `/SoldItemDetail?id=${encodeURIComponent(sale.id)}&expandFees=true`;
                      }}
                      className="inline-flex w-full sm:w-auto max-w-full items-center justify-center gap-2 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      View Sale Details
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
