import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, RefreshCw, Download, ChevronLeft, ChevronRight, AlertCircle, Settings, Trash2, Search } from "lucide-react";
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

// Helper function to handle marketplace image URLs.
const getImageUrl = (imageUrl, source) => {
  if (!imageUrl) return '';

  // Mercari images need to be proxied due to CORS restrictions.
  if (source === 'mercari' && imageUrl.includes('mercdn.net')) {
    return `/api/proxy/image?url=${encodeURIComponent(imageUrl)}`;
  }

  // Facebook CDN (fbcdn.net) — pass the URL through unchanged.
  // OptimizedImage no longer sets crossOrigin="anonymous", so the browser
  // makes a plain <img> request without an Origin header. Facebook Marketplace
  // listing images are publicly accessible and should load fine that way.
  // If a URL has expired the existing onError fallback handles it gracefully.

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
  
  const [listingStatus, setListingStatus] = useState(() => {
    // Don't restore from localStorage - always default to "all"/"All" based on source
    // This prevents blank/invalid values when switching between marketplaces
    if (selectedSource === "facebook") return "all";
    if (selectedSource === "ebay") return "All";
    if (selectedSource === "mercari") return "all";
    return "all"; // Default fallback
  });
  const [importingStatus, setImportingStatus] = useState("not_imported");
  const [isSyncingFacebook, setIsSyncingFacebook] = useState(false);
  const [isSyncingMercari, setIsSyncingMercari] = useState(false);

  // Save listing status to localStorage for the current session (per-source)
  useEffect(() => {
    localStorage.setItem(`import_listing_status_${selectedSource}`, listingStatus);
  }, [listingStatus, selectedSource]);

  // When source changes, restore the last status for that source or use default
  useEffect(() => {
    const savedForSource = localStorage.getItem(`import_listing_status_${selectedSource}`);
    
    if (savedForSource) {
      // Validate the saved value is valid for this source
      if (selectedSource === "facebook" && ['all', 'available', 'sold', 'out_of_stock'].includes(savedForSource)) {
        setListingStatus(savedForSource);
      } else if (selectedSource === "ebay" && ['All', 'Active', 'Sold'].includes(savedForSource)) {
        setListingStatus(savedForSource);
      } else if (selectedSource === "mercari" && ['all', 'on_sale', 'sold'].includes(savedForSource)) {
        setListingStatus(savedForSource);
      } else {
        // Invalid saved value, use default
        if (selectedSource === "facebook") setListingStatus("all");
        else if (selectedSource === "ebay") setListingStatus("All");
        else if (selectedSource === "mercari") setListingStatus("all");
      }
    } else {
      // No saved value, use default
      if (selectedSource === "facebook") setListingStatus("all");
      else if (selectedSource === "ebay") setListingStatus("All");
      else if (selectedSource === "mercari") setListingStatus("all");
    }
  }, [selectedSource]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [visibleItemIds, setVisibleItemIds] = useState([]); // Track which item IDs are currently visible
  const [searchQuery, setSearchQuery] = useState('');
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
    // Don't check connection until userId is loaded
    if (!userId) {
      console.log('⏳ Waiting for userId before checking connection...');
      return;
    }
    
    const checkConnection = async () => {
      if (selectedSource === "ebay") {
        try {
          const stored = localStorage.getItem('ebay_user_token');
          if (stored) {
            const parsed = JSON.parse(stored);
            
            // Check if token is expired
            const now = Date.now();
            const expiresAt = parsed.expires_at; // Unix timestamp in milliseconds
            
            if (expiresAt && now >= expiresAt) {
              console.log('❌ eBay token expired');
              setEbayToken(null);
              setIsConnected(false);
              toast({
                title: "eBay Connection Expired",
                description: "Your eBay session has expired. Please reconnect to continue importing.",
                variant: "destructive",
              });
              return;
            }
            
            setEbayToken(parsed);
            setIsConnected(true);
            console.log('✅ eBay connected, token found and valid');
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
        // Check Facebook connection from localStorage
        try {
          const bridgeStatus = JSON.parse(localStorage.getItem('profit_orbit_bridge_status') || '{}');
          const fbConnected = bridgeStatus.facebook?.loggedIn === true;
          const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
          
          // Optimistic connection status: if we have cached items, assume connected until proven otherwise
          let hasCache = false;
          if (cachedListings) {
            try {
              const parsedListings = JSON.parse(cachedListings);
              hasCache = parsedListings.length > 0;
            } catch (e) {
              // Ignore parse errors
            }
          }
          
          // Only log if we're seeing a definitive status (not just empty localStorage)
          const hasStatus = Object.keys(bridgeStatus).length > 0;
          
          if (fbConnected) {
            setIsConnected(true);
            if (hasStatus) {
              console.log('✅ Facebook connected from bridge');
            }
          } else if (hasCache) {
            // Optimistically assume connected if we have cached items
            setIsConnected(true);
            console.log('📦 Facebook: Assuming connected (have cached items)');
          } else {
            setIsConnected(false);
            if (hasStatus) {
              console.log('❌ Facebook not connected');
            }
          }
          
          // ALWAYS load cached items if available
          if (hasCache) {
            try {
              const parsedListings = JSON.parse(cachedListings);
              console.log('📦 Pre-loading cached Facebook listings:', parsedListings.length, 'items');
              queryClient.setQueryData(['facebook-listings', userId], parsedListings);
              setFacebookListingsVersion(v => v + 1);
            } catch (e) {
              console.error('Error pre-loading cached listings:', e);
            }
          }
        } catch (e) {
          console.error('Error checking Facebook connection:', e);
          // Only set disconnected if we truly have no cache
          const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
          if (!cachedListings) {
            setIsConnected(false);
          }
        }
      } else if (selectedSource === "mercari") {
        // Check Mercari connection
        const mercariUser = localStorage.getItem('profit_orbit_mercari_user');
        const isConnectedFromStorage = mercariUser && JSON.parse(mercariUser)?.loggedIn === true;
        const cachedListings = localStorage.getItem('profit_orbit_mercari_listings');
        
        // Optimistic connection status: if we have cached items, assume connected until proven otherwise
        let hasCache = false;
        if (cachedListings) {
          try {
            const parsedListings = JSON.parse(cachedListings);
            hasCache = parsedListings.length > 0;
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        if (isConnectedFromStorage) {
          setIsConnected(true);
          console.log('✅ Mercari connected from storage');
        } else if (hasCache) {
          // Optimistically assume connected if we have cached items
          setIsConnected(true);
          console.log('📦 Mercari: Assuming connected (have cached items)');
        } else {
          setIsConnected(false);
          console.log('❌ Mercari not connected');
        }
        
        // ALWAYS load cached Mercari items if available
        if (hasCache) {
          try {
            const parsedListings = JSON.parse(cachedListings);
            console.log('📦 Pre-loading cached Mercari listings:', parsedListings.length, 'items');
            queryClient.setQueryData(['mercari-listings', userId], parsedListings);
            setFacebookListingsVersion(v => v + 1); // Reuse this to trigger re-render
          } catch (e) {
            console.error('Error pre-loading cached Mercari listings:', e);
          }
        }
      } else {
        // For other marketplaces not yet implemented
        setIsConnected(false);
      }
    };

    checkConnection();
  }, [selectedSource, userId]); // Add userId dependency

  // Update URL when source changes
  useEffect(() => {
    setSearchParams({ source: selectedSource });
  }, [selectedSource, setSearchParams]);

  // Fetch eBay listings - ALWAYS fetch both Active and Sold together for better UX
  const { data: ebayListings, isLoading, refetch, error } = useQuery({
    queryKey: ["ebay-listings", "All", userId], // Always fetch "All" status
    queryFn: async () => {
      console.log('📡 Fetching eBay listings (Active + Sold)...', { userId, hasToken: !!ebayToken?.access_token });
      
      if (!userId) {
        throw new Error('User ID not available');
      }
      
      // Always fetch ALL listings (both Active and Sold) in one go
      const response = await fetch(`/api/ebay/my-listings?status=All&limit=200`, {
        headers: {
          'x-user-id': userId,  // lowercase to match API
          'x-user-token': ebayToken?.access_token || '',
        },
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📊 Request params: Fetching ALL listings (Active + Sold)');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Error fetching listings:', errorData);
        
        // Check for expired token error
        if (errorData.errorCode === 'TOKEN_EXPIRED') {
          // Set isConnected to false so the "Not Connected" alert shows
          setIsConnected(false);
          throw new Error('TOKEN_EXPIRED');
        }
        
        // Show the full error object to user
        const errorMsg = errorData.error || errorData.message || 'Failed to fetch eBay listings';
        throw new Error(`${errorMsg}${errorData.details ? '\n\nDetails: ' + errorData.details : ''}`);
      }
      const data = await response.json();
      console.log('✅ Fetched listings:', data.listings?.length || 0, 'items');
      
      // Log Analytics API debug info
      if (data._debug) {
        console.log('🔧 Analytics Debug Info:', data._debug);
      }
      
      // Log status breakdown
      const statusCounts = data.listings?.reduce((acc, item) => {
        acc[item.status || 'unknown'] = (acc[item.status || 'unknown'] || 0) + 1;
        return acc;
      }, {});
      console.log('📊 Status breakdown:', statusCounts);
      
      // Log view count data for debugging
      const itemsWithViews = data.listings?.filter(item => item.hitCount > 0) || [];
      console.log('👁️ Items with views:', itemsWithViews.length);
      if (itemsWithViews.length > 0) {
        console.log('👁️ Sample items with views:', itemsWithViews.slice(0, 3).map(item => ({
          id: item.itemId,
          title: item.title?.substring(0, 30) + '...',
          watchCount: item.watchCount,
          hitCount: item.hitCount,
          totalImpressions: item.totalImpressions,
        })));
      } else {
        console.log('⚠️ No items have hitCount data. Sample item:', data.listings?.[0] ? {
          itemId: data.listings[0].itemId,
          title: data.listings[0].title?.substring(0, 30),
          status: data.listings[0].status,
          watchCount: data.listings[0].watchCount,
          hitCount: data.listings[0].hitCount,
          hasHitCount: typeof data.listings[0].hitCount !== 'undefined',
        } : 'No listings');
      }
      
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
      
      // Cache listings in localStorage so they persist across page navigation
      // Always cache as "All" since we're fetching everything together
      const cacheKey = `ebay_listings_All_${userId}`;
      localStorage.setItem(cacheKey, JSON.stringify(data.listings || []));
      localStorage.setItem(`${cacheKey}_timestamp`, new Date().toISOString());
      
      return data.listings || [];
    },
    enabled: false, // DISABLED: Only fetch when user clicks "Get Latest Items"
    staleTime: Infinity, // Never auto-refetch - user must click button
    gcTime: Infinity, // Keep in cache indefinitely
    onError: (err) => {
      // If token expired, mark as not connected
      if (err.message === 'TOKEN_EXPIRED') {
        console.log('🔴 Token expired - setting isConnected to false');
        setIsConnected(false);
      }
    },
    initialData: () => {
      // Load from localStorage on mount - always load from "All" cache
      if (selectedSource === "ebay" && userId) {
        const cacheKey = `ebay_listings_All_${userId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          console.log('📦 Loading cached eBay listings from localStorage (All statuses)');
          return JSON.parse(cached);
        }
      }
      return undefined;
    },
  });

  // Listen for bridge ready event and re-check connection
  useEffect(() => {
    const handleBridgeReady = (event) => {
      console.log('🔵 Import: Bridge ready event received, re-checking connection');
      
      // Re-check connection status from localStorage after bridge updates it
      if (selectedSource === 'facebook') {
        try {
          const bridgeStatus = JSON.parse(localStorage.getItem('profit_orbit_bridge_status') || '{}');
          const fbConnected = bridgeStatus.facebook?.loggedIn === true;
          console.log('🔵 Import: Facebook status after bridge ready:', fbConnected);
          setIsConnected(fbConnected);
        } catch (e) {
          console.error('Error re-checking Facebook connection:', e);
        }
      }
    };
    
    window.addEventListener('profitOrbitBridgeReady', handleBridgeReady);
    return () => window.removeEventListener('profitOrbitBridgeReady', handleBridgeReady);
  }, [selectedSource]);

  // Listen for bridge status updates
  useEffect(() => {
    const handleBridgeStatusUpdate = (event) => {
      // Only log once to reduce spam
      if (event.detail?.marketplace === selectedSource) {
        const newConnectionStatus = event.detail?.status?.loggedIn === true;
        
        // Only update if status actually changed
        setIsConnected((prevConnected) => {
          if (prevConnected !== newConnectionStatus) {
            console.log(`🔵 Import: ${selectedSource} status changed:`, prevConnected, '→', newConnectionStatus);
            return newConnectionStatus;
          }
          return prevConnected; // No change, don't trigger re-render
        });
      }
    };
    
    window.addEventListener('marketplaceStatusUpdate', handleBridgeStatusUpdate);
    return () => window.removeEventListener('marketplaceStatusUpdate', handleBridgeStatusUpdate);
  }, [selectedSource]);

  // Listen for Facebook connection from extension
  useEffect(() => {
    const handleConnectionReady = (event) => {
      if (event.data && event.data.type === 'FACEBOOK_CONNECTION_READY') {
        console.log('✅ Import Page: FACEBOOK_CONNECTION_READY received:', event.data.payload);
        
        // Update connection state
        const userName = event.data.payload?.userName || 'Facebook User';
        localStorage.setItem('profit_orbit_facebook_connected', 'true');
        localStorage.setItem('profit_orbit_facebook_user', userName);
        localStorage.removeItem('profit_orbit_facebook_disconnected');
        
        // Update React state immediately
        if (selectedSource === 'facebook') {
          setIsConnected(true);
          
          toast({
            title: 'Facebook Connected!',
            description: 'You can now fetch your Facebook Marketplace listings.',
          });
        }
      }
    };

    window.addEventListener('message', handleConnectionReady);
    return () => window.removeEventListener('message', handleConnectionReady);
  }, [selectedSource, toast]);

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

  // Listen for localStorage changes (when Inventory page un-marks items)
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Only react to changes in marketplace listing caches
      if (e.key === 'profit_orbit_facebook_listings' && selectedSource === 'facebook') {
        console.log('💾 Facebook cache updated in localStorage, reloading...');
        try {
          const parsedListings = JSON.parse(e.newValue || '[]');
          queryClient.setQueryData(['facebook-listings', userId], parsedListings);
          setFacebookListingsVersion(v => v + 1);
        } catch (err) {
          console.error('Error parsing updated Facebook cache:', err);
        }
      } else if (e.key === 'profit_orbit_mercari_listings' && selectedSource === 'mercari') {
        console.log('💾 Mercari cache updated in localStorage, reloading...');
        try {
          const parsedListings = JSON.parse(e.newValue || '[]');
          queryClient.setQueryData(['mercari-listings', userId], parsedListings);
          setFacebookListingsVersion(v => v + 1);
        } catch (err) {
          console.error('Error parsing updated Mercari cache:', err);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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
        // IMPORTANT: Query key order MUST match the order used in the query definition (line 235)
        const ebayListings = queryClient.getQueryData(['ebay-listings', listingStatus, userId]) || [];
        console.log(`📦 Retrieved ${ebayListings.length} eBay listings from cache`);
        console.log(`🔍 Item IDs to import:`, itemIds);
        
        const itemsToImport = ebayListings.filter(item => itemIds.includes(item.itemId));
        console.log(`✅ Found ${itemsToImport.length} matching items to import`);
        console.log(`📦 Items to import:`, itemsToImport.map(item => ({
          itemId: item.itemId,
          title: item.title?.substring(0, 50),
          status: item.status
        })));
        
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
            return { 
              ...item, 
              imported: true, 
              inventoryId: importedItem.inventoryId,
              saleId: importedItem.saleId // Will be present for sold items
            };
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
            return { 
              ...item, 
              imported: true, 
              inventoryId: importedItem.inventoryId,
              saleId: importedItem.saleId // Will be present for sold items
            };
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
        // IMPORTANT: Query key order MUST match the order used in the query definition (line 235)
        const ebayListings = queryClient.getQueryData(['ebay-listings', listingStatus, userId]) || [];
        const updatedListings = ebayListings.map(item => {
          // Check if this item was successfully imported
          // For sold items, itemId format is "originalItemId-txn-transactionId"
          // For active items, itemId is just the eBay item ID
          const importedItem = data.importedItems?.find(i => {
            // Match by itemId (exact match)
            if (i.itemId === item.itemId) return true;
            // For sold items, also try matching by originalItemId
            if (item.originalItemId && i.itemId === item.originalItemId) return true;
            // Try matching without transaction suffix
            const baseItemId = item.itemId?.split('-txn-')[0];
            if (baseItemId && i.itemId === baseItemId) return true;
            return false;
          });
          
          if (importedItem) {
            console.log(`✅ Marking eBay item ${item.itemId} as imported with inventory ID ${importedItem.inventoryId}`);
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
        queryClient.setQueryData(['ebay-listings', listingStatus, userId], updatedListings);
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
      // Find the item in the cached listings to get its inventory ID and sale ID
      const sourceListings = selectedSource === "facebook" 
        ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
        : selectedSource === "mercari"
        ? (queryClient.getQueryData(['mercari-listings', userId]) || [])
        : (ebayListings || []);
      
      const item = sourceListings.find(i => i.itemId === itemId);
      
      if (!item) {
        console.warn(`⚠️ Item ${itemId} not found in listings`);
        return { id: null, success: true };
      }
      
      // For ALL sold items (eBay, Facebook, Mercari), delete from sales table instead of inventory
      const isSoldItem = item.status === 'Sold' || item.status === 'sold' || item.status === 'sold_out';
      
      console.log('🔍 Delete mutation - item details:', {
        itemId,
        status: item.status,
        isSoldItem,
        saleId: item.saleId,
        inventoryId: item.inventoryId
      });
      
      if (isSoldItem) {
        let saleIdToDelete = item.saleId;
        
        // If we don't have a saleId but we have an inventoryId, query the sales table to find it
        if (!saleIdToDelete && item.inventoryId) {
          console.log(`🔍 No saleId found, querying sales table by inventory_id: ${item.inventoryId}`);
          try {
            const response = await fetch(`/api/sales?inventory_id=${item.inventoryId}&limit=1`, {
              headers: {
                'X-User-Id': userId,
              },
            });
            
            if (response.ok) {
              const result = await response.json();
              const sales = result.data || result;
              if (sales && sales.length > 0) {
                saleIdToDelete = sales[0].id;
                console.log(`✅ Found sale by inventory_id: ${saleIdToDelete}`);
              } else {
                console.warn(`⚠️ No sale found for inventory_id: ${item.inventoryId}`);
              }
            }
          } catch (err) {
            console.error('Error querying sales by inventory_id:', err);
          }
        }
        
        if (saleIdToDelete) {
          console.log(`🗑️ Deleting sold item from sales: ${saleIdToDelete}`);
          const response = await fetch(`/api/sales?id=${saleIdToDelete}&hard=true`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': userId,
            },
          });
          
          if (!response.ok) {
            throw new Error('Failed to delete sale');
          }
          
          console.log(`✅ Successfully deleted sale: ${saleIdToDelete}`);
          return { id: saleIdToDelete, success: true, isSale: true };
        } else {
          console.warn(`⚠️ Could not find saleId for sold item ${itemId}, will not delete from sales table`);
          return { id: null, success: true };
        }
      }
      
      // For non-sold items, delete from inventory
      if (!item?.inventoryId) {
        console.warn(`⚠️ Item ${itemId} has no inventory ID, marking as not imported locally`);
        return { id: null, success: true };
      }
      
      // Soft delete from inventory (permanent delete)
      return await inventoryApi.delete(item.inventoryId, true);
    },
    onSuccess: (data, itemId) => {
      const isSale = data?.isSale;
      toast({
        title: "Item deleted",
        description: isSale 
          ? "Sale has been removed from your sales history" 
          : "Item has been removed from your inventory",
      });
      
      // Update the listing to mark as not imported and remove inventory/sale IDs
      if (selectedSource === 'facebook') {
        const facebookListings = queryClient.getQueryData(['facebook-listings', userId]) || [];
        const updatedListings = facebookListings.map(item => {
          if (item.itemId === itemId) {
            return { ...item, imported: false, inventoryId: null, saleId: null };
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
            return { ...item, imported: false, inventoryId: null, saleId: null };
          }
          return item;
        });
        
        queryClient.setQueryData(['mercari-listings', userId], updatedListings);
        localStorage.setItem('profit_orbit_mercari_listings', JSON.stringify(updatedListings));
        setFacebookListingsVersion(v => v + 1);
      } else if (selectedSource === 'ebay') {
        // Update eBay cache immediately for fast UI update
        const ebayListings = queryClient.getQueryData(["ebay-listings", listingStatus, userId]) || [];
        const updatedListings = ebayListings.map(item => {
          if (item.itemId === itemId) {
            return { ...item, imported: false, inventoryId: null, saleId: null };
          }
          return item;
        });
        
        queryClient.setQueryData(["ebay-listings", listingStatus, userId], updatedListings);
        
        // Also invalidate to refresh counts in the background
        queryClient.invalidateQueries(["ebay-listings"]);
      }
      
      // Refresh inventory and sales
      queryClient.invalidateQueries(["inventory-items"]);
      if (isSale) {
        queryClient.invalidateQueries(["sales"]);
      }
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
      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(query);
        const idMatch = item.itemId?.toLowerCase().includes(query);
        if (!titleMatch && !idMatch) return false;
      }
      
      // Filter by import status
      if (importingStatus === "not_imported") {
        if (item.imported) return false;
      } else if (importingStatus === "imported") {
        if (!item.imported) return false;
      }
      
      // Filter by listing status (Active/Sold/All)
      if (selectedSource === "ebay") {
        if (listingStatus === "Active" && item.status !== "Active") {
          return false;
        } else if (listingStatus === "Sold" && item.status !== "Sold") {
          return false;
        }
        // "All" shows everything - no filter needed
      } else if (selectedSource === "facebook") {
        // Facebook uses different status values
        if (listingStatus !== "all" && item.status !== listingStatus) {
          return false;
        }
      } else if (selectedSource === "mercari") {
        // Mercari uses different status values
        // API returns "sold_out" but dropdown uses "sold"
        if (listingStatus === "sold") {
          // When "Sold" is selected, show items with status "sold_out"
          if (item.status !== "sold_out" && item.status !== "sold") {
            return false;
          }
        } else if (listingStatus !== "all" && item.status !== listingStatus) {
          return false;
        }
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
  }, [ebayListings, importingStatus, listingStatus, sortBy, selectedSource, userId, queryClient, facebookListingsVersion, searchQuery]);

  // Calculate counts from ALL listings (not filtered)
  const { notImportedCount, importedCount } = React.useMemo(() => {
    const sourceListings = selectedSource === "facebook" 
      ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
      : selectedSource === "mercari"
      ? (queryClient.getQueryData(['mercari-listings', userId]) || [])
      : (ebayListings || []);
    
    // Filter by listing status FIRST, then count by import status
    let statusFilteredListings = sourceListings;
    
    if (selectedSource === "ebay") {
      if (listingStatus === "Active") {
        statusFilteredListings = sourceListings.filter(item => item.status === "Active");
      } else if (listingStatus === "Sold") {
        statusFilteredListings = sourceListings.filter(item => item.status === "Sold");
      }
      // "All" shows everything - no filter needed
    } else if (selectedSource === "facebook") {
      // Facebook uses different status values
      if (listingStatus !== "all") {
        statusFilteredListings = sourceListings.filter(item => item.status === listingStatus);
      }
    } else if (selectedSource === "mercari") {
      // Mercari uses different status values
      // API returns "sold_out" but dropdown uses "sold"
      if (listingStatus === "sold") {
        statusFilteredListings = sourceListings.filter(item => 
          item.status === "sold_out" || item.status === "sold"
        );
      } else if (listingStatus !== "all") {
        statusFilteredListings = sourceListings.filter(item => item.status === listingStatus);
      }
    }
    
    return {
      notImportedCount: statusFilteredListings?.filter((item) => !item.imported).length || 0,
      importedCount: statusFilteredListings?.filter((item) => item.imported).length || 0,
    };
  }, [ebayListings, selectedSource, userId, queryClient, facebookListingsVersion, listingStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredListings.length / itemsPerPage);
  const paginatedListings = filteredListings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Debug: Log first eBay item's watch and hit counts
  useEffect(() => {
    if (selectedSource === "ebay" && paginatedListings.length > 0) {
      const firstItem = paginatedListings[0];
      console.log('🔍 First eBay item data:', {
        itemId: firstItem.itemId,
        title: firstItem.title?.substring(0, 50),
        status: firstItem.status,
        watchCount: firstItem.watchCount,
        hitCount: firstItem.hitCount,
        hasWatchCount: typeof firstItem.watchCount !== 'undefined',
        hasHitCount: typeof firstItem.hitCount !== 'undefined',
      });
    }
  }, [paginatedListings, selectedSource]);

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
    
    // eBay sync
    localStorage.setItem('ebay_last_sync', new Date().toISOString());
    setLastSync(new Date());
    setCanSync(false);
    setNextSyncTime(new Date(Date.now() + 5 * 60 * 1000));
    
    // Re-enable after 5 minutes
    setTimeout(() => {
      setCanSync(true);
      setNextSyncTime(null);
    }, 5 * 60 * 1000);
    
    // Show loading toast
    const loadingToast = toast({
      title: "Syncing eBay...",
      description: "Fetching latest items",
      duration: Infinity,
    });
    
    // Trigger refetch and handle completion
    refetch().then((result) => {
      loadingToast.dismiss();
      const itemCount = result.data?.length || 0;
      toast({
        title: "Sync Complete",
        description: `Fetched ${itemCount} eBay items`,
        variant: "success",
      });
    }).catch((error) => {
      loadingToast.dismiss();
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to fetch eBay items",
        variant: "destructive",
      });
    });
  };

  // Handle Facebook sync via extension
  const handleFacebookSync = async () => {
    setIsSyncingFacebook(true); // Start loading spinner
    try {
      console.log('📡 Requesting Facebook scrape from extension with status filter:', listingStatus);
      
      // Check if extension API is available
      if (!window.ProfitOrbitExtension || typeof window.ProfitOrbitExtension.scrapeFacebookListings !== 'function') {
        throw new Error('Extension API not available. Please make sure the Profit Orbit extension is installed and enabled.');
      }
      
      toast({
        title: "Syncing Facebook Marketplace",
        description: "Fetching listings...",
      });
      
      // Use the extension API with status filter
      const result = await window.ProfitOrbitExtension.scrapeFacebookListings({ statusFilter: listingStatus });
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to scrape Facebook listings');
      }
      
      // The result should contain the listings
      const listings = result?.listings || [];
      console.log('✅ Received Facebook listings:', listings.length);
      console.log('📦 Sample listing:', listings[0]);
      
      // Log status breakdown
      const statusCounts = listings.reduce((acc, item) => {
        acc[item.status || 'unknown'] = (acc[item.status || 'unknown'] || 0) + 1;
        return acc;
      }, {});
      console.log('📊 Status breakdown:', statusCounts);
      
      // Load ALL existing listings from localStorage (don't overwrite, MERGE!)
      const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
      let existingListingsMap = new Map();
      
      if (cachedListings) {
        try {
          const parsedListings = JSON.parse(cachedListings);
          // Create a map of existing listings by itemId for quick lookup
          parsedListings.forEach(item => {
            existingListingsMap.set(item.itemId, item);
          });
          console.log('📦 Found', existingListingsMap.size, 'existing cached items');
        } catch (e) {
          console.error('Error parsing cached listings:', e);
        }
      }
      
      // MERGE: Update existing items with new data, preserve imported status, add new items
      listings.forEach(newItem => {
        const existingItem = existingListingsMap.get(newItem.itemId);
        
        if (existingItem) {
          // Item exists - update it but preserve the imported status
          existingListingsMap.set(newItem.itemId, {
            ...newItem,
            imported: existingItem.imported || false
          });
        } else {
          // New item - add it to the map
          existingListingsMap.set(newItem.itemId, {
            ...newItem,
            imported: false
          });
        }
      });
      
      // Convert map back to array
      const mergedListings = Array.from(existingListingsMap.values());
      
      console.log('✅ Merged cache:', {
        totalItems: mergedListings.length,
        newItems: listings.length,
        existingItems: existingListingsMap.size - listings.length,
        byStatus: mergedListings.reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {})
      });
      
      // Update the query data and persist to localStorage
      queryClient.setQueryData(['facebook-listings', userId], mergedListings);
      localStorage.setItem('profit_orbit_facebook_listings', JSON.stringify(mergedListings));
      console.log('✅ Updated query cache and localStorage with', mergedListings.length, 'total listings');
      
      // Force a re-render
      setFacebookListingsVersion(v => v + 1);
      
      toast({
        title: "Success",
        description: `Found ${listings.length} Facebook listings`,
      });
      
      setLastSync(new Date());
      
    } catch (error) {
      console.error('❌ Facebook sync error:', error);
      
      // Check if this is a token expiration error
      const isTokenError = error.message && (
        error.message.includes('fb_dtsg') || 
        error.message.includes('CSRF token') ||
        error.message.includes('Empty response')
      );
      
      if (isTokenError) {
        // Mark Facebook as disconnected - update the actual localStorage key used by Settings.jsx
        localStorage.setItem('profit_orbit_facebook_connected', 'false');
        localStorage.removeItem('profit_orbit_facebook_user');
        
        // Update React state to reflect disconnection
        setIsConnected(false);
        
        toast({
          title: "Facebook Session Expired",
          description: "Please reconnect Facebook Marketplace in Settings to continue importing.",
          variant: "destructive",
          duration: 8000,
        });
      } else {
        toast({
          title: "Sync failed",
          description: error.message || "Failed to sync Facebook listings",
          variant: "destructive",
          duration: 6000,
        });
      }
    } finally {
      setIsSyncingFacebook(false); // Always stop loading spinner
    }
  };

  // Handle Mercari sync via extension
  const handleMercariSync = async () => {
    console.log('🔥🔥🔥 NEW CODE LOADED - MERCARI SYNC STARTING 🔥🔥🔥');
    setIsSyncingMercari(true); // Start loading spinner
    try {
      // ALWAYS fetch ALL items (both on_sale and sold) - the dropdown just filters display
      const mercariStatus = 'all';
      
      console.log('📡 Requesting Mercari scrape from extension - fetching ALL items (on_sale + sold)');
      console.log('🔍 Mercari status being sent:', mercariStatus);
      
      // Check if extension API is available
      if (!window.ProfitOrbitExtension || typeof window.ProfitOrbitExtension.scrapeMercariListings !== 'function') {
        throw new Error('Extension API not available. Please make sure the Profit Orbit extension is installed and enabled.');
      }
      
      // Use the extension API with status parameter - always fetch 'all'
      const result = await window.ProfitOrbitExtension.scrapeMercariListings({ status: mercariStatus });
      console.log('✅ Extension returned result:', result);
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch Mercari listings');
      }
      
      // The result should contain the listings
      const listings = result?.listings || [];
      console.log('✅ Received Mercari listings:', listings.length);
      console.log('📦 Sample listing:', listings[0]);
      
      // Load ALL existing listings from localStorage (don't overwrite, MERGE!)
      const cachedListings = localStorage.getItem('profit_orbit_mercari_listings');
      let existingListingsMap = new Map();
      
      if (cachedListings) {
        try {
          const parsedListings = JSON.parse(cachedListings);
          // Create a map of existing listings by itemId for quick lookup
          parsedListings.forEach(item => {
            existingListingsMap.set(item.itemId, item);
          });
          console.log('📦 Found', existingListingsMap.size, 'existing cached items');
        } catch (e) {
          console.error('Error parsing cached listings:', e);
        }
      }
      
      // MERGE: Update existing items with new data, preserve imported status, add new items
      listings.forEach(newItem => {
        const existingItem = existingListingsMap.get(newItem.itemId);
        
        if (existingItem) {
          // Item exists - update it but preserve the imported status
          existingListingsMap.set(newItem.itemId, {
            ...newItem,
            imported: existingItem.imported || false
          });
        } else {
          // New item - add it to the map
          existingListingsMap.set(newItem.itemId, {
            ...newItem,
            imported: false
          });
        }
      });
      
      // Convert map back to array
      const mergedListings = Array.from(existingListingsMap.values());
      
      console.log('✅ Merged cache:', {
        totalItems: mergedListings.length,
        newItems: listings.length,
        existingItems: existingListingsMap.size - listings.length
      });
      
      // Update the query data and persist to localStorage
      queryClient.setQueryData(['mercari-listings', userId], mergedListings);
      localStorage.setItem('profit_orbit_mercari_listings', JSON.stringify(mergedListings));
      console.log('✅ Updated query cache and localStorage with', mergedListings.length, 'total listings');
      
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
    } finally {
      setIsSyncingMercari(false); // Always stop loading spinner
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
      
      // Listen for Facebook connection from extension
      if (event.data?.type === 'FACEBOOK_CONNECTION_READY') {
        console.log('✅ Import Page: FACEBOOK_CONNECTION_READY received:', event.data.payload);
        
        // Update connection state
        const userName = event.data.payload?.userName || 'Facebook User';
        localStorage.setItem('profit_orbit_facebook_connected', 'true');
        localStorage.setItem('profit_orbit_facebook_user', userName);
        localStorage.removeItem('profit_orbit_facebook_disconnected');
        
        // Update React state immediately
        if (selectedSource === 'facebook') {
          setIsConnected(true);
          
          toast({
            title: 'Facebook Connected!',
            description: 'You can now fetch your Facebook Marketplace listings.',
          });
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [userId, queryClient, toast, selectedSource]);

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
    <div className="min-h-screen bg-background">
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
      <div className="bg-gradient-to-r from-background via-background/95 to-background border-b border-border/40 backdrop-blur-sm shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button
                variant="ghost"
                size="sm"
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
                className="flex-shrink-0 hover:bg-primary/10 transition-all hover:scale-105"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <h1 className="text-lg sm:text-2xl font-bold">Import</h1>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-shrink-0">
              {lastSync && <span className="hidden md:inline">Last sync: {format(lastSync, "h:mm a")}</span>}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || isSyncingFacebook || isSyncingMercari || !canSync}
                className="gap-1 sm:gap-2 text-xs sm:text-sm rounded-full hover:bg-primary/10 hover:border-primary/50 transition-all hover:scale-105 hover:shadow-md"
              >
                <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${(isLoading || isSyncingFacebook || isSyncingMercari) ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">
                  {!canSync && nextSyncTime 
                    ? `Sync in ${Math.ceil((nextSyncTime - new Date()) / 1000 / 60)}m`
                    : selectedSource === "facebook" 
                      ? "Sync Facebook"
                      : selectedSource === "mercari"
                        ? "Sync Mercari"
                        : selectedSource === "ebay"
                          ? "Sync eBay"
                          : `Sync ${selectedSource.charAt(0).toUpperCase() + selectedSource.slice(1)}`
                  }
                </span>
                <span className="sm:hidden">Sync</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Expired Token Banner */}
      {selectedSource === "ebay" && !isConnected && userId && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Your eBay connection has expired. Please reconnect to continue importing items.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(createPageUrl("Settings"))}
                className="ml-4 bg-white hover:bg-white/90 text-red-600 border-red-200"
              >
                <Settings className="h-4 w-4 mr-2" />
                Go to Settings
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
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

            {/* Search Bar */}
            <Card className="p-4">
              <Label className="text-sm font-medium mb-2 block">Search Items</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by title or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searchQuery && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing {filteredListings.length} result{filteredListings.length !== 1 ? 's' : ''}
                </p>
              )}
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
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
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
                    {selectedSource === "facebook" && (
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          // Open Facebook Marketplace in centered popup window
                          const width = 600;
                          const height = 700;
                          const left = (window.screen.width - width) / 2;
                          const top = (window.screen.height - height) / 2;
                          
                          window.open(
                            'https://www.facebook.com/marketplace',
                            'FacebookLogin',
                            `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
                          );
                          
                          toast({
                            title: "Login to Facebook",
                            description: "Log in to Facebook Marketplace in the popup window, then come back and click 'Get Latest Items'",
                          });
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <line x1="19" y1="8" x2="19" y2="14"></line>
                          <line x1="22" y1="11" x2="16" y2="11"></line>
                        </svg>
                        Login to Facebook
                      </Button>
                    )}
                    {selectedSource === "mercari" && (
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          // Open Mercari in new tab for user to login
                          window.open('https://www.mercari.com/mypage/', '_blank');
                          toast({
                            title: "Login to Mercari",
                            description: "Log in to Mercari in the new tab, then come back and click 'Get Latest Items'",
                          });
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <line x1="19" y1="8" x2="19" y2="14"></line>
                          <line x1="22" y1="11" x2="16" y2="11"></line>
                        </svg>
                        Login to Mercari
                      </Button>
                    )}
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
            <div className="bg-card rounded-lg border border-gray-200 dark:border-gray-700 p-4">
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
                      
                      {/* Show Crosslist button only if imported NON-SOLD items are selected */}
                      {selectedItems.some(id => {
                        const item = filteredListings.find(i => i.itemId === id);
                        const isSoldItem = item?.status === 'Sold' || item?.status === 'sold' || item?.status === 'sold_out';
                        return item && item.imported && !isSoldItem;
                      }) && (
                        <Button
                          variant="default"
                          className="gap-2 bg-blue-600 hover:bg-blue-700"
                          onClick={() => {
                            const importedItems = selectedItems.filter(id => {
                              const item = filteredListings.find(i => i.itemId === id);
                              const isSoldItem = item?.status === 'Sold' || item?.status === 'sold' || item?.status === 'sold_out';
                              return item && item.imported && !isSoldItem;
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
                            const isSoldItem = item?.status === 'Sold' || item?.status === 'sold' || item?.status === 'sold_out';
                            return item && item.imported && !isSoldItem;
                          }).length})
                        </Button>
                      )}
                      
                      {/* Show Clear button for sold items */}
                      {selectedItems.some(id => {
                        const item = filteredListings.find(i => i.itemId === id);
                        const isSoldItem = item?.status === 'Sold' || item?.status === 'sold' || item?.status === 'sold_out';
                        return item && item.imported && isSoldItem;
                      }) && (
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => {
                            setSelectedItems([]);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                          Clear
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
                          onClick={async () => {
                            const importedIds = selectedItems.filter(id => {
                              const item = filteredListings.find(i => i.itemId === id);
                              return item && item.imported;
                            });
                            
                            if (importedIds.length === 0) {
                              toast({
                                title: "No items to delete",
                                description: "Please select imported items to delete",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            // Bulk delete all selected items at once
                            console.log(`🗑️ Bulk deleting ${importedIds.length} items...`);
                            
                            try {
                              // Delete all items in parallel
                              await Promise.all(importedIds.map(async (itemId) => {
                                const sourceListings = selectedSource === "facebook" 
                                  ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
                                  : selectedSource === "mercari"
                                  ? (queryClient.getQueryData(['mercari-listings', userId]) || [])
                                  : (ebayListings || []);
                                
                                const item = sourceListings.find(i => i.itemId === itemId);
                                if (!item) return;
                                
                                // For ALL sold items (eBay, Facebook, Mercari), delete from sales
                                const isSoldItem = item.status === 'Sold' || item.status === 'sold' || item.status === 'sold_out';
                                if (isSoldItem) {
                                  let saleIdToDelete = item.saleId;
                                  
                                  // If we don't have a saleId but we have an inventoryId, query to find it
                                  if (!saleIdToDelete && item.inventoryId) {
                                    try {
                                      const response = await fetch(`/api/sales?inventory_id=${item.inventoryId}&limit=1`, {
                                        headers: { 'X-User-Id': userId },
                                      });
                                      if (response.ok) {
                                        const result = await response.json();
                                        const sales = result.data || result;
                                        if (sales && sales.length > 0) {
                                          saleIdToDelete = sales[0].id;
                                        }
                                      }
                                    } catch (err) {
                                      console.error('Error querying sales:', err);
                                    }
                                  }
                                  
                                  if (saleIdToDelete) {
                                    await fetch(`/api/sales?id=${saleIdToDelete}&hard=true`, {
                                      method: 'DELETE',
                                      headers: { 
                                        'Content-Type': 'application/json',
                                        'X-User-Id': userId
                                      }
                                    });
                                  }
                                } else if (item.inventoryId) {
                                  // Delete from inventory
                                  await inventoryApi.delete(item.inventoryId);
                                }
                              }));
                              
                              console.log(`✅ Bulk deleted ${importedIds.length} items`);
                              
                              // Clear selection and refresh
                              setSelectedItems([]);
                              
                              // Update cache
                              if (selectedSource === 'ebay') {
                                queryClient.invalidateQueries(["ebay-listings"]);
                              } else if (selectedSource === 'facebook') {
                                queryClient.invalidateQueries(['facebook-listings', userId]);
                                setFacebookListingsVersion(v => v + 1);
                              } else if (selectedSource === 'mercari') {
                                queryClient.invalidateQueries(['mercari-listings', userId]);
                              }
                              
                              toast({
                                title: "Success",
                                description: `Deleted ${importedIds.length} item${importedIds.length === 1 ? '' : 's'}`,
                              });
                            } catch (error) {
                              console.error('❌ Bulk delete error:', error);
                              toast({
                                title: "Error",
                                description: "Failed to delete some items. Please try again.",
                                variant: "destructive",
                              });
                            }
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
              <div className="bg-card rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
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
                    <div className="flex gap-3 items-start">
                      <Checkbox
                        checked={selectedItems.includes(item.itemId)}
                        onCheckedChange={() => toggleSelectItem(item.itemId, item)}
                        onClick={(e) => e.stopPropagation()} // Prevent double-toggle
                        className="mt-1"
                      />
                      <div className="flex-shrink-0 w-24">
                        <OptimizedImage
                          src={getImageUrl(item.imageUrl || item.pictureURLs?.[0], selectedSource)}
                          alt={item.title}
                          className="w-24 h-24 object-cover rounded"
                        />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{item.title}</h3>
                          {/* Show status badge when viewing "All" statuses */}
                          {((selectedSource === "facebook" && listingStatus === "all") ||
                            (selectedSource === "ebay" && listingStatus === "All") ||
                            (selectedSource === "mercari" && listingStatus === "all")) && (
                            <Badge 
                              variant="outline"
                              className={
                                item.status === 'sold' || item.status === 'Sold' || item.status === 'sold_out'
                                  ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700'
                                  : item.status === 'available' || item.status === 'Active' || item.status === 'on_sale'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700'
                                  : item.status === 'out_of_stock'
                                  ? 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                                  : 'bg-gray-100 text-gray-800 border-gray-300'
                              }
                            >
                              {item.status === 'sold' || item.status === 'Sold' || item.status === 'sold_out'
                                ? 'Sold'
                                : item.status === 'available'
                                ? 'Available'
                                : item.status === 'Active'
                                ? 'Active'
                                : item.status === 'on_sale'
                                ? 'Available'
                                : item.status === 'out_of_stock'
                                ? 'Out of Stock'
                                : item.status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.startTime && (
                            <>
                              {selectedSource === "mercari" 
                                ? (item.status === "sold" || item.status === "sold_out" ? "Sold: " : "Posted: ")
                                : selectedSource === "facebook" 
                                ? (item.status === "sold" ? "Sold: " : "Posted: ")
                                : selectedSource === "ebay" 
                                  ? (item.status === "Sold" ? "Sold: " : "Posted: ")
                                  : ""}
                              {format(new Date(item.startTime), "MMM dd, yyyy")} · 
                            </>
                          )}
                          ${item.price}
                          {/* Show Mercari likes and views for Available items only (on_sale status) */}
                          {selectedSource === "mercari" && (item.status === "on_sale" || item.status === "available") && (
                            <>
                              {(item.numLikes > 0 || item.views > 0) && (
                                <>
                                  {" · "}
                                  <span className="inline-flex items-center gap-2">
                                    {item.numLikes > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                        </svg>
                                        {item.numLikes}
                                      </span>
                                    )}
                                    {item.views > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                        </svg>
                                        {item.views}
                                      </span>
                                    )}
                                  </span>
                                </>
                              )}
                            </>
                          )}
                          {/* Show eBay watchers and views for Active items */}
                          {selectedSource === "ebay" && item.status === "Active" && (
                            <>
                              {(typeof item.watchCount !== 'undefined' || typeof item.hitCount !== 'undefined') && (
                                <>
                                  {" · "}
                                  <span className="inline-flex items-center gap-2">
                                    {typeof item.watchCount !== 'undefined' && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                        </svg>
                                        {item.watchCount || 0}
                                      </span>
                                    )}
                                    {typeof item.hitCount !== 'undefined' && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                        </svg>
                                        {item.hitCount || 0}
                                      </span>
                                    )}
                                  </span>
                                </>
                              )}
                            </>
                          )}
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
                              <div className="text-right font-medium">${(item.totalSale || ((item.price || 0) + (item.shippingCost || 0) + (item.salesTax || 0))).toFixed(2)}</div>
                              
                              {item.shippingCost > 0 && (
                                <>
                                  <div className="text-muted-foreground ml-3">• Shipping:</div>
                                  <div className="text-right">${item.shippingCost.toFixed(2)}</div>
                                </>
                              )}
                              
                              {item.salesTax > 0 && (
                                <>
                                  <div className="text-muted-foreground ml-3">• Sales tax (buyer paid):</div>
                                  <div className="text-right">${item.salesTax.toFixed(2)}</div>
                                </>
                              )}
                              
                              <div className="text-muted-foreground font-medium mt-1">Selling Costs:</div>
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
                                        // For ALL sold items (eBay, Facebook, Mercari), navigate to Sales History page with item highlighted
                                        const isSoldItem = item.status === 'Sold' || item.status === 'sold' || item.status === 'sold_out';
                                        
                                        console.log('🔍 View button clicked:', {
                                          itemId: item.itemId,
                                          status: item.status,
                                          isSoldItem,
                                          saleId: item.saleId,
                                          inventoryId: item.inventoryId,
                                          imported: item.imported
                                        });
                                        
                                        if (isSoldItem) {
                                          // If it's a sold item, always go to Sales History
                                          // If we have a saleId, highlight it; otherwise just go to the page
                                          if (item.saleId) {
                                            navigate(`/SalesHistory?highlight=${item.saleId}`);
                                          } else {
                                            // No saleId yet - maybe not imported? Go to sales history anyway
                                            navigate('/SalesHistory');
                                          }
                                        } else if (item.inventoryId) {
                                          // For available items, go to Inventory page with highlight
                                          navigate(`/Inventory?highlight=${item.inventoryId}`);
                                        } else {
                                          navigate('/Inventory');
                                        }
                                      }}
                                    >
                                      {(item.status === 'Sold' || item.status === 'sold' || item.status === 'sold_out') ? (
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
                                    {!(item.status === 'Sold' || item.status === 'sold' || item.status === 'sold_out') && (
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
            <AlertDialogTitle>
              {(() => {
                const sourceListings = selectedSource === "facebook" 
                  ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
                  : selectedSource === "mercari"
                  ? (queryClient.getQueryData(['mercari-listings', userId]) || [])
                  : (ebayListings || []);
                const item = sourceListings.find(i => i.itemId === itemToDelete);
                const isSoldItem = item?.status === 'Sold' || item?.status === 'sold' || item?.status === 'sold_out';
                return isSoldItem ? 'Remove Sale from History?' : 'Remove Item from Inventory?';
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const sourceListings = selectedSource === "facebook" 
                  ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
                  : selectedSource === "mercari"
                  ? (queryClient.getQueryData(['mercari-listings', userId]) || [])
                  : (ebayListings || []);
                const item = sourceListings.find(i => i.itemId === itemToDelete);
                const isSoldItem = item?.status === 'Sold' || item?.status === 'sold' || item?.status === 'sold_out';
                return isSoldItem 
                  ? 'This will remove the sale from your sales history. You can re-import it later from the Import page.'
                  : 'This will remove the item from your inventory. You can re-import it later from the Import page.';
              })()}
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
              {(() => {
                const sourceListings = selectedSource === "facebook" 
                  ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
                  : selectedSource === "mercari"
                  ? (queryClient.getQueryData(['mercari-listings', userId]) || [])
                  : (ebayListings || []);
                const item = sourceListings.find(i => i.itemId === itemToDelete);
                const isSoldItem = item?.status === 'Sold' || item?.status === 'sold' || item?.status === 'sold_out';
                return isSoldItem ? 'Yes, Remove from Sales History' : 'Yes, Remove from Inventory';
              })()}
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