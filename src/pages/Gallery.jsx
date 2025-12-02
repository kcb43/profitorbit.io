
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, DollarSign, BarChart3, Clock, Award, Zap, TrendingUp, Trophy } from 'lucide-react';
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import ShowcaseItemModal from '../components/showcase/ShowcaseItemModal';
import { sortSalesByRecency } from "@/utils/sales";
import DealOfTheMonth from '../components/dashboard/DealOfTheMonth';
import { OptimizedImage } from '@/components/OptimizedImage';

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
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-sale_date'),
    initialData: [],
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter out soft-deleted sales
  const activeSales = useMemo(() => (rawSales ?? []).filter(sale => !sale.deleted_at), [rawSales]);
  const sortedSales = useMemo(() => sortSalesByRecency(activeSales), [activeSales]);

  const salesWithMetrics = useMemo(() => {
    if (!sortedSales) return [];
    return sortedSales.map(sale => {
      const purchasePrice = sale.purchase_price || 0;
      const profit = sale.profit || 0;
      let roi = 0;
      if (purchasePrice > 0) roi = (profit / purchasePrice) * 100;
      else if (profit > 0) roi = Infinity;

      const saleSpeed = sale.purchase_date ? differenceInDays(parseISO(sale.sale_date), parseISO(sale.purchase_date)) : 0;
      return { ...sale, roi, saleSpeed };
    });
  }, [rawSales]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const monthlySales = salesWithMetrics.filter(s => isWithinInterval(parseISO(s.sale_date), { start: monthStart, end: monthEnd }));
    
    const totalProfit = monthlySales.reduce((sum, s) => sum + s.profit, 0);
    const totalSaleSpeed = monthlySales.reduce((sum, s) => sum + s.saleSpeed, 0);
    const avgSellTime = monthlySales.length > 0 ? totalSaleSpeed / monthlySales.length : 0;

    let highestProfit = null;
    let fastestSale = null;
    let highestRoi = null;

    monthlySales.forEach(sale => {
        if (!highestProfit || sale.profit > highestProfit.profit) highestProfit = sale;
        if ((!fastestSale || sale.saleSpeed < fastestSale.saleSpeed) && sale.saleSpeed !== null) fastestSale = sale;
        if (!highestRoi || sale.roi > highestRoi.roi) highestRoi = sale;
    });

    return {
        salesCount: monthlySales.length,
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Showcase</h1>
            <p className="text-sm text-muted-foreground mt-1">Your successful sales at a glance.</p>
          </div>

          <div className="mb-6">
            <DealOfTheMonth sales={sortedSales} />
          </div>

          {/* Stats Cards - Stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sales</p>
                  <p className="text-xl font-bold text-foreground">{monthlyStats.salesCount}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profit</p>
                  <p className="text-xl font-bold text-foreground">${monthlyStats.totalProfit.toFixed(0)}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Time</p>
                  <p className="text-xl font-bold text-foreground">{monthlyStats.avgSellTime.toFixed(0)}d</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : salesWithMetrics.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {salesWithMetrics.map(sale => (
                <Card 
                  key={sale.id}
                  onClick={() => handleItemClick(sale)}
                  className="group overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
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
                        <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px] px-1.5 py-0.5">
                          +${sale.profit?.toFixed(0) || '0'}
                        </Badge>
                      ) : (
                        <Badge className="bg-red-600 hover:bg-red-600 text-white text-[10px] px-1.5 py-0.5">
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
              <p className="text-sm text-muted-foreground mt-2">Sold items will appear here.</p>
            </div>
          )}
        </div>
      </div>
      <ShowcaseItemModal item={selectedItem} isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  );
}
