/**
 * DescriptionGenerator
 *
 * Two-mode AI description assistant:
 *   - Rewrite mode  (inputDescription exists) → improve & tailor to marketplace
 *   - Generate mode (no description, title only) → scrape similar products for
 *     context, then generate from scratch
 *
 * Auto-starts when the dialog opens. No manual "Generate" click required.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  RefreshCw,
  Check,
  X,
  Loader2,
  Search,
  Wand2,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function marketplaceLabel(marketplace) {
  const labels = {
    ebay: "eBay",
    facebook: "Facebook Marketplace",
    mercari: "Mercari",
    etsy: "Etsy",
    poshmark: "Poshmark",
    general: "General",
  };
  return labels[String(marketplace).toLowerCase()] || marketplace;
}

// ---------------------------------------------------------------------------
// Phase progress indicator
// ---------------------------------------------------------------------------
function PhaseIndicator({ phase }) {
  const steps = [
    { key: "searching", icon: Search,   label: "Searching similar products…" },
    { key: "generating", icon: Wand2,   label: "Generating descriptions…" },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-10 gap-5">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        <div className="relative w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        {steps.map(({ key, icon: Icon, label }) => {
          const isActive  = phase === key;
          const isDone    = phase === "generating" && key === "searching";
          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-2 text-sm transition-all",
                isActive && "text-primary font-medium",
                isDone   && "text-muted-foreground line-through",
                !isActive && !isDone && "text-muted-foreground/40"
              )}
            >
              {isDone ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Icon className={cn("w-4 h-4", isActive && "animate-pulse")} />
              )}
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Simplified single-phase loading (rewrite mode)
function RewriteIndicator() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        <div className="relative w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Wand2 className="w-6 h-6 text-primary animate-pulse" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Generating improved descriptions…</p>
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
  marketplace = "general",
  inputDescription = "",
  title,
  brand,
  category,
  condition,
  similarDescriptions = [],
}) {
  // 'idle' | 'searching' | 'generating' | 'done' | 'error'
  const [phase, setPhase]                 = useState("idle");
  const [descriptions, setDescriptions]   = useState([]);
  const [currentIndex, setCurrentIndex]   = useState(0);
  const [editedText, setEditedText]       = useState("");
  const [scrapedCount, setScrapedCount]   = useState(0);
  const [errorMsg, setErrorMsg]           = useState("");
  const { toast } = useToast();

  // Track the open value we last triggered generation for, to avoid
  // triggering twice on StrictMode double-renders
  const lastGeneratedFor = useRef(null);

  const hasSeed  = typeof inputDescription === "string" && inputDescription.trim().length > 0;
  const hasTitle = typeof title === "string" && title.trim().length > 0;
  const mode     = hasSeed ? "rewrite" : "generate";

  // Auto-trigger on open
  useEffect(() => {
    if (open && lastGeneratedFor.current !== open) {
      lastGeneratedFor.current = open;
      // Reset state from any previous session
      setPhase("idle");
      setDescriptions([]);
      setCurrentIndex(0);
      setEditedText("");
      setScrapedCount(0);
      setErrorMsg("");
      runGeneration();
    }
    if (!open) {
      lastGeneratedFor.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runGeneration = useCallback(async () => {
    if (!hasSeed && !hasTitle) {
      setErrorMsg("Add a title or description to generate suggestions.");
      setPhase("error");
      return;
    }

    let contextTitles = [...(Array.isArray(similarDescriptions) ? similarDescriptions : [])];

    // Generate mode: query the product scraper for similar product titles
    if (!hasSeed && hasTitle) {
      setPhase("searching");
      try {
        const searchRes = await fetch("/api/product-search/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: title.trim(),
            filters: { maxResults: 12 },
            useCache: true,
          }),
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const scraped = (searchData.products || [])
            .slice(0, 8)
            .map((p) => p.title)
            .filter(Boolean);
          contextTitles = [...contextTitles, ...scraped];
          setScrapedCount(scraped.length);
        }
      } catch {
        // Non-fatal — continue without scraper context
      }
    }

    setPhase("generating");
    try {
      const res = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketplace,
          inputDescription: hasSeed ? inputDescription.trim() : undefined,
          title:      hasTitle ? title.trim() : undefined,
          brand:      brand    || undefined,
          category:   category || undefined,
          condition:  condition || undefined,
          similarDescriptions: contextTitles.filter(Boolean),
          numVariations: 5,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.descriptions?.length) throw new Error("No descriptions returned.");

      setDescriptions(data.descriptions);
      setCurrentIndex(0);
      setEditedText(data.descriptions[0] || "");
      setPhase("done");
    } catch (err) {
      console.error("DescriptionGenerator error:", err);
      setErrorMsg(err.message || "Generation failed.");
      setPhase("error");
    }
  }, [hasSeed, hasTitle, inputDescription, title, brand, category, condition, marketplace, similarDescriptions]);

  // Keep editedText in sync when the user switches variants
  useEffect(() => {
    if (descriptions[currentIndex] !== undefined) {
      setEditedText(descriptions[currentIndex]);
    }
  }, [currentIndex, descriptions]);

  function handleSelectVariant(i) {
    setCurrentIndex(i);
  }

  function handleApply() {
    const value = editedText.trim();
    if (!value) return;
    onSelectDescription(value);
    onOpenChange(false);
    toast({
      title: "Description applied",
      description: "Your description has been added to the form.",
    });
  }

  function handleRegenerate() {
    setPhase("idle");
    setDescriptions([]);
    setCurrentIndex(0);
    setEditedText("");
    setScrapedCount(0);
    setErrorMsg("");
    runGeneration();
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderSourceBadge() {
    if (mode === "rewrite") {
      return (
        <Badge variant="secondary" className="gap-1 text-[11px]">
          <FileText className="w-3 h-3" />
          Rewritten from your description
        </Badge>
      );
    }
    if (scrapedCount > 0) {
      return (
        <Badge variant="secondary" className="gap-1 text-[11px]">
          <Search className="w-3 h-3" />
          Generated from title + {scrapedCount} similar products
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1 text-[11px]">
        <Sparkles className="w-3 h-3" />
        Generated from title
      </Badge>
    );
  }

  function renderPillTabs() {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {descriptions.map((_, i) => (
          <button
            key={i}
            onClick={() => handleSelectVariant(i)}
            className={cn(
              "w-8 h-8 rounded-full text-xs font-semibold transition-all border",
              i === currentIndex
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
    );
  }

  const isLoading = phase === "searching" || phase === "generating";

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
              Description Suggestions
              <Badge variant="outline" className="ml-1 text-[11px] font-normal">
                {marketplaceLabel(marketplace)}
              </Badge>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === "rewrite"
                ? "Improved variations of your existing description, tailored for this marketplace."
                : "AI-generated descriptions based on your product title and similar items."}
            </p>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Loading states */}
          {isLoading && (mode === "generate"
            ? <PhaseIndicator phase={phase} />
            : <RewriteIndicator />
          )}

          {/* Error state */}
          {phase === "error" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
                <X className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  Generation failed
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">{errorMsg}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleRegenerate} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                Try Again
              </Button>
            </div>
          )}

          {/* Done state */}
          {phase === "done" && descriptions.length > 0 && (
            <div className="space-y-4">
              {/* Original description (rewrite mode only) */}
              {mode === "rewrite" && inputDescription.trim() && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Original
                  </p>
                  <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">
                    {inputDescription.trim()}
                  </div>
                </div>
              )}

              {/* Variant picker + source badge */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Variation
                  </p>
                  {renderPillTabs()}
                </div>
                {renderSourceBadge()}
              </div>

              {/* Editable description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Selected — edit before applying
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={descriptions.length <= 1}
                      onClick={() => setCurrentIndex((i) => (i - 1 + descriptions.length) % descriptions.length)}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
                      {currentIndex + 1} / {descriptions.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={descriptions.length <= 1}
                      onClick={() => setCurrentIndex((i) => (i + 1) % descriptions.length)}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="min-h-[160px] resize-none text-sm leading-relaxed rounded-xl"
                  placeholder="Edit the description before applying…"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div className="shrink-0 border-t px-6 py-4 flex items-center justify-between gap-3 bg-muted/20">
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
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!editedText.trim() || phase !== "done"}
                className="gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Use This Description
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
