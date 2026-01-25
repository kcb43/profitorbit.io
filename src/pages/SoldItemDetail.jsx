
import React from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { salesApi } from "@/api/salesApi";
import { inventoryApi } from "@/api/inventoryApi";
import { createPageUrl } from "@/utils";
import { stripCustomFeeNotes } from "@/utils/customFees";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, Tag, ShoppingCart, Calendar, FileText, TrendingUp, Percent, Zap, Pencil, Trash2 } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const platformNames = {
  ebay: "eBay",
  facebook_marketplace: "Facebook",
  etsy: "Etsy",
  mercari: "Mercari",
  offer_up: "OfferUp"
};

const platformColors = {
  ebay: "bg-blue-500 text-white border-blue-600 dark:bg-blue-700 dark:text-gray-100 dark:border-blue-800",
  facebook_marketplace: "bg-indigo-500 text-white border-indigo-600 dark:bg-indigo-700 dark:text-gray-100 dark:border-indigo-800",
  etsy: "bg-orange-500 text-white border-orange-600 dark:bg-orange-700 dark:text-gray-100 dark:border-orange-800",
  mercari: "bg-red-500 text-white border-red-600 dark:bg-red-700 dark:text-gray-100 dark:border-red-800",
  offer_up: "bg-green-500 text-white border-green-600 dark:bg-green-700 dark:text-gray-100 dark:border-green-800",
  default: "bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
};

const sourceIcons = {
  "Amazon": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/af08cfed1_Logo.png",
};

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

export default function SoldItemDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(location.search);
  const saleId = searchParams.get('id');

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [feesExpanded, setFeesExpanded] = React.useState(location.search.includes('expandFees=true'));

  React.useEffect(() => {
    setFeesExpanded(location.search.includes('expandFees=true'));
  }, [location.search]);

  const { data: sale, isLoading, isError } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => salesApi.get(saleId),
    enabled: !!saleId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (saleId) => {
      const saleToDelete = await salesApi.get(saleId);
      
      if (saleToDelete.inventory_id) {
        try {
          const inventoryItem = await inventoryApi.get(saleToDelete.inventory_id);
          const quantitySoldInSale = saleToDelete.quantity_sold || 1;
          const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
          const isSoldOut = newQuantitySold >= inventoryItem.quantity;
          
          await inventoryApi.update(saleToDelete.inventory_id, {
            quantity_sold: newQuantitySold,
            status: isSoldOut ? "sold" : (newQuantitySold > 0 ? inventoryItem.status : "available")
          });
        } catch (error) {
          console.error("Failed to update inventory item on sale deletion:", error);
        }
      }
      
      return salesApi.delete(saleId, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      navigate(createPageUrl("Dashboard"));
    },
    onError: (error) => {
      console.error("Error deleting sale:", error);
    },
    onSettled: () => {
      setDeleteDialogOpen(false);
    }
  });

  const handleDelete = () => {
    if (saleId) {
      deleteMutation.mutate(saleId);
    }
  };
  
  const purchasePrice = sale?.purchase_price ?? 0;
  const shippingCost = sale?.shipping_cost ?? 0;
  const platformFees = sale?.platform_fees ?? 0;
  const otherCosts = sale?.other_costs ?? 0;
  const vatFees = sale?.vat_fees ?? 0;

  const totalCosts = purchasePrice + shippingCost + platformFees + otherCosts + vatFees;
  const profit = sale?.profit ?? 0;
  const sellingPrice = sale?.selling_price ?? 0;

  const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : (profit > 0 ? Infinity : 0);
  const profitMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : (profit > 0 ? Infinity : 0);
  const displayNotes = stripCustomFeeNotes(sale?.notes || "");

  let saleSpeed = null;
  if (sale?.sale_date && sale?.purchase_date) {
    try {
      const saleDate = parseISO(sale.sale_date);
      const purchaseDate = parseISO(sale.purchase_date);
      if (saleDate && purchaseDate) {
        saleSpeed = differenceInDays(saleDate, purchaseDate);
      }
    } catch (e) {
      console.error("Error parsing dates for sale speed:", e);
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto dark:bg-gray-900">
        <Skeleton className="h-8 w-48 mb-8 bg-gray-200 dark:bg-gray-700" />
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="w-full h-96 bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-24 w-full bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-24 w-full bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>
    );
  }
  
  if (isError || !sale) {
    return <div className="p-4 sm:p-8 text-center text-red-500 dark:text-red-400 dark:bg-gray-900">Error: Could not load sale details.</div>
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="max-w-5xl mx-auto min-w-0">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 min-w-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(createPageUrl("Dashboard"));
              }
            }}
            className="dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-white flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white dark:text-white break-words">{sale?.item_name}</h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1 break-words">Sale Details</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 min-w-0">
          <div className="rounded-lg overflow-hidden shadow-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700">
            <div className="aspect-video bg-white dark:bg-gray-900 flex items-center justify-center p-6 sm:p-8">
              <img 
                src={sale?.image_url || DEFAULT_IMAGE_URL} 
                alt={sale?.item_name} 
                className="w-full h-full object-contain max-w-full rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6 min-w-0">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-800">
              <CardHeader className="border-b border-green-100 dark:border-green-800 px-4 sm:px-6 py-3 sm:py-4">
                <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-400 text-base sm:text-lg break-words">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                  <span>Net Profit</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-green-600 dark:text-green-400 break-words">
                  ${profit?.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm dark:bg-gray-800">
              <CardHeader className="px-4 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-base sm:text-lg dark:text-white break-words">Sale Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 min-w-0">
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700 gap-2 min-w-0">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">Selling Price</span>
                  <span className="font-semibold text-sm sm:text-base text-white dark:text-white break-words">${sellingPrice?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700 gap-2 min-w-0">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">Platform</span>
                  <Badge className={`${platformColors[sale?.platform] || platformColors.default} text-xs sm:text-sm whitespace-nowrap flex-shrink-0`}>
                    {platformNames[sale?.platform] || "N/A"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700 gap-2 min-w-0">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">Sale Date</span>
                  <span className="font-semibold text-sm sm:text-base text-white dark:text-white break-words">
                    {sale?.sale_date ? format(parseISO(sale.sale_date), 'MMM dd, yyyy') : 'N/A'}
                  </span>
                </div>
                {sale?.category && (
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700 gap-2 min-w-0">
                    <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">Category</span>
                    <Badge variant="secondary" className="dark:bg-gray-700 dark:text-gray-200 text-xs sm:text-sm break-words max-w-[60%] text-right">{sale.category}</Badge>
                  </div>
                )}
                {sale?.source && (
                  <div className="flex justify-between items-center py-2 dark:border-gray-700 gap-2 min-w-0">
                    <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">Source</span>
                    <span className="font-semibold text-sm sm:text-base text-white dark:text-white break-words text-right max-w-[60%]">
                      {sourceIcons[sale.source] ? (
                        <img src={sourceIcons[sale.source]} alt={sale.source} className="w-auto h-3 sm:h-4 object-contain inline-block mr-1 align-text-bottom" />
                      ) : sale.source}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm dark:bg-gray-800">
              <CardHeader className="px-4 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-base sm:text-lg dark:text-white break-words">Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 min-w-0">
                <div className="flex justify-between items-center gap-2 min-w-0">
                  <span className="text-sm sm:text-base text-white dark:text-white break-words">Total Costs</span>
                  <span className="text-sm sm:text-base font-semibold text-white dark:text-white break-words">${totalCosts.toFixed(2)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setFeesExpanded((prev) => !prev)}
                  className="text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-300 hover:text-orange-500 dark:hover:text-orange-200 transition"
                >
                  {feesExpanded ? "Hide fees" : "Show fees"}
                </button>

                {feesExpanded && (
                  <div className="space-y-2 border-t dark:border-gray-700 pt-3 text-[13px] sm:text-sm">
                    <div className="flex justify-between items-center gap-2 min-w-0">
                      <span className="break-words text-gray-700 dark:text-gray-300">Sold Price</span>
                      <span className="font-semibold break-words text-green-600 dark:text-green-400">${sellingPrice?.toFixed(2)}</span>
                    </div>
                    <div className="border-t dark:border-gray-700 pt-2 mt-2 space-y-2 text-red-500 dark:text-red-300">
                      <div className="flex justify-between items-center gap-2 min-w-0">
                        <span className="break-words">Purchase Price</span>
                        <span className="font-semibold break-words">${purchasePrice?.toFixed(2)}</span>
                      </div>
                      {shippingCost > 0 && (
                        <div className="flex justify-between items-center gap-2 min-w-0">
                          <span className="break-words">Shipping</span>
                          <span className="font-semibold break-words">${shippingCost?.toFixed(2)}</span>
                        </div>
                      )}
                      {platformFees > 0 && (
                        <div className="flex justify-between items-center gap-2 min-w-0">
                          <span className="break-words">Platform Fees</span>
                          <span className="font-semibold break-words">${platformFees?.toFixed(2)}</span>
                        </div>
                      )}
                      {otherCosts > 0 && (
                        <div className="flex justify-between items-center gap-2 min-w-0">
                          <span className="break-words">Other Costs</span>
                          <span className="font-semibold break-words">${otherCosts?.toFixed(2)}</span>
                        </div>
                      )}
                      {vatFees > 0 && (
                        <div className="flex justify-between items-center gap-2 min-w-0">
                          <span className="break-words">VAT Fees</span>
                          <span className="font-semibold break-words">${vatFees?.toFixed(2)}</span>
                        </div>
                      )}
                      {shippingCost <= 0 && platformFees <= 0 && otherCosts <= 0 && vatFees <= 0 && (
                        <p className="text-muted-foreground text-[11px] sm:text-xs">No additional fees recorded.</p>
                      )}
                    </div>
                    <div className="border-t dark:border-gray-700 pt-2 mt-2">
                      <div className="flex justify-between items-center gap-2 min-w-0">
                        <span className="break-words text-gray-700 dark:text-gray-300">Profit</span>
                        <span className={`font-semibold break-words ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          {profit >= 0 ? '+' : ''}${profit?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm dark:bg-gray-800">
              <CardHeader className="px-4 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-base sm:text-lg dark:text-white break-words">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 min-w-0">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 break-words">ROI</span>
                  </div>
                  <span className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 break-words whitespace-nowrap">
                    {isFinite(roi) ? `${roi.toFixed(1)}%` : '∞%'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Percent className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 break-words">Profit Margin</span>
                  </div>
                  <span className="text-base sm:text-lg font-bold text-purple-600 dark:text-purple-400 break-words whitespace-nowrap">
                    {isFinite(profitMargin) ? `${profitMargin.toFixed(1)}%` : '∞%'}
                  </span>
                </div>
                {saleSpeed !== null && (
                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 break-words">Sale Speed</span>
                  </div>
                    <span className="text-base sm:text-lg font-bold text-orange-600 dark:text-orange-400 break-words whitespace-nowrap">
                      {saleSpeed} days
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 min-w-0">
              <Link to={createPageUrl(`AddSale?id=${sale?.id}`)} className="flex-1 min-w-0">
                <Button variant="outline" className="w-full dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-white text-sm sm:text-base h-9 sm:h-10">
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </Link>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="flex-1 dark:bg-red-700 dark:hover:bg-red-600 dark:text-white text-sm sm:text-base h-9 sm:h-10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>

            {displayNotes && (
              <Card className="border-0 shadow-sm dark:bg-gray-800">
                <CardHeader className="px-4 sm:px-6 py-3 sm:py-4">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2 dark:text-white">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <span className="break-words">Notes</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 italic break-words">"{displayNotes}"</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700 dark:text-white max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white break-words">Delete Sale?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300 break-words">
              Are you sure you want to delete this sale? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 dark:hover:text-white w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-white w-full sm:w-auto"
            >
              {deleteMutation.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
