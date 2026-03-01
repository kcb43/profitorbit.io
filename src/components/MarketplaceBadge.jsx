import React, { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { renderMarketplaceIcon } from "@/constants/marketplaces";
import { format, parseISO } from "date-fns";

const SIZE_MAP = {
  sm: { wrapper: "w-7 h-7", icon: "w-3.5 h-3.5", indicator: "w-2 h-2" },
  md: { wrapper: "w-9 h-9", icon: "w-4 h-4", indicator: "w-2.5 h-2.5" },
};

export function MarketplaceBadge({ marketplace, state, listing, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const isListed = state === "active";
  const isProcessing = state === "processing";
  const listingUrl =
    listing?.marketplace_listing_url?.startsWith("http")
      ? listing.marketplace_listing_url
      : null;
  const sz = SIZE_MAP[size] || SIZE_MAP.sm;

  const badgeEl = (
    <div
      className={`relative inline-flex items-center justify-center ${sz.wrapper} rounded-lg border transition-all ${
        isListed
          ? "bg-card border-emerald-500/40 shadow-sm opacity-100"
          : isProcessing
            ? "bg-card border-blue-500/40 shadow-sm opacity-100"
            : "bg-gray-500/10 border-gray-300 dark:border-border opacity-40"
      }`}
      title={
        isListed
          ? `Listed on ${marketplace.label}`
          : isProcessing
            ? `Listing on ${marketplace.label}...`
            : `Not listed on ${marketplace.label}`
      }
    >
      {renderMarketplaceIcon(marketplace, sz.icon)}
      {isListed && (
        <span className="absolute -top-0.5 -right-0.5 bg-card border border-border rounded-full p-0.5 shadow">
          <ExternalLink className={`${sz.indicator} text-emerald-600`} />
        </span>
      )}
      {isProcessing && (
        <span className="absolute -top-0.5 -right-0.5 bg-card border border-border rounded-full p-0.5 shadow">
          <RefreshCw className={`${sz.indicator} text-blue-600 animate-spin`} />
        </span>
      )}
    </div>
  );

  // Not listed: just dim icon, no popover
  if (!isListed && !isProcessing) return badgeEl;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="focus:outline-none"
        >
          {badgeEl}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-2" side="top" align="center">
        <div className="flex items-center gap-2 mb-1">
          {renderMarketplaceIcon(marketplace, "w-4 h-4")}
          <span className="text-sm font-semibold text-foreground">
            {marketplace.label}
          </span>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Status</span>
            <span
              className={`font-medium ${isListed ? "text-emerald-600" : "text-blue-600"}`}
            >
              {isListed ? "Active" : "Processing"}
            </span>
          </div>
          {listing?.listed_at && (
            <div className="flex justify-between">
              <span>Listed</span>
              <span className="font-medium text-foreground">
                {format(parseISO(listing.listed_at), "MMM d, yyyy")}
              </span>
            </div>
          )}
          {listingUrl && (
            <div className="pt-1">
              <span className="block text-[10px] text-muted-foreground/70 truncate">
                {listingUrl}
              </span>
            </div>
          )}
        </div>
        {listingUrl && (
          <Button
            size="sm"
            className="w-full h-7 text-xs mt-1"
            onClick={() => {
              window.open(listingUrl, "_blank");
              setOpen(false);
            }}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Open Listing
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
