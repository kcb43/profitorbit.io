import React from "react";
import { MarketplaceBadge } from "./MarketplaceBadge";
import { CROSSLIST_MARKETPLACES } from "@/constants/marketplaces";

export function MarketplaceBadgesRow({
  item,
  computeListingState,
  getItemListings,
  size = "sm",
}) {
  const stateMap = computeListingState(item);
  const listings = getItemListings(item.id);

  return (
    <div className="flex items-center gap-1.5">
      {CROSSLIST_MARKETPLACES.map((m) => {
        const listing =
          listings.find(
            (l) => l.marketplace === m.id && l.status === "active"
          ) ||
          listings.find(
            (l) => l.marketplace === m.id && l.status === "processing"
          ) ||
          listings.find((l) => l.marketplace === m.id) ||
          null;

        return (
          <MarketplaceBadge
            key={m.id}
            marketplace={m}
            state={stateMap[m.id]}
            listing={listing}
            size={size}
          />
        );
      })}
    </div>
  );
}
