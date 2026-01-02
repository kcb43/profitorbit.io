
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Zap, TrendingUp, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO, differenceInDays } from 'date-fns';

const StatHighlight = ({ icon: Icon, color, title, value, itemName, saleId }) => {
  if (!saleId) {
    return (
      <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="p-2.5 sm:p-3 rounded-full bg-gray-200 dark:bg-gray-700">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
        </div>
        <div>
          <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">No sales this month yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
      <div className={`p-2.5 sm:p-3 rounded-full bg-gradient-to-br ${color} text-white shadow-md flex-shrink-0`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        <Link
          to={createPageUrl(`SoldItemDetail?id=${saleId}`)}
          className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block"
        >
          {itemName}
        </Link>
      </div>
    </div>
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
    <Card className="border-0 shadow-sm">
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-6">
        <CardTitle className="text-lg sm:text-xl font-bold text-foreground flex items-center flex-wrap gap-2 sm:gap-3">
          <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
          <span className="leading-tight">Deals of the Month</span>
          <span className="inline-flex items-center rounded-md border border-transparent px-2 py-0.5 sm:px-2.5 text-[10px] sm:text-xs font-semibold bg-blue-600 text-white shadow-sm">
            {monthLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatHighlight
            icon={Award}
            color="from-amber-400 to-yellow-500"
            title="Highest Profit"
            value={deals.highestProfit ? `$${(Number(deals.highestProfit.profit ?? 0) || 0).toFixed(2)}` : "N/A"}
            itemName={deals.highestProfit?.item_name}
            saleId={deals.highestProfit?.id}
          />
          <StatHighlight
            icon={Zap}
            color="from-sky-400 to-cyan-500"
            title="Fastest Sale"
            value={deals.fastestSale ? `${deals.fastestSale.saleSpeed} Day${deals.fastestSale.saleSpeed === 1 ? '' : 's'}` : "N/A"}
            itemName={deals.fastestSale?.item_name}
            saleId={deals.fastestSale?.id}
          />
          <StatHighlight
            icon={TrendingUp}
            color="from-green-500 to-emerald-600"
            title="Highest ROI"
            value={deals.highestRoi ? (isFinite(Number(deals.highestRoi.roi)) ? `${Number(deals.highestRoi.roi).toFixed(1)}%` : '∞%') : "N/A"}
            itemName={deals.highestRoi?.item_name}
            saleId={deals.highestRoi?.id}
          />
        </div>
      </CardContent>
    </Card>
  );
}
