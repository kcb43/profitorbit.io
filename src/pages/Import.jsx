import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { ArrowLeft, RefreshCw, Download, ChevronLeft, ChevronRight, AlertCircle, Settings } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
import { inventoryApi } from "@/api/inventoryApi";
import { format } from "date-fns";
import { getCurrentUserId } from "@/api/supabaseClient";
import SelectionBanner from "@/components/SelectionBanner";

const EBAY_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg";
const ETSY_ICON_URL = "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B";
const MERCARI_ICON_URL = "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B";
const FACEBOOK_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";

const SOURCES = [
  { id: "ebay", label: "eBay", icon: EBAY_ICON_URL, available: true },
  { id: "facebook", label: "Facebook", icon: FACEBOOK_ICON_URL, available: true },
  { id: "etsy", label: "Etsy", icon: ETSY_ICON_URL, available: false },
  { id: "mercari", label: "Mercari", icon: MERCARI_ICON_URL, available: false },
];

export default function Import() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [selectedSource, setSelectedSource] = useState(searchParams.get("source") || "ebay");
  const [listingStatus, setListingStatus] = useState("Active");
  const [importingStatus, setImportingStatus] = useState("not_imported");
  const [selectedItems, setSelectedItems] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("newest");
  const [lastSync, setLastSync] = useState(null);
  const [canSync, setCanSync] = useState(true);
  const [nextSyncTime, setNextSyncTime] = useState(null);

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
        setUserId(id);
      } catch (e) {
        console.error('Error getting user ID:', e);
      }
    };
    loadUserId();
  }, []);

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
      } else {
        // For other marketplaces, not implemented yet
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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Error fetching listings:', errorData);
        
        // Show the full error object to user
        const errorMsg = errorData.error || errorData.message || 'Failed to fetch eBay listings';
        throw new Error(`${errorMsg}${errorData.details ? '\n\nDetails: ' + errorData.details : ''}`);
      }
      const data = await response.json();
      console.log('✅ Fetched listings:', data.listings?.length || 0, 'items');
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
        } else {
          setIsConnected(false);
          console.log('❌ Facebook not connected');
        }
      } catch (e) {
        console.error('Error checking Facebook connection:', e);
        setIsConnected(false);
      }
    }
  }, [selectedSource]);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (itemIds) => {
      console.log('📥 Importing items:', itemIds);
      
      const response = await fetch("/api/ebay/import-items", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          'x-user-id': userId,  // lowercase to match API
          'x-user-token': ebayToken?.access_token || '',
        },
        body: JSON.stringify({ itemIds }),
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
      }
      
      return result;
    },
    onSuccess: (data) => {
      const message = data.failed > 0 
        ? `Imported ${data.imported} item(s), ${data.failed} failed. Check console for details.`
        : `Successfully imported ${data.imported} item(s)`;
        
      toast({
        title: data.failed > 0 ? "Import completed with errors" : "Import successful",
        description: message,
        variant: data.failed > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries(["ebay-listings"]);
      queryClient.invalidateQueries(["inventory-items"]);
      setSelectedItems([]);
      refetch(); // Refresh the list
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

  // Filter and sort listings
  const filteredListings = React.useMemo(() => {
    // Use appropriate listings based on selected source
    const sourceListings = selectedSource === "facebook" 
      ? (queryClient.getQueryData(['facebook-listings', userId]) || [])
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
  }, [ebayListings, importingStatus, sortBy, selectedSource, userId, queryClient]);

  // Pagination
  const totalPages = Math.ceil(filteredListings.length / itemsPerPage);
  const paginatedListings = filteredListings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const notImportedCount = filteredListings?.filter((item) => !item.imported).length || 0;
  const importedCount = filteredListings?.filter((item) => item.imported).length || 0;

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
        // Check if it needs a Facebook tab
        if (result?.needsFacebookTab) {
          // Open Facebook Marketplace in a new tab
          const fbTab = window.open('https://www.facebook.com/marketplace/you/selling', '_blank');
          
          toast({
            title: "Facebook Tab Opened",
            description: "Please wait for Facebook to load, then click 'Get Latest Facebook Items' again.",
            duration: 8000,
          });
          return;
        }
        
        throw new Error(result?.error || 'Failed to scrape Facebook listings');
      }
      
      // The result should contain the listings
      const listings = result?.listings || [];
      console.log('✅ Received Facebook listings:', listings.length);
      
      // Update the query data
      queryClient.setQueryData(['facebook-listings', userId], listings);
      
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

  const toggleSelectItem = (itemId) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === paginatedListings.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedListings.map((item) => item.itemId));
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
                onClick={() => navigate(createPageUrl("Crosslist"))}
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
                      <SelectItem value="Ended">Ended</SelectItem>
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
                      className="w-full justify-start"
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
                      className="w-full justify-start"
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
                      Please connect your {selectedSource === "ebay" ? "eBay" : selectedSource} account in Settings before importing.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate(createPageUrl("Settings"))}
                  >
                    <Settings className="h-4 w-4" />
                    Go to Settings
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Show content only if connected */}
            {isConnected && (
              <>
            {/* Debug/Error Info */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
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
                    <Button
                      onClick={handleImport}
                      disabled={importMutation.isPending}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      {importMutation.isPending ? 'Importing...' : `Import (${selectedItems.length})`}
                    </Button>
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
                    className={`p-4 transition-all cursor-pointer relative ${
                      selectedItems.includes(item.itemId)
                        ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md'
                        : 'hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => toggleSelectItem(item.itemId)}
                  >
                    <div className="flex gap-4">
                      <Checkbox
                        checked={selectedItems.includes(item.itemId)}
                        onCheckedChange={() => toggleSelectItem(item.itemId)}
                        onClick={(e) => e.stopPropagation()} // Prevent double-toggle
                      />
                      <div className="flex-shrink-0">
                        <OptimizedImage
                          src={item.imageUrl || item.pictureURLs?.[0]}
                          alt={item.title}
                          className="w-24 h-24 object-cover rounded"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{item.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.startTime && format(new Date(item.startTime), "MMM dd, yyyy")} · ${item.price} · Item ID: {item.itemId}
                        </p>
                        {item.imported && (
                          <Badge variant="secondary" className="mt-2">ALREADY IMPORTED</Badge>
                        )}
                        {!item.imported && (
                          <Badge variant="outline" className="mt-2">NOT IMPORTED</Badge>
                        )}
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
    </div>
  );
}
