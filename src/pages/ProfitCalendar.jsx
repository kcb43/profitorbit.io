
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  getDaysInMonth
} from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom'; // Assuming react-router-dom for Link

// Dummy createPageUrl for compilation. In a real app, this would be a real utility.
const createPageUrl = (url) => url;

export default function ProfitCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedSales, setSelectedSales] = useState([]);

  const { data: rawSales, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list(),
    initialData: [],
  });

  // Filter out soft-deleted sales
  const sales = useMemo(() => (rawSales ?? []).filter(sale => !sale.deleted_at), [rawSales]);

  // Helper functions for month navigation
  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  // Helper function for day click (dialog)
  const handleDayClick = (day, salesForDay) => {
    setSelectedDay(day);
    setSelectedSales(salesForDay);
    setDialogOpen(true);
  };

  // Re-evaluation of calendar data and profit aggregation
  const { profitByDay, calendarDays, maxDailyProfit } = useMemo(() => {
    // Calendar should cover 6 weeks to ensure all days of the month are visible
    // Start of week is Sunday by default in date-fns, but explicitly setting for clarity
    const calendarStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }); 
    const calendarEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }); 

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Aggregate sales data by day
    const aggregatedProfitByDay = {};
    sales.forEach(sale => {
      let saleDate;
      try {
        saleDate = parseISO(sale.sale_date);
      } catch (error) {
        // console.error("Error parsing sale_date:", sale.sale_date, error);
        return; // Skip this sale if date is invalid
      }

      const formattedDate = format(saleDate, 'yyyy-MM-dd');
      if (!aggregatedProfitByDay[formattedDate]) {
        aggregatedProfitByDay[formattedDate] = { profit: 0, sales: [] };
      }
      aggregatedProfitByDay[formattedDate].profit += (sale.profit || 0);
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
  }, [sales, currentMonth]);

  // Re-evaluation of monthly stats
  const { monthlyProfit, monthlySalesCount, avgDailyProfit } = useMemo(() => {
    let totalProfit = 0;
    let salesCount = 0;
    const daysInCurrentMonth = getDaysInMonth(currentMonth);

    // Filter sales only for the current month
    const salesInCurrentMonth = sales.filter(sale => {
      try {
        return isSameMonth(parseISO(sale.sale_date), currentMonth);
      } catch {
        return false;
      }
    });

    salesInCurrentMonth.forEach(sale => {
      totalProfit += (sale.profit || 0);
      salesCount++;
    });

    const averageDaily = daysInCurrentMonth > 0 ? totalProfit / daysInCurrentMonth : 0;

    return {
      monthlyProfit: totalProfit,
      monthlySalesCount: salesCount,
      avgDailyProfit: averageDaily
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
    none: 'md:bg-[#1b2534] md:text-[#6b7280]',
    low: 'md:bg-[#10271b] md:text-[#22c55e] md:border md:border-[#1e5534]',
    mid: 'md:bg-[#124227] md:text-[#34d399] md:border md:border-[#1f7547]',
    high: 'md:bg-[#0f6131] md:text-[#6ee7b7] md:border md:border-[#2ca56b]',
    hot: 'md:bg-[#0f7a3c] md:text-[#bbf7d0] md:border md:border-[#34d399] md:shadow-[0_0_0_1px_rgba(74,222,128,0.35)]'
  };

  if (isLoading) {
    return <div className="p-4 sm:p-8 text-center text-gray-700 dark:text-gray-300">Loading calendar...</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 md:bg-[#0b1220]">
      <div className="max-w-5xl mx-auto md:max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground md:text-white">Profit Calendar</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 md:text-slate-300">
            Track your daily profits at a glance
          </p>
        </div>

        <Card className="border-0 shadow-lg mb-6 md:bg-[#111b2d] md:border md:border-white/5 md:rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-gray-800 dark:bg-gray-800 p-4 md:bg-transparent md:border-b md:border-white/5 md:px-6 md:py-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-lg sm:text-xl text-white">
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousMonth}
                  className="md:border-white/20 md:text-white md:hover:bg-white/10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToday}
                  className="md:border-white/20 md:text-white md:hover:bg-white/10"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextMonth}
                  className="md:border-white/20 md:text-white md:hover:bg-white/10"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <div className="hidden md:flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#0d1728]">
            <div className="flex items-center gap-6 text-sm text-slate-300">
              <span className="uppercase tracking-wide text-xs text-slate-400">Month Total</span>
              <span className="text-lg font-semibold text-emerald-300">${monthlyProfit.toFixed(2)}</span>
              <span className="text-xs text-slate-500">Avg / Day</span>
              <span className="text-lg font-semibold text-emerald-200">${avgDailyProfit.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              {[
                { label: 'Low', color: 'bg-emerald-700/40 border border-emerald-500/40' },
                { label: 'Mid', color: 'bg-emerald-500/40 border border-emerald-400/60' },
                { label: 'High', color: 'bg-emerald-400/60 border border-emerald-300/60' },
                { label: 'Hot', color: 'bg-emerald-300/70 border border-emerald-200/70' }
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <CardContent className="p-2 sm:p-3 md:px-6 md:py-6 md:bg-transparent">
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-2 md:gap-2 md:mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div
                  key={day}
                  className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-1 md:text-slate-400 md:uppercase md:text-[11px]"
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
                      aspect-square p-1 rounded-lg text-center flex flex-col justify-between
                      ${!isCurrentMonth ? 'opacity-30' : ''}
                      ${isToday ? 'ring-2 ring-blue-500 md:ring-emerald-400/70' : ''}
                      ${dayData ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}
                      ${profit > 0 ? 'bg-green-50 dark:bg-green-900/30' : 'bg-gray-50 dark:bg-gray-800/50'}
                      ${heatStyles[heatLevel]}
                    `}
                  >
                    <div
                      className={`text-[10px] sm:text-xs font-medium md:text-sm ${
                        dayData
                          ? 'text-foreground md:text-inherit'
                          : 'text-muted-foreground md:text-inherit'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    {dayData && (
                      <div className="text-[9px] sm:text-[10px] font-bold text-green-600 dark:text-green-400 md:text-sm md:text-inherit">
                        ${profit.toFixed(0)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="border-0 shadow-sm md:bg-[#111b2d] md:border md:border-white/5 md:rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3 md:px-6 md:py-5">
              <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-lg md:bg-emerald-500/10 md:border md:border-emerald-400/40">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 md:text-emerald-300" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 md:text-slate-400">This Month</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 [.dark_&]:!text-white md:text-white">${monthlyProfit.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm md:bg-[#111b2d] md:border md:border-white/5 md:rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3 md:px-6 md:py-5">
              <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg md:bg-blue-500/10 md:border md:border-blue-400/40">
                <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 md:text-blue-300" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 md:text-slate-400">Sales Count</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 [.dark_&]:!text-white md:text-white">{monthlySalesCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm md:bg-[#111b2d] md:border md:border-white/5 md:rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3 md:px-6 md:py-5">
              <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg md:bg-purple-500/10 md:border md:border-purple-400/40">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 md:text-purple-300" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 md:text-slate-400">Avg Daily</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 [.dark_&]:!text-white md:text-white">${avgDailyProfit.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Sales on {selectedDay && format(selectedDay, 'MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {selectedSales.map(sale => (
              <Card key={sale.id} className="hover:shadow-md transition-shadow border border-border/60 rounded-xl mb-4">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-foreground">{sale.item_name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Sold for ${sale.selling_price?.toFixed(2)}
                      </p>
                    </div>
                    <Badge className={`${sale.profit >= 0 ? "bg-green-600" : "bg-red-600"} text-white`}>
                      {sale.profit >= 0 ? "+" : "-"}${Math.abs(sale.profit ?? 0).toFixed(2)}
                    </Badge>
                  </div>
                  <div className="h-px bg-border/70" />
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `/SoldItemDetail?id=${encodeURIComponent(sale.id)}&expandFees=true`;
                      }}
                      className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
