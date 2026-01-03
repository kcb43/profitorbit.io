
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sortSalesByRecency } from "@/utils/sales";
import {
  format,
  parseISO,
  differenceInDays,
  isAfter,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, ShoppingBag, Percent, Plus, Package, AlarmClock, Lightbulb, Timer, Star, Box } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/api/supabaseClient";

import StatCard from "../components/dashboard/StatCard";
import ProfitChart from "../components/dashboard/ProfitChart";
import PlatformBreakdown from "../components/dashboard/PlatformBreakdown";
import RecentSales from "../components/dashboard/RecentSales";
import Gamification from "../components/dashboard/Gamification";
import TipOfTheDay from "../components/dashboard/TipOfTheDay";
import QuickActions from "../components/dashboard/QuickActions";
import KpiSparkCard from "../components/dashboard/mosaic/KpiSparkCard";
import ProfitTrendCard from "../components/dashboard/mosaic/ProfitTrendCard";
import PlatformDonutCard from "../components/dashboard/mosaic/PlatformDonutCard";

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
  const [desktopProfitRange, setDesktopProfitRange] = useState('14d');
  const [desktopCustomRange, setDesktopCustomRange] = useState(undefined);

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

  // IMPORTANT: keep Dashboard chart inputs consistent with Sales History.
  // We fetch a bounded recent slice (no server-side date filter) and filter/group client-side.
  // This avoids inconsistencies when DB column types vary (DATE vs TIMESTAMPTZ).
  const salesLimit = 5000;

  const salesFields = React.useMemo(() => ([
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
    'sale_price',
    'purchase_price',
  ].join(',')), []);

  const { data: rawSales, isLoading: isLoadingSales, error: salesError } = useQuery({
    queryKey: ['sales', 'dashboard', profitChartRange],
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set('sort', '-sale_date');
      qs.set('limit', String(salesLimit));
      qs.set('fields', salesFields);
      return apiGetJson(`/api/sales?${qs.toString()}`);
    },
    initialData: [],
  });

  // Filter out soft-deleted sales for dashboard calculations and display
  const sales = React.useMemo(() => {
    const activeSales = (rawSales ?? []).filter(sale => !sale.deleted_at);
    return sortSalesByRecency(activeSales);
  }, [rawSales]);

  // Separate: most recent sales overall (not limited by chart range).
  const { data: recentSales = [], isLoading: isLoadingRecentSales } = useQuery({
    queryKey: ['sales', 'dashboard', 'recent'],
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set('sort', '-sale_date');
      qs.set('limit', '15');
      qs.set('fields', salesFields);
      return apiGetJson(`/api/sales?${qs.toString()}`);
    },
    initialData: [],
  });

  // Platform performance: use server-side aggregate for correctness + speed.
  const { data: platformSummary = [], isLoading: isLoadingPlatformSummary } = useQuery({
    queryKey: ['sales', 'dashboard', 'platformSummary'],
    queryFn: () => apiGetJson('/api/sales/platform-summary'),
    initialData: [],
  });
  
  // Inventory query: use a distinct cache key so other pages (Inventory/Crosslist) don't overwrite it
  // with different queryFns (a source of "data appears after clicking Crosslist").
  const inventoryFields = React.useMemo(() => ([
    'id',
    'item_name',
    'status',
    'purchase_date',
    'quantity',
    'quantity_sold',
    'return_deadline',
    'return_deadline_dismissed',
    'deleted_at',
  ].join(',')), []);

  const { data: inventoryItems, isLoading: isLoadingInventory, error: inventoryError } = useQuery({
    queryKey: ['inventoryItems', 'dashboard'],
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set('sort', '-purchase_date');
      qs.set('limit', '5000');
      qs.set('fields', inventoryFields);
      return apiGetJson(`/api/inventory?${qs.toString()}`);
    },
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
    <div className="p-4 md:p-6 lg:p-0 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden w-full max-w-full">
      <div className="px-0 lg:px-6 py-4 lg:py-8 w-full max-w-7xl mx-auto">
        {(salesError || inventoryError || salesSummaryError) && (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertDescription>
                {salesSummaryError ? `Sales summary error: ${salesSummaryError.message}` : null}
                {salesError ? ` Sales (chart) error: ${salesError.message}` : null}
                {inventoryError ? ` Inventory load error: ${inventoryError.message}` : null}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 lg:mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your business performance</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Tip banner (Desktop only: next to Add Sale) */}
            <div className="hidden lg:block">
              <TipOfTheDay variant="banner" />
            </div>
            <div className="flex items-center gap-3">
              <Link to={createPageUrl("AddSale")}>
                <Button className="bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Sale
                </Button>
              </Link>
              <Link to={createPageUrl("AddInventoryItem")} state={{ from: location.pathname || "/Dashboard" }}>
                <Button variant="outline" className="border-gray-300 dark:border-gray-700">
                  <Package className="w-4 h-4 mr-2" />
                  Add Inventory
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          {/* Tip of the Day (Mobile only: above KPI cards) */}
          <div className="col-span-12 lg:hidden">
            <TipOfTheDay variant="banner" />
          </div>

          {/* KPI Row */}
          <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            <KpiSparkCard
              title="Total Profit"
              value={isLoadingSalesSummary ? "…" : `$${Number(totalProfit || 0).toFixed(0)}`}
              deltaLabel={null}
              deltaPositive={true}
              stroke="hsl(var(--po-positive))"
              data={(sales || []).slice(0, 30).reverse().map((s) => ({ v: Number(s?.profit ?? 0) || 0 }))}
            />
            <KpiSparkCard
              title="Total Sales"
              value={isLoadingSalesSummary ? "…" : String(totalSales || 0)}
              deltaLabel={null}
              deltaPositive={true}
              right={
                <Link to={createPageUrl("SalesHistory")} className="group">
                  <div className="h-12 w-12 rounded-xl bg-muted/40 flex items-center justify-center group-hover:bg-muted/60 transition-colors">
                    <ShoppingBag className="h-6 w-6 text-foreground" />
                  </div>
                </Link>
              }
            />
            <KpiSparkCard
              title="Items in Stock"
              value={isLoadingInventory ? "…" : String(inventoryStats.totalQuantity || 0)}
              deltaLabel={null}
              deltaPositive={true}
              right={
                <Link to={createPageUrl("Inventory")} className="group">
                  <div className="h-12 w-12 rounded-xl bg-muted/40 flex items-center justify-center group-hover:bg-muted/60 transition-colors">
                    <Box className="h-6 w-6 text-foreground" />
                  </div>
                </Link>
              }
            />
          </div>

          {/* Main chart + side card */}
          <div className="col-span-12 lg:col-span-8">
            <ProfitTrendCard
              sales={sales}
              range={desktopProfitRange}
              onRangeChange={setDesktopProfitRange}
              customRange={desktopCustomRange}
              onCustomRangeChange={setDesktopCustomRange}
            />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <PlatformDonutCard
              rows={platformSummary}
              title="Platform Revenue"
              reportsHref={createPageUrl("Reports")}
            />
          </div>

          {/* Your progress + quick actions */}
          <div className="col-span-12">
            <Gamification
              sales={sales}
              stats={{ totalProfit, totalSales, avgProfit, profitMargin, averageSaleSpeed }}
              variant="mosaic"
            />
          </div>
          <div className="col-span-12">
            <QuickActions />
          </div>

          {/* Recent sales (carousel) */}
          <div className="col-span-12">
            <RecentSales sales={recentSales} />
          </div>
        </div>
      </div>
    </div>
  );
}
