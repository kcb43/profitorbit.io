import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, RefreshCw, Download, ChevronLeft, ChevronRight, AlertCircle, Settings, Trash2 } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
import { inventoryApi } from "@/api/inventoryApi";
import { format } from "date-fns";
import { getCurrentUserId } from "@/api/supabaseClient";
import SelectionBanner from "@/components/SelectionBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EBAY_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg";
const ETSY_ICON_URL = "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B";
const MERCARI_ICON_URL = "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B";
const FACEBOOK_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";

const SOURCES = [
  { id: "ebay", label: "eBay", icon: EBAY_ICON_URL, available: true },
  { id: "facebook", label: "Facebook", icon: FACEBOOK_ICON_URL, available: true },
  { id: "mercari", label: "Mercari", icon: MERCARI_ICON_URL, available: true },
  { id: "etsy", label: "Etsy", icon: ETSY_ICON_URL, available: false },
];

// Helper function to proxy Mercari images through our API to avoid CORS issues
const getImageUrl = (imageUrl, source) => {
  if (!imageUrl) return '';
  
  // Mercari images need to be proxied due to CORS restrictions
  if (source === 'mercari' && imageUrl.includes('mercdn.net')) {
    return `/api/proxy/image?url=${encodeURIComponent(imageUrl)}`;
  }
  
  return imageUrl;
};

export default function Import() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State - remember last selected source in localStorage
  const [selectedSource, setSelectedSource] = useState(() => {
    // Priority: URL param > localStorage > default "ebay"
    const urlSource = searchParams.get("source");
    const savedSource = localStorage.getItem('import_last_source');
    return urlSource || savedSource || "ebay";
  });
  
  // Save selected source to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('import_last_source', selectedSource);
    // Also update URL to match
    setSearchParams({ source: selectedSource }, { replace: true });
  }, [selectedSource, setSearchParams]);
  
  const [listingStatus, setListingStatus] = useState("Active");
  const [importingStatus, setImportingStatus] = useState("not_imported");

  // Update listing status default when source changes
  useEffect(() => {
    if (selectedSource === "facebook") {
      setListingStatus("available");
    } else if (selectedSource === "ebay") {
      setListingStatus("Active");
    } else if (selectedSource === "mercari") {
      setListingStatus("on_sale");
    }
  }, [selectedSource]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [visibleItemIds, setVisibleItemIds] = useState([]); // Track which item IDs are currently visible
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("newest");
  const [lastSync, setLastSync] = useState(null);
  const [canSync, setCanSync] = useState(true);
  const [nextSyncTime, setNextSyncTime] = useState(null);
  const [facebookListingsVersion, setFacebookListingsVersion] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [itemsToClear, setItemsToClear] = useState([]);

  // Toggle item ID visibility
  const toggleItemIdVisibility = (itemId) => {
    setVisibleItemIds(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Save the location state on mount so we don't lose it
  const [savedLocationState] = useState(() => location.state);

  // Debug: Log location state on mount
  useEffect(() => {
    console.log('🔍 Import Page Mounted - location.state:', location.state);
    console.log('🔍 Saved location state:', savedLocationState);
    console.log('🔍 location.pathname:', location.pathname);
    console.log('🔍 location.search:', location.search);
  }, []);

  // Check last sync time from localStorage
  useEffect(() => {
    const checkLastSync = () => {
      const lastSyncStr = localStorage.getItem('ebay_last_sync');
      if (lastSyncStr) {
        const lastSyncDate = new Date(lastSyncStr);
        const now = new Date();
        const diffMinutes = (now - lastSyncDate) / 1000 / 60;
        
        if (diffMinutes < 5) { // 5 minute cooldown (eBay recommends this)
          setCanSync(false);
          const nextSync = new Date(lastSyncDate.getTime() + 5 * 60 * 1000);
          setNextSyncTime(nextSync);
          setLastSync(lastSyncDate);
          
          // Set timeout to enable sync button
          const timeUntilSync = nextSync - now;
          setTimeout(() => {
            setCanSync(true);
            setNextSyncTime(null);
          }, timeUntilSync);
        } else {
          setLastSync(lastSyncDate);
        }
      }
    };
    
    checkLastSync();
  }, []);

  // Check connection status
  const [ebayToken, setEbayToken] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState(null);

  // Get user ID on mount
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const id = await getCurrentUserId();
        console.log('🆔 User ID loaded:', id);
        setUserId(id);
      } catch (e) {
        console.error('❌ Error getting user ID:', e);
      }
    };
    loadUserId();
  }, []);

  // REMOVED: Progress messages during Facebook fetch (silent operation)

  // Check if user is connected to the selected marketplace
  useEffect(() => {
    const checkConnection = () => {
      if (selectedSource === "ebay") {
        try {
          const stored = localStorage.getItem('ebay_user_token');
          if (stored) {
            const parsed = JSON.parse(stored);
            setEbayToken(parsed);
            setIsConnected(true);
            console.log('✅ eBay connected, token found');
          } else {
            setEbayToken(null);
            setIsConnected(false);
            console.log('❌ eBay not connected, no token in localStorage');
          }
        } catch (e) {
          console.error('Error parsing eBay token:', e);
          setEbayToken(null);
          setIsConnected(false);
        }
      } else if (selectedSource === "facebook") {
        // Check Facebook connection
        const isConnected = localStorage.getItem('profit_orbit_facebook_connected') === 'true';
        const fbUser = localStorage.getItem('profit_orbit_facebook_user');
        
        if (isConnected && fbUser) {
          setIsConnected(true);
          console.log('✅ Facebook connected');
        } else {
          setIsConnected(false);
          console.log('❌ Facebook not connected');
        }
      } else if (selectedSource === "mercari") {
        // Check Mercari connection
        const mercariUser = localStorage.getItem('profit_orbit_mercari_user');
        const isConnected = mercariUser && JSON.parse(mercariUser)?.loggedIn === true;
        
        if (isConnected) {
          setIsConnected(true);
          console.log('✅ Mercari connected');
        } else {
          setIsConnected(false);
          console.log('❌ Mercari not connected');
        }
      } else {
        // For other marketplaces not yet implemented
        setIsConnected(false);
      }
    };

    checkConnection();
  }, [selectedSource]);

  // Update URL when source changes
  useEffect(() => {
    setSearchParams({ source: selectedSource });
  }, [selectedSource, setSearchParams]);

  // Fetch eBay listings
  const { data: ebayListings, isLoading, refetch, error } = useQuery({
    queryKey: ["ebay-listings", listingStatus, userId],
    queryFn: async () => {
      console.log('📡 Fetching eBay listings...', { userId, hasToken: !!ebayToken?.access_token });
      
      if (!userId) {
        throw new Error('User ID not available');
      }
      
      const response = await fetch(`/api/ebay/my-listings?status=${listingStatus}`, {
        headers: {
          'x-user-id': userId,  // lowercase to match API
          'x-user-token': ebayToken?.access_token || '',
        },
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📊 Request params:', { listingStatus, userId: userId.substring(0, 8) + '...' });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Error fetching listings:', errorData);
        
        // Check for expired token error
        if (errorData.errorCode === 'TOKEN_EXPIRED') {
          throw new Error('TOKEN_EXPIRED');
        }
        
        // Show the full error object to user
        const errorMsg = errorData.error || errorData.message || 'Failed to fetch eBay listings';
        throw new Error(`${errorMsg}${errorData.details ? '\n\nDetails: ' + errorData.details : ''}`);
      }
      const data = await response.json();
      console.log('✅ Fetched listings:', data.listings?.length || 0, 'items');
      
      // Log status breakdown
      const statusCounts = data.listings?.reduce((acc, item) => {
        acc[item.status || 'unknown'] = (acc[item.status || 'unknown'] || 0) + 1;
        return acc;
      }, {});
      console.log('📊 Status breakdown:', statusCounts);
      
      // Log first few items for debugging
      if (data.listings?.length > 0) {
        console.log('📦 Sample items:', data.listings.slice(0, 3).map(item => ({
          id: item.itemId,
          title: item.title?.substring(0, 30) + '...',
          status: item.status,
          price: item.price
        })));
      }
      
      setLastSync(new Date());
      return data.listings || [];
    },
    enabled: selectedSource === "ebay" && isConnected && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check Facebook connection
  useEffect(() => {
    if (selectedSource === "facebook") {
      // Check if Facebook is connected via extension
      try {
        const isConnected = localStorage.getItem('profit_orbit_facebook_connected') === 'true';
        const fbUser = localStorage.getItem('profit_orbit_facebook_user');
        
        console.log('🔍 Facebook connection check:', { isConnected, fbUser });
        
        if (isConnected && fbUser) {
          setIsConnected(true);
          console.log('✅ Facebook connected');
          
          // Load cached Facebook listings from localStorage
          const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
          if (cachedListings) {
            try {
              const parsedListings = JSON.parse(cachedListings);
              console.log('📦 Loaded cached Facebook listings:', parsedListings.length, 'items');
              queryClient.setQueryData(['facebook-listings', userId], parsedListings);
              setFacebookListingsVersion(v => v + 1);
            } catch (e) {
              console.error('Error parsing cached listings:', e);
            }
          }
        } else {
          setIsConnected(false);
          console.log('❌ Facebook not connected');
        }
      } catch (e) {
        console.error('Error checking Facebook connection:', e);
        setIsConnected(false);
      }
    } else if (selectedSource === "mercari") {
      // Check if Mercari is connected via extension
      try {
        const isConnected = localStorage.getItem('profit_orbit_mercari_connected') === 'true';
        const mercariUser = localStorage.getItem('profit_orbit_mercari_user');
        
        console.log('🔍 Mercari connection check:', { isConnected, mercariUser });
        
        if (isConnected && mercariUser) {
          setIsConnected(true);
          console.log('✅ Mercari connected');
          
          // Load cached Mercari listings from localStorage
          const cachedListings = localStorage.getItem('profit_orbit_mercari_listings');
          if (cachedListings) {
            try {
              const parsedListings = JSON.parse(cachedListings);
              console.log('📦 Loaded cached Mercari listings:', parsedListings.length, 'items');
              queryClient.setQueryData(['mercari-listings', userId], parsedListings);
              setFacebookListingsVersion(v => v + 1); // Reuse this to trigger re-render
            } catch (e) {
              console.error('Error parsing cached Mercari listings:', e);
            }
          }
        } else {
          setIsConnected(false);
          console.log('❌ Mercari not connected');
        }
      } catch (e) {
        console.error('Error checking Mercari connection:', e);
        setIsConnected(false);
      }
    }
  }, [selectedSource, userId, queryClient]);

  // Reload cache when user returns to the page (e.g., after deleting items from inventory)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && userId) {
        console.log('👀 Page became visible, reloading import cache...');
        
        if (selectedSource === "facebook") {
          const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
          if (cachedListings) {
            try {
              const parsedListings = JSON.parse(cachedListings);
              console.log('🔄 Reloaded Facebook cache:', parsedListings.length, 'items');
              queryClient.setQueryData(['facebook-listings', userId], parsedListings);
              setFacebookListingsVersion(v => v + 1);
            } catch (e) {
              console.error('Error reloading Facebook cache:', e);
            }
          }
        } else if (selectedSource === "mercari") {
          const cachedListings = localStorage.getItem('profit_orbit_mercari_listings');
          if (cachedListings) {
            try {
              const parsedListings = JSON.parse(cachedListings);
              console.log('🔄 Reloaded Mercari cache:', parsedListings.length, 'items');
              queryClient.setQueryData(['mercari-listings', userId], parsedListings);
              setFacebookListingsVersion(v => v + 1);
            } catch (e) {
              console.error('Error reloading Mercari cache:', e);
            }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also reload when window gains focus (for better UX)
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [selectedSource, userId, queryClient]);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (itemIds) => {
      console.log('📥 Importing items:', itemIds);
      
      let endpoint, headers, body;
      
      if (selectedSource === 'facebook') {
        // For Facebook, we need to get the full item data from cache
        const facebookListings = queryClient.getQueryData(['facebook-listings', userId]) || [];
        const itemsToImport = facebookListings.filter(item => itemIds.includes(item.itemId));
        
        console.log(`🔍 Scraping detailed info for ${itemsToImport.length} selected items...`);
        console.log(`📍 DEBUG: userId for scraping:`, userId);
        
        // Scrape detailed information for selected items
        // This is when Vendoo does their "scrapping"
        if (window.ProfitOrbitExtension && window.ProfitOrbitExtension.scrapeMultipleFacebookListings) {
          try {
            console.log(`🔥 Calling scrapeMultipleFacebookListings with userId:`, userId);
            const result = await window.ProfitOrbitExtension.scrapeMultipleFacebookListings(itemsToImport, userId);
            
            if (result && result.success && result.listings) {
              endpoint = "/api/facebook/import-items";
              headers = {
                "Content-Type": "application/json",
                'x-user-id': userId,
              };
              body = JSON.stringify({ items: result.listings });
            } else {
              throw new Error('Scraping failed or returned no data');
            }
          } catch (error) {
            console.error('❌ Error scraping Facebook listings:', error);
            // Fall back to basic data if scraping fails
            endpoint = "/api/facebook/import-items";
            headers = {
              "Content-Type": "application/json",
              'x-user-id': userId,
            };
            body = JSON.stringify({ items: itemsToImport });
          }
        } else {
          // No extension or scraping function, use basic data
          endpoint = "/api/facebook/import-items";
          headers = {
            "Content-Type": "application/json",
            'x-user-id': userId,
          };
          body = JSON.stringify({ items: itemsToImport });
        }
        
      } else if (selectedSource === 'mercari') {
        // For Mercari, we need to get the full item data from cache
        const mercariListings = queryClient.getQueryData(['mercari-listings', userId]) || [];
        const itemsToImport = mercariListings.filter(item => itemIds.includes(item.itemId));
        
        endpoint = "/api/mercari/import-items";
        headers = {
          "Content-Type": "application/json",
          'x-user-id': userId,
        };
        body = JSON.stringify({ items: itemsToImport });
        
      } else if (selectedSource === 'ebay') {
        // For eBay, get full item data from cache (especially important for sold items)
        const ebayListings = queryClient.getQueryData(['ebay-listings', userId, listingStatus]) || [];
        const itemsToImport = ebayListings.filter(item => itemIds.includes(item.itemId));
        
        endpoint = "/api/ebay/import-items";
        headers = {
          "Content-Type": "application/json",
          'x-user-id': userId,
          'x-user-token': ebayToken?.access_token || '',
        };
        body = JSON.stringify({ 
          itemIds,
          itemsData: itemsToImport // Pass full item data (includes transaction details for sold items)
        });
        
      } else {
        throw new Error(`Import not yet supported for ${selectedSource}`);
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Import error:', errorData);
        throw new Error(errorData.error || 'Failed to import items');
      }
      const result = await response.json();
      console.log('✅ Import result:', result);
      
      // Log detailed errors if any
      if (result.errors && result.errors.length > 0) {
        console.error('❌ Import errors:', result.errors);
        // Log each error individually for clarity
        result.errors.forEach((err, index) => {
          console.error(`  Error ${index + 1}:`, {
            itemId: err.itemId,
            error: err.error
          });
        });
      }
      
      return result;
    },
    onSuccess: (data) => {
      // Build message based on results
      let message = '';
      const parts = [];
      
      if (data.imported > 0) {
        parts.push(`Imported ${data.imported} item(s)`);
      }
      if (data.duplicates > 0) {
        parts.push(`${data.duplicates} linked to existing inventory`);
      }
      if (data.failed > 0) {
        parts.push(`${data.failed} failed`);
      }
      
      message = parts.join(', ');
      if (data.failed > 0) {
        message += '. Check console for details.';
      }
        
      toast({
        title: data.failed > 0 ? "Import completed with errors" : 
               data.duplicates > 0 ? "Import completed (duplicates detected)" : 
               "Import successful",
        description: message,
        variant: data.failed > 0 ? "destructive" : "default",
      });
      
      // Mark imported items as imported and store inventory IDs
      if (selectedSource === 'facebook') {
        const facebookListings = queryClient.getQueryData(['facebook-listings', userId]) || [];
        const updatedListings = facebookListings.map(item => {
          // Check if this item was successfully imported
          const importedItem = data.importedItems?.find(i => i.itemId === item.itemId);
          
          if (importedItem) {
            return { ...item, imported: true, inventoryId: importedItem.inventoryId };
          }
          return item;
        });
        
        // Update cache and persist to localStorage
        queryClient.setQueryData(['facebook-listings', userId], updatedListings);
        localStorage.setItem('profit_orbit_facebook_listings', JSON.stringify(updatedListings));
        console.log('✅ Marked', data.importedItems?.length || 0, 'items as imported with inventory IDs');
        
        // Trigger re-render
        setFacebookListingsVersion(v => v + 1);
      } else if (selectedSource === 'mercari') {
        const mercariListings = queryClient.getQueryData(['mercari-listings', userId]) || [];
        const updatedListings = mercariListings.map(item => {
          // Check if this item was successfully imported
          const importedItem = data.importedItems?.find(i => i.itemId === item.itemId);
          
          if (importedItem) {
            return { ...item, imported: true, inventoryId: importedItem.inventoryId };
          }
          return item;
        });
        
        // Update cache and persist to localStorage
        queryClient.setQueryData(['mercari-listings', userId], updatedListings);
        localStorage.setItem('profit_orbit_mercari_listings', JSON.stringify(updatedListings));
        console.log('✅ Marked', data.importedItems?.length || 0, 'Mercari items as imported with inventory IDs');
        
        // Trigger re-render
        setFacebookListingsVersion(v => v + 1);
      } else if (selectedSource === 'ebay') {
        // Update eBay listings cache with imported status, inventory IDs, and sale IDs
        const ebayListings = queryClient.getQueryData(['ebay-listings', userId, listingStatus]) || [];
        const updatedListings = ebayListings.map(item => {
          // Check if this item was successfully imported
          const importedItem = data.importedItems?.find(i => i.itemId === item.itemId);
          
          if (importedItem) {
            return { 
              ...item, 
              imported: true, 
              inventoryId: importedItem.inventoryId,
              saleId: importedItem.saleId // Will be present for sold items
            };
          }
          return item;
        });
        
        // Update cache
        queryClient.setQueryData(['ebay-listings', userId, listingStatus], updatedListings);
        console.log('✅ Marked', data.importedItems?.length || 0, 'eBay items as imported with inventory IDs and sale IDs');
      }
      
      // Always refresh inventory
      queryClient.invalidateQueries(["inventory-items"]);
      setSelectedItems([]);
    },
    onError: (error) => {
      console.error('❌ Import mutation error:', error);
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation for imported items
  const deleteMutation = useMutation({
    mutationFn: async (itemId) => {
      // Find the item in the cached listings to get its inventory ID
      const sourceListings = selectedSource === "facebook" 
        ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
        : selectedSource === "mercari"
        ? (queryClient.getQueryData(['mercari-listings', userId]) || [])
        : (ebayListings || []);
      
      const item = sourceListings.find(i => i.itemId === itemId);
      
      if (!item?.inventoryId) {
        // If item has no inventory ID, just mark it as not imported locally
        console.warn(`⚠️ Item ${itemId} has no inventory ID, marking as not imported locally`);
        return { id: null, success: true }; // Return success to allow cache update
      }
      
      // Soft delete from inventory (permanent delete)
      return await inventoryApi.delete(item.inventoryId, true);
    },
    onSuccess: (data, itemId) => {
      toast({
        title: "Item deleted",
        description: "Item has been removed from your inventory",
      });
      
      // Update the listing to mark as not imported and remove inventory ID
      if (selectedSource === 'facebook') {
        const facebookListings = queryClient.getQueryData(['facebook-listings', userId]) || [];
        const updatedListings = facebookListings.map(item => {
          if (item.itemId === itemId) {
            return { ...item, imported: false, inventoryId: null };
          }
          return item;
        });
        
        queryClient.setQueryData(['facebook-listings', userId], updatedListings);
        localStorage.setItem('profit_orbit_facebook_listings', JSON.stringify(updatedListings));
        setFacebookListingsVersion(v => v + 1);
      } else if (selectedSource === 'mercari') {
        const mercariListings = queryClient.getQueryData(['mercari-listings', userId]) || [];
        const updatedListings = mercariListings.map(item => {
          if (item.itemId === itemId) {
            return { ...item, imported: false, inventoryId: null };
          }
          return item;
        });
        
        queryClient.setQueryData(['mercari-listings', userId], updatedListings);
        localStorage.setItem('profit_orbit_mercari_listings', JSON.stringify(updatedListings));
        setFacebookListingsVersion(v => v + 1);
      } else if (selectedSource === 'ebay') {
        queryClient.invalidateQueries(["ebay-listings"]);
        if (refetch) {
          refetch();
        }
      }
      
      // Refresh inventory
      queryClient.invalidateQueries(["inventory-items"]);
    },
    onError: (error) => {
      console.error('❌ Delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (itemId) => {
    setItemToDelete(itemId);
    setDeleteDialogOpen(true);
  };

  const handleClear = (itemIds) => {
    setItemsToClear(itemIds);
    setClearDialogOpen(true);
  };

  const confirmClear = () => {
    // Remove the items from the cache
    const sourceListings = selectedSource === "facebook" 
      ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
      : selectedSource === "mercari"
      ? (queryClient.getQueryData(['mercari-listings', userId]) || [])
      : (ebayListings || []);
    
    // Filter out the cleared items
    const updatedListings = sourceListings.filter(item => !itemsToClear.includes(item.itemId));
    
    // Update the cache
    if (selectedSource === "facebook") {
      queryClient.setQueryData(['facebook-listings', userId], updatedListings);
    } else if (selectedSource === "mercari") {
      queryClient.setQueryData(['mercari-listings', userId], updatedListings);
    }
    
    // Clear selection
    setSelectedItems([]);
    setClearDialogOpen(false);
    setItemsToClear([]);
    
    toast.success(`Cleared ${itemsToClear.length} item(s) from list`);
  };

  // Generate marketplace listing URL
  const getMarketplaceUrl = (item, source) => {
    if (!item) return null;
    
    switch (source) {
      case 'ebay':
        // Use viewItemURL if available (for sold items with transaction-specific URLs)
        // Otherwise construct URL from originalItemId or itemId
        if (item.viewItemURL) {
          return item.viewItemURL;
        }
        const ebayItemId = item.originalItemId || item.itemId;
        return `https://www.ebay.com/itm/${ebayItemId}`;
      case 'mercari':
        return `https://www.mercari.com/us/item/${item.itemId}/`;
      case 'facebook':
        return item.listingUrl || `https://www.facebook.com/marketplace/item/${item.itemId}/`;
      default:
        return null;
    }
  };

  // Filter and sort listings
  const filteredListings = React.useMemo(() => {
    // Use appropriate listings based on selected source
    const sourceListings = selectedSource === "facebook" 
      ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
      : selectedSource === "mercari"
      ? (queryClient.getQueryData(['mercari-listings', userId]) || [])
      : (ebayListings || []);
    
    if (!sourceListings || sourceListings.length === 0) return [];
    
    let filtered = sourceListings.filter((item) => {
      if (importingStatus === "not_imported") {
        return !item.imported;
      } else if (importingStatus === "imported") {
        return item.imported;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.startTime || b.listingDate) - new Date(a.startTime || a.listingDate);
      } else if (sortBy === "oldest") {
        return new Date(a.startTime || a.listingDate) - new Date(b.startTime || b.listingDate);
      } else if (sortBy === "price_high") {
        return (b.price || 0) - (a.price || 0);
      } else if (sortBy === "price_low") {
        return (a.price || 0) - (b.price || 0);
      }
      return 0;
    });

    return filtered;
  }, [ebayListings, importingStatus, sortBy, selectedSource, userId, queryClient, facebookListingsVersion]);

  // Calculate counts from ALL listings (not filtered)
  const { notImportedCount, importedCount } = React.useMemo(() => {
    const sourceListings = selectedSource === "facebook" 
      ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
      : selectedSource === "mercari"
      ? (queryClient.getQueryData(['mercari-listings', userId]) || [])
      : (ebayListings || []);
    
    return {
      notImportedCount: sourceListings?.filter((item) => !item.imported).length || 0,
      importedCount: sourceListings?.filter((item) => item.imported).length || 0,
    };
  }, [ebayListings, selectedSource, userId, queryClient, facebookListingsVersion]);

  // Pagination
  const totalPages = Math.ceil(filteredListings.length / itemsPerPage);
  const paginatedListings = filteredListings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleRefresh = () => {
    if (!canSync) {
      toast({
        title: "Please wait",
        description: `You can sync again at ${format(nextSyncTime, "h:mm:ss a")}`,
        variant: "destructive",
      });
      return;
    }
    
    // Handle Facebook differently - use extension scraping
    if (selectedSource === 'facebook') {
      handleFacebookSync();
      return;
    }
    
    // Handle Mercari differently - use extension scraping
    if (selectedSource === 'mercari') {
      handleMercariSync();
      return;
    }
    
    localStorage.setItem('ebay_last_sync', new Date().toISOString());
    setLastSync(new Date());
    setCanSync(false);
    setNextSyncTime(new Date(Date.now() + 5 * 60 * 1000));
    
    // Re-enable after 5 minutes
    setTimeout(() => {
      setCanSync(true);
      setNextSyncTime(null);
    }, 5 * 60 * 1000);
    
    refetch();
    toast({
      title: "Refreshing...",
      description: "Fetching latest items from eBay",
    });
  };

  // Handle Facebook sync via extension
  const handleFacebookSync = async () => {
    try {
      console.log('📡 Requesting Facebook scrape from extension...');
      
      // Check if extension API is available
      if (!window.ProfitOrbitExtension || typeof window.ProfitOrbitExtension.scrapeFacebookListings !== 'function') {
        throw new Error('Extension API not available. Please make sure the Profit Orbit extension is installed and enabled.');
      }
      
      toast({
        title: "Syncing Facebook Marketplace",
        description: "Checking for Facebook tab...",
      });
      
      // Use the extension API
      const result = await window.ProfitOrbitExtension.scrapeFacebookListings();
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to scrape Facebook listings');
      }
      
      // The result should contain the listings
      const listings = result?.listings || [];
      console.log('✅ Received Facebook listings:', listings.length);
      console.log('📦 Sample listing:', listings[0]);
      
      // Load existing imported status from localStorage
      const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
      let existingImportedIds = new Set();
      
      if (cachedListings) {
        try {
          const parsedListings = JSON.parse(cachedListings);
          existingImportedIds = new Set(
            parsedListings
              .filter(item => item.imported)
              .map(item => item.itemId)
          );
          console.log('📦 Found', existingImportedIds.size, 'previously imported items');
        } catch (e) {
          console.error('Error parsing cached listings:', e);
        }
      }
      
      // Merge with existing imported status
      const mergedListings = listings.map(item => ({
        ...item,
        imported: existingImportedIds.has(item.itemId) || false
      }));
      
      // Update the query data and persist to localStorage
      queryClient.setQueryData(['facebook-listings', userId], mergedListings);
      localStorage.setItem('profit_orbit_facebook_listings', JSON.stringify(mergedListings));
      console.log('✅ Updated query cache and localStorage with', mergedListings.length, 'listings');
      
      // Force a re-render
      setFacebookListingsVersion(v => v + 1);
      
      toast({
        title: "Success",
        description: `Found ${listings.length} Facebook listings`,
      });
      
      setLastSync(new Date());
      
    } catch (error) {
      console.error('❌ Facebook sync error:', error);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync Facebook listings",
        variant: "destructive",
        duration: 6000,
      });
    }
  };

  // Handle Mercari sync via extension
  const handleMercariSync = async () => {
    try {
      console.log('📡 Requesting Mercari scrape from extension...');
      
      // Check if extension API is available
      if (!window.ProfitOrbitExtension || typeof window.ProfitOrbitExtension.scrapeMercariListings !== 'function') {
        throw new Error('Extension API not available. Please make sure the Profit Orbit extension is installed and enabled.');
      }
      
      toast({
        title: "Syncing Mercari",
        description: "Fetching your listings...",
      });
      
      // Use the extension API
      const result = await window.ProfitOrbitExtension.scrapeMercariListings();
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch Mercari listings');
      }
      
      // The result should contain the listings
      const listings = result?.listings || [];
      console.log('✅ Received Mercari listings:', listings.length);
      console.log('📦 Sample listing:', listings[0]);
      
      // Load existing imported status from localStorage
      const cachedListings = localStorage.getItem('profit_orbit_mercari_listings');
      let existingImportedIds = new Set();
      
      if (cachedListings) {
        try {
          const parsedListings = JSON.parse(cachedListings);
          existingImportedIds = new Set(
            parsedListings
              .filter(item => item.imported)
              .map(item => item.itemId)
          );
          console.log('📦 Found', existingImportedIds.size, 'previously imported items');
        } catch (e) {
          console.error('Error parsing cached listings:', e);
        }
      }
      
      // Merge with existing imported status
      const mergedListings = listings.map(item => ({
        ...item,
        imported: existingImportedIds.has(item.itemId) || false
      }));
      
      // Update the query data and persist to localStorage
      queryClient.setQueryData(['mercari-listings', userId], mergedListings);
      localStorage.setItem('profit_orbit_mercari_listings', JSON.stringify(mergedListings));
      console.log('✅ Updated query cache and localStorage with', mergedListings.length, 'listings');
      
      // Force a re-render
      setFacebookListingsVersion(v => v + 1); // Reuse this to trigger re-render
      
      toast({
        title: "Success",
        description: `Found ${listings.length} Mercari listings`,
      });
      
      setLastSync(new Date());
      
    } catch (error) {
      console.error('❌ Mercari sync error:', error);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync Mercari listings",
        variant: "destructive",
        duration: 6000,
      });
    }
  };

  // Listen for Facebook listings from extension
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.action === 'FACEBOOK_LISTINGS_READY') {
        console.log('✅ Facebook listings ready:', event.data);
        
        // Fetch from extension storage
        if (window.chrome?.storage) {
          chrome.storage.local.get(['facebook_listings'], (result) => {
            const listings = result.facebook_listings || [];
            console.log('📦 Retrieved Facebook listings:', listings.length);
            
            // Update the query data
            queryClient.setQueryData(['facebook-listings', userId], listings);
            
            toast({
              title: "Success",
              description: `Found ${listings.length} Facebook listings`,
            });
          });
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [userId, queryClient, toast]);

  const handleImport = () => {
    if (selectedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to import",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate(selectedItems);
  };

  const toggleSelectItem = (itemId, item) => {
    // Allow selecting both imported and non-imported items for bulk operations
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleSelectAll = () => {
    // Allow selecting all items (both imported and non-imported)
    const selectableItems = paginatedListings;
    
    if (selectedItems.length === selectableItems.length && selectableItems.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems(selectableItems.map((item) => item.itemId));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Selection Banner - shows when scrolled down with items selected */}
      <SelectionBanner
        selectedCount={selectedItems.length}
        onClear={() => setSelectedItems([])}
        showAtTop={false}
        threshold={200}
      >
        <Button
          onClick={handleImport}
          disabled={importMutation.isPending || selectedItems.length === 0}
          size="sm"
          className="bg-white text-emerald-600 hover:bg-white/90 h-8 gap-2"
        >
          <Download className="h-4 w-4" />
          {importMutation.isPending ? 'Importing...' : 'Import'}
        </Button>
      </SelectionBanner>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => {
                  console.log('🔍 Import Back Button - location.state:', location.state);
                  console.log('🔍 Import Back Button - savedLocationState:', savedLocationState);
                  console.log('🔍 savedLocationState?.from?.pathname:', savedLocationState?.from?.pathname);
                  
                  // Use saved state (captured on mount) instead of location.state
                  if (savedLocationState?.from?.pathname) {
                    const backPath = savedLocationState.from.pathname + (savedLocationState.from.search || '');
                    console.log('✅ Navigating back to:', backPath);
                    // Navigate back to the page we came from with preserved state
                    navigate(backPath, {
                      state: savedLocationState.from
                    });
                  } else {
                    console.log('⚠️ No saved location state, defaulting to Crosslist');
                    // Default to Crosslist if no referrer
                    navigate(createPageUrl("Crosslist"));
                  }
                }}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <h1 className="text-2xl font-bold">Import</h1>
            </div>
            {lastSync && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Last sync: {format(lastSync, "h:mm a")}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading || !canSync}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  {!canSync && nextSyncTime 
                    ? `Sync in ${Math.ceil((nextSyncTime - new Date()) / 1000 / 60)}m`
                    : `Get Latest ${selectedSource === "facebook" ? "Facebook" : selectedSource === "ebay" ? "eBay" : selectedSource.charAt(0).toUpperCase() + selectedSource.slice(1)} Items`
                  }
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-[280px_1fr] gap-6">
          {/* Left Sidebar - Source Selection */}
          <div className="space-y-6">
            {/* Source Selector */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Select the source to import from</h3>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((source) => (
                    <SelectItem key={source.id} value={source.id} disabled={!source.available}>
                      <div className="flex items-center gap-2">
                        <img src={source.icon} alt={source.label} className="w-4 h-4" />
                        <span>{source.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Source Icons Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {SOURCES.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => source.available && setSelectedSource(source.id)}
                    disabled={!source.available}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedSource === source.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    } ${!source.available ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <img src={source.icon} alt={source.label} className="w-8 h-8" />
                      <span className="text-xs font-medium">{source.label}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Coming Soon Dropdown */}
              <div className="mt-3">
                <Select disabled>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="More marketplaces coming soon..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="depop" disabled>Depop (Coming Soon)</SelectItem>
                    <SelectItem value="poshmark" disabled>Poshmark (Coming Soon)</SelectItem>
                    <SelectItem value="shopify" disabled>Shopify (Coming Soon)</SelectItem>
                    <SelectItem value="grailed" disabled>Grailed (Coming Soon)</SelectItem>
                    <SelectItem value="kidizen" disabled>Kidizen (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Filters */}
            {selectedSource === "ebay" && (
              <Card className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">eBay Listing Status</label>
                  <Select value={listingStatus} onValueChange={setListingStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Sold">Sold</SelectItem>
                      <SelectItem value="All">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Importing Status</label>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant={importingStatus === "not_imported" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImportingStatus("not_imported")}
                      className={`w-full justify-start ${importingStatus === "not_imported" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                    >
                      <Badge variant="secondary" className="mr-2">
                        {notImportedCount}
                      </Badge>
                      Not Imported
                    </Button>
                    <Button
                      variant={importingStatus === "imported" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImportingStatus("imported")}
                      className={`w-full justify-start ${importingStatus === "imported" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                    >
                      <Badge variant="secondary" className="mr-2">
                        {importedCount}
                      </Badge>
                      Imported
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {selectedSource === "facebook" && (
              <Card className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Facebook Listing Status</label>
                  <Select value={listingStatus} onValueChange={setListingStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Importing Status</label>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant={importingStatus === "not_imported" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImportingStatus("not_imported")}
                      className={`w-full justify-start ${importingStatus === "not_imported" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                    >
                      <Badge variant="secondary" className="mr-2">
                        {notImportedCount}
                      </Badge>
                      Not Imported
                    </Button>
                    <Button
                      variant={importingStatus === "imported" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImportingStatus("imported")}
                      className={`w-full justify-start ${importingStatus === "imported" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                    >
                      <Badge variant="secondary" className="mr-2">
                        {importedCount}
                      </Badge>
                      Imported
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {selectedSource === "mercari" && (
              <Card className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Mercari Listing Status</label>
                  <Select value={listingStatus} onValueChange={setListingStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_sale">On Sale</SelectItem>
                      <SelectItem value="sold_out">Sold Out</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Importing Status</label>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant={importingStatus === "not_imported" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImportingStatus("not_imported")}
                      className={`w-full justify-start ${importingStatus === "not_imported" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                    >
                      <Badge variant="secondary" className="mr-2">
                        {notImportedCount}
                      </Badge>
                      Not Imported
                    </Button>
                    <Button
                      variant={importingStatus === "imported" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImportingStatus("imported")}
                      className={`w-full justify-start ${importingStatus === "imported" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                    >
                      <Badge variant="secondary" className="mr-2">
                        {importedCount}
                      </Badge>
                      Imported
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Content - Listings Grid */}
          <div className="space-y-4">
            {/* Not Connected Alert */}
            {!isConnected && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {selectedSource === "ebay" ? "eBay" : selectedSource.charAt(0).toUpperCase() + selectedSource.slice(1)} not connected
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Please connect your {selectedSource === "ebay" ? "eBay" : selectedSource} account to start importing.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selectedSource === "ebay" && (
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          // Save that we came from Import page
                          sessionStorage.setItem('ebay_oauth_return', '/import?source=ebay');
                          // Redirect to eBay OAuth
                          window.location.href = '/api/ebay/auth';
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <line x1="19" y1="8" x2="19" y2="14"></line>
                          <line x1="22" y1="11" x2="16" y2="11"></line>
                        </svg>
                        Connect eBay
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => navigate(createPageUrl("Settings"))}
                    >
                      <Settings className="h-4 w-4" />
                      Go to Settings
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Show content only if connected */}
            {isConnected && (
              <>
            {/* Debug/Error Info - Only show for the currently selected source */}
            {error && selectedSource === "ebay" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error.message === 'TOKEN_EXPIRED' ? (
                    <>
                      <p className="font-medium">eBay Connection Expired</p>
                      <p className="text-sm mt-1">Your eBay connection has expired. Please reconnect your eBay account to continue syncing items.</p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            sessionStorage.setItem('ebay_oauth_return', '/import?source=ebay');
                            window.location.href = '/api/ebay/auth';
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <line x1="19" y1="8" x2="19" y2="14"></line>
                            <line x1="22" y1="11" x2="16" y2="11"></line>
                          </svg>
                          Reconnect eBay
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(createPageUrl("Settings"))}
                        >
                          <Settings className="h-4 w-4" />
                          Go to Settings
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Error loading listings</p>
                      <p className="text-sm mt-1">{error.message}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => refetch()}
                      >
                        Try Again
                      </Button>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            {/* Toolbar */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedItems.length === paginatedListings.length && paginatedListings.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm font-medium">
                    {selectedItems.length} of {filteredListings.length} selected
                  </span>
                  {selectedItems.length > 0 && (
                    <>
                      {/* Show Import button only if non-imported items are selected */}
                      {selectedItems.some(id => {
                        const item = filteredListings.find(i => i.itemId === id);
                        return item && !item.imported;
                      }) && (
                        <>
                          <Button
                            onClick={handleImport}
                            disabled={importMutation.isPending}
                            className="gap-2"
                          >
                            <Download className="h-4 w-4" />
                            {importMutation.isPending ? 'Importing...' : `Import (${selectedItems.filter(id => {
                              const item = filteredListings.find(i => i.itemId === id);
                              return item && !item.imported;
                            }).length})`}
                          </Button>
                          
                          <Button
                            onClick={() => {
                              const notImportedItems = selectedItems.filter(id => {
                                const item = filteredListings.find(i => i.itemId === id);
                                return item && !item.imported;
                              });
                              handleClear(notImportedItems);
                            }}
                            variant="outline"
                            className="gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18"></path>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            Clear
                          </Button>
                        </>
                      )}
                      
                      {/* Show Crosslist button only if imported items are selected */}
                      {selectedItems.some(id => {
                        const item = filteredListings.find(i => i.itemId === id);
                        return item && item.imported;
                      }) && (
                        <Button
                          variant="default"
                          className="gap-2 bg-blue-600 hover:bg-blue-700"
                          onClick={() => {
                            const importedItems = selectedItems.filter(id => {
                              const item = filteredListings.find(i => i.itemId === id);
                              return item && item.imported;
                            }).map(id => {
                              const item = filteredListings.find(i => i.itemId === id);
                              return item.inventoryId;
                            }).filter(Boolean);
                            
                            if (importedItems.length > 0) {
                              navigate(`/CrosslistComposer?ids=${importedItems.join(',')}`);
                            }
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                          Crosslist ({selectedItems.filter(id => {
                            const item = filteredListings.find(i => i.itemId === id);
                            return item && item.imported;
                          }).length})
                        </Button>
                      )}
                      
                      {/* Show Delete button only if imported items are selected */}
                      {selectedItems.some(id => {
                        const item = filteredListings.find(i => i.itemId === id);
                        return item && item.imported;
                      }) && (
                        <Button
                          variant="destructive"
                          className="gap-2"
                          onClick={() => {
                            const importedIds = selectedItems.filter(id => {
                              const item = filteredListings.find(i => i.itemId === id);
                              return item && item.imported;
                            });
                            // Delete all selected imported items
                            importedIds.forEach(itemId => handleDelete(itemId));
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          {deleteMutation.isPending ? 'Deleting...' : `Delete (${selectedItems.filter(id => {
                            const item = filteredListings.find(i => i.itemId === id);
                            return item && item.imported;
                          }).length})`}
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 Items Per Page</SelectItem>
                      <SelectItem value="50">50 Items Per Page</SelectItem>
                      <SelectItem value="100">100 Items Per Page</SelectItem>
                      <SelectItem value="200">200 Items Per Page</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Date Created (Newest)</SelectItem>
                      <SelectItem value="oldest">Date Created (Oldest)</SelectItem>
                      <SelectItem value="price_high">Price (High to Low)</SelectItem>
                      <SelectItem value="price_low">Price (Low to High)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Listings Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : paginatedListings.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <p className="text-muted-foreground">No items found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try changing the filters or click "Get Latest {selectedSource === "facebook" ? "Facebook" : selectedSource === "ebay" ? "eBay" : selectedSource.charAt(0).toUpperCase() + selectedSource.slice(1)} Items" to refresh
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {paginatedListings.map((item) => (
                  <Card 
                    key={item.itemId} 
                    className={`p-4 transition-all ${
                      selectedItems.includes(item.itemId)
                        ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md cursor-pointer'
                        : item.imported 
                          ? 'bg-gray-100 dark:bg-gray-800 hover:shadow-md cursor-pointer' 
                          : 'hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
                    }`}
                    onClick={() => toggleSelectItem(item.itemId, item)}
                  >
                    <div className="flex gap-4">
                      <Checkbox
                        checked={selectedItems.includes(item.itemId)}
                        onCheckedChange={() => toggleSelectItem(item.itemId, item)}
                        onClick={(e) => e.stopPropagation()} // Prevent double-toggle
                      />
                      <div className="flex-shrink-0">
                        <OptimizedImage
                          src={getImageUrl(item.imageUrl || item.pictureURLs?.[0], selectedSource)}
                          alt={item.title}
                          className="w-24 h-24 object-cover rounded"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{item.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.startTime && (
                            <>
                              {selectedSource === "mercari" 
                                ? "Posted: " 
                                : selectedSource === "facebook" 
                                ? "Posted: " 
                                : selectedSource === "ebay" 
                                  ? (item.status === "Sold" ? "Date sold: " : "Posted: ")
                                  : ""}
                              {format(new Date(item.startTime), "MMM dd, yyyy")} · 
                            </>
                          )}
                          ${item.price}
                          {/* Show buyer badge for eBay sold items with transaction data */}
                          {selectedSource === "ebay" && item.status === "Sold" && item.buyerUsername && (
                            <>
                              {" · "}
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                Buyer: {item.buyerUsername}
                              </span>
                            </>
                          )}
                          {/* Show sale number if this is part of multiple sales */}
                          {selectedSource === "ebay" && item.status === "Sold" && item.saleNumber && item.totalSales > 1 && (
                            <>
                              {" · "}
                              <span className="text-xs text-muted-foreground">
                                Sale {item.saleNumber} of {item.totalSales}
                              </span>
                            </>
                          )}
                           · 
                          {visibleItemIds.includes(item.itemId) ? (
                            <>
                              {/* Show Order ID for eBay sold items, Item ID for others */}
                              {selectedSource === "ebay" && item.status === "Sold" && item.orderId ? (
                                <>
                                  Order:{" "}
                                  <a
                                    href={`https://www.ebay.com/sh/ord/details?orderid=${item.orderId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {item.orderId}
                                  </a>
                                </>
                              ) : (
                                <>
                                  Item ID:{" "}
                                  <a
                                    href={getMarketplaceUrl(item, selectedSource)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {item.originalItemId || item.itemId}
                                  </a>
                                </>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItemIdVisibility(item.itemId);
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                              {selectedSource === "ebay" && item.status === "Sold" && item.orderId ? "View Order ID" : "View Item ID"}
                            </button>
                          )}
                        </p>
                        
                        {/* Show financial details for eBay sold items */}
                        {selectedSource === "ebay" && item.status === "Sold" && item.netPayout && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="text-muted-foreground">Order Total:</div>
                              <div className="text-right font-medium">${((item.price || 0) + (item.shippingCost || 0) + (item.salesTax || 0)).toFixed(2)}</div>
                              
                              {item.shippingCost > 0 && (
                                <>
                                  <div className="text-muted-foreground ml-3">• Shipping:</div>
                                  <div className="text-right">${item.shippingCost.toFixed(2)}</div>
                                </>
                              )}
                              
                              {item.salesTax > 0 && (
                                <>
                                  <div className="text-muted-foreground ml-3">• Sales tax:</div>
                                  <div className="text-right">${item.salesTax.toFixed(2)}</div>
                                </>
                              )}
                              
                              <div className="text-muted-foreground font-medium mt-1">Your Earnings:</div>
                              <div className="text-right"></div>
                              
                              {item.finalValueFee > 0 && (
                                <>
                                  <div className="text-muted-foreground ml-3">• Transaction fees:</div>
                                  <div className="text-right text-red-600 dark:text-red-400">-${item.finalValueFee.toFixed(2)}</div>
                                </>
                              )}
                              
                              <div className="text-muted-foreground font-semibold pt-1 border-t border-gray-200 dark:border-gray-600">Net Payout:</div>
                              <div className="text-right font-bold text-green-600 dark:text-green-400 pt-1 border-t border-gray-200 dark:border-gray-600">
                                ${item.netPayout.toFixed(2)}
                              </div>
                              
                              {(item.paidTime || item.fundsStatus) && (
                                <>
                                  <div className="text-muted-foreground col-span-2 mt-1">
                                    {item.fundsStatus === 'PaidOut' || item.fundsStatus === 'Available' || item.fundsStatus === 'Paid' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        ✓ Funds Available
                                      </span>
                                    ) : item.fundsStatus === 'FundsOnHold' || item.fundsStatus === 'Processing' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                        ⏳ Funds On Hold
                                      </span>
                                    ) : item.paidTime ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        ✓ Funds Available
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                        • {item.fundsStatus || 'Status Unknown'}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2">
                          {item.imported ? (
                            <>
                              <Badge variant="secondary">ALREADY IMPORTED</Badge>
                              <div className="flex gap-2 ml-auto">
                                {/* Only show individual action buttons when no items are selected */}
                                {selectedItems.length === 0 && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // For sold eBay items, navigate to Sales History with sale ID
                                        if (selectedSource === 'ebay' && item.status === 'Sold' && item.saleId) {
                                          navigate(`/AddSale?id=${item.saleId}`);
                                        } else if (item.inventoryId) {
                                          navigate(`/AddInventoryItem?id=${item.inventoryId}`);
                                        } else {
                                          navigate('/Inventory');
                                        }
                                      }}
                                    >
                                      {selectedSource === 'ebay' && item.status === 'Sold' ? (
                                        <>
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 3h18v18H3zM3 9h18M9 21V9"/>
                                          </svg>
                                          View Sales History
                                        </>
                                      ) : (
                                        <>
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                          </svg>
                                          View Inventory
                                        </>
                                      )}
                                    </Button>
                                    {/* Only show Crosslist button for non-sold items */}
                                    {!(selectedSource === 'ebay' && item.status === 'Sold') && (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="gap-2 bg-blue-600 hover:bg-blue-700"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (item.inventoryId) {
                                            navigate(`/CrosslistComposer?ids=${item.inventoryId}`);
                                          }
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                          <polyline points="7 10 12 15 17 10"></polyline>
                                          <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                        Crosslist
                                      </Button>
                                    )}
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="gap-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setItemToDelete(item.itemId);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </>
                          ) : (
                            <Badge variant="outline">NOT IMPORTED</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item from Inventory?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the item from your inventory. You can re-import it later from the Import page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate(itemToDelete);
                setDeleteDialogOpen(false);
                setItemToDelete(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Remove from Inventory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Items from List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {itemsToClear.length} item(s) from this import list. You can always re-sync from {selectedSource === "facebook" ? "Facebook" : selectedSource === "mercari" ? "Mercari" : selectedSource.charAt(0).toUpperCase() + selectedSource.slice(1)} to get them back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClear}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Yes, Clear from List
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
