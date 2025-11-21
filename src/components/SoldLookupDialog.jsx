import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart, Copy } from "lucide-react";

/**
 * Minimal, crash-proof “Sold Listings” dialog used across Inventory and Add Sale.
 */
export default function SoldLookupDialog({ open, onOpenChange, itemName = "" }) {
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
    : "https://www.google.com";

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
            Quick search links based on “{q || "your item name"}”.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          💡 Tip: keep names short (brand + model + size). Refine further on the results page.
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Button asChild className="w-full">
            <a href={ebaySoldUrl} target="_blank" rel="noreferrer">
              eBay (Sold + Completed)
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href={mercariGoogle} target="_blank" rel="noreferrer">
              Mercari (Google)
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href={fbGoogle} target="_blank" rel="noreferrer">
              Facebook (Google)
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href={etsyGoogle} target="_blank" rel="noreferrer">
              Etsy (Google)
            </a>
          </Button>
          <Button asChild variant="outline" className="col-span-2 sm:col-span-1 w-full">
            <a href={allMarkets} target="_blank" rel="noreferrer">
              All Markets
            </a>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button variant="outline" onClick={copyQuery} disabled={!q} className="flex-1 sm:flex-none">
            <Copy className="w-4 h-4 mr-2" />
            Copy Query
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}