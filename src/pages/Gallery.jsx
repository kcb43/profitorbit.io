
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { salesApi } from '@/api/salesApi';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, DollarSign, BarChart3, Clock, Award, Zap, TrendingUp, Trophy, Calendar, ChevronDown, Layers } from 'lucide-react';
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, startOfYear, subMonths, subYears } from 'date-fns';
import ShowcaseItemModal from '../components/showcase/ShowcaseItemModal';
import { sortSalesByRecency } from "@/utils/sales";
import DealOfTheMonth from '../components/dashboard/DealOfTheMonth';
import { OptimizedImage } from '@/components/OptimizedImage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

const platformIcons = {
  ebay: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
  facebook_marketplace: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
  mercari: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  etsy: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
  offer_up: "https://cdn.brandfetch.io/id5p1Knwlt/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B"
};

export default function GalleryPage() {
  const { data: rawSales, isLoading } = useQuery({
    queryKey: ['sales', 'gallery'],
    // Showcase: prefer correctness (all-time) while keeping an upper bound for performance.
    queryFn: () => {
      return salesApi.list('-sale_date', {
        since: '1970-01-01',
        limit: 5000,
        fields: [
          'id',
          'item_name',
          'purchase_date',
          'sale_date',
          'platform',
          'profit',
          'notes',
          'image_url',
          'deleted_at',
          'selling_price',
          'sale_price',
          'purchase_price',
          'shipping_cost',
          'platform_fees',
          'vat_fees',
          'other_costs',
          'created_at',
        ].join(','),
      });
    },
    placeholderData: [],
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState('all'); // all, this_month, last_3_months, this_year, last_year
  const [layoutVariation, setLayoutVariation] = useState(() => {
    // Load saved preference from localStorage
    return localStorage.getItem('gallery_layout_variation') || 'original';
  });
  
  // Save layout preference
  useEffect(() => {
    localStorage.setItem('gallery_layout_variation', layoutVariation);
  }, [layoutVariation]);

  // Filter out soft-deleted sales
  const activeSales = useMemo(() => (rawSales ?? []).filter(sale => !sale.deleted_at), [rawSales]);
  const sortedSales = useMemo(() => sortSalesByRecency(activeSales), [activeSales]);

  // Calculate date range bounds
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy') };
      case 'last_3_months':
        return { start: startOfMonth(subMonths(now, 2)), end: now, label: 'Last 3 Months' };
      case 'this_year':
        return { start: startOfYear(now), end: now, label: format(now, 'yyyy') };
      case 'last_year':
        return { start: startOfYear(subYears(now, 1)), end: endOfMonth(subYears(now, 1)), label: format(subYears(now, 1), 'yyyy') };
      case 'all':
      default:
        return { start: null, end: null, label: 'All Time' };
    }
  }, [dateRange]);

  const salesWithMetrics = useMemo(() => {
    if (!sortedSales) return [];
    
    // Filter by date range
    let filtered = sortedSales;
    if (dateRangeBounds.start && dateRangeBounds.end) {
      filtered = sortedSales.filter(sale => {
        if (!sale?.sale_date) return false;
        const saleDate = parseISO(sale.sale_date);
        return saleDate >= dateRangeBounds.start && saleDate <= dateRangeBounds.end;
      });
    }
    
    return filtered.map(sale => {
      const purchasePrice = sale.purchase_price || 0;
      const profit = sale.profit || 0;
      let roi = 0;
      if (purchasePrice > 0) roi = (profit / purchasePrice) * 100;
      else if (profit > 0) roi = Infinity;

      const saleSpeed = sale.purchase_date ? differenceInDays(parseISO(sale.sale_date), parseISO(sale.purchase_date)) : 0;
      return { ...sale, roi, saleSpeed };
    });
  }, [sortedSales, dateRangeBounds]);

  const stats = useMemo(() => {
    const filteredSales = salesWithMetrics;
    
    const totalProfit = filteredSales.reduce((sum, s) => sum + (Number(s.profit ?? 0) || 0), 0);
    const totalSaleSpeed = filteredSales.reduce((sum, s) => sum + s.saleSpeed, 0);
    const avgSellTime = filteredSales.length > 0 ? totalSaleSpeed / filteredSales.length : 0;

    let highestProfit = null;
    let fastestSale = null;
    let highestRoi = null;

    filteredSales.forEach(sale => {
        if (!highestProfit || (Number(sale.profit ?? 0) || 0) > (Number(highestProfit.profit ?? 0) || 0)) highestProfit = sale;
        if ((!fastestSale || sale.saleSpeed < fastestSale.saleSpeed) && sale.saleSpeed !== null) fastestSale = sale;
        if (!highestRoi || sale.roi > highestRoi.roi) highestRoi = sale;
    });

    return {
        salesCount: filteredSales.length,
        totalProfit,
        avgSellTime,
        topFlips: { highestProfit, fastestSale, highestRoi }
    };
  }, [salesWithMetrics]);

  const handleItemClick = (sale) => {
    setSelectedItem(sale);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = (open) => {
    if (typeof open === "boolean") {
      setIsModalOpen(open);
      if (!open) setSelectedItem(null);
    } else {
      setIsModalOpen(false);
      setSelectedItem(null);
    }
  };

  // Render header controls
  const renderHeaderControls = () => (
    <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">Showcase</h1>
        <p className="text-sm text-muted-foreground mt-1 break-words">Your successful sales at a glance.</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
        {/* Date Range Selector */}
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_3_months">Last 3 Months</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
            <SelectItem value="last_year">Last Year</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Layout Variation Toggle */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Layers className="h-4 w-4 mr-2" />
              Layout
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="end">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Choose Layout</p>
              <button
                onClick={() => setLayoutVariation('original')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${layoutVariation === 'original' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100' : 'hover:bg-muted'}`}
              >
                Original
              </button>
              <button
                onClick={() => setLayoutVariation('variation1')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${layoutVariation === 'variation1' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100' : 'hover:bg-muted'}`}
              >
                Minimal
              </button>
              <button
                onClick={() => setLayoutVariation('variation2')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${layoutVariation === 'variation2' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100' : 'hover:bg-muted'}`}
              >
                Premium
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  // Original Layout (existing design)
  const renderOriginalLayout = () => (
    <>
      <div className="mb-6 w-full max-w-full min-w-0 overflow-x-hidden">
        <DealOfTheMonth sales={salesWithMetrics} monthKey={dateRange === 'this_month' ? format(new Date(), 'yyyy-MM') : null} />
      </div>

      {/* Stats Cards - Horizontal layout with text at bottom */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 w-full max-w-full min-w-0 overflow-x-hidden">
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group w-full max-w-full min-w-0 overflow-hidden" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <CardContent className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[100px] w-full max-w-full min-w-0" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg mb-2 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground mb-1">{stats.salesCount}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Sales</p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group w-full max-w-full min-w-0 overflow-hidden" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <CardContent className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[100px] w-full max-w-full min-w-0" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-lg mb-2 group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground mb-1 break-words">${stats.totalProfit.toFixed(0)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground break-words">Profit</p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group w-full max-w-full min-w-0 overflow-hidden" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <CardContent className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[100px] w-full max-w-full min-w-0" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <div className="p-2 sm:p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg mb-2 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground mb-1">{stats.avgSellTime.toFixed(0)}d</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Avg Time</p>
          </CardContent>
        </Card>
      </div>
    </>
  );

  // Variation 1: Minimal - Horizontal stat bar with compact Deal of Month
  const renderVariation1 = () => (
    <>
      {/* Compact Stats Bar */}
      <div className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-2xl p-6 border border-emerald-200/50 dark:border-emerald-800/30">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Date Range Label */}
          <div className="flex flex-col justify-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Period</p>
            <p className="text-lg font-bold text-foreground">{dateRangeBounds.label}</p>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-4 md:col-span-3">
            <div className="flex-1 text-center p-4 bg-white/50 dark:bg-background/50 rounded-xl">
              <p className="text-2xl md:text-3xl font-bold text-foreground">{stats.salesCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Sales</p>
            </div>
            <div className="flex-1 text-center p-4 bg-white/50 dark:bg-background/50 rounded-xl">
              <p className="text-2xl md:text-3xl font-bold text-emerald-600">${stats.totalProfit.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Profit</p>
            </div>
            <div className="flex-1 text-center p-4 bg-white/50 dark:bg-background/50 rounded-xl">
              <p className="text-2xl md:text-3xl font-bold text-foreground">{stats.avgSellTime.toFixed(0)}d</p>
              <p className="text-xs text-muted-foreground mt-1">Avg Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Deal of the Month - Click to expand */}
      {stats.topFlips.highestProfit && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-full mb-6 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 rounded-2xl p-4 border border-amber-200/50 dark:border-amber-800/30 hover:shadow-md transition-all text-left">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden">
                  <OptimizedImage
                    src={stats.topFlips.highestProfit.image_url || DEFAULT_IMAGE_URL}
                    alt={stats.topFlips.highestProfit.item_name}
                    fallback={DEFAULT_IMAGE_URL}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="h-4 w-4 text-amber-600" />
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Best Deal</p>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{stats.topFlips.highestProfit.item_name}</p>
                  <p className="text-lg font-bold text-emerald-600">${stats.topFlips.highestProfit.profit.toFixed(2)}</p>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="center">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-foreground">Deal Details</h3>
              </div>
              <div className="aspect-square rounded-lg overflow-hidden">
                <OptimizedImage
                  src={stats.topFlips.highestProfit.image_url || DEFAULT_IMAGE_URL}
                  alt={stats.topFlips.highestProfit.item_name}
                  fallback={DEFAULT_IMAGE_URL}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="font-semibold text-foreground">{stats.topFlips.highestProfit.item_name}</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profit:</span>
                    <span className="font-semibold text-emerald-600">${stats.topFlips.highestProfit.profit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ROI:</span>
                    <span className="font-semibold text-foreground">{stats.topFlips.highestProfit.roi === Infinity ? '∞' : `${stats.topFlips.highestProfit.roi.toFixed(0)}%`}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sold:</span>
                    <span className="text-foreground">{format(parseISO(stats.topFlips.highestProfit.sale_date), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </>
  );

  // Variation 2: Premium - Side-by-side layout with gradient cards
  const renderVariation2 = () => (
    <div className="mb-6 space-y-4">
      {/* Stats in horizontal cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="h-8 w-8" />
              <Badge className="bg-white/20 text-white border-white/30">
                {dateRangeBounds.label}
              </Badge>
            </div>
            <p className="text-4xl font-bold mb-1">{stats.salesCount}</p>
            <p className="text-sm opacity-90">Total Sales</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-8 w-8" />
              <TrendingUp className="h-6 w-6 opacity-50" />
            </div>
            <p className="text-4xl font-bold mb-1">${stats.totalProfit.toFixed(0)}</p>
            <p className="text-sm opacity-90">Total Profit</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8" />
              <Zap className="h-6 w-6 opacity-50" />
            </div>
            <p className="text-4xl font-bold mb-1">{stats.avgSellTime.toFixed(0)}</p>
            <p className="text-sm opacity-90">Days to Sell</p>
          </div>
        </div>
      </div>

      {/* Best Deal Banner */}
      {stats.topFlips.highestProfit && (
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-950/30 dark:via-yellow-950/30 dark:to-amber-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-amber-200 dark:ring-amber-800">
                  <OptimizedImage
                    src={stats.topFlips.highestProfit.image_url || DEFAULT_IMAGE_URL}
                    alt={stats.topFlips.highestProfit.item_name}
                    fallback={DEFAULT_IMAGE_URL}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -top-2 -right-2 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full p-2 shadow-lg">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-amber-600 text-white">Best Deal</Badge>
                  <span className="text-xs text-muted-foreground">{dateRangeBounds.label}</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-1 truncate">{stats.topFlips.highestProfit.item_name}</h3>
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">${stats.topFlips.highestProfit.profit.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Profit</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      {stats.topFlips.highestProfit.roi === Infinity ? '∞' : `${stats.topFlips.highestProfit.roi.toFixed(0)}%`}
                    </p>
                    <p className="text-xs text-muted-foreground">ROI</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-lg font-semibold text-foreground">{stats.topFlips.highestProfit.saleSpeed}d</p>
                    <p className="text-xs text-muted-foreground">Sale Speed</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background overflow-x-hidden w-full" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <div className="p-4 md:p-6 lg:p-8 w-full overflow-x-hidden" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
        <div className="max-w-7xl mx-auto w-full overflow-x-hidden min-w-0" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
          
          {/* Header with Controls */}
          {renderHeaderControls()}
          
          {/* Render selected layout variation */}
          {layoutVariation === 'original' && renderOriginalLayout()}
          {layoutVariation === 'variation1' && renderVariation1()}
          {layoutVariation === 'variation2' && renderVariation2()}

          {/* Main Grid - Item Showcase */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 w-full max-w-full min-w-0" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg w-full max-w-full" />
              ))}
            </div>
          ) : salesWithMetrics.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 w-full max-w-full min-w-0" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
              {salesWithMetrics.map(sale => (
                <Card 
                  key={sale.id}
                  onClick={() => handleItemClick(sale)}
                  className="group overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer w-full max-w-full min-w-0"
                >
                  <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                    <OptimizedImage
                      src={sale.image_url || DEFAULT_IMAGE_URL}
                      alt={sale.item_name}
                      fallback={DEFAULT_IMAGE_URL}
                      className="w-full h-full object-cover"
                      lazy={true}
                    />
                    <div className="absolute top-2 right-2">
                      {sale.profit >= 0 ? (
                        <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs px-2 py-1">
                          +${sale.profit?.toFixed(0) || '0'}
                        </Badge>
                      ) : (
                        <Badge className="bg-red-600 hover:bg-red-600 text-white text-xs px-2 py-1">
                          -${Math.abs(sale.profit)?.toFixed(0) || '0'}
                        </Badge>
                      )}
                    </div>
                    {platformIcons[sale.platform] && (
                      <div className="absolute bottom-2 left-2 w-5 h-5 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center p-0.5">
                        <img src={platformIcons[sale.platform]} alt={sale.platform} className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white font-semibold text-xs truncate">{sale.item_name}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground">Your Showcase is Empty</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {dateRange !== 'all' ? `No sales found for ${dateRangeBounds.label}.` : 'Sold items will appear here.'}
              </p>
            </div>
          )}
        </div>
      </div>
      <ShowcaseItemModal item={selectedItem} isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  );
}
