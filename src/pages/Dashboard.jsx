
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { sortSalesByRecency } from "@/utils/sales";
import {
  format,
  parseISO,
  differenceInDays,
  isAfter,
} from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/api/supabaseClient";
import { ProductSearchDialog } from "@/components/ProductSearchDialog";

import DashboardV3 from "../components/dashboard/variants/DashboardV3";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [profitChartRange, setProfitChartRange] = useState('monthly');
  const [desktopProfitRange, setDesktopProfitRange] = useState('monthly');
  const [desktopCustomRange, setDesktopCustomRange] = useState(undefined);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
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

  const salesMetrics = { totalProfit, totalRevenue, totalSales, avgProfit, profitMargin, averageSaleSpeed };

  const variantProps = {
    salesMetrics,
    inventoryStats,
    platformSummary,
    isLoading: {
      salesSummary: isLoadingSalesSummary,
      sales: isLoadingSales,
      inventory: isLoadingInventory,
      platformSummary: isLoadingPlatformSummary,
    },
    sales,
    recentSales,
    itemsWithUpcomingReturns,
    staleItems,
    displayName,
    profitRange: desktopProfitRange,
    onProfitRangeChange: setDesktopProfitRange,
    customRange: desktopCustomRange,
    onCustomRangeChange: setDesktopCustomRange,
  };

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

        <DashboardV3 {...variantProps} />

        {/* Product Search Dialog */}
        <ProductSearchDialog
          open={productSearchOpen}
          onOpenChange={setProductSearchOpen}
        />

      </div>
    </div>
  );
}
