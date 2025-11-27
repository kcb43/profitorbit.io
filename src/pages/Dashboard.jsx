
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sortSalesByRecency } from "@/utils/sales";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, ShoppingBag, Percent, Plus, Package, AlarmClock, Lightbulb, Timer, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';

import StatCard from "../components/dashboard/StatCard";
import ProfitChart from "../components/dashboard/ProfitChart";
import PlatformBreakdown from "../components/dashboard/PlatformBreakdown";
import RecentSales from "../components/dashboard/RecentSales";
import Gamification from "../components/dashboard/Gamification";
import TipOfTheDay from "../components/dashboard/TipOfTheDay";
import QuickActions from "../components/dashboard/QuickActions";

const SUPPORTED_MARKETPLACES = [
  {
    key: "ebay",
    name: "eBay",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
    available: true,
  },
  {
    key: "facebook",
    name: "Facebook",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
    available: true,
  },
  {
    key: "mercari",
    name: "Mercari",
    logo: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
    available: true,
  },
  {
    key: "etsy",
    name: "Etsy",
    logo: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    available: false,
  },
  {
    key: "poshmark",
    name: "Poshmark",
    logo: "https://cdn.brandfetch.io/idUxsADOAW/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    available: false,
  },
  {
    key: "offerup",
    name: "OfferUp",
    logo: "https://cdn.brandfetch.io/id5p1Knwlt/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    available: false,
  },
  {
    key: "depop",
    name: "Depop",
    logo: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2048%2048'%3E%3Cpath%20fill='%23dd2c00'%20d='M42,37c0,2.762-2.238,5-5,5H11c-2.761,0-5-2.238-5-5V11c0-2.762,2.239-5,5-5h26c2.762,0,5,2.238,5,5%20V37z'%3E%3C/path%3E%3Cpath%20fill='%23090504'%20d='M27,12v8h-6c-5,0-8,4.18-8,8.38c0,4.21,3.82,7.62,8,7.62h13V12H27z%20M27,31h-5c-1.86,0-3-1.14-3-3%20s1.38-3,3.24-3H27V31z'%3E%3C/path%3E%3C/svg%3E",
    available: false,
  },
];

export default function Dashboard() {
  const location = useLocation();
  const [profitChartRange, setProfitChartRange] = useState('14d');

  const { data: rawSales, isLoading: isLoadingSales } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list(),
    initialData: [],
  });

  const sales = React.useMemo(() => sortSalesByRecency(rawSales ?? []), [rawSales]);
  
  // New query for inventory items
  const { data: inventoryItems, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['inventoryItems'],
    queryFn: () => base44.entities.InventoryItem.list(),
    initialData: [],
  });

  // Memo to calculate items with upcoming return deadlines
  const itemsWithUpcomingReturns = React.useMemo(() => {
    if (!inventoryItems) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    return inventoryItems.filter(item => {
      if (!item.return_deadline || item.status === 'sold') return false; // Only consider unsold items with a deadline
      
      try {
        const deadline = parseISO(item.return_deadline);
        // Check if deadline is today or in the future
        if (isAfter(deadline, today) || format(deadline, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
          const daysLeft = differenceInDays(deadline, today);
          return daysLeft >= 0 && daysLeft <= 10; // Deadline is within the next 10 days (inclusive of today)
        }
      } catch (e) {
        // Invalid date format, ignore item.
        console.warn("Could not parse return_deadline for item:", item.id, item.return_deadline, e);
        return false;
      }
      return false;
    });
  }, [inventoryItems]);

  // New memo to calculate stale inventory items
  const staleItems = React.useMemo(() => {
    if (!inventoryItems) return [];
    const today = new Date();
    return inventoryItems.filter(item => {
      if (!item.purchase_date) return false;

      const status = (item.status || "").toLowerCase();
      const isTrackableStatus = status === "available" || status === "unlisted";
      if (!isTrackableStatus) return false;

      try {
        const purchaseDate = parseISO(item.purchase_date);
        const daysSincePurchase = differenceInDays(today, purchaseDate);
        return daysSincePurchase >= 10;
      } catch (e) {
        console.warn("Could not parse purchase_date for stale item check:", item.id, e);
        return false;
      }
    });
  }, [inventoryItems]);

  const { totalProfit, totalRevenue, totalSales, avgProfit, profitMargin, averageSaleSpeed } = React.useMemo(() => {
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.selling_price || 0), 0);
    const totalCosts = sales.reduce((sum, sale) => {
      const costs = (sale.purchase_price || 0) + 
                   (sale.shipping_cost || 0) + 
                   (sale.platform_fees || 0) + 
                   (sale.other_costs || 0); 
      return sum + costs;
    }, 0);
    const avgProfit = sales.length > 0 ? totalProfit / sales.length : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const salesWithSpeed = sales
      .map(sale => {
        if (!sale.purchase_date || !sale.sale_date) return null;
        try {
          return differenceInDays(parseISO(sale.sale_date), parseISO(sale.purchase_date));
        } catch (e) {
          return null;
        }
      })
      .filter(speed => speed !== null && speed >= 0);
    
    const totalDays = salesWithSpeed.reduce((sum, speed) => sum + speed, 0);
    const averageSaleSpeed = salesWithSpeed.length > 0 ? totalDays / salesWithSpeed.length : 0;

    return { totalProfit, totalRevenue, totalSales: sales.length, avgProfit, profitMargin, averageSaleSpeed };
  }, [sales]);

  // Calculation for inventory stats
  const inventoryStats = React.useMemo(() => {
    const unsoldItems = inventoryItems.filter(item => item.status !== 'sold');
    const totalQuantity = unsoldItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    return { totalQuantity };
  }, [inventoryItems]);
  
  // Updated isLoading to include inventory loading state
  const isLoading = isLoadingSales || isLoadingInventory;

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 bg-gray-50 dark:bg-gray-900/95">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-10 w-48 mb-8 bg-gray-200 dark:bg-gray-800" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-32 bg-gray-200 dark:bg-gray-800" />)}
          </div>
          <Skeleton className="h-96 bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Track your business performance</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to={createPageUrl("AddSale")}>
              <Button className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-md">
                <Plus className="w-5 h-5 mr-2" />
                Add Sale
              </Button>
            </Link>
            <Link
              to={createPageUrl("AddInventoryItem")}
              state={{ from: location.pathname || "/Dashboard" }}
            >
              <Button className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md">
                <Package className="w-5 h-5 mr-2" />
                Add Inventory
              </Button>
            </Link>
          </div>
        </div>

        {/* Return Deadline Banner */}
        <div className="mb-8">
          <Card className="border border-gray-200/70 dark:border-gray-800/70 bg-white/90 dark:bg-gray-900/70 backdrop-blur rounded-2xl shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Marketplace Support</p>
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">List and track your inventory across the marketplaces you already sell on.</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  {SUPPORTED_MARKETPLACES.map((marketplace) => {
                    const isUnavailable = marketplace.available === false;
                    return (
                      <div
                        key={marketplace.key}
                        className={`group relative flex items-center gap-2 rounded-full border px-3 py-2 shadow-sm transition ${
                          isUnavailable
                            ? "border-gray-200/60 dark:border-gray-700/60 bg-gray-100/80 dark:bg-gray-800/60 text-muted-foreground cursor-not-allowed opacity-60"
                            : "border-gray-200/70 dark:border-gray-700/70 bg-white/90 dark:bg-gray-900/80 text-foreground"
                        }`}
                        role="status"
                        aria-disabled={isUnavailable}
                      >
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                          isUnavailable
                            ? "border-gray-200/60 dark:border-gray-700/60 bg-gray-200 dark:bg-gray-800/70"
                            : "border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800"
                        }`}>
                          <img
                            src={marketplace.logo}
                            alt={marketplace.name}
                            className={`h-5 w-5 object-contain ${isUnavailable ? "grayscale" : ""}`}
                            loading="lazy"
                          />
                        </span>
                        <span className="text-sm font-medium whitespace-nowrap">{marketplace.name}</span>
                        {isUnavailable && (
                          <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900/90 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            Coming soon
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Return Deadlines and Smart Reminder Cards */}
        {(itemsWithUpcomingReturns.length > 0 || staleItems.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {itemsWithUpcomingReturns.length > 0 && (
              <Link
                to={createPageUrl("Inventory?filter=returnDeadline")}
                className="relative rounded-2xl p-4 sm:p-5 lg:p-6 backdrop-blur-[10px] bg-gray-50/50 dark:bg-slate-800/80 border border-red-500/50 dark:border-red-500/50 hover:border-red-500/70 dark:hover:border-red-500/70 shadow-[rgba(0,0,0,0.15)_0px_8px_16px] dark:shadow-[rgba(0,0,0,0.3)_0px_20px_40px] transition-all duration-150 cursor-pointer group overflow-hidden"
              >
                {/* Gradient glow on hover */}
                <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-red-500/20 to-rose-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
                    {/* Icon box */}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-500 via-red-600 to-rose-500 shadow-lg shadow-red-500/40 flex-shrink-0">
                      <AlarmClock className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    
                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] sm:text-xs uppercase text-gray-600 dark:text-slate-400 font-medium tracking-wide">
                        Return Deadlines
                      </div>
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {itemsWithUpcomingReturns.length}
                      </div>
                    </div>
                  </div>
                  
                  {/* Description */}
                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-500 mt-1 sm:mt-2 flex items-center gap-1">
                    <span className="truncate">View items to return</span>
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            )}
            
            {staleItems.length > 0 && (
              <Link
                to={createPageUrl("Inventory?status=available")}
                className="relative rounded-2xl p-4 sm:p-5 lg:p-6 backdrop-blur-[10px] bg-gray-50/50 dark:bg-slate-800/80 border border-emerald-500/50 dark:border-emerald-500/50 hover:border-emerald-500/70 dark:hover:border-emerald-500/70 shadow-[rgba(0,0,0,0.15)_0px_8px_16px] dark:shadow-[rgba(0,0,0,0.3)_0px_20px_40px] transition-all duration-150 cursor-pointer group overflow-hidden"
              >
                {/* Gradient glow on hover */}
                <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
                    {/* Icon box */}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-500 shadow-lg shadow-emerald-500/40 flex-shrink-0">
                      <Lightbulb className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    
                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] sm:text-xs uppercase text-gray-600 dark:text-slate-400 font-medium tracking-wide">
                        Smart Reminder
                      </div>
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {staleItems.length}
                      </div>
                    </div>
                  </div>
                  
                  {/* Description */}
                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-500 mt-1 sm:mt-2 flex items-center gap-1">
                    <span className="truncate">Items need listing</span>
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Updated grid layout for 3 stat cards instead of 6 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatCard
            title="Total Profit"
            value={`$${totalProfit.toFixed(2)}`}
            icon={DollarSign}
            bgGradient="bg-gradient-to-br from-green-500 to-emerald-600"
          />
          <StatCard
            title="Total Sales"
            value={totalSales}
            icon={ShoppingBag}
            bgGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          />
          {/* New StatCard for Inventory */}
          <StatCard
            title="Items in Stock"
            value={inventoryStats.totalQuantity}
            icon={Package}
            bgGradient="bg-gradient-to-br from-purple-500 to-pink-600"
          />
        </div>

        {/* Dashboard cards: Your Progress (full-width), Quick Actions, Tip of the Day and Tax Summary side-by-side */}
        <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
          {/* Full-width Your Progress section */}
          <Gamification sales={sales} stats={{ totalProfit, totalSales, avgProfit, profitMargin, averageSaleSpeed }} />
          
          {/* Quick Actions section */}
          <QuickActions />
          
          {/* Tip of Day */}
          <TipOfTheDay />
        </div>

        <div className="flex justify-start lg:justify-end mb-6">
          <Link to={createPageUrl("Gallery")}>
            <Button variant="outline" className="font-semibold gap-2">
              <Star className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)] animate-pulse" />
              View Deals of the Month
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
          {/* Profit Chart (Mobile: 1st, Desktop: Row 1, Col 1-4) */}
          <div className="lg:col-span-4 lg:row-start-1">
            <ProfitChart 
              sales={sales} 
              range={profitChartRange} 
              onRangeChange={setProfitChartRange}
              totalProfit={totalProfit}
              totalSales={totalSales}
            />
          </div>

          {/* Recent Sales (Mobile: 2nd, Desktop: Row 2, Col 1-6) */}
          <div className="lg:col-span-full">
             <RecentSales sales={sales} />
          </div>

          {/* Platform Breakdown (Mobile: 3rd, Desktop: Row 1, Col 5-6) */}
          <div className="lg:col-span-2 lg:row-start-1">
            <PlatformBreakdown sales={sales} />
          </div>
        </div>
      </div>
    </div>
  );
}
