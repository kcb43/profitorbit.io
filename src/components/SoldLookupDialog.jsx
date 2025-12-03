import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart, Copy } from "lucide-react";
import GlobeIcon from "@/components/icons/GlobeIcon";

const EBAY_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg";
const MERCARI_ICON_URL = "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B";
const FACEBOOK_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";
const ETSY_ICON_URL = "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B";

/**
 * Minimal, crash-proof "Sold Listings" dialog used across Inventory and Add Sale.
 */
export default function SoldLookupDialog({ open, onOpenChange, itemName = "", onEbaySearch }) {
  const q = useMemo(() => {
    if (!itemName) return "";
    return itemName
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 7)
      .join(" ");
  }, [itemName]);

  const ebaySoldUrl = q
    ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1`
    : "https://www.ebay.com";
  const mercariGoogle = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q + " site:mercari.com")}`
    : "https://www.google.com";
  const fbGoogle = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q + " site:facebook.com/marketplace")}`
    : "https://www.google.com";
  const etsyGoogle = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q + " site:etsy.com sold")}`
    : "https://www.google.com";
  const allMarkets = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q)}`
    : "https://www.google.com/search";
  const comparePrices = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q)}`
    : "https://www.google.com/search";

  const copyQuery = async () => {
    if (!q) return;
    try {
      await navigator.clipboard.writeText(q);
    } catch {
      // clipboard may be blocked; fail silently
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:w-[90vw] max-w-lg sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
            <BarChart className="w-4 h-4" />
            Sold Listings Lookup
          </DialogTitle>
          <DialogDescription>
            Quick search links based on "{q || "your item name"}".
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {onEbaySearch ? (
            <Button 
              variant="outline"
              onClick={() => {
                onEbaySearch();
                onOpenChange(false);
              }}
              className="w-full"
            >
              <img src={EBAY_ICON_URL} alt="eBay" className="w-4 h-4 mr-2 object-contain" />
              eBay
            </Button>
          ) : (
          <Button asChild className="w-full">
              <a href={ebaySoldUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
                <img src={EBAY_ICON_URL} alt="eBay" className="w-4 h-4 object-contain" />
              eBay (Sold + Completed)
            </a>
          </Button>
          )}
          <Button asChild variant="outline" className="w-full">
            <a href={mercariGoogle} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
              <img src={MERCARI_ICON_URL} alt="Mercari" className="w-4 h-4 object-contain" />
              Mercari
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href={fbGoogle} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
              <img src={FACEBOOK_ICON_URL} alt="Facebook" className="w-4 h-4 object-contain" />
              Facebook
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href={etsyGoogle} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
              <img src={ETSY_ICON_URL} alt="Etsy" className="w-4 h-4 object-contain" />
              Etsy
            </a>
          </Button>
          <Button asChild variant="outline" className="col-span-2 sm:col-span-1 w-full">
            <a href={allMarkets} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
              <GlobeIcon className="w-4 h-4" />
              All Markets
            </a>
          </Button>
        </div>

        <Button asChild variant="secondary" className="w-full">
          <a href={comparePrices} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
            <GlobeIcon className="w-4 h-4" />
            Compare Prices
          </a>
        </Button>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button variant="outline" onClick={copyQuery} disabled={!q} className="flex-1 sm:flex-none">
            <Copy className="w-4 h-4 mr-2" />
            Copy Title
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}