
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { salesApi } from "@/api/salesApi";
import { inventoryApi } from "@/api/inventoryApi";
import { uploadApi } from "@/api/uploadApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sortSalesByRecency } from "@/utils/sales";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Calculator, Calendar as CalendarIcon, BarChart, Globe, Camera, Truck, Plus, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogOverlay
} from "@/components/ui/dialog";
import ClearableDateInput from "../components/ClearableDateInput";
import imageCompression from "browser-image-compression";
import { extractCustomFees, getCustomFeesTotal, injectCustomFees } from "@/utils/customFees";
import { splitBase44Tags, mergeBase44Tags } from "@/utils/base44Notes";

const platformOptions = [
  { value: "ebay", label: "eBay" },
  { value: "facebook_marketplace", label: "Facebook" },
  { value: "etsy", label: "Etsy" },
  { value: "mercari", label: "Mercari" },
  { value: "offer_up", label: "OfferUp" }
];

const platformIcons = {
  ebay: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
  facebook_marketplace: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
  mercari: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  etsy: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
  offer_up: "https://cdn.brandfetch.io/id5p1Knwlt/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B"
};

const FACEBOOK_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";

const PREDEFINED_SOURCES = ["Amazon", "Walmart", "Best Buy"];
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
  "Stereos & Speakers",
  "Sporting Goods",
  "Tools",
  "Toys & Hobbies",
  "Yoga"
];

const MoneyPrinterIcon = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M8.25 8.25a7.5 7.5 0 1 0 15 0a7.5 7.5 0 0 0-15 0m-1.875 5.842a1.34 1.34 0 0 0 .843 1.245l2.064.826a1.342 1.342 0 0 1-.5 2.587H6.75m1.5 1.5v-1.5" />
      <path d="M5.281 8.867a7.5 7.5 0 1 0 9.853 9.852M17.25 5.25h-2.033a1.342 1.342 0 0 0-.5 2.587l2.064.826a1.342 1.342 0 0 1-.5 2.587H14.25m1.5-6v-1.5m0 9v-1.5" />
    </g>
  </svg>
);


export default function AddSale() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const searchParams = new URLSearchParams(location.search);
  const inventoryId = searchParams.get('inventoryId');
  const saleId = searchParams.get('id'); // For editing
  const copyId = searchParams.get('copyId'); // For copying
  
  const idToLoad = saleId || copyId; // This will be the ID for fetching an existing sale

  const { data: existingSale, isLoading: isLoadingSale } = useQuery({
    queryKey: ['sale', idToLoad],
    queryFn: () => salesApi.get(idToLoad),
    enabled: !!idToLoad, // Only fetch if saleId or copyId is present
  });

  // NEW: Fetch inventory item details if inventoryId is present and we're creating a new sale
  const { data: inventoryItemDetails, isLoading: isLoadingInventoryItem } = useQuery({
    queryKey: ['inventoryItemForSaleCreation', inventoryId], // Unique key for this specific use case
    queryFn: () => inventoryApi.get(inventoryId),
    enabled: !!inventoryId && !idToLoad, // Only fetch if linking from inventory and not editing/copying a sale
    staleTime: 0, // Ensure we get the latest quantity_sold when creating a new sale
  });

  // Prefill from inventory item, if present, used only for initial creation from inventory
  const itemNameFromUrl = searchParams.get('itemName');
  const purchasePriceFromUrl = searchParams.get('purchasePrice');
  const purchaseDateFromUrl = searchParams.get('purchaseDate');
  const sourceFromUrl = searchParams.get('source');
  const categoryFromUrl = searchParams.get('category');
  const imageUrlFromUrl = searchParams.get('imageUrl');
  const soldQuantityFromUrl = searchParams.get('soldQuantity'); // NEW: Read sold quantity from URL

  const [formData, setFormData] = useState({
    item_name: "",
    platform: "",
    purchase_price: "",
    purchase_date: new Date().toISOString().split('T')[0],
    source: "",
    selling_price: "",
    shipping_cost: "",
    platform_fees: "",
    other_costs: "",
    vat_fees: "",
    sale_date: new Date().toISOString().split('T')[0],
    category: "",
    notes: "",
    image_url: "",
    quantity_sold: 1, // Default for new sales
    return_deadline: "",
    facebook_sale_type: "local",
    // eBay-specific fields (fully displayed)
    tracking_number: "",
    shipping_carrier: "",
    delivery_date: "",
    shipped_date: "",
    item_condition: "",
    // eBay-specific fields (hidden behind button)
    buyer_address: null,
    payment_method: "",
    payment_status: "",
    payment_date: "",
    item_location: "",
    buyer_notes: "",
    ebay_order_id: "",
    ebay_transaction_id: "",
    ebay_buyer_username: "",
  });

  const [customFees, setCustomFees] = useState([]);
  const [customFeeFormOpen, setCustomFeeFormOpen] = useState(false);
  const [customFeeDraft, setCustomFeeDraft] = useState({ name: "", amount: "" });
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false); // For eBay additional details button
  // NEW: Store per-item purchase price for multi-quantity inventory items
  const [perItemPurchasePrice, setPerItemPurchasePrice] = useState(null);

  // NEW: Calculate available quantity for the input field based on fetched inventory details
  const totalItemQuantity = inventoryItemDetails?.quantity || 0;
  const soldFromItem = inventoryItemDetails?.quantity_sold || 0;
  const remainingItemQuantity = totalItemQuantity - soldFromItem;
  
  // NEW: Calculate remaining after the current sale quantity
  const currentQuantityToSell = parseInt(formData.quantity_sold, 10) || 0;
  const remainingAfterThisSale = remainingItemQuantity - currentQuantityToSell;

  const [calculatedProfit, setCalculatedProfit] = useState(null);
  const [isOtherSource, setIsOtherSource] = useState(false);
  const [isOtherCategory, setIsOtherCategory] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false); // New state for sold listings dialog
  const [activeMarket, setActiveMarket] = useState('ebay_sold');
  const imageInputRef = useRef(null);
  const [base44Tags, setBase44Tags] = useState("");

  useEffect(() => {
    setIsOtherSource(false);
    setIsOtherCategory(false);
    
    if (existingSale) {
      const dataToLoad = { ...existingSale };
      const { cleanNotes, customFees: storedCustomFees } = extractCustomFees(dataToLoad.notes || "");
      const { clean: cleanNoTags, tags } = splitBase44Tags(cleanNotes || "");
      if (!copyId) setBase44Tags(tags || "");
      const customFeesTotal = getCustomFeesTotal(storedCustomFees);
      let feesForState = storedCustomFees;

      if (copyId) {
        dataToLoad.sale_date = new Date().toISOString().split('T')[0];
        dataToLoad.profit = null;
        delete dataToLoad._id;
        dataToLoad.inventory_id = null; // Don't copy inventory association when creating a new sale from an existing one
        dataToLoad.return_deadline = ""; // Clear return deadline for copied sales
        feesForState = [];
      }

      const rawOtherCosts =
        typeof dataToLoad.other_costs === "number"
          ? dataToLoad.other_costs
          : parseFloat(dataToLoad.other_costs);
      const adjustedOtherCosts =
        Number.isFinite(rawOtherCosts) && customFeesTotal > 0
          ? Math.max(0, rawOtherCosts - customFeesTotal)
          : Number.isFinite(rawOtherCosts)
            ? rawOtherCosts
            : "";
      const formattedOtherCosts =
        adjustedOtherCosts === "" ? "" : adjustedOtherCosts.toFixed(2);

      setCustomFees(feesForState);

      setFormData(prev => ({
        ...prev,
        ...dataToLoad,
        return_deadline: dataToLoad.return_deadline || "", // Initialize return_deadline
        facebook_sale_type: dataToLoad.facebook_sale_type || "local",
        purchase_price: String(dataToLoad.purchase_price ?? ''),
        selling_price: String(dataToLoad.selling_price ?? ''),
        shipping_cost: String(dataToLoad.shipping_cost ?? ''),
        platform_fees: String(dataToLoad.platform_fees ?? ''),
        other_costs: formattedOtherCosts,
        vat_fees: String(dataToLoad.vat_fees ?? ''),
        notes: copyId ? '' : cleanNoTags,
        quantity_sold: String(dataToLoad.quantity_sold ?? 1),
        // eBay-specific fields (ensure they're loaded)
        tracking_number: dataToLoad.tracking_number || "",
        shipping_carrier: dataToLoad.shipping_carrier || "",
        delivery_date: dataToLoad.delivery_date || "",
        shipped_date: dataToLoad.shipped_date || "",
        item_condition: dataToLoad.item_condition || "",
        buyer_address: dataToLoad.buyer_address || null,
        payment_method: dataToLoad.payment_method || "",
        payment_status: dataToLoad.payment_status || "",
        payment_date: dataToLoad.payment_date || "",
        item_location: dataToLoad.item_location || "",
        buyer_notes: dataToLoad.buyer_notes || "",
        ebay_order_id: dataToLoad.ebay_order_id || "",
        ebay_transaction_id: dataToLoad.ebay_transaction_id || "",
        ebay_buyer_username: dataToLoad.ebay_buyer_username || "",
      }));

      const currentSource = dataToLoad.source;
      if (currentSource && !PREDEFINED_SOURCES.includes(currentSource)) {
        setIsOtherSource(true);
      }

      const currentCategory = dataToLoad.category;
      if (currentCategory && !PREDEFINED_CATEGORIES.includes(currentCategory)) {
        setIsOtherCategory(true);
      }

    } else if (inventoryId && !idToLoad && inventoryItemDetails) { // Add inventoryItemDetails as condition
      const initialSource = sourceFromUrl || "";
      const initialCategory = categoryFromUrl || "";
      const initialQuantitySold = soldQuantityFromUrl ? parseInt(soldQuantityFromUrl, 10) : 1; // NEW: Parse sold quantity from URL

      // FIX: purchasePriceFromUrl is ALREADY the per-item price (calculated in Inventory.js)
      const calculatedPerItemPrice = parseFloat(purchasePriceFromUrl) || 0;
      const initialPurchasePrice = calculatedPerItemPrice * initialQuantitySold;

      // Store the per-item price for future calculations
      setPerItemPurchasePrice(calculatedPerItemPrice);

      setFormData(prev => ({
        ...prev,
        item_name: itemNameFromUrl || "",
        purchase_price: initialPurchasePrice.toFixed(2), // Set calculated price based on quantity
        purchase_date: purchaseDateFromUrl || new Date().toISOString().split('T')[0],
        source: initialSource,
        category: initialCategory,
        image_url: imageUrlFromUrl || "",
        sale_date: new Date().toISOString().split('T')[0],
        quantity_sold: initialQuantitySold, // NEW: Set the quantity from URL
      }));

      if (initialSource && !PREDEFINED_SOURCES.includes(initialSource)) {
        setIsOtherSource(true);
      }
      if (initialCategory && !PREDEFINED_CATEGORIES.includes(initialCategory)) {
        setIsOtherCategory(true);
      }
    }
  }, [existingSale, inventoryId, idToLoad, copyId, itemNameFromUrl, purchasePriceFromUrl, purchaseDateFromUrl, sourceFromUrl, categoryFromUrl, imageUrlFromUrl, soldQuantityFromUrl, inventoryItemDetails]);

  // NEW: Update purchase_price when quantity_sold changes (only for inventory items)
  useEffect(() => {
    if (inventoryId && !idToLoad && perItemPurchasePrice !== null) {
      const quantitySold = parseInt(formData.quantity_sold, 10) || 1;
      const newPurchasePrice = perItemPurchasePrice * quantitySold;
      setFormData(prev => ({
        ...prev,
        purchase_price: newPurchasePrice.toFixed(2)
      }));
    }
  }, [formData.quantity_sold, inventoryId, idToLoad, perItemPurchasePrice]);

  const buildSalePayload = (saleData, feeList = customFees) => {
    const purchasePrice = parseFloat(saleData.purchase_price) || 0;
    const sellingPrice = parseFloat(saleData.selling_price) || 0;
    const shippingCost = parseFloat(saleData.shipping_cost) || 0;
    const platformFees = parseFloat(saleData.platform_fees) || 0;
    const otherCosts = parseFloat(saleData.other_costs) || 0;
    const vatFees = parseFloat(saleData.vat_fees) || 0;
    const quantitySold = parseInt(saleData.quantity_sold, 10) || 1;
    const includeCustomFees = saleData.platform?.toLowerCase() === 'ebay';
    const activeCustomFees = includeCustomFees ? feeList : [];
    const customFeesTotal = getCustomFeesTotal(activeCustomFees);
    const combinedOtherCosts = otherCosts + customFeesTotal;

    const totalCosts = purchasePrice + shippingCost + platformFees + combinedOtherCosts + vatFees;
    const profit = sellingPrice - totalCosts;
    const notesWithCustomFees = injectCustomFees(saleData.notes, activeCustomFees);
    const notesWithTags = mergeBase44Tags(notesWithCustomFees, saleId && !copyId ? base44Tags : "");

    return {
      ...saleData,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      shipping_cost: shippingCost,
      platform_fees: platformFees,
      other_costs: combinedOtherCosts,
      vat_fees: vatFees,
      return_deadline: saleData.return_deadline ? saleData.return_deadline : null,
      facebook_sale_type: saleData.facebook_sale_type || "local",
      profit,
      quantity_sold: quantitySold,
      inventory_id: inventoryId || saleData.inventory_id || null,
      sale_date: saleData.sale_date || new Date().toISOString().split("T")[0],
      created_date: saleData.created_date || new Date().toISOString(),
      notes: notesWithTags,
    };
  };

  const saleMutation = useMutation({
    mutationFn: (saleData) => {
      const finalData = buildSalePayload(saleData);
      return saleId
        ? salesApi.update(saleId, finalData)
        : salesApi.create(finalData);
    },
    onMutate: async (saleData) => {
      const payload = buildSalePayload(saleData);
      const optimisticId = saleId || payload.id || `temp-${Date.now()}`;
      const optimisticSale = {
        ...payload,
        id: optimisticId,
      };

      await queryClient.cancelQueries({ queryKey: ['sales'] });
      const previousSales = queryClient.getQueryData(['sales']);

      queryClient.setQueryData(['sales'], (old = []) => {
        if (!Array.isArray(old)) return old;
        const updated = saleId
          ? old.map((sale) => (sale.id === saleId ? { ...sale, ...optimisticSale } : sale))
          : [...old, optimisticSale];
        return sortSalesByRecency(updated);
      });

      return { previousSales, optimisticId };
    },
    onError: (error, _saleData, context) => {
      console.error("Failed to save sale:", error);
      if (context?.previousSales) {
        queryClient.setQueryData(['sales'], context.previousSales);
      }
      alert("Failed to save sale. Please try again.");
    },
    onSuccess: async (result, _saleData, context) => {
      if (result && context?.optimisticId) {
        queryClient.setQueryData(['sales'], (old = []) => {
          if (!Array.isArray(old)) return old;
          const replaced = old.map((sale) =>
            sale.id === context.optimisticId ? { ...result } : sale
          );
          return sortSalesByRecency(replaced);
        });
      }

      // Update related inventory records if sourced from inventory
      if (inventoryId && !saleId && !copyId) {
        try {
          const originalItem = await inventoryApi.get(inventoryId);
          const quantitySold = parseInt(formData.quantity_sold, 10) || 1;
          const newQuantitySold = (originalItem.quantity_sold || 0) + quantitySold;
          const isSoldOut = newQuantitySold >= originalItem.quantity;

          await inventoryApi.update(inventoryId, {
            quantity_sold: newQuantitySold,
            status: isSoldOut ? "sold" : originalItem.status,
          });

          queryClient.setQueryData(['inventoryItems'], (old = []) => {
            if (!Array.isArray(old)) return old;
            return old.map((item) =>
              item.id === inventoryId
                ? {
                    ...item,
                    quantity_sold: newQuantitySold,
                    status: isSoldOut ? "sold" : item.status,
                  }
                : item
            );
          });

          queryClient.invalidateQueries({ queryKey: ['inventoryItemForSaleCreation', inventoryId] });
        } catch (error) {
          console.error("Failed to update inventory item quantity_sold:", error);
          alert("Sale created but failed to update inventory. Please refresh the page.");
        }
      }

      // Create a new inventory item if sale was NOT from inventory (and not editing/copying)
      if (!inventoryId && !saleId && !copyId) {
        try {
          const quantitySold = parseInt(formData.quantity_sold, 10) || 1;
          const newInventoryItem = {
            item_name: formData.item_name,
            purchase_price: parseFloat(formData.purchase_price) || 0,
            purchase_date: formData.purchase_date,
            source: formData.source || "",
            category: formData.category || "",
            image_url: formData.image_url || "",
            quantity: quantitySold,
            quantity_sold: quantitySold,
            status: "sold",
            created_date: new Date().toISOString(),
          };

          const createdItem = await inventoryApi.create(newInventoryItem);

          // Update the cache with the new inventory item
          queryClient.setQueryData(['inventoryItems'], (old = []) => {
            if (!Array.isArray(old)) return old;
            return [...old, createdItem];
          });

          // Link the sale to the newly created inventory item
          if (result && result.id) {
            await salesApi.update(result.id, {
              inventory_id: createdItem.id
            });
          }
        } catch (error) {
          console.error("Failed to create inventory item from sale:", error);
          // Don't alert here - sale was still created successfully
        }
      }

      navigate(createPageUrl(saleId || copyId ? "SalesHistory" : "Dashboard"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
    },
  });

  const handleChange = (field, value) => {
    if (field === 'quantity_sold') {
      const parsedValue = parseInt(value, 10);
      let finalValue = isNaN(parsedValue) ? '' : parsedValue;

      // If creating a new sale from inventory, enforce max quantity based on remaining
      if (inventoryId && !idToLoad && remainingItemQuantity > 0) {
        if (parsedValue > remainingItemQuantity) {
          finalValue = remainingItemQuantity;
        } else if (parsedValue < 1) { // Ensure minimum of 1 if valid
            finalValue = 1;
        }
      } else if (isNaN(parsedValue) || parsedValue < 1) { // For other cases, ensure minimum of 1
        finalValue = 1;
      }

      setFormData(prev => ({ ...prev, [field]: finalValue }));
      return;
    }

    if (field === 'facebook_sale_type') {
      setFormData(prev => ({
        ...prev,
        facebook_sale_type: value,
        shipping_cost: prev.platform === 'facebook_marketplace' && value === 'local' ? '' : prev.shipping_cost,
        platform_fees: prev.platform === 'facebook_marketplace' && value === 'local' ? '' : prev.platform_fees,
        vat_fees: prev.platform === 'facebook_marketplace' && value === 'local' ? '' : prev.vat_fees,
      }));
      return;
    }

    if (field === 'platform') {
      const isFacebookPlatform = value === 'facebook_marketplace';
      const defaultSaleType = (value === 'facebook_marketplace' || value === 'ebay') ? 'local' : 'online';
      setFormData(prev => ({
        ...prev,
        platform: value,
        facebook_sale_type: defaultSaleType,
        shipping_cost: isFacebookPlatform && defaultSaleType === 'local' ? '' : prev.shipping_cost,
        platform_fees: isFacebookPlatform && defaultSaleType === 'local' ? '' : prev.platform_fees,
        vat_fees: isFacebookPlatform && defaultSaleType === 'local' ? '' : prev.vat_fees,
      }));
      return;
    }

    if (field === 'source') {
      setFormData(prev => ({ ...prev, source: value }));
      return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomFeeDraftChange = (field, value) => {
    setCustomFeeDraft(prev => ({ ...prev, [field]: value }));
  };

  const handleAddCustomFee = () => {
    const name = customFeeDraft.name.trim();
    const amount = parseFloat(customFeeDraft.amount);
    if (!name || Number.isNaN(amount) || amount < 0) return;

    setCustomFees(prev => [
      ...prev,
      {
        id: `fee-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        amount: parseFloat(amount.toFixed(2)),
      },
    ]);
    setCustomFeeDraft({ name: "", amount: "" });
    setCustomFeeFormOpen(false);
  };

  const handleRemoveCustomFee = (id) => {
    setCustomFees(prev => prev.filter((fee) => fee.id !== id));
  };

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
      const { file_url } = await uploadApi.uploadFile({ file: uploadPayload });
      handleChange('image_url', file_url);
    } catch (error) {
      console.error("Image upload failed:", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = null;
      }
    }
  };

  const handleSourceSelectChange = (value) => {
    if (value === 'other') {
      setIsOtherSource(true);
      setFormData(prev => ({
        ...prev,
        source: '',
      }));
    } else {
      setIsOtherSource(false);
      setFormData(prev => ({
        ...prev,
        source: value,
      }));
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

  const calculateProfit = () => {
    const purchasePrice = parseFloat(formData.purchase_price) || 0;
    const sellingPrice = parseFloat(formData.selling_price) || 0;
    const shippingCost = parseFloat(formData.shipping_cost) || 0;
    const platformFees = parseFloat(formData.platform_fees) || 0;
    const otherCosts = parseFloat(formData.other_costs) || 0;
    const vatFees = parseFloat(formData.vat_fees) || 0;
    const includeCustomFees = formData.platform?.toLowerCase() === 'ebay';
    const customFeesTotal = includeCustomFees ? getCustomFeesTotal(customFees) : 0;

    const totalCosts = purchasePrice + shippingCost + platformFees + otherCosts + vatFees + customFeesTotal;
    const profit = sellingPrice - totalCosts;
    
    setCalculatedProfit(profit);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saleMutation.mutate(formData);
  };

  // Show a loading indicator if sale data is being fetched for edit/copy, or inventory data for new sale from inventory
  if (isLoadingSale || (inventoryId && !idToLoad && isLoadingInventoryItem)) {
    return <div className="p-8 text-center text-gray-700 dark:text-gray-300">Loading data...</div>
  }

  const isEbay = formData.platform?.toLowerCase() === 'ebay'; // Case-insensitive comparison
  const isImportedEbaySale = isEbay && (formData.ebay_transaction_id || formData.ebay_order_id); // Only show eBay fields for imported items
  const facebookSaleType = formData.facebook_sale_type || 'online';
  const isFacebookPlatform = formData.platform === 'facebook_marketplace';
  const isFacebookLocal = isFacebookPlatform && facebookSaleType === 'local';
  const shippingRequired =
    (formData.platform?.toLowerCase() === 'ebay' ||
      formData.platform?.toLowerCase() === 'mercari' ||
      formData.platform?.toLowerCase() === 'etsy' ||
      (isFacebookPlatform && !isFacebookLocal));
  const otherCostsLabel = isEbay ? 'Transaction Fees' : 'Other Costs';
  const otherCostsPlaceholder = '0.00';
  const customFeesTotal = isEbay ? getCustomFeesTotal(customFees) : 0;

  const buildSearchQuery = (name) => {
    if (!name) return "";
    return name
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 7)
      .join(" ");
  };

  const q = buildSearchQuery(formData.item_name);

  const ebaySoldUrl = q
    ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1`
    : "https://www.ebay.com";

  const googleAllMarketsUrl = q
    ? `https://www.google.com/shopping?q=${encodeURIComponent(q + "")}`
    : "https://www.google.com/shopping";

  const mercariSoldGoogle = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q + " site:mercari.com")}`
    : "https://www.google.com";

  const fbMarketplaceGoogle = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q + " site:facebook.com/marketplace")}`
    : "https://www.google.com";

  const etsySoldGoogle = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q + " site:etsy.com sold")}`
    : "https://www.google.com";


  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(createPageUrl(saleId || copyId ? "SalesHistory" : "Dashboard"));
              }
            }}
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{saleId ? "Edit Sale" : (copyId ? "Copy Sale" : "Add New Sale")}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{saleId ? "Update the details of this sale" : (copyId ? "Create a new sale from a copy" : "Record a new sale and track your profit")}</p>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gray-800 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl text-white">Sale Details</CardTitle>
              {copyId && (
                <Badge className="bg-orange-100 text-orange-800">Copied</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {inventoryId && !idToLoad && (
                    <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                        <AlertDescription className="dark:text-blue-200">
                            Creating a sale for inventory item: <span className="font-semibold">{formData.item_name}</span>
                        </AlertDescription>
                    </Alert>
                )}
              <div className="space-y-3">
                <Label htmlFor="image-upload-input" className="dark:text-gray-200 break-words">Item Image</Label>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <button
                    type="button"
                    onClick={() => !isUploading && imageInputRef.current?.click()}
                    disabled={isUploading}
                    className={`relative aspect-square w-32 sm:w-40 md:w-52 rounded-2xl border-2 border-dashed border-muted-foreground/40 bg-muted/20 flex items-center justify-center overflow-hidden transition-all ${isUploading ? 'opacity-70 cursor-wait' : 'hover:border-primary hover:bg-primary/5 cursor-pointer'}`}
                  >
                    {formData.image_url ? (
                      <img
                        src={formData.image_url}
                        alt="Item"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Camera className="w-7 h-7 sm:w-9 sm:h-9" />
                        <span className="text-xs sm:text-sm font-medium">Add item photo</span>
                        <span className="text-[11px] sm:text-xs text-muted-foreground/70">Tap to upload</span>
                      </div>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center text-sm font-medium text-muted-foreground">
                        Uploading...
                      </div>
                    )}
                  </button>
                  <div className="flex flex-col gap-2 text-xs sm:text-sm text-muted-foreground">
                    <span>Upload a clear photo so you can quickly recognize this item later.</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? 'Uploading...' : formData.image_url ? 'Change image' : 'Upload image'}
                      </Button>
                      {formData.image_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleChange('image_url', '')}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <span className="text-[11px] sm:text-xs text-muted-foreground/70">Supports JPG or PNG up to 5 MB.</span>
                  </div>
                </div>
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
                  <Label htmlFor="item_name" className="dark:text-gray-200 flex items-center gap-1">
                    <span>Item Name</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="item_name"
                    value={formData.item_name}
                    onChange={(e) => handleChange('item_name', e.target.value)}
                    placeholder="e.g., Vintage Nike Sneakers"
                    required
                    className="w-full"
                  />
                </div>

                {formData.item_name && (
                  <div className="space-y-2 flex items-end min-w-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSoldDialogOpen(true)}
                      className="w-full dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700"
                    >
                      <BarChart className="w-4 h-4 mr-2" />
                      Search Sold Listings
                    </Button>
                  </div>
                )}

                <div className="space-y-2 min-w-0">
                   <Label htmlFor="quantity_sold" className="dark:text-gray-200">
                     Quantity Sold <span className="text-red-500">*</span>
                   </Label>
                   <Input 
                       id="quantity_sold" 
                       type="number" 
                       min="1" 
                       max={inventoryId && !idToLoad && remainingItemQuantity > 0 ? remainingItemQuantity : undefined} 
                       value={formData.quantity_sold} 
                       onChange={(e) => handleChange('quantity_sold', e.target.value)} 
                       required
                       className="w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                   />
                   {inventoryId && !idToLoad && totalItemQuantity > 0 && (
                       <>
                           {remainingItemQuantity <= 0 ? (
                               <p className="text-sm text-red-500 dark:text-red-400">
                                 Warning: This inventory item is marked as sold out.
                               </p>
                           ) : (
                               <p className="text-sm text-gray-500 dark:text-gray-400">
                                 {remainingAfterThisSale} of {totalItemQuantity} remaining after this sale.
                               </p>
                           )}
                       </>
                   )}
                </div>

                <div className="space-y-2 min-w-0">
                  <Label htmlFor="purchase_price" className="dark:text-gray-200 flex items-center gap-1">
                    <span>
                      Purchase Price
                      {inventoryId && !idToLoad && perItemPurchasePrice !== null
                        ? ` ($${perItemPurchasePrice.toFixed(2)} per item)`
                        : ""}
                    </span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.purchase_price}
                    onChange={(e) => handleChange('purchase_price', e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                  <Label htmlFor="source_select" className="dark:text-gray-200">Source</Label>
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
                  <Label htmlFor="platform" className="dark:text-gray-200 flex items-center gap-1">
                    <span>Sold On</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(value) => handleChange('platform', value)}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select platform">
                        {formData.platform && platformIcons[formData.platform] ? (
                          <div className="flex items-center gap-2">
                            <img 
                              src={platformIcons[formData.platform]} 
                              alt={platformOptions.find(opt => opt.value === formData.platform)?.label || formData.platform} 
                              className="w-5 h-5 object-contain"
                            />
                            <span>{platformOptions.find(opt => opt.value === formData.platform)?.label || formData.platform}</span>
                          </div>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {platformOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            {platformIcons[option.value] && (
                              <img 
                                src={platformIcons[option.value]} 
                                alt={option.label} 
                                className="w-5 h-5 object-contain"
                              />
                            )}
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isFacebookPlatform && (
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="facebook_sale_type" className="dark:text-gray-200">
                      Facebook Sale Type
                    </Label>
                    <Select
                      value={facebookSaleType}
                      onValueChange={(value) => handleChange('facebook_sale_type', value)}
                    >
                      <SelectTrigger id="facebook_sale_type" className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">Online (Shipped)</SelectItem>
                        <SelectItem value="local">Local Pickup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isOtherSource ? (
                  <div className="space-y-2 md:col-span-2 min-w-0">
                    <Label htmlFor="other_source" className="dark:text-gray-200">Custom Source</Label>
                    <Input
                      id="other_source"
                      value={formData.source}
                      onChange={(e) => handleChange('source', e.target.value)}
                      placeholder="e.g., Garage Sale, Flea Market"
                      className="w-full"
                    />
                  </div>
                ) : null}

                <div className="space-y-2 min-w-0">
                  <Label htmlFor="selling_price" className="dark:text-gray-200">
                    Selling Price <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="selling_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.selling_price}
                    onChange={(e) => handleChange('selling_price', e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                
                <ClearableDateInput
                  id="sale_date"
                  label="Sale Date"
                  value={formData.sale_date}
                  onChange={(val) => handleChange('sale_date', val)}
                  required
                />

                {!isFacebookLocal && (
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="shipping_cost" className="dark:text-gray-200 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      Shipping Cost {shippingRequired && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      id="shipping_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.shipping_cost}
                      onChange={(e) => handleChange('shipping_cost', e.target.value)}
                      placeholder="0.00"
                      className="w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      required={shippingRequired}
                    />
                  </div>
                )}

                {!isFacebookLocal && (
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="platform_fees" className="dark:text-gray-200 flex items-center gap-2">
                      <MoneyPrinterIcon className="w-4 h-4 text-muted-foreground dark:text-muted-foreground" />
                      {isEbay ? 'Sales Tax (collected from buyer)' : 'Platform Fees'}
                    </Label>
                    <Input
                      id="platform_fees"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.platform_fees}
                      onChange={(e) => handleChange('platform_fees', e.target.value)}
                      placeholder="0.00"
                      className="w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                )}

                {isEbay && (
                  <div className="space-y-3 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 dark:bg-muted/10 p-4 min-w-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Custom Fees</p>
                        <p className="text-xs text-muted-foreground">Track additional marketplace or promotional costs.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setCustomFeeFormOpen((prev) => !prev)}
                        className="gap-2 bg-primary text-primary-foreground shadow hover:bg-primary/90"
                      >
                        <Plus className="w-4 h-4" />
                        {customFeeFormOpen ? "Close" : "Add Custom Fee"}
                      </Button>
                    </div>

                    {customFeeFormOpen && (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                        <Input
                          placeholder="e.g., International surcharge"
                          value={customFeeDraft.name}
                          onChange={(e) => handleCustomFeeDraftChange('name', e.target.value)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={customFeeDraft.amount}
                          onChange={(e) => handleCustomFeeDraftChange('amount', e.target.value)}
                          className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <Button
                          type="button"
                          onClick={handleAddCustomFee}
                          disabled={!customFeeDraft.name.trim() || customFeeDraft.amount === "" || Number.isNaN(parseFloat(customFeeDraft.amount))}
                        >
                          Save Fee
                        </Button>
                      </div>
                    )}

                    {customFees.length > 0 ? (
                      <div className="space-y-2">
                        <div className="space-y-2">
                          {customFees.map((fee) => (
                            <div
                              key={fee.id}
                              className="flex items-center justify-between rounded-md border border-muted bg-background/70 px-3 py-2 text-sm"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">{fee.name}</p>
                                <p className="text-xs text-muted-foreground">${fee.amount.toFixed(2)}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveCustomFee(fee.id)}
                                aria-label={`Remove ${fee.name}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                          <span>Custom fee total</span>
                          <span>${customFeesTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No custom fees added yet.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2 min-w-0">
                  <Label htmlFor="other_costs" className="dark:text-gray-200 flex items-center gap-2">
                    <MoneyPrinterIcon className="w-4 h-4 text-muted-foreground dark:text-muted-foreground" />
                    {otherCostsLabel}
                  </Label>
                  <Input
                    id="other_costs"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.other_costs}
                    onChange={(e) => handleChange('other_costs', e.target.value)}
                    placeholder={otherCostsPlaceholder}
                    className={`w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isFacebookLocal ? 'sm:max-w-[160px]' : ''}`}
                  />
                </div>

                {isEbay && !isFacebookLocal && (
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="vat_fees" className="dark:text-gray-200">
                      VAT Fees (if applicable, collected from buyer)
                    </Label>
                    <Input
                      id="vat_fees"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.vat_fees}
                      onChange={(e) => handleChange('vat_fees', e.target.value)}
                      placeholder="0.00"
                      className="w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                )}
                
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="category_select" className="dark:text-gray-200 flex items-center gap-2">
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
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="other_category" className="dark:text-gray-200">Custom Category</Label>
                    <Input
                      id="other_category"
                      value={formData.category}
                      onChange={(e) => handleChange('category', e.target.value)}
                      placeholder="e.g., Video Games"
                      className="w-full"
                    />
                  </div>
                ) : <div />}


                {/* eBay-specific fields section */}
                {isImportedEbaySale && (
                  <>
                    {/* Fully displayed fields */}
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="tracking_number" className="dark:text-gray-200">Tracking Number</Label>
                      <Input
                        id="tracking_number"
                        value={formData.tracking_number}
                        onChange={(e) => handleChange('tracking_number', e.target.value)}
                        placeholder="e.g., 1Z999AA10123456784"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="shipping_carrier" className="dark:text-gray-200">Shipping Carrier</Label>
                      <Select
                        value={formData.shipping_carrier}
                        onValueChange={(value) => handleChange('shipping_carrier', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USPS">USPS</SelectItem>
                          <SelectItem value="FedEx">FedEx</SelectItem>
                          <SelectItem value="UPS">UPS</SelectItem>
                          <SelectItem value="DHL">DHL</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <ClearableDateInput
                      id="shipped_date"
                      label="Shipped Date"
                      value={formData.shipped_date}
                      onChange={(val) => handleChange('shipped_date', val)}
                    />

                    <ClearableDateInput
                      id="delivery_date"
                      label="Delivery Date"
                      value={formData.delivery_date}
                      onChange={(val) => handleChange('delivery_date', val)}
                    />

                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="item_condition" className="dark:text-gray-200">Item Condition</Label>
                      <Input
                        id="item_condition"
                        value={formData.item_condition}
                        onChange={(e) => handleChange('item_condition', e.target.value)}
                        placeholder="e.g., New, Used, Refurbished"
                        className="w-full"
                      />
                    </div>

                    {/* Additional Details Button */}
                    <div className="md:col-span-2 space-y-3 rounded-lg border border-dashed border-blue-400/40 bg-blue-50/30 dark:bg-blue-900/10 p-4 min-w-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Additional eBay Details</p>
                          <p className="text-xs text-muted-foreground">Buyer information, payment details, and more.</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAdditionalDetails((prev) => !prev)}
                          className="gap-2"
                        >
                          {showAdditionalDetails ? "Hide Details" : "Show Details"}
                        </Button>
                      </div>

                      {showAdditionalDetails && (
                        <div className="grid md:grid-cols-2 gap-4 pt-2">
                          {/* Buyer Address */}
                          <div className="space-y-2 md:col-span-2">
                            <Label className="dark:text-gray-200">Buyer Address</Label>
                            <div className="grid gap-2">
                              <Input
                                placeholder="Name"
                                value={formData.buyer_address?.name || ""}
                                onChange={(e) => handleChange('buyer_address', { ...(formData.buyer_address || {}), name: e.target.value })}
                              />
                              <Input
                                placeholder="Street Address"
                                value={formData.buyer_address?.street1 || ""}
                                onChange={(e) => handleChange('buyer_address', { ...(formData.buyer_address || {}), street1: e.target.value })}
                              />
                              <Input
                                placeholder="Apt/Suite (optional)"
                                value={formData.buyer_address?.street2 || ""}
                                onChange={(e) => handleChange('buyer_address', { ...(formData.buyer_address || {}), street2: e.target.value })}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="City"
                                  value={formData.buyer_address?.city || ""}
                                  onChange={(e) => handleChange('buyer_address', { ...(formData.buyer_address || {}), city: e.target.value })}
                                />
                                <Input
                                  placeholder="State"
                                  value={formData.buyer_address?.state || ""}
                                  onChange={(e) => handleChange('buyer_address', { ...(formData.buyer_address || {}), state: e.target.value })}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="ZIP Code"
                                  value={formData.buyer_address?.zip || ""}
                                  onChange={(e) => handleChange('buyer_address', { ...(formData.buyer_address || {}), zip: e.target.value })}
                                />
                                <Input
                                  placeholder="Country"
                                  value={formData.buyer_address?.country || ""}
                                  onChange={(e) => handleChange('buyer_address', { ...(formData.buyer_address || {}), country: e.target.value })}
                                />
                              </div>
                              <Input
                                placeholder="Phone (optional)"
                                value={formData.buyer_address?.phone || ""}
                                onChange={(e) => handleChange('buyer_address', { ...(formData.buyer_address || {}), phone: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* Payment Info */}
                          <div className="space-y-2">
                            <Label htmlFor="payment_method" className="dark:text-gray-200">Payment Method</Label>
                            <Input
                              id="payment_method"
                              value={formData.payment_method}
                              onChange={(e) => handleChange('payment_method', e.target.value)}
                              placeholder="e.g., PayPal, Credit Card"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="payment_status" className="dark:text-gray-200">Payment Status</Label>
                            <Input
                              id="payment_status"
                              value={formData.payment_status}
                              onChange={(e) => handleChange('payment_status', e.target.value)}
                              placeholder="e.g., Paid, Pending"
                            />
                          </div>

                          <ClearableDateInput
                            id="payment_date"
                            label="Payment Date"
                            value={formData.payment_date}
                            onChange={(val) => handleChange('payment_date', val)}
                          />

                          <div className="space-y-2">
                            <Label htmlFor="item_location" className="dark:text-gray-200">Item Location</Label>
                            <Input
                              id="item_location"
                              value={formData.item_location}
                              onChange={(e) => handleChange('item_location', e.target.value)}
                              placeholder="e.g., Los Angeles, CA"
                            />
                          </div>

                          {/* eBay Identifiers */}
                          <div className="space-y-2">
                            <Label htmlFor="ebay_order_id" className="dark:text-gray-200">eBay Order ID</Label>
                            <Input
                              id="ebay_order_id"
                              value={formData.ebay_order_id}
                              onChange={(e) => handleChange('ebay_order_id', e.target.value)}
                              placeholder="e.g., 14-13962-19566"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ebay_buyer_username" className="dark:text-gray-200">Buyer Username</Label>
                            <Input
                              id="ebay_buyer_username"
                              value={formData.ebay_buyer_username}
                              onChange={(e) => handleChange('ebay_buyer_username', e.target.value)}
                              placeholder="eBay username"
                            />
                          </div>

                          {/* Buyer Notes */}
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="buyer_notes" className="dark:text-gray-200">Buyer Notes/Messages</Label>
                            <Textarea
                              id="buyer_notes"
                              value={formData.buyer_notes}
                              onChange={(e) => handleChange('buyer_notes', e.target.value)}
                              placeholder="Any messages or notes from the buyer..."
                              rows={3}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}


                <div className="space-y-2 md:col-span-2 min-w-0">
                  <Label htmlFor="notes" className="dark:text-gray-200">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    placeholder="Any additional details about this sale..."
                    rows={3}
                    className="w-full"
                  />
                </div>

              </div>

              <div className="border-t pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={calculateProfit}
                  className="mb-4"
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Calculate Profit
                </Button>

                {calculatedProfit !== null && (
                  <Alert className={calculatedProfit >= 0 ? "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800" : "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"}>
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <span className="font-medium dark:text-gray-200">Estimated Profit:</span>
                        <span className={`text-2xl font-bold ${calculatedProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          ${calculatedProfit.toFixed(2)}
                        </span>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(createPageUrl(saleId || copyId ? "SalesHistory" : "Dashboard"))}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saleMutation.isPending || isUploading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saleMutation.isPending ? 'Saving...' : (saleId ? 'Update Sale' : 'Save Sale')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={soldDialogOpen} onOpenChange={setSoldDialogOpen}>
        <DialogOverlay className="
          bg-black/60 backdrop-blur-sm
          data-[state=open]:animate-in data-[state=open]:fade-in-0
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0
        " />
        <DialogContent className="
          w-[92vw] sm:w-[90vw]
          max-w-lg sm:max-w-xl md:max-w-2xl
          mx-auto
          max-h-[90vh] overflow-y-auto overflow-x-hidden
          rounded-lg sm:rounded-xl shadow-2xl
          p-4 sm:p-6
          duration-200
          data-[state=open]:animate-in
          data-[state=open]:fade-in-0
          data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:zoom-in-95
          data-[state=closed]:animate-out
          data-[state=closed]:fade-out-0
          data-[state=closed]:slide-out-to-bottom-4 sm:data-[state=closed]:zoom-out-95
        ">
          <div className="space-y-4 overflow-x-hidden break-words whitespace-normal hyphens-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold">
                Sold Listings Lookup
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base leading-relaxed">
                Quick search links based on "{q || "your item name"}".
              </DialogDescription>
            </DialogHeader>

            <div className="text-sm text-muted-foreground">
              💡Tip:  <br className="block sm:hidden" /> Keep names tight (brand + model + size). You can refine once the page opens.
            </div>

            {/* Marketplace chips */}
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Marketplaces
              </p>

              {/* Row 1: eBay, Mercari, Facebook */}
              <div className="grid grid-cols-3 gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveMarket('ebay_sold')}
                  className={`
                    inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium
                    border border-border transition
                    bg-muted/70 hover:bg-muted
                    dark:bg-muted/40 dark:hover:bg-muted/60
                    text-foreground
                    ${activeMarket === 'ebay_sold' ? '!bg-foreground !text-background dark:!bg-foreground dark:!text-background' : ''}
                  `}
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg"
                    alt="eBay"
                    className="w-5 h-5 object-contain"
                  />
                  <span className="hidden sm:inline">eBay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMarket('mercari')}
                  className={`
                    inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium
                    border border-border transition
                    bg-muted/70 hover:bg-muted
                    dark:bg-muted/40 dark:hover:bg-muted/60
                    text-foreground
                    ${activeMarket === 'mercari' ? '!bg-foreground !text-background dark:!bg-foreground dark:!text-background' : ''}
                  `}
                >
                  <img
                    src="https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B"
                    alt="Mercari"
                    className="w-5 h-5 object-contain"
                  />
                  <span className="hidden sm:inline">Mercari</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMarket('facebook')}
                  className={`
                    inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium
                    border border-border transition
                    bg-muted/70 hover:bg-muted
                    dark:bg-muted/40 dark:hover:bg-muted/60
                    text-foreground
                    ${activeMarket === 'facebook' ? '!bg-foreground !text-background dark:!bg-foreground dark:!text-background' : ''}
                  `}
                >

                  <img
                    src={FACEBOOK_ICON_URL}
                    alt="Facebook"
                    className="w-4 h-4 object-contain"
                  />

                  <span className="hidden sm:inline">Facebook</span>
                </button>
              </div>

              {/* Row 2: Etsy, All markets */}
              <div className="grid grid-cols-2 gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveMarket('etsy')}
                  className={`
                    inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium
                    border border-border transition
                    bg-muted/70 hover:bg-muted
                    dark:bg-muted/40 dark:hover:bg-muted/60
                    text-foreground
                    ${activeMarket === 'etsy' ? '!bg-foreground !text-background dark:!bg-foreground dark:!text-background' : ''}
                  `}
                >
                  <img
                    src="https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B"
                    alt="Etsy"
                    className="w-5 h-5 object-contain"
                  />
                  <span className="hidden sm:inline">Etsy</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMarket('all')}
                  className={`
                    inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium
                    border border-border transition
                    bg-muted/70 hover:bg-muted
                    dark:bg-muted/40 dark:hover:bg-muted/60
                    text-foreground
                    ${activeMarket === 'all' ? '!bg-foreground !text-background dark:!bg-foreground dark:!text-background' : ''}
                  `}
                >
                  <Globe className="w-5 h-5 object-contain" />
                  <span className="hidden sm:inline">All markets</span>
                </button>
              </div>

              {/* Helper text */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                Completed + Sold
              </p>
            </div>

            {/* Market-specific content */}
            <div className="space-y-3 min-w-0 pt-2">
              {activeMarket === 'ebay_sold' && (
                <>
                  <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                    <Button asChild className="bg-blue-600 hover:bg-blue-700 max-w-full truncate">
                      <a href={ebaySoldUrl} target="_blank" rel="noreferrer">Open eBay Sold</a>
                    </Button>
                    <Button variant="outline" onClick={() => navigator.clipboard.writeText(q || "")} className="max-w-full truncate">
                      Copy Title
                    </Button>
                  </div>
                </>
              )}

              {activeMarket === 'mercari' && (
                <>
                  <Button asChild variant="outline" className="max-w-full truncate">
                    <a href={mercariSoldGoogle} target="_blank" rel="noreferrer">Search Mercari</a>
                  </Button>
                </>
              )}

              {activeMarket === 'facebook' && (
                <>
                  <Button asChild variant="outline" className="max-w-full truncate">
                    <a href={fbMarketplaceGoogle} target="_blank" rel="noreferrer">Search Facebook</a>
                  </Button>
                </>
              )}

              {activeMarket === 'etsy' && (
                <>
                  <Button asChild variant="outline" className="max-w-full truncate">
                    <a href={etsySoldGoogle} target="_blank" rel="noreferrer">Search Etsy</a>
                  </Button>
                </>
              )}

              {activeMarket === 'all' && (
                <>
                  <Button asChild variant="outline" className="max-w-full truncate">
                    <a href={googleAllMarketsUrl} target="_blank" rel="noreferrer">Search All Markets</a>
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
