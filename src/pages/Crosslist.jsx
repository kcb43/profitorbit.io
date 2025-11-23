
import React, { useMemo, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Filter,
  Grid2X2,
  Rows,
  ArrowRight,
  Plus,
  Rocket,
  Search,
  ImagePlus,
  X,
  RefreshCw,
  Save,
  Package,
  Check,
  Palette,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import BulkActionsMenu from "../components/BulkActionsMenu";
import ColorPickerDialog from "../components/ColorPickerDialog";
import imageCompression from "browser-image-compression";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInventoryTags } from "@/hooks/useInventoryTags";
import { useEbayCategoryTreeId, useEbayCategories } from "@/hooks/useEbayCategorySuggestions";

const FACEBOOK_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";

const MERCARI_ICON_URL = "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B";

const EBAY_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg";

const ETSY_ICON_URL = "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B";
const POSHMARK_ICON_URL = "https://cdn.brandfetch.io/idUxsADOAW/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B";

const MARKETPLACES = [
  { id: "ebay",     label: "eBay",     icon: EBAY_ICON_URL },
  { id: "facebook", label: "Facebook", icon: FACEBOOK_ICON_URL },
  { id: "mercari",  label: "Mercari",  icon: MERCARI_ICON_URL  },
  { id: "etsy",     label: "Etsy",     icon: ETSY_ICON_URL },
  { id: "poshmark", label: "Poshmark", icon: POSHMARK_ICON_URL },
];

const STATUS_COLORS = {
  available: "bg-blue-100 text-blue-800",
  listed:    "bg-yellow-100 text-yellow-800",
  sold:      "bg-gray-100 text-gray-800",
};

const STATUS_LABELS = {
  available: "In Stock",
  listed: "Listed",
  sold: "Sold",
};

const TEMPLATE_DISPLAY_NAMES = {
  general: "General",
  ebay: "eBay",
  etsy: "Etsy",
  mercari: "Mercari",
  facebook: "Facebook Marketplace",
};

const GENERAL_TEMPLATE_DEFAULT = {
  photos: [],
  title: "",
  description: "",
  brand: "",
  condition: "",
  color1: "", // Primary Color
  color2: "", // Secondary Color
  color3: "", // Accent Color (optional)
  sku: "",
  zip: "",
  tags: "",
  quantity: "1",
  category: "",
  size: "", // US Size
  packageDetails: "",
  packageWeight: "",
  packageLength: "",
  packageWidth: "",
  packageHeight: "",
  price: "", // Listing Price
  cost: "", // Purchase Price
  customLabels: "", // Will sync to inventory tags
};

const MARKETPLACE_TEMPLATE_DEFAULTS = {
  ebay: {
    inheritGeneral: true,
    color: "",
    categoryId: "",
    categoryName: "",
    shippingMethod: "Calculated",
    shippingCostType: "calculated",
    shippingCost: "",
    handlingTime: "1 business day",
    shipFromCountry: "United States",
    shippingService: "Standard Shipping (3 to 5 business days)",
    shippingLocation: "",
    acceptReturns: true,
    pricingFormat: "fixed",
    duration: "Good 'Til Canceled",
    buyItNowPrice: "",
    allowBestOffer: true,
  },
  etsy: {
    inheritGeneral: true,
    renewalOption: "manual",
    whoMade: "i_did",
    whenMade: "2020s",
    isDigital: false,
    processingTime: "1-3 business days",
    shippingProfile: "",
    tags: "",
  },
  mercari: {
    inheritGeneral: true,
    shippingCarrier: "Mercari Prepaid",
    shippingPrice: "",
    localPickup: false,
    smartPricing: false,
    floorPrice: "",
  },
  facebook: {
    inheritGeneral: true,
    deliveryMethod: "shipping_and_pickup",
    shippingPrice: "",
    localPickup: true,
    meetUpLocation: "",
    allowOffers: true,
  },
};

const createInitialTemplateState = (item) => {
  const general = {
    ...GENERAL_TEMPLATE_DEFAULT,
    photos: item?.image_url ? [{ id: "inventory-photo", preview: item.image_url, fileName: "Inventory photo", fromInventory: true }] : [],
    title: item?.item_name || "",
    description: item?.notes || "",
    brand: item?.brand || "",
    condition: item?.condition || "",
    color1: item?.color1 || "",
    color2: item?.color2 || "",
    color3: item?.color3 || "",
    sku: item?.sku || "",
    zip: item?.zip_code || "",
    tags: item?.tags || item?.category || "",
    quantity: item?.quantity != null ? String(item.quantity) : "1",
    category: item?.category || "",
    size: item?.size || "",
    packageDetails: item?.package_details || "",
    packageWeight: item?.package_weight || "",
    packageLength: item?.package_length || "",
    packageWidth: item?.package_width || "",
    packageHeight: item?.package_height || "",
    price: item?.listing_price != null ? String(item.listing_price) : "",
    cost: item?.purchase_price != null ? String(item.purchase_price) : "",
    customLabels: item?.custom_labels || "",
  };

  return {
    general,
    ebay: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.ebay,
      buyItNowPrice: general.price,
      shippingLocation: general.zip,
    },
    etsy: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.etsy,
      tags: general.tags,
    },
    mercari: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.mercari,
      shippingPrice: general.price ? (Number(general.price) >= 100 ? "Free" : "Buyer pays") : "",
    },
    facebook: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.facebook,
      meetUpLocation: general.zip ? `Meet near ${general.zip}` : "",
      shippingPrice: general.price ? (Number(general.price) >= 75 ? "Free shipping" : "") : "",
    },
  };
};

const renderMarketplaceIcon = (marketplace, sizeClass = "w-4 h-4") => {
  if (typeof marketplace.icon === "string" && marketplace.icon.startsWith("http")) {
    return (
      <img
        src={marketplace.icon}
        alt={`${marketplace.label} icon`}
        className={`${sizeClass} object-contain`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center ${sizeClass} text-xs leading-none`}
    >
      {marketplace.icon}
    </span>
  );
};

export default function Crosslist() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addTag } = useInventoryTags();
  const [layout, setLayout] = useState("rows");
  const [q, setQ] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTargets, setComposerTargets] = useState([]);
  const [activeMkts, setActiveMkts] = useState([]); // Start with no marketplaces selected
  const [templateForms, setTemplateForms] = useState(() => createInitialTemplateState());
  const [activeForm, setActiveForm] = useState("general"); // "general" | "ebay" | "etsy" | "mercari" | "facebook"
  const [isSaving, setIsSaving] = useState(false);
  const [bulkSelectedItems, setBulkSelectedItems] = useState([]); // Items selected for bulk crosslisting
  const [currentEditingItemId, setCurrentEditingItemId] = useState(null); // Currently editing item ID in bulk mode
  const [packageDetailsDialogOpen, setPackageDetailsDialogOpen] = useState(false);
  const [brandIsCustom, setBrandIsCustom] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [editingColorField, setEditingColorField] = useState(null); // "color1", "color2", or "ebay.color"
  const [selectedCategoryPath, setSelectedCategoryPath] = useState([]); // Array of {categoryId, categoryName} for the selected path
  const photoInputRef = React.useRef(null);
  
  // Get eBay category tree ID
  const { data: categoryTreeData, isLoading: isLoadingCategoryTree } = useEbayCategoryTreeId('EBAY_US');
  const categoryTreeId = categoryTreeData?.categoryTreeId;
  
  // Get the current level of categories based on selected path
  const currentCategoryId = selectedCategoryPath.length > 0 
    ? selectedCategoryPath[selectedCategoryPath.length - 1].categoryId 
    : '0';
  
  const { data: categoriesData, isLoading: isLoadingCategories, error: categoriesError } = useEbayCategories(
    categoryTreeId,
    currentCategoryId,
    activeForm === "ebay" && composerOpen && !!categoryTreeId
  );
  
  // Get child categories from the current level
  // The response structure is: { categorySubtreeNode: {...}, categoryTreeId: "...", categoryTreeVersion: "..." }
  // When category_id=0, categorySubtreeNode should have childCategoryTreeNodes with top-level categories
  const categorySubtreeNode = categoriesData?.categorySubtreeNode;
  const currentCategories = categorySubtreeNode?.childCategoryTreeNodes || [];
  
  // Debug logging
  React.useEffect(() => {
    if (activeForm === "ebay" && composerOpen && categoriesData) {
      console.log('Categories Data:', categoriesData);
      console.log('Category Subtree Node:', categorySubtreeNode);
      console.log('Current Categories:', currentCategories);
      console.log('Current Category ID:', currentCategoryId);
    }
  }, [activeForm, composerOpen, categoriesData, categorySubtreeNode, currentCategories, currentCategoryId]);
  
  // Sort categories alphabetically
  const sortedCategories = [...currentCategories].sort((a, b) => {
    const nameA = a.category?.categoryName || '';
    const nameB = b.category?.categoryName || '';
    return nameA.localeCompare(nameB);
  });

  // Popular brands list (sorted alphabetically)
  const POPULAR_BRANDS = [
    "Adidas", "Alo Yoga", "Apple", "Arc'teryx", "ASICS", "Athleta",
    "Beats", "Bose", "Brooks", "Burberry",
    "Calvin Klein", "Carhartt", "Chanel", "Coach", "Columbia", "Converse",
    "Dickies", "Dyson",
    "Fabletics", "Fila", "Forever 21",
    "Gap", "Gucci", "Gymshark",
    "Hasbro", "H&M", "Hugo Boss", "Hydro Flask",
    "Instant Pot",
    "JBL", "Jordan",
    "Kate Spade", "KitchenAid",
    "Lego", "Levi's", "Louis Vuitton", "Lululemon",
    "Mattel", "Michael Kors",
    "New Balance", "Nike", "Ninja", "Nintendo",
    "Patagonia", "Prada", "Puma",
    "Ralph Lauren", "REI", "Reebok",
    "Samsung", "Sony", "Stanley",
    "The North Face", "Tommy Hilfiger", "Tory Burch",
    "Under Armour", "Uniqlo",
    "Vans", "Versace",
    "Wrangler",
    "Yeti",
    "Zara",
  ];

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: () => base44.entities.InventoryItem.list("-purchase_date"),
    initialData: [],
  });

  const crosslistableItems = useMemo(
    () => inventory.filter((item) => item.status !== "sold"),
    [inventory]
  );

  // Compute which marketplaces an item is actually crosslisted to
  // Items are only considered crosslisted when they've been explicitly listed on that marketplace
  // "Listed" status from Add Inventory page alone doesn't count - need actual crosslisting
  const computeListingState = (item) => {
    // For now, check if item has crosslisting data
    // In the future, this will check actual crosslisting records/relationships
    // Until we have crosslisting API integration, all icons will be grayed out by default
    const hasCrosslistingData = item.crosslisted_marketplaces && Array.isArray(item.crosslisted_marketplaces);
    
    if (!hasCrosslistingData) {
      // No crosslisting data - all marketplaces grayed out
      // Items that are just "in stock" or have "listed" status but haven't been crosslisted
      // should show all grayed out icons
    return {
        ebay:     false,
      facebook: false,
      mercari:  false,
      etsy:     false,
      poshmark: false,
      };
    }
    
    // Check which marketplaces are in the crosslisting array
    const marketplaces = item.crosslisted_marketplaces;
    return {
      ebay:     marketplaces.includes("ebay"),
      facebook: marketplaces.includes("facebook_marketplace") || marketplaces.includes("facebook"),
      mercari:  marketplaces.includes("mercari"),
      etsy:     marketplaces.includes("etsy"),
      poshmark: marketplaces.includes("poshmark"),
    };
  };

  const populateTemplates = React.useCallback(
    (item) => {
      setTemplateForms(createInitialTemplateState(item));
      setActiveForm("general");
      // Check if brand is custom (not in popular brands list)
      const brand = item?.brand || "";
      if (brand && !POPULAR_BRANDS.includes(brand)) {
        setBrandIsCustom(true);
      } else {
        setBrandIsCustom(false);
      }
    },
    []
  );

  const handleGeneralChange = (field, value) => {
    setTemplateForms((prev) => {
      const general = { ...prev.general, [field]: value };
      const next = { ...prev, general };

      if (field === "price") {
        if (next.ebay?.inheritGeneral) {
          next.ebay = { ...next.ebay, buyItNowPrice: value };
        }
      }

      if (field === "zip") {
        if (next.ebay?.inheritGeneral) {
          next.ebay = { ...next.ebay, shippingLocation: value };
        }
        if (next.facebook?.inheritGeneral) {
          next.facebook = {
            ...next.facebook,
            meetUpLocation: value ? `Meet near ${value}` : "",
          };
        }
      }

      if (field === "tags" && next.etsy?.inheritGeneral) {
        next.etsy = { ...next.etsy, tags: value };
      }

      return next;
    });
  };

  const handleMarketplaceChange = (marketplace, field, value) => {
    setTemplateForms((prev) => ({
      ...prev,
      [marketplace]: {
        ...prev[marketplace],
        [field]: value,
      },
    }));
  };

  const handleToggleInherit = (marketplace, checked) => {
    setTemplateForms((prev) => {
      const updated = {
        ...prev[marketplace],
        inheritGeneral: checked,
      };

      if (checked) {
        if (marketplace === "ebay") {
          updated.buyItNowPrice = prev.general.price;
          updated.shippingLocation = prev.general.zip;
        }
        if (marketplace === "etsy") {
          updated.tags = prev.general.tags;
        }
        if (marketplace === "mercari") {
          updated.shippingPrice = prev.general.price
            ? Number(prev.general.price) >= 100
              ? "Free"
              : "Buyer pays"
            : "";
        }
        if (marketplace === "facebook") {
          updated.meetUpLocation = prev.general.zip ? `Meet near ${prev.general.zip}` : "";
        }
      }

      return {
        ...prev,
        [marketplace]: updated,
      };
    });
  };

  const handleReconnect = (templateKey) => {
    const label = TEMPLATE_DISPLAY_NAMES[templateKey] || "Marketplace";
    toast({
      title: `${label} reconnected`,
      description: "We'll refresh the integration and pull the latest account settings.",
    });
  };

  const handleTemplateSave = (templateKey) => {
    const label = TEMPLATE_DISPLAY_NAMES[templateKey] || "Template";
    toast({
      title: `${label} template saved`,
      description: "Your preferences will be used the next time you compose a listing.",
    });
  };

  // Validate required fields for eBay form
  const validateEbayForm = () => {
    const errors = [];
    
    // Check eBay-specific required fields
    if (!ebayForm.handlingTime) errors.push("Handling Time");
    if (!ebayForm.shippingService) errors.push("Shipping Service");
    if (!ebayForm.shippingCostType) errors.push("Shipping Cost Type");
    if (!ebayForm.shippingMethod) errors.push("Shipping Method");
    if (!ebayForm.pricingFormat) errors.push("Pricing Format");
    if (!ebayForm.duration) errors.push("Duration");
    if (!ebayForm.buyItNowPrice) errors.push("Buy It Now Price");
    if (!ebayForm.color) errors.push("Color");
    if (!ebayForm.categoryId) errors.push("Category");
    if (!ebayForm.shippingCost) errors.push("Shipping Cost");
    
    // Check general form required fields (needed for eBay listing)
    if (!generalForm.title) errors.push("Title");
    if (!generalForm.brand) errors.push("Brand");
    if (!generalForm.quantity) errors.push("Quantity");
    
    return errors;
  };

  const handleListOnMarketplace = (marketplace) => {
    if (marketplace === "ebay") {
      const errors = validateEbayForm();
      if (errors.length > 0) {
        toast({
          title: "Missing required fields",
          description: `Please fill in: ${errors.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    // TODO: Implement actual listing API call
    toast({
      title: `List on ${TEMPLATE_DISPLAY_NAMES[marketplace] || marketplace}`,
      description: "Listing functionality coming soon!",
    });
  };

  const MAX_PHOTOS = 25;
  const MAX_FILE_SIZE_MB = 15;
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const handlePhotoUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingPhotos(true);

    try {
      const currentPhotoCount = generalForm.photos?.length || 0;
      const remainingSlots = MAX_PHOTOS - currentPhotoCount;
      
      if (remainingSlots <= 0) {
        toast({
          title: "Photo limit reached",
          description: `Maximum ${MAX_PHOTOS} photos allowed. Please remove some photos first.`,
          variant: "destructive",
        });
        return;
      }

      const filesArray = Array.from(files).slice(0, remainingSlots);
      
      // Validate file sizes and compress if needed
      const processedPhotos = [];
      
      for (const file of filesArray) {
        // Check file size (15MB = 15 * 1024 * 1024 bytes)
        const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
        
        if (file.size > maxSizeBytes) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit. Compressing...`,
          });
        }

        // Compress image if it's larger than 1MB
        let processedFile = file;
        if (file.size > 1024 * 1024) {
          try {
            processedFile = await imageCompression(file, {
              maxSizeMB: MAX_FILE_SIZE_MB,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            });
          } catch (error) {
            console.error("Error compressing image:", error);
            toast({
              title: "Compression failed",
              description: `Skipping ${file.name}. Please try a different image.`,
              variant: "destructive",
            });
            continue;
          }
        }

        processedPhotos.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          preview: URL.createObjectURL(processedFile),
      fileName: file.name,
          file: processedFile, // Store the actual file for upload
      fromInventory: false,
        });
      }

      if (processedPhotos.length === 0) {
        return;
      }

    setTemplateForms((prev) => ({
      ...prev,
      general: {
        ...prev.general,
          photos: [...(prev.general.photos || []), ...processedPhotos],
      },
    }));

      if (processedPhotos.length < filesArray.length) {
        toast({
          title: "Some photos skipped",
          description: `${processedPhotos.length} of ${filesArray.length} photos added.`,
        });
      }

      if (remainingSlots - processedPhotos.length <= 0) {
        toast({
          title: "Photo limit reached",
          description: `You've reached the maximum of ${MAX_PHOTOS} photos.`,
        });
      }
    } catch (error) {
      console.error("Error processing photos:", error);
      toast({
        title: "Upload error",
        description: "Failed to process some photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhotos(false);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
      }
    }
  };

  const handlePhotoRemove = (photoId) => {
    setTemplateForms((prev) => {
      const targetPhoto = prev.general.photos.find((photo) => photo.id === photoId);
      if (targetPhoto && !targetPhoto.fromInventory && targetPhoto.preview.startsWith("blob:")) {
        URL.revokeObjectURL(targetPhoto.preview);
      }
      const general = {
        ...prev.general,
        photos: prev.general.photos.filter((photo) => photo.id !== photoId),
      };
      return {
        ...prev,
        general,
      };
    });
  };

  const filtered = useMemo(() => {
    return crosslistableItems.filter((it) => {
      // Text search filter
      const matchesQ =
        !q ||
        it.item_name.toLowerCase().includes(q.toLowerCase()) ||
        it.category?.toLowerCase().includes(q.toLowerCase()) ||
        it.source?.toLowerCase().includes(q.toLowerCase());
      if (!matchesQ) return false;

      // Listing state filter (all/listed/unlisted)
      const map = computeListingState(it);
      const anyListed = Object.values(map).some(Boolean);
      
      if (platformFilter === "all") {
        // Continue to marketplace filter
      } else if (platformFilter === "listed") {
        if (!anyListed) return false;
      } else if (platformFilter === "unlisted") {
        if (anyListed) return false;
      }

      // Marketplace filter
      if (activeMkts.length === 0) {
        // No marketplaces selected - show all items
        return true;
      }

      // Map marketplace IDs to the keys used in computeListingState
      const marketplaceMap = {
        ebay: "ebay",
        facebook: "facebook",
        mercari: "mercari",
        etsy: "etsy",
        poshmark: "poshmark",
      };

      if (activeMkts.length === MARKETPLACES.length) {
        // All marketplaces selected - item must be crosslisted to ALL marketplaces
        const itemIsListedOnAllMkts = activeMkts.every((mktId) => {
          return map[marketplaceMap[mktId]] === true;
        });
        return itemIsListedOnAllMkts;
      }

      // Some marketplaces selected - item must be crosslisted to at least one selected marketplace
      const itemIsListedOnSelectedMkts = activeMkts.some((mktId) => {
        return map[marketplaceMap[mktId]] === true;
      });

      return itemIsListedOnSelectedMkts;
    });
  }, [crosslistableItems, q, platformFilter, activeMkts]);

  const toggleSelect = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = (checked) =>
    setSelected(checked ? filtered.map((x) => x.id) : []);

  const toggleMarketActive = (mkt) =>
    setActiveMkts((prev) => (prev.includes(mkt) ? prev.filter((x) => x !== mkt) : [...prev, mkt]));

  const openComposer = (ids, autoSelect = true) => {
    const itemIds = ids && ids.length > 0 ? ids : selected.length > 0 ? selected : [];
    
    // Build URL with item IDs
    const params = new URLSearchParams();
    if (itemIds.length > 0) {
      // For multiple items, use comma-separated IDs
      params.set('ids', itemIds.join(','));
    }
    
    // Navigate to the composer page
    navigate(createPageUrl(`CrosslistComposer?${params.toString()}`));
  };

  // Handle switching between items in bulk mode
  const switchToItem = (itemId) => {
    const item = bulkSelectedItems.find(it => it.id === itemId);
    if (item) {
      setCurrentEditingItemId(itemId);
      populateTemplates(item);
      setActiveForm("general"); // Reset to general form when switching items
      setSelectedCategoryPath([]); // Reset category path when switching items
    }
  };

  const generalForm = templateForms.general;
  const ebayForm = templateForms.ebay;
  const etsyForm = templateForms.etsy;
  const mercariForm = templateForms.mercari;
  const facebookForm = templateForms.facebook;

  // Helper to get hex code from color name or return hex if already hex
  const getColorHex = (colorValue) => {
    if (!colorValue) return null;
    // If it's already a hex code, return it
    if (colorValue.startsWith("#")) return colorValue;
    // Look up hex from common colors
    const color = COMMON_COLORS.find(c => c.name.toLowerCase() === colorValue.toLowerCase());
    return color ? color.hex : null;
  };

  // Helper to get color name from hex or return the value if it's a name
  const getColorName = (colorValue) => {
    if (!colorValue) return "Select color";
    if (colorValue.startsWith("#")) {
      // If it's a hex, try to find the name, otherwise show the hex
      const color = COMMON_COLORS.find(c => c.hex.toLowerCase() === colorValue.toLowerCase());
      return color ? color.name : colorValue;
    }
    return colorValue;
  };

  // Limited color palette - matches ColorPickerDialog
  const COMMON_COLORS = [
    { name: "Black", hex: "#000000" },
    { name: "Beige", hex: "#F5F5DC" },
    { name: "Blue", hex: "#0000FF" },
    { name: "Brown", hex: "#8B4513" },
    { name: "Gold", hex: "#FFD700" },
    { name: "Grey", hex: "#808080" },
    { name: "Green", hex: "#008000" },
    { name: "Orange", hex: "#FFA500" },
    { name: "Pink", hex: "#FFC0CB" },
    { name: "Purple", hex: "#800080" },
    { name: "Red", hex: "#FF0000" },
    { name: "Silver", hex: "#C0C0C0" },
    { name: "Yellow", hex: "#FFFF00" },
    { name: "White", hex: "#FFFFFF" },
  ];

  const handleColorSelect = (colorName, colorHex) => {
    if (editingColorField) {
      // If it's a hex code (custom color), store the hex, otherwise store the name
      const valueToStore = colorName.startsWith("#") ? colorName : colorName;
      handleGeneralChange(editingColorField, valueToStore);
      setEditingColorField(null);
      setColorPickerOpen(false);
    }
  };

  const openColorPicker = (field) => {
    setEditingColorField(field);
    setColorPickerOpen(true);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground break-words">Crosslist</h1>
            <p className="text-sm text-muted-foreground break-words">
              Start crosslisting your inventory in seconds. Bulk tools now; marketplace APIs later.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setLayout((l) => (l === "rows" ? "grid" : "rows"))}
              className="hidden sm:inline-flex whitespace-nowrap"
            >
              {layout === "rows" ? <Grid2X2 className="w-4 h-4 mr-2" /> : <Rows className="w-4 h-4 mr-2" />}
              {layout === "rows" ? "Grid View" : "Row View"}
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gray-800 dark:bg-gray-800">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters & Marketplaces
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">
              <div className="relative min-w-0">
                <Label htmlFor="q" className="text-xs mb-1.5 block">Search</Label>
                <Search className="absolute left-2.5 top-9 w-4 h-4 text-muted-foreground" />
                <Input
                  id="q"
                  placeholder="Item name, category, source…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-8 w-full"
                />
              </div>

              <div className="min-w-0">
                <Label className="text-xs mb-1.5 block">Status</Label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="listed">Listed somewhere</SelectItem>
                    <SelectItem value="unlisted">Not listed anywhere</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0">
                <Label className="text-xs mb-1.5 block">Marketplaces</Label>
                <div className="flex flex-wrap gap-2">
                  {MARKETPLACES.map((m) => {
                    const active = activeMkts.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMarketActive(m.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition whitespace-nowrap
                          ${active
                            ? "bg-foreground text-background dark:bg-foreground dark:text-background"
                            : "bg-muted/70 hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/60 text-foreground"
                          }`}
                        aria-pressed={active}
                      >
                        <span aria-hidden="true" className="flex items-center justify-center">
                          {renderMarketplaceIcon(m, "w-4 h-4")}
                        </span>
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {activeMkts.length === 0
                    ? "Showing all items. Select marketplaces to filter by crosslisting status."
                    : activeMkts.length === MARKETPLACES.length
                    ? "Showing items crosslisted to ALL marketplaces."
                    : `Showing items crosslisted to ${activeMkts.length} marketplace${activeMkts.length === 1 ? "" : "s"}.`
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between pt-2 gap-3 min-w-0">
              <div className="text-sm text-muted-foreground order-2 md:order-1">
                Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
                <span className="font-medium text-foreground">{crosslistableItems.length}</span> items
              </div>
              <div className="flex flex-col md:flex-row gap-2 flex-wrap order-1 md:order-2 md:ml-auto">
                <Button
                  variant="outline"
                  onClick={() => toggleAll(selected.length !== filtered.length)}
                  className="whitespace-nowrap w-auto"
                >
                  {selected.length === filtered.length ? "Unselect All" : "Select All"}
                </Button>
                <BulkActionsMenu 
                  selectedItems={selected}
                  onActionComplete={() => setSelected([])}
                />
                <Button
                  onClick={() => {
                    if (selected.length > 0) {
                      openComposer(selected);
                    } else {
                      openComposer([]);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 whitespace-nowrap w-auto"
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  {selected.length > 0 ? `Bulk Crosslist (${selected.length})` : "Crosslist"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No items match your filters.
          </div>
        ) : layout === "rows" ? (
          <div className="divide-y rounded-md border bg-card overflow-x-auto">
            <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-muted-foreground">
              <div className="col-span-6">Item</div>
              <div className="col-span-2">Purchase</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {filtered.map((it) => {
              const map = computeListingState(it);
              return (
                <div key={it.id} className="grid grid-cols-12 gap-4 px-4 py-4 items-center min-w-0">
                  <div className="col-span-12 sm:col-span-6 flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={selected.includes(it.id)}
                      onCheckedChange={() => toggleSelect(it.id)}
                      className="!h-6 !w-6 !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 flex-shrink-0 [&_svg]:!h-6 [&_svg]:!w-6"
                    />
                    <img
                      src={it.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                      alt={it.item_name}
                      className="w-14 h-14 md:w-36 md:h-36 rounded-md object-cover flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate break-words">{it.item_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {it.category || "—"} • {it.source || "—"}
                      </div>

                      <div className="flex flex-wrap gap-1 mt-1">
                        {MARKETPLACES.map((m) => {
                          const isListed = map[m.id];
                          return (
                            <div
                              key={m.id}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded border transition-all ${
                                isListed
                                  ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 opacity-100"
                                  : "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-700 opacity-40"
                              }`}
                              title={isListed ? `Listed on ${m.label}` : `Not listed on ${m.label}`}
                            >
                              {renderMarketplaceIcon(m, "w-4 h-4")}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-2 text-sm min-w-0">
                    <div className="text-foreground font-medium">${(it.purchase_price || 0).toFixed(2)}</div>
                    <div className="text-muted-foreground">
                      {it.purchase_date ? format(parseISO(it.purchase_date), "MMM d, yyyy") : "—"}
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <Badge className={`${STATUS_COLORS[it.status] || STATUS_COLORS.available}`}>
                      {STATUS_LABELS[it.status] || STATUS_LABELS.available}
                    </Badge>
                  </div>

                  <div className="col-span-12 sm:col-span-2 flex sm:justify-end gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => openComposer([it.id], false)}
                      className="w-full sm:w-auto whitespace-nowrap"
                    >
                      Crosslist
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => navigate(createPageUrl(`AddInventoryItem?id=${it.id}`))}
                      className="w-full sm:w-auto whitespace-nowrap"
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((it) => {
              const map = computeListingState(it);
              return (
                <Card key={it.id} className="overflow-hidden">
                  <div className="relative">
                    <img
                      src={it.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                      alt={it.item_name}
                      className="aspect-square w-full object-cover md:h-[38rem]"
                    />
                    <div className="absolute top-2 left-2">
                      <Checkbox
                        checked={selected.includes(it.id)}
                        onCheckedChange={() => toggleSelect(it.id)}
                        className="!h-6 !w-6 !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 [&_svg]:!h-6 [&_svg]:!w-6"
                      />
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <div className="font-semibold text-sm line-clamp-2 break-words">{it.item_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{it.category || "—"}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {MARKETPLACES.map((m) => {
                        const isListed = map[m.id];
                        return (
                          <div
                            key={m.id}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded border transition-all ${
                              isListed
                                ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 opacity-100"
                                : "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-700 opacity-40"
                            }`}
                            title={isListed ? `Listed on ${m.label}` : `Not listed on ${m.label}`}
                          >
                            {renderMarketplaceIcon(m, "w-4 h-4")}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="w-full whitespace-nowrap" onClick={() => openComposer([it.id], false)}>
                        Crosslist
                      </Button>
                      <Button size="sm" variant="outline" className="w-full whitespace-nowrap" onClick={() => navigate(createPageUrl(`AddInventoryItem?id=${it.id}`))}>
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Sheet removed - composer is now a separate page */}
    </div>
  );
}
