import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from 'date-fns';
import { DollarSign, TrendingUp, Calendar, Info, Package, Pencil, Trash2 } from 'lucide-react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { stripCustomFeeNotes } from "@/utils/customFees";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/base44Client";
import { salesApi } from "@/api/salesApi";
import { inventoryApi } from "@/api/inventoryApi";
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

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

const platformNames = {
  ebay: "eBay",
  facebook_marketplace: "Facebook",
  etsy: "Etsy",
  mercari: "Mercari",
  offer_up: "OfferUp"
};

export default function ShowcaseItemModal({ item, isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [feesExpanded, setFeesExpanded] = React.useState(false);
  
  const deleteMutation = useMutation({
    mutationFn: async (saleId) => {
      const saleToDelete = await salesApi.get(saleId);
      
      if (saleToDelete.inventory_id) {
        try {
          const inventoryItem = await inventoryApi.get(saleToDelete.inventory_id);
          const quantitySoldInSale = saleToDelete.quantity_sold || 1;
          const newQuantitySold = Math.max((inventoryItem.quantity_sold || 0) - quantitySoldInSale, 0);
          const isSoldOut = newQuantitySold >= inventoryItem.quantity;
          
          await inventoryApi.update(saleToDelete.inventory_id, {
            quantity_sold: newQuantitySold,
            status: isSoldOut ? "sold" : (inventoryItem.status === "sold" && newQuantitySold < inventoryItem.quantity ? "available" : inventoryItem.status),
          });
        } catch (error) {
          console.error("Failed to update inventory item:", error);
        }
      }
      
      return salesApi.delete(saleId, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      setDeleteDialogOpen(false);
      onClose();
    },
  });

  const handleDelete = () => {
    if (item?.id) {
      deleteMutation.mutate(item.id);
    }
  };

  if (!item) return null;

  const purchasePrice = item.purchase_price ?? 0;
  const shippingCost = item.shipping_cost ?? 0;
  const platformFees = item.platform_fees ?? 0;
  const otherCosts = item.other_costs ?? 0;
  const vatFees = item.vat_fees ?? 0;
  const totalCosts = purchasePrice + shippingCost + platformFees + otherCosts + vatFees;
  const sellingPrice = item.selling_price ?? 0;
  const profit = item.profit ?? 0;
  const displayNotes = stripCustomFeeNotes(item.notes || "");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        <div className="flex flex-col">
          <div className="min-h-[340px]">
            <img 
              src={item.image_url || DEFAULT_IMAGE_URL} 
              alt={item.item_name} 
              className="w-full h-[340px] object-cover rounded-t-lg" 
            />
          </div>
          <div className="p-4 md:p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg font-bold pr-6">{item.item_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div
                className={`flex justify-between items-center p-3 rounded-lg ${
                  item.profit >= 0
                    ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                }`}
              >
                <span className="font-medium flex items-center gap-2">
                  <DollarSign className={`w-4 h-4 ${item.profit >= 0 ? "text-green-600" : "text-red-600 dark:text-red-400"}`} />
                  Net Profit
                </span>
                <span className={`font-bold text-lg ${item.profit >= 0 ? "" : "text-red-600 dark:text-red-300"}`}>
                  {item.profit >= 0 ? "+" : "-"}${Math.abs(item.profit).toFixed(2)}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Sell Price</p>
                  <p className="font-semibold">${item.selling_price.toFixed(2)}</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">Total Costs</p>
                    <button
                      type="button"
                      onClick={() => setFeesExpanded((prev) => !prev)}
                      className="text-[11px] font-medium text-orange-600 hover:text-orange-500 dark:text-orange-300 dark:hover:text-orange-200"
                    >
                      {feesExpanded ? "Hide fees" : "Show fees"}
                    </button>
                  </div>
                  <p className="font-semibold">${totalCosts.toFixed(2)}</p>
                  {feesExpanded && (
                    <div className="mt-2 space-y-2 border-t dark:border-border pt-2 text-[11px] sm:text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="break-words text-gray-700 dark:text-gray-300">Sold Price</span>
                        <span className="font-semibold break-words text-green-600 dark:text-green-400">${sellingPrice.toFixed(2)}</span>
                      </div>
                      <div className="border-t dark:border-border pt-2 mt-2 space-y-1 text-red-500 dark:text-red-300">
                        <div className="flex items-center justify-between gap-2">
                          <span className="break-words">Purchase Price</span>
                          <span className="font-semibold break-words">${purchasePrice.toFixed(2)}</span>
                        </div>
                        {shippingCost > 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="break-words">Shipping</span>
                            <span className="font-semibold break-words">${shippingCost.toFixed(2)}</span>
                          </div>
                        )}
                        {platformFees > 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="break-words">Platform Fees</span>
                            <span className="font-semibold break-words">${platformFees.toFixed(2)}</span>
                          </div>
                        )}
                        {otherCosts > 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="break-words">Other Costs</span>
                            <span className="font-semibold break-words">${otherCosts.toFixed(2)}</span>
                          </div>
                        )}
                        {vatFees > 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="break-words">VAT Fees</span>
                            <span className="font-semibold break-words">${vatFees.toFixed(2)}</span>
                          </div>
                        )}
                        {shippingCost <= 0 && platformFees <= 0 && otherCosts <= 0 && vatFees <= 0 && (
                          <p className="text-muted-foreground">No additional fees recorded.</p>
                        )}
                      </div>
                      <div className="border-t dark:border-border pt-2 mt-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="break-words text-gray-700 dark:text-gray-300">Profit</span>
                          <span className={`font-semibold break-words ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500"/>
                  <span className="text-xs">ROI:</span>
                </div>
                <span className="font-bold text-blue-600">
                  {isFinite(item.roi) ? `${item.roi.toFixed(1)}%` : '∞%'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500"/>
                  <span className="text-xs">Days Listed:</span>
                </div>
                <span className="font-bold text-orange-600">{item.saleSpeed} Days</span>
              </div>

              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Package className="w-4 h-4 text-gray-500"/>
                  <span>
                    Sold on: <Badge variant="secondary" className="text-xs">{platformNames[item.platform]}</Badge>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-4 h-4 text-gray-500"/>
                  <span>Date: {format(parseISO(item.sale_date), 'MMM dd, yyyy')}</span>
                </div>
              </div>

              {displayNotes && (
                <div className="pt-3 border-t">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0"/>
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-gray-600 dark:text-gray-400">Notes</p>
                      <p className="italic text-xs break-words mt-1">"{displayNotes}"</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t" />
              
              {/* Edit and Delete Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
                <Link to={createPageUrl(`AddSale?id=${item.id}`)} className="flex-1 min-w-0">
                  <Button variant="outline" className="w-full dark:bg-card dark:text-gray-200 dark:border-border dark:hover:bg-gray-700 dark:hover:text-white text-sm sm:text-base h-9 sm:h-10">
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
            </div>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="dark:bg-card dark:border-border dark:text-white max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white break-words">Delete Sale?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300 break-words">
              Are you sure you want to delete this sale? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="dark:bg-card dark:text-gray-200 dark:border-border dark:hover:bg-gray-600 dark:hover:text-white w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-white w-full sm:w-auto"
            >
              {deleteMutation.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}