
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { format, parseISO } from "date-fns";
import BulkActionsMenu from "../components/BulkActionsMenu";
import imageCompression from "browser-image-compression";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInventoryTags } from "@/hooks/useInventoryTags";

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
  price: "", // Listing Price
  cost: "", // Purchase Price
  customLabels: "", // Will sync to inventory tags
};

const MARKETPLACE_TEMPLATE_DEFAULTS = {
  ebay: {
    inheritGeneral: true,
    shippingMethod: "Calculated",
    shippingCostType: "calculated",
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
  const photoInputRef = React.useRef(null);

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
      description: "We’ll refresh the integration and pull the latest account settings.",
    });
  };

  const handleTemplateSave = (templateKey) => {
    const label = TEMPLATE_DISPLAY_NAMES[templateKey] || "Template";
    toast({
      title: `${label} template saved`,
      description: "Your preferences will be used the next time you compose a listing.",
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

      // Marketplace filter - if no marketplaces selected, show all items
      // If all marketplaces selected, show all items
      // If specific marketplaces selected, only show items crosslisted to those
      if (activeMkts.length === 0 || activeMkts.length === MARKETPLACES.length) {
        // No filter or all selected - show all items
        return true;
      }

      // Filter by selected marketplaces - item must be crosslisted to at least one selected marketplace
      const itemIsListedOnSelectedMkts = activeMkts.some((mktId) => {
        // Map marketplace IDs to the keys used in computeListingState
        const marketplaceMap = {
          ebay: "ebay",
          facebook: "facebook",
          mercari: "mercari",
          etsy: "etsy",
          poshmark: "poshmark",
        };
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

  const openComposer = (ids) => {
    const primaryId = ids?.[0] || selected[0];
    const targetItem = crosslistableItems.find((item) => item.id === primaryId);

    // If no item selected, create new empty template
    if (!targetItem) {
      setTemplateForms(createInitialTemplateState(null));
    } else {
      populateTemplates(targetItem);
    }

    // Set composer targets - if activeMkts is empty, use all marketplaces as default for composer
    setComposerTargets(activeMkts.length > 0 ? activeMkts : MARKETPLACES.map(m => m.id));
    if (ids?.length) setSelected(ids);
    setComposerOpen(true);
  };

  const generalForm = templateForms.general;
  const ebayForm = templateForms.ebay;
  const etsyForm = templateForms.etsy;
  const mercariForm = templateForms.mercari;
  const facebookForm = templateForms.facebook;

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
            <BulkActionsMenu />
            <Button
              onClick={() => openComposer(selected)}
              disabled={selected.length === 0}
              className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
            >
              <Rocket className="w-4 h-4 mr-2" />
              Crosslist {selected.length > 0 ? `(${selected.length})` : ""}
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
                <Label className="text-xs mb-1.5 block">Listing State</Label>
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
                    ? "All marketplaces selected. Showing all items."
                    : `Showing items crosslisted to ${activeMkts.length} marketplace${activeMkts.length === 1 ? "" : "s"}.`
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 flex-wrap gap-3 min-w-0">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
                <span className="font-medium text-foreground">{crosslistableItems.length}</span> items
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => toggleAll(selected.length !== filtered.length)}
                  className="whitespace-nowrap"
                >
                  {selected.length === filtered.length ? "Unselect All" : "Select All"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openComposer([])}
                  className="whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Compose New Listing
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
                      className="!bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 flex-shrink-0"
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
                      onClick={() => openComposer([it.id])}
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
                        className="!bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600"
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
                      <Button size="sm" className="w-full whitespace-nowrap" onClick={() => openComposer([it.id])}>
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

      <Sheet open={composerOpen} onOpenChange={setComposerOpen}>
        <SheetContent side="bottom" className="h-[85vh] sm:rounded-t-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Compose Listing</SheetTitle>
            <SheetDescription>
              Choose marketplaces and set the base fields. Full per-market fine-tuning can follow.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            <Label className="text-xs mb-1.5 block">Select Form</Label>
            <div className="flex flex-wrap gap-2">
              {/* General form option */}
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
              {/* Marketplace form options */}
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

          <div className="mt-6 space-y-6">
            {/* General Form */}
            {activeForm === "general" && (
              <div className="space-y-6">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {generalForm.photos.map((photo) => (
                      <div key={photo.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted">
                        <img src={photo.preview} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handlePhotoRemove(photo.id)}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhotos || (generalForm.photos?.length || 0) >= MAX_PHOTOS}
                      className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 text-muted-foreground transition hover:border-foreground/80 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ImagePlus className="h-5 w-5" />
                      <span className="mt-1 text-[11px] font-medium">Add photos</span>
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
                    <Input
                      placeholder="Brand + Model + Size"
                      value={generalForm.title}
                      onChange={(e) => handleGeneralChange("title", e.target.value)}
                    />
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
                    <Label className="text-xs mb-1.5 block">Description</Label>
                    <Textarea
                      placeholder="Condition, inclusions, measurements, shipping, returns…"
                      value={generalForm.description}
                      onChange={(e) => handleGeneralChange("description", e.target.value)}
                      className="min-h-[120px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Brand</Label>
                    <Input
                      placeholder="e.g. Patagonia"
                      value={generalForm.brand}
                      onChange={(e) => handleGeneralChange("brand", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Condition</Label>
                    <Select
                      value={generalForm.condition || undefined}
                      onValueChange={(value) => handleGeneralChange("condition", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="like_new">Like New</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">SKU</Label>
                    <Input
                      placeholder="Internal SKU"
                      value={generalForm.sku}
                      onChange={(e) => handleGeneralChange("sku", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Zip Code</Label>
                    <Input
                      placeholder="Ship-from zip"
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
                  <div>
                    <Label className="text-xs mb-1.5 block">Category</Label>
                    <Input
                      placeholder="Primary category"
                      value={generalForm.category}
                      onChange={(e) => handleGeneralChange("category", e.target.value)}
                    />
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
                    <Input
                      placeholder="Comma separated keywords"
                      value={generalForm.tags}
                      onChange={(e) => handleGeneralChange("tags", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1.5 block">Primary Color</Label>
                    <Input
                      placeholder="Primary color"
                      value={generalForm.color1}
                      onChange={(e) => handleGeneralChange("color1", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Secondary Color</Label>
                    <Input
                      placeholder="Secondary color"
                      value={generalForm.color2}
                      onChange={(e) => handleGeneralChange("color2", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1.5 block">Package Details</Label>
                    <Textarea
                      placeholder="Box size, weight, fragile notes…"
                      value={generalForm.packageDetails}
                      onChange={(e) => handleGeneralChange("packageDetails", e.target.value)}
                      className="min-h-[100px]"
                    />
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

                <div className="flex justify-end">
                  <Button className="gap-2" onClick={() => handleTemplateSave("general")}>
                    <Save className="h-4 w-4" />
                    Save General Template
                  </Button>
                </div>
              </div>
            )}

            {/* eBay Form */}
            {activeForm === "ebay" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">eBay listing specifics</h3>
                    <p className="text-sm text-muted-foreground">
                      Media, title, description, and pricing inherit from your General template.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ebay-sync"
                      checked={ebayForm.inheritGeneral}
                      onCheckedChange={(checked) => handleToggleInherit("ebay", checked)}
                    />
                    <Label htmlFor="ebay-sync" className="text-sm text-muted-foreground">Sync with General</Label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1.5 block">Pricing Format</Label>
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
                    <Label className="text-xs mb-1.5 block">Duration</Label>
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
                    <Label className="text-xs mb-1.5 block">Buy It Now Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={generalForm.price || "0.00"}
                      value={ebayForm.buyItNowPrice}
                      onChange={(e) => handleMarketplaceChange("ebay", "buyItNowPrice", e.target.value)}
                      disabled={ebayForm.inheritGeneral && Boolean(generalForm.price)}
                    />
                    {ebayForm.inheritGeneral && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Inherits {generalForm.price ? `$${generalForm.price}` : "General price"} when synced.
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
                  <div>
                    <Label className="text-xs mb-1.5 block">Shipping Method</Label>
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
                    <Label className="text-xs mb-1.5 block">Shipping Cost Type</Label>
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
                    <Label className="text-xs mb-1.5 block">Handling Time</Label>
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
                    <Input
                      placeholder="United States"
                      value={ebayForm.shipFromCountry}
                      onChange={(e) => handleMarketplaceChange("ebay", "shipFromCountry", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Shipping Service</Label>
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
                      disabled={ebayForm.inheritGeneral && Boolean(generalForm.zip)}
                      onChange={(e) => handleMarketplaceChange("ebay", "shippingLocation", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Accept Returns</Label>
                    <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                      <Switch
                        id="ebay-accept-returns"
                        checked={ebayForm.acceptReturns}
                        onCheckedChange={(checked) => handleMarketplaceChange("ebay", "acceptReturns", checked)}
                      />
                      <Label htmlFor="ebay-accept-returns" className="text-sm">Accept returns</Label>
                    </div>
                  </div>
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

                <div className="flex justify-end">
                  <Button className="gap-2" onClick={() => handleTemplateSave("ebay")}>
                    <Save className="h-4 w-4" />
                    Save eBay Template
                  </Button>
                </div>
              </div>
            )}

            {/* Etsy Form */}
            {activeForm === "etsy" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Etsy listing profile</h3>
                    <p className="text-sm text-muted-foreground">
                      Etsy loves rich listings—processing time and “who made it” details are required.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="etsy-sync"
                      checked={etsyForm.inheritGeneral}
                      onCheckedChange={(checked) => handleToggleInherit("etsy", checked)}
                    />
                    <Label htmlFor="etsy-sync" className="text-sm text-muted-foreground">Sync with General</Label>
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
                    <Input
                      placeholder="Inherits general tags unless overridden"
                      value={etsyForm.tags}
                      onChange={(e) => handleMarketplaceChange("etsy", "tags", e.target.value)}
                      disabled={etsyForm.inheritGeneral}
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

                <div className="flex justify-end">
                  <Button className="gap-2" onClick={() => handleTemplateSave("etsy")}>
                    <Save className="h-4 w-4" />
                    Save Etsy Template
                  </Button>
                </div>
              </div>
            )}

            {/* Mercari Form */}
            {activeForm === "mercari" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Mercari smart pricing</h3>
                    <p className="text-sm text-muted-foreground">
                      Control smart pricing and shipping preferences for Mercari listings.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="mercari-sync"
                      checked={mercariForm.inheritGeneral}
                      onCheckedChange={(checked) => handleToggleInherit("mercari", checked)}
                    />
                    <Label htmlFor="mercari-sync" className="text-sm text-muted-foreground">Sync with General</Label>
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
                      disabled={mercariForm.inheritGeneral}
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

                <div className="flex justify-end">
                  <Button className="gap-2" onClick={() => handleTemplateSave("mercari")}>
                    <Save className="h-4 w-4" />
                    Save Mercari Template
                  </Button>
                </div>
              </div>
            )}

            {/* Facebook Form */}
            {activeForm === "facebook" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Facebook Marketplace</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure shipping vs pickup defaults and whether offers are allowed.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="facebook-sync"
                      checked={facebookForm.inheritGeneral}
                      onCheckedChange={(checked) => handleToggleInherit("facebook", checked)}
                    />
                    <Label htmlFor="facebook-sync" className="text-sm text-muted-foreground">Sync with General</Label>
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
                      disabled={facebookForm.inheritGeneral}
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
                      disabled={facebookForm.inheritGeneral && Boolean(generalForm.zip)}
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

                <div className="flex justify-end">
                  <Button className="gap-2" onClick={() => handleTemplateSave("facebook")}>
                    <Save className="h-4 w-4" />
                    Save Facebook Template
                  </Button>
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="mt-6">
            <SheetClose asChild>
              <Button variant="outline" disabled={isSaving}>Cancel</Button>
            </SheetClose>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  // Upload first photo if available
                  let imageUrl = "";
                  if (generalForm.photos && generalForm.photos.length > 0) {
                    const firstPhoto = generalForm.photos[0];
                    if (firstPhoto.file) {
                      // Upload the file
                      const uploadPayload = firstPhoto.file instanceof File 
                        ? firstPhoto.file 
                        : new File([firstPhoto.file], firstPhoto.fileName, { type: firstPhoto.file.type });
                      
                      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
                      imageUrl = file_url;
                    } else if (firstPhoto.preview && !firstPhoto.preview.startsWith('blob:')) {
                      // Already uploaded URL
                      imageUrl = firstPhoto.preview;
                    }
                  }

                  // Build custom labels array from comma-separated string
                  const customLabels = generalForm.customLabels
                    ? generalForm.customLabels.split(',').map(label => label.trim()).filter(Boolean)
                    : [];

                  // Build tags array from comma-separated string
                  const tags = generalForm.tags
                    ? generalForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
                    : [];

                  // Create inventory item
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
                    custom_labels: generalForm.customLabels || "",
                    image_url: imageUrl,
                    notes: generalForm.description || "",
                  };

                  // Create the inventory item
                  const createdItem = await base44.entities.InventoryItem.create(inventoryData);

                  // Add custom labels as tags using useInventoryTags hook
                  if (createdItem?.id) {
                    const allLabels = [...customLabels, ...tags];
                    for (const label of allLabels) {
                      addTag(createdItem.id, label);
                    }
                  }

                  // Invalidate inventory query to refresh the list
                  queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

                  toast({
                    title: "Item saved to inventory",
                    description: `${generalForm.title || "Item"} has been added to your inventory.`,
                  });

                  setComposerOpen(false);
                  
                  // Reset form for next use
                  setTemplateForms(createInitialTemplateState(null));
                  setSelected([]);
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
              }}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Save to Inventory
                  <Rocket className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
