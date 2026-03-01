/**
 * DealCurator - Admin page for curating Amazon deals
 * Protected by AdminGuard. Searches Amazon Today's Deals via SerpAPI,
 * displays them in a browsable feed, and lets admin publish selected deals.
 * Also supports direct product lookup by URL/ASIN.
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Loader2, ExternalLink, Star, Package, Check, CheckCircle2,
  ShoppingCart, Clock, AlertCircle, Wand2, ChevronDown,
  Link2, X, Percent, Flame, RefreshCw, ArrowUpDown, Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { DEAL_CATEGORIES } from '@/lib/dealCategories';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

const SORT_OPTIONS = [
  { value: '', label: 'Relevance' },
  { value: 'price-asc-rank', label: 'Price: Low to High' },
  { value: 'price-desc-rank', label: 'Price: High to Low' },
  { value: 'review-rank', label: 'Top Reviews' },
  { value: 'date-desc-rank', label: 'Newest' },
];

const DISCOUNT_FILTERS = [
  { label: 'All', value: 0 },
  { label: '10%+', value: 10 },
  { label: '25%+', value: 25 },
  { label: '50%+', value: 50 },
  { label: '70%+', value: 70 },
  { label: '90%+', value: 90 },
];

// Women's / fashion keywords for auto-tagging
// Simple: if the title contains "women" anywhere (case-insensitive), it's women's
const WOMENS_RE = /women|girl|ladies|lady|legging|lingerie|maternity|blouse|skirt|bikini|bralette|panties|romper|jumpsuit|bodysuit|camisole|sundress|cardigan|tunic/i;

const PRODUCT_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'womens', label: "Women's" },
  { key: 'other', label: 'Everything Else' },
];

async function getAuthHeaders() {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function DealCurator() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [minDiscount, setMinDiscount] = useState(0);
  const [productCategory, setProductCategory] = useState('all');
  const [selectedDeals, setSelectedDeals] = useState(new Map());
  const [publishCategory, setPublishCategory] = useState('');
  const [publishCategoryOpen, setPublishCategoryOpen] = useState(false);
  const [publishScore, setPublishScore] = useState(75);
  const [publishNotes, setPublishNotes] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedAsins, setPublishedAsins] = useState(new Set());

  // Direct lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupProduct, setLookupProduct] = useState(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // DISABLED: Deal Curator paused while migrating to Keepa + Amazon PA-API
  const { data: dealResults, isLoading, isFetching, refetch: pullDeals } = useQuery({
    queryKey: ['amazon-deals', activeSearch, sortBy],
    queryFn: async () => {
      return { items: [], total: 0 };
    },
    enabled: false, // Disabled — re-enable when Keepa/PA-API is ready
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Tag each deal and apply client-side filters (discount + product category)
  const rawDeals = dealResults?.items || [];
  const allDeals = rawDeals.map(d => ({ ...d, isWomens: WOMENS_RE.test(d.title) }));
  const deals = allDeals.filter(d => {
    if (minDiscount > 0 && (d.discount || 0) < minDiscount) return false;
    if (productCategory === 'womens' && !d.isWomens) return false;
    if (productCategory === 'other' && d.isWomens) return false;
    return true;
  });

  const handleSearch = () => {
    setActiveSearch(searchQuery);
  };

  const toggleDeal = (deal) => {
    setSelectedDeals(prev => {
      const next = new Map(prev);
      const key = deal.asin || deal.title;
      if (next.has(key)) next.delete(key);
      else next.set(key, deal);
      return next;
    });
  };

  const handlePublish = useCallback(async () => {
    if (selectedDeals.size === 0) return;
    // DISABLED: Publishing paused while migrating to Keepa + Amazon PA-API
    toast({ title: 'Publishing disabled', description: 'Deal Curator is paused while we migrate to a new data source.', variant: 'destructive' });
    return;
    setIsPublishing(true);

    try {
      const headers = await getAuthHeaders();
      const dealArray = [...selectedDeals.values()].map(deal => ({
        title: deal.title,
        url: deal.url,
        price: deal.price,
        original_price: deal.original_price,
        merchant: 'Amazon',
        category: publishCategory || null,
        image_url: deal.image_url,
        condition: 'New',
        notes: publishNotes || null,
        score: publishScore,
      }));

      const response = await fetch(`${ORBEN_API_URL}/v1/admin/deals/publish`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deals: dealArray }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Publish failed');
      }

      const result = await response.json();
      const successCount = result.results?.filter(r => r.ok).length || 0;

      const newPublished = new Set(publishedAsins);
      for (const [key] of selectedDeals) newPublished.add(key);
      setPublishedAsins(newPublished);

      toast({
        title: `${successCount} deal${successCount !== 1 ? 's' : ''} published to feed`,
        description: 'Users will see these deals in their Deal Feed',
      });

      setSelectedDeals(new Map());
      setPublishNotes('');
    } catch (err) {
      toast({ title: 'Publish failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  }, [selectedDeals, publishCategory, publishScore, publishNotes, toast, publishedAsins]);

  // Direct product lookup
  const handleLookup = useCallback(async () => {
    if (!lookupQuery.trim()) return;
    setIsLookingUp(true);
    setLookupError('');
    setLookupProduct(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${ORBEN_API_URL}/v1/admin/deals/amazon-lookup`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: lookupQuery.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Lookup failed (${res.status})`);
      }
      const data = await res.json();
      setLookupProduct(data.product);
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setIsLookingUp(false);
    }
  }, [lookupQuery]);

  // Compare: search product across stores via existing product search
  const handleCompare = useCallback((title) => {
    if (!title) return;
    const q = encodeURIComponent(title.slice(0, 80));
    window.open(`https://www.google.com/search?tbm=shop&q=${q}`, '_blank');
  }, []);

  const publishLookupOffer = useCallback(async (offer) => {
    if (!lookupProduct) return;
    setIsPublishing(true);
    try {
      const headers = await getAuthHeaders();
      const dealTitle = offer.title || `${lookupProduct.title}${offer.condition !== 'New' ? ` (${offer.condition})` : ''}`;
      const dealUrl = offer.url || lookupProduct.amazon_url;
      const res = await fetch(`${ORBEN_API_URL}/v1/admin/deals/publish`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          deals: [{
            title: dealTitle,
            url: dealUrl,
            price: offer.price,
            original_price: offer.original_price || null,
            merchant: offer.seller || 'Amazon',
            category: publishCategory || null,
            image_url: lookupProduct.image_url,
            condition: offer.condition,
            notes: publishNotes || null,
            score: publishScore,
          }],
        }),
      });
      if (!res.ok) throw new Error('Publish failed');
      toast({ title: 'Deal published to feed' });
    } catch (err) {
      toast({ title: 'Publish failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  }, [lookupProduct, publishCategory, publishScore, publishNotes, toast]);

  return (
    <div className="p-2 sm:p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Wand2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            Deal Curator
            <Badge variant="secondary" className="text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Admin
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse live Amazon deals, select the best ones, and publish them to your users' Deal Feed
          </p>
        </div>

        <Tabs defaultValue="browse">
          <TabsList className="mb-5">
            <TabsTrigger value="browse" className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              Browse Deals
            </TabsTrigger>
            <TabsTrigger value="lookup" className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              Product Lookup
            </TabsTrigger>
          </TabsList>

          {/* ═══ Browse Deals Tab ═══ */}
          <TabsContent value="browse">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Main deal list */}
              <div className="lg:col-span-3">
                {/* Search bar */}
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search Amazon deals (e.g. electronics, shoes, tools...)"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSearch}
                      disabled={isFetching}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                    >
                      {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Sort + Discount filters + Pull button */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {/* Sort */}
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="h-9 rounded-lg border bg-background px-3 pr-8 text-xs appearance-none cursor-pointer"
                    >
                      {SORT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  </div>

                  {/* Discount % filter chips */}
                  <div className="flex items-center gap-1">
                    {DISCOUNT_FILTERS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => setMinDiscount(f.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
                          minDiscount === f.value
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                            : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Product category filter */}
                  <div className="flex items-center gap-1 border-l border-border/50 pl-2 ml-1">
                    {PRODUCT_CATEGORIES.map(c => {
                      const count = c.key === 'all' ? allDeals.length
                        : c.key === 'womens' ? allDeals.filter(d => d.isWomens).length
                        : allDeals.filter(d => !d.isWomens).length;
                      return (
                        <button
                          key={c.key}
                          onClick={() => setProductCategory(c.key)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
                            productCategory === c.key
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                              : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted"
                          )}
                        >
                          {c.label} {allDeals.length > 0 && <span className="opacity-60">({count})</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Pull Deals button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pullDeals()}
                    disabled={isFetching}
                    className="ml-auto h-9 text-xs gap-1.5"
                  >
                    {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Pull Deals
                  </Button>
                </div>

                {/* Results */}
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex gap-4 border rounded-xl p-4">
                        <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-6 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : deals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
                      <ShoppingCart className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">
                      {allDeals.length > 0 ? 'No deals match this discount filter' : 'No deals found'}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                      {allDeals.length > 0
                        ? 'Try a lower discount threshold to see more deals.'
                        : 'Click "Pull Deals" to fetch live Amazon deals, or try a different search term.'}
                    </p>
                    {allDeals.length === 0 && (
                      <Button onClick={() => pullDeals()} variant="outline" size="sm" className="gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> Pull Deals
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deals.map((deal, idx) => {
                      const key = deal.asin || deal.title;
                      const isSelected = selectedDeals.has(key);
                      const isAlreadyPublished = publishedAsins.has(key);

                      return (
                        <div
                          key={key + idx}
                          onClick={() => !isAlreadyPublished && toggleDeal(deal)}
                          className={cn(
                            "flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all cursor-pointer",
                            isAlreadyPublished
                              ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800 opacity-60 cursor-default"
                              : isSelected
                              ? "bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700 shadow-sm"
                              : "bg-card hover:shadow-md hover:border-foreground/20"
                          )}
                        >
                          {/* Checkbox area */}
                          <div className="flex-shrink-0 flex items-start pt-1">
                            <div className={cn(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                              isAlreadyPublished
                                ? "bg-emerald-500 border-emerald-500"
                                : isSelected
                                ? "bg-blue-500 border-blue-500"
                                : "border-border"
                            )}>
                              {(isSelected || isAlreadyPublished) && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </div>

                          {/* Image */}
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white dark:bg-muted overflow-hidden flex-shrink-0">
                            {deal.image_url ? (
                              <img
                                src={deal.image_url}
                                alt={deal.title}
                                className="w-full h-full object-contain p-1"
                                onError={(e) => { e.target.src = '/default-deal-image.png'; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Package className="w-6 h-6" />
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm leading-snug line-clamp-2 mb-1">{deal.title}</h4>

                            {/* Badges row */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              {deal.discount > 0 && (
                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0 text-[10px] font-bold">
                                  -{deal.discount}% off
                                </Badge>
                              )}
                              {deal.prime && (
                                <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0 border-0">Prime</Badge>
                              )}
                              {deal.badges?.map((b, i) => (
                                <Badge key={i} variant="secondary" className="text-[9px]">{b}</Badge>
                              ))}
                              {deal.coupon && (
                                <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-0 text-[9px]">
                                  {deal.coupon}
                                </Badge>
                              )}
                              {isAlreadyPublished && (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0 text-[9px]">
                                  Published
                                </Badge>
                              )}
                            </div>

                            {/* Price */}
                            <div className="flex items-baseline gap-1.5 flex-wrap mb-1">
                              {deal.price != null ? (
                                <>
                                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    ${deal.price.toFixed(2)}
                                  </span>
                                  {deal.original_price && deal.original_price > deal.price && (
                                    <span className="text-xs text-muted-foreground line-through">
                                      ${deal.original_price.toFixed(2)}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">See deal</span>
                              )}
                            </div>

                            {/* Rating + meta */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {deal.rating && (
                                <span className="flex items-center gap-0.5">
                                  <Star className="w-3 h-3 text-amber-500 fill-current" />
                                  {deal.rating}
                                </span>
                              )}
                              {deal.reviews_count && (
                                <span>({deal.reviews_count.toLocaleString()})</span>
                              )}
                              {deal.bought_last_month && (
                                <span className="text-emerald-600">{deal.bought_last_month}</span>
                              )}
                              <div className="ml-auto flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCompare(deal.title); }}
                                  className="text-blue-600 hover:underline flex items-center gap-0.5"
                                >
                                  Compare <ArrowUpDown className="w-3 h-3" />
                                </button>
                                <a
                                  href={deal.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-600 hover:underline flex items-center gap-0.5"
                                >
                                  View <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {deals.length > 0 && (
                  <div className="flex items-center justify-center mt-6">
                    <span className="text-xs text-muted-foreground">
                      Showing {deals.length} of {allDeals.length} pulled
                      {(minDiscount > 0 || productCategory !== 'all') && ' (filtered)'}
                    </span>
                  </div>
                )}
              </div>

              {/* Right sidebar: Publish panel */}
              <div className="lg:col-span-1">
                <Card className="sticky top-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Publish ({selectedDeals.size})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedDeals.size === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Click deals on the left to select them for publishing
                      </p>
                    ) : (
                      <>
                        {/* Selected deal chips */}
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {[...selectedDeals.entries()].map(([key, deal]) => (
                            <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                              <span className="flex-1 line-clamp-1">{deal.title}</span>
                              {deal.price != null && (
                                <span className="font-bold text-emerald-600 flex-shrink-0">${deal.price.toFixed(2)}</span>
                              )}
                              <button
                                onClick={() => toggleDeal(deal)}
                                className="text-muted-foreground hover:text-foreground flex-shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Category */}
                        <div className="space-y-1">
                          <Label className="text-xs">Category</Label>
                          <div className="relative">
                            <button
                              onClick={() => setPublishCategoryOpen(!publishCategoryOpen)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs bg-background"
                            >
                              {publishCategory ? (
                                (() => {
                                  const cat = DEAL_CATEGORIES.find(c => c.key === publishCategory);
                                  if (!cat) return <span>{publishCategory}</span>;
                                  const Icon = cat.icon;
                                  return (
                                    <span className={cn("flex items-center gap-1.5 font-medium", cat.textColor)}>
                                      <span className={cn("w-2 h-2 rounded-full", cat.dotColor)} />
                                      <Icon className="w-3 h-3" />
                                      {cat.label}
                                    </span>
                                  );
                                })()
                              ) : (
                                <span className="text-muted-foreground">Select category...</span>
                              )}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            {publishCategoryOpen && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setPublishCategoryOpen(false)} />
                                <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 w-full max-h-48 overflow-y-auto py-1">
                                  {DEAL_CATEGORIES.map(cat => {
                                    const Icon = cat.icon;
                                    return (
                                      <button
                                        key={cat.key}
                                        onClick={() => { setPublishCategory(cat.key); setPublishCategoryOpen(false); }}
                                        className={cn(
                                          "w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2 transition-colors",
                                          publishCategory === cat.key && "bg-muted font-medium"
                                        )}
                                      >
                                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cat.dotColor)} />
                                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span className="flex-1">{cat.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Score */}
                        <div className="space-y-1">
                          <Label className="text-xs">Score ({publishScore})</Label>
                          <input
                            type="range"
                            min="0" max="100"
                            value={publishScore}
                            onChange={(e) => setPublishScore(parseInt(e.target.value, 10))}
                            className="w-full accent-emerald-500"
                          />
                          <div className="flex justify-between text-[9px] text-muted-foreground">
                            <span>0</span><span>50</span><span>70</span><span>90+</span>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                          <Label className="text-xs">Notes</Label>
                          <Textarea
                            value={publishNotes}
                            onChange={(e) => setPublishNotes(e.target.value)}
                            placeholder="Optional notes..."
                            rows={2}
                            className="text-xs resize-none"
                          />
                        </div>

                        <Button
                          onClick={handlePublish}
                          disabled={isPublishing}
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                        >
                          {isPublishing ? (
                            <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Publishing...</>
                          ) : (
                            <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Publish {selectedDeals.size} Deal{selectedDeals.size !== 1 ? 's' : ''}</>
                          )}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ═══ Product Lookup Tab ═══ */}
          <TabsContent value="lookup">
            <div className="max-w-3xl">
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Direct Product Lookup
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={lookupQuery}
                      onChange={(e) => setLookupQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                      placeholder="Paste Amazon URL, ASIN, or search term..."
                      className="flex-1"
                      disabled={isLookingUp}
                    />
                    <Button
                      onClick={handleLookup}
                      disabled={isLookingUp || !lookupQuery.trim()}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                    >
                      {isLookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Look up a specific product to see all offers (New, Used Like New, Warehouse, Renewed)
                  </p>
                </CardContent>
              </Card>

              {lookupError && (
                <Card className="mb-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
                  <CardContent className="py-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {lookupError}
                  </CardContent>
                </Card>
              )}

              {isLookingUp && (
                <Card>
                  <CardContent className="py-6">
                    <div className="flex gap-4">
                      <Skeleton className="w-32 h-32 rounded-xl" />
                      <div className="flex-1 space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-8 w-32" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {lookupProduct && !isLookingUp && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex gap-4 mb-5">
                      <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl bg-white dark:bg-muted overflow-hidden flex-shrink-0 border">
                        {lookupProduct.image_url ? (
                          <img src={lookupProduct.image_url} alt={lookupProduct.title} className="w-full h-full object-contain p-2" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package className="w-8 h-8" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base leading-snug line-clamp-3 mb-2">{lookupProduct.title || 'Untitled'}</h3>
                        {(lookupProduct.rating || lookupProduct.reviews_count) && (
                          <div className="flex items-center gap-2 mb-2 text-sm">
                            {lookupProduct.rating && <span className="flex items-center gap-1 text-amber-600"><Star className="w-3.5 h-3.5 fill-current" />{lookupProduct.rating}</span>}
                            {lookupProduct.reviews_count && <span className="text-muted-foreground text-xs">({lookupProduct.reviews_count.toLocaleString()} reviews)</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          {lookupProduct.amazon_url && (
                            <a href={lookupProduct.amazon_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                              View on Amazon <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            onClick={() => handleCompare(lookupProduct.title)}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            Compare Prices <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Offers ({lookupProduct.offers?.length || 0})
                    </h4>

                    {lookupProduct.offers?.length > 0 ? (
                      <div className="space-y-2">
                        {lookupProduct.offers.map((offer, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className={cn("text-[10px]",
                                  offer.condition === 'New' ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" :
                                  offer.condition?.includes('Like New') ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" :
                                  "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                                )}>
                                  {offer.condition || 'New'}
                                </Badge>
                                <span className="text-sm text-muted-foreground">{offer.seller}</span>
                                {offer.prime && <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0 border-0">Prime</Badge>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {offer.price != null ? (
                                <span className="font-bold">${offer.price.toFixed(2)}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">N/A</span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => publishLookupOffer(offer)}
                              disabled={isPublishing}
                              className="flex-shrink-0 text-xs"
                            >
                              Publish
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">No offers found</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
