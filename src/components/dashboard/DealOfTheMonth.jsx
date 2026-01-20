
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO } from 'date-fns';
import { OptimizedImage } from '@/components/OptimizedImage';

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

const DealHighlight = ({ itemName, saleId, imageUrl, profit }) => {
  if (!saleId) {
    return (
      <Card className="bg-gray-50 dark:bg-gray-800/50 border-0 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 mb-3">
              <Award className="w-6 h-6 sm:w-7 sm:h-7 text-gray-400" />
            </div>
            <p className="text-sm sm:text-base font-medium text-gray-500 dark:text-gray-400">Highest Profit</p>
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">No sales this month yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link to={createPageUrl(`SoldItemDetail?id=${saleId}`)} className="block w-full">
      <Card className="bg-gray-50 dark:bg-gray-800/50 border-0 shadow-sm hover:shadow-lg transition-all duration-200 hover:scale-[1.02] group overflow-hidden w-full max-w-full">
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
            <div className="absolute top-2 right-2 p-2 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-md bg-gradient-to-br from-amber-400 to-yellow-500">
              <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
          </div>
          
          {/* Content */}
          <div className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Highest Profit</p>
            <p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400 mb-2">${(Number(profit ?? 0) || 0).toFixed(2)}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">{itemName}</p>
          </div>
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
  const highestProfit = React.useMemo(() => {
    const monthKey = effectiveMonthKey;
    const monthlySales = (sales ?? []).filter((sale) => {
      if (!sale?.sale_date) return false;
      // sale_date is DATE (yyyy-MM-dd). Use string match to avoid timezone drift.
      return String(sale.sale_date).startsWith(monthKey);
    });

    if (monthlySales.length === 0) {
      return null;
    }

    let bestDeal = null;

    monthlySales.forEach(sale => {
      const profit = Number(sale.profit ?? 0) || 0;
      if (!bestDeal || profit > bestDeal.profit) {
        bestDeal = sale;
      }
    });

    return bestDeal;
  }, [sales, effectiveMonthKey]);

  return (
    <Card className="border-0 shadow-sm overflow-hidden w-full">
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <CardTitle className="text-lg sm:text-xl font-bold text-foreground flex items-center flex-wrap gap-2 sm:gap-3">
          <span className="leading-tight">Deal of the Month</span>
          <span className="inline-flex items-center rounded-md border border-transparent px-2 py-0.5 sm:px-2.5 text-[10px] sm:text-xs font-semibold bg-blue-600 text-white shadow-sm">
            {monthLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 overflow-hidden w-full">
        <DealHighlight
          itemName={highestProfit?.item_name}
          saleId={highestProfit?.id}
          imageUrl={highestProfit?.image_url}
          profit={highestProfit?.profit}
        />
      </CardContent>
    </Card>
  );
}
