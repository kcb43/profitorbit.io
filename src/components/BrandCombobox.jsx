/**
 * BrandCombobox
 *
 * Searchable brand picker backed by the full Mercari brand list.
 * Optionally shows AI-generated brand suggestions based on the item title
 * (only on add pages, not edit pages).
 *
 * Props:
 *   value              - current brand string
 *   onChange           - (brand: string) => void
 *   showAISuggestions  - whether to show AI suggestions (true = add mode)
 *   itemTitle          - item title used to generate AI suggestions
 *   itemCategory       - optional category hint for better suggestions
 *   className          - extra wrapper className
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { MERCARI_BRANDS, POPULAR_BRANDS } from "@/constants/mercari-brands";
import { useCustomSources } from "@/hooks/useCustomSources";
import { Sparkles, ChevronDown } from "lucide-react";

export function BrandCombobox({
  value = '',
  onChange,
  showAISuggestions = false,
  itemTitle = '',
  itemCategory = '',
  className = '',
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');

  const { customSources: primaryBrands, addCustomSource: addCustomBrand } =
    useCustomSources('orben_custom_brands');

  // Also read from CrosslistComposer's legacy 'customBrands' key so brands saved
  // there appear here too (read-only merge — writes still go to orben_custom_brands).
  const [legacyBrands] = useState(() => {
    try { return JSON.parse(localStorage.getItem('customBrands') || '[]'); } catch { return []; }
  });

  const customBrands = React.useMemo(() => {
    const seen = new Set(primaryBrands.map(b => b.toLowerCase()));
    return [...primaryBrands, ...legacyBrands.filter(b => !seen.has(b.toLowerCase()))];
  }, [primaryBrands, legacyBrands]);

  // ── AI suggestions ─────────────────────────────────────────────────────────
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading]         = useState(false);
  const abortRef   = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!showAISuggestions || !itemTitle || itemTitle.trim().length < 4) {
      setAiSuggestions([]);
      setAiLoading(false);
      return;
    }

    clearTimeout(debounceRef.current);
    setAiLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        const res = await fetch('/api/ai/suggest-brands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: itemTitle.trim(),
            category: itemCategory || undefined,
          }),
          signal: abortRef.current.signal,
        });

        if (res.ok) {
          const data = await res.json();
          setAiSuggestions(Array.isArray(data.brands) ? data.brands : []);
        } else {
          setAiSuggestions([]);
        }
      } catch (err) {
        if (err.name !== 'AbortError') setAiSuggestions([]);
      } finally {
        setAiLoading(false);
      }
    }, 900);

    return () => clearTimeout(debounceRef.current);
  }, [itemTitle, itemCategory, showAISuggestions]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelect = useCallback((brand) => {
    onChange(brand === value ? '' : brand);
    setOpen(false);
    setSearch('');
  }, [value, onChange]);

  const handleAddCustom = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addCustomBrand(trimmed);
    onChange(trimmed);
    setOpen(false);
    setSearch('');
  }, [addCustomBrand, onChange]);

  // ── Derived ────────────────────────────────────────────────────────────────
  // Only show AI suggestions that aren't the currently selected brand
  const visibleSuggestions = aiSuggestions.filter(b => b !== value);
  const showSuggestionPanel = showAISuggestions && (aiLoading || visibleSuggestions.length > 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={className}>
      {/* ── Combobox trigger ────────────────────────────────────────────── */}
      <Popover
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}
        modal
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal bg-background text-foreground border-border hover:bg-background"
          >
            <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
              {value || 'Search brand…'}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search brand…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-64">
              <CommandEmpty>
                <div className="px-3 py-2 text-sm text-muted-foreground">No brand found.</div>
                {search.trim() && (
                  <div className="px-3 pb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAddCustom(search)}
                    >
                      + Use "{search.trim()}" as custom brand
                    </Button>
                  </div>
                )}
              </CommandEmpty>

              {/* Popular brands — shown when no search active */}
              {!search && (
                <CommandGroup heading="Popular Brands">
                  {POPULAR_BRANDS.map(brand => (
                    <CommandItem
                      key={brand}
                      value={brand}
                      onSelect={() => handleSelect(brand)}
                    >
                      <span className={value === brand ? 'font-semibold text-primary' : ''}>{brand}</span>
                      {value === brand && <span className="ml-auto text-primary text-xs">✓</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Full Mercari brand list, filtered by search (max 80 results) */}
              {search && (
                <CommandGroup heading="Brands">
                  {MERCARI_BRANDS
                    .filter(b => b.toLowerCase().includes(search.toLowerCase()))
                    .slice(0, 80)
                    .map(brand => (
                      <CommandItem
                        key={brand}
                        value={brand}
                        onSelect={() => handleSelect(brand)}
                      >
                        <span className={value === brand ? 'font-semibold text-primary' : ''}>{brand}</span>
                        {value === brand && <span className="ml-auto text-primary text-xs">✓</span>}
                      </CommandItem>
                    ))
                  }
                </CommandGroup>
              )}

              {/* Saved custom brands */}
              {customBrands.filter(b => !search || b.toLowerCase().includes(search.toLowerCase())).length > 0 && (
                <CommandGroup heading="My Custom Brands">
                  {customBrands
                    .filter(b => !search || b.toLowerCase().includes(search.toLowerCase()))
                    .map(brand => (
                      <CommandItem
                        key={brand}
                        value={brand}
                        onSelect={() => handleSelect(brand)}
                      >
                        <span className="text-xs mr-1 opacity-60">✦</span>
                        <span className={value === brand ? 'font-semibold text-primary' : ''}>{brand}</span>
                        {value === brand && <span className="ml-auto text-primary text-xs">✓</span>}
                      </CommandItem>
                    ))
                  }
                </CommandGroup>
              )}

              {/* Add custom brand option — shown at bottom while searching */}
              {search.trim() &&
                !MERCARI_BRANDS.some(b => b.toLowerCase() === search.toLowerCase()) &&
                !customBrands.some(b => b.toLowerCase() === search.toLowerCase()) && (
                <CommandGroup>
                  <CommandItem
                    value={`__add__${search}`}
                    onSelect={() => handleAddCustom(search)}
                  >
                    <span className="text-muted-foreground">
                      + Add "<strong>{search.trim()}</strong>" as custom brand
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Clear link */}
      {value && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline mt-1 block"
          onClick={() => onChange('')}
        >
          Clear brand
        </button>
      )}

      {/* ── AI brand suggestions panel ───────────────────────────────────── */}
      {showSuggestionPanel && (
        <div className="mt-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2.5">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-violet-300">AI Brand Suggestions</span>
            {aiLoading && (
              <span className="ml-auto text-[10px] text-violet-400/70 animate-pulse tracking-wide">
                analyzing title…
              </span>
            )}
          </div>

          {/* Skeleton chips while loading */}
          {aiLoading && visibleSuggestions.length === 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {[72, 56, 88].map(w => (
                <div
                  key={w}
                  className="h-6 rounded-full bg-violet-500/20 animate-pulse"
                  style={{ width: w }}
                />
              ))}
            </div>
          )}

          {/* Suggestion chips */}
          {visibleSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleSuggestions.map(brand => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => onChange(brand)}
                  className={[
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                    'bg-gradient-to-r from-violet-500/25 to-indigo-500/25',
                    'border border-violet-500/40 text-violet-100',
                    'hover:from-violet-500/40 hover:to-indigo-500/40',
                    'hover:border-violet-400/70 hover:text-white',
                    'transition-all duration-150 cursor-pointer',
                  ].join(' ')}
                >
                  {brand}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
