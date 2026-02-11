import React, { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { inventoryApi } from "@/api/inventoryApi";
import newApiClient from "@/api/newApiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Send, ExternalLink, Info, Save, MessageSquare, Edit, Heart, RefreshCw, Settings, ExternalLinkIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    const raw = localStorage.getItem("offers_sent_count_per_item");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function saveOffersSentCount(counts) {
  try {
    localStorage.setItem("offers_sent_count_per_item", JSON.stringify(counts));
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
  const [isLoadingMarketplaceItems, setIsLoadingMarketplaceItems] = useState(false);
  const [marketplaceConnectionError, setMarketplaceConnectionError] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [offersSentCount, setOffersSentCount] = useState(() => loadOffersSentCount());
  const [marketplaceItems, setMarketplaceItems] = useState([]);

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

  // Auto-fetch marketplace items when marketplace changes
  useEffect(() => {
    fetchMarketplaceItems();
  }, [marketplace]);

  // Check for OAuth callback on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('ebay_auth_success') === '1') {
      // eBay OAuth successful - show success message
      toast({
        title: "eBay Connected",
        description: "Your eBay account has been successfully connected.",
      });
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      
      // Re-fetch marketplace items
      setTimeout(() => {
        fetchMarketplaceItems();
      }, 500);
    } else if (params.get('ebay_auth_error')) {
      // eBay OAuth error
      const errorMsg = decodeURIComponent(params.get('ebay_auth_error'));
      toast({
        title: "eBay Connection Failed",
        description: errorMsg,
        variant: "destructive",
      });
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchMarketplaceItems = async () => {
    setIsLoadingMarketplaceItems(true);
    setMarketplaceConnectionError(false);
    // Don't clear items on refresh - prevents "No Image" flash
    // Items will be replaced when new data arrives
    
    try {
      // Check if extension is available for connection status
      const ext = window?.ProfitOrbitExtension;
      if (typeof ext?.getMarketplaceStatus === "function") {
        const status = await ext.getMarketplaceStatus(marketplace);
        if (!status?.connected) {
          setMarketplaceConnectionError(true);
          setIsLoadingMarketplaceItems(false);
          return;
        }
      }

      // Fetch eligible items from the API using newApiClient's auth pattern
      const { getCurrentUserId } = await import('@/api/supabaseClient');
      const { supabase } = await import('@/api/supabaseClient');
      
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || await getCurrentUserId();
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get marketplace token from localStorage (stored by OAuth or extension)
      let marketplaceToken = null;
      try {
        if (marketplace === 'ebay') {
          const ebayTokenData = localStorage.getItem('ebay_user_token');
          if (ebayTokenData) {
            const parsed = JSON.parse(ebayTokenData);
            marketplaceToken = parsed.access_token || parsed.token || ebayTokenData;
          }
          console.log(`🔑 eBay token ${marketplaceToken ? 'found' : 'not found'} in localStorage`);
        } else if (marketplace === 'mercari') {
          marketplaceToken = localStorage.getItem('profit_orbit_mercari_token');
        }
      } catch (e) {
        console.warn('Could not get marketplace token:', e);
      }

      const response = await fetch(`/api/offers/eligible-items?marketplaceId=${marketplace}&nextPage=0&limit=100&includeLiveData=true`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
          ...(marketplaceToken && { [`x-${marketplace}-token`]: marketplaceToken }),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Fetched ${data.items?.length || 0} eligible items for ${marketplace}`);
      
      // Debug: Log first item to see what data we're getting
      if (data.items && data.items.length > 0) {
        console.log('🔍 Sample item data:', {
          id: data.items[0].id,
          title: data.items[0].title,
          img: data.items[0].img,
          likes: data.items[0].likes,
          price: data.items[0].price,
        });
      }
      
      setMarketplaceItems(data.items || []);
    } catch (e) {
      console.error(`Error fetching ${marketplace} items:`, e);
      setMarketplaceConnectionError(true);
    } finally {
      setIsLoadingMarketplaceItems(false);
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

  // Count total offers sent per marketplace (sum of all item offers)
  const offersSentByMarketplace = useMemo(() => {
    const counts = {};
    // Sum up all offer counts for items that belong to each marketplace
    Object.entries(offersSentCount).forEach(([itemId, count]) => {
      // For now, we'll assign the count to the current marketplace
      // In a real implementation, you'd look up which marketplace each itemId belongs to
      if (!counts[marketplace]) counts[marketplace] = 0;
      counts[marketplace] += count;
    });
    return counts;
  }, [offersSentCount, marketplace]);

  const rows = useMemo(() => {
    const pct = Number(offerPct);
    const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(99, pct)) : 0;
    
    // Use marketplace items from API if available, otherwise fall back to inventory items
    const items = marketplaceItems.length > 0 
      ? marketplaceItems 
      : (Array.isArray(inventoryItems) ? inventoryItems : []);
    
    // Get the marketplace-specific item ID field name (e.g., "ebay_item_id", "mercari_item_id")
    const marketplaceItemIdField = `${marketplace}_item_id`;
    
    const eligible = items
      .filter((it) => {
        // If using marketplace items from API, they're already filtered
        if (marketplaceItems.length > 0) return true;
        
        // Otherwise, filter inventory items
        if (activeListingsByItemId.has(String(it?.id))) return true;
        if (it?.[marketplaceItemIdField]) return true;
        
        return false;
      })
      .map((it) => {
        const id = String(it.id || it.itemId);
        const listing = activeListingsByItemId.get(id);
        
        // For API items, use the provided fields
        if (marketplaceItems.length > 0) {
          const vendooPrice = Number(it?.price) || 0;
          const mktplacePrice = Number(it?.marketplacePrice) || vendooPrice;
          const basePrice = offerPriceBasedOn === "marketplace_price" ? mktplacePrice : vendooPrice;
          const defaultOfferPrice = Math.max(0, basePrice * (1 - safePct / 100));
          const offerPrice = customOffers[id] !== undefined ? customOffers[id] : defaultOfferPrice;
          const discount = Math.max(0, basePrice - offerPrice);
          const cog = Number(it?.costOfGoods) || 0;
          const earnings = Math.max(0, offerPrice - cog);
          const likes = Number(it?.likes) || 0;
          
          // Get offer count for this specific item
          const itemOfferCount = offersSentCount[id] || 0;
          
          return {
            id,
            title: it?.title || "Untitled item",
            image: it?.img || "",
            likes,
            vendooPrice,
            mktplacePrice,
            discount,
            offerPrice,
            cog,
            earnings,
            listingUrl: it?.listingUrl || "",
            offersSent: itemOfferCount,
          };
        }
        
        // For local inventory items
        const vendooPrice = Number(it?.listing_price) || Number(it?.price) || Number(it?.purchase_price) || 0;
        const mktplacePrice = Number(listing?.marketplace_price) || vendooPrice;
        const basePrice = offerPriceBasedOn === "marketplace_price" ? mktplacePrice : vendooPrice;
        const defaultOfferPrice = Math.max(0, basePrice * (1 - safePct / 100));
        const offerPrice = customOffers[id] !== undefined ? customOffers[id] : defaultOfferPrice;
        const discount = Math.max(0, basePrice - offerPrice);
        const cog = Number(it?.purchase_price) || 0;
        const earnings = Math.max(0, offerPrice - cog);
        const likes = Number(listing?.likes) || Number(it?.mercari_likes) || 0;
        const url = String(listing?.marketplace_listing_url || "");
        
        // Get offer count for this specific item
        const itemOfferCount = offersSentCount[id] || 0;
        
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
          offersSent: itemOfferCount,
        };
      });

    // If a deep-linked itemId was provided, prioritize it at the top.
    const pinned = initialItemId ? eligible.filter((r) => r.id === String(initialItemId)) : [];
    const rest = initialItemId ? eligible.filter((r) => r.id !== String(initialItemId)) : eligible;
    return [...pinned, ...rest];
  }, [inventoryItems, marketplaceItems, activeListingsByItemId, offerPct, offerPriceBasedOn, customOffers, initialItemId, offersSentCount]);

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

  const handleConnectMarketplace = () => {
    // Handle marketplace connection using the same flow as Settings page
    if (marketplace === 'ebay') {
      // Store the current page path so we can return here after OAuth
      sessionStorage.setItem('ebay_oauth_return', window.location.pathname);
      
      // Trigger eBay OAuth flow
      window.location.href = '/api/ebay/auth';
    } else if (marketplace === 'mercari') {
      // Open Mercari in popup for extension-based connection
      const width = 1000;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      window.open(
        'https://www.mercari.com',
        'mercari_login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=0,scrollbars=1,status=0,resizable=1,location=1,menuBar=0`
      );
      
      // Wait for connection and refresh
      setTimeout(() => {
        fetchMarketplaceItems();
      }, 5000);
    } else if (marketplace === 'facebook') {
      // Open Facebook in popup for extension-based connection
      const width = 1000;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      window.open(
        'https://www.facebook.com/marketplace',
        'facebook_login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=0,scrollbars=1,status=0,resizable=1,location=1,menuBar=0`
      );
      
      // Wait for connection and refresh
      setTimeout(() => {
        fetchMarketplaceItems();
      }, 5000);
    } else {
      // Generic marketplace connection
      toast({
        title: "Coming Soon",
        description: `${MARKETPLACES.find(m => m.id === marketplace)?.label} connection is coming soon.`,
      });
    }
  };

  const handleGoToSettings = () => {
    // Navigate to settings page
    window.location.href = createPageUrl("Settings");
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
        // Update offers sent count for each item
        setOffersSentCount((prev) => {
          const updated = { ...prev };
          targets.forEach((t) => {
            updated[t.id] = (updated[t.id] || 0) + 1;
          });
          return updated;
        });
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
                const sentCount = offersSentByMarketplace[m.id] || 0;
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
                    <Badge className={isActive ? "bg-emerald-600 text-white hover:bg-emerald-600" : ""} variant={isActive ? undefined : "secondary"}>
                      {sentCount}
                    </Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Main */}
          <div className="lg:col-span-9 space-y-3 min-w-0">
            {/* Marketplace connection error */}
            {marketplaceConnectionError && (
              <Alert variant="destructive">
                <AlertDescription className="flex flex-col gap-3">
                  <p className="text-white">
                    We had trouble accessing your {MARKETPLACES.find((m) => m.id === marketplace)?.label} account. 
                    Please log into the marketplace or check your settings.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white text-black hover:bg-gray-100 hover:text-black border-white"
                      onClick={handleGoToSettings}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white text-black hover:bg-gray-100 hover:text-black border-white"
                      onClick={handleConnectMarketplace}
                    >
                      <ExternalLinkIcon className="h-4 w-4 mr-2" />
                      Connect
                    </Button>
                  </div>
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
                  <div className="flex items-center gap-2">
                    <span>Eligible Listings</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={fetchMarketplaceItems}
                      disabled={isLoadingMarketplaceItems}
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingMarketplaceItems ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {isLoading || isLoadingMarketplaceItems ? "Loading…" : `${rows.length} items`}
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
                        <th className="py-2 px-2 text-left">Item</th>
                        <th className="py-2 px-2 text-center w-16">Likes</th>
                        <th className="py-2 px-2 text-center w-20">
                          <div className="flex items-center justify-center gap-1">
                            Offers Sent
                            <Info className="h-3 w-3" title="Number of offers sent for this item" />
                          </div>
                        </th>
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
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Product Image */}
                                {r.image ? (
                                  <div className="flex-shrink-0" style={{ width: '60px', height: '60px' }}>
                                    <img 
                                      src={r.image} 
                                      alt={`Image of ${r.title}`}
                                      loading="lazy"
                                      style={{ 
                                        objectFit: 'fill', 
                                        width: '100%', 
                                        height: '100%',
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '4px'
                                      }}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div 
                                    className="flex-shrink-0 flex items-center justify-center bg-muted text-muted-foreground"
                                    style={{ 
                                      width: '60px', 
                                      height: '60px',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    <span className="text-xs">No image</span>
                                  </div>
                                )}
                                
                                {/* Title and ID */}
                                <div className="min-w-0 flex-1">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        className="font-medium text-foreground hover:text-blue-600 hover:underline cursor-pointer text-left"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {r.title.length > 12 ? `${r.title.substring(0, 12)}...` : r.title}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent 
                                      className="w-80 p-3 text-sm" 
                                      side="top"
                                      align="start"
                                    >
                                      <p className="break-words">{r.title}</p>
                                    </PopoverContent>
                                  </Popover>
                                  <div className="text-xs text-muted-foreground">{r.id}</div>
                                </div>
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
                            <td className="py-2 px-2 text-center">
                              {r.offersSent > 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  {r.offersSent}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
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

                  {rows.length === 0 && !isLoading && !isLoadingMarketplaceItems && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No eligible listings found for {MARKETPLACES.find((m) => m.id === marketplace)?.label}.
                      <br />
                      {marketplaceConnectionError ? (
                        <span>Please check your connection settings and try again.</span>
                      ) : (
                        <span>Make sure you have active listings synced from this marketplace.</span>
                      )}
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
