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
import { ArrowLeft, RefreshCw, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
import { inventoryApi } from "@/api/inventoryApi";
import { format } from "date-fns";

const EBAY_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg";
const ETSY_ICON_URL = "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B";
const MERCARI_ICON_URL = "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B";
const FACEBOOK_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";

const SOURCES = [
  { id: "ebay", label: "eBay", icon: EBAY_ICON_URL, available: true },
  { id: "etsy", label: "Etsy", icon: ETSY_ICON_URL, available: false },
  { id: "mercari", label: "Mercari", icon: MERCARI_ICON_URL, available: false },
  { id: "facebook", label: "Facebook", icon: FACEBOOK_ICON_URL, available: false },
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

  // Update URL when source changes
  useEffect(() => {
    setSearchParams({ source: selectedSource });
  }, [selectedSource, setSearchParams]);

  // Fetch eBay listings
  const { data: ebayListings, isLoading, refetch } = useQuery({
    queryKey: ["ebay-listings", listingStatus],
    queryFn: async () => {
      const response = await fetch(`/api/ebay/my-listings?status=${listingStatus}`);
      if (!response.ok) throw new Error("Failed to fetch eBay listings");
      const data = await response.json();
      setLastSync(new Date());
      return data.listings || [];
    },
    enabled: selectedSource === "ebay",
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (itemIds) => {
      const response = await fetch("/api/ebay/import-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds }),
      });
      if (!response.ok) throw new Error("Failed to import items");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import successful",
        description: `Imported ${data.imported} item(s)`,
      });
      queryClient.invalidateQueries(["ebay-listings"]);
      queryClient.invalidateQueries(["inventory-items"]);
      setSelectedItems([]);
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter and sort listings
  const filteredListings = React.useMemo(() => {
    if (!ebayListings) return [];
    
    let filtered = ebayListings.filter((item) => {
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
  }, [ebayListings, importingStatus, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredListings.length / itemsPerPage);
  const paginatedListings = filteredListings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const notImportedCount = ebayListings?.filter((item) => !item.imported).length || 0;
  const importedCount = ebayListings?.filter((item) => item.imported).length || 0;

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing...",
      description: "Fetching latest items from eBay",
    });
  };

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
                <span>Last auto sync: {format(lastSync, "h:mm a")}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Get Latest {selectedSource === "ebay" ? "eBay" : ""} Items
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

              {/* Facebook Coming Soon */}
              <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-center">
                <span className="font-medium">Facebook</span>
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
                  <div className="flex gap-2">
                    <Button
                      variant={importingStatus === "not_imported" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImportingStatus("not_imported")}
                      className="flex-1"
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
                      className="flex-1"
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
            {/* Toolbar */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
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
                      Import ({selectedItems.length})
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
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {paginatedListings.map((item) => (
                  <Card key={item.itemId} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex gap-4">
                      <Checkbox
                        checked={selectedItems.includes(item.itemId)}
                        onCheckedChange={() => toggleSelectItem(item.itemId)}
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
                          <Badge variant="secondary" className="mt-2">NOT IMPORTED</Badge>
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
          </div>
        </div>
      </div>
    </div>
  );
}
