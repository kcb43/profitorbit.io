import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from 'date-fns';
import { DollarSign, TrendingUp, Calendar, Info, Package } from 'lucide-react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { stripCustomFeeNotes } from "@/utils/customFees";

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

const platformNames = {
  ebay: "eBay",
  facebook_marketplace: "Facebook",
  etsy: "Etsy",
  mercari: "Mercari",
  offer_up: "OfferUp"
};

export default function ShowcaseItemModal({ item, isOpen, onClose }) {
  if (!item) return null;

  const purchasePrice = item.purchase_price ?? 0;
  const shippingCost = item.shipping_cost ?? 0;
  const platformFees = item.platform_fees ?? 0;
  const otherCosts = item.other_costs ?? 0;
  const vatFees = item.vat_fees ?? 0;
  const totalCosts = purchasePrice + shippingCost + platformFees + otherCosts + vatFees;
  const [feesExpanded, setFeesExpanded] = React.useState(false);
  const displayNotes = stripCustomFeeNotes(item.notes || "");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        <div className="flex flex-col md:grid md:grid-cols-2">
          <div className="order-1 md:order-2">
            <img 
              src={item.image_url || DEFAULT_IMAGE_URL} 
              alt={item.item_name} 
              className="w-full h-48 md:h-full object-cover md:rounded-r-lg" 
            />
          </div>
          <div className="p-4 md:p-6 order-2 md:order-1">
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
                    <div className="mt-2 space-y-1 text-[11px] sm:text-xs text-red-500 dark:text-red-300">
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
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}