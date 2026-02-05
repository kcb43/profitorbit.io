import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { sortSalesByRecency } from "@/utils/sales";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ArchiveRestore, Gift, BellRing } from "lucide-react";
import { stripCustomFeeNotes } from "@/utils/customFees";

const platformIcons = {
  ebay: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
  facebook_marketplace: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
  mercari: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  etsy: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
  offer_up: "https://cdn.brandfetch.io/id5p1Knwlt/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B"
};

export default function RecentSales({ sales }) {
  // Filter out soft-deleted sales
  const activeSales = (sales ?? []).filter(sale => !sale.deleted_at);
  const recentSales = sortSalesByRecency(activeSales).slice(0, 15);
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
    if (sale.notes) params.set('notes', stripCustomFeeNotes(sale.notes));

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
                {recentSales.map((sale, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === recentSales.length - 1;

                  return (
                    <CarouselItem key={sale.id} className="pl-4 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                      <div className="group relative">
                        <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}`)}>
                          <div className="overflow-hidden rounded-xl relative shadow-md transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1 group-hover:shadow-lg">
                            <div className="aspect-square bg-gray-100 dark:bg-card">
                              <img
                                src={sale.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                                alt={sale.item_name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            
                            {isFirst && (
                              <div className="absolute top-2 left-2 z-10">
                                <Badge className="bg-blue-600 hover:!bg-blue-600 text-white border-blue-500 shadow-lg">
                                  Recent Sale
                                </Badge>
                              </div>
                            )}
                            
                            {isLast && (
                              <div className="absolute top-2 left-2 z-10">
                                <Badge className="bg-red-600 hover:!bg-red-600 text-white border-red-500 shadow-lg">
                                  Leaving Soon
                                </Badge>
                              </div>
                            )}
                            
                            <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
                              {(() => {
                                const profitValue = sale.profit ?? 0;
                                const profitPositive = profitValue >= 0;
                                const profitClass = profitPositive
                                  ? "bg-green-600/90 hover:!bg-green-600/90 text-white border-green-500 shadow-lg dark:[text-shadow:0_0_6px_rgba(34,197,94,0.5)]"
                                  : "bg-red-600 hover:!bg-red-600 text-white border-red-500 shadow-lg";
                                const formattedProfit = `${profitPositive ? "" : "-"}$${Math.abs(profitValue).toFixed(2)}`;
                                return (
                                  <Badge className={profitClass}>
                                    {formattedProfit}
                                  </Badge>
                                );
                              })()}
                              {sale.platform && platformIcons[sale.platform] && (
                                <div className="bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-lg p-1.5 shadow-md border border-white/20 dark:border-border/50">
                                  <img 
                                    src={platformIcons[sale.platform]} 
                                    alt={sale.platform} 
                                    className="w-5 h-5 object-contain"
                                  />
                                </div>
                              )}
                            </div>
                            
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                              <p className="text-white font-semibold text-sm truncate">{sale.item_name}</p>
                            </div>
                          </div>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 left-2 w-8 h-8 bg-black/30 text-white hover:bg-black/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
                          onClick={(e) => handleAddToInventory(e, sale)}
                          title="Add back to inventory"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </Button>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png" alt="No Sales" className="w-12 h-12 mx-auto mb-3 text-gray-300 opacity-50" />
              <p>No sales yet</p>
              <p className="text-sm mt-1">Add your first sale to get started</p>
            </div>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 p-4 shadow-sm">
              <div className="p-2 rounded-lg bg-white/70 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-200">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Quarterly Giveaway Drops</h3>
                  <Badge className="bg-emerald-600 text-white border-transparent text-[10px]">Coming Soon</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Join surprise raffles for sourcing credits, gear, and coaching. Stay tuned for our first drop!
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-900/20 p-4 shadow-sm">
              <div className="p-2 rounded-lg bg-white/70 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-200">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Deal Radar Alerts</h3>
                  <Badge className="bg-indigo-600 text-white border-transparent text-[10px]">VIP Upgrade</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Premium members will get real-time flips curated by our sourcing team. Launching later this year.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Carousel>
  );
}