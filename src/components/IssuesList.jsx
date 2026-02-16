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

/**
 * IssueItem - Single issue with fix UI
 */
function IssueItem({ issue, onApplyFix }) {
  const [localValue, setLocalValue] = React.useState(issue.suggested?.label || '');
  const [isApplying, setIsApplying] = React.useState(false);
  
  const fieldLabel = getFieldLabel(issue.field);
  const hasSuggestion = Boolean(issue.suggested);
  const hasOptions = Boolean(issue.options && issue.options.length > 0);
  
  // Handle apply fix
  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApplyFix(issue, localValue || issue.suggested?.label);
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
        {hasSuggestion && (
          <div className="p-3 bg-muted/50 rounded-md border">
            <div className="flex items-center justify-between mb-2">
              <ConfidenceBadge confidence={issue.suggested.confidence || 0} />
            </div>
            <div className="text-sm font-medium mb-2">
              {issue.suggested.label}
            </div>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isApplying}
              className="w-full"
            >
              {isApplying ? 'Applying...' : 'Apply Suggestion'}
            </Button>
          </div>
        )}
        
        {hasOptions && (
          <div>
            <Label className="text-xs mb-1.5">Select {fieldLabel}</Label>
            <Select value={localValue} onValueChange={setLocalValue}>
              <SelectTrigger>
                <SelectValue placeholder={`Choose ${fieldLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {issue.options.map(option => (
                  <SelectItem key={option.id} value={option.label}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {localValue && (
              <Button
                size="sm"
                onClick={handleApply}
                disabled={isApplying}
                className="w-full mt-2"
              >
                {isApplying ? 'Applying...' : `Apply "${localValue}"`}
              </Button>
            )}
          </div>
        )}
        
        {/* For fields without suggestions/options, show manual input */}
        {!hasSuggestion && !hasOptions && (
          <div>
            <Label className="text-xs mb-1.5">Enter {fieldLabel}</Label>
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
                onClick={handleApply}
                disabled={isApplying}
                className="w-full mt-2"
              >
                {isApplying ? 'Applying...' : 'Apply'}
              </Button>
            )}
          </div>
        )}
        
        {/* Special note for category fields */}
        {(issue.field === 'categoryId' || issue.field === 'mercariCategory' || issue.field === 'category') && (
          <p className="text-xs text-muted-foreground">
            Tip: Close this dialog and select a category in the main form, then try again
          </p>
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
