import { base44 } from "@/api/base44Client";
import { crosslistingEngine } from "@/services/CrosslistingEngine";
import { getEbayItemUrl } from "@/utils/ebayHelpers";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

function loadDedupe() {
  try {
    return JSON.parse(localStorage.getItem("profit_orbit_sales_sync_dedupe") || "{}") || {};
  } catch (_) {
    return {};
  }
}

function saveDedupe(next) {
  try {
    localStorage.setItem("profit_orbit_sales_sync_dedupe", JSON.stringify(next || {}));
  } catch (_) {}
}

function platformToSalePlatform(platform) {
  // Sales History uses facebook_marketplace, but we won't auto-sync FB yet.
  if (platform === "facebook") return "facebook_marketplace";
  return platform;
}

export async function syncSalesForInventoryItemIds(itemIds, options = {}) {
  const {
    marketplaces = ["mercari", "ebay"],
    maxItems = 500,
  } = options;

  const ids = Array.isArray(itemIds) ? itemIds.filter(Boolean).slice(0, maxItems) : [];
  const ext = window?.ProfitOrbitExtension;

  const canMercari = typeof ext?.checkMercariListingStatus === "function";
  const canEbay = typeof ext?.checkEbayListingStatus === "function";

  const supported = {
    mercari: canMercari,
    ebay: canEbay,
  };

  const dedupe = loadDedupe();

  const summary = {
    checkedItems: 0,
    checkedListings: 0,
    sold: 0,
    delisted: 0,
    updatedListings: 0,
    createdSales: 0,
    skippedUnsupported: [],
    errors: [],
  };

  const want = marketplaces.map((m) => String(m).toLowerCase());
  const wantSupported = want.filter((m) => supported[m]);
  const wantUnsupported = want.filter((m) => !supported[m]);
  summary.skippedUnsupported = wantUnsupported;

  for (const inventoryItemId of ids) {
    summary.checkedItems += 1;
    try {
      const listings = await crosslistingEngine.getMarketplaceListings(inventoryItemId);
      const activeListings = Array.isArray(listings)
        ? listings.filter((l) => {
            const mp = String(l?.marketplace || "").toLowerCase();
            const st = String(l?.status || "").toLowerCase();
            return wantSupported.includes(mp) && (st === "active" || st === "listed" || st === "processing");
          })
        : [];

      for (const rec of activeListings) {
        const marketplace = String(rec?.marketplace || "").toLowerCase();
        summary.checkedListings += 1;

        const listingId = rec?.marketplace_listing_id ? String(rec.marketplace_listing_id) : "";
        const listingUrl = rec?.marketplace_listing_url ? String(rec.marketplace_listing_url) : "";

        let check = null;
        if (marketplace === "mercari") {
          check = await ext.checkMercariListingStatus({ listingUrl, listingId });
        } else if (marketplace === "ebay") {
          const url = listingUrl || (listingId ? getEbayItemUrl(listingId) : "");
          check = await ext.checkEbayListingStatus({ listingUrl: url, listingId });
        } else {
          continue;
        }

        const availability = String(check?.result?.availability || "").toLowerCase();
        if (!check?.success) {
          summary.errors.push({ inventoryItemId, marketplace, error: check?.error || "status_check_failed" });
          continue;
        }

        if (availability === "sold") {
          summary.sold += 1;
          const dedupeKey = `${marketplace}:${listingId || listingUrl}`;
          const already = !!dedupe[dedupeKey];

          // Update listing record
          await crosslistingEngine.upsertMarketplaceListing({
            inventory_item_id: inventoryItemId,
            marketplace,
            marketplace_listing_id: listingId,
            marketplace_listing_url: listingUrl,
            status: "sold",
            sold_at: nowISO(),
            updated_at: nowISO(),
            metadata: { ...(rec?.metadata || {}), lastStatusCheck: check?.result || null },
          });
          summary.updatedListings += 1;

          if (!already) {
            // Create a Sale record with best-effort data from inventory item.
            const inv = await base44.entities.InventoryItem.get(inventoryItemId);

            const salePayload = {
              inventory_id: inventoryItemId,
              item_name: inv?.item_name || "",
              platform: platformToSalePlatform(marketplace),
              sale_date: todayISODate(),
              created_date: nowISO(),
              // Best-effort carryover for Sales History
              purchase_date: inv?.purchase_date || null,
              source: inv?.source || null,
              category: inv?.category || null,
              purchase_price: inv?.purchase_price ?? null,
              image_url: inv?.image_url || null,
              quantity_sold: 1,
              notes: `Auto-synced as SOLD from ${marketplace}. Please edit this sale to add selling price/fees.`,
            };

            // Remove null/empty keys (Base44 schemas can be strict)
            Object.keys(salePayload).forEach((k) => {
              const v = salePayload[k];
              if (v === null || v === undefined || v === "") delete salePayload[k];
            });

            const created = await base44.entities.Sale.create(salePayload);
            dedupe[dedupeKey] = created?.id || true;
            saveDedupe(dedupe);
            summary.createdSales += 1;

            // Update inventory item status/quantity_sold (best-effort)
            try {
              const qty = Number(inv?.quantity);
              const sold = Number(inv?.quantity_sold || 0);
              const nextSold = Number.isFinite(qty) && qty > 0 ? Math.min(qty, sold + 1) : sold + 1;
              const isSoldOut = Number.isFinite(qty) && qty > 0 ? nextSold >= qty : true;
              await base44.entities.InventoryItem.update(inventoryItemId, {
                quantity_sold: nextSold,
                status: isSoldOut ? "sold" : inv?.status,
              });
            } catch (_) {
              // ignore
            }
          }
        } else if (availability === "not_for_sale" || availability === "not_found" || availability === "ended") {
          summary.delisted += 1;
          await crosslistingEngine.upsertMarketplaceListing({
            inventory_item_id: inventoryItemId,
            marketplace,
            marketplace_listing_id: listingId,
            marketplace_listing_url: listingUrl,
            status: "delisted",
            delisted_at: nowISO(),
            updated_at: nowISO(),
            metadata: { ...(rec?.metadata || {}), lastStatusCheck: check?.result || null },
          });
          summary.updatedListings += 1;
        }
      }
    } catch (e) {
      summary.errors.push({ inventoryItemId, error: e?.message || String(e) });
    }
  }

  return summary;
}


