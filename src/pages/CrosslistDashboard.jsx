/**
 * Crosslist Dashboard (Vendoo Style)
 * 
 * Shows all inventory items with their listing status per marketplace.
 * Allows bulk operations and individual marketplace actions.
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Facebook,
  ShoppingBag,
  Package,
  Shirt,
  Plus,
  List,
  X,
  RefreshCw,
  ExternalLink,
  Filter,
  CheckSquare,
  Square,
} from 'lucide-react';
import { crosslistingEngine } from '@/services/CrosslistingEngine';
import { UnifiedListingForm } from '@/components/UnifiedListingForm';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const MARKETPLACE_ICONS = {
  facebook: Facebook,
  ebay: ShoppingBag,
  mercari: Package,
  poshmark: Shirt,
};

const MARKETPLACE_COLORS = {
  facebook: 'bg-blue-600',
  ebay: 'bg-yellow-500',
  mercari: 'bg-orange-500',
  poshmark: 'bg-pink-500',
};

export default function CrosslistDashboard() {
  const [selectedItems, setSelectedItems] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    marketplace: 'all',
    status: 'all',
  });
  const [showListDialog, setShowListDialog] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);
  const [selectedMarketplaces, setSelectedMarketplaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ['inventoryItems'],
    queryFn: () => base44.entities.InventoryItem.list('-purchase_date'),
  });

  const [marketplaceListings, setMarketplaceListings] = useState({});

  useEffect(() => {
    // Load marketplace listings for all items
    const loadListings = async () => {
      const listingsMap = {};
      for (const item of inventoryItems) {
        const listings = await crosslistingEngine.getMarketplaceListings(item.id);
        listingsMap[item.id] = listings;
      }
      setMarketplaceListings(listingsMap);
    };

    if (inventoryItems.length > 0) {
      loadListings();
    }
  }, [inventoryItems]);

  const getItemListings = (itemId) => {
    return marketplaceListings[itemId] || [];
  };

  const getListingStatus = (itemId, marketplace) => {
    const listings = getItemListings(itemId);
    const listing = listings.find(l => l.marketplace === marketplace);
    if (!listing) return 'not_listed';
    return listing.status;
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(item => item.id));
    }
  };

  const handleListOnMarketplace = async (itemId, marketplace) => {
    setLoading(true);
    try {
      const accounts = await crosslistingEngine.getMarketplaceAccounts();
      const account = accounts[marketplace];

      if (!account || !account.isActive) {
        toast({
          title: 'Account Not Connected',
          description: `Please connect your ${marketplace} account first.`,
          variant: 'destructive',
        });
        return;
      }

      const result = await crosslistingEngine.listItemOnMarketplace(
        itemId,
        marketplace,
        {
          access_token: account.access_token,
        }
      );

      toast({
        title: 'Listed Successfully',
        description: `Item listed on ${marketplace}.`,
      });

      // Refresh listings
      const listings = await crosslistingEngine.getMarketplaceListings(itemId);
      setMarketplaceListings(prev => ({
        ...prev,
        [itemId]: listings,
      }));

      queryClient.invalidateQueries(['inventoryItems']);
    } catch (error) {
      toast({
        title: 'Listing Failed',
        description: error.message || `Failed to list on ${marketplace}.`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelistFromMarketplace = async (itemId, listingId, marketplace) => {
    setLoading(true);
    try {
      const accounts = await crosslistingEngine.getMarketplaceAccounts();
      const account = accounts[marketplace];

      if (!account || !account.isActive) {
        toast({
          title: 'Account Not Connected',
          description: `Please connect your ${marketplace} account first.`,
          variant: 'destructive',
        });
        return;
      }

      await crosslistingEngine.delistItemFromMarketplace(
        listingId,
        marketplace,
        {
          access_token: account.access_token,
        }
      );

      toast({
        title: 'Delisted Successfully',
        description: `Item removed from ${marketplace}.`,
      });

      // Refresh listings
      const listings = await crosslistingEngine.getMarketplaceListings(itemId);
      setMarketplaceListings(prev => ({
        ...prev,
        [itemId]: listings,
      }));

      queryClient.invalidateQueries(['inventoryItems']);
    } catch (error) {
      toast({
        title: 'Delisting Failed',
        description: error.message || `Failed to delist from ${marketplace}.`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async (action, marketplaces = []) => {
    if (selectedItems.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select items to perform bulk actions.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const accounts = await crosslistingEngine.getMarketplaceAccounts();
      const userTokens = {};

      // Get tokens for selected marketplaces
      for (const marketplace of marketplaces) {
        const account = accounts[marketplace];
        if (account && account.isActive) {
          userTokens[marketplace] = {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
          };
        }
      }

      let result;
      if (action === 'list') {
        result = await crosslistingEngine.bulkListItems(
          selectedItems,
          marketplaces,
          userTokens,
          { delayBetweenItems: 1000 } // 1 second delay
        );
      } else if (action === 'delist') {
        result = await crosslistingEngine.bulkDelistItems(
          selectedItems,
          marketplaces,
          userTokens
        );
      } else if (action === 'relist') {
        result = await crosslistingEngine.bulkRelistItems(
          selectedItems,
          marketplaces,
          userTokens
        );
      }

      toast({
        title: 'Bulk Action Completed',
        description: `${result.success.length} succeeded, ${result.errors.length} failed.`,
      });

      setSelectedItems([]);
      setShowBulkActions(false);
      queryClient.invalidateQueries(['inventoryItems']);
    } catch (error) {
      toast({
        title: 'Bulk Action Failed',
        description: error.message || 'Failed to perform bulk action.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = inventoryItems.filter(item => {
    if (filters.search && !item.item_name?.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.status !== 'all' && item.status !== filters.status) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: 'Active', color: 'bg-green-500' },
      sold: { label: 'Sold', color: 'bg-gray-500' },
      ended: { label: 'Ended', color: 'bg-yellow-500' },
      removed: { label: 'Removed', color: 'bg-red-500' },
      error: { label: 'Error', color: 'bg-red-500' },
      not_listed: { label: 'Not Listed', color: 'bg-gray-300' },
    };

    const config = statusConfig[status] || statusConfig.not_listed;
    return (
      <Badge className={`${config.color} text-white text-xs`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Crosslist Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your listings across all marketplaces
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowListDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Item
          </Button>
          {selectedItems.length > 0 && (
            <Button variant="outline" onClick={() => setShowBulkActions(true)}>
              <List className="w-4 h-4 mr-2" />
              Bulk Actions ({selectedItems.length})
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Search items..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="flex-1"
            />
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="listed">Listed</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <Checkbox
                      checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Item</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Facebook</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">eBay</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Mercari</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Poshmark</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No items found
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const listings = getItemListings(item.id);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={() => handleSelectItem(item.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.image_url && (
                              <img
                                src={item.image_url}
                                alt={item.item_name}
                                className="w-12 h-12 rounded object-cover"
                              />
                            )}
                            <div>
                              <div className="font-medium">{item.item_name}</div>
                              <div className="text-sm text-gray-500">${item.purchase_price?.toFixed(2)}</div>
                            </div>
                          </div>
                        </td>
                        {['facebook', 'ebay', 'mercari', 'poshmark'].map((marketplace) => {
                          const status = getListingStatus(item.id, marketplace);
                          const listing = listings.find(l => l.marketplace === marketplace);
                          const Icon = MARKETPLACE_ICONS[marketplace];

                          return (
                            <td key={marketplace} className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-2">
                                {getStatusBadge(status)}
                                {status === 'not_listed' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleListOnMarketplace(item.id, marketplace)}
                                    disabled={loading}
                                    className="text-xs"
                                  >
                                    <Icon className="w-3 h-3 mr-1" />
                                    List
                                  </Button>
                                ) : (
                                  <div className="flex gap-1">
                                    {listing?.marketplace_listing_url && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => window.open(listing.marketplace_listing_url, '_blank')}
                                        className="text-xs p-1"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDelistFromMarketplace(item.id, listing.marketplace_listing_id, marketplace)}
                                      disabled={loading}
                                      className="text-xs p-1 text-destructive"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right">
                          <Link to={createPageUrl(`AddInventoryItem?id=${item.id}`)}>
                            <Button size="sm" variant="outline">
                              Edit
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* New Item Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Item</DialogTitle>
            <DialogDescription>
              Enter item details once, then crosslist to multiple marketplaces
            </DialogDescription>
          </DialogHeader>
          <UnifiedListingForm
            onSave={(item) => {
              setShowListDialog(false);
              queryClient.invalidateQueries(['inventoryItems']);
              toast({
                title: 'Item Created',
                description: 'You can now crosslist this item to marketplaces.',
              });
            }}
            onCancel={() => setShowListDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Dialog */}
      <Dialog open={showBulkActions} onOpenChange={(open) => {
        setShowBulkActions(open);
        if (!open) {
          setBulkAction(null);
          setSelectedMarketplaces([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Actions</DialogTitle>
            <DialogDescription>
              Perform actions on {selectedItems.length} selected item(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List on Marketplaces</SelectItem>
                  <SelectItem value="delist">Delist from Marketplaces</SelectItem>
                  <SelectItem value="relist">Relist on Marketplaces</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bulkAction && (
              <div className="space-y-2">
                <Label>Select Marketplaces</Label>
                <div className="space-y-2">
                  {['facebook', 'ebay'].map((marketplace) => {
                    const Icon = MARKETPLACE_ICONS[marketplace];
                    return (
                      <div key={marketplace} className="flex items-center space-x-2">
                        <Checkbox
                          id={marketplace}
                          checked={selectedMarketplaces.includes(marketplace)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedMarketplaces(prev => [...prev, marketplace]);
                            } else {
                              setSelectedMarketplaces(prev => prev.filter(m => m !== marketplace));
                            }
                          }}
                        />
                        <Label htmlFor={marketplace} className="flex items-center gap-2 cursor-pointer">
                          <Icon className="w-4 h-4" />
                          {marketplace.charAt(0).toUpperCase() + marketplace.slice(1)}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkActions(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedMarketplaces.length === 0) {
                  toast({
                    title: 'No Marketplaces Selected',
                    description: 'Please select at least one marketplace.',
                    variant: 'destructive',
                  });
                  return;
                }
                handleBulkAction(bulkAction, selectedMarketplaces);
              }}
              disabled={!bulkAction || loading || selectedMarketplaces.length === 0}
            >
              {loading ? 'Processing...' : 'Execute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

