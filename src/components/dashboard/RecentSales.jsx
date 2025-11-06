
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, subDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { ArchiveRestore, TrendingUp } from "lucide-react";

const platformIcons = {
  ebay: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
  facebook_marketplace: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/f0f473258_sdfsdv.jpeg",
  mercari: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  etsy: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
  offer_up: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/c0f886f60_Symbol.png"
};

const platformColors = {
  ebay: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
  facebook_marketplace: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100",
  etsy: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100",
  mercari: "bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-100",
  offer_up: "bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-100"
};

const platformNames = {
  ebay: "eBay",
  facebook_marketplace: "Facebook",
  etsy: "Etsy",
  mercari: "Mercari",
  offer_up: "OfferUp"
};

const WeeklyProfitMiniChart = ({ sales }) => {
  const chartData = React.useMemo(() => {
    const endDate = new Date();
    const startDate = subDays(endDate, 6);
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    const dailyProfits = dateRange.map(date => {
      const dailySales = sales.filter(sale => isSameDay(parseISO(sale.sale_date), date));
      const profit = dailySales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
      return {
        date: format(date, 'MMM d'),
        profit: profit,
      };
    });
    return dailyProfits;
  }, [sales]);

  return (
    <div className="mt-6">
       <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
         <TrendingUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
         Last 7 Days Profit
       </h3>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="miniProfitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
            formatter={(value) => [`$${value.toFixed(2)}`, 'Profit']}
          />
          <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#miniProfitGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function RecentSales({ sales }) {
  const recentSales = sales.slice(0, 10);
  const navigate = useNavigate();

  const handleAddToInventory = (e, sale) => {
    e.preventDefault();
    e.stopPropagation();
    const params = new URLSearchParams();
    if (sale.item_name) params.set('itemName', sale.item_name);
    if (sale.purchase_price) params.set('purchasePrice', sale.purchase_price);
    if (sale.purchase_date) params.set('purchaseDate', sale.purchase_date);
    if (sale.source) params.set('source', sale.source);
    if (sale.category) params.set('category', sale.category);
    if (sale.image_url) params.set('imageUrl', sale.image_url);
    if (sale.notes) params.set('notes', sale.notes);

    navigate(createPageUrl(`AddInventoryItem?${params.toString()}`));
  };

  return (
    <Carousel
      opts={{ align: "start", loop: recentSales.length > 4 }}
      className="w-full"
    >
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold text-foreground">Recent Sales</CardTitle>
          {recentSales.length > 4 && (
            <div className="flex gap-2">
              <CarouselPrevious className="relative translate-y-0 left-0 top-0"/>
              <CarouselNext className="relative translate-y-0 right-0 top-0"/>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {recentSales.length > 0 ? (
              <CarouselContent className="-ml-4">
                {recentSales.map((sale) => (
                  <CarouselItem key={sale.id} className="pl-4 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                    <div className="group relative">
                      <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}`)}>
                        <div className="overflow-hidden rounded-xl relative shadow-md">
                          <div className="aspect-square bg-gray-100 dark:bg-gray-800">
                            <img
                              src={sale.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                              alt={sale.item_name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-green-600/90 text-white border-green-500 shadow-lg dark:[text-shadow:0_0_6px_rgba(34,197,94,0.5)]">${sale.profit?.toFixed(2) || '0.00'}</Badge>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                            <p className="text-white font-semibold text-sm truncate">{sale.item_name}</p>
                          </div>
                        </div>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 left-2 w-8 h-8 bg-black/30 text-white hover:bg-black/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleAddToInventory(e, sale)}
                        title="Add back to inventory"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                      </Button>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png" alt="No Sales" className="w-12 h-12 mx-auto mb-3 text-gray-300 opacity-50" />
              <p>No sales yet</p>
              <p className="text-sm mt-1">Add your first sale to get started</p>
            </div>
          )}
          {sales.length > 0 && <WeeklyProfitMiniChart sales={sales} />}
        </CardContent>
      </Card>
    </Carousel>
  );
}

