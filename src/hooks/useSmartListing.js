/**
 * Smart Listing Integration Hook
 * Provides state and handlers for the Smart Listing UI layer
 * To be integrated into CrosslistComposer
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { preflightSelectedMarketplaces, getPreflightSummary } from '@/utils/preflightEngine';
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
export function useSmartListing(forms, validationOptions, setMarketplaceForm, handleSubmit, enabled = true, connections = {}) {
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
  
  /**
   * Check marketplace connections
   */
  const checkConnections = useCallback(() => {
    if (!enabled) return;
    
    debugLog('Checking marketplace connections...', connections);
    
    setConnectionStatus({
      ebay: connections.ebayConnected || false,
      mercari: connections.mercariConnected || false,
      facebook: connections.facebookConnected || false,
    });
  }, [enabled, connections]);
  
  /**
   * Open modal and check connections
   */
  const openModal = useCallback(() => {
    if (!enabled) return;
    
    debugLog('Opening Smart Listing modal');
    checkConnections();
    setModalState('idle');
    setModalOpen(true);
  }, [enabled, checkConnections]);
  
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
    
    const result = await preflightSelectedMarketplaces(
      selectedMarketplaces,
      forms.generalForm,
      forms.ebayForm,
      forms.mercariForm,
      forms.facebookForm,
      {
        ...validationOptions,
        autoApplyHighConfidence: autoFillMode === 'auto',
        onApplyPatch: handleApplyFix, // Pass fix handler for auto-apply
      }
    );
    
    debugLog('Preflight result:', result);
    
    return result;
  }, [enabled, selectedMarketplaces, forms, validationOptions, autoFillMode, toast]);
  
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
   * Apply a fix to a form field
   */
  const handleApplyFix = useCallback(async (issue, newValue) => {
    if (!enabled) return;
    debugLog('Applying fix:', { issue, newValue });
    
    const { marketplace, field, patchTarget } = issue;
    
    // Update the appropriate form
    if (patchTarget === 'general') {
      // Update general form
      setMarketplaceForm('general', field, newValue);
    } else {
      // Update marketplace-specific form
      setMarketplaceForm(marketplace, field, newValue);
    }
    
    toast({
      title: "Fix applied",
      description: `Updated ${field} for ${marketplace}`,
    });
    
    // Re-run preflight to update issues
    const result = await runPreflight();
    if (result) {
      setPreflightResult(result);
    }
  }, [enabled, setMarketplaceForm, runPreflight, toast]);
  
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
          
          toast({
            title: `Listed on ${marketplace}`,
            description: `Successfully created listing on ${marketplace}`,
          });
        } catch (error) {
          console.error(`Error listing on ${marketplace}:`, error);
          errors.push({ marketplace, error: error.message });
          
          toast({
            title: `Failed to list on ${marketplace}`,
            description: error.message || 'Unknown error',
            variant: "destructive",
          });
        }
      }
      
      // Show summary
      if (results.length > 0) {
        toast({
          title: "Listing complete!",
          description: `Successfully listed on ${results.length} marketplace(s)`,
        });
      }
      
      if (errors.length === 0) {
        // Close modal/dialog if all successful
        setModalOpen(false);
        setFixesDialogOpen(false);
        setSelectedMarketplaces([]);
        setPreflightResult(null);
        setModalState('idle');
      }
    } finally {
      setIsSubmitting(false);
      if (errors.length > 0) {
        // Stay in fixes state if there were errors
        setModalState('fixes');
      }
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
