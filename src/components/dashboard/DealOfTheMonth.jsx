
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Zap, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { OptimizedImage } from '@/components/OptimizedImage';

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

// Get season based on month (1-12)
const getSeason = (month) => {
  // Winter: Dec (12), Jan (1), Feb (2)
  // Spring: Mar (3), Apr (4), May (5)
  // Summer: Jun (6), Jul (7), Aug (8)
  // Fall: Sep (9), Oct (10), Nov (11)
  if (month === 12 || month <= 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'fall';
};

// Get seasonal background class
const getSeasonalBackground = (season) => {
  switch (season) {
    case 'summer':
      return 'bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-100 dark:from-yellow-900/20 dark:via-orange-900/20 dark:to-yellow-900/20 relative overflow-hidden';
    case 'winter':
      return 'bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 dark:from-blue-900/20 dark:via-cyan-900/20 dark:to-blue-900/20 relative overflow-hidden';
    case 'spring':
      return 'bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-green-900/20 relative overflow-hidden';
    case 'fall':
      return 'bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-900/20 dark:via-amber-900/20 dark:to-orange-900/20 relative overflow-hidden';
    default:
      return 'bg-gray-50 dark:bg-gray-800/50 relative overflow-hidden';
  }
};

// Seasonal decorative elements
const SeasonalDecorations = ({ season }) => {
  if (season === 'summer') {
    return (
      <>
        {/* Sun rays */}
        <div className="absolute top-0 right-0 w-24 h-24 opacity-20 dark:opacity-10">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-yellow-400 rounded-full"></div>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-400"
              style={{
                transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-20px)`,
              }}
            />
          ))}
        </div>
      </>
    );
  }
  if (season === 'winter') {
    return (
      <>
        {/* Snowflakes */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-blue-300 dark:text-blue-500/30 text-xs opacity-40"
            style={{
              top: `${10 + i * 15}%`,
              left: `${5 + (i % 3) * 30}%`,
              fontSize: '8px',
            }}
          >
            ❄
          </div>
        ))}
      </>
    );
  }
  return null;
};

const StatHighlight = ({ icon: Icon, color, title, value, itemName, saleId, imageUrl, month }) => {
  const season = React.useMemo(() => {
    if (!month) return 'spring';
    const monthNum = parseInt(month.split('-')[1], 10);
    return getSeason(monthNum);
  }, [month]);

  if (!saleId) {
    return (
      <Card className={`${getSeasonalBackground(season)} border-0 shadow-sm`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 mb-3">
              <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-gray-400" />
            </div>
            <p className="text-sm sm:text-base font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">No sales this month yet.</p>
          </div>
          <SeasonalDecorations season={season} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Link to={createPageUrl(`SoldItemDetail?id=${saleId}`)} className="block w-full">
      <Card className={`${getSeasonalBackground(season)} border-0 shadow-sm hover:shadow-lg transition-all duration-200 hover:scale-[1.02] group overflow-hidden w-full max-w-full`}>
        <CardContent className="p-0 relative w-full">
          {/* Image */}
          <div className="relative w-full h-32 sm:h-40 overflow-hidden bg-gray-100 dark:bg-gray-800">
            <OptimizedImage
              src={imageUrl || DEFAULT_IMAGE_URL}
              alt={itemName || 'Item'}
              fallback={DEFAULT_IMAGE_URL}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              lazy={true}
            />
            {/* Icon overlay */}
            <div className={`absolute top-2 right-2 p-2 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-md ${color}`}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
          </div>
          
          {/* Content */}
          <div className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">{value}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">{itemName}</p>
          </div>
          
          <SeasonalDecorations season={season} />
        </CardContent>
      </Card>
    </Link>
  );
};

export default function DealOfTheMonth({ sales, monthKey }) {
  const effectiveMonthKey = React.useMemo(() => {
    if (monthKey && /^\d{4}-\d{2}$/.test(String(monthKey))) return String(monthKey);
    return format(new Date(), 'yyyy-MM');
  }, [monthKey]);

  const monthLabel = React.useMemo(() => {
    try {
      return format(parseISO(`${effectiveMonthKey}-01`), 'MMMM yyyy');
    } catch {
      return format(new Date(), 'MMMM yyyy');
    }
  }, [effectiveMonthKey]);
  const deals = React.useMemo(() => {
    const monthKey = effectiveMonthKey;
    const monthlySales = (sales ?? []).filter((sale) => {
      if (!sale?.sale_date) return false;
      // sale_date is DATE (yyyy-MM-dd). Use string match to avoid timezone drift.
      return String(sale.sale_date).startsWith(monthKey);
    });

    if (monthlySales.length === 0) {
      return { highestProfit: null, fastestSale: null, highestRoi: null };
    }

    let highestProfit = null;
    let fastestSale = null;
    let highestRoi = null;

    monthlySales.forEach(sale => {
      const profit = Number(sale.profit ?? 0) || 0;
      const purchasePrice = Number(sale.purchase_price ?? 0) || 0;
      let roi = 0;
      if (purchasePrice > 0) {
        roi = (profit / purchasePrice) * 100;
      } else if (purchasePrice === 0 && profit > 0) {
        roi = Infinity;
      }
      
      const saleWithRoi = { ...sale, roi };

      let saleSpeed = null;
      if (sale.purchase_date) {
        try {
            saleSpeed = differenceInDays(parseISO(String(sale.sale_date)), parseISO(String(sale.purchase_date)));
        } catch (e) {
            saleSpeed = null;
        }
      }
      const saleWithSpeed = { ...saleWithRoi, saleSpeed };

      if (!highestProfit || profit > highestProfit.profit) {
        highestProfit = saleWithSpeed;
      }
      if (saleWithSpeed.saleSpeed !== null && (!fastestSale || saleWithSpeed.saleSpeed < fastestSale.saleSpeed)) {
        fastestSale = saleWithSpeed;
      }
      if (!highestRoi || saleWithSpeed.roi > highestRoi.roi) {
        highestRoi = saleWithSpeed;
      }
    });

    return { highestProfit, fastestSale, highestRoi };
  }, [sales, effectiveMonthKey]);

  return (
    <Card className="border-0 shadow-sm overflow-hidden w-full">
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <CardTitle className="text-lg sm:text-xl font-bold text-foreground flex items-center flex-wrap gap-2 sm:gap-3">
          <span className="leading-tight">Deals of the Month</span>
          <span className="inline-flex items-center rounded-md border border-transparent px-2 py-0.5 sm:px-2.5 text-[10px] sm:text-xs font-semibold bg-blue-600 text-white shadow-sm">
            {monthLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 overflow-hidden w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-full">
          <StatHighlight
            icon={Award}
            color="bg-gradient-to-br from-amber-400 to-yellow-500"
            title="Highest Profit"
            value={deals.highestProfit ? `$${(Number(deals.highestProfit.profit ?? 0) || 0).toFixed(2)}` : "N/A"}
            itemName={deals.highestProfit?.item_name}
            saleId={deals.highestProfit?.id}
            imageUrl={deals.highestProfit?.image_url}
            month={effectiveMonthKey}
          />
          <StatHighlight
            icon={Zap}
            color="bg-gradient-to-br from-sky-400 to-cyan-500"
            title="Fastest Sale"
            value={deals.fastestSale ? `${deals.fastestSale.saleSpeed} Day${deals.fastestSale.saleSpeed === 1 ? '' : 's'}` : "N/A"}
            itemName={deals.fastestSale?.item_name}
            saleId={deals.fastestSale?.id}
            imageUrl={deals.fastestSale?.image_url}
            month={effectiveMonthKey}
          />
          <StatHighlight
            icon={TrendingUp}
            color="bg-gradient-to-br from-green-500 to-emerald-600"
            title="Highest ROI"
            value={deals.highestRoi ? (isFinite(Number(deals.highestRoi.roi)) ? `${Number(deals.highestRoi.roi).toFixed(1)}%` : '∞%') : "N/A"}
            itemName={deals.highestRoi?.item_name}
            saleId={deals.highestRoi?.id}
            imageUrl={deals.highestRoi?.image_url}
            month={effectiveMonthKey}
          />
        </div>
      </CardContent>
    </Card>
  );
}
