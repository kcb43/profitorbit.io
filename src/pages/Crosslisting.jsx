import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Edit, Trash2, Copy, X, ImagePlus } from "lucide-react";
import { apiClient } from "@/api/base44Client";
import { uploadApi } from "@/api/uploadApi";
import imageCompression from "browser-image-compression";

// Categories for dropdown
const CATEGORIES = [
  "Electronics",
  "Clothing & Apparel",
  "Home & Garden",
  "Sporting Goods",
  "Toys & Hobbies",
  "Books, Movies & Music",
  "Collectibles",
  "Health & Beauty",
  "Jewelry & Watches",
  "Automotive",
  "Other"
];

// Conditions for dropdown
const CONDITIONS = [
  "New",
  "Like New",
  "Excellent",
  "Good",
  "Fair",
  "Poor"
];

// TODO: Replace with actual user ID from authentication
// For now, using a placeholder - replace with your auth system
const getUserId = () => {
  // Option 1: Get from localStorage if stored
  const storedUserId = localStorage.getItem('userId');
  if (storedUserId) return storedUserId;
  
  // Option 2: Generate a temporary ID (for development)
  let userId = localStorage.getItem('temp_user_id');
  if (!userId) {
    userId = `user_${Date.now()}`;
    localStorage.setItem('temp_user_id', userId);
  }
  return userId;
};

export default function Crosslisting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = getUserId();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    images: [],
    category: "",
    condition: ""
  });

  // Fetch all crosslistings for this user
  const { data: crosslistings = [], isLoading } = useQuery({
    queryKey: ['crosslistings', userId],
    queryFn: async () => {
      const response = await fetch(`/api/crosslistings?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch crosslistings');
      }
      return response.json();
    },
    enabled: !!userId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch('/api/crosslistings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create crosslisting');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['crosslistings', userId]);
      toast({
        title: 'Success',
        description: 'Crosslisting created successfully!',
      });
      resetForm();
      setShowCreateDialog(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await fetch(`/api/crosslistings/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({ ...data, userId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update crosslisting');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['crosslistings', userId]);
      toast({
        title: 'Success',
        description: 'Crosslisting updated successfully!',
      });
      resetForm();
      setEditingListing(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await fetch(`/api/crosslistings/${id}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete crosslisting');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['crosslistings', userId]);
      toast({
        title: 'Success',
        description: 'Crosslisting deleted successfully!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      price: "",
      images: [],
      category: "",
      condition: ""
    });
    if (photoInputRef.current) {
      photoInputRef.current.value = null;
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedImages = [];
      
      for (const file of files) {
        // Compress image
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });

        // Upload to Base44
        const uploadPayload = compressedFile instanceof File 
          ? compressedFile 
          : new File([compressedFile], file.name, { type: file.type });
        
        const { file_url } = await uploadApi.uploadFile({ file: uploadPayload });
        uploadedImages.push(file_url);
      }

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedImages]
      }));

      toast({
        title: 'Photos uploaded',
        description: `${uploadedImages.length} photo(s) uploaded successfully.`,
      });
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload photos. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = null;
      }
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.price) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in title, description, and price.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.images.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please upload at least one image.',
        variant: 'destructive',
      });
      return;
    }

    if (editingListing) {
      updateMutation.mutate({ id: editingListing.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (listing) => {
    setEditingListing(listing);
    setFormData({
      title: listing.title,
      description: listing.description,
      price: listing.price,
      images: listing.images || [],
      category: listing.category || "",
      condition: listing.condition || ""
    });
    setShowCreateDialog(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this crosslisting?')) {
      deleteMutation.mutate(id);
    }
  };

  const copyExtensionLink = (id) => {
    const url = `${window.location.origin}/api/crosslistings/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Link copied!',
        description: 'Extension link copied to clipboard.',
      });
    }).catch(() => {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy link. Please copy manually.',
        variant: 'destructive',
      });
    });
  };

  const handleOpenCreateDialog = () => {
    resetForm();
    setEditingListing(null);
    setShowCreateDialog(true);
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setEditingListing(null);
    resetForm();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Crosslistings</h1>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Create Listing
        </Button>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingListing ? 'Edit Listing' : 'Create New Listing'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter listing title"
              />
            </div>

            <div>
              <Label htmlFor="price">Price *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                placeholder="Enter price"
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter listing description"
                rows={6}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="condition">Condition</Label>
                <Select value={formData.condition} onValueChange={(value) => handleInputChange('condition', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map(cond => (
                      <SelectItem key={cond} value={cond}>{cond}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Images *</Label>
              <div className="mt-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <ImagePlus className="w-4 h-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Upload Images'}
                </Button>
              </div>
              
              {formData.images.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {formData.images.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingListing
                ? 'Update'
                : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* List of Crosslistings */}
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : crosslistings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No crosslistings yet. Create your first one!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {crosslistings.map((listing) => (
            <Card key={listing.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{listing.title}</h3>
                    <p className="text-muted-foreground mb-4 line-clamp-2">{listing.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium">${listing.price}</span>
                      {listing.category && (
                        <span className="text-muted-foreground">Category: {listing.category}</span>
                      )}
                      {listing.condition && (
                        <span className="text-muted-foreground">Condition: {listing.condition}</span>
                      )}
                    </div>

                    {listing.images && listing.images.length > 0 && (
                      <div className="mt-4 flex gap-2">
                        {listing.images.slice(0, 3).map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`${listing.title} ${idx + 1}`}
                            className="w-20 h-20 object-cover rounded border"
                          />
                        ))}
                        {listing.images.length > 3 && (
                          <div className="w-20 h-20 flex items-center justify-center rounded border bg-muted">
                            +{listing.images.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyExtensionLink(listing.id)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Extension Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(listing)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(listing.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

