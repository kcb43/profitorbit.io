
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sortSalesByRecency } from "@/utils/sales";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, ShoppingBag, Percent, Plus, Package, AlarmClock, Lightbulb, Timer, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';
import { supabase } from "@/api/supabaseClient";

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
  const navigate = useNavigate();
  const [profitChartRange, setProfitChartRange] = useState('14d');

  // Handle OAuth callback - process hash fragment before AuthGuard redirects
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check if we have OAuth callback hash fragment
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        console.log('🔐 Dashboard: OAuth callback detected, processing...');
        
        try {
          // Wait for Supabase to process the hash fragment
          // Supabase automatically processes hash fragments, but we need to wait
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (session) {
            console.log('✅ Dashboard: OAuth callback successful, session established');
            // Clear the hash fragment
            window.history.replaceState(null, '', window.location.pathname);
          } else if (error) {
            console.error('❌ Dashboard: OAuth callback error:', error);
            // Redirect to login on error
            navigate('/login', { replace: true });
          } else {
            console.warn('⚠️ Dashboard: OAuth callback detected but no session found, retrying...');
            // Retry once more after a longer delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              window.history.replaceState(null, '', window.location.pathname);
            } else {
              console.error('❌ Dashboard: Session still not found after retry');
              navigate('/login', { replace: true });
            }
          }
        } catch (error) {
          console.error('❌ Dashboard: Error processing OAuth callback:', error);
          navigate('/login', { replace: true });
        }
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  // Add Google site verification meta tag when Dashboard loads
  useEffect(() => {
    // Check if meta tag already exists
    let metaTag = document.querySelector('meta[name="google-site-verification"]');
    
    if (!metaTag) {
      // Create and add the meta tag if it doesn't exist
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'google-site-verification');
      metaTag.setAttribute('content', 'BRiptYhcOdvXt3QZL7NfYmSEP0k0nMUOA2pRWrpqgCI');
      document.head.appendChild(metaTag);
    } else {
      // Update existing meta tag
      metaTag.setAttribute('content', 'BRiptYhcOdvXt3QZL7NfYmSEP0k0nMUOA2pRWrpqgCI');
    }

    // Cleanup function to remove meta tag when component unmounts (optional)
    return () => {
      // Only remove if we created it (check by content)
      const tagToRemove = document.querySelector('meta[name="google-site-verification"][content="BRiptYhcOdvXt3QZL7NfYmSEP0k0nMUOA2pRWrpqgCI"]');
      // Note: We'll leave it in the DOM since it's already in index.html for site-wide verification
    };
  }, []);

  async function apiGetJson(path) {
    // Small retry loop to avoid "session is null on first paint" races.
    let session = null;
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await supabase.auth.getSession();
      session = res?.data?.session || null;
      if (session?.access_token) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 150));
    }

    const headers = {
      'Content-Type': 'application/json',
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

  const {
    data: salesSummary,
    isLoading: isLoadingSalesSummary,
    error: salesSummaryError,
  } = useQuery({
    queryKey: ['salesSummary'],
    queryFn: () => apiGetJson('/api/sales/summary'),
    initialData: { totalProfit: 0, totalRevenue: 0, totalSales: 0 },
  });

  // Bounded sales fetch for charts + breakdown (avoid pulling the entire sales table on initial load)
  // We intentionally keep this small so dashboard is fast even with big sales history.
  const salesSince = React.useMemo(() => {
    const d = new Date();
    if (profitChartRange === '14d') d.setDate(d.getDate() - 14);
    else if (profitChartRange === 'monthly') d.setDate(d.getDate() - 365); // last 12 months
    else if (profitChartRange === 'yearly') d.setDate(d.getDate() - 365 * 6); // last 6 years
    else d.setDate(d.getDate() - 365 * 2);
    return d.toISOString();
  }, [profitChartRange]);

  const salesLimit = React.useMemo(() => {
    if (profitChartRange === '14d') return 500;
    if (profitChartRange === 'monthly') return 2000;
    if (profitChartRange === 'yearly') return 5000;
    return 2000;
  }, [profitChartRange]);

  const { data: rawSales, isLoading: isLoadingSales, error: salesError } = useQuery({
    queryKey: ['sales', 'dashboard', profitChartRange],
    queryFn: () =>
      base44.entities.Sale.list('-sale_date', {
        since: salesSince,
        limit: salesLimit,
        fields: [
          'id',
          'item_name',
          'purchase_date',
          'sale_date',
          'platform',
          'source',
          'category',
          'shipping_cost',
          'platform_fees',
          'vat_fees',
          'other_costs',
          'profit',
          'notes',
          'image_url',
          'deleted_at',
          'selling_price',
          'purchase_price',
        ].join(','),
      }),
    initialData: [],
  });

  // Filter out soft-deleted sales for dashboard calculations and display
  const sales = React.useMemo(() => {
    const activeSales = (rawSales ?? []).filter(sale => !sale.deleted_at);
    return sortSalesByRecency(activeSales);
  }, [rawSales]);
  
  // Inventory query: use a distinct cache key so other pages (Inventory/Crosslist) don't overwrite it
  // with different queryFns (a source of "data appears after clicking Crosslist").
  const { data: inventoryItems, isLoading: isLoadingInventory, error: inventoryError } = useQuery({
    queryKey: ['inventoryItems', 'dashboard'],
    queryFn: () =>
      base44.entities.InventoryItem.list('-purchase_date', {
        limit: 5000,
        fields: [
          'id',
          'status',
          'purchase_date',
          'quantity',
          'quantity_sold',
          'return_deadline',
          'return_deadline_dismissed',
          'deleted_at',
        ].join(','),
      }),
    initialData: [],
  });

  // Memo to calculate items with upcoming return deadlines
  const itemsWithUpcomingReturns = React.useMemo(() => {
    if (!inventoryItems) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    return inventoryItems.filter(item => {
      if (!item.return_deadline || item.status === 'sold') return false; // Only consider unsold items with a deadline
      if (item.return_deadline_dismissed === true) return false; // Exclude dismissed items
      
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
    // Accurate totals from server-side aggregates (fast).
    const totalProfit = salesSummary?.totalProfit ?? 0;
    const totalRevenue = salesSummary?.totalRevenue ?? 0;
    const totalSales = salesSummary?.totalSales ?? 0;

    const avgProfit = totalSales > 0 ? totalProfit / totalSales : 0;
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

    return { totalProfit, totalRevenue, totalSales, avgProfit, profitMargin, averageSaleSpeed };
  }, [sales, salesSummary]);

  // Calculation for inventory stats - matches Inventory page logic
  const inventoryStats = React.useMemo(() => {
    if (!Array.isArray(inventoryItems)) return { totalQuantity: 0 };
    
    // Only count items with status "available" or "listed" (matches Inventory page)
    const trackableItems = inventoryItems.filter(item => {
      const status = (item.status || "").toLowerCase();
      return status === "available" || status === "listed";
    });

    // Account for quantity_sold (matches Inventory page calculation)
    const totalQuantity = trackableItems.reduce((sum, item) => {
      const rawQuantity = Number(item.quantity ?? 1);
      const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;

      const rawSold = Number(item.quantity_sold ?? 0);
      const quantitySold = Number.isFinite(rawSold) && rawSold >= 0 ? rawSold : 0;

      const remaining = Math.max(quantity - quantitySold, 0);
      return sum + remaining;
    }, 0);
    
    return { totalQuantity };
  }, [inventoryItems]);
  
  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden w-full max-w-full">
      <div className="max-w-7xl mx-auto min-w-0 w-full">
        {(salesError || inventoryError || salesSummaryError) && (
          <div className="mb-4">
            <Alert variant="destructive">
              <AlertDescription>
                {salesSummaryError ? `Sales summary error: ${salesSummaryError.message}` : null}
                {salesError ? ` Sales (chart) error: ${salesError.message}` : null}
                {inventoryError ? ` Inventory load error: ${inventoryError.message}` : null}
              </AlertDescription>
            </Alert>
          </div>
        )}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 min-w-0">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-foreground break-words">Dashboard</h1>
            <p className="text-muted-foreground mt-1 break-words">Track your business performance</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 min-w-0">
            <Link to={createPageUrl("AddSale")} className="w-full sm:w-auto">
              <Button className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-md w-full sm:w-auto">
                <Plus className="w-5 h-5 mr-2" />
                Add Sale
              </Button>
            </Link>
            <Link
              to={createPageUrl("AddInventoryItem")}
              state={{ from: location.pathname || "/Dashboard" }}
              className="w-full sm:w-auto"
            >
              <Button className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md w-full sm:w-auto">
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Marketplace Support</p>
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">Track and list your inventory on every marketplace.</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end min-w-0">
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
                        <span className="text-sm font-medium break-words">{marketplace.name}</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 min-w-0">
            {itemsWithUpcomingReturns.length > 0 && (
              <Link
                to={createPageUrl("Inventory?filter=returnDeadline")}
                className="relative rounded-2xl p-4 sm:p-5 lg:p-6 backdrop-blur-[10px] bg-gray-50/50 dark:bg-slate-800/80 border border-red-500/50 dark:border-red-500/50 hover:border-red-500/70 dark:hover:border-red-500/70 shadow-[rgba(0,0,0,0.15)_0px_8px_16px] dark:shadow-[rgba(0,0,0,0.3)_0px_20px_40px] transition-all duration-150 cursor-pointer group overflow-hidden min-w-0"
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
                className="relative rounded-2xl p-4 sm:p-5 lg:p-6 backdrop-blur-[10px] bg-gray-50/50 dark:bg-slate-800/80 border border-emerald-500/50 dark:border-emerald-500/50 hover:border-emerald-500/70 dark:hover:border-emerald-500/70 shadow-[rgba(0,0,0,0.15)_0px_8px_16px] dark:shadow-[rgba(0,0,0,0.3)_0px_20px_40px] transition-all duration-150 cursor-pointer group overflow-hidden min-w-0"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8 min-w-0">
          <StatCard
            title="Total Profit"
            value={isLoadingSalesSummary ? "Loading..." : `$${totalProfit.toFixed(2)}`}
            icon={DollarSign}
            bgGradient="bg-gradient-to-br from-green-500 to-emerald-600"
          />
          <StatCard
            title="Total Sales"
            value={isLoadingSalesSummary ? "Loading..." : totalSales}
            icon={ShoppingBag}
            bgGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          />
          {/* New StatCard for Inventory */}
          <StatCard
            title="Items in Stock"
            value={isLoadingInventory ? "Loading..." : inventoryStats.totalQuantity}
            icon={Package}
            bgGradient="bg-gradient-to-br from-purple-500 to-pink-600"
          />
        </div>

        {/* Dashboard cards: Your Progress (full-width), Quick Actions, Tip of the Day and Tax Summary side-by-side */}
        <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6 min-w-0">
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

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 min-w-0">
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
