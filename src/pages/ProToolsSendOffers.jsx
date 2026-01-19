import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { inventoryApi } from "@/api/inventoryApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Send, ExternalLink } from "lucide-react";

const MARKETPLACES = [
  { id: "ebay", label: "eBay", color: "bg-blue-600" },
  { id: "mercari", label: "Mercari", color: "bg-orange-600" },
  { id: "facebook", label: "Facebook", color: "bg-sky-600" },
  { id: "poshmark", label: "Poshmark", color: "bg-pink-600" },
  { id: "depop", label: "Depop", color: "bg-red-600" },
  { id: "grailed", label: "Grailed", color: "bg-black" },
];

function readMarketplaceListings() {
  try {
    const raw = localStorage.getItem("marketplace_listings");
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

export default function ProToolsSendOffers() {
  const { toast } = useToast();
  const location = useLocation();
  const qs = new URLSearchParams(location.search || "");
  const initialMkt = qs.get("marketplace") || "ebay";
  const initialItemId = qs.get("itemId") || "";

  const [marketplace, setMarketplace] = useState(initialMkt);
  const [offerPct, setOfferPct] = useState("10");
  const [selectedIds, setSelectedIds] = useState(() => (initialItemId ? [initialItemId] : []));

  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: () => inventoryApi.list(),
  });

  const activeListingsByItemId = useMemo(() => {
    const listings = readMarketplaceListings();
    const map = new Map(); // itemId -> record
    for (const l of listings) {
      if (!l?.inventory_item_id || l?.marketplace !== marketplace) continue;
      const s = String(l?.status || "").toLowerCase();
      if (s !== "active") continue;
      map.set(String(l.inventory_item_id), l);
    }
    return map;
  }, [marketplace]);

  const rows = useMemo(() => {
    const pct = Number(offerPct);
    const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(99, pct)) : 0;
    const items = Array.isArray(inventoryItems) ? inventoryItems : [];
    const eligible = items
      .filter((it) => activeListingsByItemId.has(String(it?.id)))
      .map((it) => {
        const id = String(it.id);
        const listing = activeListingsByItemId.get(id);
        const basePrice =
          Number(it?.listing_price) ||
          Number(it?.price) ||
          Number(it?.purchase_price) ||
          0;
        const offerPrice = Math.max(0, basePrice * (1 - safePct / 100));
        const url = String(listing?.marketplace_listing_url || "");
        return {
          id,
          title: it?.item_name || "Untitled item",
          basePrice,
          offerPrice,
          listingUrl: url && url.startsWith("http") ? url : "",
        };
      });

    // If a deep-linked itemId was provided, prioritize it at the top.
    const pinned = initialItemId ? eligible.filter((r) => r.id === String(initialItemId)) : [];
    const rest = initialItemId ? eligible.filter((r) => r.id !== String(initialItemId)) : eligible;
    return [...pinned, ...rest];
  }, [inventoryItems, activeListingsByItemId, offerPct, initialItemId]);

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
  const allSelected = rows.length > 0 && rows.every((r) => selectedSet.has(r.id));

  const toggleAll = (checked) => {
    if (checked) setSelectedIds(rows.map((r) => r.id));
    else setSelectedIds([]);
  };

  const toggleOne = (id, checked) => {
    setSelectedIds((prev) => {
      const set = new Set(prev.map(String));
      if (checked) set.add(String(id));
      else set.delete(String(id));
      return Array.from(set);
    });
  };

  const runSendOffers = async () => {
    const targets = rows.filter((r) => selectedSet.has(r.id));
    if (!targets.length) {
      toast({ title: "No items selected", description: "Select at least one active listing to send offers.", variant: "destructive" });
      return;
    }

    // Persist a draft "campaign" in localStorage for support/debug.
    try {
      const draft = {
        t: Date.now(),
        marketplace,
        offerPct: Number(offerPct),
        targets: targets.map((t) => ({ id: t.id, listingUrl: t.listingUrl })),
      };
      localStorage.setItem("po_send_offers_last_draft", JSON.stringify(draft));
    } catch (_) {}

    // Attempt extension wiring (currently a stub that returns "not implemented").
    try {
      const ext = window?.ProfitOrbitExtension;
      if (typeof ext?.sendOffersBulk === "function") {
        const resp = await ext.sendOffersBulk({
          marketplace,
          offerPct: Number(offerPct),
          targets: targets.map((t) => ({ inventoryItemId: t.id, listingUrl: t.listingUrl })),
        });
        if (!resp?.success) {
          throw new Error(resp?.error || "Send Offers failed");
        }
        toast({ title: "Offers queued", description: "Offers have been queued for sending." });
        return;
      }
    } catch (e) {
      toast({
        title: "Automation not wired yet",
        description: e?.message || "We’ll wire Send Offers to extension recording/replay next.",
      });
      return;
    }

    toast({
      title: "Offer draft created",
      description: "Automation is being added next. For now, use each listing URL to send offers in the marketplace, or we can hook this to the extension recording/replay.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                to={createPageUrl("Pro Tools")}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Pro Tools
              </Link>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Active</Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground break-words mt-1">Send Offers</h1>
            <p className="text-sm text-muted-foreground break-words">
              Send bulk offers to likers/watchers. We’ll wire marketplace automation via extension recording.
            </p>
          </div>
          <Button onClick={runSendOffers} className="bg-emerald-600 hover:bg-emerald-700">
            <Send className="h-4 w-4 mr-2" />
            Send Offers
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-w-0">
          {/* Marketplace selector */}
          <Card className="lg:col-span-3 border border-border/60 bg-card/60 min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Marketplaces</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {MARKETPLACES.map((m) => {
                const isActive = marketplace === m.id;
                const count = Array.from(activeListingsByItemId.values()).filter((l) => l?.marketplace === m.id).length;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMarketplace(m.id)}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left min-w-0 ${
                      isActive ? "border-emerald-500/50 bg-emerald-500/10" : "border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-8 w-8 rounded-full ${m.color} flex items-center justify-center text-white text-xs font-bold`}>
                        {m.label.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{m.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{count} active</div>
                      </div>
                    </div>
                    {isActive ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">On</Badge> : <Badge variant="secondary">Off</Badge>}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Main */}
          <div className="lg:col-span-9 space-y-3 min-w-0">
            <Card className="border border-border/60 bg-card/60 min-w-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{MARKETPLACES.find((m) => m.id === marketplace)?.label || "Marketplace"}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">
                  <div className="min-w-0">
                    <Label className="text-xs">Offer % off</Label>
                    <Input
                      value={offerPct}
                      onChange={(e) => setOfferPct(e.target.value)}
                      inputMode="decimal"
                      placeholder="10"
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2 min-w-0">
                    <Label className="text-xs">Notes</Label>
                    <div className="mt-1 text-xs text-muted-foreground break-words">
                      This UI is live now; automation will be wired via extension recording/replay per marketplace.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60 bg-card/60 min-w-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                  <span>Eligible Listings</span>
                  <span className="text-xs text-muted-foreground">{isLoading ? "Loading…" : `${rows.length} items`}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 min-w-0">
                <div className="flex items-center gap-2 py-2">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(Boolean(v))} />
                  <span className="text-sm">Select all on this page</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="py-2 text-left w-10"></th>
                        <th className="py-2 text-left">Title</th>
                        <th className="py-2 text-right">Price</th>
                        <th className="py-2 text-right">Offer</th>
                        <th className="py-2 text-right">Listing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const checked = selectedSet.has(r.id);
                        return (
                          <tr key={r.id} className="border-b last:border-b-0">
                            <td className="py-3">
                              <Checkbox checked={checked} onCheckedChange={(v) => toggleOne(r.id, Boolean(v))} />
                            </td>
                            <td className="py-3 pr-3">
                              <div className="font-medium text-foreground truncate max-w-[420px]">{r.title}</div>
                              <div className="text-xs text-muted-foreground">{r.id}</div>
                            </td>
                            <td className="py-3 text-right tabular-nums">${r.basePrice.toFixed(2)}</td>
                            <td className="py-3 text-right tabular-nums">${r.offerPrice.toFixed(2)}</td>
                            <td className="py-3 text-right">
                              {r.listingUrl ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => window.open(r.listingUrl, "_blank", "noopener,noreferrer")}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  View
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!isLoading && rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                            No active listings found for this marketplace yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

