/**
 * SmartListingModal - Unified modal for multi-marketplace listing workflow
 * Features: connection checks, marketplace selection, AI auto-fill toggle, fixes panel
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
  Rocket,
  Zap,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getMarketplaceName,
  groupIssuesBySeverity,
  isMarketplaceReady,
} from '@/utils/preflightEngine';
import IssuesList from './IssuesList';

/**
 * Modal states:
 * - 'idle': Initial state with connection check + marketplace selection + mode toggle
 * - 'validating': Running preflight validation
 * - 'ready': All validations passed, ready to list
 * - 'fixes': Has validation issues that need fixing
 * - 'listing': Submitting to marketplaces
 */

/**
 * SmartListingModal component
 * @param {Object} props
 * @param {boolean} props.open - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.connectionStatus - { ebay: bool, mercari: bool, facebook: bool }
 * @param {string[]} props.selectedMarketplaces - Selected marketplace IDs
 * @param {Function} props.toggleMarketplace - Toggle marketplace selection
 * @param {string} props.autoFillMode - 'auto' | 'manual'
 * @param {Function} props.toggleAutoFillMode - Switch auto-fill mode
 * @param {Function} props.onStartListing - Handler for "Start Smart Listing" button
 * @param {Object} props.preflightResult - Preflight validation results
 * @param {Function} props.onApplyFix - Handler for applying a fix
 * @param {Function} props.onListNow - Handler for final listing submission
 * @param {boolean} props.isSubmitting - Whether listings are being submitted
 * @param {string} props.modalState - Current modal state ('idle', 'validating', 'ready', 'fixes', 'listing')
 * @param {Function} props.onReconnect - Handler for marketplace reconnection
 */
export default function SmartListingModal({
  open,
  onClose,
  connectionStatus = { ebay: false, mercari: false, facebook: false },
  selectedMarketplaces = [],
  toggleMarketplace,
  autoFillMode = 'manual',
  toggleAutoFillMode,
  onStartListing,
  preflightResult,
  onApplyFix,
  onListNow,
  isSubmitting = false,
  modalState = 'idle',
  onReconnect,
}) {
  const [activeMarketplace, setActiveMarketplace] = useState(null);
  
  // Auto-select first marketplace with issues when in fixes state
  useEffect(() => {
    if (modalState === 'fixes' && preflightResult?.fixesNeeded?.length > 0) {
      setActiveMarketplace(preflightResult.fixesNeeded[0].marketplace);
    }
  }, [modalState, preflightResult]);
  
  // Handle marketplace connection via popup
  const handleMarketplaceConnect = (marketplaceId) => {
    const width = 500;
    const height = 650;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    const marketplaceUrls = {
      ebay: 'https://www.ebay.com/',
      mercari: 'https://www.mercari.com/',
      facebook: 'https://www.facebook.com/marketplace/',
    };
    
    const url = marketplaceUrls[marketplaceId];
    if (!url) return;
    
    const windowName = `${marketplaceId}Login_${Date.now()}`;
    
    window.open(
      url,
      windowName,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no`
    );
    
    // Call the onReconnect handler if provided (for status polling)
    if (onReconnect) {
      onReconnect(marketplaceId);
    }
  };
  
  // Get marketplace data
  const marketplaces = [
    { id: 'ebay', name: 'eBay', connected: connectionStatus.ebay },
    { id: 'mercari', name: 'Mercari', connected: connectionStatus.mercari },
    { id: 'facebook', name: 'Facebook', connected: connectionStatus.facebook },
  ];
  
  const connectedCount = marketplaces.filter(m => m.connected).length;
  const selectedCount = selectedMarketplaces.length;
  
  // Check if can start listing
  const canStartListing = selectedCount > 0 && selectedMarketplaces.every(
    id => marketplaces.find(m => m.id === id)?.connected
  );
  
  // Render connection status panel
  const renderConnectionStatus = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Step 1: Connection Status</h4>
        <Badge variant={connectedCount === 3 ? "default" : "secondary"}>
          {connectedCount}/3 Connected
        </Badge>
      </div>
      <div className="space-y-2">
        {marketplaces.map(marketplace => (
          <div
            key={marketplace.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-colors",
              marketplace.connected
                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                : "bg-muted/30 border-muted"
            )}
          >
            <div className="flex items-center gap-3">
              {marketplace.connected ? (
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <span className={cn(
                "text-sm font-medium",
                marketplace.connected
                  ? "text-green-900 dark:text-green-100"
                  : "text-muted-foreground"
              )}>
                {marketplace.name}
              </span>
            </div>
            {!marketplace.connected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarketplaceConnect(marketplace.id)}
                className="h-7 text-xs"
              >
                Connect
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  
  // Render marketplace selection
  const renderMarketplaceSelection = () => (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Step 2: Select Marketplaces</h4>
      <div className="grid grid-cols-3 gap-2">
        {marketplaces.map(marketplace => (
          <div
            key={marketplace.id}
            className={cn(
              "flex items-center space-x-2 p-3 border rounded-lg transition-colors",
              marketplace.connected
                ? "hover:bg-muted/50 cursor-pointer"
                : "opacity-50 cursor-not-allowed"
            )}
            onClick={() => marketplace.connected && toggleMarketplace(marketplace.id, !selectedMarketplaces.includes(marketplace.id))}
          >
            <Checkbox
              id={`select-${marketplace.id}`}
              checked={selectedMarketplaces.includes(marketplace.id)}
              disabled={!marketplace.connected}
              onCheckedChange={(checked) => toggleMarketplace(marketplace.id, checked)}
            />
            <Label
              htmlFor={`select-${marketplace.id}`}
              className={cn(
                "cursor-pointer flex-1 font-medium text-sm",
                !marketplace.connected && "cursor-not-allowed"
              )}
            >
              {marketplace.name}
            </Label>
          </div>
        ))}
      </div>
      {selectedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedCount} marketplace{selectedCount !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
  
  // Render auto-fill mode toggle
  const renderAutoFillMode = () => (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Step 3: Auto-fill Settings</h4>
      <RadioGroup value={autoFillMode} onValueChange={toggleAutoFillMode}>
        <div className="space-y-2">
          <div className={cn(
            "flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
            autoFillMode === 'auto' ? "bg-primary/5 border-primary" : "border-muted hover:bg-muted/30"
          )}
          onClick={() => toggleAutoFillMode('auto')}
          >
            <RadioGroupItem value="auto" id="auto-mode" className="mt-0.5" />
            <div className="flex-1 space-y-1">
              <Label htmlFor="auto-mode" className="cursor-pointer font-medium flex items-center gap-2">
                <Zap className="w-4 h-4" />
                AI Auto-fill Everything
              </Label>
              <p className="text-xs text-muted-foreground">
                High confidence fields (≥85%) filled automatically. Low confidence shown for review.
              </p>
            </div>
          </div>
          
          <div className={cn(
            "flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
            autoFillMode === 'manual' ? "bg-primary/5 border-primary" : "border-muted hover:bg-muted/30"
          )}
          onClick={() => toggleAutoFillMode('manual')}
          >
            <RadioGroupItem value="manual" id="manual-mode" className="mt-0.5" />
            <div className="flex-1 space-y-1">
              <Label htmlFor="manual-mode" className="cursor-pointer font-medium flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                Manual Review Mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Review and approve all AI suggestions before listing.
              </p>
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
  
  // Render idle state (initial setup)
  const renderIdleState = () => (
    <div className="space-y-6">
      {renderConnectionStatus()}
      <div className="border-t pt-6">
        {renderMarketplaceSelection()}
      </div>
      <div className="border-t pt-6">
        {renderAutoFillMode()}
      </div>
    </div>
  );
  
  // Render validating state
  const renderValidatingState = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold">Validating Listings</h3>
        <p className="text-sm text-muted-foreground">
          Checking {selectedCount} marketplace{selectedCount !== 1 ? 's' : ''} and running AI suggestions...
        </p>
      </div>
    </div>
  );
  
  // Render ready state
  const renderReadyState = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <CheckCircle className="w-16 h-16 text-green-500" />
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-green-600 dark:text-green-400">All Ready!</h3>
        <p className="text-sm text-muted-foreground">
          All {selectedCount} marketplace{selectedCount !== 1 ? 's' : ''} passed validation.
          <br />
          Click "List Now" to create your listings.
        </p>
      </div>
      <div className="flex gap-2 mt-4">
        {selectedMarketplaces.map(id => {
          const marketplace = marketplaces.find(m => m.id === id);
          return (
            <Badge key={id} variant="outline" className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              {marketplace?.name}
            </Badge>
          );
        })}
      </div>
    </div>
  );
  
  // Render fixes state (reuse FixesDialog layout)
  const renderFixesState = () => {
    if (!preflightResult) return null;
    
    const { ready, fixesNeeded } = preflightResult;
    const totalMarketplaces = ready.length + fixesNeeded.length;
    
    // Get issues for active marketplace
    const activeIssues = activeMarketplace
      ? fixesNeeded.find(mp => mp.marketplace === activeMarketplace)?.issues || []
      : [];
    
    const { blocking: blockingIssues, warning: warningIssues } = groupIssuesBySeverity(activeIssues);
    
    // Check if all marketplaces are ready to list
    const canListNow = fixesNeeded.every(mp => isMarketplaceReady(mp.issues));
    
    return (
      <div className="grid grid-cols-[250px_1fr] min-h-[400px]">
        {/* Left: Marketplaces list */}
        <ScrollArea className="border-r">
          <div className="p-4 space-y-1">
            {/* Ready marketplaces */}
            {ready.map(marketplace => (
              <div
                key={marketplace}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
              >
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  {getMarketplaceName(marketplace)}
                </span>
              </div>
            ))}
            
            {/* Marketplaces with issues */}
            {fixesNeeded.map(({ marketplace, issues }) => {
              const { blocking, warning } = groupIssuesBySeverity(issues);
              const hasBlocking = blocking.length > 0;
              const isActive = marketplace === activeMarketplace;
              
              return (
                <button
                  key={marketplace}
                  onClick={() => setActiveMarketplace(marketplace)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left",
                    isActive 
                      ? "bg-primary/10 border-primary" 
                      : "hover:bg-muted border-transparent",
                    "border"
                  )}
                >
                  {hasBlocking ? (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {getMarketplaceName(marketplace)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {blocking.length > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          {blocking.length} blocking
                        </span>
                      )}
                      {blocking.length > 0 && warning.length > 0 && (
                        <span className="mx-1">•</span>
                      )}
                      {warning.length > 0 && (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          {warning.length} warning{warning.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
        
        {/* Right: Issues panel */}
        <div className="flex flex-col min-h-0">
          {activeMarketplace ? (
            <>
              <div className="px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {getMarketplaceName(activeMarketplace)}
                  </h3>
                  <div className="flex gap-2">
                    {blockingIssues.length > 0 && (
                      <Badge variant="destructive">
                        {blockingIssues.length} Blocking
                      </Badge>
                    )}
                    {warningIssues.length > 0 && (
                      <Badge variant="warning" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        {warningIssues.length} Warning{warningIssues.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <IssuesList
                    marketplace={activeMarketplace}
                    issues={activeIssues}
                    onApplyFix={onApplyFix}
                  />
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="text-lg font-medium">All Clear!</p>
                <p className="text-sm">All marketplaces are ready to list</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Determine modal title based on state
  const getModalTitle = () => {
    switch (modalState) {
      case 'validating':
        return 'Validating...';
      case 'ready':
        return 'Ready to List';
      case 'fixes':
        return 'Review & Fix Issues';
      case 'listing':
        return 'Creating Listings...';
      default:
        return 'Smart Listing';
    }
  };
  
  // Determine modal description
  const getModalDescription = () => {
    switch (modalState) {
      case 'idle':
        return 'List to multiple marketplaces with AI-powered auto-fill and validation';
      case 'validating':
        return 'Please wait while we validate your listings...';
      case 'ready':
        return `${selectedCount} marketplace${selectedCount !== 1 ? 's' : ''} ready`;
      case 'fixes':
        return preflightResult 
          ? `${preflightResult.ready.length} ready, ${preflightResult.fixesNeeded.length} need attention`
          : 'Review issues before listing';
      case 'listing':
        return 'Creating your listings...';
      default:
        return '';
    }
  };
  
  // Render footer buttons based on state
  const renderFooter = () => {
    if (modalState === 'idle') {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onStartListing}
            disabled={!canStartListing}
            className="gap-2"
          >
            <Rocket className="w-4 h-4" />
            Start Smart Listing
          </Button>
        </DialogFooter>
      );
    }
    
    if (modalState === 'validating') {
      return null; // No buttons while validating
    }
    
    if (modalState === 'ready' || modalState === 'fixes') {
      const canList = modalState === 'ready' || 
        (preflightResult && preflightResult.fixesNeeded.every(mp => isMarketplaceReady(mp.issues)));
      
      return (
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onListNow}
            disabled={!canList || isSubmitting}
            className="min-w-[120px] gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Listing...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                List to {selectedCount} Marketplace{selectedCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      );
    }
    
    return null;
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        "p-0",
        modalState === 'fixes' ? "max-w-5xl max-h-[85vh]" : "max-w-2xl"
      )}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{getModalTitle()}</DialogTitle>
          <DialogDescription>
            {getModalDescription()}
          </DialogDescription>
        </DialogHeader>
        
        <div className={cn(
          modalState === 'idle' ? "px-6 py-4" : "",
          modalState === 'fixes' ? "" : "px-6"
        )}>
          {modalState === 'idle' && renderIdleState()}
          {modalState === 'validating' && renderValidatingState()}
          {modalState === 'ready' && renderReadyState()}
          {modalState === 'fixes' && renderFixesState()}
        </div>
        
        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
