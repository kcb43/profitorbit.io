import { useState, useEffect, useCallback } from "react";
import { crosslistingEngine } from "@/services/CrosslistingEngine";
import { inventoryApi } from "@/api/inventoryApi";
import { listingJobsApi, platformApi } from "@/api/listingApiClient";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

/**
 * Hook that manages marketplace listing state for inventory items.
 * Extracted from Crosslist.jsx to be shared by Inventory.jsx.
 */
export function useMarketplaceListings(inventoryItems) {
  const [marketplaceListings, setMarketplaceListings] = useState({});
  const [activeJobs, setActiveJobs] = useState({});
  const [platformConnections, setPlatformConnections] = useState([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Load marketplace listings for all visible items
  useEffect(() => {
    const loadListings = async () => {
      const listingsMap = {};
      for (const item of inventoryItems) {
        try {
          const listings = await crosslistingEngine.getMarketplaceListings(item.id);
          listingsMap[item.id] = listings;
        } catch (error) {
          console.error(`Error loading listings for item ${item.id}:`, error);
          listingsMap[item.id] = [];
        }
      }
      setMarketplaceListings(listingsMap);
    };

    if (inventoryItems.length > 0) {
      loadListings();
    }

    // Refresh when window regains focus (user comes back from CrosslistComposer)
    const handleFocus = () => {
      if (inventoryItems.length > 0) {
        loadListings();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [inventoryItems]);

  // Load platform connection status
  useEffect(() => {
    const loadPlatformStatus = async () => {
      try {
        const status = await platformApi.getStatus();
        setPlatformConnections(status);
      } catch (error) {
        console.error("Error loading platform status:", error);
      }
    };
    loadPlatformStatus();
    const interval = setInterval(loadPlatformStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getItemListings = useCallback(
    (itemId) => marketplaceListings[itemId] || [],
    [marketplaceListings]
  );

  const computeListingState = useCallback(
    (item) => {
      const listings = getItemListings(item.id);
      const getState = (marketplace) => {
        const active = listings.find(
          (l) => l.marketplace === marketplace && l.status === "active"
        );
        if (active) return "active";
        const processing = listings.find(
          (l) => l.marketplace === marketplace && l.status === "processing"
        );
        if (processing) return "processing";
        return null;
      };

      return {
        ebay: getState("ebay"),
        facebook: getState("facebook"),
        mercari: getState("mercari"),
        etsy: getState("etsy"),
        poshmark: getState("poshmark"),
      };
    },
    [getItemListings]
  );

  const isListedAnywhere = useCallback(
    (item) => {
      const state = computeListingState(item);
      return Object.values(state).some(Boolean);
    },
    [computeListingState]
  );

  const isPlatformConnected = useCallback(
    (platformId) => {
      const platform = platformConnections.find((p) => p.platform === platformId);
      return platform?.status === "connected";
    },
    [platformConnections]
  );

  const handleJobComplete = useCallback(
    (job) => {
      let matchedItemId = null;

      setActiveJobs((prev) => {
        const newJobs = { ...prev };
        Object.keys(newJobs).forEach((itemId) => {
          if (newJobs[itemId] === job.id) {
            matchedItemId = itemId;
            delete newJobs[itemId];
          }
        });
        return newJobs;
      });

      if (job.status === "completed" && job.result) {
        const platforms = Object.keys(job.result).filter(
          (p) => job.result[p].success
        );
        toast({
          title: "Listing Complete",
          description: `Successfully listed on ${platforms.join(", ")}`,
        });

        // Handle Mercari success
        const mercariListingUrl = job?.result?.mercari?.listingUrl;
        const isMercariRealSuccess =
          job?.result?.mercari?.success === true &&
          typeof mercariListingUrl === "string" &&
          (mercariListingUrl.includes("mercari.com/us/item/") ||
            mercariListingUrl.includes("mercari.com/items/"));

        if (isMercariRealSuccess) {
          const inventoryItemId = job.inventory_item_id || matchedItemId;
          const listingIdFromUrl = (() => {
            try {
              const u = String(mercariListingUrl);
              const m =
                /mercari\.com\/us\/item\/([A-Za-z0-9]+)/.exec(u) ||
                /mercari\.com\/items\/([A-Za-z0-9]+)/.exec(u);
              return m?.[1] || null;
            } catch (_) {
              return null;
            }
          })();

          if (inventoryItemId) {
            inventoryApi
              .update(inventoryItemId, {
                status: "listed",
                mercari_listing_id: mercariListingUrl,
              })
              .catch(() => {});

            crosslistingEngine
              .upsertMarketplaceListing({
                inventory_item_id: inventoryItemId,
                marketplace: "mercari",
                marketplace_listing_id: listingIdFromUrl || String(job?.id || ""),
                marketplace_listing_url: String(mercariListingUrl),
                status: "active",
                listed_at: new Date().toISOString(),
                metadata: {
                  jobId: job?.id || null,
                  result: job?.result?.mercari || null,
                },
              })
              .then(async () => {
                const listings =
                  await crosslistingEngine.getMarketplaceListings(inventoryItemId);
                setMarketplaceListings((prev) => ({
                  ...prev,
                  [inventoryItemId]: listings,
                }));
              })
              .catch(() => {});
          }

          try {
            window.open(mercariListingUrl, "_blank", "noopener,noreferrer");
          } catch {}
        }

        queryClient.invalidateQueries(["inventoryItems"]);
      }
    },
    [toast, queryClient]
  );

  return {
    marketplaceListings,
    setMarketplaceListings,
    activeJobs,
    setActiveJobs,
    getItemListings,
    computeListingState,
    isListedAnywhere,
    isPlatformConnected,
    handleJobComplete,
  };
}
