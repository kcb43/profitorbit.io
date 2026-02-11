import React, { useMemo, useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Send, ExternalLink, Info, Save, MessageSquare, Edit, Heart } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MARKETPLACES = [
  { id: "ebay", label: "eBay", color: "bg-blue-600" },
  { id: "mercari", label: "Mercari", color: "bg-orange-600" },
  { id: "facebook", label: "Facebook", color: "bg-sky-600" },
  { id: "poshmark", label: "Poshmark", color: "bg-pink-600" },
  { id: "depop", label: "Depop", color: "bg-red-600" },
  { id: "grailed", label: "Grailed", color: "bg-black" },
];

const OFFER_PRICE_BASED_ON_OPTIONS = [
  { value: "vendoo_price", label: "Orben price" },
  { value: "marketplace_price", label: "Marketplace price" },
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

function loadOfferDefaults(marketplace) {
  try {
    const key = `offer_defaults_${marketplace}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function saveOfferDefaults(marketplace, data) {
  try {
    const key = `offer_defaults_${marketplace}`;
    const existing = loadOfferDefaults(marketplace) || {};
    localStorage.setItem(key, JSON.stringify({ ...existing, ...data }));
    return true;
  } catch (_) {
    return false;
  }
}

function loadOffersSentCount() {
  try {
    const raw = localStorage.getItem("offers_sent_count");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function saveOffersSentCount(counts) {
  try {
    localStorage.setItem("offers_sent_count", JSON.stringify(counts));
    return true;
  } catch (_) {
    return false;
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
  const [offerPriceBasedOn, setOfferPriceBasedOn] = useState("vendoo_price");
  const [offerMessage, setOfferMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => (initialItemId ? [initialItemId] : []));
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [customOffers, setCustomOffers] = useState({});
  const [isLoadingEbayItems, setIsLoadingEbayItems] = useState(false);
  const [ebayConnectionError, setEbayConnectionError] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [offersSentCount, setOffersSentCount] = useState(() => loadOffersSentCount());

  // Save offers sent count to localStorage whenever it changes
  useEffect(() => {
    saveOffersSentCount(offersSentCount);
  }, [offersSentCount]);

  // Load defaults when marketplace changes
  useEffect(() => {
    const defaults = loadOfferDefaults(marketplace);
    if (defaults) {
      if (defaults.offerPct) setOfferPct(String(defaults.offerPct));
      if (defaults.offerPriceBasedOn) setOfferPriceBasedOn(defaults.offerPriceBasedOn);
      if (defaults.offerMessage) setOfferMessage(defaults.offerMessage);
    }
  }, [marketplace]);

  // Auto-fetch eBay items when marketplace is eBay
  useEffect(() => {
    if (marketplace === "ebay") {
      fetchEbayItems();
    }
  }, [marketplace]);

  const fetchEbayItems = async () => {
    setIsLoadingEbayItems(true);
    setEbayConnectionError(false);
    try {
      // Check if extension is available
      const ext = window?.ProfitOrbitExtension;
      if (typeof ext?.getMarketplaceStatus === "function") {
        const status = await ext.getMarketplaceStatus("ebay");
        if (!status?.connected) {
          setEbayConnectionError(true);
          setIsLoadingEbayItems(false);
          return;
        }
      }

      // Attempt to fetch eBay items that are eligible for offers
      // This would typically call the extension to get active listings from eBay
      // For now, we'll rely on the inventory items that have eBay connections
    } catch (e) {
      console.error("Error fetching eBay items:", e);
      setEbayConnectionError(true);
    } finally {
      setIsLoadingEbayItems(false);
    }
  };

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

  // Count active listings per marketplace for the sidebar
  const activeListingCountsByMarketplace = useMemo(() => {
    const listings = readMarketplaceListings();
    const counts = {};
    for (const l of listings) {
      if (!l?.inventory_item_id || !l?.marketplace) continue;
      const s = String(l?.status || "").toLowerCase();
      if (s !== "active") continue;
      counts[l.marketplace] = (counts[l.marketplace] || 0) + 1;
    }
    return counts;
  }, []);

  const rows = useMemo(() => {
    const pct = Number(offerPct);
    const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(99, pct)) : 0;
    const items = Array.isArray(inventoryItems) ? inventoryItems : [];
    const eligible = items
      .filter((it) => activeListingsByItemId.has(String(it?.id)))
      .map((it) => {
        const id = String(it.id);
        const listing = activeListingsByItemId.get(id);
        
        // Orben price = our listing price or purchase price
        const vendooPrice = Number(it?.listing_price) || Number(it?.price) || Number(it?.purchase_price) || 0;
        
        // Marketplace price = the price on the actual marketplace listing
        const mktplacePrice = Number(listing?.marketplace_price) || vendooPrice;
        
        // Base price depends on "offer price based on" selection
        const basePrice = offerPriceBasedOn === "marketplace_price" ? mktplacePrice : vendooPrice;
        
        // Calculate offer price (check if custom override exists)
        const defaultOfferPrice = Math.max(0, basePrice * (1 - safePct / 100));
        const offerPrice = customOffers[id] !== undefined ? customOffers[id] : defaultOfferPrice;
        
        // Discount = base price - offer price
        const discount = Math.max(0, basePrice - offerPrice);
        
        // COG = cost of goods
        const cog = Number(it?.purchase_price) || 0;
        
        // Earnings = offer price - cog
        const earnings = Math.max(0, offerPrice - cog);
        
        // Likes/watchers count (from listing data or Mercari metrics)
        const likes = Number(listing?.likes) || Number(it?.mercari_likes) || 0;
        
        const url = String(listing?.marketplace_listing_url || "");
        
        return {
          id,
          title: it?.item_name || "Untitled item",
          image: it?.photos?.[0] || "",
          likes,
          vendooPrice,
          mktplacePrice,
          discount,
          offerPrice,
          cog,
          earnings,
          listingUrl: url && url.startsWith("http") ? url : "",
        };
      });

    // If a deep-linked itemId was provided, prioritize it at the top.
    const pinned = initialItemId ? eligible.filter((r) => r.id === String(initialItemId)) : [];
    const rest = initialItemId ? eligible.filter((r) => r.id !== String(initialItemId)) : eligible;
    return [...pinned, ...rest];
  }, [inventoryItems, activeListingsByItemId, offerPct, offerPriceBasedOn, customOffers, initialItemId]);

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

  const updateCustomOffer = (id, value) => {
    const price = parseFloat(value);
    if (Number.isFinite(price) && price >= 0) {
      setCustomOffers((prev) => ({ ...prev, [id]: price }));
      setEditingOfferId(null);
    }
  };

  const saveDefaultOffer = () => {
    const success = saveOfferDefaults(marketplace, {
      offerPct: Number(offerPct),
    });
    if (success) {
      toast({ title: "Saved!", description: "Offer percentage saved as default for " + MARKETPLACES.find(m => m.id === marketplace)?.label });
    } else {
      toast({ title: "Error", description: "Failed to save defaults", variant: "destructive" });
    }
  };

  const saveDefaultOfferPriceBasedOn = () => {
    const success = saveOfferDefaults(marketplace, {
      offerPriceBasedOn,
    });
    if (success) {
      toast({ title: "Saved!", description: "Offer price basis saved as default for " + MARKETPLACES.find(m => m.id === marketplace)?.label });
    } else {
      toast({ title: "Error", description: "Failed to save defaults", variant: "destructive" });
    }
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
        offerPriceBasedOn,
        offerMessage,
        targets: targets.map((t) => ({
          id: t.id,
          listingUrl: t.listingUrl,
          vendooPrice: t.vendooPrice,
          mktplacePrice: t.mktplacePrice,
          offerPrice: t.offerPrice,
        })),
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
          offerPriceBasedOn,
          message: offerMessage || undefined,
          targets: targets.map((t) => ({
            inventoryItemId: t.id,
            listingUrl: t.listingUrl,
            vendooPrice: t.vendooPrice,
            mktplacePrice: t.mktplacePrice,
            offerPrice: t.offerPrice,
          })),
        });
        if (!resp?.success) {
          throw new Error(resp?.error || "Send Offers failed");
        }
        toast({ title: "Offers sent!", description: `${targets.length} offers have been sent.` });
        // Update offers sent count for this marketplace
        setOffersSentCount((prev) => ({
          ...prev,
          [marketplace]: (prev[marketplace] || 0) + targets.length,
        }));
        // Clear selection
        setSelectedIds([]);
        return;
      }
    } catch (e) {
      toast({
        title: "Automation not wired yet",
        description: e?.message || "We'll wire Send Offers to extension recording/replay next.",
      });
      return;
    }

    toast({
      title: "Offer draft created",
      description: "Automation is being added next. For now, use each listing URL to send offers in the marketplace, or we can hook this to the extension recording/replay.",
    });
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
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
              Send bulk offers to likers/watchers. We'll wire marketplace automation via extension recording.
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
                const count = activeListingCountsByMarketplace[m.id] || 0;
                const sentCount = offersSentCount[m.id] || 0;
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
                    {isActive ? (
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">On</Badge>
                    ) : sentCount > 0 ? (
                      <Badge variant="secondary">{sentCount}</Badge>
                    ) : (
                      <Badge variant="secondary">Off</Badge>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Main */}
          <div className="lg:col-span-9 space-y-3 min-w-0">
            {/* eBay connection error */}
            {marketplace === "ebay" && ebayConnectionError && (
              <Alert variant="destructive">
                <AlertDescription>
                  We had trouble accessing your eBay account. Please log into{" "}
                  <a
                    href="https://ebay.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    https://ebay.com
                  </a>{" "}
                  in a different tab or your settings. Then, click on "Connect" button, so we can try again.
                </AlertDescription>
              </Alert>
            )}

            {/* Settings */}
            <Card className="border border-border/60 bg-card/60 min-w-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{MARKETPLACES.find((m) => m.id === marketplace)?.label || "Marketplace"}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                  {/* Offer field */}
                  <div className="min-w-0">
                    <Label className="text-xs font-medium">Offer</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="relative flex-1">
                        <Input
                          value={offerPct}
                          onChange={(e) => setOfferPct(e.target.value)}
                          inputMode="decimal"
                          placeholder="10"
                          className="pr-8"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={saveDefaultOffer}
                        title="Save as default"
                        className="flex-shrink-0"
                      >
                        <Save className="h-4 w-4 text-foreground dark:text-foreground" />
                      </Button>
                    </div>
                  </div>

                  {/* Offer price based on */}
                  <div className="min-w-0">
                    <Label className="text-xs font-medium">Offer price based on</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Select value={offerPriceBasedOn} onValueChange={setOfferPriceBasedOn}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OFFER_PRICE_BASED_ON_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={saveDefaultOfferPriceBasedOn}
                        title="Save as default"
                        className="flex-shrink-0"
                      >
                        <Save className="h-4 w-4 text-foreground dark:text-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Add Message */}
                <div className="mt-4">
                  <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="link" className="text-blue-600 dark:text-blue-400 p-0 h-auto">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Add Message
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Offer Message</DialogTitle>
                        <DialogDescription>
                          Add a personalized message to include with your offers. This will be sent to buyers when they receive the offer.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="offer-message">Message</Label>
                          <Textarea
                            id="offer-message"
                            value={offerMessage}
                            onChange={(e) => setOfferMessage(e.target.value)}
                            placeholder="Example: Thank you for your interest! I'd love to make you a deal."
                            className="mt-1"
                            rows={4}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setShowMessageDialog(false)}>
                            Cancel
                          </Button>
                          <Button type="button" onClick={() => setShowMessageDialog(false)}>
                            Save Message
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  {offerMessage && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      <strong>Message preview:</strong> {offerMessage}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Eligible Listings Table */}
            <Card className="border border-border/60 bg-card/60 min-w-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                  <span>Eligible Listings</span>
                  <span className="text-xs text-muted-foreground">
                    {isLoading || isLoadingEbayItems ? "Loading…" : `${rows.length} items`}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 min-w-0">
                <div className="flex items-center gap-2 py-2">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(Boolean(v))} />
                  <span className="text-sm">Select all on this page</span>
                  <span className="text-xs text-muted-foreground">({rows.length} {rows.length === 1 ? 'item' : 'items'})</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="py-2 px-2 text-left w-8"></th>
                        <th className="py-2 px-2 text-left">Title</th>
                        <th className="py-2 px-2 text-center w-16">Likes</th>
                        <th className="py-2 px-2 text-right w-24">Orben Price</th>
                        <th className="py-2 px-2 text-right w-24">Mktplace Price</th>
                        <th className="py-2 px-2 text-right w-20">Discount</th>
                        <th className="py-2 px-2 text-right w-24">Offer</th>
                        <th className="py-2 px-2 text-right w-20">COG</th>
                        <th className="py-2 px-2 text-right w-24">
                          <div className="flex items-center justify-end gap-1">
                            Earnings
                            <Info className="h-3 w-3" title="Offer Price - Cost of Goods" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const checked = selectedSet.has(r.id);
                        const isEditing = editingOfferId === r.id;
                        return (
                          <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/20">
                            <td className="py-2 px-2">
                              <Checkbox checked={checked} onCheckedChange={(v) => toggleOne(r.id, Boolean(v))} />
                            </td>
                            <td className="py-2 px-2">
                              <div className="min-w-0">
                                <div className="font-medium text-foreground truncate">{r.title}</div>
                                <div className="text-xs text-muted-foreground">{r.id}</div>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              {r.likes > 0 ? (
                                <div className="flex items-center justify-center gap-1 text-pink-600">
                                  <Heart className="h-3 w-3 fill-current" />
                                  <span className="text-xs">{r.likes}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums font-medium">
                              ${r.vendooPrice.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              ${r.mktplacePrice.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums text-emerald-600">
                              ${r.discount.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={r.offerPrice.toFixed(2)}
                                  onChange={(e) => updateCustomOffer(r.id, e.target.value)}
                                  onBlur={() => setEditingOfferId(null)}
                                  className="w-20 text-right text-xs p-1"
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => setEditingOfferId(r.id)}
                                  className="tabular-nums text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                >
                                  ${r.offerPrice.toFixed(2)}
                                  <Edit className="h-3 w-3" />
                                </button>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums text-muted-foreground text-xs">
                              ${r.cog.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums font-semibold text-emerald-600">
                              ${r.earnings.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {rows.length === 0 && !isLoading && !isLoadingEbayItems && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No eligible listings found for {MARKETPLACES.find((m) => m.id === marketplace)?.label}.
                      <br />
                      Make sure you have active listings synced from this marketplace.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
