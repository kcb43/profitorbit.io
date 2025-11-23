import React, { useMemo, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { useNavigate, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Rocket,
  ImagePlus,
  X,
  RefreshCw,
  Save,
  Package,
  Check,
  Palette,
  ArrowLeft,
  GripVertical,
  Sparkles,
  BarChart,
} from "lucide-react";
import ColorPickerDialog from "../components/ColorPickerDialog";
import SoldLookupDialog from "../components/SoldLookupDialog";
import EbaySearchDialog from "../components/EbaySearchDialog";
import imageCompression from "browser-image-compression";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInventoryTags } from "@/hooks/useInventoryTags";
import { useEbayCategoryTreeId, useEbayCategories, useEbayCategoryAspects } from "@/hooks/useEbayCategorySuggestions";
import { TagInput } from "@/components/TagInput";
import { DescriptionGenerator } from "@/components/DescriptionGenerator";

const FACEBOOK_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";
const MERCARI_ICON_URL = "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B";
const EBAY_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg";
const ETSY_ICON_URL = "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B";
const POSHMARK_ICON_URL = "https://cdn.brandfetch.io/idUxsADOAW/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B";

// Predefined categories that should be cleared when loading items into crosslisting composer
// to allow users to select from eBay category picklist instead
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

const MARKETPLACES = [
  { id: "ebay",     label: "eBay",     icon: EBAY_ICON_URL },
  { id: "facebook", label: "Facebook", icon: FACEBOOK_ICON_URL },
  { id: "mercari",  label: "Mercari",  icon: MERCARI_ICON_URL  },
  { id: "etsy",     label: "Etsy",     icon: ETSY_ICON_URL },
  { id: "poshmark", label: "Poshmark", icon: POSHMARK_ICON_URL },
];

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
  color1: "",
  color2: "",
  color3: "",
  sku: "",
  zip: "",
  tags: "",
  quantity: "1",
  category: "",
  size: "",
  packageDetails: "",
  packageWeight: "",
  packageLength: "",
  packageWidth: "",
  packageHeight: "",
  price: "",
  cost: "",
  customLabels: "",
  categoryId: "",
};

const MARKETPLACE_TEMPLATE_DEFAULTS = {
  ebay: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    color: "",
    categoryId: "",
    categoryName: "",
    itemType: "",
    ebayBrand: "",
    condition: "",
    model: "",
    sku: "",
    shippingMethod: "Calculated",
    shippingCostType: "calculated",
    shippingCost: "",
    handlingTime: "1 business day",
    shipFromCountry: "United States",
    shippingService: "Standard Shipping (3 to 5 business days)",
    shippingLocation: "",
    acceptReturns: false,
    returnWithin: "30 days",
    returnShippingPayer: "Buyer",
    returnRefundMethod: "Full Refund",
    pricingFormat: "fixed",
    duration: "Good 'Til Canceled",
    buyItNowPrice: "",
    allowBestOffer: true,
  },
  etsy: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    sku: "",
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
    photos: [],
    title: "",
    description: "",
    brand: "",
    shippingCarrier: "Mercari Prepaid",
    shippingPrice: "",
    localPickup: false,
    smartPricing: false,
    floorPrice: "",
  },
  facebook: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    deliveryMethod: "shipping_and_pickup",
    shippingPrice: "",
    localPickup: true,
    meetUpLocation: "",
    allowOffers: true,
  },
};

const createInitialTemplateState = (item) => {
  // If item has a predefined category, clear it so user can select from eBay category picklist
  const itemCategory = item?.category || "";
  const shouldClearCategory = itemCategory && PREDEFINED_CATEGORIES.includes(itemCategory);
  const category = shouldClearCategory ? "" : itemCategory;
  
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
    tags: item?.tags || (shouldClearCategory ? "" : item?.category || ""),
    quantity: item?.quantity != null ? String(item.quantity) : "1",
    category: category,
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
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      buyItNowPrice: general.price,
      shippingLocation: general.zip,
    },
    etsy: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.etsy,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      tags: general.tags,
    },
    mercari: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.mercari,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      shippingPrice: general.price ? (Number(general.price) >= 100 ? "Free" : "Buyer pays") : "",
    },
    facebook: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.facebook,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
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

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
  "Italy", "Spain", "Netherlands", "Belgium", "Switzerland", "Austria",
  "Sweden", "Norway", "Denmark", "Finland", "Ireland", "Portugal",
  "Poland", "Czech Republic", "Hungary", "Romania", "Greece", "Japan",
  "China", "South Korea", "India", "Singapore", "Hong Kong", "Taiwan",
  "New Zealand", "Mexico", "Brazil", "Argentina", "Chile", "South Africa",
  "Israel", "United Arab Emirates", "Saudi Arabia", "Turkey", "Russia",
  "Ukraine", "Other"
];

export default function CrosslistComposer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addTag } = useInventoryTags();
  
  // Get item IDs and autoSelect from URL
  const searchParams = new URLSearchParams(location.search);
  const idsParam = searchParams.get('ids');
  const autoSelectParam = searchParams.get('autoSelect');
  const itemIds = idsParam ? idsParam.split(',').filter(Boolean) : [];
  const autoSelect = autoSelectParam !== 'false';
  
  // Fetch inventory items if IDs are provided
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: () => base44.entities.InventoryItem.list("-purchase_date"),
    initialData: [],
  });
  
  const bulkSelectedItems = useMemo(() => {
    if (itemIds.length === 0) return [];
    return inventory.filter(item => itemIds.includes(item.id));
  }, [inventory, itemIds]);
  
  const [templateForms, setTemplateForms] = useState(() => createInitialTemplateState(null));
  const [activeForm, setActiveForm] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [currentEditingItemId, setCurrentEditingItemId] = useState(null);
  const [packageDetailsDialogOpen, setPackageDetailsDialogOpen] = useState(false);
  const [brandIsCustom, setBrandIsCustom] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [editingColorField, setEditingColorField] = useState(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState([]);
  const [generalCategoryPath, setGeneralCategoryPath] = useState([]);
  const [descriptionGeneratorOpen, setDescriptionGeneratorOpen] = useState(false);
  const photoInputRef = React.useRef(null);
  const ebayPhotoInputRef = React.useRef(null);
  const etsyPhotoInputRef = React.useRef(null);
  const mercariPhotoInputRef = React.useRef(null);
  const facebookPhotoInputRef = React.useRef(null);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [ebaySearchDialogOpen, setEbaySearchDialogOpen] = useState(false);
  const [ebaySearchInitialQuery, setEbaySearchInitialQuery] = useState("");
  
  // Get eBay category tree ID
  const { data: categoryTreeData, isLoading: isLoadingCategoryTree } = useEbayCategoryTreeId('EBAY_US');
  const categoryTreeId = categoryTreeData?.categoryTreeId;
  
  // Get the current level of categories based on selected path for eBay form
  const ebayCurrentCategoryId = selectedCategoryPath.length > 0 
    ? selectedCategoryPath[selectedCategoryPath.length - 1].categoryId 
    : '0';
  
  // Get the current level of categories based on selected path for General form
  const generalCurrentCategoryId = generalCategoryPath.length > 0 
    ? generalCategoryPath[generalCategoryPath.length - 1].categoryId 
    : '0';
  
  // Categories for eBay form
  const { data: ebayCategoriesData, isLoading: isLoadingEbayCategories, error: ebayCategoriesError } = useEbayCategories(
    categoryTreeId,
    ebayCurrentCategoryId,
    activeForm === "ebay" && !!categoryTreeId
  );
  
  // Categories for General form
  const { data: generalCategoriesData, isLoading: isLoadingGeneralCategories, error: generalCategoriesError } = useEbayCategories(
    categoryTreeId,
    generalCurrentCategoryId,
    activeForm === "general" && !!categoryTreeId
  );
  
  // Use the appropriate category data based on active form
  const categoriesData = activeForm === "general" ? generalCategoriesData : ebayCategoriesData;
  const isLoadingCategories = activeForm === "general" ? isLoadingGeneralCategories : isLoadingEbayCategories;
  const categoriesError = activeForm === "general" ? generalCategoriesError : ebayCategoriesError;
  const currentCategoryPath = activeForm === "general" ? generalCategoryPath : selectedCategoryPath;
  
  const categorySubtreeNode = categoriesData?.categorySubtreeNode;
  const currentCategories = categorySubtreeNode?.childCategoryTreeNodes || [];

  // Sort categories alphabetically
  const sortedCategories = [...currentCategories].sort((a, b) => {
    const nameA = a.category?.categoryName || '';
    const nameB = b.category?.categoryName || '';
    return nameA.localeCompare(nameB);
  });

  // eBay shipping defaults storage
  const EBAY_DEFAULTS_KEY = 'ebay-shipping-defaults';
  const loadEbayDefaults = () => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(EBAY_DEFAULTS_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to load eBay defaults:', error);
      return null;
    }
  };

  const saveEbayDefaults = (defaults) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(EBAY_DEFAULTS_KEY, JSON.stringify(defaults));
      toast({
        title: "Defaults saved",
        description: "Your shipping defaults have been saved and will be applied to new listings.",
      });
    } catch (error) {
      console.warn('Failed to save eBay defaults:', error);
      toast({
        title: "Error",
        description: "Failed to save defaults. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Load defaults on mount
  useEffect(() => {
    const defaults = loadEbayDefaults();
    if (defaults) {
      setTemplateForms((prev) => ({
        ...prev,
        ebay: {
          ...prev.ebay,
          ...defaults,
        },
      }));
    }
  }, []);
  
  const populateTemplates = React.useCallback((item) => {
    const itemId = item?.id;
    
    // First, load any saved form data for this item
    const savedGeneral = loadTemplateFromStorage('general', itemId);
    const savedEbay = loadTemplateFromStorage('ebay', itemId);
    const savedEtsy = loadTemplateFromStorage('etsy', itemId);
    const savedMercari = loadTemplateFromStorage('mercari', itemId);
    const savedFacebook = loadTemplateFromStorage('facebook', itemId);
    
    // Start with initial template state from item
    const initial = createInitialTemplateState(item);
    
    // Merge with saved form data (saved data takes precedence over initial state)
    const merged = {
      general: savedGeneral ? { ...initial.general, ...savedGeneral } : initial.general,
      ebay: savedEbay ? { ...initial.ebay, ...savedEbay } : initial.ebay,
      etsy: savedEtsy ? { ...initial.etsy, ...savedEtsy } : initial.etsy,
      mercari: savedMercari ? { ...initial.mercari, ...savedMercari } : initial.mercari,
      facebook: savedFacebook ? { ...initial.facebook, ...savedFacebook } : initial.facebook,
    };
    
    setTemplateForms(merged);
    setActiveForm("general");
    setSelectedCategoryPath([]);
    setGeneralCategoryPath([]);
    const brand = item?.brand || "";
    if (brand && !POPULAR_BRANDS.includes(brand)) {
      setBrandIsCustom(true);
    } else {
      setBrandIsCustom(false);
    }
  }, []);
  
  // Load saved templates from localStorage - per-item if editing, global templates for new items
  // Note: This runs when item ID changes, but populateTemplates also loads saved data
  // So we'll only use this for cases where we switch items without calling populateTemplates
  useEffect(() => {
    const itemId = currentEditingItemId;
    
    // Skip if we don't have an item ID (new item mode will use global templates via different mechanism)
    if (!itemId) {
      // For new items, load global templates only on initial mount
      if (bulkSelectedItems.length === 0) {
        const savedGeneral = loadTemplateFromStorage('general', null);
        const savedEbay = loadTemplateFromStorage('ebay', null);
        const savedEtsy = loadTemplateFromStorage('etsy', null);
        const savedMercari = loadTemplateFromStorage('mercari', null);
        const savedFacebook = loadTemplateFromStorage('facebook', null);
        
        if (savedGeneral || savedEbay || savedEtsy || savedMercari || savedFacebook) {
          setTemplateForms((prev) => {
            const updated = { ...prev };
            if (savedGeneral) updated.general = { ...prev.general, ...savedGeneral };
            if (savedEbay) updated.ebay = { ...prev.ebay, ...savedEbay };
            if (savedEtsy) updated.etsy = { ...prev.etsy, ...savedEtsy };
            if (savedMercari) updated.mercari = { ...prev.mercari, ...savedMercari };
            if (savedFacebook) updated.facebook = { ...prev.facebook, ...savedFacebook };
            return updated;
          });
        }
      }
      return;
    }
    
    // For existing items, populateTemplates already loads saved data
    // So we don't need to do anything here - populateTemplates handles it
    // This useEffect is mainly for the initial mount case
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEditingItemId, bulkSelectedItems.length]); // Reload when item ID changes
  
  // Initialize template from first item if available
  useEffect(() => {
    if (bulkSelectedItems.length > 0) {
      const primaryItem = bulkSelectedItems[0];
      if (autoSelect) {
        // Auto-select the first item and populate templates
        setCurrentEditingItemId(primaryItem.id);
        populateTemplates(primaryItem);
      } else {
        // Don't auto-select, just set current editing item but don't populate
        setCurrentEditingItemId(primaryItem.id);
        setTemplateForms(createInitialTemplateState(null));
        setBrandIsCustom(false);
        setSelectedCategoryPath([]);
        setGeneralCategoryPath([]);
      }
    } else {
      // New item mode - no items selected
      setCurrentEditingItemId(null);
      setTemplateForms(createInitialTemplateState(null));
      setBrandIsCustom(false);
      setSelectedCategoryPath([]);
      setGeneralCategoryPath([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkSelectedItems.length, autoSelect, itemIds.join(',')]);
  
  const switchToItem = (itemId) => {
    const item = bulkSelectedItems.find(it => it.id === itemId);
    if (item) {
      setCurrentEditingItemId(itemId);
      populateTemplates(item);
      setActiveForm("general");
      setSelectedCategoryPath([]);
      setGeneralCategoryPath([]);
    }
  };
  
  const generalForm = templateForms.general;
  const ebayForm = templateForms.ebay;
  const etsyForm = templateForms.etsy;
  const mercariForm = templateForms.mercari;
  const facebookForm = templateForms.facebook;

  // Find similar items for description generation
  const similarItems = useMemo(() => {
    if (!generalForm.title && !generalForm.brand && !generalForm.category) {
      return [];
    }

    return inventory
      .filter(item => {
        // Exclude current item if editing
        if (currentEditingItemId && item.id === currentEditingItemId) {
          return false;
        }

        // Find items with similar characteristics
        const titleMatch = generalForm.title && item.item_name
          ? item.item_name.toLowerCase().includes(generalForm.title.toLowerCase().split(' ')[0]) ||
            generalForm.title.toLowerCase().includes(item.item_name.toLowerCase().split(' ')[0])
          : false;

        const brandMatch = generalForm.brand && item.brand
          ? item.brand.toLowerCase() === generalForm.brand.toLowerCase()
          : false;

        const categoryMatch = generalForm.category && item.category
          ? item.category.toLowerCase() === generalForm.category.toLowerCase()
          : false;

        return (titleMatch || brandMatch || categoryMatch) && item.notes && item.notes.trim().length > 0;
      })
      .slice(0, 10) // Limit to 10 similar items
      .map(item => item.notes)
      .filter(Boolean);
  }, [inventory, generalForm.title, generalForm.brand, generalForm.category, currentEditingItemId]);

  // Get category aspects (brands, types, etc.) when a final category is selected
  // Only fetch if we have a valid category tree ID (not '0' or 0) and a valid category ID
  const isValidCategoryTreeId = categoryTreeId && categoryTreeId !== '0' && categoryTreeId !== 0 && String(categoryTreeId).trim() !== '';
  const isValidCategoryId = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0 && String(ebayForm.categoryId).trim() !== '';
  const { data: categoryAspectsData } = useEbayCategoryAspects(
    categoryTreeId,
    ebayForm.categoryId,
    activeForm === "ebay" && isValidCategoryTreeId && isValidCategoryId
  );

  const categoryAspects = categoryAspectsData?.aspects || [];
  const brandAspect = categoryAspects.find(aspect => 
    aspect.localizedAspectName?.toLowerCase() === 'brand' ||
    aspect.aspectConstraint?.aspectDataType === 'STRING'
  );
  const typeAspect = categoryAspects.find(aspect => 
    aspect.localizedAspectName?.toLowerCase() === 'type'
  );

  const ebayBrands = brandAspect?.aspectValues?.map(val => val.localizedValue) || [];
  const typeValues = typeAspect?.aspectValues?.map(val => val.localizedValue) || [];

  const handleSaveShippingDefaults = () => {
    const defaults = {
      handlingTime: ebayForm.handlingTime,
      shippingCost: ebayForm.shippingCost,
      shippingService: ebayForm.shippingService,
      shipFromCountry: ebayForm.shipFromCountry,
      acceptReturns: ebayForm.acceptReturns,
      returnWithin: ebayForm.returnWithin,
      returnShippingPayer: ebayForm.returnShippingPayer,
      returnRefundMethod: ebayForm.returnRefundMethod,
      shippingCostType: ebayForm.shippingCostType,
      shippingMethod: ebayForm.shippingMethod,
    };
    saveEbayDefaults(defaults);
  };
  
  const getColorHex = (colorValue) => {
    if (!colorValue) return null;
    if (colorValue.startsWith("#")) return colorValue;
    const color = COMMON_COLORS.find(c => c.name.toLowerCase() === colorValue.toLowerCase());
    return color ? color.hex : null;
  };
  
  const getColorName = (colorValue) => {
    if (!colorValue) return "Select color";
    if (colorValue.startsWith("#")) {
      const color = COMMON_COLORS.find(c => c.hex.toLowerCase() === colorValue.toLowerCase());
      return color ? color.name : colorValue;
    }
    return colorValue;
  };
  
  const handleColorSelect = (colorName, colorHex) => {
    if (editingColorField) {
      const valueToStore = colorName.startsWith("#") ? colorName : colorName;
      if (editingColorField === "ebay.color") {
        handleMarketplaceChange("ebay", "color", valueToStore);
      } else {
        handleGeneralChange(editingColorField, valueToStore);
      }
      setEditingColorField(null);
      setColorPickerOpen(false);
    }
  };

  // Condition mapping functions
  const mapGeneralConditionToEbay = (generalCondition) => {
    const conditionMap = {
      "New With Tags/Box": "New",
      "New Without Tags/Box": "Open Box",
      "Pre - Owned - Good": "Used",
      "Poor (Major flaws)": "Used",
      // These don't map - user must choose manually on eBay
      "New With Imperfections": null,
      "Pre - Owned - Excellent": null,
      "Pre - Owned - Fair": null,
    };
    return conditionMap[generalCondition] || null;
  };

  const handleEbayItemSelect = (inventoryData) => {
    setTemplateForms((prev) => {
      const updated = { ...prev };
      const general = { ...prev.general };
      
      // Populate general form with eBay item data
      if (inventoryData.item_name) general.title = inventoryData.item_name;
      if (inventoryData.image_url) {
        // Add image as photo
        const photo = {
          id: `ebay-${Date.now()}`,
          preview: inventoryData.image_url,
          fileName: "eBay item image",
          fromInventory: true,
        };
        general.photos = [photo, ...(general.photos || [])];
      }
      if (inventoryData.category) general.category = inventoryData.category;
      if (inventoryData.purchase_price) general.cost = String(inventoryData.purchase_price);
      if (inventoryData.notes) {
        general.description = inventoryData.notes;
      }
      
      updated.general = general;
      return updated;
    });
    setEbaySearchDialogOpen(false);
  };
  
  const openColorPicker = (field) => {
    setEditingColorField(field);
    setColorPickerOpen(true);
  };
  
  const handleGeneralChange = (field, value) => {
    setTemplateForms((prev) => {
      const general = { ...prev.general, [field]: value };
      const next = { ...prev, general };

      // Always sync to all marketplace forms (removed inheritGeneral checks)
      // eBay sync
      next.ebay = { ...next.ebay };
      if (field === "title") next.ebay.title = value;
      if (field === "description") next.ebay.description = value;
      if (field === "photos") next.ebay.photos = value;
      if (field === "price") next.ebay.buyItNowPrice = value;
      if (field === "zip") next.ebay.shippingLocation = value;
      if (field === "category") {
        next.ebay.categoryName = value;
      }
      if (field === "categoryId") {
        next.ebay.categoryId = value;
      }
      if (field === "brand") {
        next.ebay.ebayBrand = value;
        next.ebay.brand = value;
      }
      if (field === "sku") {
        next.ebay.sku = value;
      }
      if (field === "condition") {
        const mappedCondition = mapGeneralConditionToEbay(value);
        if (mappedCondition) {
          next.ebay.condition = mappedCondition;
        }
      }

      // Etsy sync
      next.etsy = { ...next.etsy };
      if (field === "title") next.etsy.title = value;
      if (field === "description") next.etsy.description = value;
      if (field === "photos") next.etsy.photos = value;
      if (field === "tags") next.etsy.tags = value;
      if (field === "sku") next.etsy.sku = value;

      // Mercari sync
      next.mercari = { ...next.mercari };
      if (field === "title") next.mercari.title = value;
      if (field === "description") next.mercari.description = value;
      if (field === "photos") next.mercari.photos = value;
      if (field === "price") {
        next.mercari.shippingPrice = Number(value) >= 100 ? "Free" : "Buyer pays";
      }

      // Facebook sync
      next.facebook = { ...next.facebook };
      if (field === "title") next.facebook.title = value;
      if (field === "description") next.facebook.description = value;
      if (field === "photos") next.facebook.photos = value;
      if (field === "zip") {
        next.facebook.meetUpLocation = value ? `Meet near ${value}` : "";
      }
      if (field === "price") {
        next.facebook.shippingPrice = Number(value) >= 75 ? "Free shipping" : "";
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
        // Copy photos and title from general when inheriting
        updated.photos = prev.general.photos || [];
        updated.title = prev.general.title || "";
        updated.description = prev.general.description || "";
        
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
  
  // Template storage keys - use item-specific keys when editing an item, global templates for new items
  const getStorageKey = (templateKey, itemId = null) => {
    if (itemId) {
      return `crosslist-item-${itemId}-${templateKey}`;
    }
    return `crosslist-template-${templateKey}`;
  };

  const saveTemplateToStorage = (templateKey, data, itemId = null) => {
    if (typeof window === 'undefined') return;
    try {
      const key = getStorageKey(templateKey, itemId);
      if (key) {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (error) {
      console.error(`Error saving ${templateKey} template:`, error);
    }
  };

  const loadTemplateFromStorage = (templateKey, itemId = null) => {
    if (typeof window === 'undefined') return null;
    try {
      const key = getStorageKey(templateKey, itemId);
      if (!key) return null;
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error(`Error loading ${templateKey} template:`, error);
      return null;
    }
  };

  const copyGeneralFieldsToMarketplace = (generalData, marketplaceKey) => {
    const copied = {};
    
    // Copy ALL common fields that all marketplaces can use (even if empty to ensure sync)
    copied.title = generalData.title || "";
    copied.description = generalData.description || "";
    copied.quantity = generalData.quantity || "1";
    copied.photos = generalData.photos || [];
    copied.sku = generalData.sku || "";
    copied.category = generalData.category || "";
    copied.size = generalData.size || "";
    copied.color = generalData.color1 || "";
    copied.brand = generalData.brand || "";
    
    // Handle condition mapping for eBay
    if (marketplaceKey === 'ebay') {
      const mappedCondition = mapGeneralConditionToEbay(generalData.condition || "");
      if (mappedCondition) {
        copied.condition = mappedCondition;
      }
      copied.ebayBrand = generalData.brand || "";
    } else {
      copied.condition = generalData.condition || "";
    }
    
    // Marketplace-specific field mappings
    if (marketplaceKey === 'ebay') {
      copied.buyItNowPrice = generalData.price || "";
      copied.shippingLocation = generalData.zip || "";
      copied.categoryId = generalData.categoryId || "";
      copied.categoryName = generalData.category || "";
    } else if (marketplaceKey === 'etsy') {
      copied.tags = generalData.tags || "";
    } else if (marketplaceKey === 'mercari') {
      copied.shippingPrice = generalData.price
        ? (Number(generalData.price) >= 100 ? "Free" : "Buyer pays")
        : "";
    } else if (marketplaceKey === 'facebook') {
      copied.meetUpLocation = generalData.zip ? `Meet near ${generalData.zip}` : "";
      copied.shippingPrice = generalData.price
        ? (Number(generalData.price) >= 75 ? "Free shipping" : "")
        : "";
    }
    
    return copied;
  };

  const handleReconnect = (templateKey) => {
    const label = TEMPLATE_DISPLAY_NAMES[templateKey] || "Marketplace";
    toast({
      title: `${label} reconnected`,
      description: "We'll refresh the integration and pull the latest account settings.",
    });
  };

  const handleTemplateSave = async (templateKey) => {
    const label = TEMPLATE_DISPLAY_NAMES[templateKey] || "Template";
    const itemId = currentEditingItemId; // Use current item ID if editing an existing item
    
    if (templateKey === 'general') {
      // Save general form (per-item if editing, or as template for new items)
      saveTemplateToStorage('general', generalForm, itemId);
      
      // Always copy general fields to all marketplace forms (auto-sync)
      const updatedForms = { ...templateForms };
      
      // Update eBay form (always sync)
      const ebayUpdates = copyGeneralFieldsToMarketplace(generalForm, 'ebay');
      updatedForms.ebay = { ...updatedForms.ebay, ...ebayUpdates };
      // Also sync the category path state for eBay
      if (generalCategoryPath.length > 0) {
        setSelectedCategoryPath(generalCategoryPath);
      }
      saveTemplateToStorage('ebay', updatedForms.ebay, itemId);
      
      // Update Etsy form (always sync)
      const etsyUpdates = copyGeneralFieldsToMarketplace(generalForm, 'etsy');
      updatedForms.etsy = { ...updatedForms.etsy, ...etsyUpdates };
      saveTemplateToStorage('etsy', updatedForms.etsy, itemId);
      
      // Update Mercari form (always sync)
      const mercariUpdates = copyGeneralFieldsToMarketplace(generalForm, 'mercari');
      updatedForms.mercari = { ...updatedForms.mercari, ...mercariUpdates };
      saveTemplateToStorage('mercari', updatedForms.mercari, itemId);
      
      // Update Facebook form (always sync)
      const facebookUpdates = copyGeneralFieldsToMarketplace(generalForm, 'facebook');
      updatedForms.facebook = { ...updatedForms.facebook, ...facebookUpdates };
      saveTemplateToStorage('facebook', updatedForms.facebook, itemId);
      
      // Update state with copied fields
      setTemplateForms(updatedForms);
      
      // If this is a new item (not editing an existing one), automatically save to inventory
      if (!currentEditingItemId && generalForm.title && generalForm.title.trim()) {
        try {
          setIsSaving(true);
          
          // Upload first photo if available
          let imageUrl = "";
          if (generalForm.photos && generalForm.photos.length > 0) {
            const firstPhoto = generalForm.photos[0];
            if (firstPhoto.file) {
              const uploadPayload = firstPhoto.file instanceof File 
                ? firstPhoto.file 
                : new File([firstPhoto.file], firstPhoto.fileName, { type: firstPhoto.file.type });
              
              const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
              imageUrl = file_url;
            } else if (firstPhoto.preview && !firstPhoto.preview.startsWith('blob:')) {
              imageUrl = firstPhoto.preview;
            }
          }

          const customLabels = generalForm.customLabels
            ? generalForm.customLabels.split(',').map(label => label.trim()).filter(Boolean)
            : [];

          const tags = generalForm.tags
            ? generalForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
            : [];

          const inventoryData = {
            item_name: generalForm.title || "Untitled Item",
            purchase_price: generalForm.cost ? parseFloat(generalForm.cost) : 0,
            listing_price: generalForm.price ? parseFloat(generalForm.price) : 0,
            purchase_date: new Date().toISOString().split('T')[0],
            source: "Crosslist",
            status: "available",
            category: generalForm.category || "",
            quantity: generalForm.quantity ? parseInt(generalForm.quantity, 10) : 1,
            brand: generalForm.brand || "",
            condition: generalForm.condition || "",
            color1: generalForm.color1 || "",
            color2: generalForm.color2 || "",
            color3: generalForm.color3 || "",
            sku: generalForm.sku || "",
            zip_code: generalForm.zip || "",
            size: generalForm.size || "",
            package_details: generalForm.packageDetails || "",
            package_weight: generalForm.packageWeight || "",
            package_length: generalForm.packageLength || "",
            package_width: generalForm.packageWidth || "",
            package_height: generalForm.packageHeight || "",
            custom_labels: generalForm.customLabels || "",
            image_url: imageUrl,
            notes: generalForm.description || "",
          };

          const createdItem = await base44.entities.InventoryItem.create(inventoryData);

          if (createdItem?.id) {
            const allLabels = [...customLabels, ...tags];
            for (const label of allLabels) {
              addTag(createdItem.id, label);
            }
            
            // Update currentEditingItemId so future saves don't create duplicates
            setCurrentEditingItemId(createdItem.id);
          }

          queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

          toast({
            title: "General template saved",
            description: "Your preferences have been saved, synced to marketplace forms, and the item has been added to inventory.",
          });
        } catch (error) {
          console.error("Error saving item to inventory:", error);
          toast({
            title: "Template saved (inventory save failed)",
            description: "Your preferences have been saved, but there was an error adding the item to inventory. You can add it manually later.",
            variant: "destructive",
          });
        } finally {
          setIsSaving(false);
        }
      } else {
        // Existing item - just show success message
        toast({
          title: "General template saved",
          description: "Your preferences have been saved and automatically synced to all marketplace forms.",
        });
      }
    } else {
      // Save individual marketplace template (per-item if editing, or as template for new items)
      const marketplaceForm = templateForms[templateKey];
      if (marketplaceForm) {
        saveTemplateToStorage(templateKey, marketplaceForm, itemId);
        toast({
          title: `${label} ${itemId ? 'saved' : 'template saved'}`,
          description: itemId 
            ? `Your ${label.toLowerCase()} preferences have been saved for this item.` 
            : "Your preferences will be used the next time you compose a listing.",
        });
      }
    }
  };
  
  const validateEbayForm = () => {
    const errors = [];
    if (!ebayForm.handlingTime) errors.push("Handling Time");
    if (!ebayForm.shippingService) errors.push("Shipping Service");
    if (!ebayForm.shippingCostType) errors.push("Shipping Cost Type");
    if (!ebayForm.shippingMethod) errors.push("Shipping Method");
    if (!ebayForm.pricingFormat) errors.push("Pricing Format");
    if (!ebayForm.duration) errors.push("Duration");
    if (!ebayForm.buyItNowPrice) errors.push("Buy It Now Price");
    if (!ebayForm.color) errors.push("Color");
    if (!ebayForm.categoryId) errors.push("Category");
    if (ebayForm.categoryId && !ebayForm.itemType) errors.push("Model (Type)");
    if (!ebayForm.condition) errors.push("Condition");
    if (!ebayForm.shippingCost) errors.push("Shipping Cost");
    if (!ebayForm.acceptReturns) errors.push("Accept Returns");
    if (ebayForm.acceptReturns) {
      if (!ebayForm.returnWithin) errors.push("Return Within");
      if (!ebayForm.returnShippingPayer) errors.push("Return Shipping Payer");
      if (!ebayForm.returnRefundMethod) errors.push("Return Refund Method");
    }
    if (!generalForm.title) errors.push("Title");
    // Check eBay brand, fallback to general brand
    if (!ebayForm.ebayBrand && !generalForm.brand) {
      errors.push("eBay Brand");
    }
    if (!generalForm.quantity) errors.push("Quantity");
    return errors;
  };
  
  const handleListOnMarketplace = async (marketplace) => {
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

      try {
        setIsSaving(true);

        // Prepare listing data
        const listingData = {
          title: generalForm.title,
          description: generalForm.description || '',
          categoryId: ebayForm.categoryId,
          price: ebayForm.buyItNowPrice || generalForm.price,
          quantity: parseInt(generalForm.quantity) || 1,
          photos: generalForm.photos || [],
          condition: generalForm.condition || 'new',
          brand: generalForm.brand || ebayForm.ebayBrand || '',
          itemType: ebayForm.itemType || '',
          shippingMethod: ebayForm.shippingMethod,
          shippingCost: ebayForm.shippingCost,
          shippingService: ebayForm.shippingService,
          handlingTime: ebayForm.handlingTime,
          shipFromCountry: ebayForm.shipFromCountry || 'United States',
          acceptReturns: ebayForm.acceptReturns,
          returnWithin: ebayForm.returnWithin,
          returnShippingPayer: ebayForm.returnShippingPayer,
          returnRefundMethod: ebayForm.returnRefundMethod,
          duration: ebayForm.duration,
          allowBestOffer: ebayForm.allowBestOffer,
          sku: generalForm.sku || '',
        };

        // Call eBay listing API
        const response = await fetch('/api/ebay/listing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'AddFixedPriceItem',
            listingData,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.Ack === 'Success' || result.Ack === 'Warning') {
          // Update inventory item status if we have a current item
          if (currentEditingItemId) {
            try {
              await base44.entities.InventoryItem.update(currentEditingItemId, {
                status: 'listed',
              });
              queryClient.invalidateQueries(['inventoryItems']);
            } catch (updateError) {
              console.error('Error updating inventory item:', updateError);
            }
          }

          toast({
            title: "Listing created successfully!",
            description: result.ItemID ? `eBay Item ID: ${result.ItemID}` : "Your item has been listed on eBay.",
          });

          // Optionally navigate back or clear form
          // navigate(createPageUrl('Inventory'));
        } else {
          throw new Error(result.Errors?.join(', ') || 'Failed to create listing');
        }

      } catch (error) {
        console.error('Error creating eBay listing:', error);
        toast({
          title: "Failed to create listing",
          description: error.message || "An error occurred while creating the listing. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }

      return;
    }

    // For other marketplaces, show coming soon
    toast({
      title: `List on ${TEMPLATE_DISPLAY_NAMES[marketplace] || marketplace}`,
      description: "Listing functionality coming soon!",
    });
  };

  const handleCrosslist = async (marketplaces) => {
    // List on multiple marketplaces
    const marketplacesToUse = marketplaces || ["ebay", "etsy", "mercari", "facebook"];
    const results = [];
    const errors = [];

    setIsSaving(true);

    try {
      // Validate all required forms first
      if (marketplacesToUse.includes("ebay")) {
        const ebayErrors = validateEbayForm();
        if (ebayErrors.length > 0) {
          toast({
            title: "Missing required fields for eBay",
            description: `Please fill in: ${ebayErrors.join(", ")}`,
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      }

      // List on each marketplace
      for (const marketplace of marketplacesToUse) {
        try {
          if (marketplace === "ebay") {
            // Prepare eBay listing data
            const listingData = {
              title: generalForm.title,
              description: generalForm.description || '',
              categoryId: ebayForm.categoryId,
              price: ebayForm.buyItNowPrice || generalForm.price,
              quantity: parseInt(generalForm.quantity) || 1,
              photos: generalForm.photos || [],
              condition: generalForm.condition || 'new',
              brand: generalForm.brand || ebayForm.ebayBrand || '',
              itemType: ebayForm.itemType || '',
              shippingMethod: ebayForm.shippingMethod,
              shippingCost: ebayForm.shippingCost,
              shippingService: ebayForm.shippingService,
              handlingTime: ebayForm.handlingTime,
              shipFromCountry: ebayForm.shipFromCountry || 'United States',
              acceptReturns: ebayForm.acceptReturns,
              returnWithin: ebayForm.returnWithin,
              returnShippingPayer: ebayForm.returnShippingPayer,
              returnRefundMethod: ebayForm.returnRefundMethod,
              duration: ebayForm.duration,
              allowBestOffer: ebayForm.allowBestOffer,
              sku: generalForm.sku || '',
            };

            const response = await fetch('/api/ebay/listing', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                operation: 'AddFixedPriceItem',
                listingData,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.Ack === 'Success' || result.Ack === 'Warning') {
              results.push({ marketplace, itemId: result.ItemID });
            } else {
              throw new Error(result.Errors?.join(', ') || 'Failed to create listing');
            }
          } else {
            // For other marketplaces, just mark as coming soon for now
            errors.push({ marketplace, error: 'Not yet implemented' });
          }
        } catch (error) {
          console.error(`Error listing on ${marketplace}:`, error);
          errors.push({ marketplace, error: error.message });
        }
      }

      // Update inventory item status if all listings succeeded
      if (results.length > 0 && currentEditingItemId) {
        try {
          await base44.entities.InventoryItem.update(currentEditingItemId, {
            status: 'listed',
          });
          queryClient.invalidateQueries(['inventoryItems']);
        } catch (updateError) {
          console.error('Error updating inventory item:', updateError);
        }
      }

      if (results.length > 0) {
        toast({
          title: "Crosslisted successfully!",
          description: `Listed on ${results.length} marketplace${results.length === 1 ? '' : 's'}: ${results.map(r => r.marketplace).join(', ')}`,
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Some listings failed",
          description: `Failed to list on: ${errors.map(e => e.marketplace).join(', ')}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  const MAX_PHOTOS = 25;
  const MAX_FILE_SIZE_MB = 15;
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  
  // Generic photo upload handler for any marketplace form
  const handlePhotoUpload = async (event, marketplace = 'general') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingPhotos(true);

    try {
      const formPhotos = marketplace === 'general' 
        ? generalForm.photos 
        : templateForms[marketplace]?.photos || [];
      const currentPhotoCount = formPhotos?.length || 0;
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
      const processedPhotos = [];
      
      for (const file of filesArray) {
        const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
        
        if (file.size > maxSizeBytes) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit. Compressing...`,
          });
        }

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
          file: processedFile,
          fromInventory: false,
        });
      }

      if (processedPhotos.length === 0) {
        return;
      }

      setTemplateForms((prev) => {
        const updated = { ...prev };
        if (marketplace === 'general') {
          updated.general = {
            ...prev.general,
            photos: [...(prev.general.photos || []), ...processedPhotos],
          };
        } else {
          updated[marketplace] = {
            ...prev[marketplace],
            photos: [...(prev[marketplace]?.photos || []), ...processedPhotos],
          };
        }
        return updated;
      });

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
      const refMap = {
        'general': photoInputRef,
        'ebay': ebayPhotoInputRef,
        'etsy': etsyPhotoInputRef,
        'mercari': mercariPhotoInputRef,
        'facebook': facebookPhotoInputRef,
      };
      const ref = refMap[marketplace];
      if (ref?.current) {
        ref.current.value = "";
      }
    }
  };
  
  // Generic photo remove handler for any marketplace form
  const handlePhotoRemove = (photoId, marketplace = 'general') => {
    setTemplateForms((prev) => {
      const formPhotos = marketplace === 'general' 
        ? prev.general.photos 
        : prev[marketplace]?.photos || [];
      const targetPhoto = formPhotos.find((photo) => photo.id === photoId);
      if (targetPhoto && !targetPhoto.fromInventory && targetPhoto.preview.startsWith("blob:")) {
        URL.revokeObjectURL(targetPhoto.preview);
      }
      
      const updated = { ...prev };
      if (marketplace === 'general') {
        updated.general = {
          ...prev.general,
          photos: prev.general.photos.filter((photo) => photo.id !== photoId),
        };
      } else {
        updated[marketplace] = {
          ...prev[marketplace],
          photos: (prev[marketplace]?.photos || []).filter((photo) => photo.id !== photoId),
        };
      }
      return updated;
    });
  };

  // Generic delete all photos handler for any marketplace form
  const handleDeleteAllPhotos = (marketplace = 'general') => {
    setTemplateForms((prev) => {
      const formPhotos = marketplace === 'general' 
        ? prev.general.photos 
        : prev[marketplace]?.photos || [];
      // Revoke blob URLs for all non-inventory photos
      formPhotos.forEach((photo) => {
        if (!photo.fromInventory && photo.preview.startsWith("blob:")) {
          URL.revokeObjectURL(photo.preview);
        }
      });
      
      const updated = { ...prev };
      if (marketplace === 'general') {
        updated.general = {
          ...prev.general,
          photos: [],
        };
      } else {
        updated[marketplace] = {
          ...prev[marketplace],
          photos: [],
        };
      }
      return updated;
    });
  };

  const handlePhotoReorder = (dragIndex, dropIndex) => {
    setTemplateForms((prev) => {
      const photos = [...prev.general.photos];
      const [draggedPhoto] = photos.splice(dragIndex, 1);
      photos.splice(dropIndex, 0, draggedPhoto);
      const general = {
        ...prev.general,
        photos,
      };
      return {
        ...prev,
        general,
      };
    });
  };
  
  const handleSaveToInventory = async () => {
    setIsSaving(true);
    try {
      // Upload first photo if available
      let imageUrl = "";
      if (generalForm.photos && generalForm.photos.length > 0) {
        const firstPhoto = generalForm.photos[0];
        if (firstPhoto.file) {
          const uploadPayload = firstPhoto.file instanceof File 
            ? firstPhoto.file 
            : new File([firstPhoto.file], firstPhoto.fileName, { type: firstPhoto.file.type });
          
          const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
          imageUrl = file_url;
        } else if (firstPhoto.preview && !firstPhoto.preview.startsWith('blob:')) {
          imageUrl = firstPhoto.preview;
        }
      }

      const customLabels = generalForm.customLabels
        ? generalForm.customLabels.split(',').map(label => label.trim()).filter(Boolean)
        : [];

      const tags = generalForm.tags
        ? generalForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

      const inventoryData = {
        item_name: generalForm.title || "Untitled Item",
        purchase_price: generalForm.cost ? parseFloat(generalForm.cost) : 0,
        listing_price: generalForm.price ? parseFloat(generalForm.price) : 0,
        purchase_date: new Date().toISOString().split('T')[0],
        source: "Crosslist",
        status: "available",
        category: generalForm.category || "",
        quantity: generalForm.quantity ? parseInt(generalForm.quantity, 10) : 1,
        brand: generalForm.brand || "",
        condition: generalForm.condition || "",
        color1: generalForm.color1 || "",
        color2: generalForm.color2 || "",
        color3: generalForm.color3 || "",
        sku: generalForm.sku || "",
        zip_code: generalForm.zip || "",
        size: generalForm.size || "",
        package_details: generalForm.packageDetails || "",
        package_weight: generalForm.packageWeight || "",
        package_length: generalForm.packageLength || "",
        package_width: generalForm.packageWidth || "",
        package_height: generalForm.packageHeight || "",
        custom_labels: generalForm.customLabels || "",
        image_url: imageUrl,
        notes: generalForm.description || "",
      };

      const createdItem = await base44.entities.InventoryItem.create(inventoryData);

      if (createdItem?.id) {
        const allLabels = [...customLabels, ...tags];
        for (const label of allLabels) {
          addTag(createdItem.id, label);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

      toast({
        title: "Item saved to inventory",
        description: `${generalForm.title || "Item"} has been added to your inventory.`,
      });

      navigate(createPageUrl("Crosslist"));
    } catch (error) {
      console.error("Error saving inventory item:", error);
      toast({
        title: "Failed to save item",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("Crosslist"))}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Crosslist
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {bulkSelectedItems.length > 1 ? "Bulk Crosslist" : "Compose Listing"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {bulkSelectedItems.length > 1
                ? `Editing ${bulkSelectedItems.length} items. Select an item to configure its listing.`
                : "Choose marketplaces and set the base fields. Full per-market fine-tuning can follow."}
            </p>
          </div>
        </div>

        {/* Bulk item selector */}
        {bulkSelectedItems.length > 1 && (
          <div className="space-y-3">
            <Label className="text-xs mb-1.5 block">Select Item to Edit</Label>
            <div className="flex flex-wrap gap-2">
              {bulkSelectedItems.map((item) => {
                const isCurrent = currentEditingItemId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchToItem(item.id)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                      isCurrent
                        ? "border-primary bg-primary/10 ring-2 ring-primary"
                        : "border-muted-foreground/40 hover:border-primary/50 bg-muted/30"
                    }`}
                  >
                    <img
                      src={item.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                      alt={item.item_name}
                      className="w-16 h-16 rounded-md object-cover"
                    />
                    <span className={`text-xs text-center max-w-[80px] truncate ${
                      isCurrent ? "font-semibold text-primary" : "text-muted-foreground"
                    }`}>
                      {item.item_name}
                    </span>
                    {isCurrent && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {currentEditingItemId && (
              <Alert className="bg-primary/10 border-primary/20">
                <AlertDescription className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">
                    You are currently editing: {bulkSelectedItems.find(item => item.id === currentEditingItemId)?.item_name || "Unknown Item"}
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Form selector */}
        <div>
          <Label className="text-xs mb-1.5 block">Select Form</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveForm("general")}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition
                ${activeForm === "general"
                  ? "bg-foreground text-background dark:bg-foreground dark:text-background"
                  : "bg-muted/70 hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/60 text-foreground"
                }`}
            >
              General
            </button>
            {MARKETPLACES.map((m) => {
              const active = activeForm === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveForm(m.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition
                    ${active
                      ? "bg-foreground text-background dark:bg-foreground dark:text-background"
                      : "bg-muted/70 hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/60 text-foreground"
                    }`}
                >
                  {renderMarketplaceIcon(m)}
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Select a form to configure. General form data syncs to all marketplace-specific forms.
          </p>
        </div>

        {/* Form Content */}
        <div className="mt-6 space-y-6">
          {/* General Form */}
          {activeForm === "general" && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                  {generalForm.photos && generalForm.photos.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteAllPhotos}
                      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Delete All
                    </Button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                  {/* Main Photo - spans 2 columns and 2 rows */}
                  {generalForm.photos.length > 0 && (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", "0");
                        e.currentTarget.classList.add("opacity-50");
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        const dropIndex = 0;
                        if (dragIndex !== dropIndex) {
                          handlePhotoReorder(dragIndex, dropIndex);
                        }
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                    >
                      <img src={generalForm.photos[0].preview} alt={generalForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                      <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                        Main
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePhotoRemove(generalForm.photos[0].id);
                        }}
                        className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove photo</span>
                      </button>
                    </div>
                  )}
                  
                  {/* Other Photos */}
                  {generalForm.photos.slice(1).map((photo, index) => (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(index + 1));
                        e.currentTarget.classList.add("opacity-50");
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        const dropIndex = index + 1;
                        if (dragIndex !== dropIndex) {
                          handlePhotoReorder(dragIndex, dropIndex);
                        }
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                    >
                      <img src={photo.preview} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                      <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                        <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePhotoRemove(photo.id);
                        }}
                        className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                      >
                        <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        <span className="sr-only">Remove photo</span>
                      </button>
                    </div>
                  ))}
                  
                  {/* Add Photo Button */}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhotos || (generalForm.photos?.length || 0) >= MAX_PHOTOS}
                    className="flex aspect-square flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 text-muted-foreground transition hover:border-foreground/80 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ImagePlus className="h-3 w-3 md:h-5 md:w-5" />
                    <span className="mt-0.5 text-[9px] md:text-[11px] font-medium">Add photos</span>
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {generalForm.photos?.length || 0}/{MAX_PHOTOS} used.
                  {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Title</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder=""
                      value={generalForm.title}
                      onChange={(e) => handleGeneralChange("title", e.target.value)}
                      className="w-full"
                    />
                    {generalForm.title?.trim() && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
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
                <div>
                  <Label className="text-xs mb-1.5 block">Listing Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={generalForm.price}
                    onChange={(e) => handleGeneralChange("price", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Price you'll list this item for</p>
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <Textarea
                    placeholder=""
                    value={generalForm.description}
                    onChange={(e) => handleGeneralChange("description", e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter brand name"
                        value={generalForm.brand}
                        onChange={(e) => handleGeneralChange("brand", e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleGeneralChange("brand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={generalForm.brand || undefined}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setBrandIsCustom(true);
                          handleGeneralChange("brand", "");
                        } else {
                          handleGeneralChange("brand", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select or Custom" />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Add Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Condition</Label>
                  <Select
                    value={generalForm.condition || undefined}
                    onValueChange={(value) => {
                      handleGeneralChange("condition", value);
                      // Map condition to eBay form
                      const ebayCondition = mapGeneralConditionToEbay(value);
                      if (ebayCondition) {
                        handleMarketplaceChange("ebay", "condition", ebayCondition);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New With Tags/Box">New With Tags/Box</SelectItem>
                      <SelectItem value="New Without Tags/Box">New Without Tags/Box</SelectItem>
                      <SelectItem value="New With Imperfections">New With Imperfections</SelectItem>
                      <SelectItem value="Pre - Owned - Excellent">Pre - Owned - Excellent</SelectItem>
                      <SelectItem value="Pre - Owned - Good">Pre - Owned - Good</SelectItem>
                      <SelectItem value="Pre - Owned - Fair">Pre - Owned - Fair</SelectItem>
                      <SelectItem value="Poor (Major flaws)">Poor (Major flaws)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    placeholder=""
                    value={generalForm.sku}
                    onChange={(e) => handleGeneralChange("sku", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Zip Code</Label>
                  <Input
                    placeholder="Enter Zip Code"
                    value={generalForm.zip}
                    onChange={(e) => handleGeneralChange("zip", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={generalForm.quantity}
                    onChange={(e) => handleGeneralChange("quantity", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Category</Label>
                  
                  {/* Breadcrumb navigation for category path */}
                  {generalCategoryPath.length > 0 && (
                    <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => {
                          setGeneralCategoryPath([]);
                          handleGeneralChange("category", "");
                          handleGeneralChange("categoryId", "");
                        }}
                        className="hover:text-foreground underline"
                      >
                        Home
                      </button>
                      {generalCategoryPath.map((cat, index) => (
                        <React.Fragment key={cat.categoryId}>
                          <span>/</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newPath = generalCategoryPath.slice(0, index + 1);
                              setGeneralCategoryPath(newPath);
                              const lastCat = newPath[newPath.length - 1];
                              const fullPath = newPath.map(c => c.categoryName).join(" > ");
                              handleGeneralChange("category", fullPath);
                              if (lastCat?.categoryId) {
                                handleGeneralChange("categoryId", lastCat.categoryId);
                              }
                            }}
                            className="hover:text-foreground underline"
                          >
                            {cat.categoryName}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                  
                  {isLoadingCategoryTree || isLoadingCategories ? (
                    <div className="flex items-center gap-2 p-3 border rounded-md">
                      <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Loading categories...</span>
                    </div>
                  ) : categoriesError ? (
                    <div className="p-3 border rounded-md border-destructive/50 bg-destructive/10">
                      <p className="text-sm text-destructive">Error loading categories: {categoriesError.message}</p>
                      {categoriesError?.response?.details && (
                        <p className="text-xs text-destructive mt-2">
                          Details: {JSON.stringify(categoriesError.response.details)}
                        </p>
                      )}
                    </div>
                  ) : sortedCategories.length > 0 ? (
                    <Select
                      value={undefined}
                      onValueChange={(value) => {
                        const selectedCategory = sortedCategories.find(
                          cat => cat.category?.categoryId === value
                        );
                        
                        if (selectedCategory) {
                          const category = selectedCategory.category;
                          const newPath = [...generalCategoryPath, {
                            categoryId: category.categoryId,
                            categoryName: category.categoryName,
                          }];
                          
                          // Check if this category has children
                          const hasChildren = selectedCategory.childCategoryTreeNodes && 
                            selectedCategory.childCategoryTreeNodes.length > 0 &&
                            !selectedCategory.leafCategoryTreeNode;
                          
                          if (hasChildren) {
                            // Navigate deeper into the tree
                            setGeneralCategoryPath(newPath);
                          } else {
                            // This is a leaf node - select it
                            const fullPath = newPath.map(c => c.categoryName).join(" > ");
                            const categoryId = category.categoryId;
                            handleGeneralChange("category", fullPath);
                            handleGeneralChange("categoryId", categoryId);
                            setGeneralCategoryPath(newPath);
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalCategoryPath.length > 0 ? "Select subcategory" : "Select a category"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {sortedCategories.map((categoryNode) => {
                          const category = categoryNode.category;
                          if (!category || !category.categoryId) return null;
                          
                          const hasChildren = categoryNode.childCategoryTreeNodes && 
                            categoryNode.childCategoryTreeNodes.length > 0 &&
                            !categoryNode.leafCategoryTreeNode;
                          
                          return (
                            <SelectItem key={category.categoryId} value={category.categoryId}>
                              <div className="flex items-center gap-2">
                                <span>{category.categoryName}</span>
                                {hasChildren && (
                                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 border rounded-md">
                      <p className="text-sm text-muted-foreground">No subcategories available.</p>
                    </div>
                  )}
                  
                  {generalForm.category && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        Selected: {generalForm.category}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleGeneralChange("category", "");
                          setGeneralCategoryPath([]);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">US Size</Label>
                  <Input
                    placeholder="e.g. Men's M, 10, XL"
                    value={generalForm.size}
                    onChange={(e) => handleGeneralChange("size", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Tags</Label>
                  <TagInput
                    placeholder="Type keywords and press space or comma to add tags (used for Mercari and Facebook)"
                    value={generalForm.tags}
                    onChange={(value) => handleGeneralChange("tags", value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Primary Color</Label>
                  <Button
                    type="button"
                    variant={generalForm.color1 ? "default" : "outline"}
                    onClick={() => openColorPicker("color1")}
                    className="w-full justify-start"
                  >
                    {generalForm.color1 ? (
                      <>
                        <div
                          className="w-4 h-4 mr-2 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0"
                          style={{ backgroundColor: getColorHex(generalForm.color1) || "#808080" }}
                        />
                        <span className="flex-1 text-left">{getColorName(generalForm.color1)}</span>
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
                        <span>Select color</span>
                      </>
                    )}
                  </Button>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Secondary Color</Label>
                  <Button
                    type="button"
                    variant={generalForm.color2 ? "default" : "outline"}
                    onClick={() => openColorPicker("color2")}
                    className="w-full justify-start"
                  >
                    {generalForm.color2 ? (
                      <>
                        <div
                          className="w-4 h-4 mr-2 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0"
                          style={{ backgroundColor: getColorHex(generalForm.color2) || "#808080" }}
                        />
                        <span className="flex-1 text-left">{getColorName(generalForm.color2)}</span>
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
                        <span>Select color</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Package Details <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant={generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight ? "default" : "outline"}
                    onClick={() => setPackageDetailsDialogOpen(true)}
                    className="w-full justify-start"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight
                      ? `${generalForm.packageWeight} lbs • ${generalForm.packageLength}" × ${generalForm.packageWidth}" × ${generalForm.packageHeight}"`
                      : "Enter weight & size"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-xs mb-1.5 block">Purchase Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={generalForm.cost}
                      onChange={(e) => handleGeneralChange("cost", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Custom Labels</Label>
                    <Input
                      placeholder="Comma-separated labels (e.g. Q4 Liquidation, Holiday Gift). These will appear as tags in inventory."
                      value={generalForm.customLabels}
                      onChange={(e) => handleGeneralChange("customLabels", e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Custom labels will be saved as tags in your inventory page
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("general")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* eBay Form */}
          {activeForm === "ebay" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">eBay listing specifics</h3>
                  <p className="text-sm text-muted-foreground">
                    Media, title, description, and pricing inherit from your General template.
                  </p>
                </div>
              </div>

              {/* Photos and Title Section */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                    {(ebayForm.photos?.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAllPhotos('ebay')}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {ebayForm.photos?.length > 0 && ebayForm.photos.map((photo, index) => (
                      <div
                        key={photo.id || index}
                        className="relative aspect-square overflow-hidden rounded-lg border border-muted-foreground/40 bg-muted cursor-move"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || `Photo ${index + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handlePhotoRemove(photo.id, 'ebay')}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => ebayPhotoInputRef.current?.click()}
                      disabled={isUploadingPhotos || (ebayForm.photos?.length || 0) >= MAX_PHOTOS}
                      className="flex aspect-square flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 text-muted-foreground transition hover:border-foreground/80 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ImagePlus className="h-3 w-3 md:h-5 md:w-5" />
                      <span className="mt-0.5 text-[9px] md:text-[11px] font-medium">Add photos</span>
                    </button>
                    <input
                      ref={ebayPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'ebay')}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {ebayForm.photos?.length || 0}/{MAX_PHOTOS} used.
                    {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                  </p>
                </div>

                {/* Title Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    placeholder="Enter listing title"
                    value={ebayForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <Textarea
                    placeholder={ebayForm.inheritGeneral && generalForm.description ? `Inherits: ${generalForm.description.substring(0, 50)}...` : ""}
                    value={ebayForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "description", e.target.value)}
                    className="min-h-[120px]"
                    disabled={Boolean(generalForm.description)}
                  />
                  {ebayForm.inheritGeneral && generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherits description from General form.
                    </p>
                  )}
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Pricing Format <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.pricingFormat}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "pricingFormat", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Price</SelectItem>
                      <SelectItem value="auction">Auction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Duration <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.duration}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "duration", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good 'Til Canceled">Good 'Til Canceled</SelectItem>
                      <SelectItem value="30 Days">30 Days</SelectItem>
                      <SelectItem value="7 Days">7 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Buy It Now Price <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={generalForm.price || "0.00"}
                    value={ebayForm.buyItNowPrice}
                    onChange={(e) => handleMarketplaceChange("ebay", "buyItNowPrice", e.target.value)}
                    disabled={Boolean(generalForm.price)}
                  />
                  {ebayForm.inheritGeneral && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherits {generalForm.price ? `$${generalForm.price}` : "General price"} from General form.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Allow Best Offer</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="ebay-best-offer"
                      checked={ebayForm.allowBestOffer}
                      onCheckedChange={(checked) => handleMarketplaceChange("ebay", "allowBestOffer", checked)}
                    />
                    <Label htmlFor="ebay-best-offer" className="text-sm">Allow buyers to submit offers</Label>
                  </div>
                </div>
                {/* eBay Brand - use same dropdown as general form */}
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Brand <span className="text-red-500">*</span></Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter brand name"
                        value={ebayForm.ebayBrand || ""}
                        onChange={(e) => handleMarketplaceChange("ebay", "ebayBrand", e.target.value)}
                        className="flex-1"
                        disabled={Boolean(generalForm.brand)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleMarketplaceChange("ebay", "ebayBrand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={ebayForm.ebayBrand || generalForm.brand || undefined}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setBrandIsCustom(true);
                          handleMarketplaceChange("ebay", "ebayBrand", "");
                        } else {
                          handleMarketplaceChange("ebay", "ebayBrand", value);
                        }
                      }}
                      disabled={Boolean(generalForm.brand)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalForm.brand ? `Inherits: ${generalForm.brand}` : "Select or Custom"} />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Add Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Condition Dropdown - Always visible */}
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Condition <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={ebayForm.condition || undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "condition", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Open Box">Open Box</SelectItem>
                      <SelectItem value="Used">Used</SelectItem>
                      <SelectItem value="For parts or not working">For parts or not working</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Specifics Section */}
                {ebayForm.categoryId && (
                  <div className="md:col-span-2 space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Category Specifics</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Reload category aspects
                          queryClient.invalidateQueries(['ebayCategoryAspects', categoryTreeId, ebayForm.categoryId]);
                        }}
                        className="gap-2 h-7 text-xs"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reload
                      </Button>
                    </div>
                    
                    {/* Model Dropdown */}
                    {typeValues.length > 0 && (
                      <div>
                        <Label className="text-xs mb-1.5 block">
                          Model <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={ebayForm.itemType || undefined}
                          onValueChange={(value) => handleMarketplaceChange("ebay", "itemType", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {typeValues.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* SKU Field */}
                <div>
                  <Label className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    placeholder={generalForm.sku || "Enter SKU"}
                    value={ebayForm.sku || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "sku", e.target.value)}
                    disabled={Boolean(generalForm.sku)}
                  />
                  {generalForm.sku && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherits {generalForm.sku} from General form.
                    </p>
                  )}
                </div>
              </div>

              {/* Save Default Button for Shipping Fields */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Shipping Settings</Label>
                </div>
                <div className="group relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveShippingDefaults}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                  <div className="absolute right-0 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50">
                    <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md shadow-lg border whitespace-nowrap">
                      Save Default
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Method <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.shippingMethod}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Calculated">Calculated Shipping</SelectItem>
                      <SelectItem value="Flat">Flat Rate Shipping</SelectItem>
                      <SelectItem value="Local pickup">Local Pickup Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Cost Type <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.shippingCostType}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingCostType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calculated">Calculated</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="freight">Freight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Cost <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={ebayForm.shippingCost}
                    onChange={(e) => handleMarketplaceChange("ebay", "shippingCost", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Handling Time <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.handlingTime}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "handlingTime", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 business day">1 business day</SelectItem>
                      <SelectItem value="2 business days">2 business days</SelectItem>
                      <SelectItem value="3 business days">3 business days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Ship From Country</Label>
                  <Select
                    value={ebayForm.shipFromCountry || "United States"}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shipFromCountry", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Service <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.shippingService}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingService", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard Shipping (3 to 5 business days)">Standard Shipping (3 to 5 business days)</SelectItem>
                      <SelectItem value="Expedited Shipping (1 to 3 business days)">Expedited Shipping (1 to 3 business days)</SelectItem>
                      <SelectItem value="USPS Priority Mail">USPS Priority Mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Location</Label>
                  <Input
                    placeholder={generalForm.zip || "Zip or region"}
                    value={ebayForm.shippingLocation}
                    disabled={Boolean(generalForm.zip)}
                    onChange={(e) => handleMarketplaceChange("ebay", "shippingLocation", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Accept Returns <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="ebay-accept-returns"
                      checked={ebayForm.acceptReturns}
                      onCheckedChange={(checked) => handleMarketplaceChange("ebay", "acceptReturns", checked)}
                    />
                    <Label htmlFor="ebay-accept-returns" className="text-sm">Accept returns</Label>
                  </div>
                </div>
                
                {/* Return fields - shown when Accept Returns is enabled */}
                {ebayForm.acceptReturns && (
                  <>
                    <div>
                      <Label className="text-xs mb-1.5 block">Return Within <span className="text-red-500">*</span></Label>
                      <Select
                        value={ebayForm.returnWithin || "30 days"}
                        onValueChange={(value) => handleMarketplaceChange("ebay", "returnWithin", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30 days">30 days</SelectItem>
                          <SelectItem value="60 days">60 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block">Return Shipping Payer <span className="text-red-500">*</span></Label>
                      <Select
                        value={ebayForm.returnShippingPayer || "Buyer"}
                        onValueChange={(value) => handleMarketplaceChange("ebay", "returnShippingPayer", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Buyer">Buyer</SelectItem>
                          <SelectItem value="Free for buyer, you pay">Free for buyer, you pay</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block">Return Refund Method <span className="text-red-500">*</span></Label>
                      <Select
                        value={ebayForm.returnRefundMethod || "Full Refund"}
                        onValueChange={(value) => handleMarketplaceChange("ebay", "returnRefundMethod", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full Refund">Full Refund</SelectItem>
                          <SelectItem value="Full Refund or Replacement">Full Refund or Replacement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <div>
                  <Label className="text-xs mb-1.5 block">Color <span className="text-red-500">*</span></Label>
                  <Button
                    type="button"
                    variant={ebayForm.color ? "default" : "outline"}
                    onClick={() => openColorPicker("ebay.color")}
                    className="w-full justify-start"
                  >
                    {ebayForm.color ? (
                      <>
                        <div
                          className="w-4 h-4 mr-2 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0"
                          style={{ backgroundColor: getColorHex(ebayForm.color) || "#808080" }}
                        />
                        <span className="flex-1 text-left">{getColorName(ebayForm.color)}</span>
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
                        <span>Select color</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Category <span className="text-red-500">*</span></Label>
                  <div className="space-y-2">
                    {/* Breadcrumb navigation */}
                    {selectedCategoryPath.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategoryPath([]);
                            handleMarketplaceChange("ebay", "categoryId", "");
                            handleMarketplaceChange("ebay", "categoryName", "");
                          }}
                          className="hover:text-foreground underline"
                        >
                          Home
                        </button>
                        {selectedCategoryPath.map((cat, index) => (
                          <React.Fragment key={cat.categoryId}>
                            <span>/</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newPath = selectedCategoryPath.slice(0, index + 1);
                                setSelectedCategoryPath(newPath);
                                const lastCat = newPath[newPath.length - 1];
                                const fullPath = newPath.map(c => c.categoryName).join(" > ");
                                handleMarketplaceChange("ebay", "categoryId", lastCat.categoryId);
                                handleMarketplaceChange("ebay", "categoryName", fullPath);
                              }}
                              className="hover:text-foreground underline"
                            >
                              {cat.categoryName}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    
                    {isLoadingCategoryTree || isLoadingCategories ? (
                      <div className="flex items-center gap-2 p-3 border rounded-md">
                        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading categories...</span>
                      </div>
                    ) : categoriesError ? (
                      <div className="p-3 border rounded-md border-destructive/50 bg-destructive/10">
                        <p className="text-sm text-destructive">Error loading categories: {categoriesError.message}</p>
                        {categoriesError?.response?.details && (
                          <p className="text-xs text-destructive mt-2">
                            Details: {JSON.stringify(categoriesError.response.details)}
                          </p>
                        )}
                      </div>
                    ) : sortedCategories.length > 0 ? (
                      <Select
                        value={ebayForm.categoryId || undefined}
                        onValueChange={(value) => {
                          const selectedCategory = sortedCategories.find(
                            cat => cat.category?.categoryId === value
                          );
                          
                          if (selectedCategory) {
                            const category = selectedCategory.category;
                            const newPath = [...selectedCategoryPath, {
                              categoryId: category.categoryId,
                              categoryName: category.categoryName,
                            }];
                            
                            // Check if this category has children
                            const hasChildren = selectedCategory.childCategoryTreeNodes && 
                              selectedCategory.childCategoryTreeNodes.length > 0 &&
                              !selectedCategory.leafCategoryTreeNode;
                            
                            if (hasChildren) {
                              // Navigate deeper into the tree
                              setSelectedCategoryPath(newPath);
                            } else {
                              // This is a leaf node - select it
                              const fullPath = newPath.map(c => c.categoryName).join(" > ");
                              handleMarketplaceChange("ebay", "categoryId", category.categoryId);
                              handleMarketplaceChange("ebay", "categoryName", fullPath);
                              setSelectedCategoryPath(newPath);
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={selectedCategoryPath.length > 0 ? "Select subcategory" : "Select a category"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {sortedCategories.map((categoryNode) => {
                            const category = categoryNode.category;
                            if (!category || !category.categoryId) return null;
                            
                            const hasChildren = categoryNode.childCategoryTreeNodes && 
                              categoryNode.childCategoryTreeNodes.length > 0 &&
                              !categoryNode.leafCategoryTreeNode;
                            
                            return (
                              <SelectItem key={category.categoryId} value={category.categoryId}>
                                <div className="flex items-center gap-2">
                                  <span>{category.categoryName}</span>
                                  {hasChildren && (
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 border rounded-md">
                        <p className="text-sm text-muted-foreground">No subcategories available.</p>
                      </div>
                    )}
                    
                    {ebayForm.categoryName && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          Selected: {ebayForm.categoryName}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleMarketplaceChange("ebay", "categoryId", "");
                            handleMarketplaceChange("ebay", "categoryName", "");
                            setSelectedCategoryPath([]);
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Type field - shown when category is selected */}
                {ebayForm.categoryId && typeAspect && typeValues.length > 0 && (
                  <div>
                    <Label className="text-xs mb-1.5 block">
                      Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={ebayForm.itemType || undefined}
                      onValueChange={(value) => handleMarketplaceChange("ebay", "itemType", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {typeValues.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Keep the eBay connection fresh before pushing drafts.
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("ebay")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect eBay
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("ebay")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button className="gap-2" onClick={() => handleListOnMarketplace("ebay")}>
                  List on eBay
                </Button>
              </div>
            </div>
          )}

          {/* Etsy Form */}
          {activeForm === "etsy" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Etsy listing profile</h3>
                  <p className="text-sm text-muted-foreground">
                    Etsy loves rich listings—processing time and "who made it" details are required.
                  </p>
                </div>
              </div>

              {/* Photos and Title Section */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                    {(etsyForm.photos?.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAllPhotos('etsy')}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {etsyForm.photos?.length > 0 && etsyForm.photos.map((photo, index) => (
                      <div
                        key={photo.id || index}
                        className="relative aspect-square overflow-hidden rounded-lg border border-muted-foreground/40 bg-muted cursor-move"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || `Photo ${index + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handlePhotoRemove(photo.id, 'etsy')}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => etsyPhotoInputRef.current?.click()}
                      disabled={isUploadingPhotos || (etsyForm.photos?.length || 0) >= MAX_PHOTOS}
                      className="flex aspect-square flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 text-muted-foreground transition hover:border-foreground/80 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ImagePlus className="h-3 w-3 md:h-5 md:w-5" />
                      <span className="mt-0.5 text-[9px] md:text-[11px] font-medium">Add photos</span>
                    </button>
                    <input
                      ref={etsyPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'etsy')}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {etsyForm.photos?.length || 0}/{MAX_PHOTOS} used.
                    {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                  </p>
                </div>

                {/* Title Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    placeholder="Enter listing title"
                    value={etsyForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("etsy", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <Textarea
                    placeholder={generalForm.description ? `Inherits: ${generalForm.description.substring(0, 50)}...` : ""}
                    value={etsyForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("etsy", "description", e.target.value)}
                    className="min-h-[120px]"
                    disabled={Boolean(generalForm.description)}
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherits description from General form.
                    </p>
                  )}
                </div>

                {/* Brand Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter brand name"
                        value={etsyForm.brand || ""}
                        onChange={(e) => handleMarketplaceChange("etsy", "brand", e.target.value)}
                        className="flex-1"
                        disabled={Boolean(generalForm.brand)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleMarketplaceChange("etsy", "brand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={etsyForm.brand || generalForm.brand || undefined}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setBrandIsCustom(true);
                          handleMarketplaceChange("etsy", "brand", "");
                        } else {
                          handleMarketplaceChange("etsy", "brand", value);
                        }
                      }}
                      disabled={Boolean(generalForm.brand)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalForm.brand ? `Inherits: ${generalForm.brand}` : "Select or Custom"} />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Add Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* SKU Field */}
                <div>
                  <Label className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    placeholder={generalForm.sku || "Enter SKU"}
                    value={etsyForm.sku || ""}
                    onChange={(e) => handleMarketplaceChange("etsy", "sku", e.target.value)}
                    disabled={Boolean(generalForm.sku)}
                  />
                  {generalForm.sku && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherits {generalForm.sku} from General form.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Processing Time</Label>
                  <Select
                    value={etsyForm.processingTime}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "processingTime", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-2 business days">1-2 business days</SelectItem>
                      <SelectItem value="1-3 business days">1-3 business days</SelectItem>
                      <SelectItem value="3-5 business days">3-5 business days</SelectItem>
                      <SelectItem value="1-2 weeks">1-2 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Renewal Option</Label>
                  <Select
                    value={etsyForm.renewalOption}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "renewalOption", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="automatic">Automatic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Who made it?</Label>
                  <Select
                    value={etsyForm.whoMade}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "whoMade", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="i_did">I did</SelectItem>
                      <SelectItem value="collective">A member of my shop</SelectItem>
                      <SelectItem value="someone_else">Another company or person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">When was it made?</Label>
                  <Select
                    value={etsyForm.whenMade}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "whenMade", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2020s">2020s</SelectItem>
                      <SelectItem value="2010s">2010s</SelectItem>
                      <SelectItem value="2000s">2000s</SelectItem>
                      <SelectItem value="before_2000">Before 2000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Shipping Profile</Label>
                  <Input
                    placeholder="Link your saved Etsy shipping profile"
                    value={etsyForm.shippingProfile}
                    onChange={(e) => handleMarketplaceChange("etsy", "shippingProfile", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Tags</Label>
                  <TagInput
                    placeholder={etsyForm.inheritGeneral ? "Inherits general tags" : "Type keywords and press space or comma to add tags"}
                    value={etsyForm.tags}
                    onChange={(value) => handleMarketplaceChange("etsy", "tags", value)}
                    disabled={false}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Digital Download</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="etsy-digital"
                      checked={etsyForm.isDigital}
                      onCheckedChange={(checked) => handleMarketplaceChange("etsy", "isDigital", checked)}
                    />
                    <Label htmlFor="etsy-digital" className="text-sm">This is a digital product</Label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Etsy to refresh shipping profiles & shop policies.
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("etsy")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Etsy
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("etsy")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button className="gap-2" onClick={() => handleListOnMarketplace("etsy")}>
                  List on Etsy
                </Button>
              </div>
            </div>
          )}

          {/* Mercari Form */}
          {activeForm === "mercari" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Mercari smart pricing</h3>
                  <p className="text-sm text-muted-foreground">
                    Control smart pricing and shipping preferences for Mercari listings.
                  </p>
                </div>
              </div>

              {/* Photos and Title Section */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                    {(mercariForm.photos?.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAllPhotos('mercari')}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {mercariForm.photos?.length > 0 && mercariForm.photos.map((photo, index) => (
                      <div
                        key={photo.id || index}
                        className="relative aspect-square overflow-hidden rounded-lg border border-muted-foreground/40 bg-muted cursor-move"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || `Photo ${index + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handlePhotoRemove(photo.id, 'mercari')}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => mercariPhotoInputRef.current?.click()}
                      disabled={isUploadingPhotos || (mercariForm.photos?.length || 0) >= MAX_PHOTOS}
                      className="flex aspect-square flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 text-muted-foreground transition hover:border-foreground/80 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ImagePlus className="h-3 w-3 md:h-5 md:w-5" />
                      <span className="mt-0.5 text-[9px] md:text-[11px] font-medium">Add photos</span>
                    </button>
                    <input
                      ref={mercariPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'mercari')}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {mercariForm.photos?.length || 0}/{MAX_PHOTOS} used.
                    {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                  </p>
                </div>

                {/* Title Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    placeholder="Enter listing title"
                    value={mercariForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <Textarea
                    placeholder={mercariForm.inheritGeneral && generalForm.description ? `Inherits: ${generalForm.description.substring(0, 50)}...` : ""}
                    value={mercariForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "description", e.target.value)}
                    className="min-h-[120px]"
                    disabled={Boolean(generalForm.description)}
                  />
                  {mercariForm.inheritGeneral && generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherits description from General form.
                    </p>
                  )}
                </div>

                {/* Brand Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter brand name"
                        value={mercariForm.brand || ""}
                        onChange={(e) => handleMarketplaceChange("mercari", "brand", e.target.value)}
                        className="flex-1"
                        disabled={Boolean(generalForm.brand)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleMarketplaceChange("mercari", "brand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={mercariForm.brand || generalForm.brand || undefined}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setBrandIsCustom(true);
                          handleMarketplaceChange("mercari", "brand", "");
                        } else {
                          handleMarketplaceChange("mercari", "brand", value);
                        }
                      }}
                      disabled={Boolean(generalForm.brand)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={mercariForm.inheritGeneral && generalForm.brand ? `Inherits: ${generalForm.brand}` : "Select or Custom"} />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Add Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {mercariForm.inheritGeneral && generalForm.brand && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherits {generalForm.brand} from General form.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Carrier</Label>
                  <Select
                    value={mercariForm.shippingCarrier}
                    onValueChange={(value) => handleMarketplaceChange("mercari", "shippingCarrier", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mercari Prepaid">Mercari Prepaid</SelectItem>
                      <SelectItem value="USPS">USPS</SelectItem>
                      <SelectItem value="FedEx">FedEx</SelectItem>
                      <SelectItem value="UPS">UPS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Price</Label>
                  <Input
                    placeholder="Inherit or override"
                    value={mercariForm.shippingPrice}
                    onChange={(e) => handleMarketplaceChange("mercari", "shippingPrice", e.target.value)}
                    disabled={false}
                  />
                  {mercariForm.inheritGeneral && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uses General price rules when sync is enabled.
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Smart Pricing</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="mercari-smart-pricing"
                      checked={mercariForm.smartPricing}
                      onCheckedChange={(checked) => handleMarketplaceChange("mercari", "smartPricing", checked)}
                    />
                    <Label htmlFor="mercari-smart-pricing" className="text-sm">Automatically adjust price to stay competitive</Label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Smart Pricing Floor</Label>
                  <Input
                    placeholder="Lowest price allowed"
                    value={mercariForm.floorPrice}
                    onChange={(e) => handleMarketplaceChange("mercari", "floorPrice", e.target.value)}
                    disabled={!mercariForm.smartPricing}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Local Pickup</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="mercari-local-pickup"
                      checked={mercariForm.localPickup}
                      onCheckedChange={(checked) => handleMarketplaceChange("mercari", "localPickup", checked)}
                    />
                    <Label htmlFor="mercari-local-pickup" className="text-sm">Offer local pickup</Label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Update Mercari connection to sync latest shipping labels & rates.
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("mercari")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Mercari
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("mercari")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button className="gap-2" onClick={() => handleListOnMarketplace("mercari")}>
                  List on Mercari
                </Button>
              </div>
            </div>
          )}

          {/* Facebook Form */}
          {activeForm === "facebook" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Facebook Marketplace</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure shipping vs pickup defaults and whether offers are allowed.
                  </p>
                </div>
              </div>

              {/* Photos and Title Section */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                    {(facebookForm.photos?.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAllPhotos('facebook')}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {facebookForm.photos?.length > 0 && facebookForm.photos.map((photo, index) => (
                      <div
                        key={photo.id || index}
                        className="relative aspect-square overflow-hidden rounded-lg border border-muted-foreground/40 bg-muted cursor-move"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || `Photo ${index + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handlePhotoRemove(photo.id, 'facebook')}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => facebookPhotoInputRef.current?.click()}
                      disabled={isUploadingPhotos || (facebookForm.photos?.length || 0) >= MAX_PHOTOS}
                      className="flex aspect-square flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 text-muted-foreground transition hover:border-foreground/80 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ImagePlus className="h-3 w-3 md:h-5 md:w-5" />
                      <span className="mt-0.5 text-[9px] md:text-[11px] font-medium">Add photos</span>
                    </button>
                    <input
                      ref={facebookPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'facebook')}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {facebookForm.photos?.length || 0}/{MAX_PHOTOS} used.
                    {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                  </p>
                </div>

                {/* Title Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    placeholder="Enter listing title"
                    value={facebookForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <Textarea
                    placeholder={facebookForm.inheritGeneral && generalForm.description ? `Inherits: ${generalForm.description.substring(0, 50)}...` : ""}
                    value={facebookForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "description", e.target.value)}
                    className="min-h-[120px]"
                    disabled={Boolean(generalForm.description)}
                  />
                  {facebookForm.inheritGeneral && generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherits description from General form.
                    </p>
                  )}
                </div>

                {/* Brand Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter brand name"
                        value={facebookForm.brand || ""}
                        onChange={(e) => handleMarketplaceChange("facebook", "brand", e.target.value)}
                        className="flex-1"
                        disabled={Boolean(generalForm.brand)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleMarketplaceChange("facebook", "brand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={facebookForm.brand || generalForm.brand || undefined}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setBrandIsCustom(true);
                          handleMarketplaceChange("facebook", "brand", "");
                        } else {
                          handleMarketplaceChange("facebook", "brand", value);
                        }
                      }}
                      disabled={Boolean(generalForm.brand)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={facebookForm.inheritGeneral && generalForm.brand ? `Inherits: ${generalForm.brand}` : "Select or Custom"} />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Add Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {facebookForm.inheritGeneral && generalForm.brand && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherits {generalForm.brand} from General form.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Delivery Method</Label>
                  <Select
                    value={facebookForm.deliveryMethod}
                    onValueChange={(value) => handleMarketplaceChange("facebook", "deliveryMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shipping_and_pickup">Shipping & Local Pickup</SelectItem>
                      <SelectItem value="shipping_only">Shipping Only</SelectItem>
                      <SelectItem value="pickup_only">Pickup Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Flat Shipping Price</Label>
                  <Input
                    placeholder="Optional override"
                    value={facebookForm.shippingPrice}
                    onChange={(e) => handleMarketplaceChange("facebook", "shippingPrice", e.target.value)}
                    disabled={false}
                  />
                  {facebookForm.inheritGeneral && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uses General pricing when sync is enabled.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Meetup Location</Label>
                  <Input
                    placeholder="Preferred meetup details"
                    value={facebookForm.meetUpLocation}
                    onChange={(e) => handleMarketplaceChange("facebook", "meetUpLocation", e.target.value)}
                    disabled={Boolean(generalForm.zip)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Allow Offers</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="facebook-allow-offers"
                      checked={facebookForm.allowOffers}
                      onCheckedChange={(checked) => handleMarketplaceChange("facebook", "allowOffers", checked)}
                    />
                    <Label htmlFor="facebook-allow-offers" className="text-sm">Allow Messenger offers</Label>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Local Pickup</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="facebook-local-pickup"
                      checked={facebookForm.localPickup}
                      onCheckedChange={(checked) => handleMarketplaceChange("facebook", "localPickup", checked)}
                    />
                    <Label htmlFor="facebook-local-pickup" className="text-sm">Offer local pickup</Label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Facebook to refresh shipping policies & payout options.
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("facebook")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Facebook
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("facebook")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button className="gap-2" onClick={() => handleListOnMarketplace("facebook")}>
                  List on Facebook
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-4 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Crosslist"))}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Package Details Dialog */}
      <Dialog open={packageDetailsDialogOpen} onOpenChange={setPackageDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Package Details</DialogTitle>
            <DialogDescription>
              Enter the package weight and dimensions. This information is required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="package-weight" className="text-sm font-medium">
                Weight (lbs) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="package-weight"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={generalForm.packageWeight}
                onChange={(e) => handleGeneralChange("packageWeight", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="package-length" className="text-sm font-medium">
                  Length (in) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="package-length"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={generalForm.packageLength}
                  onChange={(e) => handleGeneralChange("packageLength", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="package-width" className="text-sm font-medium">
                  Width (in) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="package-width"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={generalForm.packageWidth}
                  onChange={(e) => handleGeneralChange("packageWidth", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="package-height" className="text-sm font-medium">
                  Height (in) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="package-height"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={generalForm.packageHeight}
                  onChange={(e) => handleGeneralChange("packageHeight", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="package-notes" className="text-sm font-medium">
                Additional Notes (Optional)
              </Label>
              <Textarea
                id="package-notes"
                placeholder="Fragile, special handling instructions, etc."
                value={generalForm.packageDetails}
                onChange={(e) => handleGeneralChange("packageDetails", e.target.value)}
                className="mt-1.5 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPackageDetailsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setPackageDetailsDialogOpen(false)}
              disabled={!generalForm.packageWeight || !generalForm.packageLength || !generalForm.packageWidth || !generalForm.packageHeight}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Color Picker Dialog */}
      <ColorPickerDialog
        open={colorPickerOpen}
        onOpenChange={setColorPickerOpen}
        currentColor={editingColorField === "color1" ? generalForm.color1 : editingColorField === "color2" ? generalForm.color2 : editingColorField === "ebay.color" ? ebayForm.color : ""}
        onSelectColor={handleColorSelect}
        fieldLabel={
          editingColorField === "color1" ? "Primary Color" : 
          editingColorField === "color2" ? "Secondary Color" :
          editingColorField === "ebay.color" ? "Color" : "Color"
        }
      />

      {/* Description Generator Dialog */}
      <DescriptionGenerator
        open={descriptionGeneratorOpen}
        onOpenChange={setDescriptionGeneratorOpen}
        onSelectDescription={(description) => {
          if (activeForm === "general") {
            handleGeneralChange("description", description);
          } else {
            handleMarketplaceChange(activeForm, "description", description);
          }
        }}
        title={activeForm === "general" ? generalForm.title : templateForms[activeForm]?.title || generalForm.title}
        brand={activeForm === "general" ? generalForm.brand : templateForms[activeForm]?.brand || generalForm.brand}
        category={activeForm === "general" ? generalForm.category : generalForm.category}
        condition={activeForm === "general" ? generalForm.condition : generalForm.condition}
        similarDescriptions={similarItems}
      />

      {/* Sold Lookup Dialog */}
      <SoldLookupDialog
        open={soldDialogOpen}
        onOpenChange={setSoldDialogOpen}
        itemName={generalForm.title || ""}
        onEbaySearch={() => {
          setEbaySearchInitialQuery(generalForm.title || "");
          setSoldDialogOpen(false);
          setEbaySearchDialogOpen(true);
        }}
      />

      {/* eBay Search Dialog */}
      <EbaySearchDialog
        open={ebaySearchDialogOpen}
        onOpenChange={setEbaySearchDialogOpen}
        onSelectItem={handleEbayItemSelect}
        initialSearchQuery={ebaySearchInitialQuery}
      />
    </div>
  );
}

