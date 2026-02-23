/**
 * IssuesList – displays Smart Suggestions + Blocking Issues for a single marketplace
 * in the Smart Listing review modal.
 *
 * Sections (in order):
 *  1. Smart Fill banner  – fields mappable from the general form (severity: 'suggestion')
 *  2. Blocking issues    – required fields that must be resolved before listing
 *  3. Warnings           – non-blocking flags
 */

import React, { useState, useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  ArrowRight,
  Wand2,
  Info,
  Check,
  Save,
  Search,
  Loader2,
} from 'lucide-react';
import {
  useEbayCategoryTreeId,
  useEbayCategorySuggestions,
} from '@/hooks/useEbayCategorySuggestions';

// Inline color palette matching ColorPickerDialog
const EBAY_COLORS = [
  { name: "Black",  hex: "#000000" },
  { name: "White",  hex: "#FFFFFF" },
  { name: "Grey",   hex: "#808080" },
  { name: "Beige",  hex: "#F5F5DC" },
  { name: "Red",    hex: "#FF0000" },
  { name: "Pink",   hex: "#FFC0CB" },
  { name: "Orange", hex: "#FFA500" },
  { name: "Yellow", hex: "#FFFF700" },
  { name: "Green",  hex: "#008000" },
  { name: "Blue",   hex: "#0000FF" },
  { name: "Purple", hex: "#800080" },
  { name: "Brown",  hex: "#8B4513" },
  { name: "Gold",   hex: "#FFD700" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Multicolor", hex: "linear-gradient(135deg,red,orange,yellow,green,blue,purple)" },
];

// Fields where "Save as eBay default" is offered in the review panel
const EBAY_DEFAULT_ELIGIBLE_FIELDS = new Set([
  'shippingMethod', 'shippingCostType', 'shippingCost', 'handlingTime',
  'shippingService', 'shipFromCountry', 'returnWithin', 'returnShippingPayer',
  'returnRefundMethod', 'pricingFormat', 'duration',
  'allowBestOffer', 'autoAcceptPrice', 'minimumOfferPrice',
  'freeShipping', 'addLocalPickup', 'localPickupLocation',
  'locationDescriptions', 'shippingLocation', 'acceptReturns',
]);

// Fields where "Save as Facebook default" is offered in the review panel
const FACEBOOK_DEFAULT_ELIGIBLE_FIELDS = new Set([
  'deliveryMethod', 'shippingOption', 'shippingCarrier', 'shippingPrice',
  'displayFreeShipping', 'localPickup', 'meetUpLocation',
  'allowOffers', 'minimumOfferPrice', 'hideFromFriends',
]);
import { cn } from '@/lib/utils';
import { getFieldLabel, groupIssuesBySeverity } from '@/utils/preflightEngine';

// ---------------------------------------------------------------------------
// Inline eBay Category Search — lets users search eBay categories without
// leaving the smart listing review panel.
// ---------------------------------------------------------------------------
function EbayCategorySearchInput({ issue, onApplyFix }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [applying, setApplying] = useState(false);
  const debounceRef = useRef(null);

  // Get the category tree ID (cached; fetches once)
  const { data: treeData, isLoading: treeLoading } = useEbayCategoryTreeId('EBAY_US');
  const categoryTreeId = treeData?.categoryTreeId ?? null;

  // Debounce search input by 400ms
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const { data: suggestionsData, isFetching } = useEbayCategorySuggestions(
    categoryTreeId,
    debouncedQuery,
    debouncedQuery.length >= 2
  );

  const suggestions = suggestionsData?.categorySuggestions?.slice(0, 8) ?? [];

  async function handleSelect(cat) {
    // Build full path: ancestors are ordered from leaf → root, so reverse them
    const ancestors = [...(cat.categoryTreeNodeAncestors ?? [])].reverse();
    const fullPath = [...ancestors.map((a) => a.categoryName), cat.category.categoryName].join(' > ');
    setApplying(true);
    try {
      await onApplyFix(issue, { id: cat.category.categoryId, label: fullPath });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground block">Search eBay categories</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Cell Phones, Running Shoes, Camera…"
          className="pl-8 h-9 text-sm"
        />
        {(isFetching || treeLoading) && (
          <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground animate-spin" />
        )}
      </div>

      {suggestions.length > 0 && (
        <ScrollArea className="max-h-48 rounded-md border bg-popover">
          <div className="p-1 space-y-0.5">
            {suggestions.map((cat, i) => {
              const ancestors = [...(cat.categoryTreeNodeAncestors ?? [])].reverse();
              const fullPath = [...ancestors.map((a) => a.categoryName), cat.category.categoryName].join(' > ');
              return (
                <button
                  key={`${cat.category.categoryId}-${i}`}
                  type="button"
                  disabled={applying}
                  onClick={() => handleSelect(cat)}
                  className="w-full text-left px-3 py-2 rounded-sm text-xs hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <span className="font-medium text-foreground">{cat.category.categoryName}</span>
                  {ancestors.length > 0 && (
                    <span className="block text-[10px] text-muted-foreground truncate mt-0.5">
                      {ancestors.map((a) => a.categoryName).join(' › ')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {debouncedQuery.length >= 2 && !isFetching && suggestions.length === 0 && (
        <p className="text-xs text-muted-foreground">No categories found for "{debouncedQuery}". Try different keywords.</p>
      )}

      {applying && (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          Applying category…
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fields that must be chosen via the marketplace's own category picker tree
// (Mercari hierarchical pickers can't be replicated here — eBay now handled inline)
// ---------------------------------------------------------------------------
const TREE_CATEGORY_FIELDS = ['mercariCategory', 'mercariCategoryId'];

function getCategoryTabHint(marketplace) {
  const tab = marketplace === 'ebay' ? 'eBay'
    : marketplace === 'mercari' ? 'Mercari'
    : 'marketplace';
  return `Open the ${tab} tab in the form, select a category, then re-open Smart Listing.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine the actual value to store when applying a suggestion or option. */
function resolveApplyValue(issue, rawValue) {
  // Facebook category options carry { id, label } objects
  if (issue.field === 'category' && issue.marketplace === 'facebook' && rawValue && typeof rawValue === 'object') {
    return rawValue;
  }
  // For suggestion issues the suggested.id may differ from label (e.g. Facebook condition)
  return rawValue;
}

// ---------------------------------------------------------------------------
// SmartSuggestionItem – one row in the Smart Fill section
// ---------------------------------------------------------------------------
function SmartSuggestionItem({ issue, onApplyFix, onApplied }) {
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);

  const label  = getFieldLabel(issue.field);
  const sugg   = issue.suggested;
  const value  = sugg?.id ?? sugg?.label ?? '';
  const display = sugg?.label ?? value;

  async function handleApply() {
    if (!value) return;
    setApplying(true);
    try {
      await onApplyFix(issue, sugg?.id ? { id: sugg.id, label: sugg.label } : value);
      setApplied(true);
      onApplied?.();
    } finally {
      setApplying(false);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
        <Check className="w-4 h-4 text-green-600 shrink-0" />
        <span className="text-sm font-medium text-green-800 dark:text-green-300 flex-1">{label}</span>
        <span className="text-xs text-green-600 dark:text-green-400">Applied ✓</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors group">
      {/* Field + mapping */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {sugg?.sourceField && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
              from General
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {sugg?.sourceValue && (
            <>
              <span className="italic truncate max-w-[120px]">{sugg.sourceValue}</span>
              <ArrowRight className="w-3 h-3 shrink-0" />
            </>
          )}
          <span className="font-medium text-foreground truncate">{display}</span>
        </div>
        {sugg?.reasoning && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sugg.reasoning}</p>
        )}
      </div>

      {/* Apply button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleApply}
        disabled={applying}
        className="shrink-0 h-8 gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
      >
        {applying ? (
          <span className="animate-pulse">Applying…</span>
        ) : (
          <>
            <Check className="w-3 h-3" />
            Apply
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlockingIssueItem – one required field that needs manual input or a fix
// ---------------------------------------------------------------------------
function BlockingIssueItem({ issue, onApplyFix, onSaveEbayDefault, onSaveFacebookDefault }) {
  const [localValue, setLocalValue] = useState('');
  const [localOption, setLocalOption] = useState(null); // { id, label }
  const [applying, setApplying] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const label         = getFieldLabel(issue.field);
  const hasSuggestion = Boolean(issue.suggested);
  const hasOptions    = Boolean(issue.options?.length);
  const isTreeCategory = TREE_CATEGORY_FIELDS.includes(issue.field);
  const isEbayCategoryField = issue.field === 'categoryId' && issue.marketplace === 'ebay';
  const isEbayColorField  = issue.field === 'color' && issue.marketplace === 'ebay';
  const isFbCategory  = issue.field === 'category' && issue.marketplace === 'facebook';
  const isEbayDefaultEligible = issue.marketplace === 'ebay' && EBAY_DEFAULT_ELIGIBLE_FIELDS.has(issue.field) && typeof onSaveEbayDefault === 'function';
  const isFacebookDefaultEligible = issue.marketplace === 'facebook' && FACEBOOK_DEFAULT_ELIGIBLE_FIELDS.has(issue.field) && typeof onSaveFacebookDefault === 'function';
  const isDefaultEligible = isEbayDefaultEligible || isFacebookDefaultEligible;
  const defaultLabel = isEbayDefaultEligible ? 'Save as eBay default for future listings' : 'Save as Facebook default for future listings';

  async function handleApply(raw) {
    let val;
    if (raw !== undefined) {
      val = raw;
    } else if (isFbCategory && localOption) {
      val = localOption;
    } else {
      val = localValue || (issue.suggested?.id ?? issue.suggested?.label);
    }
    if (!val) return;
    setApplying(true);
    try {
      await onApplyFix(issue, val);
      if (saveAsDefault && isDefaultEligible) {
        const storedVal = typeof val === 'object' ? (val.id ?? val.label) : val;
        if (isEbayDefaultEligible) onSaveEbayDefault(issue.field, storedVal, { silent: true });
        if (isFacebookDefaultEligible) onSaveFacebookDefault(issue.field, storedVal, { silent: true });
      }
    } finally {
      setApplying(false);
    }
  }

  // Special fields: connection/error – simple alert only
  if (issue.field.startsWith('_')) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="font-semibold">{label}</div>
          <div className="text-sm mt-0.5">{issue.message}</div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-red-200/60 dark:border-red-900/50">
        <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{label}</span>
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Required</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{issue.message}</p>
        </div>
      </div>

      {/* Fix UI */}
      <div className="px-4 py-3 space-y-3">
        {/* eBay category: inline search */}
        {isEbayCategoryField ? (
          <EbayCategorySearchInput issue={issue} onApplyFix={onApplyFix} />
        ) : isTreeCategory ? (
          /* Other tree-pickers (Mercari): must use the marketplace tab */
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            <AlertDescription className="text-xs text-amber-900 dark:text-amber-100">
              <strong>Use the category picker:</strong>{' '}{getCategoryTabHint(issue.marketplace)}
            </AlertDescription>
          </Alert>
        ) : isEbayColorField ? (
          /* eBay color: inline color swatches */
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Select a color</Label>
            <div className="flex flex-wrap gap-2">
              {EBAY_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  onClick={() => handleApply(c.name)}
                  disabled={applying}
                  className="group flex flex-col items-center gap-1 disabled:opacity-50"
                >
                  <span
                    className="h-8 w-8 rounded-full border-2 border-muted hover:border-primary transition-colors shadow-sm"
                    style={{ background: c.hex.startsWith('linear') ? c.hex : c.hex, borderColor: c.hex === '#FFFFFF' ? '#e5e7eb' : undefined }}
                  />
                  <span className="text-[10px] text-muted-foreground leading-none">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* AI / client-side suggestion */}
            {hasSuggestion && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-primary">
                      {issue.suggested.isFromDefault ? 'From your saved eBay defaults' : 'Suggested'}
                    </span>
                  </div>
                  <SuggestionConfidence confidence={issue.suggested.confidence ?? 0} />
                </div>
                <p className="text-sm font-medium mb-1">{issue.suggested.label}</p>
                {issue.suggested.reasoning && (
                  <p className="text-[11px] text-muted-foreground mb-2">{issue.suggested.reasoning}</p>
                )}
                {isDefaultEligible && !issue.suggested.isFromDefault && (
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id={`save-default-${issue.field}`}
                      checked={saveAsDefault}
                      onCheckedChange={setSaveAsDefault}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor={`save-default-${issue.field}`} className="text-[11px] text-muted-foreground cursor-pointer flex items-center gap-1">
                      <Save className="w-3 h-3" />
                      {defaultLabel}
                    </label>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => handleApply(issue.suggested.id ?? issue.suggested.label)}
                  disabled={applying}
                  className="w-full h-8 text-xs gap-1.5"
                >
                  <Check className="w-3 h-3" />
                  {applying ? 'Applying…' : 'Apply Suggestion'}
                </Button>
              </div>
            )}

            {/* Dropdown for predefined options */}
            {hasOptions && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  {hasSuggestion ? 'Or choose a different value:' : `Select ${label}`}
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={isFbCategory ? (localOption?.id || '') : localValue}
                    onValueChange={(id) => {
                      if (isFbCategory) {
                        const opt = issue.options.find(o => o.id === id);
                        setLocalOption(opt ?? { id, label: id });
                      } else {
                        setLocalValue(id);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder={`Choose ${label.toLowerCase()}…`} />
                    </SelectTrigger>
                    <SelectContent>
                      {issue.options.map(opt => (
                        <SelectItem key={opt.id} value={opt.id} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(isFbCategory ? localOption : localValue) && (
                    <Button
                      size="sm"
                      className="h-8 text-xs shrink-0"
                      onClick={() => handleApply(isFbCategory ? localOption : localValue)}
                      disabled={applying}
                    >
                      {applying ? '…' : 'Apply'}
                    </Button>
                  )}
                </div>
                {isDefaultEligible && (isFbCategory ? localOption : localValue) && (
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      id={`save-default-opt-${issue.field}`}
                      checked={saveAsDefault}
                      onCheckedChange={setSaveAsDefault}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor={`save-default-opt-${issue.field}`} className="text-[11px] text-muted-foreground cursor-pointer flex items-center gap-1">
                      <Save className="w-3 h-3" />
                      {defaultLabel}
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Text / number input for fields with no predefined options */}
            {!hasOptions && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  {hasSuggestion ? 'Or enter a custom value:' : `Enter ${label}`}
                </Label>
                <div className="flex gap-2">
                  {issue.field === 'description' ? (
                    <Textarea
                      value={localValue}
                      onChange={e => setLocalValue(e.target.value)}
                      placeholder={`Enter ${label.toLowerCase()}…`}
                      rows={3}
                      className="resize-none text-xs flex-1"
                    />
                  ) : (
                    <Input
                      type={issue.field.includes('price') || issue.field === 'quantity' ? 'number' : 'text'}
                      value={localValue}
                      onChange={e => setLocalValue(e.target.value)}
                      placeholder={`Enter ${label.toLowerCase()}…`}
                      className="h-8 text-xs flex-1"
                    />
                  )}
                  {localValue && (
                    <Button
                      size="sm"
                      className="h-8 text-xs shrink-0"
                      onClick={() => handleApply(localValue)}
                      disabled={applying}
                    >
                      {applying ? '…' : 'Apply'}
                    </Button>
                  )}
                </div>
                {isDefaultEligible && localValue && (
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      id={`save-default-txt-${issue.field}`}
                      checked={saveAsDefault}
                      onCheckedChange={setSaveAsDefault}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor={`save-default-txt-${issue.field}`} className="text-[11px] text-muted-foreground cursor-pointer flex items-center gap-1">
                      <Save className="w-3 h-3" />
                      {defaultLabel}
                    </label>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SuggestionConfidence({ confidence }) {
  if (confidence >= 0.88) {
    return (
      <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">
        High confidence
      </Badge>
    );
  }
  if (confidence >= 0.70) {
    return (
      <Badge className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-0">
        Review
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
      Low confidence
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// IssuesList (main export)
// ---------------------------------------------------------------------------
export default function IssuesList({ marketplace, issues, onApplyFix, onSaveEbayDefault, onSaveFacebookDefault }) {
  const { blocking, warning, suggestion } = groupIssuesBySeverity(issues);

  // Track how many suggestions have been applied (to update the banner count live)
  const [appliedCount, setAppliedCount] = useState(0);
  const pendingSuggestions = suggestion.length - appliedCount;

  // Accept all smart-fill suggestions in sequence
  async function handleApplyAllSuggestions() {
    for (const issue of suggestion) {
      const sugg = issue.suggested;
      if (!sugg) continue;
      const val = sugg.id ? { id: sugg.id, label: sugg.label } : sugg.label;
      await onApplyFix(issue, val);
      setAppliedCount(c => c + 1);
    }
  }

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center mb-3">
          <CheckCircle className="w-7 h-7 text-green-500" />
        </div>
        <p className="text-base font-semibold">All Set!</p>
        <p className="text-sm text-muted-foreground mt-1">This marketplace is ready to list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ---------------------------------------------------------------- */}
      {/* SMART FILL SECTION                                                */}
      {/* ---------------------------------------------------------------- */}
      {suggestion.length > 0 && (
        <section>
          {/* Banner */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-200/70 dark:border-indigo-800/60 p-4 mb-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center shrink-0">
                <Wand2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                      Smart Fill
                    </h4>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {pendingSuggestions > 0
                        ? `${pendingSuggestions} field${pendingSuggestions !== 1 ? 's' : ''} can be auto-filled from your general listing`
                        : 'All suggestions applied!'}
                    </p>
                  </div>
                  {pendingSuggestions > 0 && (
                    <Button
                      size="sm"
                      onClick={handleApplyAllSuggestions}
                      className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      Apply All ({pendingSuggestions})
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Suggestion rows */}
          <div className="space-y-2">
            {suggestion.map((issue, i) => (
              <SmartSuggestionItem
                key={`${issue.field}-${i}`}
                issue={issue}
                onApplyFix={onApplyFix}
                onApplied={() => setAppliedCount(c => c + 1)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* BLOCKING ISSUES                                                   */}
      {/* ---------------------------------------------------------------- */}
      {blocking.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-red-500" />
            <h4 className="text-sm font-semibold">
              Required Fields
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({blocking.length} must be fixed before listing)
              </span>
            </h4>
          </div>
          <div className="space-y-3">
            {blocking.map((issue, i) => (
              <BlockingIssueItem
                key={`${issue.field}-${i}`}
                issue={issue}
                onApplyFix={onApplyFix}
                onSaveEbayDefault={onSaveEbayDefault}
                onSaveFacebookDefault={onSaveFacebookDefault}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* WARNINGS                                                          */}
      {/* ---------------------------------------------------------------- */}
      {warning.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <h4 className="text-sm font-semibold">
              Warnings
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({warning.length})
              </span>
            </h4>
          </div>
          <div className="space-y-2">
            {warning.map((issue, i) => (
              <Alert
                key={`${issue.field}-${i}`}
                className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/10 dark:border-yellow-900"
              >
                <Info className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <span className="font-medium">{getFieldLabel(issue.field)}:</span>{' '}
                  {issue.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
