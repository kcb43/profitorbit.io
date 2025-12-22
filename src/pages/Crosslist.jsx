
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
import { OptimizedImage } from "@/components/OptimizedImage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInventoryTags } from "@/hooks/useInventoryTags";
import { useEbayCategoryTreeId, useEbayCategories } from "@/hooks/useEbayCategorySuggestions";
import { crosslistingEngine } from "@/services/CrosslistingEngine";
import { UnifiedListingForm } from "@/components/UnifiedListingForm";
import { ExternalLink, List } from "lucide-react";
import { listingJobsApi, platformApi } from "@/api/listingApiClient";
import { PlatformConnectionStatus } from "@/components/PlatformConnectionStatus";
import { ListingJobTracker } from "@/components/ListingJobTracker";

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
  available: "bg-blue-100 text-blue-600 border border-blue-200 hover:bg-blue-100",
  listed:    "bg-green-100 text-green-600 border border-green-200 hover:bg-green-100",
  sold:      "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-100",
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
  const [layout, setLayout] = useState("grid");
  const [isMobile, setIsMobile] = useState(false);
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
  
  // Crosslisting state
  const [marketplaceListings, setMarketplaceListings] = useState({});
  const [showListDialog, setShowListDialog] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);
  const [selectedMarketplaces, setSelectedMarketplaces] = useState([]);
  const [crosslistLoading, setCrosslistLoading] = useState(false);
  
  // New automation system state
  const [activeJobs, setActiveJobs] = useState({}); // { itemId: jobId }
  const [platformConnections, setPlatformConnections] = useState([]);
  const [showPlatformConnect, setShowPlatformConnect] = useState(false);
  
  // Force grid view on mobile screens (md breakpoint is 768px)
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && layout !== "grid") {
        setLayout("grid");
      }
    };
    
    // Check on mount and resize
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    return () => window.removeEventListener("resize", checkMobile);
  }, [layout]);
  
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

  const { data: inventory = [], isLoading, refetch: refetchInventory } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: () => base44.entities.InventoryItem.list("-purchase_date"),
    initialData: [],
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale so it refetches
  });

  const crosslistableItems = useMemo(
    () => inventory.filter((item) => item.status !== "sold" && !item.deleted_at),
    [inventory]
  );

  // Compute which marketplaces an item is actually crosslisted to
  // Checks: marketplace listings, item listing IDs, and marketplace_listings object
  const computeListingState = (item) => {
    const listings = getItemListings(item.id);
    const activeListings = listings.filter(l => l.status === 'active');
    
    // Check multiple sources for each marketplace
    const checkListed = (marketplace) => {
      // Check marketplace listing records
      if (activeListings.some(l => l.marketplace === marketplace)) {
        console.log(`✓ ${marketplace} listed (from marketplace records):`, item.item_name);
        return true;
      }
      
      // Check direct listing ID field (e.g., ebay_listing_id)
      const listingIdField = `${marketplace}_listing_id`;
      if (item[listingIdField] && String(item[listingIdField]).trim()) {
        console.log(`✓ ${marketplace} listed (from ${listingIdField}):`, item[listingIdField], item.item_name);
        return true;
      }
      
      // Check marketplace_listings object (e.g., marketplace_listings.ebay)
      if (item.marketplace_listings?.[marketplace]?.listing_id) {
        console.log(`✓ ${marketplace} listed (from marketplace_listings object):`, item.marketplace_listings[marketplace].listing_id, item.item_name);
        return true;
      }
      
      // Check if status is 'listed' and this is the primary marketplace
      if (item.status === 'listed' && item[listingIdField]) {
        console.log(`✓ ${marketplace} listed (status + listing ID):`, item[listingIdField], item.item_name);
        return true;
      }
      
      return false;
    };
    
    const state = {
      ebay:     checkListed('ebay'),
      facebook: checkListed('facebook'),
      mercari:  checkListed('mercari'),
      etsy:     checkListed('etsy'),
      poshmark: checkListed('poshmark'),
    };
    
    // Log item details if it has listed status but no listings detected
    if (item.status === 'listed' && !Object.values(state).some(Boolean)) {
      console.warn('⚠️ Item marked as listed but no marketplace detected:', {
        itemName: item.item_name,
        itemId: item.id,
        status: item.status,
        ebay_listing_id: item.ebay_listing_id,
        facebook_listing_id: item.facebook_listing_id,
        marketplace_listings: item.marketplace_listings,
        availableFields: Object.keys(item)
      });
    }
    
    return state;
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

  // Check if Chrome extension API is available
  const isChromeExtensionAvailable = () => {
    return typeof chrome !== 'undefined' && 
           chrome.runtime && 
           typeof chrome.runtime.sendMessage === 'function';
  };

  // Build listing object from form data for Facebook Marketplace
  const buildFacebookListingData = async () => {
    const title = facebookForm.title || generalForm.title || '';
    const description = facebookForm.description || generalForm.description || '';
    const price = facebookForm.price || generalForm.price || '';
    
    // Get photo URLs - handle blob URLs by converting to data URLs
    const photos = generalForm.photos || [];
    const imageUrls = [];
    
    for (const photo of photos) {
      let imageUrl = photo.preview || photo.imageUrl || photo;
      
      // If it's a blob URL, try to convert to data URL for the extension
      if (typeof imageUrl === 'string' && imageUrl.startsWith('blob:')) {
        try {
          // For blob URLs, we can't directly convert, but we can pass the File object
          // The extension will need to handle blob URLs or we could convert to data URL here
          // For now, we'll skip blob URLs and only send valid HTTP/HTTPS URLs
          if (photo.file) {
            // Extension might need to handle files differently
            // For now, skip blob URLs as they won't work cross-tab
            console.warn('Blob URL detected, skipping. Upload photos first to get proper URLs.');
            continue;
          }
        } catch (error) {
          console.error('Error processing photo:', error);
          continue;
        }
      } else if (typeof imageUrl === 'string' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        // Valid HTTP/HTTPS URL - use it
        imageUrls.push(imageUrl);
      }
    }

    return {
      title,
      description,
      price: parseFloat(price) || 0,
      images: imageUrls,
      location: generalForm.zip || facebookForm.meetUpLocation || '',
      category: generalForm.category || '',
      condition: generalForm.condition || '',
      brand: generalForm.brand || '',
      // Add any other Facebook-specific fields
      deliveryMethod: facebookForm.deliveryMethod || 'shipping_and_pickup',
      shippingPrice: facebookForm.shippingPrice || '',
      localPickup: facebookForm.localPickup !== undefined ? facebookForm.localPickup : true,
      allowOffers: facebookForm.allowOffers !== undefined ? facebookForm.allowOffers : true,
    };
  };

  // Send listing data to Chrome extension for autofill
  const sendToExtension = async () => {
    // Build listing data from form
    const listing = await buildFacebookListingData();
    
    if (!listing) return;

    chrome.runtime.sendMessage(
      "dglckcnjkpikbnoeigncbfpjajjfangm",
      {
        type: "START_FACEBOOK_AUTOFILL",
        payload: listing, // your listing object
      },
      (response) => {
        if (chrome.runtime.lastError) {
          alert("Extension not detected. Please make sure it is installed.");
        } else {
          alert("Listing sent! Open Facebook Marketplace to autofill.");
        }
      }
    );
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
    
    if (marketplace === "facebook") {
      // For Facebook, use Chrome extension autofill
      sendToExtension();
      return;
    }
    
    // TODO: Implement actual listing API call for other marketplaces
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

  // Load marketplace listings for all items
  useEffect(() => {
    const loadListings = async () => {
      const listingsMap = {};
      for (const item of inventory) {
        try {
          const listings = await crosslistingEngine.getMarketplaceListings(item.id);
          listingsMap[item.id] = listings;
        } catch (error) {
          console.error(`Error loading listings for item ${item.id}:`, error);
          listingsMap[item.id] = [];
        }
      }
      setMarketplaceListings(listingsMap);
    };

    if (inventory.length > 0) {
      loadListings();
    }
    
    // Also refresh when window regains focus (user comes back from CrosslistComposer)
    const handleFocus = () => {
      refetchInventory(); // Refetch inventory data
      if (inventory.length > 0) {
        loadListings(); // Refetch marketplace listings
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [inventory, refetchInventory]);

  const getItemListings = (itemId) => {
    return marketplaceListings[itemId] || [];
  };

  const getListingStatus = (itemId, marketplace) => {
    const listings = getItemListings(itemId);
    const listing = listings.find(l => l.marketplace === marketplace);
    if (!listing) return 'not_listed';
    return listing.status;
  };

  // Load platform connection status
  useEffect(() => {
    const loadPlatformStatus = async () => {
      try {
        const status = await platformApi.getStatus();
        setPlatformConnections(status);
      } catch (error) {
        console.error('Error loading platform status:', error);
      }
    };
    loadPlatformStatus();
    // Refresh every 30 seconds
    const interval = setInterval(loadPlatformStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isPlatformConnected = (platformId) => {
    const platform = platformConnections.find((p) => p.platform === platformId);
    return platform?.status === 'connected';
  };

  const handleListOnMarketplaceItem = async (itemId, marketplace) => {
    // Check if platform is connected
    if (!isPlatformConnected(marketplace)) {
      toast({
        title: 'Platform Not Connected',
        description: `Please connect your ${marketplace} account first using the Chrome extension.`,
        variant: 'destructive',
      });
      setShowPlatformConnect(true);
      return;
    }

    // Only support Mercari and Facebook for now (automation system)
    if (!['mercari', 'facebook'].includes(marketplace)) {
      // Fallback to old system for other platforms
      setCrosslistLoading(true);
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
        setCrosslistLoading(false);
      }
      return;
    }

    // Use new automation system for Mercari and Facebook
    setCrosslistLoading(true);
    try {
      // Get inventory item
      const inventoryItem = inventory.find((item) => item.id === itemId);
      if (!inventoryItem) {
        throw new Error('Inventory item not found');
      }

      // Prepare payload from inventory item
      const payload = {
        title: inventoryItem.item_name || '',
        description: inventoryItem.notes || inventoryItem.item_name || '',
        price: inventoryItem.listing_price || inventoryItem.purchase_price || '0',
        category: inventoryItem.category || '',
        condition: inventoryItem.condition || '',
        images: inventoryItem.image_url ? [inventoryItem.image_url] : [],
      };

      // Create listing job
      const result = await listingJobsApi.createJob(itemId, [marketplace], payload);

      // Track the job
      setActiveJobs((prev) => ({
        ...prev,
        [itemId]: result.jobId,
      }));

      toast({
        title: 'Listing Job Created',
        description: `Your item is being listed on ${marketplace}. Check status below.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to Create Listing Job',
        description: error.message || `Failed to start listing on ${marketplace}.`,
        variant: 'destructive',
      });
    } finally {
      setCrosslistLoading(false);
    }
  };

  const handleJobComplete = (job) => {
    // Remove from active jobs
    setActiveJobs((prev) => {
      const newJobs = { ...prev };
      Object.keys(newJobs).forEach((itemId) => {
        if (newJobs[itemId] === job.id) {
          delete newJobs[itemId];
        }
      });
      return newJobs;
    });

    // Show success message
    if (job.status === 'completed' && job.result) {
      const platforms = Object.keys(job.result).filter(
        (p) => job.result[p].success
      );
      toast({
        title: 'Listing Complete',
        description: `Successfully listed on ${platforms.join(', ')}`,
      });

      // Refresh inventory
      queryClient.invalidateQueries(['inventoryItems']);
    }
  };

  const handleDelistFromMarketplace = async (itemId, listingId, marketplace) => {
    setCrosslistLoading(true);
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
      setCrosslistLoading(false);
    }
  };

  const handleBulkAction = async (action, marketplaces = []) => {
    if (selected.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select items to perform bulk actions.',
        variant: 'destructive',
      });
      return;
    }

    setCrosslistLoading(true);
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
          selected,
          marketplaces,
          userTokens,
          { delayBetweenItems: 1000 }
        );
      } else if (action === 'delist') {
        result = await crosslistingEngine.bulkDelistItems(
          selected,
          marketplaces,
          userTokens
        );
      } else if (action === 'relist') {
        result = await crosslistingEngine.bulkRelistItems(
          selected,
          marketplaces,
          userTokens
        );
      }

      toast({
        title: 'Bulk Action Completed',
        description: `${result.success.length} succeeded, ${result.errors.length} failed.`,
      });

      setSelected([]);
      setShowBulkActions(false);
      
      // Refresh listings for all items
      const listingsMap = {};
      for (const itemId of selected) {
        try {
          const listings = await crosslistingEngine.getMarketplaceListings(itemId);
          listingsMap[itemId] = listings;
        } catch (error) {
          console.error(`Error refreshing listings for item ${itemId}:`, error);
        }
      }
      setMarketplaceListings(prev => ({ ...prev, ...listingsMap }));
      
      queryClient.invalidateQueries(['inventoryItems']);
    } catch (error) {
      toast({
        title: 'Bulk Action Failed',
        description: error.message || 'Failed to perform bulk action.',
        variant: 'destructive',
      });
    } finally {
      setCrosslistLoading(false);
    }
  };

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
  const toggleAll = (checked) => {
    const isChecked = checked === true;
    if (isChecked) {
      setSelected(filtered.map((x) => x.id));
    } else {
      setSelected([]);
    }
  };

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
          <div className="hidden md:flex gap-2 flex-shrink-0 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setLayout((l) => (l === "rows" ? "grid" : "rows"))}
              className="whitespace-nowrap"
            >
              {layout === "rows" ? <Grid2X2 className="w-4 h-4 mr-2" /> : <Rows className="w-4 h-4 mr-2" />}
              {layout === "rows" ? "Grid View" : "List View"}
            </Button>
          </div>
        </div>

        {/* Platform Connection Status & Active Jobs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlatformConnectionStatus
            onConnectClick={(platform) => {
              toast({
                title: 'Connect Platform',
                description: `Open ${platform} in a new tab, log in, then use the Chrome extension to connect.`,
              });
            }}
          />
          {Object.keys(activeJobs).length > 0 && (
            <div className="space-y-2">
              {Object.entries(activeJobs).map(([itemId, jobId]) => {
                const item = inventory.find((i) => i.id === itemId);
                return (
                  <ListingJobTracker
                    key={jobId}
                    jobId={jobId}
                    onComplete={handleJobComplete}
                    onClose={() => {
                      setActiveJobs((prev) => {
                        const newJobs = { ...prev };
                        delete newJobs[itemId];
                        return newJobs;
                      });
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gray-50 dark:bg-gray-800">
            <CardTitle className="text-gray-900 dark:text-white text-base flex items-center gap-2">
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
        ) : (
          <>
            {filtered.length > 0 && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
                <Checkbox
                  checked={selected.length === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleAll}
                  id="select-all"
                  className="!h-[22px] !w-[22px] !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 [&[data-state=checked]]:!bg-green-600 [&[data-state=checked]]:!border-green-600 flex-shrink-0 [&_svg]:!h-[16px] [&_svg]:!w-[16px]"
                />
                <div className="flex flex-col">
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer text-gray-900 dark:text-white">
                    Select All ({filtered.length})
                  </label>
                  <span className="text-xs text-gray-600 dark:text-gray-400 md:hidden">
                    Tap image to select for bulk edit
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 hidden md:block">Click image to select for bulk edit</span>
                </div>
              </div>
            )}
            {layout === "rows" && !isMobile ? (
          <div className="space-y-6">
            {filtered.map((it) => {
              const map = computeListingState(it);
              const listedCount = Object.values(map).filter(Boolean).length;
              
              return (
                <div key={it.id} className="product-list-item relative flex flex-col sm:flex-row items-start sm:items-center min-w-0 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700/50 shadow-sm dark:shadow-lg"
                  style={{
                    minHeight: '248px',
                    height: 'auto',
                    borderRadius: '16px',
                    overflow: 'hidden'
                  }}>
                  {/* Product Image Section */}
                  <div className="glass flex items-center justify-center relative flex-shrink-0 m-4 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700/50"
                    style={{
                      width: '220px',
                      minWidth: '220px',
                      height: '210px',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                    <div
                      onClick={() => toggleSelect(it.id)}
                      className="block w-full h-full cursor-pointer"
                    >
                      <OptimizedImage
                        src={it.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                        alt={it.item_name}
                        fallback="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"
                        className="w-full h-full object-contain"
                        style={{ maxHeight: '186px' }}
                        lazy={true}
                      />
                    </div>
                    {selected.includes(it.id) && (
                      <div className="absolute top-2 left-2 z-20">
                        <div className="bg-green-600 rounded-full p-1 shadow-lg">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Details Section */}
                  <div className="flex-1 flex flex-col justify-between h-full px-4 sm:px-6 py-4 sm:py-6 border-l border-r min-w-0"
                    style={{
                      borderColor: 'rgba(229, 231, 235, 0.8)',
                      minHeight: '210px'
                    }}>
                    {/* Status Badge */}
                    <div className="mb-3">
                      <Badge className={`${STATUS_COLORS[it.status] || STATUS_COLORS.available} glass px-4 sm:px-6 py-2 rounded-xl text-sm font-medium`}
                        style={{
                          background: it.status === 'listed' ? 'rgba(34, 197, 94, 0.2)' : it.status === 'sold' ? 'rgba(156, 163, 175, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          border: it.status === 'listed' ? '1px solid rgba(34, 197, 94, 0.4)' : it.status === 'sold' ? '1px solid rgba(156, 163, 175, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)'
                        }}>
                        {STATUS_LABELS[it.status] || STATUS_LABELS.available}
                      </Badge>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white break-words line-clamp-2 mb-2"
                      style={{ letterSpacing: '0.5px' }}>
                      {it.item_name || 'Untitled Item'}
                    </h3>

                    {/* Category and Source */}
                    <p className="text-gray-700 dark:text-gray-300 mb-4 text-xs sm:text-sm break-words"
                      style={{ 
                        letterSpacing: '0.7px',
                        lineHeight: '23.8px'
                      }}>
                      {it.category || "—"} • {it.source || "—"}
                      {it.purchase_date && ` • ${format(parseISO(it.purchase_date), "MMM d, yyyy")}`}
                    </p>

                    {/* Marketplace Icons & List Buttons */}
                    <div className="mt-auto flex flex-wrap items-center gap-2">
                      {MARKETPLACES.map((m) => {
                        const isListed = map[m.id];
                        const status = getListingStatus(it.id, m.id);
                        const listings = getItemListings(it.id);
                        const listing = listings.find(l => l.marketplace === m.id);
                        const isConnected = isPlatformConnected(m.id);
                        const hasActiveJob = activeJobs[it.id];
                        
                        return (
                          <div key={m.id} className="flex flex-col items-center gap-1">
                            <div
                              className={`glass inline-flex items-center justify-center w-12 h-12 rounded-lg border-2 transition-all ${
                                isListed
                                  ? "bg-white border-white shadow-lg shadow-white/20 opacity-100"
                                  : "bg-gray-500/10 border-gray-600/50 opacity-40 hover:opacity-60"
                              }`}
                              style={{
                                backdropFilter: 'blur(10px)',
                                borderRadius: '10px'
                              }}
                              title={isListed ? `✓ Listed on ${m.label}` : `Not listed on ${m.label}`}
                            >
                              {renderMarketplaceIcon(m, "w-6 h-6")}
                            </div>
                            {!isListed && isConnected && !hasActiveJob && ['mercari', 'facebook'].includes(m.id) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleListOnMarketplaceItem(it.id, m.id)}
                                disabled={crosslistLoading}
                                className="text-xs h-6 px-2"
                              >
                                List on {m.label}
                              </Button>
                            )}
                            {hasActiveJob && activeJobs[it.id] && (
                              <div className="text-xs text-blue-600">Processing...</div>
                            )}
                          </div>
                        );
                      })}
                      {listedCount > 0 && (
                        <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                          {listedCount} of {MARKETPLACES.length} listed
                        </span>
                      )}
                    </div>

                    {/* Purchase Price */}
                    <div className="mt-3 flex items-center text-gray-900 dark:text-white">
                      <span className="text-xs sm:text-sm font-semibold mr-2">Purchase Price:</span>
                      <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                        ${(it.purchase_price || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="flex flex-col items-stretch justify-center gap-2 px-3 py-3 flex-shrink-0 w-full sm:w-[200px] border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80">
                    {/* Crosslist Button */}
                    <Button
                      onClick={() => openComposer([it.id], false)}
                      className="w-full bg-gradient-to-r from-green-600 via-green-600 to-green-600 hover:from-green-500 hover:via-green-600 hover:to-green-500 text-white font-semibold py-1.5 px-3 rounded-xl text-center transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-sm shadow-green-500/20 hover:shadow-md hover:shadow-green-500/25 text-xs"
                      style={{ letterSpacing: '1px' }}
                    >
                      <span className="flex justify-center items-center gap-1">
                        Crosslist
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </Button>

                    {/* Edit Button */}
                    <Button
                      variant="ghost"
                      onClick={() => navigate(createPageUrl(`AddInventoryItem?id=${it.id}`))}
                      className="w-full glass text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 py-1.5 px-3 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600"
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map((it) => {
              const map = computeListingState(it);
              const listedCount = Object.values(map).filter(Boolean).length;
              return (
                <Card 
                  key={it.id} 
                  className="group overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] border-gray-200 dark:border-slate-700/50 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800 shadow-sm dark:shadow-lg"
                  style={{
                    borderRadius: '16px',
                  }}
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-50 dark:bg-slate-900/50"
                  >
                    <div
                      onClick={() => toggleSelect(it.id)}
                      className="block w-full h-full cursor-pointer"
                    >
                      <OptimizedImage
                        src={it.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                        alt={it.item_name}
                        fallback="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"
                        className="w-full h-full object-cover"
                        lazy={true}
                      />
                    </div>
                    {selected.includes(it.id) && (
                      <div className="absolute top-2 left-2 z-20">
                        <div className="bg-green-600 rounded-full p-1 shadow-lg">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 z-10">
                      <Badge variant="outline" className={`${STATUS_COLORS[it.status] || STATUS_COLORS.available} text-[10px] px-1.5 py-0.5 backdrop-blur-sm`}>
                        {STATUS_LABELS[it.status] || STATUS_LABELS.available}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-2 line-clamp-2">
                      {it.item_name}
                    </h3>
                    <div className="text-xs text-gray-700 dark:text-gray-300 mb-3">{it.category || "—"}</div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {MARKETPLACES.map((m) => {
                        const isListed = map[m.id];
                        const status = getListingStatus(it.id, m.id);
                        const listings = getItemListings(it.id);
                        const listing = listings.find(l => l.marketplace === m.id);
                        const isConnected = isPlatformConnected(m.id);
                        const hasActiveJob = activeJobs[it.id];
                        
                        return (
                          <div
                            key={m.id}
                            className="flex flex-col items-center gap-1"
                          >
                            <div
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all backdrop-blur-sm ${
                                isListed
                                  ? "bg-green-600/30 border-green-500/50 opacity-100"
                                  : "bg-gray-200 border-gray-300 opacity-40"
                              }`}
                              title={isListed ? `Listed on ${m.label}` : `Not listed on ${m.label}`}
                            >
                              {renderMarketplaceIcon(m, "w-4 h-4")}
                            </div>
                            {status === 'not_listed' ? (
                              isConnected && ['mercari', 'facebook'].includes(m.id) && !hasActiveJob ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleListOnMarketplaceItem(it.id, m.id)}
                                  disabled={crosslistLoading}
                                  className="text-xs h-6 px-2"
                                >
                                  List on {m.label}
                                </Button>
                              ) : !isConnected && ['mercari', 'facebook'].includes(m.id) ? (
                                <span className="text-xs text-muted-foreground">Connect</span>
                              ) : null
                            ) : (
                              <div className="flex gap-1">
                                {listing?.marketplace_listing_url && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(listing.marketplace_listing_url, '_blank')}
                                    className="text-xs h-6 px-1"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelistFromMarketplace(it.id, listing?.marketplace_listing_id, m.id)}
                                  disabled={crosslistLoading}
                                  className="text-xs h-6 px-1 text-destructive"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                            {hasActiveJob && activeJobs[it.id] && (
                              <span className="text-xs text-blue-600">Processing...</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button 
                        size="sm" 
                        className="w-full bg-gradient-to-r from-green-600 to-green-600 hover:from-green-500 hover:to-green-500 text-white font-semibold text-xs" 
                        onClick={() => openComposer([it.id], false)}
                      >
                        Crosslist
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-xs" 
                        onClick={() => navigate(createPageUrl(`AddInventoryItem?id=${it.id}`))}
                      >
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </>
        )}
      </div>

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
              Perform actions on {selected.length} selected item(s)
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
                    const marketplaceData = MARKETPLACES.find(m => m.id === marketplace);
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
                          {marketplaceData && renderMarketplaceIcon(marketplaceData, "w-4 h-4")}
                          {marketplaceData?.label || marketplace.charAt(0).toUpperCase() + marketplace.slice(1)}
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
              disabled={!bulkAction || crosslistLoading || selectedMarketplaces.length === 0}
            >
              {crosslistLoading ? 'Processing...' : 'Execute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

