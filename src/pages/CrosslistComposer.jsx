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
import { RichTextarea } from "@/components/ui/rich-textarea";
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
  ImageIcon,
  X,
  RefreshCw,
  Save,
  Package,
  Palette,
  ArrowLeft,
  GripVertical,
  Sparkles,
  BarChart,
  ExternalLink,
  Lock,
  Unlock,
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
import { getEbayItemUrl } from "@/utils/ebayHelpers";
import { ImageEditor } from "@/components/ImageEditor";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { createMarketplaceListing, getUserPages, isConnected } from "@/api/facebookClient";

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
    itemsIncluded: "",
    customItemSpecifics: {}, // Store any other required item specifics dynamically
    shippingMethod: "",
    shippingCostType: "",
    shippingCost: "",
    handlingTime: "1 business day",
    shipFromCountry: "United States",
    shippingService: "Standard Shipping (3 to 5 business days)",
    locationDescriptions: "",
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
  
  // Load all images from inventory item
  let photos = [];
  if (item?.images && Array.isArray(item.images) && item.images.length > 0) {
    // Use the images array if available
    photos = item.images.map((img, index) => ({
      id: `inventory-photo-${index}`,
      preview: img.imageUrl || img.url || img,
      fileName: `Inventory photo ${index + 1}`,
      fromInventory: true
    }));
  } else if (item?.image_url) {
    // Fallback to single image_url if images array not available
    photos = [{ id: "inventory-photo", preview: item.image_url, fileName: "Inventory photo", fromInventory: true }];
  }
  
  const general = {
    ...GENERAL_TEMPLATE_DEFAULT,
    photos: photos,
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
  const [brandSearchOpen, setBrandSearchOpen] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);
  const photoInputRef = React.useRef(null);
  const ebayPhotoInputRef = React.useRef(null);
  const etsyPhotoInputRef = React.useRef(null);
  const mercariPhotoInputRef = React.useRef(null);
  const facebookPhotoInputRef = React.useRef(null);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [ebaySearchDialogOpen, setEbaySearchDialogOpen] = useState(false);
  const [ebaySearchInitialQuery, setEbaySearchInitialQuery] = useState("");
  
  // eBay OAuth token state
  const [ebayToken, setEbayToken] = useState(() => {
    // Load token from localStorage on mount
    try {
      const stored = localStorage.getItem('ebay_user_token');
      if (stored) {
        const tokenData = JSON.parse(stored);
        // Check if token is expired
        if (tokenData.expires_at && tokenData.expires_at > Date.now()) {
          return tokenData;
        }
        // Token expired, remove it
        localStorage.removeItem('ebay_user_token');
      }
    } catch (e) {
      console.error('Error loading eBay token:', e);
    }
    return null;
  });

  // eBay username state
  const [ebayUsername, setEbayUsername] = useState(() => {
    // Load username from localStorage on mount
    try {
      const stored = localStorage.getItem('ebay_username');
      if (stored) {
        return stored;
      }
    } catch (e) {
      console.error('Error loading eBay username:', e);
    }
    return null;
  });
  
  // eBay listing ID state
  const [ebayListingId, setEbayListingId] = useState(null);

  // Facebook OAuth token state
  const [facebookToken, setFacebookToken] = useState(() => {
    // Load token from localStorage on mount
    try {
      const stored = localStorage.getItem('facebook_access_token');
      if (stored) {
        const tokenData = JSON.parse(stored);
        // Check if token is expired
        if (tokenData.expires_at && tokenData.expires_at > Date.now()) {
          return tokenData;
        }
        // Token expired, remove it
        localStorage.removeItem('facebook_access_token');
      }
    } catch (e) {
      console.error('Error loading Facebook token:', e);
    }
    return null;
  });

  // Facebook pages state
  const [facebookPages, setFacebookPages] = useState([]);
  const [facebookSelectedPage, setFacebookSelectedPage] = useState(null);
  
  // Image Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState({ url: null, photoId: null, marketplace: null, index: null });
  
  // Load listing ID when currentEditingItemId changes
  useEffect(() => {
    if (currentEditingItemId) {
      const stored = localStorage.getItem(`ebay_listing_${currentEditingItemId}`);
      if (stored) {
        setEbayListingId(stored);
      } else {
        // Check inventory item for listing ID
        const inventoryItem = inventory.find(item => item.id === currentEditingItemId);
        if (inventoryItem?.ebay_listing_id) {
          localStorage.setItem(`ebay_listing_${currentEditingItemId}`, inventoryItem.ebay_listing_id);
          setEbayListingId(inventoryItem.ebay_listing_id);
        } else {
          setEbayListingId(null);
        }
      }
    } else {
      setEbayListingId(null);
    }
  }, [currentEditingItemId, inventory]);
  
  // Handle OAuth callback from URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    
    // Check for OAuth success
    if (params.get('ebay_auth_success') === '1') {
      const tokenParam = params.get('token');
      if (tokenParam) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(tokenParam));
          const expiresAt = Date.now() + (tokenData.expires_in * 1000);
          
          const tokenToStore = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
            expires_in: tokenData.expires_in,
            refresh_token_expires_in: tokenData.refresh_token_expires_in,
            token_type: tokenData.token_type,
          };
          
          // Restore theme IMMEDIATELY before any other operations
          const preservedTheme = sessionStorage.getItem('preserved_theme');
          if (preservedTheme) {
            // Restore theme to localStorage immediately
            localStorage.setItem('theme', preservedTheme);
            // Update DOM immediately
            const root = document.documentElement;
            root.setAttribute('data-theme', preservedTheme);
            // Trigger theme update
            window.dispatchEvent(new Event('storage'));
            // Clean up sessionStorage
            sessionStorage.removeItem('preserved_theme');
          }
          
          // Store token securely
          localStorage.setItem('ebay_user_token', JSON.stringify(tokenToStore));
          setEbayToken(tokenToStore);
          
          // Fetch username after token is stored
          // This will be done in a separate useEffect
          
          // Restore saved form state
          const savedState = sessionStorage.getItem('ebay_oauth_state');
          if (savedState) {
            try {
              const stateData = JSON.parse(savedState);
              // Restore form state
              if (stateData.templateForms) {
                setTemplateForms(stateData.templateForms);
              }
              if (stateData.currentEditingItemId) {
                setCurrentEditingItemId(stateData.currentEditingItemId);
                // Reload item data if we have an item ID and it exists in inventory
                if (stateData.itemIds) {
                  const itemIdsArray = stateData.itemIds.split(',').filter(Boolean);
                  if (itemIdsArray.length > 0) {
                    // Update URL to include item IDs so the page knows which items to show
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('ids', stateData.itemIds);
                    if (stateData.autoSelect !== undefined) {
                      newUrl.searchParams.set('autoSelect', String(stateData.autoSelect));
                    }
                    
                    // Use navigate instead of reload to preserve theme and other preferences
                    navigate(newUrl.pathname + newUrl.search, { replace: true });
                    
                    // Don't reload - let React handle the state restoration
                    return; // Exit early
                  }
                }
              }
              if (stateData.activeForm) {
                setActiveForm(stateData.activeForm);
              }
              if (stateData.selectedCategoryPath) {
                setSelectedCategoryPath(stateData.selectedCategoryPath);
              }
              if (stateData.generalCategoryPath) {
                setGeneralCategoryPath(stateData.generalCategoryPath);
              }
              
              // Clear saved state
              sessionStorage.removeItem('ebay_oauth_state');
            } catch (e) {
              console.error('Error restoring saved state:', e);
            }
          }
          
          toast({
            title: "eBay account connected!",
            description: "Your eBay account has been successfully connected.",
          });
          
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
          console.error('Error parsing token:', e);
          toast({
            title: "Connection error",
            description: "Failed to save eBay connection. Please try again.",
            variant: "destructive",
          });
        }
      }
    }
    
    // Check for OAuth errors
    const authError = params.get('ebay_auth_error');
    if (authError) {
      const errorMessage = decodeURIComponent(authError);
      let helpText = errorMessage;
      
      // Provide helpful guidance for common errors
      if (errorMessage.includes('invalid_request') || errorMessage.includes('redirect_uri')) {
        helpText = 'The redirect URL doesn\'t match your eBay Developer Console settings. Please check:\n\n' +
                   '1. Go to developer.ebay.com/my/keys\n' +
                   '2. Verify OAuth 2.0 Redirect URIs match your app URL\n' +
                   '3. Make sure you\'re using the correct environment (Sandbox vs Production)\n\n' +
                   'Open browser console for detailed configuration info.';
      }
      
      toast({
        title: "eBay Connection Failed",
        description: helpText,
        variant: "destructive",
        duration: 10000, // Show longer for complex messages
      });
      
      console.error('eBay OAuth Error Details:', {
        error: errorMessage,
        currentUrl: window.location.href,
        suggestion: 'Visit /api/ebay/auth?debug=true to see your OAuth configuration'
      });
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Handle Facebook OAuth callback
    if (params.get('facebook_auth_success') === '1') {
      const tokenParam = params.get('token');
      if (tokenParam) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(tokenParam));
          
          const tokenToStore = {
            access_token: tokenData.access_token,
            expires_at: tokenData.expires_at || (Date.now() + (tokenData.expires_in * 1000)),
            expires_in: tokenData.expires_in,
            token_type: tokenData.token_type || 'bearer',
          };
          
          // Restore theme IMMEDIATELY before any other operations
          const preservedTheme = sessionStorage.getItem('preserved_theme');
          if (preservedTheme) {
            // Restore theme to localStorage immediately
            localStorage.setItem('theme', preservedTheme);
            // Update DOM immediately
            const root = document.documentElement;
            root.setAttribute('data-theme', preservedTheme);
            // Trigger theme update
            window.dispatchEvent(new Event('storage'));
            // Clean up sessionStorage
            sessionStorage.removeItem('preserved_theme');
          }
          
          // Store token securely
          localStorage.setItem('facebook_access_token', JSON.stringify(tokenToStore));
          setFacebookToken(tokenToStore);
          
          // Fetch pages after token is stored
          // This will be done in a separate useEffect
          
          // Restore saved form state
          const savedState = sessionStorage.getItem('facebook_oauth_state');
          if (savedState) {
            try {
              const stateData = JSON.parse(savedState);
              // Restore form state
              if (stateData.templateForms) {
                setTemplateForms(stateData.templateForms);
              }
              if (stateData.currentEditingItemId) {
                setCurrentEditingItemId(stateData.currentEditingItemId);
                // Reload item data if we have an item ID and it exists in inventory
                if (stateData.itemIds) {
                  const itemIdsArray = stateData.itemIds.split(',').filter(Boolean);
                  if (itemIdsArray.length > 0) {
                    // Update URL to include item IDs so the page knows which items to show
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('ids', stateData.itemIds);
                    if (stateData.autoSelect !== undefined) {
                      newUrl.searchParams.set('autoSelect', String(stateData.autoSelect));
                    }
                    
                    // Use navigate instead of reload to preserve theme and other preferences
                    navigate(newUrl.pathname + newUrl.search, { replace: true });
                    
                    // Don't reload - let React handle the state restoration
                    return; // Exit early
                  }
                }
              }
              if (stateData.activeForm) {
                setActiveForm(stateData.activeForm);
              }
              if (stateData.selectedCategoryPath) {
                setSelectedCategoryPath(stateData.selectedCategoryPath);
              }
              if (stateData.generalCategoryPath) {
                setGeneralCategoryPath(stateData.generalCategoryPath);
              }
              
              // Clear saved state
              sessionStorage.removeItem('facebook_oauth_state');
            } catch (e) {
              console.error('Error restoring saved state:', e);
            }
          }
          
          toast({
            title: "Facebook account connected!",
            description: "Your Facebook account has been successfully connected.",
          });
          
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
          console.error('Error parsing Facebook token:', e);
          toast({
            title: "Connection error",
            description: "Failed to save Facebook connection. Please try again.",
            variant: "destructive",
          });
        }
      }
    }
    
    // Check for Facebook OAuth errors
    const facebookAuthError = params.get('facebook_auth_error');
    if (facebookAuthError) {
      const errorMsg = decodeURIComponent(facebookAuthError);
      console.error('Facebook OAuth error:', errorMsg);
      
      let description = errorMsg;
      if (errorMsg.includes('redirect_uri')) {
        description = `${errorMsg}\n\nQuick Fix: Visit /api/facebook/debug to see your redirect URI, then add it to Facebook App Settings > Valid OAuth Redirect URIs`;
      }
      
      toast({
        title: "Facebook Connection Failed",
        description: description,
        variant: "destructive",
        duration: 10000,
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location, toast, navigate]);

  // Fetch Facebook pages when token is available
  useEffect(() => {
    let isMounted = true;
    
    const fetchFacebookPages = async () => {
      if (facebookToken?.access_token) {
        try {
          // Check if token is expired
          if (facebookToken.expires_at && facebookToken.expires_at <= Date.now()) {
            console.warn('Facebook token expired, cannot fetch pages');
            return;
          }

          // Import Facebook client functions
          const { getUserPages } = await import('@/api/facebookClient');
          const pages = await getUserPages();
          
          if (isMounted) {
            setFacebookPages(pages);
            
            // Auto-select first page if available and none selected
            if (pages.length > 0) {
              setFacebookSelectedPage(prev => prev || pages[0]);
            }
          }
        } catch (error) {
          console.error('Error fetching Facebook pages:', error);
          // Don't show error toast here, let the user see it in the UI
        }
      } else {
        // Clear pages if token is removed
        if (isMounted) {
          setFacebookPages([]);
          setFacebookSelectedPage(null);
        }
      }
    };

    fetchFacebookPages();
    
    return () => {
      isMounted = false;
    };
  }, [facebookToken]);

  // Fetch eBay username when token is available
  useEffect(() => {
    const fetchEbayUsername = async () => {
      if (ebayToken?.access_token && !ebayUsername) {
        try {
          // Check if token is expired
          if (ebayToken.expires_at && ebayToken.expires_at <= Date.now()) {
            console.warn('eBay token expired, cannot fetch username');
            return;
          }

          const response = await fetch('/api/ebay/listing', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              operation: 'GetUser',
              userToken: ebayToken.access_token,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            const username = result.User?.UserID;
            if (username) {
              setEbayUsername(username);
              localStorage.setItem('ebay_username', username);
            }
          } else {
            console.error('Failed to fetch eBay username:', response.status);
          }
        } catch (error) {
          console.error('Error fetching eBay username:', error);
        }
      }
    };

    fetchEbayUsername();
  }, [ebayToken, ebayUsername]);
  
  // Get eBay category tree ID
  const { data: categoryTreeData, isLoading: isLoadingCategoryTree, error: categoryTreeError } = useEbayCategoryTreeId('EBAY_US');
  // Extract category tree ID - check multiple possible response structures
  const categoryTreeId = categoryTreeData?.categoryTreeId || categoryTreeData?.category_tree_id || categoryTreeData?.categoryTree?.categoryTreeId || null;
  
  // Debug logging for category tree ID
  useEffect(() => {
    if (!isLoadingCategoryTree) {
      console.log('🔍 Category Tree ID Debug:', {
        isLoadingCategoryTree,
        categoryTreeData,
        categoryTreeId,
        categoryTreeError,
        extractedFrom: {
          categoryTreeId: categoryTreeData?.categoryTreeId,
          category_tree_id: categoryTreeData?.category_tree_id,
          categoryTree_categoryTreeId: categoryTreeData?.categoryTree?.categoryTreeId,
        },
      });
      
      if (categoryTreeError) {
        console.error('❌ Error loading category tree ID:', categoryTreeError);
      } else if (!categoryTreeId) {
        console.warn('⚠️ Category tree ID not found. Full response:', categoryTreeData);
      } else {
        // Note: "0" might be a valid category tree ID for US marketplace!
        console.log('✅ Category tree ID:', categoryTreeId, typeof categoryTreeId);
      }
    }
  }, [categoryTreeId, categoryTreeData, isLoadingCategoryTree, categoryTreeError]);
  
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
  // For eBay form
  // Note: categoryTreeId can be '0' for US marketplace, so only check for null/undefined/loading
  const isValidCategoryTreeId = !isLoadingCategoryTree && categoryTreeId !== null && categoryTreeId !== undefined && String(categoryTreeId).trim() !== '';
  const isValidEbayCategoryId = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0 && String(ebayForm.categoryId).trim() !== '';
  
  // Log debugging info for aspect fetching (only log when values actually change)
  useEffect(() => {
    if (ebayForm.categoryId && !isLoadingCategoryTree) {
      const validTreeId = categoryTreeId !== null && categoryTreeId !== undefined && String(categoryTreeId).trim() !== '';
      const validCategoryId = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0 && String(ebayForm.categoryId).trim() !== '';
      const willFetch = validTreeId && validCategoryId;
      
      console.log('🔍 Aspect fetch check:', {
        isLoadingCategoryTree,
        categoryTreeId,
        categoryId: ebayForm.categoryId,
        isValidCategoryTreeId: validTreeId,
        isValidEbayCategoryId: validCategoryId,
        willFetch,
      });
    }
  }, [isLoadingCategoryTree, categoryTreeId, ebayForm.categoryId]); // Removed computed values from deps
  
  // Fetch aspects whenever a category is selected (not just when form is active)
  // This ensures aspects are loaded and ready when user switches to eBay form
  const { data: ebayCategoryAspectsData, isLoading: isLoadingEbayAspects, error: ebayAspectsError } = useEbayCategoryAspects(
    categoryTreeId || null, // Pass null if invalid to prevent API call
    ebayForm.categoryId,
    !!(isValidCategoryTreeId && isValidEbayCategoryId) // Convert to strict boolean
  );

  // For General form - fetch aspects if categoryId is available
  const isValidGeneralCategoryId = generalForm.categoryId && generalForm.categoryId !== '0' && generalForm.categoryId !== 0 && String(generalForm.categoryId).trim() !== '';
  const { data: generalCategoryAspectsData } = useEbayCategoryAspects(
    categoryTreeId,
    generalForm.categoryId,
    !!((activeForm === "general" || activeForm === "etsy" || activeForm === "mercari" || activeForm === "facebook") && isValidCategoryTreeId && isValidGeneralCategoryId) // Convert to strict boolean
  );

  // Use appropriate aspects data based on active form
  const categoryAspects = activeForm === "ebay" 
    ? (ebayCategoryAspectsData?.aspects || [])
    : (generalCategoryAspectsData?.aspects || []);

  // eBay-specific aspects (always use eBay aspects for eBay Category Specifics section)
  // Handle different possible response structures
  const ebayCategoryAspects = (
    ebayCategoryAspectsData?.aspects || 
    ebayCategoryAspectsData?.aspectsForCategory || 
    ebayCategoryAspectsData?.categoryAspects ||
    ebayCategoryAspectsData?.data?.aspects ||
    (Array.isArray(ebayCategoryAspectsData) ? ebayCategoryAspectsData : [])
  ) || [];
  
  // eBay-specific aspect detection
  const ebayBrandAspect = ebayCategoryAspects.find(aspect => 
    aspect.localizedAspectName?.toLowerCase() === 'brand' ||
    aspect.aspectConstraint?.aspectDataType === 'STRING'
  );
  
  // Find Type/Model aspect for eBay - check for various naming patterns
  // eBay can return "Model", "Type", "Model (Type)", "Console Model", etc.
  const ebayTypeAspect = ebayCategoryAspects.find(aspect => {
    // Check multiple possible fields for aspect name
    const aspectName = (
      aspect.localizedAspectName?.toLowerCase() || 
      aspect.aspectName?.toLowerCase() ||
      aspect.name?.toLowerCase() ||
      ''
    ).trim();
    
    if (!aspectName) return false;
    
    // Check for exact matches first (highest priority)
    if (aspectName === 'type' || aspectName === 'model') {
      return true;
    }
    
    // Check for combined names with parentheses
    if (aspectName === 'model (type)' || aspectName === 'type (model)') {
      return true;
    }
    
    // Check if it contains "model" (case-insensitive) - this catches "Console Model", "Video Game Console Model", etc.
    if (aspectName.includes('model')) {
      return true;
    }
    
    // Check if it contains "type" but NOT "model" (to avoid duplicates)
    // This catches categories that only have "Type" aspect
    if (aspectName.includes('type') && !aspectName.includes('model')) {
      return true;
    }
    
    return false;
  });

  // General form aspects (for active form display)
  const brandAspect = categoryAspects.find(aspect => 
    aspect.localizedAspectName?.toLowerCase() === 'brand' ||
    aspect.aspectConstraint?.aspectDataType === 'STRING'
  );
  
  // Find Type/Model aspect - check for various naming patterns
  // eBay can return "Model", "Type", "Model (Type)", etc.
  const typeAspect = categoryAspects.find(aspect => {
    const aspectName = aspect.localizedAspectName?.toLowerCase() || '';
    // Check for exact matches first
    if (aspectName === 'type' || aspectName === 'model') {
      return true;
    }
    // Check for combined names
    if (aspectName.includes('type') && aspectName.includes('model')) {
      return true;
    }
    // Check for variations with parentheses
    if (aspectName === 'model (type)' || aspectName === 'type (model)') {
      return true;
    }
    // Check if it contains "model" (case-insensitive)
    if (aspectName.includes('model')) {
      return true;
    }
    return false;
  });
  
  // Debug logging (remove in production if needed)
  if (ebayForm.categoryId) {
    console.log('eBay Category Aspects Debug:', {
      categoryId: ebayForm.categoryId,
      categoryName: ebayForm.categoryName,
      aspectCount: ebayCategoryAspects.length,
      aspectNames: ebayCategoryAspects.map(a => ({
        localizedAspectName: a.localizedAspectName,
        aspectName: a.aspectName,
        name: a.name,
        fullAspect: a
      })),
      foundTypeAspect: !!ebayTypeAspect,
      typeAspectName: ebayTypeAspect?.localizedAspectName || ebayTypeAspect?.aspectName || ebayTypeAspect?.name,
      typeAspectValues: ebayTypeAspect?.aspectValues?.length || 0,
      typeAspectFull: ebayTypeAspect,
      allAspectsFull: ebayCategoryAspects,
    });
  }
  
  // Check if Type aspect is required or recommended (for eBay)
  const isEbayTypeRequired = ebayTypeAspect?.aspectConstraint?.aspectMode === 'REQUIRED' || 
                             ebayTypeAspect?.aspectConstraint?.aspectMode === 'RECOMMENDED';
  
  // Check if Type aspect is required or recommended (for general form)
  const isTypeRequired = typeAspect?.aspectConstraint?.aspectMode === 'REQUIRED' || 
                         typeAspect?.aspectConstraint?.aspectMode === 'RECOMMENDED';
  
  // Check if category has size-related aspects (use eBay aspects for eBay form)
  const ebaySizeAspect = ebayCategoryAspects.find(aspect => {
    const aspectName = aspect.localizedAspectName?.toLowerCase() || '';
    return aspectName.includes('size') || 
           aspectName.includes('shirt size') || 
           aspectName.includes('shoe size') ||
           aspectName.includes('clothing size') ||
           aspectName.includes('apparel size') ||
           aspectName === 'us size' ||
           aspectName === 'size type';
  });
  
  const sizeAspect = categoryAspects.find(aspect => {
    const aspectName = aspect.localizedAspectName?.toLowerCase() || '';
    return aspectName.includes('size') || 
           aspectName.includes('shirt size') || 
           aspectName.includes('shoe size') ||
           aspectName.includes('clothing size') ||
           aspectName.includes('apparel size') ||
           aspectName === 'us size' ||
           aspectName === 'size type';
  });
  const hasSizeAspect = !!sizeAspect;
  const hasEbaySizeAspect = !!ebaySizeAspect;

  // Find all REQUIRED aspects for eBay (not just Model/Type)
  const ebayRequiredAspects = ebayCategoryAspects.filter(aspect => {
    const constraint = aspect.aspectConstraint;
    const isRequired = constraint?.aspectMode === 'REQUIRED' || constraint?.aspectMode === 'RECOMMENDED';
    // Exclude Brand and Model/Type as they're handled separately
    const aspectName = (aspect.localizedAspectName || aspect.aspectName || aspect.name || '').toLowerCase();
    const isBrand = aspectName === 'brand';
    const isModelOrType = aspectName.includes('model') || aspectName === 'type';
    const isItemsIncluded = aspectName.includes('items included') || aspectName.includes('what\'s included') || aspectName === 'included';
    return isRequired && !isBrand && !isModelOrType && !isItemsIncluded;
  });
  
  // Find "Items Included" aspect specifically (can be required or optional)
  const ebayItemsIncludedAspect = ebayCategoryAspects.find(aspect => {
    const aspectName = (aspect.localizedAspectName || aspect.aspectName || aspect.name || '').toLowerCase();
    return aspectName.includes('items included') || 
           aspectName.includes('what\'s included') || 
           aspectName === 'items included' ||
           aspectName === 'included';
  });
  
  // Check if Items Included is required
  const isItemsIncludedRequired = ebayItemsIncludedAspect?.aspectConstraint?.aspectMode === 'REQUIRED';

  // For General form, also check if category is selected (fallback if aspects not available)
  const generalHasCategory = generalForm.category && generalForm.category.trim() !== '';
  const shouldShowGeneralSize = generalHasCategory && (hasSizeAspect || generalForm.categoryId);

  // For eBay form, require both category and size aspect
  const ebayHasCategory = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0;
  const shouldShowEbaySize = ebayHasCategory && hasEbaySizeAspect;

  const ebayBrands = ebayBrandAspect?.aspectValues?.map(val => val.localizedValue) || [];
  
  // Extract type values for eBay - handle different possible structures
  let ebayTypeValues = [];
  if (ebayTypeAspect) {
    // Check multiple possible structures for aspect values
    const aspectValues = ebayTypeAspect.aspectValues || 
                        ebayTypeAspect.values || 
                        ebayTypeAspect.value || 
                        [];
    
    if (Array.isArray(aspectValues)) {
      ebayTypeValues = aspectValues.map(val => {
        // Handle different possible structures
        if (typeof val === 'string') {
          return val;
        }
        return val?.localizedValue || val?.value || val?.localizedLabel || val?.label || val;
      }).filter(Boolean).filter(val => val && typeof val === 'string' && val.trim().length > 0);
    } else if (aspectValues) {
      // Single value case
      const singleVal = aspectValues.localizedValue || aspectValues.value || aspectValues.localizedLabel || aspectValues.label || aspectValues;
      if (singleVal && typeof singleVal === 'string' && singleVal.trim().length > 0) {
        ebayTypeValues = [singleVal];
      }
    }
  }
  
  // Extract type values for general form - handle different possible structures
  let typeValues = [];
  if (typeAspect?.aspectValues) {
    typeValues = typeAspect.aspectValues.map(val => {
      // Handle different possible structures
      return val.localizedValue || val.value || val;
    }).filter(Boolean);
  }
  
  // Determine if we should show/require Type field for eBay
  // Show if: category is selected AND (ebayTypeAspect exists OR aspects are still loading)
  const shouldShowEbayType = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0;
  const shouldRequireEbayType = shouldShowEbayType && (isEbayTypeRequired || ebayTypeAspect);

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
        // Also sync the category path for breadcrumb navigation
        setSelectedCategoryPath([...generalCategoryPath]);
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
      // Sync zip code to eBay shipping location
      if (generalData.zip) {
        copied.shippingLocation = generalData.zip;
      }
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
    if (templateKey === 'ebay') {
      // Initiate eBay OAuth flow
      window.location.href = '/api/ebay/auth';
    } else if (templateKey === 'facebook') {
      // Initiate Facebook OAuth flow
      window.location.href = '/auth/facebook/auth';
    } else {
      const label = TEMPLATE_DISPLAY_NAMES[templateKey] || "Marketplace";
      toast({
        title: `${label} reconnected`,
        description: "We'll refresh the integration and pull the latest account settings.",
      });
    }
  };
  
  const handleDisconnectEbay = () => {
    localStorage.removeItem('ebay_user_token');
    setEbayToken(null);
    toast({
      title: "eBay account disconnected",
      description: "Your eBay account has been disconnected.",
    });
  };
  
  const handleConnectEbay = async () => {
    // Save current theme to sessionStorage before OAuth redirect
    const currentTheme = localStorage.getItem('theme') || 'default-light';
    sessionStorage.setItem('preserved_theme', currentTheme);
    
    // Save current form state before redirecting to OAuth
    const stateToSave = {
      templateForms,
      currentEditingItemId,
      activeForm,
      selectedCategoryPath,
      generalCategoryPath,
      itemIds: itemIds.join(','), // Save as comma-separated string
      autoSelect,
    };
    
    // Save to sessionStorage (cleared when tab closes)
    sessionStorage.setItem('ebay_oauth_state', JSON.stringify(stateToSave));
    
    // First check OAuth configuration
    try {
      const debugResponse = await fetch('/api/ebay/auth?debug=true');
      const debugInfo = await debugResponse.json();
      
      console.log('eBay OAuth Configuration:', debugInfo);
      
      // Proceed with OAuth flow
      window.location.href = '/api/ebay/auth';
    } catch (error) {
      console.error('Error checking eBay OAuth config:', error);
      toast({
        title: "Configuration Error",
        description: "Unable to connect to eBay. Please check the console for details.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectFacebook = () => {
    localStorage.removeItem('facebook_access_token');
    setFacebookToken(null);
    setFacebookPages([]);
    setFacebookSelectedPage(null);
    toast({
      title: "Facebook account disconnected",
      description: "Your Facebook account has been disconnected.",
    });
  };
  
  const handleConnectFacebook = () => {
    // Save current theme to sessionStorage before OAuth redirect
    const currentTheme = localStorage.getItem('theme') || 'default-light';
    sessionStorage.setItem('preserved_theme', currentTheme);
    
    // Save current form state before redirecting to OAuth
    const stateToSave = {
      templateForms,
      currentEditingItemId,
      activeForm,
      selectedCategoryPath,
      generalCategoryPath,
      itemIds: itemIds.join(','), // Save as comma-separated string
      autoSelect,
    };
    
    // Save to sessionStorage (cleared when tab closes)
    sessionStorage.setItem('facebook_oauth_state', JSON.stringify(stateToSave));
    
    // Initiate Facebook OAuth flow
    window.location.href = '/auth/facebook/auth';
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
      
      // Auto-save to inventory when saving general template
      if (generalForm.title && generalForm.title.trim()) {
        try {
          setIsSaving(true);
          
          // Upload all photos
          const { imageUrl, images } = await uploadAllPhotos(generalForm.photos);

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
            images: images, // Save all images
            notes: generalForm.description || "",
          };

          let savedItem;
          if (currentEditingItemId) {
            // Update existing inventory item
            savedItem = await base44.entities.InventoryItem.update(currentEditingItemId, inventoryData);
          } else {
            // Create new inventory item
            savedItem = await base44.entities.InventoryItem.create(inventoryData);
          }

          if (savedItem?.id) {
            const allLabels = [...customLabels, ...tags];
            for (const label of allLabels) {
              addTag(savedItem.id, label);
            }
            
            // Update currentEditingItemId so future saves update the same item
            if (!currentEditingItemId) {
              setCurrentEditingItemId(savedItem.id);
            }
          }

          queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

          toast({
            title: "General template saved",
            description: `Your preferences have been saved, synced to marketplace forms, and the item has been ${currentEditingItemId ? 'updated in' : 'added to'} inventory.`,
            duration: 2000,
          });
        } catch (error) {
          console.error("Error saving item to inventory:", error);
          toast({
            title: "Template saved (inventory save failed)",
            description: "Your preferences have been saved, but there was an error with inventory. You can save it manually later.",
            variant: "destructive",
          });
        } finally {
          setIsSaving(false);
        }
      } else {
        // No title - just show success message
        toast({
          title: "General template saved",
          description: "Your preferences have been saved and automatically synced to all marketplace forms.",
          duration: 2000,
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
    
    // Check for valid category ID from either eBay form or General form (since they sync)
    const categoryIdToCheck = ebayForm.categoryId || generalForm.categoryId;
    const hasValidCategory = categoryIdToCheck && 
                            String(categoryIdToCheck).trim() !== '' && 
                            categoryIdToCheck !== '0' && 
                            categoryIdToCheck !== 0;
    
    if (!hasValidCategory) errors.push("Category");
    // Only require Type if category is selected and ebayTypeAspect exists with values
    if (ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0) {
      // Only require if we have the type aspect with values
      if (ebayTypeAspect && ebayTypeValues.length > 0 && !ebayForm.itemType) {
        errors.push(ebayTypeAspect.localizedAspectName || "Model (Type)");
      }
    }
    if (!ebayForm.condition) errors.push("Condition");
    if (!ebayForm.shippingCost) errors.push("Shipping Cost");
    // Only require return fields when Accept Returns is enabled
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
    
    // Check required item specifics
    if (isItemsIncludedRequired && !ebayForm.itemsIncluded) {
      errors.push("Items Included");
    }
    // Check other required custom item specifics
    if (ebayRequiredAspects.length > 0) {
      ebayRequiredAspects.forEach(aspect => {
        const aspectName = (aspect.localizedAspectName || aspect.aspectName || aspect.name || '').toLowerCase().replace(/\s+/g, '_');
        if (!ebayForm.customItemSpecifics?.[aspectName]) {
          errors.push(aspect.localizedAspectName || aspect.aspectName || aspect.name);
        }
      });
    }
    
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

        // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for eBay
        const sourcePhotos = ebayForm.photos?.length > 0 ? ebayForm.photos : (generalForm.photos || []);
        const photosToUse = [];
        for (const photo of sourcePhotos) {
          if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
            // Photo needs to be uploaded
            try {
              const uploadPayload = photo.file instanceof File 
                ? photo.file 
                : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
              
              const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
              photosToUse.push({
                ...photo,
                preview: file_url,
                imageUrl: file_url,
              });
            } catch (uploadError) {
              console.error('Error uploading photo:', uploadError);
              // Skip this photo if upload fails
              continue;
            }
          } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
            // Photo already has a valid URL
            photosToUse.push({
              ...photo,
              imageUrl: photo.preview,
            });
          } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
            // Photo has imageUrl field with valid URL
            photosToUse.push(photo);
          }
        }

        if (photosToUse.length === 0 && sourcePhotos.length > 0) {
          throw new Error('No valid photo URLs available. Please ensure photos are uploaded or use photos from inventory.');
        }

        // Prepare listing data
        const listingData = {
          title: ebayForm.title || generalForm.title,
          description: ebayForm.description || generalForm.description || '',
          categoryId: ebayForm.categoryId,
          price: ebayForm.buyItNowPrice || generalForm.price,
          quantity: parseInt(generalForm.quantity) || 1,
          photos: photosToUse,
          condition: ebayForm.condition || generalForm.condition || 'New',
          brand: ebayForm.ebayBrand || generalForm.brand || '',
          itemType: ebayForm.itemType || '',
          itemTypeAspectName: ebayTypeAspect?.localizedAspectName || ebayTypeAspect?.aspectName || ebayTypeAspect?.name || 'Model',
          packageWeight: generalForm.packageWeight || '',
          postalCode: generalForm.zip || '',
          shippingMethod: ebayForm.shippingMethod,
          shippingCostType: ebayForm.shippingCostType,
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
          sku: ebayForm.sku || generalForm.sku || '',
          locationDescriptions: ebayForm.locationDescriptions || '',
          shippingLocation: ebayForm.shippingLocation || generalForm.zip || '',
          itemsIncluded: ebayForm.itemsIncluded || '',
          customItemSpecifics: ebayForm.customItemSpecifics || {},
        };

        // Get user token - check if stored or use from request
        let userToken = null;
        if (ebayToken && ebayToken.access_token) {
          // Check if token is expired
          if (ebayToken.expires_at && ebayToken.expires_at > Date.now()) {
            userToken = ebayToken.access_token;
          } else {
            // Token expired - need to refresh or reconnect
            toast({
              title: "eBay token expired",
              description: "Please reconnect your eBay account to continue.",
              variant: "destructive",
            });
            return;
          }
        }
        
        if (!userToken) {
          toast({
            title: "eBay account not connected",
            description: "Please connect your eBay account before listing items.",
            variant: "destructive",
          });
          return;
        }

        // Call eBay listing API
        const response = await fetch('/api/ebay/listing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'AddFixedPriceItem',
            listingData,
            userToken, // Pass user token
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.Ack === 'Success' || result.Ack === 'Warning') {
          const listingItemId = result.ItemID;
          
          // Store listing ID
          if (listingItemId) {
            setEbayListingId(listingItemId);
            // Store in localStorage associated with current item
            if (currentEditingItemId) {
              localStorage.setItem(`ebay_listing_${currentEditingItemId}`, listingItemId);
            }
          }
          
          // Update inventory item status and save marketplace listing
          if (currentEditingItemId) {
            try {
              // Update inventory item status
              await base44.entities.InventoryItem.update(currentEditingItemId, {
                status: 'listed',
                ebay_listing_id: listingItemId || '',
              });
              
              // Save marketplace listing record
              const listingData = {
                inventory_item_id: currentEditingItemId,
                marketplace: 'ebay',
                marketplace_listing_id: listingItemId || '',
                marketplace_listing_url: result.ListingURL || `https://www.ebay.com/itm/${listingItemId}`,
                status: 'active',
                listed_at: new Date().toISOString(),
                metadata: result,
              };
              
              // Save to localStorage (CrosslistingEngine method)
              const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
              listings.push({
                ...listingData,
                id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                created_at: new Date().toISOString(),
              });
              localStorage.setItem('marketplace_listings', JSON.stringify(listings));
              
              queryClient.invalidateQueries(['inventoryItems']);
            } catch (updateError) {
              console.error('Error updating inventory item:', updateError);
            }
          }

          toast({
            title: "Listing created successfully!",
            description: listingItemId ? `eBay Item ID: ${listingItemId}` : "Your item has been listed on eBay.",
          });
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

    if (marketplace === "facebook") {
      // Check if Facebook is connected
      if (!isConnected()) {
        toast({
          title: "Facebook Not Connected",
          description: "Please connect your Facebook account in Settings first.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsSaving(true);

        // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for Facebook
        const sourcePhotos = facebookForm.photos?.length > 0 ? facebookForm.photos : (generalForm.photos || []);
        const photosToUse = [];
        for (const photo of sourcePhotos) {
          if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
            // Photo needs to be uploaded
            try {
              const uploadPayload = photo.file instanceof File 
                ? photo.file 
                : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
              
              const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
              photosToUse.push(file_url);
            } catch (uploadError) {
              console.error('Error uploading photo:', uploadError);
              // Skip this photo if upload fails
              continue;
            }
          } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
            // Photo already has a valid URL
            photosToUse.push(photo.preview);
          } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
            // Photo has imageUrl field with valid URL
            photosToUse.push(photo.imageUrl);
          }
        }

        if (photosToUse.length === 0) {
          throw new Error('At least one photo is required for Facebook Marketplace listings.');
        }

        // Get user's Facebook pages
        const pages = await getUserPages();
        if (pages.length === 0) {
          throw new Error('No Facebook Pages found. You must manage at least one Page to create Marketplace listings.');
        }

        // Use selected page or first available page
        const pageId = facebookForm.facebookPageId || facebookSelectedPage?.id || pages[0].id;
        const selectedPage = pages.find(p => p.id === pageId) || pages[0];

        // Prepare Facebook listing data
        const title = facebookForm.title || generalForm.title;
        const description = facebookForm.description || generalForm.description || '';
        const price = facebookForm.price || generalForm.price;

        if (!title || !description || !price) {
          throw new Error('Title, description, and price are required for Facebook Marketplace listings.');
        }

        // Convert price to cents
        const priceInCents = Math.round(parseFloat(price) * 100);

        // Create Facebook Marketplace listing
        const result = await createMarketplaceListing({
          pageId: selectedPage.id,
          title: title,
          description: description,
          price: priceInCents,
          currency: 'USD',
          imageUrls: photosToUse,
        });

        if (result.success) {
          toast({
            title: "Facebook listing created successfully!",
            description: result.message || `Your item has been listed on Facebook Marketplace (${selectedPage.name}).`,
          });

          // Update inventory item status and save marketplace listing
          if (currentEditingItemId) {
            try {
              // Update inventory item status
              await base44.entities.InventoryItem.update(currentEditingItemId, {
                status: 'listed',
                facebook_listing_id: result.id || '',
              });
              
              // Save marketplace listing record
              const listingData = {
                inventory_item_id: currentEditingItemId,
                marketplace: 'facebook',
                marketplace_listing_id: result.id || '',
                marketplace_listing_url: result.url || '',
                status: 'active',
                listed_at: new Date().toISOString(),
                metadata: result,
              };
              
              // Save to localStorage
              const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
              listings.push({
                ...listingData,
                id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                created_at: new Date().toISOString(),
              });
              localStorage.setItem('marketplace_listings', JSON.stringify(listings));
              
              queryClient.invalidateQueries(['inventoryItems']);
            } catch (updateError) {
              console.error('Error updating inventory item:', updateError);
            }
          }
        } else {
          throw new Error(result.message || 'Failed to create Facebook listing');
        }
      } catch (error) {
        console.error('Error creating Facebook listing:', error);
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
            // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for eBay
            const photosToUse = [];
            for (const photo of generalForm.photos || []) {
              if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
                // Photo needs to be uploaded
                try {
                  const uploadPayload = photo.file instanceof File 
                    ? photo.file 
                    : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
                  
                  const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
                  photosToUse.push({
                    ...photo,
                    preview: file_url,
                    imageUrl: file_url,
                  });
                } catch (uploadError) {
                  console.error('Error uploading photo:', uploadError);
                  // Skip this photo if upload fails
                  continue;
                }
              } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
                // Photo already has a valid URL
                photosToUse.push({
                  ...photo,
                  imageUrl: photo.preview,
                });
              } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
                // Photo has imageUrl field with valid URL
                photosToUse.push(photo);
              }
            }

            if (photosToUse.length === 0 && (generalForm.photos || []).length > 0) {
              throw new Error('No valid photo URLs available. Please ensure photos are uploaded or use photos from inventory.');
            }

            // Prepare eBay listing data
            const listingData = {
              title: generalForm.title,
              description: generalForm.description || '',
              categoryId: ebayForm.categoryId,
              price: ebayForm.buyItNowPrice || generalForm.price,
              quantity: parseInt(generalForm.quantity) || 1,
              photos: photosToUse,
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
          } else if (marketplace === "facebook") {
            // Check if Facebook is connected
            if (!isConnected()) {
              throw new Error('Facebook account not connected. Please connect your Facebook account in Settings first.');
            }

            // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for Facebook
            const sourcePhotos = facebookForm.photos?.length > 0 ? facebookForm.photos : (generalForm.photos || []);
            const photosToUse = [];
            for (const photo of sourcePhotos) {
              if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
                // Photo needs to be uploaded
                try {
                  const uploadPayload = photo.file instanceof File 
                    ? photo.file 
                    : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
                  
                  const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
                  photosToUse.push(file_url);
                } catch (uploadError) {
                  console.error('Error uploading photo:', uploadError);
                  // Skip this photo if upload fails
                  continue;
                }
              } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
                // Photo already has a valid URL
                photosToUse.push(photo.preview);
              } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
                // Photo has imageUrl field with valid URL
                photosToUse.push(photo.imageUrl);
              }
            }

            if (photosToUse.length === 0) {
              throw new Error('At least one photo is required for Facebook Marketplace listings.');
            }

            // Get user's Facebook pages
            const pages = await getUserPages();
            if (pages.length === 0) {
              throw new Error('No Facebook Pages found. You must manage at least one Page to create Marketplace listings.');
            }

            // Use selected page or first available page
            const pageId = facebookForm.facebookPageId || facebookSelectedPage?.id || pages[0].id;
            const selectedPage = pages.find(p => p.id === pageId) || pages[0];

            // Prepare Facebook listing data
            const title = facebookForm.title || generalForm.title;
            const description = facebookForm.description || generalForm.description || '';
            const price = facebookForm.price || generalForm.price;

            if (!title || !description || !price) {
              throw new Error('Title, description, and price are required for Facebook Marketplace listings.');
            }

            // Convert price to cents
            const priceInCents = Math.round(parseFloat(price) * 100);

            // Create Facebook Marketplace listing
            const result = await createMarketplaceListing({
              pageId: selectedPage.id,
              title: title,
              description: description,
              price: priceInCents,
              currency: 'USD',
              imageUrls: photosToUse,
            });

            if (result.success) {
              results.push({ 
                marketplace, 
                itemId: result.id,
                listingUrl: `https://www.facebook.com/marketplace/item/${result.id}`,
                pageName: selectedPage.name,
              });
            } else {
              throw new Error(result.message || 'Failed to create Facebook listing');
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
          const newGeneralPhotos = [...(prev.general.photos || []), ...processedPhotos];
          updated.general = {
            ...prev.general,
            photos: newGeneralPhotos,
          };
          // Sync photos to all marketplace forms
          updated.ebay = { ...prev.ebay, photos: newGeneralPhotos };
          updated.etsy = { ...prev.etsy, photos: newGeneralPhotos };
          updated.mercari = { ...prev.mercari, photos: newGeneralPhotos };
          updated.facebook = { ...prev.facebook, photos: newGeneralPhotos };
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
        const newGeneralPhotos = prev.general.photos.filter((photo) => photo.id !== photoId);
        updated.general = {
          ...prev.general,
          photos: newGeneralPhotos,
        };
        // Sync photos to all marketplace forms
        updated.ebay = { ...prev.ebay, photos: newGeneralPhotos };
        updated.etsy = { ...prev.etsy, photos: newGeneralPhotos };
        updated.mercari = { ...prev.mercari, photos: newGeneralPhotos };
        updated.facebook = { ...prev.facebook, photos: newGeneralPhotos };
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
        // Sync empty photos to all marketplace forms
        updated.ebay = { ...prev.ebay, photos: [] };
        updated.etsy = { ...prev.etsy, photos: [] };
        updated.mercari = { ...prev.mercari, photos: [] };
        updated.facebook = { ...prev.facebook, photos: [] };
      } else {
        updated[marketplace] = {
          ...prev[marketplace],
          photos: [],
        };
      }
      return updated;
    });
  };

  const handleSaveEditedImage = async (editedFile) => {
    if (!imageToEdit.photoId || !imageToEdit.marketplace) return;

    try {
      // Create a new preview URL for the edited image
      const newPreview = URL.createObjectURL(editedFile);
      
      // Update the photo in the correct form
      setTemplateForms((prev) => {
        const updated = { ...prev };
        const formPhotos = imageToEdit.marketplace === 'general' 
          ? updated.general.photos 
          : updated[imageToEdit.marketplace]?.photos || [];
        
        const updatedPhotos = formPhotos.map((photo, idx) => {
          if (photo.id === imageToEdit.photoId) {
            return {
              ...photo,
              file: editedFile,
              preview: newPreview,
            };
          }
          return photo;
        });

        if (imageToEdit.marketplace === 'general') {
          updated.general = {
            ...updated.general,
            photos: updatedPhotos,
          };
          // Sync edited photos to all marketplace forms
          updated.ebay = { ...updated.ebay, photos: updatedPhotos };
          updated.etsy = { ...updated.etsy, photos: updatedPhotos };
          updated.mercari = { ...updated.mercari, photos: updatedPhotos };
          updated.facebook = { ...updated.facebook, photos: updatedPhotos };
        } else {
          updated[imageToEdit.marketplace] = {
            ...updated[imageToEdit.marketplace],
            photos: updatedPhotos,
          };
        }

        return updated;
      });

      toast({
        title: "Image Updated",
        description: "The photo has been successfully updated.",
      });
      setEditorOpen(false);
      setImageToEdit({ url: null, photoId: null, marketplace: null, index: null });
    } catch (error) {
      console.error("Error updating image:", error);
      toast({
        title: "Error Updating Image",
        description: "Failed to update the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleApplyFiltersToAll = async (processedImages, settings) => {
    if (!imageToEdit.marketplace) return;

    try {
      // Update all photos in the current marketplace form with the processed images
      setTemplateForms((prev) => {
        const updated = { ...prev };
        const formPhotos = imageToEdit.marketplace === 'general' 
          ? updated.general.photos 
          : updated[imageToEdit.marketplace]?.photos || [];
        
        // Update each photo with the processed version
        const updatedPhotos = formPhotos.map((photo, idx) => {
          const processedImage = processedImages[idx];
          if (processedImage?.file) {
            return {
              ...photo,
              file: processedImage.file,
              preview: URL.createObjectURL(processedImage.file),
            };
          }
          return photo;
        });

        if (imageToEdit.marketplace === 'general') {
          updated.general = {
            ...updated.general,
            photos: updatedPhotos,
          };
          // Sync filter-applied photos to all marketplace forms
          updated.ebay = { ...updated.ebay, photos: updatedPhotos };
          updated.etsy = { ...updated.etsy, photos: updatedPhotos };
          updated.mercari = { ...updated.mercari, photos: updatedPhotos };
          updated.facebook = { ...updated.facebook, photos: updatedPhotos };
        } else {
          updated[imageToEdit.marketplace] = {
            ...updated[imageToEdit.marketplace],
            photos: updatedPhotos,
          };
        }

        return updated;
      });

      toast({
        title: "Filters Applied to All",
        description: `Successfully applied edits to all ${processedImages.length} images.`,
      });
    } catch (error) {
      console.error("Error applying filters to all:", error);
      toast({
        title: "Error Applying Filters",
        description: "Failed to apply filters to all images. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePhotoReorder = (dragIndex, dropIndex, marketplace = 'general') => {
    setTemplateForms((prev) => {
      const photos = marketplace === 'general'
        ? [...prev.general.photos]
        : [...(prev[marketplace]?.photos || [])];
      const [draggedPhoto] = photos.splice(dragIndex, 1);
      photos.splice(dropIndex, 0, draggedPhoto);
      
      if (marketplace === 'general') {
        return {
          ...prev,
          general: {
            ...prev.general,
            photos,
          },
          // Sync reordered photos to all marketplace forms
          ebay: { ...prev.ebay, photos },
          etsy: { ...prev.etsy, photos },
          mercari: { ...prev.mercari, photos },
          facebook: { ...prev.facebook, photos },
        };
      } else {
        return {
          ...prev,
          [marketplace]: {
            ...prev[marketplace],
            photos,
          },
        };
      }
    });
  };
  
  // Helper function to upload all photos and return images array
  const uploadAllPhotos = async (photos) => {
    if (!photos || photos.length === 0) return { imageUrl: "", images: [] };

    const uploadedImageUrls = [];
    let mainImageUrl = "";

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      let imageUrl = "";

      if (photo.file) {
        const uploadPayload = photo.file instanceof File 
          ? photo.file 
          : new File([photo.file], photo.fileName || `photo_${i}.jpg`, { type: photo.file.type || 'image/jpeg' });
        
        const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
        imageUrl = file_url;
      } else if (photo.preview && !photo.preview.startsWith('blob:')) {
        imageUrl = photo.preview;
      } else if (photo.imageUrl) {
        imageUrl = photo.imageUrl;
      } else if (photo.url) {
        imageUrl = photo.url;
      }

      if (imageUrl) {
        if (i === 0) {
          mainImageUrl = imageUrl; // First photo is main
        }
        uploadedImageUrls.push(imageUrl); // Just push the URL string
      }
    }

    return { imageUrl: mainImageUrl, images: uploadedImageUrls };
  };

  const handleSaveToInventory = async () => {
    setIsSaving(true);
    try {
      // Upload all photos
      const { imageUrl, images } = await uploadAllPhotos(generalForm.photos);

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
        images: images, // Save all images
        notes: generalForm.description || "",
      };

      let savedItem;
      if (currentEditingItemId) {
        // Update existing item
        savedItem = await base44.entities.InventoryItem.update(currentEditingItemId, inventoryData);
      } else {
        // Create new item
        savedItem = await base44.entities.InventoryItem.create(inventoryData);
      }

      if (savedItem?.id) {
        const allLabels = [...customLabels, ...tags];
        for (const label of allLabels) {
          addTag(savedItem.id, label);
        }
        
        // Update currentEditingItemId for future saves
        if (!currentEditingItemId) {
          setCurrentEditingItemId(savedItem.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

      toast({
        title: "Item saved to inventory",
        description: `${generalForm.title || "Item"} has been ${currentEditingItemId ? 'updated in' : 'added to'} your inventory.`,
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

        {/* eBay Account Connection Section - At Top (Only show on eBay form) */}
        {activeForm === "ebay" && (
        <div className="rounded-lg border border-muted-foreground/30 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={EBAY_ICON_URL} alt="eBay" className="w-5 h-5" />
              <Label className="text-base font-semibold">eBay Account</Label>
            </div>
            {ebayToken ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("ebay")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleDisconnectEbay}>
                  <X className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" className="gap-2" onClick={handleConnectEbay}>
                <Check className="h-4 w-4" />
                Connect eBay Account
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            {/* Status */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Status</Label>
              <div className="flex items-center gap-2">
                {ebayToken ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Not Connected</span>
                  </>
                )}
              </div>
            </div>

            {/* Token Expires */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Token Expires</Label>
              <div className="text-sm">
                {ebayToken?.expires_at ? (
                  <span>{new Date(ebayToken.expires_at).toLocaleDateString()}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* eBay Account (Username) */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">eBay Account</Label>
              <div className="text-sm">
                {ebayUsername ? (
                  <span className="font-medium">{ebayUsername}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Facebook Account Connection Section - At Top (Only show on Facebook form) */}
        {activeForm === "facebook" && (
        <div className="rounded-lg border border-muted-foreground/30 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={FACEBOOK_ICON_URL} alt="Facebook" className="w-5 h-5" />
              <Label className="text-base font-semibold">Facebook Account</Label>
            </div>
            {facebookToken ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("facebook")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleDisconnectFacebook}>
                  <X className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" className="gap-2" onClick={handleConnectFacebook}>
                <Check className="h-4 w-4" />
                Connect Facebook Account
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            {/* Status */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Status</Label>
              <div className="flex items-center gap-2">
                {facebookToken ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Not Connected</span>
                  </>
                )}
              </div>
            </div>

            {/* Token Expires */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Token Expires</Label>
              <div className="text-sm">
                {facebookToken?.expires_at ? (
                  <span>{new Date(facebookToken.expires_at).toLocaleDateString()}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* Facebook Pages */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Available Pages</Label>
              <div className="text-sm">
                {facebookPages.length > 0 ? (
                  <span className="font-medium">{facebookPages.length} page{facebookPages.length !== 1 ? 's' : ''}</span>
                ) : facebookToken ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Show selected page if available */}
          {facebookPages.length > 0 && (
            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground mb-2 block">Selected Page</Label>
              <Select
                value={facebookSelectedPage?.id || ""}
                onValueChange={(value) => {
                  const page = facebookPages.find(p => p.id === value);
                  setFacebookSelectedPage(page);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a page">
                    {facebookSelectedPage?.name || "Select a page"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {facebookPages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Listings will be posted on behalf of this page.
              </p>
            </div>
          )}
        </div>
        )}

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
                      <div className="absolute top-1 right-1 flex gap-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageToEdit({ 
                              url: generalForm.photos[0].preview, 
                              photoId: generalForm.photos[0].id, 
                              marketplace: 'general',
                              index: 0
                            });
                            setEditorOpen(true);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                          title="Edit photo"
                        >
                          <ImageIcon className="h-3 w-3" />
                          <span className="sr-only">Edit photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(generalForm.photos[0].id);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
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
                      <div className="absolute top-1 right-1 flex gap-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageToEdit({ 
                              url: photo.preview, 
                              photoId: photo.id, 
                              marketplace: 'general',
                              index: index + 1
                            });
                            setEditorOpen(true);
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                          title="Edit photo"
                        >
                          <ImageIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span className="sr-only">Edit photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id);
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add Photo Button - same size as photo tiles */}
                  {(generalForm.photos?.length || 0) < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhotos}
                      className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                    >
                      <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                      <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                    </button>
                  )}
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

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label htmlFor="general-title" className="text-xs mb-1.5 block">Title</Label>
                  <div className="flex gap-2">
                    <Input
                      id="general-title"
                      name="general-title"
                      placeholder=""
                      value={generalForm.title || ""}
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
                  <Label htmlFor="general-price" className="text-xs mb-1.5 block">Listing Price</Label>
                  <Input
                    id="general-price"
                    name="general-price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={generalForm.price || ""}
                    onChange={(e) => handleGeneralChange("price", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Price you'll list this item for</p>
                </div>
                <div>
                  <Label htmlFor="general-cost" className="text-xs mb-1.5 block">Purchase Price</Label>
                  <Input
                    id="general-cost"
                    name="general-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={generalForm.cost || ""}
                    onChange={(e) => handleGeneralChange("cost", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="general-description" className="text-xs">Description</Label>
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
                  <RichTextarea
                    id="general-description"
                    name="general-description"
                    placeholder="Enter a detailed description of your item..."
                    value={generalForm.description || ""}
                    onChange={(e) => handleGeneralChange("description", e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
                <div>
                  <Label htmlFor="general-brand" className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        id="general-brand"
                        name="general-brand"
                        placeholder="Enter brand name"
                        value={generalForm.brand || ""}
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
                    <Popover open={brandSearchOpen} onOpenChange={setBrandSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={brandSearchOpen}
                          className="w-full justify-between"
                        >
                          {generalForm.brand
                            ? POPULAR_BRANDS.find((brand) => brand === generalForm.brand) || generalForm.brand
                            : "Search brand..."}
                          <ArrowRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search brand..." />
                          <CommandList>
                            <CommandEmpty>No brand found.</CommandEmpty>
                            <CommandGroup>
                              {POPULAR_BRANDS.map((brand) => (
                                <CommandItem
                                  key={brand}
                                  value={brand}
                                  onSelect={() => {
                                    handleGeneralChange("brand", brand);
                                    setBrandSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      generalForm.brand === brand ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {brand}
                                </CommandItem>
                              ))}
                              <CommandItem
                                value="custom"
                                onSelect={() => {
                                  setBrandIsCustom(true);
                                  setBrandSearchOpen(false);
                                  handleGeneralChange("brand", "");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    "opacity-0"
                                  )}
                                />
                                Add Custom...
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div>
                  <Label htmlFor="general-condition" className="text-xs mb-1.5 block">Condition</Label>
                  <Select
                    value={generalForm.condition ? String(generalForm.condition) : undefined}
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
                  <Label htmlFor="general-sku" className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    id="general-sku"
                    name="general-sku"
                    placeholder=""
                    value={generalForm.sku || ""}
                    onChange={(e) => handleGeneralChange("sku", e.target.value)}
                  />
                </div>
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
                          handleGeneralChange("categoryId", "");
                          setGeneralCategoryPath([]);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* US Size - Only show when category is selected and has size aspect */}
                {shouldShowGeneralSize && (
                  <div>
                    <Label className="text-xs mb-1.5 block">US Size</Label>
                    <Input
                      placeholder="e.g. Men's M, 10, XL"
                      value={generalForm.size}
                      onChange={(e) => handleGeneralChange("size", e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Shipping Settings Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Shipping Settings</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label htmlFor="general-zip" className="text-xs mb-1.5 block">Zip Code</Label>
                  <Input
                    id="general-zip"
                    name="general-zip"
                    placeholder="Enter Zip Code"
                    value={generalForm.zip || ""}
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
                  <Label className="text-xs mb-1.5 block">Tags</Label>
                  <TagInput
                    placeholder="Type keywords and press space or comma to add tags (used for Mercari and Facebook)"
                    value={generalForm.tags}
                    onChange={(value) => handleGeneralChange("tags", value)}
                  />
                </div>
              </div>

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {ebayForm.photos?.length > 0 && (
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
                            handlePhotoReorder(dragIndex, dropIndex, 'ebay');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={ebayForm.photos[0].preview || ebayForm.photos[0].imageUrl} alt={ebayForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <div className="absolute top-1 right-1 flex gap-1 z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageToEdit({ 
                                url: ebayForm.photos[0].preview || ebayForm.photos[0].imageUrl, 
                                photoId: ebayForm.photos[0].id, 
                                marketplace: 'ebay',
                                index: 0
                              });
                              setEditorOpen(true);
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                            title="Edit photo"
                          >
                            <ImageIcon className="h-3 w-3" />
                            <span className="sr-only">Edit photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePhotoRemove(ebayForm.photos[0].id, 'ebay');
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span className="sr-only">Remove photo</span>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {ebayForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
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
                            handlePhotoReorder(dragIndex, dropIndex, 'ebay');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                      <div className="absolute top-1 right-1 flex gap-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageToEdit({ 
                              url: photo.preview || photo.imageUrl, 
                              photoId: photo.id, 
                              marketplace: 'ebay',
                              index: index + 1
                            });
                            setEditorOpen(true);
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                          title="Edit photo"
                        >
                          <ImageIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span className="sr-only">Edit photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'ebay');
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(ebayForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => ebayPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
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

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Title Section */}
                <div>
                  <Label htmlFor="ebay-title" className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    id="ebay-title"
                    name="ebay-title"
                    placeholder="Enter listing title"
                    value={ebayForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-description" className="text-xs">Description</Label>
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
                  <RichTextarea
                    id="ebay-description"
                    name="ebay-description"
                    placeholder={generalForm.description ? `Inherited from General` : "Enter eBay-specific description..."}
                    value={ebayForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* eBay Brand - use same dropdown as general form */}
                <div className="md:col-span-2">
                  <Label htmlFor="ebay-brand" className="text-xs mb-1.5 block">Brand <span className="text-red-500">*</span></Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        id="ebay-brand"
                        name="ebay-brand"
                        placeholder={generalForm.brand || "Enter brand name"}
                        value={ebayForm.ebayBrand || ""}
                        onChange={(e) => handleMarketplaceChange("ebay", "ebayBrand", e.target.value)}
                        className="flex-1"
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
                      value={ebayForm.ebayBrand || generalForm.brand ? String(ebayForm.ebayBrand || generalForm.brand) : undefined}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setBrandIsCustom(true);
                          handleMarketplaceChange("ebay", "ebayBrand", "");
                        } else {
                          handleMarketplaceChange("ebay", "ebayBrand", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalForm.brand ? `Inherited: ${generalForm.brand}` : "Select or Custom"} />
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

                {/* Category Section */}
                <div className="md:col-span-2">
                  <Label htmlFor="ebay-category" className="text-xs mb-1.5 block">Category <span className="text-red-500">*</span></Label>
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
                        id="ebay-category"
                        name="ebay-category"
                        value={ebayForm.categoryId ? String(ebayForm.categoryId) : undefined}
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
                        <SelectTrigger id="ebay-category-trigger">
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

                {/* Category Specifics Section - Always show when category is selected */}
                {ebayForm.categoryId && (
                  <div className="md:col-span-2 space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Category Specifics</Label>
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
                      </Button>
                    </div>
                    
                    {/* Loading state */}
                    {isLoadingEbayAspects && (
                      <div className="flex items-center gap-2 p-3 border rounded-md mb-4">
                        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading category specifics...</span>
                      </div>
                    )}

                    {/* Error state */}
                    {ebayAspectsError && !isLoadingEbayAspects && (
                      <div className="p-3 border rounded-md border-destructive/50 bg-destructive/10 mb-4">
                        <p className="text-sm text-destructive">Error loading category specifics: {ebayAspectsError.message}</p>
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer">Full error details</summary>
                          <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(ebayAspectsError, null, 2)}</pre>
                        </details>
                      </div>
                    )}

                    {/* Show raw API response in debug mode when no aspects found */}
                    {process.env.NODE_ENV === 'development' && !isLoadingEbayAspects && !ebayAspectsError && ebayCategoryAspects.length === 0 && ebayCategoryAspectsData && (
                      <div className="p-3 border rounded-md border-orange-500/50 bg-orange-500/10 mb-4">
                        <p className="text-sm text-orange-600">⚠️ API returned data but no aspects were found. Raw response:</p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs">View raw API response</summary>
                          <pre className="mt-1 text-xs whitespace-pre-wrap break-all">{JSON.stringify(ebayCategoryAspectsData, null, 2)}</pre>
                        </details>
                      </div>
                    )}

                    {/* Debug info - collapsed by default, only in development */}
                    {process.env.NODE_ENV === 'development' && !isLoadingEbayAspects && ebayForm.categoryId && (
                      <details className="text-xs text-muted-foreground p-2 bg-muted rounded mb-2">
                        <summary className="cursor-pointer font-medium">
                          🔍 Debug: Category Aspects ({ebayCategoryAspects.length} found)
                        </summary>
                        <div className="space-y-1 mt-2">
                          <div>Category ID: {ebayForm.categoryId}</div>
                          <div>Category Name: {ebayForm.categoryName}</div>
                          {ebayAspectsError && (
                            <div className="text-red-600">Error: {ebayAspectsError.message}</div>
                          )}
                          {!ebayAspectsError && ebayCategoryAspects.length > 0 && (
                            <>
                              <div className="mt-2">Aspects:</div>
                              {ebayCategoryAspects.map((a, idx) => (
                                <div key={idx} className="ml-2 text-xs">
                                  - {a.localizedAspectName || a.aspectName || a.name || 'Unknown'} 
                                  ({a.aspectValues?.length || 0} values)
                                  <details className="ml-2">
                                    <summary className="cursor-pointer text-blue-600">View data</summary>
                                    <pre className="text-xs mt-1 whitespace-pre-wrap break-all">{JSON.stringify(a, null, 2)}</pre>
                                  </details>
                                </div>
                              ))}
                              {ebayTypeAspect ? (
                                <div className="text-green-600">
                                  ✓ Model/Type aspect found: {ebayTypeAspect.localizedAspectName || ebayTypeAspect.aspectName || ebayTypeAspect.name} ({ebayTypeValues.length} values)
                                </div>
                              ) : (
                                <div className="text-orange-600">
                                  ✗ No Model/Type aspect found. Check console for full aspect data.
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </details>
                    )}
                    
                    {/* Type and Condition side by side */}
                    {!isLoadingEbayAspects && !ebayAspectsError && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Type/Model Field - Show if ebayTypeAspect exists (even if no values yet, to show loading state) */}
                        {ebayTypeAspect ? (
                          <div>
                            <Label className="text-xs mb-1.5 block">
                              {ebayTypeAspect.localizedAspectName} <span className="text-red-500">*</span>
                            </Label>
                            {ebayTypeValues.length > 0 ? (
                              <Select
                                value={ebayForm.itemType ? String(ebayForm.itemType) : undefined}
                                onValueChange={(value) => handleMarketplaceChange("ebay", "itemType", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Select ${ebayTypeAspect.localizedAspectName.toLowerCase()}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {ebayTypeValues.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-xs text-muted-foreground p-2 border rounded">
                                Loading {ebayTypeAspect.localizedAspectName.toLowerCase()} options...
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground p-2 border rounded">
                            No Model/Type aspect available for this category.
                          </div>
                        )}

                        {/* Condition Dropdown */}
                        <div>
                          <Label className="text-xs mb-1.5 block">
                            Condition <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={ebayForm.condition ? String(ebayForm.condition) : undefined}
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
                      </div>
                    )}
                  </div>
                )}

                {/* Condition Dropdown - Show when no category selected */}
                {!ebayForm.categoryId && (
                  <div>
                    <Label className="text-xs mb-1.5 block">
                      Condition <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={ebayForm.condition ? String(ebayForm.condition) : undefined}
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
                )}

                {/* SKU Field */}
                <div>
                  <Label htmlFor="ebay-sku" className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    id="ebay-sku"
                    name="ebay-sku"
                    placeholder={generalForm.sku || "Enter SKU"}
                    value={ebayForm.sku || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "sku", e.target.value)}
                  />
                  {generalForm.sku && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.sku} from General form. You can edit this field.
                    </p>
                  )}
                </div>
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
              </div>

              {/* Pricing Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">Pricing Format <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.pricingFormat ? String(ebayForm.pricingFormat) : undefined}
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
                    value={ebayForm.duration ? String(ebayForm.duration) : undefined}
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
                    value={ebayForm.buyItNowPrice || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "buyItNowPrice", e.target.value)}
                  />
                  {generalForm.price && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited ${generalForm.price} from General form. You can edit this price.
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
                    value={ebayForm.shippingMethod ? String(ebayForm.shippingMethod) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard: Small to medium items">Standard: Small to medium items</SelectItem>
                      <SelectItem value="Local pickup only: Sell to buyer nears you">Local pickup only: Sell to buyer nears you</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Cost Type <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.shippingCostType ? String(ebayForm.shippingCostType) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingCostType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Calculated: Cost varies based on buyer location">Calculated: Cost varies based on buyer location</SelectItem>
                      <SelectItem value="Flat: Same cost regardless of buyer location">Flat: Same cost regardless of buyer location</SelectItem>
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
                    value={ebayForm.shippingCost || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "shippingCost", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Handling Time <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.handlingTime ? String(ebayForm.handlingTime) : undefined}
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
                    value={ebayForm.shipFromCountry ? String(ebayForm.shipFromCountry) : "United States"}
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
                    value={ebayForm.shippingService ? String(ebayForm.shippingService) : undefined}
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
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Location Descriptions</Label>
                  <Input
                    placeholder="(e.g., 'Spain')"
                    value={ebayForm.locationDescriptions || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "locationDescriptions", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional descriptive text shown to buyers (e.g., "Spain")
                  </p>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Location</Label>
                  <Input
                    placeholder={generalForm.zip || "Zip or region"}
                    value={ebayForm.shippingLocation || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "shippingLocation", e.target.value)}
                  />
                  {generalForm.zip && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.zip} from General form. You can edit this field.
                    </p>
                  )}
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
                        value={ebayForm.returnWithin ? String(ebayForm.returnWithin) : "30 days"}
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
                        value={ebayForm.returnShippingPayer ? String(ebayForm.returnShippingPayer) : "Buyer"}
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
                        value={ebayForm.returnRefundMethod ? String(ebayForm.returnRefundMethod) : "Full Refund"}
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
              </div>

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
              </div>

              {/* eBay Listing Status - Show when item is listed */}
              {ebayListingId && (
                <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-green-600" />
                      <Label className="text-sm font-semibold">Listing Active</Label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">eBay Listing ID</Label>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-background px-2 py-1 rounded border">{ebayListingId}</code>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          const url = getEbayItemUrl(ebayListingId);
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Listing
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={async () => {
                          if (!confirm('Are you sure you want to end this eBay listing? This action cannot be undone.')) {
                            return;
                          }
                          
                          try {
                            setIsSaving(true);
                            const response = await fetch('/api/ebay/listing', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                operation: 'EndItem',
                                itemId: ebayListingId,
                                userToken: ebayToken?.access_token,
                              }),
                            });

                            if (!response.ok) {
                              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                              throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
                            }

                            const result = await response.json();
                            
                            if (result.Ack === 'Success' || result.Ack === 'Warning') {
                              // Clear listing ID
                              setEbayListingId(null);
                              if (currentEditingItemId) {
                                localStorage.removeItem(`ebay_listing_${currentEditingItemId}`);
                              }
                              
                              // Update inventory item status
                              if (currentEditingItemId) {
                                try {
                                  await base44.entities.InventoryItem.update(currentEditingItemId, {
                                    status: 'available',
                                    ebay_listing_id: '',
                                  });
                                  queryClient.invalidateQueries(['inventoryItems']);
                                } catch (updateError) {
                                  console.error('Error updating inventory item:', updateError);
                                }
                              }

                              toast({
                                title: "Listing ended",
                                description: "Your eBay listing has been ended successfully.",
                              });
                            } else {
                              throw new Error(result.Errors?.join(', ') || 'Failed to end listing');
                            }
                          } catch (error) {
                            console.error('Error ending eBay listing:', error);
                            toast({
                              title: "Failed to end listing",
                              description: error.message || "An error occurred while ending the listing. Please try again.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                      >
                        <Unlock className="h-4 w-4" />
                        Delist
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!ebayListingId && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("ebay")}>
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                  <Button className="gap-2" onClick={() => handleListOnMarketplace("ebay")}>
                    List on eBay
                  </Button>
                </div>
              )}
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
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {etsyForm.photos?.length > 0 && (
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
                            handlePhotoReorder(dragIndex, dropIndex, 'etsy');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={etsyForm.photos[0].preview || etsyForm.photos[0].imageUrl} alt={etsyForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(etsyForm.photos[0].id, 'etsy');
                          }}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {etsyForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
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
                            handlePhotoReorder(dragIndex, dropIndex, 'etsy');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'etsy');
                          }}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(etsyForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => etsyPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
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
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  <RichTextarea
                    placeholder={generalForm.description ? `Inherited from General` : "Enter Etsy-specific description..."}
                    value={etsyForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("etsy", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Brand Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder={generalForm.brand || "Enter brand name"}
                        value={etsyForm.brand || ""}
                        onChange={(e) => handleMarketplaceChange("etsy", "brand", e.target.value)}
                        className="flex-1"
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
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalForm.brand ? `Inherited: ${generalForm.brand}` : "Select or Custom"} />
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
                  />
                  {generalForm.sku && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.sku} from General form. You can edit this field.
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

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {mercariForm.photos?.length > 0 && (
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
                            handlePhotoReorder(dragIndex, dropIndex, 'mercari');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={mercariForm.photos[0].preview || mercariForm.photos[0].imageUrl} alt={mercariForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(mercariForm.photos[0].id, 'mercari');
                          }}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {mercariForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
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
                            handlePhotoReorder(dragIndex, dropIndex, 'mercari');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'mercari');
                          }}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(mercariForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => mercariPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
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
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  <RichTextarea
                    placeholder={generalForm.description ? `Inherited from General` : "Enter Mercari-specific description..."}
                    value={mercariForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Brand Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder={generalForm.brand || "Enter brand name"}
                        value={mercariForm.brand || ""}
                        onChange={(e) => handleMarketplaceChange("mercari", "brand", e.target.value)}
                        className="flex-1"
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
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalForm.brand ? `Inherited: ${generalForm.brand}` : "Select or Custom"} />
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
                  {generalForm.brand && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.brand} from General form. You can edit this field.
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

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {facebookForm.photos?.length > 0 && (
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
                            handlePhotoReorder(dragIndex, dropIndex, 'facebook');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={facebookForm.photos[0].preview || facebookForm.photos[0].imageUrl} alt={facebookForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(facebookForm.photos[0].id, 'facebook');
                          }}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {facebookForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
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
                            handlePhotoReorder(dragIndex, dropIndex, 'facebook');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'facebook');
                          }}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(facebookForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => facebookPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
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
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  <RichTextarea
                    placeholder={generalForm.description ? `Inherited from General` : "Enter Facebook-specific description..."}
                    value={facebookForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Brand Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder={generalForm.brand || "Enter brand name"}
                        value={facebookForm.brand || ""}
                        onChange={(e) => handleMarketplaceChange("facebook", "brand", e.target.value)}
                        className="flex-1"
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
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalForm.brand ? `Inherited: ${generalForm.brand}` : "Select or Custom"} />
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
                  {generalForm.brand && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.brand} from General form. You can edit this field.
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
                    placeholder={generalForm.zip ? `Inherited from General: ${generalForm.zip}` : "Preferred meetup details"}
                    value={facebookForm.meetUpLocation}
                    onChange={(e) => handleMarketplaceChange("facebook", "meetUpLocation", e.target.value)}
                  />
                  {generalForm.zip && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.zip} from General form. You can edit this field.
                    </p>
                  )}
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

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

      {/* Image Editor */}
      <ImageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        imageSrc={imageToEdit.url}
        onSave={handleSaveEditedImage}
        fileName={`${imageToEdit.marketplace}-${imageToEdit.photoId || 'photo'}-edited.jpg`}
        allImages={
          imageToEdit.marketplace === 'general' 
            ? (templateForms.general?.photos || []).map(p => p.preview || p.imageUrl || p.url)
            : (templateForms[imageToEdit.marketplace]?.photos || []).map(p => p.preview || p.imageUrl || p.url)
        }
        onApplyToAll={handleApplyFiltersToAll}
        itemId={currentEditingItemId || `temp_${imageToEdit.marketplace}`}
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

