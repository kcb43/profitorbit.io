/**
 * IssuesList - Displays validation issues and provides UI to fix them
 */

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  XCircle,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFieldLabel, groupIssuesBySeverity } from '@/utils/preflightEngine';

/**
 * Get icon for issue severity
 */
function IssueIcon({ severity, className }) {
  if (severity === 'blocking') {
    return <XCircle className={cn("w-5 h-5 text-red-500", className)} />;
  }
  return <AlertCircle className={cn("w-5 h-5 text-yellow-500", className)} />;
}

/**
 * Confidence badge component
 */
function ConfidenceBadge({ confidence }) {
  if (confidence >= 0.85) {
    return (
      <Badge variant="success" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <Sparkles className="w-3 h-3 mr-1" />
        Auto-suggested
      </Badge>
    );
  }
  
  if (confidence >= 0.70) {
    return (
      <Badge variant="warning" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        <Sparkles className="w-3 h-3 mr-1" />
        Suggested (review)
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary">
      Low confidence - please confirm
    </Badge>
  );
}

// Fields that require navigating to the marketplace form tab (can't be typed in directly).
// Note: 'category' (Facebook) is intentionally excluded here – it now gets proper
// dropdown options from FACEBOOK_CATEGORIES, so it can be handled inline.
const CATEGORY_FIELDS = ['categoryId', 'mercariCategory', 'mercariCategoryId'];

// Map marketplace + field to the tab the user needs to visit
function getCategoryTabHint(marketplace, field) {
  const tabName = marketplace === 'ebay' ? 'eBay'
    : marketplace === 'mercari' ? 'Mercari'
    : marketplace === 'facebook' ? 'Facebook'
    : 'marketplace';
  return `Open the ${tabName} tab in the form and select the category using the category picker there.`;
}

/**
 * IssueItem - Single issue with fix UI
 */
function IssueItem({ issue, onApplyFix }) {
  // localOption stores the full { id, label } for option-based pickers; localValue for text inputs
  const [localValue, setLocalValue] = React.useState('');
  const [localOption, setLocalOption] = React.useState(null); // { id, label }
  const [isApplying, setIsApplying] = React.useState(false);
  
  const fieldLabel = getFieldLabel(issue.field);
  const hasSuggestion = Boolean(issue.suggested);
  const hasOptions = Boolean(issue.options && issue.options.length > 0);
  const isCategoryField = CATEGORY_FIELDS.includes(issue.field);
  
  // Determine if this issue uses an option picker that carries id+label pairs
  // (currently: Facebook 'category' field which needs both category name and categoryId slug)
  const isOptionIdField = issue.field === 'category' && issue.marketplace === 'facebook';

  // Handle apply fix — pass { id, label } for option-picker fields so the handler
  // can persist both the display name and the slug.
  const handleApply = async (value) => {
    let valueToApply;
    if (value !== undefined) {
      valueToApply = value;
    } else if (isOptionIdField && localOption) {
      valueToApply = localOption; // { id, label }
    } else {
      valueToApply = localValue || issue.suggested?.label;
    }
    if (!valueToApply) return;
    setIsApplying(true);
    try {
      await onApplyFix(issue, valueToApply);
    } finally {
      setIsApplying(false);
    }
  };
  
  // For connection errors, don't show input - just the message
  if (issue.field === '_connection' || issue.field === '_error' || issue.field === '_marketplace') {
    return (
      <Alert variant={issue.severity === 'blocking' ? 'destructive' : 'default'}>
        <IssueIcon severity={issue.severity} className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium">{fieldLabel}</div>
          <div className="text-sm mt-1">{issue.message}</div>
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <div className="flex items-start gap-3">
        <IssueIcon severity={issue.severity} className="mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm">{fieldLabel}</h4>
            {issue.severity === 'blocking' && (
              <Badge variant="destructive" className="text-xs">Required</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{issue.message}</p>
        </div>
      </div>
      
      {/* Fix UI */}
      <div className="ml-8 space-y-2">

        {/* Category fields: can't be typed — must use the marketplace form tab */}
        {isCategoryField ? (
          <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs text-amber-900 dark:text-amber-100">
              <strong>Use the category picker:</strong>{' '}
              {getCategoryTabHint(issue.marketplace, issue.field)}
              {' '}Close this dialog, fill in the category, then re-open Smart Listing.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* AI Suggestion (shown when available) */}
            {hasSuggestion && (
              <div className="p-3 bg-muted/50 rounded-md border">
                <div className="flex items-center justify-between mb-2">
                  <ConfidenceBadge confidence={issue.suggested.confidence || 0} />
                </div>
                <div className="text-sm font-medium mb-2">
                  Suggested: {issue.suggested.label}
                </div>
                {issue.suggested.reasoning && (
                  <p className="text-xs text-muted-foreground mb-2">{issue.suggested.reasoning}</p>
                )}
                <Button
                  size="sm"
                  onClick={() => handleApply(issue.suggested.label)}
                  disabled={isApplying}
                  className="w-full"
                >
                  {isApplying ? 'Applying...' : 'Apply Suggestion'}
                </Button>
              </div>
            )}
            
            {/* Dropdown for fields with predefined options */}
            {hasOptions && (
              <div>
                <Label className="text-xs mb-1.5 block">
                  {hasSuggestion ? 'Or choose a different value:' : `Select ${fieldLabel}`}
                </Label>
                <Select
                  value={isOptionIdField ? (localOption?.id || '') : localValue}
                  onValueChange={(selectedId) => {
                    if (isOptionIdField) {
                      const opt = issue.options.find(o => o.id === selectedId);
                      setLocalOption(opt || { id: selectedId, label: selectedId });
                    } else {
                      setLocalValue(selectedId);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Choose ${fieldLabel.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {issue.options.map(option => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(isOptionIdField ? localOption : localValue) && (
                  <Button
                    size="sm"
                    onClick={() => handleApply(isOptionIdField ? localOption : localValue)}
                    disabled={isApplying}
                    className="w-full mt-2"
                  >
                    {isApplying ? 'Applying…' : `Apply "${isOptionIdField ? localOption?.label : (issue.options.find(o => o.id === localValue)?.label || localValue)}"`}
                  </Button>
                )}
              </div>
            )}
            
            {/* Manual text/number/textarea input for fields with no options or suggestion */}
            {!hasOptions && (
              <div>
                <Label className="text-xs mb-1.5 block">
                  {hasSuggestion ? 'Or enter a custom value:' : `Enter ${fieldLabel}`}
                </Label>
                {issue.field === 'description' ? (
                  <Textarea
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    placeholder={`Enter ${fieldLabel.toLowerCase()}`}
                    rows={4}
                    className="resize-none"
                  />
                ) : (
                  <Input
                    type={issue.field.includes('price') || issue.field === 'quantity' ? 'number' : 'text'}
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    placeholder={`Enter ${fieldLabel.toLowerCase()}`}
                  />
                )}
                {localValue && (
                  <Button
                    size="sm"
                    onClick={() => handleApply(localValue)}
                    disabled={isApplying}
                    className="w-full mt-2"
                  >
                    {isApplying ? 'Applying...' : 'Apply'}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * IssuesList component
 */
export default function IssuesList({ marketplace, issues, onApplyFix }) {
  const { blocking, warning } = groupIssuesBySeverity(issues);
  
  // Check if there are AI suggestions
  const hasAISuggestions = issues.some(issue => issue.suggested);
  const aiSuggestions = issues.filter(issue => issue.suggested);
  
  // Handler to accept all AI suggestions
  const handleAcceptAllAI = async () => {
    for (const issue of aiSuggestions) {
      await onApplyFix(issue, issue.suggested.label);
    }
  };
  
  if (issues.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
        <p className="text-lg font-medium">All Set!</p>
        <p className="text-sm text-muted-foreground">
          This marketplace is ready to list
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Accept All AI Suggestions Button */}
      {hasAISuggestions && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">AI Suggestions Ready</h4>
              <p className="text-xs text-muted-foreground mb-3">
                We've automatically filled {aiSuggestions.length} field{aiSuggestions.length !== 1 ? 's' : ''} based on your product information
              </p>
              <Button
                onClick={handleAcceptAllAI}
                size="sm"
                className="w-full"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Accept All {aiSuggestions.length} AI Suggestion{aiSuggestions.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Blocking issues */}
      {blocking.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            Blocking Issues ({blocking.length})
          </h4>
          <div className="space-y-3">
            {blocking.map((issue, index) => (
              <IssueItem
                key={`${issue.field}-${index}`}
                issue={issue}
                onApplyFix={onApplyFix}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Warning issues */}
      {warning.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            Warnings ({warning.length})
          </h4>
          <div className="space-y-3">
            {warning.map((issue, index) => (
              <IssueItem
                key={`${issue.field}-${index}`}
                issue={issue}
                onApplyFix={onApplyFix}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
