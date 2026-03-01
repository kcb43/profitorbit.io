import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Bookmark, ExternalLink, Loader2, Package,
  TrendingDown, X, Clock, ChevronDown, Filter, Copy, Check, Star, Wand2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase';
import { useToast } from '@/components/ui/use-toast';
import { usePreferences } from '@/lib/usePreferences';
import { DEAL_CATEGORIES, CATEGORY_MAP, DEFAULT_VISIBLE_CATEGORIES } from '@/lib/dealCategories';
import { cn } from '@/lib/utils';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

const SCORE_PRESETS = [
  { label: 'All Deals', value: 0 },
  { label: '50+ Great', value: 50 },
  { label: '70+ Hot', value: 70 },
  { label: '90+ Mega', value: 90 },
];

const DISCOUNT_FILTERS = [
  { label: 'All', value: 0 },
  { label: '10%+', value: 10 },
  { label: '25%+', value: 25 },
  { label: '50%+', value: 50 },
  { label: '70%+', value: 70 },
];

export default function Deals() {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [filters, setFilters] = useState({ merchant: '', minScore: 0 });
  const [minDiscount, setMinDiscount] = useState(0);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const { toast } = useToast();
  const loadMoreRef = useRef(null);
  const searchTimerRef = useRef(null);
  const sentinelRef = useRef(null);

  // ── Category Preferences ──────────────────────────────────────────────────
  const { prefs, updatePrefs, loading: prefsLoading } = usePreferences();
  const [visibleCategories, setVisibleCategories] = useState(null);

  useEffect(() => {
    if (!prefsLoading && visibleCategories === null) {
      const saved = prefs?.dealFeed?.visibleCategories;
      setVisibleCategories(
        Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_VISIBLE_CATEGORIES
      );
    }
  }, [prefsLoading, prefs, visibleCategories]);

  const toggleCategory = useCallback((key) => {
    setVisibleCategories((prev) => {
      if (!prev) return prev;
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      if (next.length === 0) return prev; // at least 1 must stay active
      updatePrefs({ dealFeed: { visibleCategories: next } });
      return next;
    });
  }, [updatePrefs]);

  const allCategoriesActive = visibleCategories?.length === DEAL_CATEGORIES.length;

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearchChange = useCallback((value) => {
    setInputValue(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchQuery(value), 400);
  }, []);

  const clearSearch = useCallback(() => {
    setInputValue('');
    setSearchQuery('');
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ merchant: '', minScore: 0 });
    setMinDiscount(0);
  }, []);

  const hasActiveFilters = filters.merchant || filters.minScore > 0 || minDiscount > 0;

  // ── Sticky observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // ── Sorted categories for stable query key ────────────────────────────────
  const sortedCategories = useMemo(
    () => (visibleCategories ? [...visibleCategories].sort() : null),
    [visibleCategories]
  );

  // ── Deal Feed Query ───────────────────────────────────────────────────────
  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading
  } = useInfiniteQuery({
    queryKey: ['deals', searchQuery, filters, sortedCategories],
    queryFn: async ({ pageParam = 0 }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const params = new URLSearchParams({
        ...(searchQuery && { q: searchQuery }),
        ...(filters.merchant && { merchant: filters.merchant }),
        ...(!allCategoriesActive && sortedCategories && { categories: sortedCategories.join(',') }),
        min_score: filters.minScore.toString(),
        limit: '20',
        offset: pageParam.toString()
      });
      const response = await fetch(`${ORBEN_API_URL}/v1/deals/feed?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(`Failed to fetch deals: ${response.status}`);
      return response.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.items || lastPage.items.length < 20) return undefined;
      return allPages.reduce((acc, page) => acc + (page.items?.length || 0), 0);
    },
    enabled: visibleCategories !== null,
    staleTime: 30_000,
    refetchInterval: 60_000
  });

  const rawDeals = data?.pages.flatMap((page) => page.items || []) || [];
  const total = data?.pages[0]?.total || 0;

  // Apply client-side discount filter
  const allDeals = useMemo(() => {
    if (minDiscount <= 0) return rawDeals;
    return rawDeals.filter((d) => {
      if (!d.original_price || !d.price || d.original_price <= d.price) return false;
      const pct = Math.round(((d.original_price - d.price) / d.original_price) * 100);
      return pct >= minDiscount;
    });
  }, [rawDeals, minDiscount]);

  const uniqueMerchants = useMemo(() => {
    const set = new Set(rawDeals.map((d) => d.merchant).filter(Boolean));
    return [...set].sort();
  }, [rawDeals]);

  const featuredDeal = useMemo(() => {
    return allDeals.find((d) => (d.score || 0) >= 90);
  }, [allDeals]);

  const regularDeals = useMemo(() => {
    if (!featuredDeal) return allDeals;
    return allDeals.filter((d) => d.id !== featuredDeal.id);
  }, [allDeals, featuredDeal]);

  // ── Infinite scroll observer ──────────────────────────────────────────────
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) fetchNextPage(); },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Saved Deals ───────────────────────────────────────────────────────────
  const { data: savedDeals, refetch: refetchSaved } = useQuery({
    queryKey: ['savedDeals'],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return { items: [] };
      const response = await fetch(`${ORBEN_API_URL}/v1/deals/saved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch saved deals');
      return response.json();
    }
  });

  const savedDealIds = new Set(savedDeals?.items?.map((d) => d.id) || []);

  const handleSaveDeal = async (dealId, isSaved) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      toast({ title: 'Please log in to save deals', variant: 'destructive' });
      return;
    }
    try {
      const method = isSaved ? 'DELETE' : 'POST';
      const response = await fetch(`${ORBEN_API_URL}/v1/deals/${dealId}/save`, {
        method,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to save deal');
      toast({ title: isSaved ? 'Deal removed from watchlist' : 'Deal saved to watchlist' });
      refetchSaved();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const activeFilterCount = [filters.merchant, filters.minScore > 0, minDiscount > 0].filter(Boolean).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-2 sm:p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />

      {/* Sticky Search Bar */}
      <div className={cn(
        "sticky top-0 z-40 -mx-2 sm:-mx-4 md:-mx-6 lg:-mx-8 px-2 sm:px-4 md:px-6 lg:px-8 py-3 mb-4 transition-all duration-300",
        isSticky ? "bg-background/80 backdrop-blur-xl border-b border-border/60 shadow-sm" : "bg-transparent"
      )}>
        <div className="max-w-7xl mx-auto">
          <div className="relative flex items-center">
            <div className={cn(
              "absolute left-3 flex items-center pointer-events-none transition-all duration-200",
              isSearchFocused ? "text-emerald-500 scale-110" : "text-muted-foreground"
            )}>
              {isLoading && searchQuery ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </div>
            <Input
              value={inputValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search deals by title, merchant, or keyword..."
              className={cn(
                "pl-9 pr-10 h-11 rounded-xl border-2 transition-all duration-200 bg-card/60 text-sm",
                isSearchFocused
                  ? "border-emerald-500/60 shadow-[0_0_0_3px_rgba(16,185,129,0.12)] bg-card"
                  : "border-border/50 hover:border-border"
              )}
            />
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              className={cn(
                "absolute right-3 flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200",
                inputValue ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-1.5 px-1">
              {isLoading ? "Searching..." : `${allDeals.length} deal${allDeals.length !== 1 ? 's' : ''} found`}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              Deal Feed
              <Badge variant="secondary" className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                </span>
                Live
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
              Curated deals from Amazon, retail stores, and top deal sources
              <span className="hidden sm:flex items-center gap-1.5 text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{total} active</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">{savedDeals?.items?.length || 0} saved</span>
              </span>
            </p>
          </div>
        </div>

        {/* ── Category Chips ──────────────────────────────────────────────── */}
        <div className="mt-8 mb-8 px-3">
          <CategoryChips
            visible={visibleCategories || DEFAULT_VISIBLE_CATEGORIES}
            onToggle={toggleCategory}
          />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 mb-5 p-2.5 rounded-xl bg-card/60 border border-border/50">
          <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />

          <FilterDropdown
            label="Merchant"
            value={filters.merchant}
            options={uniqueMerchants}
            open={merchantOpen}
            onOpenChange={setMerchantOpen}
            onChange={(v) => setFilters((f) => ({ ...f, merchant: v }))}
          />

          {/* Score dropdown */}
          <div className="relative">
            <button
              onClick={() => setScoreOpen(!scoreOpen)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                filters.minScore > 0
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30"
              )}
            >
              <Star className="w-3 h-3" />
              {filters.minScore > 0 ? `${filters.minScore}+` : 'Min Score'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {scoreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setScoreOpen(false)} />
                <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
                  {SCORE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => { setFilters((f) => ({ ...f, minScore: p.value })); setScoreOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors",
                        filters.minScore === p.value && "bg-muted font-medium"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Discount % filter chips */}
          <div className="hidden sm:block w-px h-5 bg-border/60" />
          <div className="flex items-center gap-1">
            {DISCOUNT_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setMinDiscount(f.value)}
                className={cn(
                  "px-2 py-1 rounded-full text-[11px] font-semibold border transition-all",
                  minDiscount === f.value
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              Clear{activeFilterCount > 1 ? ` (${activeFilterCount})` : ''}
            </button>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full" onValueChange={(v) => v === 'saved' && refetchSaved()}>
          <TabsList className="mb-5">
            <TabsTrigger value="all" className="flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" />
              All Deals
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5" />
              Saved ({savedDeals?.items?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {isLoading || visibleCategories === null ? (
              <LoadingSkeleton />
            ) : allDeals.length === 0 ? (
              <EmptyDealState searchQuery={searchQuery} onClearSearch={clearSearch} />
            ) : (
              <div className="space-y-3">
                {/* Featured MEGA Deal hero */}
                {featuredDeal && !searchQuery && !hasActiveFilters && (
                  <FeaturedDealCard
                    deal={featuredDeal}
                    isSaved={savedDealIds.has(featuredDeal.id)}
                    onSave={() => handleSaveDeal(featuredDeal.id, savedDealIds.has(featuredDeal.id))}
                  />
                )}
                {/* Deal list */}
                {regularDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    isSaved={savedDealIds.has(deal.id)}
                    onSave={() => handleSaveDeal(deal.id, savedDealIds.has(deal.id))}
                  />
                ))}
              </div>
            )}

            {hasNextPage && (
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {isFetchingNextPage ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading more deals...
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => fetchNextPage()}>Load More Deals</Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved">
            {!savedDeals || savedDeals.items?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mb-4">
                  <Bookmark className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Saved Deals</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Bookmark deals to track them here. Click the bookmark icon on any deal card.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedDeals.items.map((deal) => (
                  <DealCard key={deal.id} deal={deal} isSaved={true} onSave={() => handleSaveDeal(deal.id, true)} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Category Chips ──────────────────────────────────────────────────────────

function CategoryChips({ visible, onToggle }) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto pt-1 pb-2 px-1 scrollbar-hide">
      {DEAL_CATEGORIES.map((cat) => {
        const active = visible.includes(cat.key);
        const Icon = cat.icon;
        return (
          <button
            key={cat.key}
            onClick={() => onToggle(cat.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold border transition-all whitespace-nowrap flex-shrink-0",
              active
                ? `${cat.bgChip} ${cat.textColor} border-transparent ring-2 ${cat.ringColor} shadow-sm`
                : "bg-muted/40 text-muted-foreground border-border/50 opacity-50 hover:opacity-75"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Filter Dropdown ─────────────────────────────────────────────────────────

function FilterDropdown({ label, value, options, open, onOpenChange, onChange }) {
  const [search, setSearch] = useState('');
  const filtered = search ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase())) : options;

  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
          value
            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
            : "bg-background text-muted-foreground border-border hover:border-foreground/30"
        )}
      >
        {value || label}
        {value ? (
          <X className="w-3 h-3 hover:text-foreground" onClick={(e) => { e.stopPropagation(); onChange(''); }} />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { onOpenChange(false); setSearch(''); }} />
          <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 w-52 max-h-64 overflow-hidden flex flex-col">
            <div className="p-2 border-b">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto py-1">
              <button
                onClick={() => { onChange(''); onOpenChange(false); setSearch(''); }}
                className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors", !value && "bg-muted font-medium")}
              >
                All {label}s
              </button>
              {filtered.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); onOpenChange(false); setSearch(''); }}
                  className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors", value === opt && "bg-muted font-medium")}
                >
                  {opt}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Featured Deal Hero Card ─────────────────────────────────────────────────

function FeaturedDealCard({ deal, isSaved, onSave }) {
  const discount = deal.original_price && deal.price
    ? Math.round(((deal.original_price - deal.price) / deal.original_price) * 100) : 0;

  const catConfig = CATEGORY_MAP[deal.category];

  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-red-500/30 bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-amber-950/20 mb-4">
      {/* MEGA DEAL banner */}
      <div className="bg-gradient-to-r from-red-600 to-orange-500 px-4 py-1.5 flex items-center gap-2">
        <span className="text-white text-xs font-bold tracking-wider uppercase animate-pulse">MEGA DEAL</span>
        <span className="text-white/70 text-xs">Score: {deal.score}</span>
        {catConfig && (
          <span className="ml-auto text-white/80 text-[10px] font-medium flex items-center gap-1">
            <catConfig.icon className="w-3 h-3" />
            {catConfig.label}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
        {/* Image */}
        <div className="w-full sm:w-40 h-40 sm:h-40 rounded-xl bg-white dark:bg-card overflow-hidden flex-shrink-0">
          <img
            src={deal.image_url || '/default-deal-image.png'}
            alt={deal.title}
            className="w-full h-full object-contain"
            onError={(e) => { e.target.src = '/default-deal-image.png'; }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base sm:text-lg leading-snug line-clamp-2 mb-2">{deal.title}</h3>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {deal.merchant && (
              <Badge className="bg-white/80 dark:bg-card text-foreground border text-xs">{deal.merchant}</Badge>
            )}
            {catConfig && (
              <Badge className={cn("text-xs border-0", catConfig.bgChip, catConfig.textColor)}>
                <catConfig.icon className="w-3 h-3 mr-1" />
                {catConfig.label}
              </Badge>
            )}
            {deal.curated && (
              <Badge className="text-xs border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <Wand2 className="w-3 h-3 mr-1" />
                Curated
              </Badge>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            {deal.price ? (
              <>
                <span className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  ${deal.price.toFixed(2)}
                </span>
                {deal.original_price && deal.original_price > deal.price && (
                  <>
                    <span className="text-base text-muted-foreground line-through">${deal.original_price.toFixed(2)}</span>
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0 text-xs font-bold">
                      -{discount}%
                    </Badge>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      Save ${(deal.original_price - deal.price).toFixed(2)}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">See deal for price</span>
            )}
          </div>

          {deal.coupon_code && <CouponCode code={deal.coupon_code} />}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => window.open(deal.url, '_blank')}
              className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg shadow-red-500/20"
            >
              View Deal <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={isSaved ? 'default' : 'outline'} onClick={onSave} className="px-2.5">
              <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Deal Card (List View) ───────────────────────────────────────────────────

function DealCard({ deal, isSaved, onSave }) {
  const [timeAgo, setTimeAgo] = React.useState('');

  const discount = deal.original_price && deal.price
    ? Math.round(((deal.original_price - deal.price) / deal.original_price) * 100) : 0;

  React.useEffect(() => {
    const update = () => {
      if (!deal.posted_at) return;
      const diffMs = Date.now() - new Date(deal.posted_at).getTime();
      const mins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMs / 3600000);
      const days = Math.floor(diffMs / 86400000);
      setTimeAgo(
        mins < 1 ? 'Just now' :
        mins < 60 ? `${mins}m` :
        hours < 24 ? `${hours}h` :
        days < 7 ? `${days}d` :
        new Date(deal.posted_at).toLocaleDateString()
      );
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [deal.posted_at]);

  const score = deal.score || 0;
  const dealTier = score >= 90 ? 'mega' : score >= 70 ? 'hot' : score >= 50 ? 'great' : null;

  const tierConfig = {
    mega:  { label: 'MEGA',  gradient: 'from-red-500 to-orange-500', text: 'text-white' },
    hot:   { label: 'HOT',   gradient: 'from-orange-500 to-amber-500', text: 'text-white' },
    great: { label: 'GREAT', gradient: 'from-emerald-500 to-teal-500', text: 'text-white' },
  };

  const tier = dealTier ? tierConfig[dealTier] : null;
  const catConfig = CATEGORY_MAP[deal.category];

  const discountColor = discount >= 70
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : discount >= 50
    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    : discount >= 25
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';

  return (
    <div className={cn(
      "group rounded-xl border bg-card hover:shadow-lg transition-all duration-200 overflow-hidden border-l-4",
      catConfig ? catConfig.borderColor : "border-l-border",
      deal.curated && "ring-2 ring-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10"
    )}>
      <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
        {/* Image */}
        <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl bg-muted flex-shrink-0 overflow-hidden relative">
          <img
            src={deal.image_url || '/default-deal-image.png'}
            alt={deal.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = '/default-deal-image.png'; }}
          />
          {tier && (
            <div className={cn("absolute bottom-0 inset-x-0 py-0.5 text-center text-[9px] sm:text-[10px] font-bold tracking-wider bg-gradient-to-r", tier.gradient, tier.text)}>
              {tier.label}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-semibold text-sm sm:text-base leading-snug line-clamp-2 flex-1">{deal.title}</h4>
            <button
              onClick={onSave}
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                isSaved
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
            </button>
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {catConfig && (
              <span className={cn("text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1", catConfig.bgChip, catConfig.textColor)}>
                <catConfig.icon className="w-3 h-3" />
                {catConfig.label}
              </span>
            )}
            {deal.curated && (
              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <Wand2 className="w-3 h-3" />
                Curated
              </span>
            )}
            {deal.merchant && (
              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-md bg-muted font-medium">{deal.merchant}</span>
            )}
            {score > 0 && (
              <span className={cn(
                "text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-medium",
                score >= 70 ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" :
                score >= 50 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" :
                "bg-muted text-muted-foreground"
              )}>
                {score} pts
              </span>
            )}
          </div>

          {/* Price row */}
          <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap mb-1.5">
            {deal.price ? (
              <>
                <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  ${deal.price.toFixed(2)}
                </span>
                {deal.original_price && deal.original_price > deal.price && (
                  <>
                    <span className="text-xs sm:text-sm text-muted-foreground line-through">
                      ${deal.original_price.toFixed(2)}
                    </span>
                    <Badge className={cn("text-[10px] sm:text-xs font-bold border-0", discountColor)}>
                      -{discount}%
                    </Badge>
                  </>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">See deal for price</span>
            )}
          </div>

          {deal.original_price && deal.price && deal.original_price > deal.price && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1.5">
              You save ${(deal.original_price - deal.price).toFixed(2)}
            </p>
          )}

          {deal.coupon_code && <CouponCode code={deal.coupon_code} />}

          {/* Footer: actions + time */}
          <div className="flex items-center gap-2 mt-auto pt-1">
            <Button
              size="sm"
              onClick={() => window.open(deal.url, '_blank')}
              className="h-8 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm"
            >
              View Deal <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
            {deal.source && (
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">
                via {deal.source}
              </span>
            )}
            {timeAgo && (
              <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {timeAgo}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Coupon Code ─────────────────────────────────────────────────────────────

function CouponCode({ code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/40 transition-colors mb-1.5"
    >
      <code className="font-mono font-bold">{code}</code>
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4 border rounded-xl p-4 border-l-4 border-l-muted">
          <Skeleton className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────

function EmptyDealState({ searchQuery, onClearSearch }) {
  if (searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No deals match "{searchQuery}"</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          Try a different keyword, merchant, or category.
        </p>
        <Button onClick={onClearSearch} variant="outline" size="sm">
          <X className="w-3.5 h-3.5 mr-1.5" /> Clear Search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
        <Package className="h-8 w-8 text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No deals found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Check back soon for new deals from Amazon, retail stores, and top deal sources.
      </p>
    </div>
  );
}
