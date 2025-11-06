
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { compressImage } from "@/utils/imageCompression";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Upload, Copy as CopyIcon, Calendar as CalendarIcon } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const PREDEFINED_SOURCES = ["Amazon", "Walmart", "Best Buy", "eBay", "eBay - SalvationArmy"];
const PREDEFINED_CATEGORIES = [
  "Electronics",
  "Clothing & Apparel",
  "Home & Garden",
  "Kitchen",
  "Toys & Hobbies",
  "Collectibles",
  "Books, Movies & Music",
  "Sporting Goods",
  "Tools",
  "Health & Beauty",
  "Jewelry & Watches",
  "Antiques",
  "Pets"
];

const RETURN_WINDOWS = {
  "Amazon": 30,
  "Walmart": 90,
  "Best Buy": 15,
};

export default function AddInventoryItem() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const searchParams = new URLSearchParams(location.search);
  const itemId = searchParams.get('id');
  const copyId = searchParams.get('copyId'); // New: Parameter for copying an item

  const [formData, setFormData] = useState({
    item_name: "",
    purchase_price: "",
    purchase_date: new Date().toISOString().split('T')[0],
    source: "",
    status: "available",
    category: "",
    notes: "",
    image_url: "",
    quantity: 1,
    return_deadline: ""
  });
  const [isOtherSource, setIsOtherSource] = useState(false);
  const [isOtherCategory, setIsOtherCategory] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: existingItem, isLoading: isLoadingItem } = useQuery({
    queryKey: ['inventoryItem', itemId],
    queryFn: () => base44.entities.InventoryItem.get(itemId),
    enabled: !!itemId && !copyId, // Only fetch if editing and not copying
  });

  const { data: itemToCopy, isLoading: isLoadingCopy } = useQuery({
    queryKey: ['inventoryItem', copyId],
    queryFn: () => base44.entities.InventoryItem.get(copyId),
    enabled: !!copyId, // Fetch if copying
  });

  useEffect(() => {
    let dataToLoad = null;
    let isCopying = false;

    if (copyId && itemToCopy) {
      // If we are copying an item, use data from itemToCopy
      dataToLoad = itemToCopy;
      isCopying = true;
    } else if (itemId && existingItem) {
      // If we are editing an existing item, use data from existingItem
      dataToLoad = existingItem;
    }

    if (dataToLoad) {
      // Determine if source and category are 'other' based on loaded data
      const initialSource = dataToLoad.source || "";
      if (initialSource && !PREDEFINED_SOURCES.includes(initialSource)) {
        setIsOtherSource(true);
      } else {
        setIsOtherSource(false);
      }

      const initialCategory = dataToLoad.category || "";
      if (initialCategory && !PREDEFINED_CATEGORIES.includes(initialCategory)) {
        setIsOtherCategory(true);
      } else {
        setIsOtherCategory(false);
      }

      // Populate formData
      setFormData({
        item_name: dataToLoad.item_name || "",
        purchase_price: String(dataToLoad.purchase_price) || "", // Ensure purchase_price is a string for input type="number"
        purchase_date: dataToLoad.purchase_date || new Date().toISOString().split('T')[0],
        source: initialSource,
        status: isCopying ? "available" : (dataToLoad.status || "available"), // Copied items start as available
        category: initialCategory,
        notes: isCopying ? "" : (dataToLoad.notes || ""), // Clear notes when copying, or keep original when editing
        image_url: dataToLoad.image_url || "",
        quantity: dataToLoad.quantity || 1,
        return_deadline: isCopying ? "" : (dataToLoad.return_deadline || "") // Clear deadline for copied items
      });
    } else if (!itemId && !copyId) { // Only pre-fill from URL parameters if creating a NEW item (not editing, not copying)
      // Logic to pre-fill from URL parameters when creating from a sale
      const itemName = searchParams.get('itemName');
      // Only proceed if itemName is provided, as it's the primary indicator for this flow
      if (itemName) {
        const purchasePrice = searchParams.get('purchasePrice');
        const purchaseDate = searchParams.get('purchaseDate');
        const source = searchParams.get('source');
        const category = searchParams.get('category');
        const imageUrl = searchParams.get('imageUrl');
        const notes = searchParams.get('notes');

        // Handle 'other' source state
        const initialSource = source || "";
        if (initialSource && !PREDEFINED_SOURCES.includes(initialSource)) {
          setIsOtherSource(true);
        } else {
          setIsOtherSource(false); // Ensure it's false if source is predefined or empty
        }

        // Handle 'other' category state
        const initialCategory = category || "";
        if (initialCategory && !PREDEFINED_CATEGORIES.includes(initialCategory)) {
          setIsOtherCategory(true);
        } else {
          setIsOtherCategory(false); // Ensure it's false if category is predefined or empty
        }

        setFormData(prev => ({
          ...prev,
          item_name: itemName,
          purchase_price: purchasePrice || "",
          purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
          source: initialSource,
          status: "available", // Default to available for new items from sales
          category: initialCategory,
          notes: notes || "", 
          image_url: imageUrl || "",
          quantity: 1, // Default quantity to 1
        }));
      }
    }
  }, [existingItem, itemToCopy, itemId, copyId, location.search]);

  useEffect(() => {
    const { source, purchase_date } = formData;
    if (purchase_date && RETURN_WINDOWS[source]) {
      try {
        const purchaseDateObj = parseISO(purchase_date);
        const deadline = addDays(purchaseDateObj, RETURN_WINDOWS[source]);
        const formattedDeadline = format(deadline, 'yyyy-MM-dd');
        setFormData(prev => ({ ...prev, return_deadline: formattedDeadline }));
      } catch (e) {
        // Invalid date string, do nothing
      }
    } else if (purchase_date && !RETURN_WINDOWS[source]) {
      // If source changes to one without a predefined return window, clear the auto-calculated deadline
      setFormData(prev => ({ ...prev, return_deadline: "" }));
    }
  }, [formData.source, formData.purchase_date]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const itemMutation = useMutation({
    mutationFn: (data) => {
      const numericData = {
        ...data,
        purchase_price: parseFloat(data.purchase_price) || 0,
        quantity: parseInt(data.quantity, 10) || 1
      };
      // If itemId is present AND we are not in a copy flow, update the item.
      // Otherwise, create a new item (this covers both 'Add' and 'Copy' scenarios).
      return (itemId && !copyId) ? base44.entities.InventoryItem.update(itemId, numericData) : base44.entities.InventoryItem.create(numericData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      navigate(createPageUrl("Inventory"));
    },
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject huge files
    if (file.size > 15 * 1024 * 1024) {
      alert("Image is too large (max 15MB).");
      e.target.value = null; // Clear the input so same file can be re-selected
      return;
    }

    setIsUploading(true);
    try {
      // Quick guard: skip videos / non-images
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file.");
        return;
      }

      // Compress before upload
      const compressed = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
        preferWebP: true
      });

      const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
      handleChange('image_url', file_url);
    } catch (error) {
      console.error("Image upload failed:", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
      e.target.value = null; // Clear the input value after upload (success or fail)
    }
  };

  const handleSourceSelectChange = (value) => {
    if (value === 'other') {
      setIsOtherSource(true);
      handleChange('source', ''); // Clear source when switching to 'other'
    } else {
      setIsOtherSource(false);
      handleChange('source', value);
    }
  };
  
  const handleCategorySelectChange = (value) => {
    if (value === 'other') {
      setIsOtherCategory(true);
      handleChange('category', '');
    } else {
      setIsOtherCategory(false);
      handleChange('category', value);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    itemMutation.mutate(formData);
  };

  if (isLoadingItem || isLoadingCopy) {
    return <div className="p-8 text-center text-gray-700 dark:text-gray-300">Loading item data...</div>
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="max-w-3xl mx-auto w-full min-w-0">
        <div className="flex items-center gap-4 mb-8 min-w-0">
          <Button variant="outline" size="icon" onClick={() => navigate(createPageUrl("Inventory"))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white break-words">
              {itemId ? "Edit Inventory Item" : (copyId ? "Copy Inventory Item" : "Add Inventory Item")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 break-words">
              {itemId ? "Update the details of this item" : (copyId ? "Create a new item from a copy" : "Add a new item to your inventory")}
            </p>
          </div>
        </div>
        <Card className="border-0 shadow-lg dark:bg-gray-800 dark:text-gray-50">
          <CardHeader className="border-b bg-gray-50 dark:bg-gray-800/50 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl dark:text-white">Item Details</CardTitle>
              {copyId && (
                <Badge className="bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-800 dark:text-orange-100 dark:border-orange-700">Copied</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 min-w-0">
            <form onSubmit={handleSubmit} className="space-y-6 min-w-0">
                {copyId && (
                    <Alert variant="default" className="bg-blue-50 border-blue-200 flex items-center space-x-2 dark:bg-blue-900 dark:border-blue-700">
                        <CopyIcon className="h-4 w-4 text-blue-700 flex-shrink-0 dark:text-blue-200" />
                        <AlertDescription className="text-blue-800 dark:text-blue-100 break-words">
                            You are creating a new item by copying an existing one. Adjust the details and save.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="grid md:grid-cols-2 gap-6 min-w-0">
                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="item_name" className="dark:text-gray-200 break-words">Item Name *</Label>
                        <Input 
                          id="item_name" 
                          value={formData.item_name} 
                          onChange={(e) => handleChange('item_name', e.target.value)} 
                          placeholder="e.g., Vintage Nike Sneakers"
                          required
                          className="w-full"
                        />
                    </div>
                     <div className="space-y-2 min-w-0">
                        <Label htmlFor="purchase_price" className="dark:text-gray-200 break-words">Purchase Price *</Label>
                        <Input 
                          id="purchase_price" 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          value={formData.purchase_price} 
                          onChange={(e) => handleChange('purchase_price', e.target.value)} 
                          placeholder="0.00"
                          required
                          className="w-full"
                        />
                    </div>
                     <div className="space-y-2 min-w-0">
                        <Label htmlFor="purchase_date" className="dark:text-gray-200 break-words">Purchase Date *</Label>
                        <div className="relative">
                          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-white pointer-events-none z-10" />
                          <Input 
                            id="purchase_date" 
                            type="date" 
                            value={formData.purchase_date} 
                            onChange={(e) => handleChange('purchase_date', e.target.value)}
                            required
                            className="pl-10 w-full cursor-pointer
                              [&::-webkit-calendar-picker-indicator]:opacity-0
                              [&::-webkit-calendar-picker-indicator]:absolute
                              [&::-webkit-calendar-picker-indicator]:left-0
                              [&::-webkit-calendar-picker-indicator]:top-0
                              [&::-webkit-calendar-picker-indicator]:w-full
                              [&::-webkit-calendar-picker-indicator]:h-full
                              [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          />
                        </div>
                    </div>
                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="quantity" className="dark:text-gray-200 break-words">Quantity *</Label>
                        <Input 
                          id="quantity" 
                          type="number" 
                          min="1" 
                          step="1" 
                          value={formData.quantity} 
                          onChange={(e) => handleChange('quantity', e.target.value)} 
                          placeholder="1"
                          required
                          className="w-full"
                        />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="source_select" className="dark:text-gray-200 break-words">Source</Label>
                      <Select
                        onValueChange={handleSourceSelectChange}
                        value={isOtherSource ? 'other' : formData.source} 
                      >
                        <SelectTrigger id="source_select" className="w-full">
                          <SelectValue placeholder="Select a source">{isOtherSource && formData.source ? formData.source : (PREDEFINED_SOURCES.includes(formData.source) ? formData.source : "Select a source")}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {PREDEFINED_SOURCES.map(source => (
                            <SelectItem key={source} value={source}>{source}</SelectItem>
                          ))}
                          <SelectItem value="other">Other...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                     <div className="space-y-2 min-w-0">
                        <Label htmlFor="return_deadline" className="dark:text-gray-200 break-words">Return Deadline</Label>
                        <div className="relative">
                          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-white pointer-events-none z-10" />
                          <Input 
                            id="return_deadline" 
                            type="date" 
                            value={formData.return_deadline} 
                            onChange={(e) => handleChange('return_deadline', e.target.value)}
                            className="pl-10 w-full cursor-pointer
                              [&::-webkit-calendar-picker-indicator]:opacity-0
                              [&::-webkit-calendar-picker-indicator]:absolute
                              [&::-webkit-calendar-picker-indicator]:left-0
                              [&::-webkit-calendar-picker-indicator]:top-0
                              [&::-webkit-calendar-picker-indicator]:w-full
                              [&::-webkit-calendar-picker-indicator]:h-full
                              [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          />
                        </div>
                    </div>

                    {isOtherSource ? (
                      <div className="space-y-2 md:col-span-2 min-w-0">
                        <Label htmlFor="other_source" className="dark:text-gray-200 break-words">Custom Source</Label>
                        <Input
                          id="other_source"
                          placeholder="e.g., Garage Sale, Flea Market"
                          value={formData.source}
                          onChange={(e) => handleChange('source', e.target.value)}
                          className="w-full"
                        />
                      </div>
                    ) : null}
                     
                     <div className="space-y-2 min-w-0">
                        <Label htmlFor="status" className="dark:text-gray-200 break-words">Status *</Label>
                        <Select 
                          value={formData.status} 
                          onValueChange={(value) => handleChange('status', value)}
                          required
                        >
                            <SelectTrigger id="status" className="w-full">
                              <SelectValue placeholder="Select status"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="available">Available</SelectItem>
                                <SelectItem value="listed">Listed</SelectItem>
                                <SelectItem value="sold">Sold</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="category_select" className="dark:text-gray-200 break-words">Category</Label>
                        <Select
                            onValueChange={handleCategorySelectChange}
                            value={isOtherCategory ? 'other' : formData.category}
                        >
                            <SelectTrigger id="category_select" className="w-full">
                                <SelectValue placeholder="Select a category">{isOtherCategory && formData.category ? formData.category : (PREDEFINED_CATEGORIES.includes(formData.category) ? formData.category : "Select a category")}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {PREDEFINED_CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                                <SelectItem value="other">Other...</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {isOtherCategory ? (
                        <div className="space-y-2 md:col-span-2 min-w-0">
                            <Label htmlFor="other_category" className="dark:text-gray-200 break-words">Custom Category</Label>
                            <Input
                                id="other_category"
                                placeholder="e.g., Video Games"
                                value={formData.category}
                                onChange={(e) => handleChange('category', e.target.value)}
                                className="w-full"
                            />
                        </div>
                    ) : null}

                    <div className="space-y-2 md:col-span-2 min-w-0">
                        <Label htmlFor="notes" className="dark:text-gray-200 break-words">Notes</Label>
                        <Textarea 
                          id="notes" 
                          value={formData.notes} 
                          onChange={(e) => handleChange('notes', e.target.value)}
                          placeholder="Any additional details..."
                          rows={3}
                          className="w-full"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2 min-w-0">
                      <Label htmlFor="image-upload-input" className="dark:text-gray-200 break-words">Item Image</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('image-upload-input').click()}
                          disabled={isUploading}
                          className="whitespace-nowrap"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {isUploading ? 'Uploading...' : 'Upload Image'}
                        </Button>
                        <Input 
                          id="image-upload-input" 
                          type="file" 
                          onChange={handleImageUpload} 
                          className="hidden" 
                          disabled={isUploading} 
                          accept="image/*" 
                        />
                      </div>
                      {formData.image_url && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Image Preview:</p>
                          <img src={formData.image_url} alt="Item Preview" className="max-h-40 max-w-full object-contain rounded-md border p-2 bg-gray-50 dark:bg-gray-800 dark:border-gray-600" />
                        </div>
                      )}
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => navigate(createPageUrl("Inventory"))}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={itemMutation.isPending || isUploading} 
                      className="bg-green-600 hover:bg-green-700"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {itemMutation.isPending ? 'Saving...' : (itemId ? 'Update Item' : 'Save Item')}
                    </Button>
                </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
