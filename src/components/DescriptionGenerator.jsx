/**
 * DescriptionGenerator
 *
 * Generates full-length, platform-specific marketplace descriptions
 * (eBay, Mercari, Facebook) + search tags + category suggestions in one AI call.
 *
 * Features:
 * - Square platform icon tabs with marketplace logos
 * - Per-item localStorage cache (only regenerates when user clicks "Regenerate")
 * - Apply Tags to Item (saves to DB via onApplyTags callback)
 * - Animated category suggestions section
 * - Link to Fulfillment Settings
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  RefreshCw,
  Check,
  X,
  Loader2,
  Wand2,
  Copy,
  Tag,
  Settings,
  ChevronRight,
  FolderOpen,
  BookmarkPlus,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Platform config — square icon tabs
// ---------------------------------------------------------------------------

const PLATFORM_ICONS = [
  {
    key: 'ebay',
    label: 'eBay',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg',
    bg: 'bg-white dark:bg-zinc-800',
    border: 'border-blue-200 dark:border-blue-800',
    activeBg: 'bg-blue-50 dark:bg-blue-950/50',
    activeBorder: 'border-blue-500',
  },
  {
    key: 'mercari',
    label: 'Mercari',
    logo: 'https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B',
    bg: 'bg-white dark:bg-zinc-800',
    border: 'border-red-200 dark:border-red-900',
    activeBg: 'bg-red-50 dark:bg-red-950/50',
    activeBorder: 'border-red-500',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg',
    bg: 'bg-white dark:bg-zinc-800',
    border: 'border-blue-200 dark:border-blue-900',
    activeBg: 'bg-blue-50 dark:bg-blue-950/60',
    activeBorder: 'border-[#1877F2]',
  },
  {
    key: 'tags',
    label: 'Tags',
    logo: null, // uses icon instead
    bg: 'bg-white dark:bg-zinc-800',
    border: 'border-purple-200 dark:border-purple-900',
    activeBg: 'bg-purple-50 dark:bg-purple-950/50',
    activeBorder: 'border-purple-500',
  },
];

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const CACHE_VERSION = 'v2'; // bumped: per-marketplace category suggestions

function getCacheKey(itemId, title) {
  const keyBase = itemId || (title ? `title:${title.slice(0, 40)}` : null);
  return keyBase ? `ai_gen_${CACHE_VERSION}_${keyBase}` : null;
}

function readCache(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after 7 days
    if (Date.now() - (parsed._ts || 0) > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, _ts: Date.now() }));
  } catch {}
}

function clearCache(key) {
  if (!key) return;
  try { localStorage.removeItem(key); } catch {}
}

// ---------------------------------------------------------------------------
// Loading indicator
// ---------------------------------------------------------------------------

function GeneratingIndicator() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-5">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Wand2 className="w-7 h-7 text-primary animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">Generating descriptions…</p>
        <p className="text-xs text-muted-foreground">
          Creating platform-specific listings for eBay, Mercari &amp; Facebook
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Suggestions Section
// ---------------------------------------------------------------------------

function CategorySuggestions({ categories, onSelectCategory, platformLabel }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (categories && categories.length > 0) {
      const t = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [categories]);

  if (!categories || categories.length === 0) return null;

  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-500 ease-out',
        visible ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
      )}
    >
      <div className="mx-5 mb-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/2 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
            <FolderOpen className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">
            {platformLabel ? `${platformLabel} ` : ''}Suggested Categories
          </p>
          <span className="text-xs text-muted-foreground ml-1">— click to apply to General Form</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat, i) => {
            const parts = cat.split(' > ');
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectCategory && onSelectCategory(cat)}
                className={cn(
                  'group flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium',
                  'bg-background hover:bg-primary/10 hover:border-primary/40 border-border/60',
                  'transition-all duration-150 text-left'
                )}
              >
                {parts.map((part, pi) => (
                  <span key={pi} className="flex items-center gap-1">
                    {pi > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
                    <span className={pi === parts.length - 1 ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                      {part}
                    </span>
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DescriptionGenerator
// ---------------------------------------------------------------------------

export function DescriptionGenerator({
  open,
  onOpenChange,
  onSelectDescription,
  onApplyTags,       // optional: (tags: string[]) => void — saves tags to item
  onSelectCategory,  // optional: (categoryPath: string) => void — applies category
  marketplace = 'general',
  inputDescription = '',
  title,
  brand,
  category,
  condition,
  itemId,            // optional: unique item ID for caching
  similarDescriptions = [],
}) {
  const [phase, setPhase]             = useState('idle');
  const [result, setResult]           = useState(null);
  const [activeTab, setActiveTab]     = useState('ebay');
  const [editedTexts, setEditedTexts] = useState({});
  const [errorMsg, setErrorMsg]       = useState('');
  const [applyingTags, setApplyingTags] = useState(false);
  const { toast } = useToast();

  const cacheKey = getCacheKey(itemId, title);
  const lastOpenKey = useRef(null);

  const hasSeed  = typeof inputDescription === 'string' && inputDescription.trim().length > 0;
  const hasTitle = typeof title === 'string' && title.trim().length > 0;

  // Pick starting tab based on the caller's marketplace context
  useEffect(() => {
    if (!open) return;
    const ml = String(marketplace).toLowerCase();
    if (ml === 'ebay' || ml === 'mercari' || ml === 'facebook') {
      setActiveTab(ml);
    } else {
      setActiveTab('ebay');
    }
  }, [open, marketplace]);

  // On open: check cache first, only auto-generate if no cached data
  useEffect(() => {
    const openKey = `${open}:${cacheKey}`;
    if (open && lastOpenKey.current !== openKey) {
      lastOpenKey.current = openKey;

      const cached = readCache(cacheKey);
      if (cached && (cached.ebay || cached.mercari || cached.facebook)) {
        setResult(cached);
        setEditedTexts({
          ebay:     cached.ebay     || '',
          mercari:  cached.mercari  || '',
          facebook: cached.facebook || '',
          tags:     Array.isArray(cached.tags) ? cached.tags.join('\n') : '',
        });
        setPhase('done');
        setErrorMsg('');
      } else {
        setPhase('idle');
        setResult(null);
        setEditedTexts({});
        setErrorMsg('');
        runGeneration();
      }
    }
    if (!open) {
      lastOpenKey.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cacheKey]);

  const runGeneration = useCallback(async () => {
    if (!hasSeed && !hasTitle) {
      setErrorMsg('Add a title or description to generate suggestions.');
      setPhase('error');
      return;
    }

    setPhase('generating');
    try {
      const res = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputDescription: hasSeed ? inputDescription.trim() : undefined,
          title:     hasTitle ? title.trim() : undefined,
          brand:     brand    || undefined,
          category:  category || undefined,
          condition: condition || undefined,
          similarDescriptions: Array.isArray(similarDescriptions)
            ? similarDescriptions.filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (!data.ebay && !data.mercari && !data.facebook) {
        throw new Error('No descriptions returned. Please try again.');
      }

      // Cache the result
      writeCache(cacheKey, data);

      setResult(data);
      setEditedTexts({
        ebay:     data.ebay     || '',
        mercari:  data.mercari  || '',
        facebook: data.facebook || '',
        tags:     Array.isArray(data.tags) ? data.tags.join('\n') : '',
      });
      setPhase('done');
    } catch (err) {
      console.error('DescriptionGenerator error:', err);
      setErrorMsg(err.message || 'Generation failed.');
      setPhase('error');
    }
  }, [hasSeed, hasTitle, inputDescription, title, brand, category, condition, similarDescriptions, cacheKey]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function handleApply() {
    const value = activeTab === 'tags'
      ? editedTexts.tags?.trim()
      : editedTexts[activeTab]?.trim();
    if (!value) return;
    onSelectDescription(value, activeTab);
    onOpenChange(false);
    toast({
      title: 'Description applied',
      description: `Your ${PLATFORM_ICONS.find(p => p.key === activeTab)?.label || activeTab} description has been added to the form.`,
    });
  }

  async function handleApplyTags() {
    const tagsText = editedTexts.tags?.trim();
    if (!tagsText || !onApplyTags) return;
    const tagsArray = tagsText.split('\n').map(t => t.trim()).filter(Boolean);
    if (tagsArray.length === 0) return;
    setApplyingTags(true);
    try {
      await onApplyTags(tagsArray);
      toast({
        title: 'Tags applied',
        description: `${tagsArray.length} tags saved to this item.`,
      });
    } catch (err) {
      toast({ title: 'Failed to apply tags', description: err.message, variant: 'destructive' });
    } finally {
      setApplyingTags(false);
    }
  }

  function handleCopyTags() {
    const text = editedTexts.tags?.trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Tags copied', description: 'All tags copied to clipboard.' });
    }).catch(() => {});
  }

  function handleRegenerate() {
    clearCache(cacheKey);
    setPhase('idle');
    setResult(null);
    setEditedTexts({});
    setErrorMsg('');
    runGeneration();
  }

  function setTabText(key, value) {
    setEditedTexts(prev => ({ ...prev, [key]: value }));
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const isLoading = phase === 'generating';
  const isDone    = phase === 'done' && result;

  function charCount(key) {
    return (editedTexts[key] || '').length;
  }

  function charCountColor(key) {
    if (key === 'mercari') {
      const c = charCount('mercari');
      if (c < 700) return 'text-amber-500';
      if (c <= 1100) return 'text-green-600 dark:text-green-400';
      return 'text-red-500';
    }
    return 'text-muted-foreground';
  }

  const activePlatform = PLATFORM_ICONS.find(p => p.key === activeTab);
  const tagCount = result?.tags?.length || editedTexts.tags?.split('\n').filter(Boolean).length || 0;

  // Pick per-marketplace category suggestions based on the active tab.
  // New API returns ebaySuggestedCategories / mercariSuggestedCategories / facebookSuggestedCategories.
  // Fall back to the legacy single suggestedCategories array for cached results generated before this change.
  const activeCategories = (() => {
    if (!result || activeTab === 'tags') return [];
    const perPlatformKey = `${activeTab}SuggestedCategories`;
    const perPlatform = result[perPlatformKey];
    if (Array.isArray(perPlatform) && perPlatform.length > 0) return perPlatform;
    // Legacy fallback
    return Array.isArray(result.suggestedCategories) ? result.suggestedCategories : [];
  })();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-br from-primary/8 to-primary/3 border-b px-6 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              AI Description Generator
            </DialogTitle>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-xs text-muted-foreground">
                {hasSeed
                  ? 'Rewrote your description into platform-specific formats.'
                  : 'Generated platform-specific descriptions from your item details.'}
                {phase === 'done' && result?._ts === undefined && (
                  <span className="ml-1 text-primary/70">· from cache</span>
                )}
              </p>
              <Link
                to="/Settings/Fulfillment"
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Settings className="w-3 h-3" />
                Description settings
              </Link>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Loading */}
          {isLoading && <GeneratingIndicator />}

          {/* Error */}
          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
                <X className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Generation failed</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">{errorMsg}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleRegenerate} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                Try Again
              </Button>
            </div>
          )}

          {/* Done */}
          {isDone && (
            <div className="flex flex-col flex-1">

              {/* Platform icon tabs */}
              <div className="flex items-center gap-2 px-5 py-3 border-b shrink-0 bg-muted/10">
                {PLATFORM_ICONS.map(({ key, label, logo, bg, border, activeBg, activeBorder }) => {
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      title={label}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 rounded-xl border-2 transition-all duration-150',
                        'w-16 h-16 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive ? [activeBg, activeBorder, 'shadow-sm'] : [bg, border, 'opacity-70 hover:opacity-100']
                      )}
                    >
                      {key === 'tags' ? (
                        <>
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center',
                            isActive ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-muted'
                          )}>
                            <Tag className={cn('w-4 h-4', isActive ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground')} />
                          </div>
                          <span className={cn('text-[10px] font-semibold leading-tight', isActive ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground')}>
                            Tags
                            {tagCount > 0 && <span className="ml-0.5">({tagCount})</span>}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white dark:bg-zinc-700 flex items-center justify-center shadow-sm">
                            <img
                              src={logo}
                              alt={label}
                              className="w-full h-full object-contain p-0.5"
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          </div>
                          <span className={cn('text-[10px] font-semibold leading-tight', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                            {label}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Category suggestions — per-marketplace, updates when the tab changes */}
              {onSelectCategory && activeTab !== 'tags' && (
                <CategorySuggestions
                  categories={activeCategories}
                  platformLabel={activePlatform?.label}
                  onSelectCategory={(cat) => {
                    onSelectCategory(cat);
                    toast({ title: 'Category applied', description: cat });
                  }}
                />
              )}

              {/* Tab content */}
              <div className="flex-1 px-5 py-4 space-y-2 overflow-y-auto">
                {activeTab === 'tags' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        One tag per line — edit freely. Paste newline-separated tags to bulk-import.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        onClick={handleCopyTags}
                      >
                        <Copy className="w-3 h-3" />
                        Copy All
                      </Button>
                    </div>
                    <Textarea
                      value={editedTexts.tags || ''}
                      onChange={e => setTabText('tags', e.target.value)}
                      className="min-h-[280px] resize-none text-sm leading-relaxed font-mono rounded-xl"
                      placeholder="Tags will appear here…"
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Edit before applying — or use as-is
                      </p>
                      {activeTab === 'mercari' && (
                        <span className={cn('text-xs tabular-nums', charCountColor('mercari'))}>
                          {charCount('mercari').toLocaleString()} chars
                          {' '}{charCount('mercari') < 900 ? '(aim for 900–1,000)' : charCount('mercari') > 1100 ? '(slightly long)' : '✓'}
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={editedTexts[activeTab] || ''}
                      onChange={e => setTabText(activeTab, e.target.value)}
                      className="min-h-[300px] resize-none text-sm leading-relaxed rounded-xl"
                      placeholder={`${activePlatform?.label} description will appear here…`}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div className="shrink-0 border-t px-5 py-3.5 flex items-center justify-between gap-3 bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              className="gap-1.5"
              disabled={isLoading}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </Button>

            <div className="flex gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Cancel
              </Button>

              {/* Tags tab — copy + apply buttons */}
              {isDone && activeTab === 'tags' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyTags}
                    disabled={!editedTexts.tags?.trim()}
                    className="gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy All Tags
                  </Button>
                  {onApplyTags && (
                    <Button
                      size="sm"
                      onClick={handleApplyTags}
                      disabled={!editedTexts.tags?.trim() || applyingTags}
                      className="gap-1.5"
                    >
                      {applyingTags
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <BookmarkPlus className="w-3.5 h-3.5" />}
                      Apply Tags to Item
                    </Button>
                  )}
                </>
              )}

              {/* Description tabs — apply description button */}
              {isDone && activeTab !== 'tags' && (
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={!editedTexts[activeTab]?.trim()}
                  className="gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Use {activePlatform?.label} Description
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
