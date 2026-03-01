/**
 * Smart Listing Integration Hook
 * Provides state and handlers for the Smart Listing UI layer
 * To be integrated into CrosslistComposer
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { preflightSelectedMarketplaces, getPreflightSummary } from '@/utils/preflightEngine';
import { getFulfillmentProfile } from '@/api/fulfillmentApi';
import { debugLog } from '@/config/features';

/**
 * Hook for Smart Listing functionality
 * @param {Object} forms - All form states
 * @param {Object} forms.generalForm
 * @param {Object} forms.ebayForm
 * @param {Object} forms.mercariForm
 * @param {Object} forms.facebookForm
 * @param {Object} validationOptions - Options needed for validation
 * @param {Function} setMarketplaceForm - Function to update marketplace form state
 * @param {Function} handleSubmit - Existing submit handler for individual marketplaces
 * @param {boolean} enabled - Whether Smart Listing is enabled
 * @param {Object} connections - Marketplace connection status { ebayConnected, mercariConnected, facebookConnected }
 * @returns {Object} Smart listing state and handlers
 */
export function useSmartListing(forms, validationOptions, setMarketplaceForm, handleSubmit, enabled = true, connections = {}, onListingSuccess = null) {
  const { toast } = useToast();
  
  // Modal state management
  const [modalOpen, setModalOpen] = useState(false);
  const [modalState, setModalState] = useState('idle'); // 'idle' | 'validating' | 'ready' | 'fixes' | 'listing'
  const [autoFillMode, setAutoFillMode] = useState('manual'); // 'auto' | 'manual'
  
  // Connection status
  const [connectionStatus, setConnectionStatus] = useState({
    ebay: false,
    mercari: false,
    facebook: false,
  });
  
  // Existing state
  const [selectedMarketplaces, setSelectedMarketplaces] = useState([]);
  const [fixesDialogOpen, setFixesDialogOpen] = useState(false);
  const [preflightResult, setPreflightResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fulfillment profile — fetched once to check if user has configured shipping
  const fulfillmentRef = useRef(null);
  const fulfillmentFetched = useRef(false);
  useEffect(() => {
    if (!enabled || fulfillmentFetched.current) return;
    fulfillmentFetched.current = true;
    getFulfillmentProfile()
      .then((data) => { fulfillmentRef.current = data; })
      .catch(() => {})
  }, [enabled]);
  
  /**
   * Check marketplace connections
   */
  const checkConnections = useCallback(() => {
    if (!enabled) return;
    
    setConnectionStatus({
      ebay: connections.ebayConnected || false,
      mercari: connections.mercariConnected || false,
      facebook: connections.facebookConnected || false,
    });
  }, [enabled, connections.ebayConnected, connections.mercariConnected, connections.facebookConnected]);
  
  /**
   * Update connection status whenever connections prop changes
   */
  useEffect(() => {
    if (!enabled) return;
    
    setConnectionStatus({
      ebay: connections.ebayConnected || false,
      mercari: connections.mercariConnected || false,
      facebook: connections.facebookConnected || false,
    });
  }, [enabled, connections.ebayConnected, connections.mercariConnected, connections.facebookConnected]);
  
  /**
   * Open modal and check connections
   */
  const openModal = useCallback(() => {
    if (!enabled) return;
    
    debugLog('Opening Smart Listing modal');

    // Only hard-require title, condition, and price to open the modal.
    // Everything else (brand, category, zip, package dims, cost) is handled
    // by preflight validation and can be AI-filled.
    const title = (forms.generalForm?.title || "").trim();
    if (!title) {
      toast({
        title: "Title Required",
        description: "Please enter an item title before using Smart Listing.",
        variant: "destructive",
      });
      return;
    }

    const condition = (forms.generalForm?.condition || "").trim();
    if (!condition) {
      toast({
        title: "Condition Required",
        description: "Please select a condition before using Smart Listing.",
        variant: "destructive",
      });
      return;
    }

    const price = forms.generalForm?.price;
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      toast({
        title: "Price Required",
        description: "Please enter a price before using Smart Listing.",
        variant: "destructive",
      });
      return;
    }

    checkConnections();
    setPreflightResult(null);
    setModalState('idle');
    setModalOpen(true);
  }, [enabled, checkConnections, selectedMarketplaces, forms, toast]);
  
  /**
   * Close modal
   */
  const closeModal = useCallback(() => {
    if (!enabled) return;
    
    debugLog('Closing Smart Listing modal');
    setModalOpen(false);
    setModalState('idle');
    // Reset state when closing
    setPreflightResult(null);
  }, [enabled]);
  
  /**
   * Toggle marketplace selection
   */
  const toggleMarketplace = useCallback((marketplace, checked) => {
    if (!enabled) return;
    setSelectedMarketplaces(prev => {
      if (checked) {
        // Ensure no duplicates
        if (prev.includes(marketplace)) {
          return prev;
        }
        return [...prev, marketplace];
      } else {
        return prev.filter(mp => mp !== marketplace);
      }
    });
  }, [enabled]);
  
  /**
   * Toggle auto-fill mode
   */
  const toggleAutoFillMode = useCallback((mode) => {
    if (!enabled) return;
    debugLog('Setting auto-fill mode:', mode);
    setAutoFillMode(mode);
  }, [enabled]);
  
  /**
   * Apply a fix to a form field WITHOUT re-running preflight.
   * Used as the onApplyPatch callback inside preflightSelectedMarketplaces
   * to prevent the circular: runPreflight → onApplyPatch → runPreflight → ∞
   */
  const applyFixOnly = useCallback((issue, newValue) => {
    if (!enabled) return;
    const { marketplace, field, patchTarget } = issue;
    const isObject   = newValue !== null && typeof newValue === 'object';
    const idValue    = isObject ? newValue.id    : null;
    const labelValue = isObject ? newValue.label : newValue;
    const storedValue = (idValue !== null && idValue !== undefined) ? idValue : labelValue;

    if (patchTarget === 'general') {
      setMarketplaceForm('general', field, storedValue);
    } else {
      setMarketplaceForm(marketplace, field, storedValue);
      if (field === 'category' && idValue !== null) {
        setMarketplaceForm(marketplace, 'categoryId', idValue);
      }
      // When applying an eBay categoryId fix, also store the human-readable categoryName
      if (field === 'categoryId' && marketplace === 'ebay' && isObject && labelValue) {
        setMarketplaceForm(marketplace, 'categoryName', labelValue);
      }
    }
  }, [enabled, setMarketplaceForm]);

  /**
   * Run preflight validation
   */
  const runPreflight = useCallback(async () => {
    if (!enabled) return null;
    if (selectedMarketplaces.length === 0) {
      toast({
        title: "No marketplaces selected",
        description: "Please select at least one marketplace to list on",
        variant: "destructive",
      });
      return null;
    }
    
    debugLog('Running preflight for marketplaces:', selectedMarketplaces);
    debugLog('Auto-fill mode:', autoFillMode);
    
    // Load saved eBay defaults from localStorage so validation can suggest them
    let ebayDefaults = {};
    try {
      const stored = localStorage.getItem('ebay-shipping-defaults');
      if (stored) ebayDefaults = JSON.parse(stored);
    } catch (e) { /* ignore */ }

    // Load saved Facebook defaults from localStorage
    let facebookDefaults = {};
    try {
      const fbStored = localStorage.getItem('facebook-defaults');
      if (fbStored) facebookDefaults = JSON.parse(fbStored);
    } catch (e) { /* ignore */ }

    // Load saved Mercari defaults from localStorage
    let mercariDefaults = {};
    try {
      const mcStored = localStorage.getItem('mercari-defaults');
      if (mcStored) mercariDefaults = JSON.parse(mcStored);
    } catch (e) { /* ignore */ }

    const result = await preflightSelectedMarketplaces(
      selectedMarketplaces,
      forms.generalForm,
      forms.ebayForm,
      forms.mercariForm,
      forms.facebookForm,
      forms.etsyForm || {},
      {
        ...validationOptions,
        ebayDefaults,
        facebookDefaults,
        mercariDefaults,
        fulfillmentProfile: fulfillmentRef.current,
        autoApplyHighConfidence: autoFillMode === 'auto',
        onApplyPatch: autoFillMode === 'auto' ? applyFixOnly : null,
      }
    );
    
    debugLog('Preflight result:', result);
    
    return result;
  }, [enabled, selectedMarketplaces, forms, validationOptions, autoFillMode, applyFixOnly, toast]);
  
  /**
   * Handle "Start Smart Listing" button click from modal
   */
  const handleStartListing = useCallback(async () => {
    if (!enabled) return;
    
    // Transition to validating state
    setModalState('validating');
    
    try {
      const result = await runPreflight();
      
      if (!result) {
        setModalState('idle');
        return;
      }
      
      setPreflightResult(result);
      
      // If no issues, show ready state
      if (result.fixesNeeded.length === 0) {
        debugLog('All marketplaces ready!');
        setModalState('ready');
      } else {
        // Show fixes state
        debugLog('Issues found, showing fixes panel');
        setModalState('fixes');
      }
    } catch (error) {
      console.error('Preflight error:', error);
      toast({
        title: "Validation error",
        description: error.message || "Failed to validate listings",
        variant: "destructive",
      });
      setModalState('idle');
    }
  }, [enabled, runPreflight, toast]);
  
  /**
   * Handle "List to Selected" button click (legacy for old UI)
   */
  const handleListToSelected = useCallback(async () => {
    if (!enabled) return;
    const result = await runPreflight();
    
    if (!result) return;
    
    setPreflightResult(result);
    
    // If no issues, proceed directly to listing
    if (result.fixesNeeded.length === 0) {
      debugLog('All marketplaces ready, listing directly');
      
      toast({
        title: "All marketplaces ready!",
        description: "Listing to all selected marketplaces...",
      });
      
      await handleListNow(result.ready);
    } else {
      // Show fixes dialog
      debugLog('Issues found, showing fixes dialog');
      
      toast({
        title: "Issues detected",
        description: getPreflightSummary(result),
        variant: "default",
      });
      
      setFixesDialogOpen(true);
    }
  }, [enabled, runPreflight, toast]);
  
  /**
   * Apply a fix manually (user-triggered from the modal fixes panel).
   * Applies the form update then re-runs preflight to refresh the issues list.
   */
  const handleApplyFix = useCallback(async (issue, newValue) => {
    if (!enabled) return;
    debugLog('Applying fix:', { issue, newValue });

    // Apply the field update
    applyFixOnly(issue, newValue);

    toast({
      title: "Fix applied",
      description: `Updated ${issue.field} for ${issue.marketplace}`,
    });

    // Re-run preflight after a brief tick so React can flush the state update first
    await new Promise(r => setTimeout(r, 50));
    const result = await runPreflight();
    if (result) {
      setPreflightResult(result);
    }
  }, [enabled, applyFixOnly, runPreflight, toast]);
  
  /**
   * List to all ready marketplaces
   */
  const handleListNow = useCallback(async (marketplacesToList) => {
    if (!enabled) return;
    
    // Determine marketplaces to list
    const marketsToList = marketplacesToList || preflightResult?.ready || selectedMarketplaces;
    
    if (!marketsToList || marketsToList.length === 0) {
      toast({
        title: "No marketplaces ready",
        description: "Please fix all blocking issues first",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    setModalState('listing');
    debugLog('Listing to marketplaces:', marketsToList);
    
    const results = [];
    const errors = [];
    
    try {
      for (const marketplace of marketsToList) {
        try {
          debugLog(`Listing to ${marketplace}...`);
          await handleSubmit(marketplace);
          results.push(marketplace);
          // handleSubmit (handleListOnMarketplace) already shows its own success toast
        } catch (error) {
          console.error(`Error listing on ${marketplace}:`, error);
          errors.push({ marketplace, error: error.message });
          // handleSubmit already shows its own error toast; no duplicate needed here
        }
      }
      
      if (errors.length === 0 && results.length > 0) {
        // All succeeded — close modal and reset
        setModalOpen(false);
        setFixesDialogOpen(false);
        setSelectedMarketplaces([]);
        setPreflightResult(null);
        setModalState('idle');
        // Notify caller so it can update baseline for re-validation
        if (onListingSuccess) onListingSuccess(results);
      } else if (errors.length > 0) {
        // Some failed — stay on fixes/ready state so user can see what went wrong
        setModalState(preflightResult?.fixesNeeded?.length > 0 ? 'fixes' : 'ready');
        toast({
          title: `${errors.length} marketplace${errors.length !== 1 ? 's' : ''} failed`,
          description: errors.map(e => e.marketplace).join(', ') + ' — see errors above',
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [enabled, handleSubmit, toast, preflightResult, selectedMarketplaces]);
  
  /**
   * Close fixes dialog (legacy)
   */
  const closeFixesDialog = useCallback(() => {
    setFixesDialogOpen(false);
  }, []);
  
  /**
   * Handle marketplace reconnection
   */
  const handleReconnect = useCallback((marketplace) => {
    if (!enabled) return;
    
    debugLog('Reconnect requested for:', marketplace);
    
    // Show instructions based on marketplace
    const instructions = {
      ebay: "Please connect your eBay account in Settings",
      mercari: "Open Profit Orbit extension and sign in to Mercari",
      facebook: "Open Profit Orbit extension and sign in to Facebook",
    };
    
    toast({
      title: `Connect ${marketplace}`,
      description: instructions[marketplace] || "Please connect this marketplace",
      duration: 5000,
    });
  }, [enabled, toast]);
  
  return {
    // Modal state
    modalOpen,
    modalState,
    openModal,
    closeModal,
    
    // Auto-fill mode
    autoFillMode,
    toggleAutoFillMode,
    
    // Connection status
    connectionStatus,
    
    // State
    selectedMarketplaces,
    fixesDialogOpen,
    preflightResult,
    isSubmitting,
    
    // Handlers
    toggleMarketplace,
    handleStartListing,
    handleListToSelected, // Keep for legacy
    handleApplyFix,
    handleListNow: () => handleListNow(),
    closeFixesDialog,
    handleReconnect,
  };
}
