import React, { useMemo, useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { useNavigate, useLocation } from "react-router-dom";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Sparkles,
  Download,
  Trash2,
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
import { ListingJobTracker } from "@/components/ListingJobTracker";
import { inventoryApi } from "@/api/inventoryApi";
import { syncSalesForInventoryItemIds } from "@/services/salesSync";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileFilterBar from "@/components/mobile/MobileFilterBar";
import SelectionBanner from "@/components/SelectionBanner";

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
  const inventoryPhotoObjs = (() => {
    // Prefer rich `photos` (stable ids), fallback to `images` (urls), then `image_url`.
    const photos = Array.isArray(item?.photos) ? item.photos.filter(Boolean) : [];
    if (photos.length > 0) {
      return photos
        .map((p, idx) => ({
          id: String(p?.id || `photo_${idx}`),
          preview: p?.preview || p?.imageUrl || p?.url || p?.image_url || "",
          fileName: p?.fileName || `Inventory photo ${idx + 1}`,
          fromInventory: true,
          isMain: Boolean(p?.isMain ?? idx === 0),
        }))
        .filter((p) => Boolean(p.preview));
    }

    const images = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
    if (images.length > 0) {
      return images.map((u, idx) => ({
        id: `img_${idx}`,
        preview: typeof u === "string" ? u : (u?.imageUrl || u?.url || u?.image_url || ""),
        fileName: `Inventory photo ${idx + 1}`,
        fromInventory: true,
        isMain: idx === 0,
      })).filter((p) => Boolean(p.preview));
    }

    if (item?.image_url) {
      return [{
        id: "inventory-photo-0",
        preview: item.image_url,
        fileName: "Inventory photo",
        fromInventory: true,
        isMain: true,
      }];
    }

    return [];
  })();

  const general = {
    ...GENERAL_TEMPLATE_DEFAULT,
    photos: inventoryPhotoObjs,
    title: item?.item_name || "",
    description: item?.description || item?.notes || "",
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
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addTag } = useInventoryTags();
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemIds) => {
      const results = [];
      
      for (const id of itemIds) {
        try {
          // Hard delete (permanent)
          await inventoryApi.delete(id, true);
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      
      return results;
    },
    onSuccess: async (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      // Get items being deleted from the current inventory array
      const itemsBeingDeleted = inventory.filter(item => itemsToDelete.includes(item.id));
      
      // Un-mark items in import cache
      const successfulIds = results.filter(r => r.success).map(r => r.id);
      
      if (successfulIds.length > 0 && itemsBeingDeleted.length > 0) {
        const sourcesToUpdate = { facebook: [], mercari: [], ebay: [] };
        
        for (const id of successfulIds) {
          const item = itemsBeingDeleted.find(i => i.id === id);
          if (item?.source) {
            const source = item.source.toLowerCase();
            if (source === 'facebook' || source === 'facebook marketplace') {
              sourcesToUpdate.facebook.push(id);
            } else if (source === 'mercari') {
              sourcesToUpdate.mercari.push(id);
            } else if (source === 'ebay') {
              sourcesToUpdate.ebay.push(id);
            }
          }
        }
        
        // Update Facebook cache
        if (sourcesToUpdate.facebook.length > 0) {
          const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
          if (cachedListings) {
            try {
              const listings = JSON.parse(cachedListings);
              const updatedListings = listings.map(item => {
                if (sourcesToUpdate.facebook.includes(item.inventoryId)) {
                  return { ...item, imported: false, inventoryId: null };
                }
                return item;
              });
              localStorage.setItem('profit_orbit_facebook_listings', JSON.stringify(updatedListings));
              
              const firstDeletedItem = itemsBeingDeleted.find(i => i.source?.toLowerCase().includes('facebook'));
              if (firstDeletedItem?.user_id) {
                queryClient.setQueryData(['facebook-listings', firstDeletedItem.user_id], updatedListings);
              }
              
              console.log(`✅ Un-marked ${sourcesToUpdate.facebook.length} Facebook items (crosslist delete)`);
            } catch (e) {
              console.error('Failed to update Facebook cache:', e);
            }
          }
        }
        
        // Update Mercari cache
        if (sourcesToUpdate.mercari.length > 0) {
          const cachedListings = localStorage.getItem('profit_orbit_mercari_listings');
          if (cachedListings) {
            try {
              const listings = JSON.parse(cachedListings);
              const updatedListings = listings.map(item => {
                if (sourcesToUpdate.mercari.includes(item.inventoryId)) {
                  return { ...item, imported: false, inventoryId: null };
                }
                return item;
              });
              localStorage.setItem('profit_orbit_mercari_listings', JSON.stringify(updatedListings));
              
              const firstDeletedItem = itemsBeingDeleted.find(i => i.source?.toLowerCase() === 'mercari');
              if (firstDeletedItem?.user_id) {
                queryClient.setQueryData(['mercari-listings', firstDeletedItem.user_id], updatedListings);
              }
              
              console.log(`✅ Un-marked ${sourcesToUpdate.mercari.length} Mercari items (crosslist delete)`);
            } catch (e) {
              console.error('Failed to update Mercari cache:', e);
            }
          }
        }
        
        // Invalidate eBay cache
        if (sourcesToUpdate.ebay.length > 0) {
          const firstDeletedItem = itemsBeingDeleted.find(i => i.source?.toLowerCase() === 'ebay');
          if (firstDeletedItem?.user_id) {
            queryClient.invalidateQueries(['ebay-listings', firstDeletedItem.user_id]);
            console.log(`✅ Invalidated eBay listings cache (${sourcesToUpdate.ebay.length} items)`);
          }
        }
      }
      
      // Clear selection and close dialog
      setSelected(prev => prev.filter(id => !successfulIds.includes(id)));
      setDeleteDialogOpen(false);
      setItemsToDelete([]);
      
      // Refresh inventory
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      
      toast({
        title: failCount === 0 ? "✅ Items Deleted" : "⚠️ Partial Delete Complete",
        description: failCount === 0 
          ? `${successCount} item${successCount > 1 ? 's' : ''} permanently deleted.`
          : `${successCount} item${successCount > 1 ? 's' : ''} deleted. ${failCount} failed.`,
        variant: failCount === 0 ? "default" : "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Delete Failed",
        description: `Failed to delete items: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setItemsToDelete([]);
    },
  });
  
  const handleDeleteClick = () => {
    if (selected.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select items to delete.",
        variant: "destructive",
      });
      return;
    }
    
    setItemsToDelete(selected);
    setDeleteDialogOpen(true);
  };
  
  const [layout, setLayout] = useState(() => {
    // Load saved layout from localStorage, default to "list" on desktop
    const saved = localStorage.getItem('crosslist_layout');
    if (saved) return saved;
    // Check if desktop (window width > 768px)
    return window.innerWidth > 768 ? 'list' : 'grid';
  });
  
  // Persist layout changes
  useEffect(() => {
    localStorage.setItem('crosslist_layout', layout);
  }, [layout]);
  
  const [isMobile, setIsMobile] = useState(false);
  
  // Hybrid variation logic based on user preference:
  // Desktop Grid = V1 (Compact), Desktop List = V2 (Showcase), Mobile = V2 (Showcase)
  const viewVariation = React.useMemo(() => {
    if (isMobile) return 2; // V2 for all mobile views
    return layout === 'grid' ? 1 : 2; // Desktop: V1 for grid, V2 for list/rows
  }, [isMobile, layout]);
  
  // Variation configurations
  const gridVariations = {
    1: { // Compact Professional
      containerClass: "gap-3",
      cardClass: "rounded-lg",
      paddingClass: "p-3",
      imageWrapperClass: "aspect-square",
      badgeClass: "text-[9px] px-1.5 py-0.5",
      titleClass: "text-xs font-bold",
      dataTextClass: "text-[10px]",
      hoverEffect: "",
      buttonSizeClass: "h-6 w-6",
      iconSizeClass: "h-3 w-3"
    },
    2: { // Visual Showcase
      containerClass: "gap-6",
      cardClass: "rounded-2xl",
      paddingClass: "p-6",
      imageWrapperClass: "aspect-square",
      badgeClass: "text-xs px-3 py-1.5",
      titleClass: "text-base font-bold",
      dataTextClass: "text-sm",
      hoverEffect: "hover:scale-105 transition-transform duration-300",
      buttonSizeClass: "h-9 w-9",
      iconSizeClass: "h-4 w-4"
    }
  };

  const listVariations = {
    1: { // Compact Professional
      gridCols: "grid-cols-[100px_1fr_220px]",
      imageHeight: 100,
      padding: "p-3 py-3",
      titleClass: "text-sm font-bold",
      dataTextClass: "text-xs",
      buttonSizeClass: "h-7 w-7",
      iconSizeClass: "h-3.5 w-3.5"
    },
    2: { // Visual Showcase
      gridCols: "grid-cols-[220px_1fr_280px]",
      imageHeight: 220,
      padding: "p-6 py-5",
      titleClass: "text-lg font-bold",
      dataTextClass: "text-base",
      buttonSizeClass: "h-9 w-9",
      iconSizeClass: "h-4 w-4"
    }
  };
  
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState([]);
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
  
  // Track mobile state but don't force grid view
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    
    // Check on mount and resize
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
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

  const inventoryFields = React.useMemo(() => ([
    'id',
    'item_name',
    'status',
    'purchase_price',
    'listing_price',
    'purchase_date',
    'category',
    'source',
    'image_url',
    'images',
    'photos',
    'notes',
    'description',
    'brand',
    'condition',
    'size',
    'deleted_at',
  ].join(',')), []);

  const {
    data: inventoryResp,
    isLoading,
    isError: isInventoryError,
    error: inventoryError,
    refetch: refetchInventory,
  } = useQuery({
    queryKey: ["inventoryItems", "crosslist"],
    queryFn: async () => {
      try {
        return await inventoryApi.list("-purchase_date", {
          limit: 5000,
          fields: inventoryFields,
        });
      } catch (e) {
        console.error('❌ Crosslist inventory fetch failed:', e);
        throw e;
      }
    },
    placeholderData: [],
    retry: 2,
    // Avoid churn; user can pull-to-refresh by reloading or using in-app actions.
    refetchOnWindowFocus: false,
  });

  // Back-compat: some API responses can be paged objects: { data, total, ... }.
  const inventory = React.useMemo(() => {
    if (Array.isArray(inventoryResp)) return inventoryResp;
    if (inventoryResp && Array.isArray(inventoryResp.data)) return inventoryResp.data;
    return [];
  }, [inventoryResp]);

  const crosslistableItems = useMemo(
    () => inventory.filter((item) => item.status !== "sold" && !item.deleted_at),
    [inventory]
  );

  // Compute which marketplaces an item is actually crosslisted to
  // Source of truth: marketplace listing records (fast + consistent with DB schema).
  const computeListingState = (item) => {
    const listings = getItemListings(item.id);
    const getState = (marketplace) => {
      const active = listings.find((l) => l.marketplace === marketplace && l.status === 'active');
      if (active) return 'active';
      const processing = listings.find((l) => l.marketplace === marketplace && l.status === 'processing');
      if (processing) return 'processing';
      return null;
    };

    const state = {
      ebay:     getState('ebay'),
      facebook: getState('facebook'),
      mercari:  getState('mercari'),
      etsy:     getState('etsy'),
      poshmark: getState('poshmark'),
    };
    
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

  function MercariListButton({ itemId, marketplaceId, onClick }) {
    return (
      <button
        type="button"
        onClick={(e) => onClick?.(e, itemId, marketplaceId)}
        className="text-xs h-6 px-2 border rounded-md"
      >
        List on Mercari
      </button>
    );
  }

  // Wrapper function for button clicks - moves async logic out of JSX
  const handleListButtonClick = async (e, itemId, marketplace) => {
    const withTimeout = (p, ms) =>
      Promise.race([
        p,
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error(`handleListOnMarketplaceItem timed out after ${ms}ms`)), ms)
        ),
      ]);

    try {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      await withTimeout(handleListOnMarketplaceItem(itemId, marketplace), 15000);
    } catch (err) {
      console.error("❌ WRAPPER ERROR full:", err);

      const details =
        err?.details ||
        err?.response?.data?.details ||
        err?.response?.data?.error ||
        err?.message ||
        String(err);

      toast({
        title: 'Listing Failed',
        description: details,
        variant: 'destructive',
      });
    }
  };

  const handleListOnMarketplaceItem = async (itemId, marketplace) => {
    console.log("[A] ENTER handleListOnMarketplaceItem", { itemId, marketplace });

    try {
      console.log("[B] normalize marketplace");
      const normalizedMarketplace = String(marketplace).toLowerCase().trim();

      setCrosslistLoading(true);

      // Only support Mercari quick-listing from this page.
      // Facebook listing is handled on the Facebook crosslist form (CrosslistComposer) to avoid duplicate flows/buttons.
      if (normalizedMarketplace === 'facebook') {
        toast({
          title: 'Use Facebook Crosslist Form',
          description: 'Facebook Marketplace listing is available on the Facebook crosslist form page.',
          variant: 'destructive',
          duration: 8000,
        });
        return;
      }

      if (!['mercari'].includes(normalizedMarketplace)) {
        // Fallback to old system for other platforms
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
        return result;
      }

      console.log("[C] before building listing data");
      // Get inventory item
      const inventoryItem = inventory.find((item) => item.id === itemId);
      if (!inventoryItem) {
        throw new Error('Inventory item not found');
      }

      console.log("[D] before platform connected checks");
      // Check platform connection via localStorage flag set by extension
      const isPlatformConnected = (id) => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(`profit_orbit_${id}_connected`) === "true";
      };

      const required = [normalizedMarketplace];
      const notConnected = required.filter((p) => !isPlatformConnected(p));

      if (notConnected.length > 0) {
        const platformName = notConnected[0] === 'mercari' ? 'Mercari' : notConnected[0];
        toast({
          title: 'Platform Not Connected',
          description: `Please connect your ${platformName} account first. You can connect from Settings > Login, or use the Chrome extension.`,
          variant: 'destructive',
          duration: 10000,
        });
        setShowPlatformConnect(true);
        return;
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

      // Create listing job directly via API
      console.log("[E] before API create-job");
      console.log("E2 payload", payload);
      const result = await listingJobsApi.createJob(itemId, [normalizedMarketplace], payload);
      console.log("🌍 create-job result", result);

      // Track the job
      setActiveJobs((prev) => ({
        ...prev,
        [itemId]: result.jobId,
      }));

      toast({
        title: 'Listing Job Created',
        description: `Your item is being listed on ${marketplace}. Check status below.`,
      });

      return result;
    } catch (err) {
      console.error("[X] handleListOnMarketplaceItem ERROR", err);
      throw err;
    } finally {
      setCrosslistLoading(false);
    }
  };

  const handleJobComplete = (job) => {
    let matchedItemId = null;

    // Remove from active jobs
    setActiveJobs((prev) => {
      const newJobs = { ...prev };
      Object.keys(newJobs).forEach((itemId) => {
        if (newJobs[itemId] === job.id) {
          matchedItemId = itemId;
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

      // Step 1a: only treat Mercari as success if we have a real Mercari item URL
      const mercariListingUrl = job?.result?.mercari?.listingUrl;
      const isMercariRealSuccess =
        job?.result?.mercari?.success === true &&
        typeof mercariListingUrl === 'string' &&
        (mercariListingUrl.includes('mercari.com/us/item/') || mercariListingUrl.includes('mercari.com/items/'));

      if (isMercariRealSuccess) {
        const inventoryItemId = job.inventory_item_id || matchedItemId;
        const listingIdFromUrl = (() => {
          try {
            const u = String(mercariListingUrl);
            const m =
              /mercari\.com\/us\/item\/([A-Za-z0-9]+)/.exec(u) ||
              /mercari\.com\/items\/([A-Za-z0-9]+)/.exec(u);
            return m?.[1] || null;
          } catch (_) {
            return null;
          }
        })();
        if (inventoryItemId) {
          inventoryApi.update(inventoryItemId, {
            status: 'listed',
            mercari_listing_id: mercariListingUrl,
          }).catch(() => {});

          // Persist listing record so this page doesn't "forget" it on navigation.
          crosslistingEngine
            .upsertMarketplaceListing({
              inventory_item_id: inventoryItemId,
              marketplace: 'mercari',
              marketplace_listing_id: listingIdFromUrl || String(job?.id || ''),
              marketplace_listing_url: String(mercariListingUrl),
              status: 'active',
              listed_at: new Date().toISOString(),
              metadata: { jobId: job?.id || null, result: job?.result?.mercari || null },
            })
            .then(async () => {
              const listings = await crosslistingEngine.getMarketplaceListings(inventoryItemId);
              setMarketplaceListings((prev) => ({ ...prev, [inventoryItemId]: listings }));
            })
            .catch(() => {});
        }

        // Open the posted listing (may be blocked by popup blockers)
        try {
          window.open(mercariListingUrl, '_blank', 'noopener,noreferrer');
        } catch {}
      }

      // Refresh inventory
      queryClient.invalidateQueries(['inventoryItems']);
    }
  };

  const handleDelistFromMarketplace = async (itemId, listingId, marketplace) => {
    setCrosslistLoading(true);
    try {
      // Facebook delist is extension-based (API-mode replay), not the legacy CrosslistingEngine integration.
      if (marketplace === 'facebook') {
        const ext = window?.ProfitOrbitExtension;
        if (!ext?.delistFacebookListing) {
          toast({
            title: 'Extension Required',
            description: 'Facebook delist requires the Profit Orbit extension. Please refresh and try again.',
            variant: 'destructive',
          });
          return;
        }
        if (!confirm('Delist on Facebook Marketplace?')) return;
        const resp = await ext.delistFacebookListing({ listingId: String(listingId) });
        if (!resp?.success) throw new Error(resp?.error || 'Failed to delist on Facebook');

        await crosslistingEngine.updateMarketplaceListing(String(listingId), {
          status: 'removed',
          delisted_at: new Date().toISOString(),
        });

        toast({
          title: 'Delisted Successfully',
          description: 'Item removed from facebook.',
        });

        const listings = await crosslistingEngine.getMarketplaceListings(itemId);
        setMarketplaceListings(prev => ({
          ...prev,
          [itemId]: listings,
        }));
        queryClient.invalidateQueries(['inventoryItems']);
        return;
      }

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
    // Pass preloaded items to the composer so it can render instantly (no waiting on a full inventory refetch).
    const prefillItems = itemIds
      .map((id) => inventory.find((it) => it?.id === id))
      .filter(Boolean);

    navigate(createPageUrl(`CrosslistComposer?${params.toString()}`), {
      state: { prefillItems },
    });
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

  const topOffset = React.useMemo(() => {
    return selected.length > 0 ? (isMobile ? 'calc(env(safe-area-inset-top, 0px) + 50px)' : '50px') : undefined;
  }, [selected.length, isMobile]);

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background overflow-x-hidden w-full max-w-full" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <SelectionBanner
        selectedCount={selected.length}
        onClear={() => setSelected([])}
        showAtTop={false}
        threshold={200}
      />
      <div className="max-w-7xl mx-auto space-y-6 min-w-0 w-full max-w-full overflow-x-hidden" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden', paddingTop: topOffset }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground break-words">Crosslist</h1>
            <p className="text-sm text-muted-foreground break-words">
              Start crosslisting your inventory in seconds. Bulk tools now; marketplace APIs later.
            </p>
          </div>
          <div className="hidden md:flex gap-2 flex-shrink-0 flex-wrap">
            <Button
              variant="default"
              className="whitespace-nowrap gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate(createPageUrl("Import"), {
                state: {
                  from: {
                    pathname: location.pathname,
                    search: location.search || "",
                  }
                }
              })}
            >
              <Download className="w-4 h-4" />
              Import
            </Button>
            <Button
              variant="outline"
              className="whitespace-nowrap"
              disabled={crosslistLoading}
              onClick={async () => {
                try {
                  const ids = Array.isArray(inventory) ? inventory.map((i) => i?.id).filter(Boolean) : [];
                  if (!ids.length) {
                    toast({ title: 'Nothing to sync', description: 'No inventory items loaded yet.' });
                    return;
                  }
                  setCrosslistLoading(true);
                  toast({ title: 'Syncing sales…', description: 'Checking Mercari + eBay listing statuses.' });
                  const summary = await syncSalesForInventoryItemIds(ids, { marketplaces: ['mercari', 'ebay'] });
                  toast({
                    title: 'Sales sync complete',
                    description: `Sold: ${summary.sold} • Delisted: ${summary.delisted} • Sales created: ${summary.createdSales}`,
                  });
                  // Refresh UI (local listing records + inventory list)
                  try {
                    await Promise.all(ids.slice(0, 50).map((id) => crosslistingEngine.getMarketplaceListings(id).catch(() => [])));
                  } catch (_) {}
                  queryClient.invalidateQueries(['inventoryItems']);
                  queryClient.invalidateQueries(['sales']);
                } catch (e) {
                  toast({ title: 'Sync failed', description: e?.message || String(e), variant: 'destructive' });
                } finally {
                  setCrosslistLoading(false);
                }
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Sales
            </Button>
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

        {/* Active Jobs */}
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

        {/* Mobile Filter Bar */}
        <div className="md:hidden mb-4">
          <MobileFilterBar
            search={q}
            onSearchChange={setQ}
            showDeleted={false}
            onShowDeletedToggle={() => {}}
            showFavorites={false}
            onShowFavoritesToggle={() => {}}
            pageSize={undefined}
            onPageSizeChange={undefined}
            onExportCSV={undefined}
            pageInfo={undefined}
            renderAdditionalFilters={() => (
              <>
                <div>
                  <Label className="text-xs mb-1.5 block">View Mode</Label>
                  <Button
                    variant="outline"
                    onClick={() => setLayout((l) => (l === "rows" ? "grid" : "rows"))}
                    className="w-full"
                  >
                    {layout === "rows" ? <Grid2X2 className="w-4 h-4 mr-2" /> : <Rows className="w-4 h-4 mr-2" />}
                    {layout === "rows" ? "Grid View" : "List View"}
                  </Button>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Status</Label>
                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="listed">Listed</SelectItem>
                      <SelectItem value="unlisted">In Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
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
              </>
            )}
          />
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate(createPageUrl("Pro Tools"))}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Pro Tools
            </Button>
            <div className="flex gap-2 justify-end min-w-0 w-full max-w-full overflow-hidden">
              <Button
                variant="default"
                className="whitespace-nowrap flex-shrink-0 bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate(createPageUrl("Import"), {
                  state: {
                    from: {
                      pathname: location.pathname,
                      search: location.search || "",
                    }
                  }
                })}
              >
                <Download className="w-4 h-4 mr-2" />
                Import
              </Button>
              <div className="hidden md:flex gap-2">
                <BulkActionsMenu 
                  selectedItems={selected}
                  onActionComplete={() => setSelected([])}
                />
                {selected.length > 0 && (
                  <Button
                    onClick={handleDeleteClick}
                    variant="destructive"
                    className="whitespace-nowrap flex-shrink-0"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                )}
              </div>
              <Button
                onClick={() => {
                  if (selected.length > 0) {
                    openComposer(selected);
                  } else {
                    openComposer([]);
                  }
                }}
                className="bg-green-600 hover:bg-green-700 whitespace-nowrap flex-shrink-0"
              >
                <Rocket className="w-4 h-4 mr-2" />
                Crosslist
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop Filter Card */}
        <Card className="hidden md:block border-0 shadow-lg">
          <CardHeader className="border-b bg-card">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
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
              <div className="flex flex-col md:flex-row gap-2 flex-wrap order-1 md:order-2 md:ml-auto md:justify-end min-w-0 w-full md:w-auto max-w-full overflow-hidden">
                <Button
                  type="button"
                  variant="outline"
                  className="whitespace-nowrap w-auto flex-shrink-0"
                  onClick={() => navigate(createPageUrl("Pro Tools"))}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Pro Tools
                </Button>
                <div className="hidden md:flex gap-2">
                  <BulkActionsMenu 
                    selectedItems={selected}
                    onActionComplete={() => setSelected([])}
                  />
                  {selected.length > 0 && (
                    <Button
                      onClick={handleDeleteClick}
                      variant="destructive"
                      className="whitespace-nowrap w-auto flex-shrink-0"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </div>
                <Button
                  onClick={() => {
                    if (selected.length > 0) {
                      openComposer(selected);
                    } else {
                      openComposer([]);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 whitespace-nowrap w-auto flex-shrink-0"
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  Crosslist
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isInventoryError ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-base">Failed to load inventory for Crosslist.</p>
            <p className="text-muted-foreground text-xs mt-2 break-words">
              {String(inventoryError?.message || inventoryError || 'Unknown error')}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => refetchInventory()}>
                Retry
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Refresh
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No items match your filters.
          </div>
        ) : (
          <>
            {filtered.length > 0 && (
              <div className="flex items-center justify-between gap-3 p-4 bg-card rounded-t-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                    id="select-all"
                    className="!h-[22px] !w-[22px] !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 [&[data-state=checked]]:!bg-green-600 [&[data-state=checked]]:!border-green-600 flex-shrink-0 [&_svg]:!h-[16px] [&_svg]:!w-[16px]"
                  />
                  <div className="flex flex-col">
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer text-foreground">
                      Select All ({filtered.length})
                    </label>
                    <span className="text-xs text-muted-foreground md:hidden">
                      Tap image to select for bulk edit
                    </span>
                    <span className="text-xs text-muted-foreground hidden md:block">Click image to select for bulk edit</span>
                  </div>
                </div>
                
                {/* Mobile view toggle button */}
                <Button
                  variant="outline"
                  onClick={() => setLayout((l) => (l === "rows" ? "grid" : "rows"))}
                  className="md:hidden flex-shrink-0"
                  size="sm"
                >
                  {layout === "rows" ? <Grid2X2 className="w-4 h-4 mr-1" /> : <Rows className="w-4 h-4 mr-1" />}
                  {layout === "rows" ? "Grid" : "List"}
                </Button>
              </div>
            )}
            
            {/* Mobile: Bulk Actions and Delete buttons */}
            <div className="md:hidden space-y-2 mb-4">
              {/* Bulk Actions - only show when 2+ items selected */}
              {selected.length > 1 && (
                <div className="w-full">
                  <BulkActionsMenu 
                    selectedItems={selected}
                    onActionComplete={() => setSelected([])}
                  />
                </div>
              )}
              
              {/* Delete - only show when 1+ items selected */}
              {selected.length > 0 && (
                <Button
                  onClick={handleDeleteClick}
                  variant="destructive"
                  className="w-full"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteMutation.isPending ? "Deleting..." : `Delete ${selected.length} Item${selected.length > 1 ? 's' : ''}`}
                </Button>
              )}
            </div>
            
            {layout === "rows" ? (
          <div className="space-y-4">
            {filtered.map((it) => {
              const map = computeListingState(it);
              const listedCount = Object.values(map).filter((v) => v === 'active').length;
              
              return (
                <div key={it.id} className="w-full max-w-full">
                  {/* Mobile/Tablet list layout */}
                  <div
                    className={`lg:hidden product-list-item relative flex flex-col mb-6 min-w-0 w-full bg-white dark:bg-card border ${selected.includes(it.id) ? 'border-green-500 dark:border-green-500 ring-4 ring-green-500/50 shadow-lg shadow-green-500/30' : 'border-gray-200 dark:border-border'} shadow-sm dark:shadow-lg`}
                    style={{
                      borderRadius: '16px',
                      overflow: 'hidden',
                      maxWidth: '100%',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Image and content row */}
                    <div className="flex flex-row items-stretch sm:items-center">
                      <div className="flex-shrink-0 m-1 sm:m-4 w-[120px] sm:w-[150px]" style={{ minWidth: '120px', maxWidth: '120px' }}>
                        <div
                          onClick={() => toggleSelect(it.id)}
                          className={`cursor-pointer flex items-center justify-center relative w-[120px] sm:w-[150px] min-w-[120px] sm:min-w-[150px] max-w-[120px] sm:max-w-[150px] h-[120px] sm:h-[150px] p-1 transition-all duration-200 overflow-hidden bg-gray-50 dark:bg-card/70 border ${selected.includes(it.id) ? 'border-green-500 dark:border-green-500' : 'border-gray-200 dark:border-border hover:opacity-90 hover:shadow-md'}`}
                          style={{
                            borderRadius: '12px',
                            flexShrink: 0
                          }}
                        >
                          <OptimizedImage
                            src={it.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                            alt={it.item_name}
                            fallback="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"
                            className="w-full h-full object-contain rounded-lg"
                            lazy={true}
                          />
                          {selected.includes(it.id) && (
                            <div className="absolute top-2 left-2 z-20">
                              <div className="bg-green-600 rounded-full p-1 shadow-lg">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col justify-start items-start px-2 sm:px-6 py-2 sm:py-6 min-w-0 overflow-hidden relative">
                        <div className="absolute left-0 top-0 w-px h-[130px] sm:h-full bg-gray-300"></div>
                        
                        {/* Status badge - Desktop only */}
                        <div className="hidden sm:block mb-2">
                          <Badge variant="outline" className={`${STATUS_COLORS[it.status]} text-[10px] px-1.5 py-0.5`}>
                            {STATUS_LABELS[it.status] || STATUS_LABELS.available}
                          </Badge>
                        </div>
                        
                        <div className="block mb-1 sm:mb-3 w-full text-left">
                          <h3 className="text-sm sm:text-xl font-bold text-foreground break-words line-clamp-2 text-left"
                            style={{ letterSpacing: '0.3px', lineHeight: '1.35' }}>
                            {it.item_name || 'Untitled Item'}
                          </h3>
                        </div>

                        <div className="mb-1 sm:hidden space-y-0.5 w-full text-left">
                          <p className="text-gray-700 dark:text-gray-300 text-[11px] break-words leading-[14px]">
                            <span className="font-semibold">Category:</span> {it.category || "—"}
                          </p>
                          
                          <p className="text-gray-700 dark:text-gray-300 text-[11px] break-words leading-[14px] pt-1">
                            <span className="font-semibold">Price:</span> ${(it.purchase_price || 0).toFixed(2)}
                          </p>
                          
                          <p className="text-gray-700 dark:text-gray-300 text-[11px] break-words leading-[14px]">
                            <span className="font-semibold">Purchased:</span> {it.purchase_date ? format(parseISO(it.purchase_date), 'MMM d, yyyy') : '—'}
                          </p>

                          {it.source && (
                            <p className="text-gray-700 dark:text-gray-300 text-[11px] break-words leading-[14px] flex items-center gap-1.5">
                              <span className="font-semibold">Source:</span>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
                                {it.source}
                              </Badge>
                            </p>
                          )}
                        </div>

                        <div className="hidden sm:block space-y-1.5 text-xs sm:text-sm mb-2 sm:mb-4 text-gray-700 dark:text-gray-300 break-words">
                          <div>
                            <span>Price: </span>
                            <span className="font-medium text-foreground">${(it.purchase_price || 0).toFixed(2)}</span>
                          </div>
                          <div>
                            <span>Category: </span>
                            <span className="font-medium text-foreground">{it.category || "—"}</span>
                          </div>
                          <div>
                            <span>Purchase Date: </span>
                            <span className="font-medium text-foreground">
                              {it.purchase_date ? format(parseISO(it.purchase_date), 'MMM dd, yyyy') : '—'}
                            </span>
                          </div>
                          {it.source && (
                            <div>
                              <span>Source: </span>
                              <span className="font-medium text-foreground">{it.source}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mobile: Marketplace icons row */}
                    <div className="md:hidden w-full px-2 py-3 border-t border-gray-200 dark:border-border bg-gray-50 dark:bg-card/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground">Marketplaces:</span>
                        {listedCount > 0 && (
                          <Badge variant="outline" className="text-[9px] px-2 py-0.5">
                            {listedCount} of {MARKETPLACES.length} listed
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {MARKETPLACES.map((m) => {
                          const state = map[m.id];
                          const isListed = state === 'active';
                          const isProcessing = state === 'processing';
                          const listings = getItemListings(it.id);
                          const listing =
                            listings.find((l) => l.marketplace === m.id && l.status === 'active') ||
                            listings.find((l) => l.marketplace === m.id && l.status === 'processing') ||
                            listings.find((l) => l.marketplace === m.id) ||
                            null;
                          const listingUrl =
                            typeof listing?.marketplace_listing_url === 'string' && listing.marketplace_listing_url.startsWith('http')
                              ? listing.marketplace_listing_url
                              : null;
                          
                          return (
                            <div key={m.id} className="flex flex-col items-center gap-1">
                              <div
                                className={`relative inline-flex items-center justify-center w-12 h-12 rounded-xl border transition-all ${
                                  isListed
                                    ? "bg-white dark:bg-card border-emerald-500/40 opacity-100 shadow-sm"
                                    : isProcessing
                                      ? "bg-white dark:bg-card border-blue-500/40 opacity-100 shadow-sm"
                                    : "bg-gray-500/10 border-gray-300 dark:border-border opacity-50 hover:opacity-70"
                                }`}
                                title={
                                  isListed
                                    ? (listingUrl ? `✓ Listed on ${m.label}` : `✓ Listed on ${m.label}`)
                                    : isProcessing
                                      ? `Listing in progress`
                                    : `Not listed on ${m.label}`
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (listingUrl) window.open(listingUrl, '_blank');
                                }}
                              >
                                {renderMarketplaceIcon(m, "w-7 h-7")}
                                {isListed && listingUrl && (
                                  <span className="absolute -top-1 -right-1 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full p-0.5 shadow">
                                    <ExternalLink className="w-2.5 h-2.5 text-emerald-700 dark:text-emerald-400" />
                                  </span>
                                )}
                                {isProcessing && (
                                  <span className="absolute -top-1 -right-1 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full p-0.5 shadow">
                                    <RefreshCw className="w-2.5 h-2.5 text-blue-600 animate-spin" />
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-muted-foreground">{m.label}</span>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Status badge on mobile */}
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className={`${STATUS_COLORS[it.status]} text-[10px] px-2 py-1`}>
                          {STATUS_LABELS[it.status] || STATUS_LABELS.available}
                        </Badge>
                      </div>
                    </div>

                    {/* Mobile: Action buttons */}
                    <div className="md:hidden w-full">
                      {/* Row 1: Crosslist and Edit buttons */}
                      <div className="flex gap-2 p-3 border-t border-gray-200 dark:border-border bg-white dark:bg-card">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            openComposer([it.id], false);
                          }}
                          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold py-2.5 px-2 rounded-md text-center transition-all shadow-md leading-tight text-sm"
                        >
                          <span className="flex justify-center items-center gap-1">
                            Crosslist
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(createPageUrl(`AddInventoryItem?id=${it.id}`));
                          }}
                          variant="outline"
                          className="flex-1 bg-white dark:bg-card/80 hover:bg-gray-50 dark:hover:bg-slate-900 text-foreground font-semibold py-2.5 px-2 rounded-md text-center transition-all shadow-md leading-tight text-sm border border-gray-200 dark:border-border"
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Desktop list layout (existing) */}
                  <div className="hidden lg:block">
                <div
                  onClick={(e) => {
                    // Only toggle if NOT clicking on an interactive element
                    const target = e.target;
                    const isInteractive = target.closest('button, a, input, textarea, select, [role="button"]');
                    if (!isInteractive) {
                      toggleSelect(it.id);
                    }
                  }}
                  className={`product-list-item group relative overflow-hidden rounded-2xl border cursor-pointer ${selected.includes(it.id) ? 'border-green-500 dark:border-green-500 ring-4 ring-green-500/50 shadow-lg shadow-green-500/30' : 'border-gray-200/80 dark:border-border'} bg-white/80 dark:bg-card/95 shadow-sm dark:shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/60`}
                >
                  <div className={`grid ${listVariations[viewVariation].gridCols} gap-0 min-w-0`}>
                    {/* Product Image Section */}
                    <div className={listVariations[viewVariation].padding}>
                      <div
                        onClick={() => toggleSelect(it.id)}
                        className={`relative overflow-hidden rounded-xl border bg-gray-50 dark:bg-card/50 flex items-center justify-center cursor-pointer transition border-gray-200/80 dark:border-border hover:border-gray-300 dark:hover:border-border/80`}
                        style={{ height: listVariations[viewVariation].imageHeight }}
                        title="Click image to select"
                      >
                        <OptimizedImage
                          src={it.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                          alt={it.item_name}
                          fallback="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"
                          className="w-full h-full object-contain"
                          lazy={true}
                        />

                        {selected.includes(it.id) && (
                          <div className="absolute top-2 left-2 z-20">
                            <div className="bg-green-600 rounded-full p-1 shadow-lg">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Details Section */}
                    <div className={`min-w-0 px-5 py-4 ${selected.includes(it.id) ? '' : 'border-l border-r border-gray-200/70 dark:border-border'}`}>
                    {/* Status Badge */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <Badge className={`${STATUS_COLORS[it.status] || STATUS_COLORS.available} px-3 py-1.5 rounded-xl text-xs font-semibold`}>
                          {STATUS_LABELS[it.status] || STATUS_LABELS.available}
                        </Badge>
                        {listedCount > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {listedCount} of {MARKETPLACES.length} listed
                          </div>
                        )}
                      </div>

                    {/* Title */}
                    <h3 className={`${listVariations[viewVariation].titleClass} text-foreground break-words line-clamp-2 mb-1`}>
                      {it.item_name || 'Untitled Item'}
                    </h3>

                    {/* Category and Source */}
                    <p className="text-xs text-gray-700 dark:text-gray-300 mb-3 break-words">
                      {it.category || "—"} • {it.source || "—"}
                      {it.purchase_date && ` • ${format(parseISO(it.purchase_date), "MMM d, yyyy")}`}
                    </p>

                    {/* Marketplace Icons & List Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      {MARKETPLACES.map((m) => {
                        const state = map[m.id];
                        const isListed = state === 'active';
                        const isProcessing = state === 'processing';
                        const listings = getItemListings(it.id);
                        const listing =
                          listings.find((l) => l.marketplace === m.id && l.status === 'active') ||
                          listings.find((l) => l.marketplace === m.id && l.status === 'processing') ||
                          listings.find((l) => l.marketplace === m.id) ||
                          null;
                        const isConnected = isPlatformConnected(m.id);
                        const hasActiveJob = activeJobs[it.id];
                        const listingUrl =
                          typeof listing?.marketplace_listing_url === 'string' && listing.marketplace_listing_url.startsWith('http')
                            ? listing.marketplace_listing_url
                            : null;
                        
                        return (
                          <div key={m.id} className="flex flex-col items-center gap-1">
                            <div
                              className={`relative inline-flex items-center justify-center ${listVariations[viewVariation].buttonSizeClass} rounded-xl border transition-all ${
                                isListed
                                  ? "bg-white dark:bg-card border-emerald-500/40 opacity-100 shadow-sm"
                                  : isProcessing
                                    ? "bg-white dark:bg-card border-blue-500/40 opacity-100 shadow-sm"
                                  : "bg-gray-500/10 border-gray-300 dark:border-border opacity-50 hover:opacity-70"
                              }`}
                              title={
                                isListed
                                  ? (listingUrl ? `✓ Listed on ${m.label} (click to open)` : `✓ Listed on ${m.label}`)
                                  : isProcessing
                                    ? `Listing in progress on ${m.label}`
                                  : `Not listed on ${m.label}`
                              }
                              role={listingUrl ? "button" : undefined}
                              tabIndex={listingUrl ? 0 : undefined}
                              onClick={() => {
                                if (listingUrl) window.open(listingUrl, '_blank');
                              }}
                              onKeyDown={(e) => {
                                if (!listingUrl) return;
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  window.open(listingUrl, '_blank');
                                }
                              }}
                            >
                              {renderMarketplaceIcon(m, listVariations[viewVariation].iconSizeClass)}
                              {isListed && listingUrl && (
                                <span className="absolute -top-1 -right-1 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full p-1 shadow">
                                  <ExternalLink className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                                </span>
                              )}
                              {isProcessing && (
                                <span className="absolute -top-1 -right-1 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full p-1 shadow">
                                  <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                                </span>
                              )}
                            </div>
                            {!isListed && !isProcessing && isConnected && !hasActiveJob && m.id === 'mercari' && (
                              <MercariListButton
                                itemId={it.id}
                                marketplaceId={m.id}
                                onClick={(e) => handleListButtonClick(e, it.id, m.id)}
                              />
                            )}
                            {hasActiveJob && activeJobs[it.id] && (
                              <div className="text-xs text-blue-600">Processing...</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Purchase Price */}
                      <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Purchase Price</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        ${(it.purchase_price || 0).toFixed(2)}
                      </span>
                    </div>
                    </div>

                    {/* Actions Section */}
                    <div className="p-4 bg-gray-50/80 dark:bg-card/80 flex flex-col gap-2">
                    {/* Crosslist Button */}
                    <Button
                      onClick={() => openComposer([it.id], false)}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-xl text-xs h-9 shadow-sm shadow-green-500/15"
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
                      className="w-full rounded-xl text-xs font-semibold h-9 bg-white/90 dark:bg-card/80 border border-gray-200/70 dark:border-border hover:bg-white dark:hover:bg-slate-900"
                    >
                      Edit
                    </Button>
                    </div>
                  </div>
                </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${gridVariations[viewVariation].containerClass} w-full max-w-full overflow-x-hidden mt-6`} style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            {filtered.map((it) => {
              const map = computeListingState(it);
              const listedCount = Object.values(map).filter((v) => v === 'active').length;
              return (
                <Card 
                  key={it.id}
                  onClick={(e) => {
                    // Only toggle if clicking on the card itself, not interactive elements
                    if (e.target === e.currentTarget || e.target.closest('.card-clickable-area')) {
                      toggleSelect(it.id);
                    }
                  }}
                  className={`group overflow-hidden transition-all duration-300 cursor-pointer ${gridVariations[viewVariation].hoverEffect} ${gridVariations[viewVariation].cardClass} ${selected.includes(it.id) ? 'border-green-500 dark:border-green-500 ring-4 ring-green-500/50 shadow-lg shadow-green-500/30' : 'border-gray-200 dark:border-border'} bg-gradient-to-br from-white to-gray-50 dark:from-card dark:to-card/80 shadow-sm dark:shadow-lg max-w-full`}
                >
                  <div className={`relative ${gridVariations[viewVariation].imageWrapperClass} overflow-hidden bg-gray-50 dark:bg-card/70`}
                  >
                    <div
                      onClick={() => toggleSelect(it.id)}
                      className="block w-full h-full cursor-pointer"
                    >
                      <OptimizedImage
                        src={it.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                        alt={it.item_name}
                        fallback="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"
                        className="w-full h-full object-cover max-w-full"
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
                      <Badge variant="outline" className={`${STATUS_COLORS[it.status] || STATUS_COLORS.available} ${gridVariations[viewVariation].badgeClass} backdrop-blur-sm`}>
                        {STATUS_LABELS[it.status] || STATUS_LABELS.available}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className={`${gridVariations[viewVariation].paddingClass} card-clickable-area`}>
                    <h3 className={`${gridVariations[viewVariation].titleClass} text-foreground mb-2 line-clamp-2`}>
                      {it.item_name}
                    </h3>
                    <div className={`${gridVariations[viewVariation].dataTextClass} text-gray-700 dark:text-gray-300 mb-3`}>{it.category || "—"}</div>
                    <div className="flex flex-wrap gap-1.5 mb-3" onClick={(e) => e.stopPropagation()}>
                      {MARKETPLACES.map((m) => {
                        const state = map[m.id];
                        const isListed = state === 'active';
                        const isProcessing = state === 'processing';
                        const listings = getItemListings(it.id);
                        const listing =
                          listings.find((l) => l.marketplace === m.id && l.status === 'active') ||
                          listings.find((l) => l.marketplace === m.id && l.status === 'processing') ||
                          listings.find((l) => l.marketplace === m.id) ||
                          null;
                        const isConnected = isPlatformConnected(m.id);
                        const hasActiveJob = activeJobs[it.id];
                        const listingUrl =
                          typeof listing?.marketplace_listing_url === 'string' && listing.marketplace_listing_url.startsWith('http')
                            ? listing.marketplace_listing_url
                            : null;
                        
                        return (
                          <div
                            key={m.id}
                            className="flex flex-col items-center gap-1"
                          >
                            <div
                              className={`relative inline-flex items-center justify-center ${gridVariations[viewVariation].buttonSizeClass} rounded-lg border transition-all backdrop-blur-sm ${
                                isListed
                                  ? "bg-green-600/30 border-green-500/50 opacity-100"
                                  : isProcessing
                                    ? "bg-blue-600/20 border-blue-500/50 opacity-100"
                                    : "bg-gray-200 border-gray-300 opacity-40"
                              }`}
                              title={
                                isListed
                                  ? (listingUrl ? `Listed on ${m.label} (click to open)` : `Listed on ${m.label}`)
                                  : isProcessing
                                    ? `Listing in progress on ${m.label}`
                                  : `Not listed on ${m.label}`
                              }
                              role={listingUrl ? "button" : undefined}
                              tabIndex={listingUrl ? 0 : undefined}
                              onClick={() => {
                                if (listingUrl) window.open(listingUrl, '_blank');
                              }}
                              onKeyDown={(e) => {
                                if (!listingUrl) return;
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  window.open(listingUrl, '_blank');
                                }
                              }}
                            >
                              {renderMarketplaceIcon(m, gridVariations[viewVariation].iconSizeClass)}
                              {isListed && listingUrl && (
                                <span className="absolute -top-1 -right-1 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full p-0.5 shadow">
                                  <ExternalLink className="w-2.5 h-2.5 text-emerald-700 dark:text-emerald-400" />
                                </span>
                              )}
                              {isProcessing && (
                                <span className="absolute -top-1 -right-1 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full p-0.5 shadow">
                                  <RefreshCw className="w-2.5 h-2.5 text-blue-600 animate-spin" />
                                </span>
                              )}
                            </div>
                            {!isListed && !isProcessing ? (
                              isConnected && m.id === 'mercari' && !hasActiveJob ? (
                                <MercariListButton
                                  itemId={it.id}
                                  marketplaceId={m.id}
                                  onClick={(e) => handleListButtonClick(e, it.id, m.id)}
                                />
                              ) : null
                            ) : (
                              // Listed: the icon itself is clickable when we have a URL; no per-item "X" buttons here.
                              null
                            )}
                            {hasActiveJob && activeJobs[it.id] && (
                              <span className="text-xs text-blue-600">Processing...</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
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
                        className="w-full border-gray-300 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-xs" 
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">
              ⚠️ Permanently Delete {itemsToDelete.length} Item{itemsToDelete.length > 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you absolutely sure you want to <strong className="text-red-600 dark:text-red-400">permanently delete</strong> {itemsToDelete.length} selected item{itemsToDelete.length > 1 ? 's' : ''}?
              <br /><br />
              <strong className="text-red-600 dark:text-red-400">This action cannot be undone.</strong> These items will be completely removed from your inventory and cannot be recovered.
              <br /><br />
              If the item was imported from a marketplace, it will reappear on the Import page as "Not Imported" so you can re-import it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(itemsToDelete)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

