import React, { useMemo, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ArrowLeft, Send, ExternalLink, Info, Save, MessageSquare, Edit, Heart, RefreshCw, Settings, ExternalLinkIcon, AlertCircle } from "lucide-react";
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
import facebookLogo from "@/assets/facebook-logo.svg";
import { DuplicateDetectionDialog } from "@/components/DuplicateDetectionDialog";

const MARKETPLACES = [
  { id: "ebay", label: "eBay", color: "bg-blue-600", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg" },
  { id: "mercari", label: "Mercari", color: "bg-orange-600", logo: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B" },
  { id: "facebook", label: "Facebook", color: "bg-sky-600", logo: facebookLogo },
  { id: "poshmark", label: "Poshmark", color: "bg-pink-600", logo: "https://cdn.brandfetch.io/idUxsADOAW/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B" },
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

function loadCachedMarketplaceItems(marketplace) {
  try {
    const raw = localStorage.getItem(`marketplace_items_${marketplace}`);
    if (!raw) return [];
    const cached = JSON.parse(raw);
    // Only use cache if it's less than 1 hour old
    if (cached.timestamp && Date.now() - cached.timestamp < 3600000) {
      return cached.items || [];
    }
    return [];
  } catch (_) {
    return [];
  }
}

function saveCachedMarketplaceItems(marketplace, items) {
  try {
    localStorage.setItem(`marketplace_items_${marketplace}`, JSON.stringify({
      items,
      timestamp: Date.now(),
    }));
    return true;
  } catch (_) {
    return false;
  }
}

export default function ProToolsSendOffers() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const [marketplaceItems, setMarketplaceItems] = useState(() => loadCachedMarketplaceItems(marketplace));
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [detectedDuplicates, setDetectedDuplicates] = useState(null);
  const [ebayTokenExpired, setEbayTokenExpired] = useState(false);

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
    // Load cached items immediately for the new marketplace
    const cached = loadCachedMarketplaceItems(marketplace);
    if (cached.length > 0) {
      setMarketplaceItems(cached);
    }
    
    // Then fetch fresh data
    fetchMarketplaceItems();
  }, [marketplace]);

  // Refetch when page becomes visible (e.g., returning from Inventory page after delete)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Page visible again, refetching marketplace items to sync with inventory changes...');
        fetchMarketplaceItems();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also refetch when window regains focus
    const handleFocus = () => {
      console.log('🔄 Window focused, refetching marketplace items...');
      fetchMarketplaceItems();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [marketplace]);

  // Subscribe to inventory changes (when items are deleted/updated)
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Listen for inventory query invalidations
      if (event.type === 'updated' && event.query.queryKey[0] === 'inventoryItems') {
        console.log('📢 Inventory updated, refetching marketplace items...');
        // Debounce to avoid multiple refetches
        const timer = setTimeout(() => {
          fetchMarketplaceItems();
        }, 500);
        return () => clearTimeout(timer);
      }
    });
    
    return unsubscribe;
  }, [marketplace, queryClient]);

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

  // Import mutation for eBay items
  const importMutation = useMutation({
    mutationFn: async ({ itemId, ebayItemId }) => {
      console.log(`📥 Importing eBay item: ${ebayItemId} (local ID: ${itemId})`);
      
      const { supabase, getCurrentUserId } = await import('@/api/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || await getCurrentUserId();
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get eBay token
      let ebayToken = null;
      try {
        const ebayTokenData = localStorage.getItem('ebay_user_token');
        if (ebayTokenData) {
          const parsed = JSON.parse(ebayTokenData);
          ebayToken = parsed.access_token || parsed.token || ebayTokenData;
        }
      } catch (e) {
        console.warn('Could not get eBay token:', e);
      }

      if (!ebayToken) {
        throw new Error('eBay not connected. Please connect your eBay account first.');
      }

      // Call import API
      const response = await fetch('/api/ebay/import-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
          'X-User-Token': ebayToken,
        },
        body: JSON.stringify({
          itemIds: [ebayItemId],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import item');
      }

      const data = await response.json();
      console.log('✅ Import response:', data);
      
      if (data.importedItems && data.importedItems.length > 0) {
        return {
          localItemId: itemId, // The local item ID used in the UI
          ebayItemId: ebayItemId, // The actual eBay item ID
          inventoryId: data.importedItems[0].inventoryId,
          potentialDuplicates: data.potentialDuplicates,
        };
      }
      
      throw new Error('Import succeeded but no inventory ID returned');
    },
    onSuccess: (data) => {
      console.log('✅ Import successful:', data);
      console.log('🔍 Updating marketplace items. Looking for localItemId:', data.localItemId);
      
      // Update the local state to mark item as imported
      setMarketplaceItems(prevItems => {
        console.log('📦 Current marketplace items count:', prevItems.length);
        console.log('🔍 Sample IDs:', prevItems.slice(0, 3).map(i => ({ id: i.id, itemId: i.itemId, ebayItemId: i.ebayItemId })));
        
        const updated = prevItems.map(item => {
          // Match by local ID
          if (item.id === data.localItemId || item.itemId === data.localItemId) {
            console.log(`✅ MATCH FOUND! Marking item ${item.id} as imported with inventory ID ${data.inventoryId}`);
            return { ...item, isImported: true, inventoryId: data.inventoryId };
          }
          return item;
        });
        
        // Check if any items were updated
        const updatedCount = updated.filter((item, idx) => item !== prevItems[idx]).length;
        console.log(`📊 Updated ${updatedCount} items in state`);
        
        // Save to cache for persistence
        saveCachedMarketplaceItems(marketplace, updated);
        console.log('💾 Updated marketplace items cache');
        
        return updated;
      });
      
      // Invalidate queries to refresh both Import page and inventory
      queryClient.invalidateQueries(['inventoryItems']);
      queryClient.invalidateQueries(['ebay-listings']); // Refresh Import page counter
      
      // Check for potential duplicates
      if (data.potentialDuplicates && Object.keys(data.potentialDuplicates).length > 0) {
        console.log('🔍 Potential duplicates detected:', data.potentialDuplicates);
        setDetectedDuplicates(data.potentialDuplicates);
        setDuplicateDialogOpen(true);
        
        toast({
          title: "Import Successful",
          description: "Potential duplicates detected - please review",
          variant: "default",
        });
      } else {
        toast({
          title: "Import Successful",
          description: "Item has been imported to your inventory",
        });
      }
    },
    onError: (error) => {
      console.error('❌ Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
            
            // Check if token is expired
            const now = Date.now();
            const expiresAt = parsed.expires_at;
            
            if (expiresAt && now >= expiresAt) {
              console.log('❌ eBay token expired');
              setEbayTokenExpired(true);
              setMarketplaceConnectionError(true);
              setIsLoadingMarketplaceItems(false);
              return;
            }
            
            setEbayTokenExpired(false);
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
      
      const newItems = data.items || [];
      
      // Merge with existing items to preserve images, imported status, and inventory IDs
      setMarketplaceItems(prevItems => {
        // Create a map of existing items by ID
        const existingMap = new Map(prevItems.map(item => [item.id || item.itemId, item]));
        
        // Merge new items with existing, preserving important fields from cache
        const merged = newItems.map(newItem => {
          const itemId = newItem.id || newItem.itemId;
          const existing = existingMap.get(itemId);
          
          if (existing) {
            // Preserve image, imported status, and inventoryId from existing cache
            return { 
              ...newItem, 
              img: existing.img || newItem.img,
              isImported: existing.isImported ?? newItem.isImported,
              inventoryId: existing.inventoryId || newItem.inventoryId,
            };
          }
          
          return newItem;
        });
        
        // Save merged items to cache
        saveCachedMarketplaceItems(marketplace, merged);
        console.log('💾 Merged and cached marketplace items, preserving imported states');
        
        return merged;
      });
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
    
    // Create a set of selected IDs for quick lookup
    const selectedSet = new Set(selectedIds.map(String));
    
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
        const isSelected = selectedSet.has(id);
        
        // Only apply the offer percentage if the item is selected
        const appliedPct = isSelected ? safePct : 0;
        
        // For API items, use the provided fields
        if (marketplaceItems.length > 0) {
          const vendooPrice = Number(it?.price) || 0;
          const mktplacePrice = Number(it?.marketplacePrice) || vendooPrice;
          const basePrice = offerPriceBasedOn === "marketplace_price" ? mktplacePrice : vendooPrice;
          const defaultOfferPrice = Math.max(0, basePrice * (1 - appliedPct / 100));
          const offerPrice = customOffers[id] !== undefined ? customOffers[id] : defaultOfferPrice;
          const discount = Math.max(0, basePrice - offerPrice);
          const cog = Number(it?.costOfGoods) || 0;
          const earnings = Math.max(0, offerPrice - cog);
          const likes = Number(it?.likes) || 0;
          const hitCount = Number(it?.hitCount) || 0;
          
          // Get offer count for this specific item
          const itemOfferCount = offersSentCount[id] || 0;
          
          const isImported = it?.isImported !== false; // Pass through from API
          
          return {
            id,
            title: it?.title || "Untitled item",
            image: it?.img || "",
            likes,
            hitCount,
            vendooPrice,
            mktplacePrice,
            discount,
            offerPrice,
            cog,
            earnings,
            listingUrl: it?.listingUrl || "",
            listingId: it?.listingId, // eBay item ID for API calls
            offersSent: itemOfferCount,
            isImported: isImported,
            ebayItemId: it?.ebayItemId || it?.listingId, // For import action
            inventoryId: it?.inventoryId || null, // For linking to item details
          };
        }
        
        // For local inventory items
        const vendooPrice = Number(it?.listing_price) || Number(it?.price) || Number(it?.purchase_price) || 0;
        const mktplacePrice = Number(listing?.marketplace_price) || vendooPrice;
        const basePrice = offerPriceBasedOn === "marketplace_price" ? mktplacePrice : vendooPrice;
        const defaultOfferPrice = Math.max(0, basePrice * (1 - appliedPct / 100));
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
          hitCount: Number(listing?.hitCount) || Number(it?.hitCount) || 0,
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
  }, [inventoryItems, marketplaceItems, activeListingsByItemId, offerPct, offerPriceBasedOn, customOffers, initialItemId, offersSentCount, selectedIds]);

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
    // Filter to only imported items (non-imported can't have offers sent)
    const allSelectedRows = rows.filter((r) => selectedSet.has(r.id));
    const targets = allSelectedRows.filter((r) => r.isImported !== false);
    const skippedCount = allSelectedRows.length - targets.length;
    
    if (!targets.length) {
      toast({ 
        title: "No items selected", 
        description: skippedCount > 0 
          ? `${skippedCount} non-imported item${skippedCount > 1 ? 's' : ''} cannot receive offers. Please import them first.`
          : "Select at least one imported item to send offers.", 
        variant: "destructive" 
      });
      return;
    }

    // Show loading toast
    const loadingToast = toast({ 
      title: "Sending offers...", 
      description: `Processing ${targets.length} item${targets.length > 1 ? 's' : ''}`,
      duration: Infinity,
    });

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
          listingId: t.ebayItemId || t.id,
          vendooPrice: t.vendooPrice,
          mktplacePrice: t.mktplacePrice,
          offerPrice: t.offerPrice,
        })),
      };
      localStorage.setItem("po_send_offers_last_draft", JSON.stringify(draft));
    } catch (_) {}

    // Attempt extension wiring
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
            listingId: t.ebayItemId || t.id,
            listingUrl: t.listingUrl,
            vendooPrice: t.vendooPrice,
            mktplacePrice: t.mktplacePrice,
            offerPrice: t.offerPrice,
          })),
        });
        
        // Dismiss loading toast
        loadingToast.dismiss();
        
        if (!resp?.success) {
          throw new Error(resp?.error || "Send Offers failed");
        }
        
        // Show modern success toast
        const successCount = resp.count || targets.length;
        toast({ 
          title: "Sent Offers", 
          description: `${successCount}/${targets.length} items completed`,
          variant: "success",
          duration: 5000,
        });
        
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
      // Dismiss loading toast
      loadingToast.dismiss();
      
      toast({
        title: "Error",
        description: e?.message || "Failed to send offers",
        variant: "destructive",
      });
      return;
    }

    // Dismiss loading toast
    loadingToast.dismiss();
    
    toast({
      title: "Offer draft created",
      description: "Extension not available. Please reload the page.",
      variant: "destructive",
    });
  };

  // Count imported items that are selected (only these can receive offers)
  const selectedImportedCount = useMemo(() => {
    return rows.filter(r => selectedSet.has(r.id) && r.isImported !== false).length;
  }, [rows, selectedSet]);

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
        
        {/* Floating Action Button - appears when items are selected */}
        {selectedImportedCount > 0 && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
            <Button 
              onClick={runSendOffers} 
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 shadow-2xl px-8 py-6 text-base font-semibold rounded-full"
            >
              <Send className="h-5 w-5 mr-2" />
              Send {offerPct}% off Offers ({selectedImportedCount})
            </Button>
          </div>
        )}

        {/* Expired Token Banner */}
        {marketplace === "ebay" && ebayTokenExpired && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Your eBay connection has expired. Please reconnect to continue.
              </span>
              <Link to={createPageUrl("Settings")}>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4 bg-white hover:bg-white/90 text-red-600 border-red-200"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Go to Settings
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

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
                      {m.logo ? (
                        <div className="h-8 w-8 flex items-center justify-center flex-shrink-0">
                          <img 
                            src={m.logo} 
                            alt={`${m.label} logo`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className={`h-8 w-8 rounded-full ${m.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {m.label.slice(0, 1)}
                        </div>
                      )}
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
                          This will be sent to buyers when they receive the offer.
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
                        <th className="py-2 px-2 text-center w-28">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const checked = selectedSet.has(r.id);
                        const isEditing = editingOfferId === r.id;
                        const isImported = r.isImported !== false; // Default to true if not specified
                        return (
                          <tr key={r.id} className={`border-b last:border-b-0 ${isImported ? 'hover:bg-muted/20' : 'opacity-50 bg-muted/10'}`}>
                            <td className="py-2 px-2">
                              {isImported ? (
                                <Checkbox checked={checked} onCheckedChange={(v) => toggleOne(r.id, Boolean(v))} />
                              ) : (
                                <Checkbox disabled />
                              )}
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
                                    className="flex-shrink-0"
                                    style={{ 
                                      width: '60px', 
                                      height: '60px',
                                      backgroundColor: '#9ca3af',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: '4px'
                                    }}
                                    aria-label="No image available"
                                  />
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
                                      <div 
                                        className="break-words bg-muted p-2 rounded cursor-pointer hover:bg-muted/80 select-all transition-colors"
                                        onClick={() => {
                                          navigator.clipboard.writeText(r.title);
                                          toast({
                                            title: "Copied!",
                                            description: "Title copied to clipboard",
                                          });
                                        }}
                                        title="Click to copy"
                                      >
                                        {r.title}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="font-mono">ID</span>
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent 
                                      className="w-auto p-3 text-sm" 
                                      side="top"
                                      align="start"
                                    >
                                      <div className="space-y-2">
                                        <div className="text-xs text-muted-foreground">Item ID</div>
                                        <div 
                                          className="font-mono text-xs bg-muted p-2 rounded cursor-pointer hover:bg-muted/80 select-all"
                                          onClick={() => {
                                            navigator.clipboard.writeText(r.id);
                                            toast({
                                              title: "Copied!",
                                              description: "Item ID copied to clipboard",
                                            });
                                          }}
                                          title="Click to copy"
                                        >
                                          {r.id}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              {(r.likes > 0 || (marketplace === 'ebay' && r.hitCount > 0)) ? (
                                <div className="flex items-center justify-center gap-2">
                                  {r.likes > 0 && (
                                    <div className="flex items-center gap-1 text-pink-600">
                                      <Heart className="h-3 w-3 fill-current" />
                                      <span className="text-xs">{r.likes}</span>
                                    </div>
                                  )}
                                  {marketplace === 'ebay' && r.hitCount > 0 && (
                                    <div className="flex items-center gap-1 text-purple-600">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                      </svg>
                                      <span className="text-xs">{r.hitCount}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">0</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {!isImported ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : r.offersSent > 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  {r.offersSent}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">0</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              ${r.mktplacePrice.toFixed(2)}
                            </td>
                            <td className={`py-2 px-2 text-right tabular-nums ${checked ? 'text-emerald-600 font-semibold' : 'text-emerald-600'}`}>
                              ${r.discount.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {isImported ? (
                                isEditing ? (
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
                                    className={`tabular-nums text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 ${checked ? 'font-semibold' : ''}`}
                                  >
                                    ${r.offerPrice.toFixed(2)}
                                    <Edit className="h-3 w-3" />
                                  </button>
                                )
                              ) : (
                                <span className={`tabular-nums text-muted-foreground ${checked ? 'font-semibold' : ''}`}>
                                  ${r.offerPrice.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums text-muted-foreground text-xs">
                              {isImported ? `$${r.cog.toFixed(2)}` : '-'}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums font-semibold text-emerald-600">
                              {isImported ? `$${r.earnings.toFixed(2)}` : '-'}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {!isImported ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={importMutation.isPending}
                                  onClick={() => {
                                    importMutation.mutate({ 
                                      itemId: r.id, 
                                      ebayItemId: r.ebayItemId || r.listingId 
                                    });
                                  }}
                                >
                                  {importMutation.isPending ? 'Importing...' : 'Import'}
                                </Button>
                              ) : (
                                r.inventoryId ? (
                                  <button
                                    onClick={() => navigate(`/Inventory?highlight=${r.inventoryId}`)}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                  >
                                    ✓ In Inventory
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">✓ In Inventory</span>
                                )
                              )}
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
      
      {/* Duplicate Detection Dialog */}
      <DuplicateDetectionDialog
        isOpen={duplicateDialogOpen}
        onClose={() => setDuplicateDialogOpen(false)}
        duplicates={detectedDuplicates}
        onViewInventory={(inventoryId) => {
          navigate(`/Inventory?highlight=${inventoryId}`);
        }}
      />
    </div>
  );
}
