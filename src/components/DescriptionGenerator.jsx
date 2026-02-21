/**
 * DescriptionGenerator
 *
 * Generates full-length, platform-specific marketplace descriptions
 * (eBay, Mercari, Facebook) and search tags — all in one AI call.
 *
 * The user picks which platform description to apply to their form.
 * All descriptions are editable before applying.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Platform tab config
// ---------------------------------------------------------------------------

const PLATFORMS = [
  { key: 'ebay',     label: 'eBay',      color: 'bg-blue-500' },
  { key: 'mercari',  label: 'Mercari',   color: 'bg-red-500' },
  { key: 'facebook', label: 'Facebook',  color: 'bg-[#1877F2]' },
  { key: 'tags',     label: 'Tags',      color: 'bg-purple-500' },
];

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
// DescriptionGenerator
// ---------------------------------------------------------------------------

export function DescriptionGenerator({
  open,
  onOpenChange,
  onSelectDescription,
  marketplace = 'general',
  inputDescription = '',
  title,
  brand,
  category,
  condition,
  similarDescriptions = [],
}) {
  // 'idle' | 'generating' | 'done' | 'error'
  const [phase, setPhase]             = useState('idle');
  const [result, setResult]           = useState(null);   // { ebay, mercari, facebook, tags }
  const [activeTab, setActiveTab]     = useState('ebay');
  const [editedTexts, setEditedTexts] = useState({});     // { ebay: '...', mercari: '...', ... }
  const [errorMsg, setErrorMsg]       = useState('');
  const { toast } = useToast();

  const lastGeneratedFor = useRef(null);

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

  // Auto-trigger on open
  useEffect(() => {
    if (open && lastGeneratedFor.current !== open) {
      lastGeneratedFor.current = open;
      setPhase('idle');
      setResult(null);
      setEditedTexts({});
      setErrorMsg('');
      runGeneration();
    }
    if (!open) {
      lastGeneratedFor.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

      // Require at least one platform description
      if (!data.ebay && !data.mercari && !data.facebook) {
        throw new Error('No descriptions returned. Please try again.');
      }

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
  }, [hasSeed, hasTitle, inputDescription, title, brand, category, condition, similarDescriptions]);

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
      description: `Your ${PLATFORMS.find(p => p.key === activeTab)?.label || activeTab} description has been added to the form.`,
    });
  }

  function handleCopyTags() {
    const text = editedTexts.tags?.trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Tags copied', description: 'All tags copied to clipboard.' });
    }).catch(() => {});
  }

  function handleRegenerate() {
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
  // Render
  // ---------------------------------------------------------------------------

  const isLoading = phase === 'generating';
  const isDone    = phase === 'done' && result;

  // Character count helpers
  function charCount(key) {
    const text = editedTexts[key] || '';
    return text.length;
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
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasSeed
                ? 'Rewrote your description into platform-specific formats ready to use.'
                : 'Generated platform-specific descriptions from your item details.'}
            </p>
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
              {/* Platform tabs */}
              <div className="flex border-b shrink-0">
                {PLATFORMS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      'flex-1 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px',
                      activeTab === key
                        ? 'border-primary text-primary bg-primary/5'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    )}
                  >
                    {key === 'tags' ? (
                      <span className="flex items-center justify-center gap-1">
                        <Tag className="w-3 h-3" />
                        {label}
                        {result.tags?.length > 0 && (
                          <span className="ml-1 text-[10px] text-muted-foreground">({result.tags.length})</span>
                        )}
                      </span>
                    ) : (
                      label
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 px-5 py-4 space-y-2 overflow-y-auto">
                {activeTab === 'tags' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        One tag per line — edit freely before copying
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        onClick={handleCopyTags}
                      >
                        <Copy className="w-3 h-3" />
                        Copy All Tags
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
                      placeholder={`${PLATFORMS.find(p => p.key === activeTab)?.label} description will appear here…`}
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Cancel
              </Button>

              {isDone && activeTab !== 'tags' && (
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={!editedTexts[activeTab]?.trim()}
                  className="gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Use {PLATFORMS.find(p => p.key === activeTab)?.label} Description
                </Button>
              )}

              {isDone && activeTab === 'tags' && (
                <Button
                  size="sm"
                  onClick={handleCopyTags}
                  disabled={!editedTexts.tags?.trim()}
                  className="gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy All Tags
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
