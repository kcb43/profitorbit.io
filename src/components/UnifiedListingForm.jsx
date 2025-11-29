/**
 * Unified Listing Form (Vendoo Style)
 * 
 * A single master form where users enter item details once,
 * then can crosslist to multiple marketplaces.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Upload, X, Image as ImageIcon, Plus, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { base44 } from '@/api/base44Client';

const MAX_PHOTOS = 12;
const MAX_FILE_SIZE_MB = 10;
const COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'new_with_tags', label: 'New with Tags' },
  { value: 'new_without_tags', label: 'New without Tags' },
  { value: 'like_new', label: 'Like New' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'very_good', label: 'Very Good' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

export function UnifiedListingForm({ 
  itemId = null, 
  onSave, 
  onCancel,
  initialData = null 
}) {
  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    condition: 'good',
    brand: '',
    category: '',
    sku: '',
    quantity: 1,
    photos: [],
    shippingOptions: {
      freeShipping: false,
      shippingPrice: '',
      localPickup: true,
    },
    crosslistEnabled: true,
    autoDelistOnSale: true,
  });
  const { toast } = useToast();
  const photoInputRef = React.useRef(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.item_name || '',
        description: initialData.notes || '',
        price: initialData.purchase_price ? (initialData.purchase_price * 1.5).toFixed(2) : '',
        condition: initialData.condition || 'good',
        brand: initialData.brand || '',
        category: initialData.category || '',
        sku: initialData.sku || '',
        quantity: initialData.quantity || 1,
        photos: initialData.image_url ? [{ imageUrl: initialData.image_url, isMain: true }] : [],
        shippingOptions: {
          freeShipping: false,
          shippingPrice: '',
          localPickup: true,
        },
        crosslistEnabled: initialData.crosslist_enabled !== false,
        autoDelistOnSale: initialData.auto_delist_on_sale !== false,
      });
    }
  }, [initialData]);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (formData.photos.length + files.length > MAX_PHOTOS) {
      toast({
        title: 'Too Many Photos',
        description: `Maximum ${MAX_PHOTOS} photos allowed.`,
        variant: 'destructive',
      });
      return;
    }

    setUploadingPhotos(true);

    try {
      const uploadedPhotos = [];

      for (const file of files) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          toast({
            title: 'File Too Large',
            description: `${file.name} exceeds ${MAX_FILE_SIZE_MB}MB. Compressing...`,
          });
        }

        // Compress image
        const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);

        // Upload to Base44 storage
        const formDataUpload = new FormData();
        formDataUpload.append('file', compressedFile);

        // Use Base44 file upload
        const uploadResult = await base44.integrations.Core.UploadFile({
          file: compressedFile,
          fileName: `listing_${Date.now()}_${file.name}`,
        });

        uploadedPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          imageUrl: uploadResult.url || uploadResult.fileUrl,
          fileName: file.name,
          isMain: formData.photos.length === 0, // First photo is main
        });
      }

      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...uploadedPhotos],
      }));

      toast({
        title: 'Photos Uploaded',
        description: `${uploadedPhotos.length} photo(s) uploaded successfully.`,
      });
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload photos.',
        variant: 'destructive',
      });
    } finally {
      setUploadingPhotos(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = (photoId) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== photoId),
    }));
  };

  const handleSetMainPhoto = (photoId) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.map(p => ({
        ...p,
        isMain: p.id === photoId,
      })),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.price || parseFloat(formData.price) <= 0) {
        throw new Error('Valid price is required');
      }
      if (formData.photos.length === 0) {
        throw new Error('At least one photo is required');
      }

      // Prepare inventory item data
      const inventoryData = {
        item_name: formData.title,
        notes: formData.description,
        purchase_price: parseFloat(formData.price),
        condition: formData.condition,
        brand: formData.brand,
        category: formData.category,
        sku: formData.sku,
        quantity: parseInt(formData.quantity) || 1,
        image_url: formData.photos.find(p => p.isMain)?.imageUrl || formData.photos[0]?.imageUrl,
        status: 'available',
        crosslist_enabled: formData.crosslistEnabled,
        auto_delist_on_sale: formData.autoDelistOnSale,
        // Store additional photos in metadata or separate field
        metadata: {
          photos: formData.photos,
          shippingOptions: formData.shippingOptions,
        },
      };

      // Save inventory item
      let savedItem;
      if (itemId) {
        savedItem = await base44.entities.InventoryItem.update(itemId, inventoryData);
      } else {
        savedItem = await base44.entities.InventoryItem.create(inventoryData);
      }

      toast({
        title: 'Item Saved',
        description: 'Item saved successfully. You can now crosslist it to marketplaces.',
      });

      if (onSave) {
        onSave(savedItem);
      }
    } catch (error) {
      console.error('Error saving item:', error);
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save item.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
          <CardDescription>Enter your item information once, list everywhere</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Vintage Leather Jacket Size M"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your item in detail..."
              rows={6}
              required
            />
          </div>

          {/* Price and Condition */}
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
              <Label htmlFor="condition">Condition *</Label>
              <Select
                value={formData.condition}
                onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
              >
                <SelectTrigger id="condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Brand, Category, SKU */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="Brand name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Category"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Item ID</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="SKU"
              />
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>Upload up to {MAX_PHOTOS} photos. First photo will be the main image.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.photos.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              {formData.photos.map((photo, index) => (
                <div key={photo.id} className="relative group">
                  <div className="aspect-square rounded-lg border-2 overflow-hidden"
                    style={{ borderColor: photo.isMain ? 'rgb(59, 130, 246)' : 'transparent' }}>
                    <img
                      src={photo.imageUrl}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {photo.isMain && (
                    <Badge className="absolute top-2 left-2">Main</Badge>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!photo.isMain && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSetMainPhoto(photo.id)}
                      >
                        Set Main
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemovePhoto(photo.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {formData.photos.length < MAX_PHOTOS && (
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={uploadingPhotos}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhotos}
                className="w-full"
              >
                {uploadingPhotos ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photos ({formData.photos.length}/{MAX_PHOTOS})
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping Options */}
      <Card>
        <CardHeader>
          <CardTitle>Shipping Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="freeShipping">Free Shipping</Label>
            <Switch
              id="freeShipping"
              checked={formData.shippingOptions.freeShipping}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                shippingOptions: { ...prev.shippingOptions, freeShipping: checked },
              }))}
            />
          </div>
          {!formData.shippingOptions.freeShipping && (
            <div className="space-y-2">
              <Label htmlFor="shippingPrice">Shipping Price ($)</Label>
              <Input
                id="shippingPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.shippingOptions.shippingPrice}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  shippingOptions: { ...prev.shippingOptions, shippingPrice: e.target.value },
                }))}
                placeholder="0.00"
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label htmlFor="localPickup">Offer Local Pickup</Label>
            <Switch
              id="localPickup"
              checked={formData.shippingOptions.localPickup}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                shippingOptions: { ...prev.shippingOptions, localPickup: checked },
              }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Crosslisting Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Crosslisting Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="crosslistEnabled">Enable Crosslisting</Label>
              <p className="text-sm text-muted-foreground">
                Allow this item to be listed on multiple marketplaces
              </p>
            </div>
            <Switch
              id="crosslistEnabled"
              checked={formData.crosslistEnabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, crosslistEnabled: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="autoDelistOnSale">Auto-Delist on Sale</Label>
              <p className="text-sm text-muted-foreground">
                Automatically remove from other marketplaces when sold
              </p>
            </div>
            <Switch
              id="autoDelistOnSale"
              checked={formData.autoDelistOnSale}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoDelistOnSale: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Item'
          )}
        </Button>
      </div>
    </form>
  );
}

