
import React, { useState, useEffect } from "react";
import { apiClient } from "@/api/base44Client";
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
import { DollarSign, TrendingUp, ShoppingBag, Percent, Plus, Package, AlarmClock, Lightbulb, Timer, Star, Box, Bell, ChevronDown, Settings, Search, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/api/supabaseClient";
import { ProductSearchDialog } from "@/components/ProductSearchDialog";

import StatCard from "../components/dashboard/StatCard";
import ProfitChart from "../components/dashboard/ProfitChart";
import PlatformBreakdown from "../components/dashboard/PlatformBreakdown";
import RecentSales from "../components/dashboard/RecentSales";
import Gamification from "../components/dashboard/Gamification";
import TipOfTheDay from "../components/dashboard/TipOfTheDay";
import QuickActions from "../components/dashboard/QuickActions";
import LiveChat from "../components/dashboard/LiveChat";
import KpiSparkCard from "../components/dashboard/mosaic/KpiSparkCard";
import ProfitTrendCard from "../components/dashboard/mosaic/ProfitTrendCard";
import PlatformRevenueTableCard from "../components/dashboard/mosaic/PlatformRevenueTableCard";
import WelcomeInsightsRow from "../components/dashboard/WelcomeInsightsRow";
import AnalyticsPdfDialog from "../components/reports/AnalyticsPdfDialog";

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
  const [profitChartRange, setProfitChartRange] = useState('monthly');
  const [desktopProfitRange, setDesktopProfitRange] = useState('monthly');
  const [desktopCustomRange, setDesktopCustomRange] = useState(undefined);
  const [stockAlertsOpen, setStockAlertsOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');

  // Load user display name for the welcome card
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        setDisplayName(
          meta.display_name || meta.full_name || meta.name ||
          session.user.email?.split('@')[0] || ''
        );
      }
    });
  }, []);

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
    placeholderData: { totalProfit: 0, totalRevenue: 0, totalSales: 0 },
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
    placeholderData: [],
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
    placeholderData: [],
  });

  // Platform performance: use server-side aggregate for correctness + speed.
  const { data: platformSummary = [], isLoading: isLoadingPlatformSummary } = useQuery({
    queryKey: ['sales', 'dashboard', 'platformSummary'],
    queryFn: () => apiGetJson('/api/sales/platform-summary'),
    placeholderData: [],
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
    placeholderData: [],
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
        const deadline = item.return_deadline ? parseISO(item.return_deadline) : null;
        if (!deadline) return false;
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
        const purchaseDate = item.purchase_date ? parseISO(item.purchase_date) : null;
        if (!purchaseDate) return false;
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
          const saleDate = parseISO(sale.sale_date);
          const purchaseDate = parseISO(sale.purchase_date);
          return differenceInDays(saleDate, purchaseDate);
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

  const hasStockAlerts = (itemsWithUpcomingReturns?.length || 0) > 0 || (staleItems?.length || 0) > 0;
  
  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      <div className="w-full max-w-7xl mx-auto">
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
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="hidden lg:block text-sm text-muted-foreground mt-1">Track your business performance</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Tip banner (Desktop only: next to Add Sale) */}
            <div className="hidden lg:block">
              <TipOfTheDay variant="banner" />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setExportOpen(true)} className="hidden sm:flex gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Link to={createPageUrl("AddSale")}>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Sale
                </Button>
              </Link>
              <Link to={createPageUrl("AddInventoryItem")} state={{ from: location.pathname || "/Dashboard" }}>
                <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25">
                  <Package className="w-4 h-4 mr-2" />
                  Add Inventory
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Welcome + Insights row */}
        <WelcomeInsightsRow
          displayName={displayName}
          salesMetrics={{ totalProfit, totalRevenue, totalSales, avgProfit, profitMargin, averageSaleSpeed }}
          inventoryStats={inventoryStats}
          platformSummary={platformSummary}
        />

        {/* Desktop-only: attention cards at top */}
        {(itemsWithUpcomingReturns?.length || 0) > 0 && (
          <div className="hidden lg:block mb-6">
            <Link to={createPageUrl("Inventory?filter=returnDeadline")} className="block">
              <div className="relative rounded-2xl p-5 backdrop-blur bg-card border border-red-500/40 hover:border-red-500/60 transition shadow-sm overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-red-500/15 to-rose-500/10 rounded-full blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-500 via-red-600 to-rose-500 shadow-lg shadow-red-500/30 flex-shrink-0">
                    <AlarmClock className="w-7 h-7 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Return Deadlines</div>
                    <div className="text-3xl font-bold text-foreground">{itemsWithUpcomingReturns.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">View items to return</div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          {/* Tip of the Day (Mobile only: above KPI cards) */}
          <div className="col-span-12 lg:hidden">
            <TipOfTheDay variant="banner" />
          </div>

          {/* KPI Row - Desktop: 4 cards with hover expansion */}
          <div className="col-span-12 hidden md:grid text-sm grid-cols-2 lg:grid-cols-4 gap-3 rounded-2xl p-3 bg-card/50 border border-border">
            {/* Total Profit Card */}
            <div className="bg-card group relative border border-border rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/50">
              <h5 className="text-muted-foreground text-xs font-medium uppercase">Total Profit</h5>
              <div className="items-baseline flex mt-2 gap-1">
                <div className="text-foreground text-xl font-medium">
                  {isLoadingSalesSummary ? "…" : `$${Number(totalProfit || 0).toFixed(0)}`}
                </div>
                <div className="text-muted-foreground text-xs">all-time</div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3">
                <div className="bg-muted/50 flex w-full h-1 rounded-full overflow-hidden">
                  <div className="bg-emerald-500" style={{ width: `${Math.min((totalProfit / (totalProfit + 1000)) * 100, 100)}%` }}></div>
                </div>
                
                {/* Expanded content on hover */}
                <div className="grid [grid-template-rows:0fr] group-hover:[grid-template-rows:1fr] transition-all duration-500 ease-in-out text-xs text-muted-foreground">
                  <div className="overflow-hidden min-h-0">
                    <div className="flex-col pb-1 pt-4 flex gap-3 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 delay-150">
                      <div className="items-center flex w-full justify-between">
                        <div className="flex items-center">
                          <div className="bg-emerald-500 w-2 h-2 mr-1.5 rounded-full"></div>
                          <div>Avg Profit/Sale</div>
                        </div>
                        <div className="font-medium text-foreground">${avgProfit.toFixed(2)}</div>
                      </div>
                      <div className="items-center flex w-full justify-between">
                        <div className="flex items-center">
                          <div className="bg-blue-500 w-2 h-2 mr-1.5 rounded-full"></div>
                          <div>Profit Margin</div>
                        </div>
                        <div className="font-medium text-foreground">{profitMargin.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Sales Card */}
            <div className="bg-card group relative border border-border rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/50">
              <h5 className="text-muted-foreground text-xs font-medium uppercase">Total Sales</h5>
              <div className="items-baseline flex mt-2 gap-1">
                <div className="text-foreground text-xl font-medium">
                  {isLoadingSalesSummary ? "…" : String(totalSales || 0)}
                </div>
                <div className="text-muted-foreground text-xs">items sold</div>
              </div>
              
              <div className="mt-3">
                <div className="bg-muted/50 flex w-full h-1 rounded-full gap-[0.13rem] overflow-hidden">
                  <div className="bg-blue-500" style={{ width: '60%' }}></div>
                  <div className="bg-purple-500" style={{ width: '40%' }}></div>
                </div>
                
                <div className="grid [grid-template-rows:0fr] group-hover:[grid-template-rows:1fr] transition-all duration-500 ease-in-out text-xs text-muted-foreground">
                  <div className="overflow-hidden min-h-0">
                    <div className="flex-col pb-1 pt-4 flex gap-3 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 delay-150">
                      <div className="items-center flex w-full justify-between">
                        <div className="flex items-center">
                          <div className="bg-blue-500 w-2 h-2 mr-1.5 rounded-full"></div>
                          <div>Total Revenue</div>
                        </div>
                        <div className="font-medium text-foreground">${Number(totalRevenue || 0).toFixed(0)}</div>
                      </div>
                      <div className="items-center flex w-full justify-between">
                        <div className="flex items-center">
                          <div className="bg-purple-500 w-2 h-2 mr-1.5 rounded-full"></div>
                          <div>Avg Sale Speed</div>
                        </div>
                        <div className="font-medium text-foreground">{averageSaleSpeed.toFixed(0)} days</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Items in Stock Card */}
            <div className="bg-card group relative border border-border rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-500/50">
              <h5 className="text-muted-foreground text-xs font-medium uppercase">Items in Stock</h5>
              <div className="items-baseline flex mt-2 gap-1">
                <div className="text-foreground text-xl font-medium">
                  {isLoadingInventory ? "…" : String(inventoryStats.totalQuantity || 0)}
                </div>
                <div className="text-muted-foreground text-xs">available</div>
              </div>
              
              <div className="mt-3">
                <div className="bg-muted/50 flex w-full h-1 rounded-full overflow-hidden">
                  <div className="bg-purple-500" style={{ width: `${Math.min((inventoryStats.totalQuantity / (inventoryStats.totalQuantity + 10)) * 100, 100)}%` }}></div>
                </div>
                
                <div className="grid [grid-template-rows:0fr] group-hover:[grid-template-rows:1fr] transition-all duration-500 ease-in-out text-xs text-muted-foreground">
                  <div className="overflow-hidden min-h-0">
                    <div className="flex-col pb-1 pt-4 flex gap-3 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 delay-150">
                      <div className="items-center flex w-full justify-between">
                        <div className="flex items-center">
                          <div className="bg-amber-500 w-2 h-2 mr-1.5 rounded-full"></div>
                          <div>Return Deadlines</div>
                        </div>
                        <div className="font-medium text-foreground">{itemsWithUpcomingReturns?.length || 0}</div>
                      </div>
                      <div className="items-center flex w-full justify-between">
                        <div className="flex items-center">
                          <div className="bg-emerald-500 w-2 h-2 mr-1.5 rounded-full"></div>
                          <div>Needs Listing</div>
                        </div>
                        <div className="font-medium text-foreground">{staleItems?.length || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Performance Card */}
            <div className="bg-card group relative border border-border rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/10 hover:border-teal-500/50">
              <h5 className="text-muted-foreground text-xs font-medium uppercase">Platform Mix</h5>
              <div className="items-baseline flex mt-2 gap-1">
                <div className="text-foreground text-xl font-medium">
                  {isLoadingPlatformSummary ? "…" : platformSummary.length}
                </div>
                <div className="text-muted-foreground text-xs">platforms</div>
              </div>
              
              <div className="mt-3">
                <div className="bg-muted/50 flex w-full h-1 rounded-full gap-[0.13rem] overflow-hidden">
                  <div className="bg-emerald-500" style={{ width: '40%' }}></div>
                  <div className="bg-blue-500" style={{ width: '35%' }}></div>
                  <div className="bg-purple-500" style={{ width: '25%' }}></div>
                </div>
                
                <div className="grid [grid-template-rows:0fr] group-hover:[grid-template-rows:1fr] transition-all duration-500 ease-in-out text-xs text-muted-foreground">
                  <div className="overflow-hidden min-h-0">
                    <div className="flex-col pb-1 pt-4 flex gap-3 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 delay-150">
                    {platformSummary.slice(0, 2).map((platform, idx) => (
                      <div key={idx} className="items-center flex w-full justify-between">
                        <div className="flex items-center">
                          <div 
                            className={`w-2 h-2 mr-1.5 rounded-full ${
                              idx === 0 ? 'bg-emerald-500' : 'bg-blue-500'
                            }`}
                          ></div>
                          <div className="capitalize">{platform.platform || 'Unknown'}</div>
                        </div>
                        <div className="font-medium text-foreground">${Number(platform.total_profit || 0).toFixed(0)}</div>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Row - Mobile: Original 3-card layout */}
          <div className="col-span-12 md:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            <KpiSparkCard
              title="Total Profit"
              value={isLoadingSalesSummary ? "…" : `$${Number(totalProfit || 0).toFixed(0)}`}
              deltaLabel={null}
              deltaPositive={true}
              stroke="hsl(var(--po-positive))"
              data={(sales || []).slice(0, 30).reverse().map((s) => ({ v: Number(s?.profit ?? 0) || 0 }))}
              right={
                <Link to={createPageUrl("Gallery")} className="group">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </Link>
              }
            />
            <KpiSparkCard
              title="Total Sales"
              value={isLoadingSalesSummary ? "…" : String(totalSales || 0)}
              deltaLabel={null}
              deltaPositive={true}
              right={
                <Link to={createPageUrl("SalesHistory")} className="group">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
                    <ShoppingBag className="h-6 w-6 text-white" />
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
                <div className="flex items-center gap-2">
                  {hasStockAlerts && (
                    <button
                      type="button"
                      onClick={() => setStockAlertsOpen((v) => !v)}
                      className="lg:hidden inline-flex items-center gap-1 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-2 py-2 text-yellow-700 dark:text-yellow-300"
                      aria-label="Show inventory alerts"
                    >
                      <Bell className="h-4 w-4" />
                      <ChevronDown className={`h-4 w-4 transition-transform ${stockAlertsOpen ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  <Link to={createPageUrl("Inventory")} className="group">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:scale-105 transition-transform">
                      <Box className="h-6 w-6 text-white" />
                    </div>
                  </Link>
                </div>
              }
            />
          </div>

          {/* Mobile-only: expandable attention cards under Items in Stock */}
          {hasStockAlerts && stockAlertsOpen && (
            <div className="col-span-12 lg:hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(itemsWithUpcomingReturns?.length || 0) > 0 && (
                  <Link to={createPageUrl("Inventory?filter=returnDeadline")} className="block">
                    <div className="relative rounded-2xl p-4 backdrop-blur bg-card border border-red-500/40 shadow-sm overflow-hidden">
                      <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-red-500/15 to-rose-500/10 rounded-full blur-2xl" />
                      <div className="relative flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-500 via-red-600 to-rose-500 shadow-lg shadow-red-500/25 flex-shrink-0">
                          <AlarmClock className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Return Deadlines</div>
                          <div className="text-2xl font-bold text-foreground">{itemsWithUpcomingReturns.length}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">View items to return</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
                {(staleItems?.length || 0) > 0 && (
                  <Link to={createPageUrl("Inventory?filter=stale")} className="block">
                    <div className="relative rounded-2xl p-4 backdrop-blur bg-card border border-emerald-500/35 shadow-sm overflow-hidden">
                      <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-emerald-500/15 to-teal-500/10 rounded-full blur-2xl" />
                      <div className="relative flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-500 shadow-lg shadow-emerald-500/25 flex-shrink-0">
                          <Lightbulb className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Smart Reminder</div>
                          <div className="text-2xl font-bold text-foreground">{staleItems.length}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">Items need listing</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}

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
            <PlatformRevenueTableCard
              rows={platformSummary}
              title="Platform Performance"
              reportsHref={createPageUrl("PlatformPerformance")}
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

        {/* Product Search Dialog */}
        <ProductSearchDialog
          open={productSearchOpen}
          onOpenChange={setProductSearchOpen}
        />

        <AnalyticsPdfDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          defaultRange="lifetime"
        />
      </div>
    </div>
  );
}
