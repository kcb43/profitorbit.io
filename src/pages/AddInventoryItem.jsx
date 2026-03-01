
import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "@/api/base44Client";
import { inventoryApi } from "@/api/inventoryApi";
import { uploadApi } from "@/api/uploadApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cleanHtmlText } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOURCE_GROUPS, ALL_SOURCES, getLogoUrl } from "@/constants/marketplaces";
import { useCustomSources } from "@/hooks/useCustomSources";
import { BrandCombobox } from "@/components/BrandCombobox";
import { ArrowLeft, Save, Copy as CopyIcon, BarChart, Camera, Scan, ImageIcon, X, Loader2, Sparkles } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import ClearableDateInput from "../components/ClearableDateInput";
import ReceiptScannerDialog from "@/components/ReceiptScannerDialog";
const EnhancedProductSearchDialog = React.lazy(() => import("@/components/EnhancedProductSearchDialog"));
import { ImageEditor } from "@/components/ImageEditor";
import { scanReceipt } from "@/api/receiptScanner";

import { ReactSortable } from "react-sortablejs";
import { splitBase44Tags, mergeBase44Tags } from "@/utils/base44Notes";
import { DescriptionGenerator } from "@/components/DescriptionGenerator";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORIES, UNCATEGORIZED, migrateLegacyCategory } from "@/lib/categories";
import { SmartSizeField } from "@/components/SmartSizeField";

const MAX_PHOTOS = 12;
const PREDEFINED_CATEGORIES = [...CATEGORIES, UNCATEGORIZED];

const CONDITION_OPTIONS = [
  "New",
  "New with tags",
  "New without tags",
  "New with defects",
  "Used - Like new",
  "Used - Excellent",
  "Used - Good",
  "Used - Fair",
  "For parts or not working"
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
  // Photo Editor history key: for new (unsaved) items, use a stable temp id so we can
  // reliably forget edits when photos are removed/replaced.
  const photoEditorTempIdRef = useRef(`temp_add_inventory_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const photoEditorItemId = itemId || photoEditorTempIdRef.current;

  const [formData, setFormData] = useState({
    item_name: "",
    purchase_price: "",
    purchase_date: new Date().toISOString().split('T')[0],
    source: "",
    status: "available",
    category: "",
    brand: "", // NEW: Brand field
    condition: "", // NEW: Condition field
    size: "", // NEW: Size field
    description: "",
    notes: "",
    image_url: "",
    quantity: 1,
    return_deadline: "",
    photos: [],
    is_free_or_gift: false
  });
  const [isOtherSource, setIsOtherSource] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [isOtherCategory, setIsOtherCategory] = useState(false);
  const { customSources, addCustomSource, removeCustomSource } = useCustomSources("orben_custom_sources");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchDialogQuery, setSearchDialogQuery] = useState("");
  const imageInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [isReceiptScanning, setIsReceiptScanning] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [descGenOpen, setDescGenOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState({ url: null });
  const [base44Tags, setBase44Tags] = useState("");

  const { data: existingItem, isLoading: isLoadingItem } = useQuery({
    queryKey: ['inventoryItem', itemId],
    queryFn: () => inventoryApi.get(itemId),
    enabled: !!itemId && !copyId,
  });

  const { data: itemToCopy, isLoading: isLoadingCopy } = useQuery({
    queryKey: ['inventoryItem', copyId],
    queryFn: () => inventoryApi.get(copyId),
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
      const { clean: rawCleanNotes, tags } = splitBase44Tags(dataToLoad.notes || "");
      // HTML-clean notes so items saved before paste-cleanup was added display correctly
      const cleanNotes = cleanHtmlText(rawCleanNotes);
      if (!isCopying) setBase44Tags(tags || "");

      // Legacy migration: CrosslistComposer previously saved the listing description into the
      // notes column instead of description. If description is empty but notes has content,
      // pre-populate description from notes so the user sees their content in the right field.
      // Notes is left unchanged so the user can review and clear it manually.
      const legacyDescriptionFromNotes = !dataToLoad.description && cleanNotes ? cleanNotes : '';

      const initialSource = dataToLoad.source || "";
      if (initialSource && !ALL_SOURCES.some(s => s.name === initialSource) && !customSources.includes(initialSource)) {
        setIsOtherSource(true);
        addCustomSource(initialSource);
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
        // Convert string URLs to photo objects
        photos = dataToLoad.images.map((url, index) => ({
          id: `photo_${Date.now()}_${index}`,
          imageUrl: typeof url === 'string' ? url : url.imageUrl || url.url || url,
          isMain: index === 0 // First image is main
        }));
      } else if (dataToLoad.image_url) {
        photos = [{ id: `photo_${Date.now()}`, imageUrl: dataToLoad.image_url, isMain: true }];
      }

      // Migrate legacy category to new Mercari-based system
      const migratedCategory = PREDEFINED_CATEGORIES.includes(initialCategory)
        ? initialCategory
        : migrateLegacyCategory(initialCategory);
      const isFree = dataToLoad.purchase_price != null && parseFloat(dataToLoad.purchase_price) === 0 && dataToLoad.is_free_or_gift;

      setFormData({
        item_name: dataToLoad.item_name || "",
        purchase_price: (dataToLoad.purchase_price != null && dataToLoad.purchase_price !== 0) ? String(dataToLoad.purchase_price) : (isFree ? "0" : ""),
        purchase_date: dataToLoad.purchase_date || new Date().toISOString().split('T')[0],
        source: initialSource,
        status: isCopying ? "available" : (dataToLoad.status || "available"),
        category: migratedCategory || initialCategory,
        brand: dataToLoad.brand || "",
        condition: dataToLoad.condition || "",
        size: dataToLoad.size || "",
        description: isCopying ? "" : cleanHtmlText(dataToLoad.description || legacyDescriptionFromNotes),
        notes: isCopying ? "" : cleanNotes,
        image_url: dataToLoad.image_url || "",
        quantity: dataToLoad.quantity || 1,
        return_deadline: isCopying ? "" : (dataToLoad.return_deadline || ""),
        photos: photos,
        mercari_likes: dataToLoad.mercari_likes || 0,
        mercari_views: dataToLoad.mercari_views || 0,
        is_free_or_gift: !!isFree,
      });
      
      // Debug log to verify data is loaded
      console.log('📋 Loaded inventory item data:', {
        brand: dataToLoad.brand,
        condition: dataToLoad.condition,
        size: dataToLoad.size,
        category: initialCategory
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
        if (initialSource && !ALL_SOURCES.some(s => s.name === initialSource) && !customSources.includes(initialSource)) {
          setIsOtherSource(true);
          addCustomSource(initialSource);
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

  const buildInventoryPayload = (data) => {
    // Persist `photos` (stable ids) in addition to `images` + `image_url` so Photo Editor settings
    // can be keyed to photo ids across pages.
    const { photos, ...rest } = data || {};

    return {
      ...rest,
    purchase_price: parseFloat(data.purchase_price) || 0,
    quantity: parseInt(data.quantity, 10) || 1,
    return_deadline: data.return_deadline ? data.return_deadline : null,
    images: photos?.map(p => p.imageUrl || p.url || p).filter(Boolean) || [],
    photos: photos?.map((p, idx) => ({
      id: p?.id || `photo_${idx}`,
      imageUrl: p?.imageUrl || p?.url || p?.image_url || p,
      isMain: Boolean(p?.isMain ?? idx === 0),
      fileName: p?.fileName,
    })).filter((p) => Boolean(p.imageUrl)) || [],
    image_url: photos?.find(p => p.isMain)?.imageUrl || photos?.[0]?.imageUrl || data.image_url || '',
    notes: mergeBase44Tags(
      data.notes ? cleanHtmlText(data.notes) : '',
      itemId && !copyId ? base44Tags : ''
    ),
    };
  };

  const itemMutation = useMutation({
    mutationFn: (data) => {
      const numericData = buildInventoryPayload(data);
      return (itemId && !copyId)
        ? inventoryApi.update(itemId, numericData)
        : inventoryApi.create(numericData);
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

      // If this was a NEW item (no itemId yet), migrate Photo Editor history keys
      // from the temp id used on AddInventory to the real created item id.
      try {
        if (!itemId && result?.id) {
          const tempId = photoEditorTempIdRef.current;
          const newId = String(result.id);
          const stored = localStorage.getItem('imageEditHistory');
          if (stored) {
            const map = new Map(JSON.parse(stored));
            const next = new Map();
            for (const [k, v] of map.entries()) {
              const key = String(k);
              if (key.startsWith(`${tempId}_`)) {
                next.set(`${newId}_${key.slice(`${tempId}_`.length)}`, v);
              } else {
                next.set(key, v);
              }
            }
            localStorage.setItem('imageEditHistory', JSON.stringify(Array.from(next.entries())));
          }
        }
      } catch (e) {
        console.warn('Failed to migrate photo editor history keys:', e);
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
      const { file_url } = await uploadApi.uploadFile({ file });
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
    const mainIdx = formData.photos.findIndex(p => p.isMain);
    const mainPhoto = mainIdx >= 0 ? formData.photos[mainIdx] : formData.photos[0];
    if (mainPhoto) {
      setImageToEdit({ url: mainPhoto.imageUrl, itemId: itemId, photoIndex: mainIdx >= 0 ? mainIdx : 0 });
      setEditorOpen(true);
    }
  };

  // ImageEditor already uploads the file and passes the final URL + index.
  // We just update the correct slot in formData.photos directly.
  const handleSaveEditedImage = (fileUrl, index) => {
    setFormData(prev => {
      const updatedPhotos = prev.photos.map((p, i) =>
        i === index ? { ...p, imageUrl: fileUrl } : p
      );
      const mainPhoto = updatedPhotos.find(p => p.isMain);
      return {
        ...prev,
        photos: updatedPhotos,
        image_url: mainPhoto?.imageUrl || prev.image_url,
      };
    });
    // ImageEditor closes itself (via onOpenChange) after a single-image save.
    // For "Apply to All" the editor stays open by design.
  };

  // Apply filters to all images
  const handleApplyFiltersToAll = async (processedImages, filters) => {
    setIsUploading(true);
    try {
      const updatedPhotos = [];
      
      for (let i = 0; i < processedImages.length; i++) {
        const processedItem = processedImages[i];
        const originalPhoto = formData.photos[i];
        
        // Upload the filtered image
        const { file_url } = await uploadApi.uploadFile({
          file: processedItem.file
        });
        
        // Keep the photo structure but update the imageUrl
        updatedPhotos.push({
          ...originalPhoto,
          imageUrl: file_url
        });
      }
      
      // Update all photos in the form
      setFormData(prev => {
        const mainPhoto = updatedPhotos.find(p => p.isMain);
        return {
          ...prev,
          photos: updatedPhotos,
          image_url: mainPhoto?.imageUrl || updatedPhotos[0]?.imageUrl || prev.image_url
        };
      });
      
      // ImageEditor already shows a toast ("Successfully applied edits...").
      // Avoid a second blocking browser alert here.
    } catch (error) {
      console.error("Error applying filters to all images:", error);
      alert("Failed to apply filters to all images. Please try again.");
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
        const { file_url } = await uploadApi.uploadFile({ file });

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

    // If a photo is removed, forget any Photo Editor history for that photo so
    // re-uploading (even the same image) is treated as a brand new photo.
    try {
      const raw = localStorage.getItem('imageEditHistory');
      if (raw) {
        const map = new Map(JSON.parse(raw));
        // ImageEditor keys are `${photoEditorItemId}_${photo.id}` when photo objects have ids.
        map.delete(`${photoEditorItemId}_${photoId}`);
        localStorage.setItem('imageEditHistory', JSON.stringify(Array.from(map.entries())));
      }
    } catch (e) {
      // non-fatal
      console.warn('Failed to clear image edit history on photo remove', e);
    }
  };

  const handleEditPhoto = (photoId) => {
    const photoToEdit = formData.photos.find(p => p.id === photoId);
    if (photoToEdit) {
      // Find the index of this photo for proper history keying
      const photoIndex = formData.photos.findIndex(p => p.id === photoId);
      setImageToEdit({ url: photoToEdit.imageUrl, photoId, itemId: itemId, photoIndex });
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
      const parsed = await scanReceipt(file);
      setFormData((prev) => {
        const next = { ...prev };
        // Fill item title if empty (never overwrite what the user already typed).
        if (!prev.item_name?.trim()) {
          const suggested = parsed?.suggested_title ? String(parsed.suggested_title).trim() : "";
          const fromLineItems = Array.isArray(parsed?.line_items)
            ? (parsed.line_items.find((li) => String(li?.name || "").trim())?.name || "")
            : "";
          const fallback = suggested || String(fromLineItems || "").trim();
          if (fallback) next.item_name = fallback;
        }
        if (parsed?.merchant) next.source = String(parsed.merchant);
        if (parsed?.purchase_date) next.purchase_date = String(parsed.purchase_date);
        // Fill purchase price (total) if empty (do not overwrite user input).
        if (parsed?.total && !String(prev.purchase_price || "").trim()) next.purchase_price = String(parsed.total);

        // Append parsed line items into Description (this carries into Crosslist).
        if (Array.isArray(parsed?.line_items) && parsed.line_items.length > 0) {
          const lines = parsed.line_items
            .filter(Boolean)
            .map((li) => `- ${li?.name || ''}${li?.price ? `: $${li.price}` : ''}`.trim())
            .filter(Boolean);
          const headerBits = [
            parsed?.merchant ? String(parsed.merchant) : null,
            parsed?.purchase_date ? String(parsed.purchase_date) : null,
            parsed?.total ? `Total: $${parsed.total}` : null,
          ].filter(Boolean);
          const header = headerBits.length ? `Receipt (${headerBits.join(" • ")}):` : "Receipt:";
          const block = lines.length ? `${header}\n${lines.join('\n')}` : '';
          if (block) next.description = prev.description ? `${prev.description}\n\n${block}` : block;
        }
        return next;
      });

      if (parsed?.merchant) {
        const merchantName = String(parsed.merchant);
        const isKnown = ALL_SOURCES.some(s => s.name === merchantName) || customSources.includes(merchantName);
        if (!isKnown) addCustomSource(merchantName);
        setIsOtherSource(!isKnown);
      }

      setReceiptDialogOpen(false);
    } catch (error) {
      console.error("Receipt scan failed:", error);
      alert(String(error?.message || "Unable to scan receipt. Please try again."));
    } finally {
      setIsReceiptScanning(false);
    }
  };

  const handleEbayItemSelect = (inventoryData) => {
    setFormData((prev) => {
      const next = { ...prev };
      if (inventoryData.item_name) next.item_name = inventoryData.item_name;
      if (inventoryData.image_url) next.image_url = inventoryData.image_url;
      if (inventoryData.category) next.category = inventoryData.category;
      if (inventoryData.source) {
        next.source = inventoryData.source;
        const isKnown = ALL_SOURCES.some(s => s.name === inventoryData.source) || customSources.includes(inventoryData.source);
        if (!isKnown) addCustomSource(inventoryData.source);
        setIsOtherSource(!isKnown);
      }
      if (inventoryData.category) {
        setIsOtherCategory(!PREDEFINED_CATEGORIES.includes(inventoryData.category));
      }
      // Don't modify notes field when selecting eBay item
      return next;
    });
    setSearchDialogOpen(false);
  };

  const handleSourceSelectChange = (value) => {
    if (value === '__custom__') {
      setIsOtherSource(true);
      handleChange('source', '');
    } else {
      setIsOtherSource(false);
      handleChange('source', value);
    }
  };

  const handleCustomSourceSave = () => {
    const trimmed = formData.source?.trim();
    if (!trimmed) return;
    // Check if it matches a predefined source
    const match = ALL_SOURCES.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      handleChange('source', match.name);
    } else {
      addCustomSource(trimmed);
      handleChange('source', trimmed);
    }
    setIsOtherSource(false);
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
    return <div className="p-8 text-center text-foreground">Loading item data...</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background overflow-x-hidden">
      <div className="max-w-3xl mx-auto w-full min-w-0">
        <div className="flex items-center gap-4 mb-8 min-w-0">
          <Button variant="outline" size="icon" onClick={navigateBackToReturn}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-foreground break-words">
              {itemId ? "Edit Inventory Item" : (copyId ? "Copy Inventory Item" : "Add Inventory Item")}
            </h1>
            <p className="text-muted-foreground mt-1 break-words">
              {itemId ? "Update the details of this item" : (copyId ? "Create a new item from a copy" : "Add a new item to your inventory")}
            </p>
          </div>
        </div>
        <Card className="border-0 shadow-lg bg-card">
          <CardHeader className="border-b bg-muted/50 border-border">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl text-foreground">Item Details</CardTitle>
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
                    <Label className="text-foreground break-words">Item Photos</Label>
                    <span className="text-xs text-muted-foreground">
                      {formData.photos.length} / {MAX_PHOTOS} photos
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Upload up to {MAX_PHOTOS} photos. First photo will be the main image.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported: JPG, PNG, HEIC/HEIF, WebP. No PDFs. Large photos are compressed automatically.
                  </p>
                  
                  {/* Photos with SortableJS - Single Unified List */}
                  {formData.photos.length > 0 && (
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-3 relative">
                      <ReactSortable
                        list={formData.photos}
                        setList={handlePhotoReorder}
                        animation={200}
                        swapThreshold={0.65}
                        className="contents"
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
                      
                      {/* Add Photos Button in Grid - same size as photo tiles */}
                      {formData.photos.length < MAX_PHOTOS && (
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={uploadingPhotos}
                          className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                        >
                          {uploadingPhotos ? (
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <Camera className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
                              <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
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
                      className="relative aspect-square w-32 sm:w-40 md:w-52 rounded-2xl border-2 border-dashed border-muted-foreground/40 bg-muted/20 flex items-center justify-center overflow-hidden transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary hover:bg-primary/5 cursor-pointer"
                    >
                      {uploadingPhotos ? (
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Camera className="w-7 h-7 sm:w-9 sm:h-9" />
                          <span className="text-xs sm:text-sm font-medium">Add item photo</span>
                          <span className="text-[11px] sm:text-xs text-muted-foreground/70">Tap to upload</span>
                        </div>
                      )}
                    </button>
                  )}

                  {/* Additional Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReceiptDialogOpen(true)}
                      disabled={uploadingPhotos || isReceiptScanning}
                      className="flex items-center gap-2"
                    >
                      <Scan className="w-4 h-4" />
                      Scan Receipt
                    </Button>
                  </div>

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
                        <Label htmlFor="item_name" className="text-foreground break-words">
                          Item Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex gap-2">
                          <Input 
                            id="item_name" 
                            value={formData.item_name} 
                            onChange={(e) => handleChange('item_name', e.target.value)} 
                            placeholder="e.g., Vintage Nike Sneakers"
                            required
                            className="w-full text-foreground bg-background"
                          />
                          {formData.item_name?.trim() && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setSearchDialogQuery(formData.item_name || "");
                                setSearchDialogOpen(true);
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
                        <Label htmlFor="purchase_price" className="text-foreground break-words">
                          Purchase Price / Cost {formData.source !== 'Facebook' && formData.source !== 'Mercari' && !formData.is_free_or_gift && <span className="text-red-500">*</span>}
                        </Label>
                        <div className="flex items-center gap-3 mb-1">
                          <Checkbox
                            id="free_or_gift"
                            checked={!!formData.is_free_or_gift}
                            onCheckedChange={(checked) => {
                              handleChange('is_free_or_gift', checked);
                              if (checked) handleChange('purchase_price', '0');
                            }}
                          />
                          <Label htmlFor="free_or_gift" className="text-sm text-muted-foreground cursor-pointer">Free or Gift</Label>
                        </div>
                        <Input
                          id="purchase_price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.purchase_price}
                          onChange={(e) => handleChange('purchase_price', e.target.value)}
                          placeholder={formData.source === 'Facebook' || formData.source === 'Mercari' ? "Optional - add your actual cost" : "0.00"}
                          required={formData.source !== 'Facebook' && formData.source !== 'Mercari' && !formData.is_free_or_gift}
                          disabled={!!formData.is_free_or_gift}
                          className={`w-full text-foreground bg-background ${formData.is_free_or_gift ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {(formData.source === 'Facebook' || formData.source === 'Mercari') && (
                          <p className="text-xs text-muted-foreground">
                            Leave blank if you don't know your cost yet. The listing price is already set from {formData.source}.
                          </p>
                        )}
                    </div>
                    
                    <ClearableDateInput
                      id="purchase_date"
                      label="Purchase Date"
                      value={formData.purchase_date}
                      onChange={(val) => handleChange('purchase_date', val)}
                      required
                    />
                    
                    <ClearableDateInput
                      id="return_deadline"
                      label="Return Deadline (optional)"
                      value={formData.return_deadline}
                      onChange={(val) => handleChange('return_deadline', val)}
                    />
                    
                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="quantity" className="text-foreground break-words">Quantity *</Label>
                        <Input 
                          id="quantity" 
                          type="number" 
                          min="1" 
                          step="1" 
                          value={formData.quantity} 
                          onChange={(e) => handleChange('quantity', e.target.value)} 
                          placeholder="1"
                          required
                          className="w-full text-foreground bg-background"
                        />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="source_select" className="text-foreground break-words">Source</Label>
                      <Select
                        onValueChange={handleSourceSelectChange}
                        value={isOtherSource ? '__custom__' : (formData.source ?? '')}
                        onOpenChange={(open) => { if (!open) setSourceSearch(''); }}
                      >
                        <SelectTrigger id="source_select" className="w-full text-foreground bg-background">
                          <SelectValue placeholder="Select a source">
                            {formData.source && !isOtherSource ? (() => {
                              const entry = ALL_SOURCES.find(s => s.name === formData.source);
                              const logoUrl = entry?.domain ? getLogoUrl(entry.domain) : null;
                              return (
                                <div className="flex items-center gap-2">
                                  {logoUrl ? (
                                    <img src={logoUrl} alt={formData.source} className="w-4 h-4 object-contain" />
                                  ) : entry?.emoji ? (
                                    <span className="text-sm">{entry.emoji}</span>
                                  ) : null}
                                  <span>{formData.source}</span>
                                </div>
                              );
                            })() : (isOtherSource ? "Custom source…" : "Select a source")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-popover text-popover-foreground p-0 max-h-96">
                          {/* ── Sticky search + Add Custom ─────────────────── */}
                          <div
                            className="sticky top-0 z-10 bg-popover border-b border-border px-2 py-2 space-y-1"
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <input
                              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              placeholder="Search sources…"
                              value={sourceSearch}
                              onChange={(e) => setSourceSearch(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          {/* ── Add Custom Source (always at top) ──────────── */}
                          <SelectItem value="__custom__" className="text-foreground font-medium border-b border-border rounded-none">
                            + Add Custom Source…
                          </SelectItem>
                          {/* ── My Custom Sources ──────────────────────────── */}
                          {customSources.filter(s => !sourceSearch || s.toLowerCase().includes(sourceSearch.toLowerCase())).length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-muted-foreground text-xs">My Custom Sources</SelectLabel>
                              {customSources.filter(s => !sourceSearch || s.toLowerCase().includes(sourceSearch.toLowerCase())).map(src => (
                                <SelectItem key={src} value={src} className="text-foreground">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">✦</span>
                                    <span>{src}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {/* ── Standard grouped sources (filtered) ────────── */}
                          {sourceSearch ? (
                            <SelectGroup>
                              <SelectLabel className="text-muted-foreground text-xs">Results</SelectLabel>
                              {ALL_SOURCES.filter(s => s.name.toLowerCase().includes(sourceSearch.toLowerCase())).map(source => (
                                <SelectItem key={source.name} value={source.name} className="text-foreground">
                                  <div className="flex items-center gap-2">
                                    {source.domain ? (
                                      <img src={getLogoUrl(source.domain)} alt={source.name} className="w-4 h-4 object-contain flex-shrink-0" />
                                    ) : source.emoji ? (
                                      <span className="text-sm flex-shrink-0">{source.emoji}</span>
                                    ) : null}
                                    <span>{source.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ) : (
                            SOURCE_GROUPS.map(group => (
                              <SelectGroup key={group.label}>
                                <SelectLabel className="text-muted-foreground text-xs">{group.label}</SelectLabel>
                                {group.items.map(source => (
                                  <SelectItem key={source.name} value={source.name} className="text-foreground">
                                    <div className="flex items-center gap-2">
                                      {source.domain ? (
                                        <img src={getLogoUrl(source.domain)} alt={source.name} className="w-4 h-4 object-contain flex-shrink-0" />
                                      ) : source.emoji ? (
                                        <span className="text-sm flex-shrink-0">{source.emoji}</span>
                                      ) : null}
                                      <span>{source.name}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {/* Show removable chip only for the currently selected custom source */}
                      {formData.source && customSources.includes(formData.source) && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
                            {formData.source}
                            <button
                              type="button"
                              onClick={() => { removeCustomSource(formData.source); handleChange('source', ''); }}
                              className="hover:text-destructive ml-0.5 leading-none"
                              title={`Remove "${formData.source}" from custom sources`}
                            >×</button>
                          </span>
                        </div>
                      )}
                    </div>

                    {isOtherSource ? (
                      <div className="space-y-2 md:col-span-2 min-w-0">
                        <Label htmlFor="other_source" className="text-foreground break-words">Custom Source</Label>
                        <div className="flex gap-2">
                          <Input
                            id="other_source"
                            placeholder="e.g., My Local Store, Neighborhood Sale"
                            value={formData.source}
                            onChange={(e) => handleChange('source', e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCustomSourceSave(); } }}
                            className="flex-1 text-foreground bg-background"
                            autoFocus
                          />
                          <Button type="button" size="sm" onClick={handleCustomSourceSave} disabled={!formData.source?.trim()}>
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => { setIsOtherSource(false); handleChange('source', ''); }}>
                            Cancel
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">This will be saved to your custom sources list for future use.</p>
                      </div>
                    ) : null}
                     
                     <div className="space-y-2 min-w-0">
                        <Label htmlFor="status" className="text-foreground break-words">Status *</Label>
                        <Select 
                          value={formData.status ?? ''} 
                          onValueChange={(value) => handleChange('status', value)}
                          required
                        >
                            <SelectTrigger id="status" className="w-full text-foreground bg-background">
                              <SelectValue placeholder="Select status"/>
                            </SelectTrigger>
                            <SelectContent className="bg-popover text-popover-foreground">
                                <SelectItem value="available" className="text-foreground">In Stock</SelectItem>
                                <SelectItem value="listed" className="text-foreground">Listed</SelectItem>
                                <SelectItem value="sold" className="text-foreground">Sold</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="category_select" className="text-foreground break-words flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-muted-foreground">
                            <path fill="currentColor" d="M3 3h4v4H3zM10 3h4v4h-4zM17 3h4v4h-4zM3 10h4v4H3zM10 10h4v4h-4zM17 10h4v4h-4zM3 17h4v4H3zM10 17h4v4h-4zM17 17h4v4h-4z"/>
                          </svg>
                          Category
                        </Label>
                        <Select
                            onValueChange={handleCategorySelectChange}
                            value={isOtherCategory ? 'other' : (formData.category ?? '')}
                        >
                            <SelectTrigger id="category_select" className="w-full text-foreground bg-background">
                                <SelectValue placeholder="Select a category">{isOtherCategory && formData.category ? formData.category : (PREDEFINED_CATEGORIES.includes(formData.category) ? formData.category : "Select a category")}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-popover text-popover-foreground">
                                {PREDEFINED_CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat} className="text-foreground">{cat}</SelectItem>
                                ))}
                                <SelectItem value="other" className="text-foreground">Other...</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {isOtherCategory ? (
                        <div className="space-y-2 md:col-span-2 min-w-0">
                            <Label htmlFor="other_category" className="text-foreground break-words">Custom Category</Label>
                            <Input
                                id="other_category"
                                placeholder="e.g., Video Games"
                                value={formData.category}
                                onChange={(e) => handleChange('category', e.target.value)}
                                className="w-full text-foreground bg-background"
                            />
                        </div>
                    ) : null}

                    {/* Brand Field */}
                    <div className="space-y-2 min-w-0">
                      <Label className="text-foreground break-words">Brand</Label>
                      <BrandCombobox
                        value={formData.brand || ''}
                        onChange={(brand) => handleChange('brand', brand)}
                        showAISuggestions={!itemId}
                        itemTitle={formData.item_name || ''}
                        itemCategory={formData.category || ''}
                      />
                    </div>

                    {/* Condition Field */}
                    <div className="space-y-2 min-w-0">
                        <Label htmlFor="condition" className="text-foreground break-words">Condition</Label>
                        <Select
                            value={formData.condition ?? ''}
                            onValueChange={(value) => handleChange('condition', value)}
                        >
                            <SelectTrigger id="condition" className="w-full text-foreground bg-background">
                                <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover text-popover-foreground">
                                {CONDITION_OPTIONS.map(cond => (
                                    <SelectItem key={cond} value={cond} className="text-foreground">{cond}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Smart Size Field — only shows for clothing/shoes/etc. */}
                    <SmartSizeField
                      title={formData.item_name}
                      description={formData.description}
                      category={formData.category}
                      value={formData.size}
                      onChange={(val) => handleChange('size', val)}
                    />


                    <div className="space-y-2 md:col-span-2 min-w-0">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="description" className="text-foreground break-words">Description</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => setDescGenOpen(true)}
                          >
                            <Sparkles className="w-3 h-3" />
                            Generate
                          </Button>
                        </div>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => handleChange('description', e.target.value)}
                          onPaste={(e) => {
                            const pastedText = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
                            if (pastedText) {
                              e.preventDefault();
                              const cleaned = cleanHtmlText(pastedText);
                              handleChange('description', formData.description + (formData.description ? '\n' : '') + cleaned);
                            }
                          }}
                          placeholder="Listing description (this will carry into Crosslist)"
                          rows={5}
                          className="w-full text-foreground bg-background"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2 min-w-0">
                        <Label htmlFor="notes" className="text-foreground break-words">Notes</Label>
                        <Textarea 
                          id="notes" 
                          value={formData.notes} 
                          onChange={(e) => handleChange('notes', e.target.value)}
                          onPaste={(e) => {
                            // Clean HTML from pasted content
                            const pastedText = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
                            if (pastedText) {
                              e.preventDefault();
                              const cleaned = cleanHtmlText(pastedText);
                              handleChange('notes', formData.notes + (formData.notes ? '\n' : '') + cleaned);
                            }
                          }}
                          placeholder="Any additional details..."
                          rows={3}
                          className="w-full text-foreground bg-background"
                        />
                    </div>
                    
                    {/* Mercari Metrics Display (read-only) - only for on_sale/available/listed items */}
                    {itemId && formData.source === 'Mercari' && (formData.mercari_likes > 0 || formData.mercari_views > 0) && (formData.status === 'available' || formData.status === 'listed' || formData.status === 'on_sale') && (
                      <div className="md:col-span-2 space-y-2 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <Label className="text-foreground flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                          </svg>
                          Mercari Performance Metrics
                        </Label>
                        <div className="flex gap-4">
                          {formData.mercari_likes > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-card rounded-md border border-pink-200 dark:border-pink-800">
                              <svg className="w-5 h-5 text-pink-600 dark:text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                              </svg>
                              <div>
                                <div className="text-xs text-muted-foreground">Likes</div>
                                <div className="text-lg font-bold text-pink-600 dark:text-pink-400">{formData.mercari_likes}</div>
                              </div>
                            </div>
                          )}
                          {formData.mercari_views > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-card rounded-md border border-blue-200 dark:border-blue-800">
                              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                              <div>
                                <div className="text-xs text-muted-foreground">Views</div>
                                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formData.mercari_views}</div>
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          These metrics are from your Mercari listing and update when you sync items.
                        </p>
                      </div>
                    )}
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

      <ReceiptScannerDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        onScan={handleReceiptScan}
        isScanning={isReceiptScanning}
      />
      {searchDialogOpen ? (
        <React.Suspense fallback={null}>
          <EnhancedProductSearchDialog
            open={searchDialogOpen}
            onOpenChange={setSearchDialogOpen}
            initialQuery={searchDialogQuery}
            onSelectItem={handleEbayItemSelect}
          />
        </React.Suspense>
      ) : null}
      <ImageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        imageSrc={imageToEdit.url}
        onSave={handleSaveEditedImage}
        fileName="inventory-item-edited.jpg"
        allImages={formData.photos}
        itemId={photoEditorItemId}
        imageIndex={imageToEdit.photoIndex ?? 0}
      />
      <DescriptionGenerator
        open={descGenOpen}
        onOpenChange={setDescGenOpen}
        onSelectDescription={(text) => handleChange('description', text)}
        marketplace="general"
        inputDescription={formData.description}
        title={formData.item_name}
        brand={formData.brand}
        category={formData.category}
        condition={formData.condition}
        itemId={itemId || undefined}
        onApplyTags={async (tagsArray) => {
          // Update form state immediately
          handleChange('tags', tagsArray.join(', '));
          // Also persist to DB if we have an existing item
          if (itemId) {
            await inventoryApi.update(itemId, { listing_keywords: tagsArray });
          }
        }}
        onSelectCategory={(catPath) => {
          // Apply the leaf category to the form
          const parts = catPath.split(' > ');
          handleChange('category', parts[parts.length - 1]);
        }}
      />
    </div>
  );
}
