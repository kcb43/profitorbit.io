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
 * @returns {Object} Smart listing state and handlers
 */
export function useSmartListing(forms, validationOptions, setMarketplaceForm, handleSubmit, enabled = true) {
  const { toast } = useToast();
  const [selectedMarketplaces, setSelectedMarketplaces] = useState([]);
  const [fixesDialogOpen, setFixesDialogOpen] = useState(false);
  const [preflightResult, setPreflightResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // If disabled, return no-op handlers
  if (!enabled) {
    return {
      selectedMarketplaces: [],
      fixesDialogOpen: false,
      preflightResult: null,
      isSubmitting: false,
      toggleMarketplace: () => {},
      handleListToSelected: () => {},
      handleApplyFix: () => {},
      handleListNow: () => {},
      closeFixesDialog: () => {},
    };
  }
  
  /**
   * Toggle marketplace selection
   */
  const toggleMarketplace = useCallback((marketplace, checked) => {
    setSelectedMarketplaces(prev => {
      if (checked) {
        return [...prev, marketplace];
      } else {
        return prev.filter(mp => mp !== marketplace);
      }
    });
  }, []);
  
  /**
   * Run preflight validation
   */
  const runPreflight = useCallback(async () => {
    if (selectedMarketplaces.length === 0) {
      toast({
        title: "No marketplaces selected",
        description: "Please select at least one marketplace to list on",
        variant: "destructive",
      });
      return null;
    }
    
    debugLog('Running preflight for marketplaces:', selectedMarketplaces);
    
    const result = await preflightSelectedMarketplaces(
      selectedMarketplaces,
      forms.generalForm,
      forms.ebayForm,
      forms.mercariForm,
      forms.facebookForm,
      validationOptions
    );
    
    debugLog('Preflight result:', result);
    
    return result;
  }, [selectedMarketplaces, forms, validationOptions, toast]);
  
  /**
   * Handle "List to Selected" button click
   */
  const handleListToSelected = useCallback(async () => {
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
  }, [runPreflight, toast]);
  
  /**
   * Apply a fix to a form field
   */
  const handleApplyFix = useCallback(async (issue, newValue) => {
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
  }, [setMarketplaceForm, runPreflight, toast]);
  
  /**
   * List to all ready marketplaces
   */
  const handleListNow = useCallback(async (marketplacesToList) => {
    if (!marketplacesToList || marketplacesToList.length === 0) {
      toast({
        title: "No marketplaces ready",
        description: "Please fix all blocking issues first",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    debugLog('Listing to marketplaces:', marketplacesToList);
    
    const results = [];
    const errors = [];
    
    try {
      for (const marketplace of marketplacesToList) {
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
        // Close dialog if all successful
        setFixesDialogOpen(false);
        setSelectedMarketplaces([]);
        setPreflightResult(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [handleSubmit, toast]);
  
  /**
   * Close fixes dialog
   */
  const closeFixesDialog = useCallback(() => {
    setFixesDialogOpen(false);
  }, []);
  
  return {
    // State
    selectedMarketplaces,
    fixesDialogOpen,
    preflightResult,
    isSubmitting,
    
    // Handlers
    toggleMarketplace,
    handleListToSelected,
    handleApplyFix,
    handleListNow: () => handleListNow(preflightResult?.ready || []),
    closeFixesDialog,
  };
}
