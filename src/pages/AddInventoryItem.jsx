
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Copy as CopyIcon, BarChart, Camera, Scan, ImageIcon, X, Loader2 } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import ClearableDateInput from "../components/ClearableDateInput";
import SoldLookupDialog from "../components/SoldLookupDialog";
import ReceiptScannerDialog from "@/components/ReceiptScannerDialog";
import EbaySearchDialog from "@/components/EbaySearchDialog";
import { ImageEditor } from "@/components/ImageEditor";
import { scanReceiptPlaceholder } from "@/api/receiptScanner";
import imageCompression from "browser-image-compression";
import { ReactSortable } from "react-sortablejs";

const MAX_PHOTOS = 12;
const PREDEFINED_SOURCES = ["Amazon", "Walmart", "Best Buy", "eBay", "eBay - SalvationArmy"];
const PREDEFINED_CATEGORIES = [
  "Antiques",
  "Books, Movies & Music",
  "Clothing & Apparel",
  "Collectibles",
  "Electronics",
  "Gym/Workout",
  "Health & Beauty",
  "Home & Garden",
  "Jewelry & Watches",
  "Kitchen",
  "Makeup",
  "Mic/Audio Equipment",
  "Motorcycle",
  "Motorcycle Accessories",
  "Pets",
  "Pool Equipment",
  "Shoes/Sneakers",
  "Sporting Goods",
  "Stereos & Speakers",
  "Tools",
  "Toys & Hobbies",
  "Yoga"
];

const RETURN_WINDOWS = {
  "Amazon": 30,
  "Walmart": 90,
  "Best Buy": 15,
};

export default function AddInventoryItem() {
  const navigate = useNavigate();
  const location = useLocation();
  const rawReturnTo = location.state?.from;
  const resolvedReturnTo = React.useMemo(() => {
    const defaultPath = createPageUrl("Dashboard");

    if (rawReturnTo && typeof rawReturnTo === "object") {
      const pathname = rawReturnTo.pathname || defaultPath;
      const search = rawReturnTo.search || "";
      const filters = rawReturnTo.filters;
      const state = filters ? { filters } : rawReturnTo.state;

      return {
        path: `${pathname}${search}`,
        state,
      };
    }

    if (typeof rawReturnTo === "string") {
      return { path: rawReturnTo, state: undefined };
    }

    return { path: defaultPath, state: undefined };
  }, [rawReturnTo]);
  const navigateBackToReturn = React.useCallback(() => {
    navigate(resolvedReturnTo.path, {
      replace: true,
      state: resolvedReturnTo.state,
    });
  }, [navigate, resolvedReturnTo]);
  const queryClient = useQueryClient();
  
  const searchParams = new URLSearchParams(location.search);
  const itemId = searchParams.get('id');
  const copyId = searchParams.get('copyId');

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
    return_deadline: "",
    photos: []
  });
  const [isOtherSource, setIsOtherSource] = useState(false);
  const [isOtherCategory, setIsOtherCategory] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [soldDialogName, setSoldDialogName] = useState("");
  const imageInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [isReceiptScanning, setIsReceiptScanning] = useState(false);
  const [ebaySearchDialogOpen, setEbaySearchDialogOpen] = useState(false);
  const [ebaySearchInitialQuery, setEbaySearchInitialQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState({ url: null });

  const { data: existingItem, isLoading: isLoadingItem } = useQuery({
    queryKey: ['inventoryItem', itemId],
    queryFn: () => base44.entities.InventoryItem.get(itemId),
    enabled: !!itemId && !copyId,
  });

  const { data: itemToCopy, isLoading: isLoadingCopy } = useQuery({
    queryKey: ['inventoryItem', copyId],
    queryFn: () => base44.entities.InventoryItem.get(copyId),
    enabled: !!copyId,
  });

  useEffect(() => {
    let dataToLoad = null;
    let isCopying = false;

    if (copyId && itemToCopy) {
      dataToLoad = itemToCopy;
      isCopying = true;
    } else if (itemId && existingItem) {
      dataToLoad = existingItem;
    }

    if (dataToLoad) {
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

      // Load photos array or convert single image_url to photos array
      let photos = [];
      if (dataToLoad.images && Array.isArray(dataToLoad.images) && dataToLoad.images.length > 0) {
        photos = dataToLoad.images;
      } else if (dataToLoad.image_url) {
        photos = [{ id: `photo_${Date.now()}`, imageUrl: dataToLoad.image_url, isMain: true }];
      }

      setFormData({
        item_name: dataToLoad.item_name || "",
        purchase_price: String(dataToLoad.purchase_price) || "",
        purchase_date: dataToLoad.purchase_date || new Date().toISOString().split('T')[0],
        source: initialSource,
        status: isCopying ? "available" : (dataToLoad.status || "available"),
        category: initialCategory,
        notes: isCopying ? "" : (dataToLoad.notes || ""),
        image_url: dataToLoad.image_url || "",
        quantity: dataToLoad.quantity || 1,
        return_deadline: isCopying ? "" : (dataToLoad.return_deadline || ""),
        photos: photos
      });
    } else if (!itemId && !copyId) {
      const itemName = searchParams.get('itemName');
      if (itemName) {
        const purchasePrice = searchParams.get('purchasePrice');
        const purchaseDate = searchParams.get('purchaseDate');
        const source = searchParams.get('source');
        const category = searchParams.get('category');
        const imageUrl = searchParams.get('imageUrl');
        const notes = searchParams.get('notes');

        const initialSource = source || "";
        if (initialSource && !PREDEFINED_SOURCES.includes(initialSource)) {
          setIsOtherSource(true);
        } else {
          setIsOtherSource(false);
        }

        const initialCategory = category || "";
        if (initialCategory && !PREDEFINED_CATEGORIES.includes(initialCategory)) {
          setIsOtherCategory(true);
        } else {
          setIsOtherCategory(false);
        }

        setFormData(prev => ({
          ...prev,
          item_name: itemName,
          purchase_price: purchasePrice || "",
          purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
          source: initialSource,
          status: "available",
          category: initialCategory,
          notes: notes || "", 
          image_url: imageUrl || "",
          quantity: 1,
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
        // Invalid date string
      }
    } else if (purchase_date && !RETURN_WINDOWS[source]) {
      setFormData(prev => ({ ...prev, return_deadline: "" }));
    }
  }, [formData.source, formData.purchase_date]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const buildInventoryPayload = (data) => ({
    ...data,
    purchase_price: parseFloat(data.purchase_price) || 0,
    quantity: parseInt(data.quantity, 10) || 1,
    return_deadline: data.return_deadline ? data.return_deadline : null,
    images: data.photos || [],
    image_url: data.photos?.find(p => p.isMain)?.imageUrl || data.photos?.[0]?.imageUrl || data.image_url || '',
  });

  const itemMutation = useMutation({
    mutationFn: (data) => {
      const numericData = buildInventoryPayload(data);
      return (itemId && !copyId)
        ? base44.entities.InventoryItem.update(itemId, numericData)
        : base44.entities.InventoryItem.create(numericData);
    },
    onMutate: async (data) => {
      const payload = buildInventoryPayload(data);
      const optimisticId = (itemId && !copyId) ? itemId : payload.id || `temp-${Date.now()}`;
      const optimisticItem = {
        ...payload,
        id: optimisticId,
        created_date: payload.created_date || new Date().toISOString(),
      };

      await queryClient.cancelQueries({ queryKey: ['inventoryItems'] });
      const previousItems = queryClient.getQueryData(['inventoryItems']);

      queryClient.setQueryData(['inventoryItems'], (old = []) => {
        if (!Array.isArray(old)) return old;
        if (itemId && !copyId) {
          return old.map((item) => (item.id === itemId ? { ...item, ...optimisticItem } : item));
        }
        return [optimisticItem, ...old];
      });

      return { previousItems, optimisticId };
    },
    onError: (error, _data, context) => {
      console.error("Failed to save inventory item:", error);
      if (context?.previousItems) {
        queryClient.setQueryData(['inventoryItems'], context.previousItems);
      }
      alert("Failed to save item. Please try again.");
    },
    onSuccess: (result, _data, context) => {
      if (result && context?.optimisticId) {
        queryClient.setQueryData(['inventoryItems'], (old = []) => {
          if (!Array.isArray(old)) return old;
          return old.map((item) => (item.id === context.optimisticId ? { ...result } : item));
        });
      }
      navigateBackToReturn();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
    },
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.25,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      });
      const fileToUpload = compressedFile || file;
      const uploadPayload = fileToUpload instanceof File ? fileToUpload : new File([fileToUpload], file.name, { type: file.type });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
      handleChange('image_url', file_url);
    } catch (error) {
      console.error("Image upload failed:", error);
    } finally {
      setIsUploading(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = null;
      }
    }
  };

  const handleEditImage = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const mainPhoto = formData.photos.find(p => p.isMain);
    if (mainPhoto) {
      setImageToEdit({ url: mainPhoto.imageUrl });
      setEditorOpen(true);
    }
  };

  const handleSaveEditedImage = async (editedFile) => {
    setIsUploading(true);
    try {
      const uploadPayload = editedFile instanceof File ? editedFile : new File([editedFile], editedFile.name || 'edited-image.jpg', { type: editedFile.type || 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
      
      // Update the photo in the photos array (either main or secondary)
      setFormData(prev => {
        const photoId = imageToEdit.photoId;
        const updatedPhotos = prev.photos.map(p => 
          (photoId ? p.id === photoId : p.isMain) ? { ...p, imageUrl: file_url } : p
        );
        const mainPhoto = updatedPhotos.find(p => p.isMain);
        return {
          ...prev,
          photos: updatedPhotos,
          image_url: mainPhoto?.imageUrl || file_url
        };
      });
      
      setEditorOpen(false);
      setImageToEdit({ url: null });
    } catch (error) {
      console.error("Error uploading edited image:", error);
      alert("Failed to upload edited image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Multiple photos handlers
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = MAX_PHOTOS - formData.photos.length;
    if (remainingSlots <= 0) {
      alert(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    setUploadingPhotos(true);

    try {
      const uploadedPhotos = [];

      for (const file of filesToUpload) {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.25,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        });
        const fileToUpload = compressedFile || file;
        const uploadPayload = fileToUpload instanceof File ? fileToUpload : new File([fileToUpload], file.name, { type: file.type });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });

        uploadedPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          imageUrl: file_url,
          isMain: formData.photos.length === 0 && uploadedPhotos.length === 0
        });
      }

      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...uploadedPhotos],
        image_url: uploadedPhotos.find(p => p.isMain)?.imageUrl || prev.photos.find(p => p.isMain)?.imageUrl || prev.image_url
      }));
    } catch (error) {
      console.error("Photo upload failed:", error);
      alert("Failed to upload photos. Please try again.");
    } finally {
      setUploadingPhotos(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = null;
      }
    }
  };

  const handleSetMainPhoto = (photoId) => {
    setFormData(prev => {
      const updatedPhotos = prev.photos.map(p => ({
        ...p,
        isMain: p.id === photoId
      }));
      const mainPhoto = updatedPhotos.find(p => p.isMain);
      return {
        ...prev,
        photos: updatedPhotos,
        image_url: mainPhoto?.imageUrl || prev.image_url
      };
    });
  };

  const handleRemovePhoto = (photoId) => {
    setFormData(prev => {
      const updatedPhotos = prev.photos.filter(p => p.id !== photoId);
      const removedPhoto = prev.photos.find(p => p.id === photoId);
      
      // If we removed the main photo, set the first remaining photo as main
      if (removedPhoto?.isMain && updatedPhotos.length > 0) {
        updatedPhotos[0].isMain = true;
      }

      const mainPhoto = updatedPhotos.find(p => p.isMain);
      return {
        ...prev,
        photos: updatedPhotos,
        image_url: mainPhoto?.imageUrl || ''
      };
    });
  };

  const handleEditPhoto = (photoId) => {
    const photoToEdit = formData.photos.find(p => p.id === photoId);
    if (photoToEdit) {
      setImageToEdit({ url: photoToEdit.imageUrl, photoId });
      setEditorOpen(true);
    }
  };

  // Handle photo reordering with SortableJS
  const handlePhotoReorder = (newPhotos) => {
    // If first photo changed, update isMain status
    const updatedPhotos = newPhotos.map((photo, index) => ({
      ...photo,
      isMain: index === 0
    }));
    
    const mainPhoto = updatedPhotos.find(p => p.isMain);
    setFormData(prev => ({
      ...prev,
      photos: updatedPhotos,
      image_url: mainPhoto?.imageUrl || prev.image_url
    }));
  };

  const handleReceiptScan = async (file) => {
    setIsReceiptScanning(true);
    try {
      const parsed = await scanReceiptPlaceholder(file);
      setFormData((prev) => {
        const next = { ...prev };
        if (parsed.item_name) next.item_name = parsed.item_name;
        if (parsed.purchase_price) next.purchase_price = String(parsed.purchase_price);
        if (parsed.purchase_date) next.purchase_date = parsed.purchase_date;
        if (parsed.source) next.source = parsed.source;
        if (parsed.category) next.category = parsed.category;
        if (parsed.notes) next.notes = parsed.notes;
        return next;
      });

      if (parsed.source) {
        setIsOtherSource(!PREDEFINED_SOURCES.includes(parsed.source));
      }
      if (parsed.category) {
        setIsOtherCategory(!PREDEFINED_CATEGORIES.includes(parsed.category));
      }

      setReceiptDialogOpen(false);
    } catch (error) {
      console.error("Receipt scan failed:", error);
      alert("Unable to scan receipt. Connect a real OCR provider to enable this feature.");
    } finally {
      setIsReceiptScanning(false);
    }
  };

  const handleEbayItemSelect = (inventoryData) => {
    setFormData((prev) => {
      const next = { ...prev };
      if (inventoryData.item_name) next.item_name = inventoryData.item_name;
      if (inventoryData.purchase_price) next.purchase_price = String(inventoryData.purchase_price);
      if (inventoryData.image_url) next.image_url = inventoryData.image_url;
      if (inventoryData.category) next.category = inventoryData.category;
      if (inventoryData.source) {
        next.source = inventoryData.source;
        setIsOtherSource(!PREDEFINED_SOURCES.includes(inventoryData.source));
      }
      if (inventoryData.category) {
        setIsOtherCategory(!PREDEFINED_CATEGORIES.includes(inventoryData.category));
      }
      // Don't modify notes field when selecting eBay item
      return next;
    });
    setEbaySearchDialogOpen(false);
  };

  const handleSourceSelectChange = (value) => {
    if (value === 'other') {
      setIsOtherSource(true);
      handleChange('source', '');
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
    return <div className="p-8 text-center text-gray-700 dark:text-gray-300">Loading item data...</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="max-w-3xl mx-auto w-full min-w-0">
        <div className="flex items-center gap-4 mb-8 min-w-0">
          <Button variant="outline" size="icon" onClick={navigateBackToReturn}>
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="dark:text-gray-200 break-words">Item Photos</Label>
                    <span className="text-xs text-muted-foreground">
                      {formData.photos.length} / {MAX_PHOTOS} photos
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Upload up to {MAX_PHOTOS} photos. First photo will be the main image.
                  </p>
                  
                  {/* Photos with SortableJS - Single Unified List */}
                  {formData.photos.length > 0 && (
                    <div className="space-y-3">
                      <ReactSortable
                        list={formData.photos}
                        setList={handlePhotoReorder}
                        animation={200}
                        swapThreshold={0.65}
                        ghostClass="sortable-ghost"
                        className="grid grid-cols-4 md:grid-cols-6 gap-3"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '0.75rem'
                        }}
                      >
                        {formData.photos.map((photo, index) => (
                          <div 
                            key={photo.id}
                            className={`relative group cursor-move ${
                              photo.isMain 
                                ? 'col-span-4 md:col-span-6 aspect-square max-w-md' 
                                : 'aspect-square'
                            }`}
                            style={photo.isMain ? {
                              gridColumn: '1 / -1',
                              maxWidth: '28rem',
                              marginBottom: index === 0 && formData.photos.length > 1 ? '0.75rem' : '0'
                            } : {}}
                          >
                            <div className={`aspect-square rounded-lg border overflow-hidden ${
                              photo.isMain ? 'border-2 border-blue-500' : 'border'
                            }`}>
                              <img
                                src={photo.imageUrl}
                                alt={photo.isMain ? 'Main photo' : `Photo ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            
                            {photo.isMain && (
                              <Badge className="absolute top-2 left-2 z-20 pointer-events-none">MAIN</Badge>
                            )}
                            
                            {/* Red X button for secondary photos */}
                            {!photo.isMain && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePhoto(photo.id);
                                }}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg z-20 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}

                            {/* Edit button on hover */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                              {photo.isMain ? (
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditImage(e);
                                    }}
                                  >
                                    <ImageIcon className="w-4 h-4 mr-1" />
                                    Edit photo
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemovePhoto(photo.id);
                                    }}
                                  >
                                    Remove photo
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditPhoto(photo.id);
                                  }}
                                  className="text-xs h-7 px-3"
                                >
                                  <ImageIcon className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </ReactSortable>
                      
                      {/* Add Photos Button in Grid */}
                      {formData.photos.length < MAX_PHOTOS && (
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={uploadingPhotos}
                          className="flex aspect-square flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 text-muted-foreground transition hover:border-foreground/80 hover:text-foreground disabled:opacity-50"
                        >
                          {uploadingPhotos ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Camera className="w-5 h-5 mb-1" />
                              <span className="text-[10px]">Add photos</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Initial Upload Button (when no photos) */}
                  {formData.photos.length === 0 && (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhotos}
                      className="flex aspect-square w-full max-w-md flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/50 text-muted-foreground transition hover:border-foreground/80 hover:text-foreground disabled:opacity-50"
                    >
                      {uploadingPhotos ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-8 h-8 mb-2" />
                          <span className="text-sm font-medium">Add photos</span>
                          <span className="text-xs text-muted-foreground/70 mt-1">Upload up to {MAX_PHOTOS} photos</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Additional Actions */}
                  {formData.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReceiptDialogOpen(true)}
                        disabled={uploadingPhotos}
                        className="flex items-center gap-2"
                      >
                        <Scan className="w-4 h-4" />
                        Scan Receipt
                      </Button>
                    </div>
                  )}

                  {/* Hidden file inputs */}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploadingPhotos}
                  />
                  <input
                    ref={imageInputRef}
                    id="image-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6 min-w-0">
                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="item_name" className="dark:text-gray-200 break-words">Item Name *</Label>
                        <div className="flex gap-2">
                          <Input 
                            id="item_name" 
                            value={formData.item_name} 
                            onChange={(e) => handleChange('item_name', e.target.value)} 
                            placeholder="e.g., Vintage Nike Sneakers"
                            required
                            className="w-full"
                          />
                          {formData.item_name?.trim() && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setSoldDialogName(formData.item_name || "");
                                setSoldDialogOpen(true);
                              }}
                              className="whitespace-nowrap"
                            >
                              <BarChart className="w-4 h-4 mr-2" />
                              Search
                            </Button>
                          )}
                        </div>
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
                    
                    <ClearableDateInput
                      id="purchase_date"
                      label="Purchase Date"
                      value={formData.purchase_date}
                      onChange={(val) => handleChange('purchase_date', val)}
                      required
                    />
                    
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
                    
                    <ClearableDateInput
                      id="return_deadline"
                      label="Return Deadline (optional)"
                      value={formData.return_deadline}
                      onChange={(val) => handleChange('return_deadline', val)}
                    />

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
                                <SelectItem value="available">In Stock</SelectItem>
                                <SelectItem value="listed">Listed</SelectItem>
                                <SelectItem value="sold">Sold</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="category_select" className="dark:text-gray-200 break-words flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-muted-foreground dark:text-muted-foreground">
                            <path fill="currentColor" d="M3 3h4v4H3zM10 3h4v4h-4zM17 3h4v4h-4zM3 10h4v4H3zM10 10h4v4h-4zM17 10h4v4h-4zM3 17h4v4H3zM10 17h4v4h-4zM17 17h4v4h-4z"/>
                          </svg>
                          Category
                        </Label>
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
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={navigateBackToReturn}
                    >
                      Go Back
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

      <SoldLookupDialog
        open={soldDialogOpen}
        onOpenChange={setSoldDialogOpen}
        itemName={soldDialogName}
        onEbaySearch={() => {
          setEbaySearchInitialQuery(soldDialogName || "");
          setEbaySearchDialogOpen(true);
        }}
      />
      <ReceiptScannerDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        onScan={handleReceiptScan}
        isScanning={isReceiptScanning}
      />
      <EbaySearchDialog
        open={ebaySearchDialogOpen}
        onOpenChange={setEbaySearchDialogOpen}
        onSelectItem={handleEbayItemSelect}
        initialSearchQuery={ebaySearchInitialQuery}
      />
      <ImageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        imageSrc={imageToEdit.url}
        onSave={handleSaveEditedImage}
        fileName="inventory-item-edited.jpg"
      />
    </div>
  );
}
