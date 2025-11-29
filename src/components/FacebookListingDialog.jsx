import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Facebook, Loader2, AlertCircle } from "lucide-react";
import { 
  createMarketplaceListing, 
  deleteMarketplaceListing,
  getUserPages,
  isConnected,
  getConnectionStatus 
} from "@/api/facebookClient";

export function FacebookListingDialog({ open, onOpenChange, item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [connected, setConnected] = useState(false);
  const [formData, setFormData] = useState({
    pageId: '',
    title: '',
    description: '',
    price: '',
    currency: 'USD',
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && item) {
      // Initialize form with item data
      setFormData({
        pageId: '',
        title: item.item_name || '',
        description: item.notes || item.item_name || '',
        price: item.purchase_price ? (item.purchase_price * 1.5).toFixed(2) : '', // Suggest 1.5x purchase price
        currency: 'USD',
      });

      // Check connection and load pages
      checkConnection();
    }
  }, [open, item]);

  const checkConnection = async () => {
    const isConn = isConnected();
    setConnected(isConn);

    if (isConn) {
      await loadPages();
    }
  };

  const loadPages = async () => {
    setLoadingPages(true);
    try {
      const userPages = await getUserPages();
      setPages(userPages);
      
      // Auto-select first page if available
      if (userPages.length > 0 && !formData.pageId) {
        setFormData(prev => ({ ...prev, pageId: userPages[0].id }));
      }
    } catch (error) {
      console.error('Error loading pages:', error);
      toast({
        title: "Error Loading Pages",
        description: error.message || "Failed to load your Facebook pages.",
        variant: "destructive",
      });
    } finally {
      setLoadingPages(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!connected) {
      toast({
        title: "Not Connected",
        description: "Please connect your Facebook account in Settings first.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.pageId) {
      toast({
        title: "Page Required",
        description: "Please select a Facebook page.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title || !formData.description || !formData.price) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Convert price to cents
      const priceInCents = Math.round(parseFloat(formData.price) * 100);
      
      // Get image URLs from item
      const imageUrls = item.image_url ? [item.image_url] : [];

      const result = await createMarketplaceListing({
        pageId: formData.pageId,
        title: formData.title,
        description: formData.description,
        price: priceInCents,
        currency: formData.currency,
        imageUrls: imageUrls,
      });

      toast({
        title: "Listing Created",
        description: result.message || "Your item has been listed on Facebook Marketplace.",
      });

      if (onSuccess) {
        onSuccess(result);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error creating listing:', error);
      toast({
        title: "Error Creating Listing",
        description: error.message || "Failed to create Facebook Marketplace listing.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectClick = () => {
    window.location.href = '/Settings';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="w-5 h-5 text-blue-600" />
            List on Facebook Marketplace
          </DialogTitle>
          <DialogDescription>
            Create a listing for this item on Facebook Marketplace
          </DialogDescription>
        </DialogHeader>

        {!connected ? (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  Facebook Not Connected
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Please connect your Facebook account first
                </p>
              </div>
            </div>
            <Button onClick={handleConnectClick} className="w-full">
              Go to Settings
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pageId">Facebook Page *</Label>
              {loadingPages ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-500">Loading pages...</span>
                </div>
              ) : pages.length === 0 ? (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    No pages found. You need to manage at least one Facebook Page to create listings.
                  </p>
                </div>
              ) : (
                <Select
                  value={formData.pageId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, pageId: value }))}
                  required
                >
                  <SelectTrigger id="pageId">
                    <SelectValue placeholder="Select a page" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Item title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your item..."
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {item?.image_url && (
              <div className="space-y-2">
                <Label>Preview Image</Label>
                <div className="w-full h-32 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={formData.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || pages.length === 0}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Facebook className="w-4 h-4 mr-2" />
                    Create Listing
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FacebookDelistDialog({ open, onOpenChange, listingId, pageId, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteMarketplaceListing(listingId, pageId);
      
      toast({
        title: "Listing Deleted",
        description: "The listing has been removed from Facebook Marketplace.",
      });

      if (onSuccess) {
        onSuccess();
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast({
        title: "Error Deleting Listing",
        description: error.message || "Failed to delete Facebook Marketplace listing.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Remove from Facebook Marketplace</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this listing from Facebook Marketplace? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Listing'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

