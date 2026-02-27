import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Star,
  ExternalLink,
  SlidersHorizontal,
  Heart,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Filter,
  Loader2,
  Package,
  Check,
  Globe,
  Store,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Truck,
  X,
  RefreshCw,
  DollarSign,
  Eye,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  CreditCard,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEbaySearchInfinite } from '@/hooks/useEbaySearch';
import { useProductSearch } from '@/hooks/useProductSearch';
import {
  ebayItemToInventory,
  formatEbayPrice,
  formatEbayCondition,
  formatEbayBuyingOption,
  getEbayItemUrl,
  isEbayItemAvailable,
} from '@/utils/ebayHelpers';
import { supabase } from '@/integrations/supabase';
import { ProductCardV1List } from '@/components/ProductCardVariations';
import { getMerchantLogoOrColor } from '@/utils/merchantLogos';

// ─── Inline Sold Results (for eBay tab "Sold" sub-view) ───────────────────────

function SoldResultCardInline({ item, isSelected, onClick }) {
  const price = item.price != null ? `$${Number(item.price).toFixed(2)}` : item.priceRaw;
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex gap-3 p-3 rounded-lg border cursor-pointer transition-all',
        isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:border-primary/50 hover:bg-muted/40',
      )}
    >
      <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Package className="w-6 h-6 opacity-40" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium line-clamp-2 leading-snug">{item.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {price && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-600 text-white text-xs font-bold">{price}</span>
          )}
          {item.condition && (
            <span className="text-xs border border-border rounded px-1.5 py-0.5">{item.condition}</span>
          )}
          {item.topRated && (
            <span className="text-xs border border-amber-400 text-amber-600 rounded px-1.5 py-0.5">Top Rated</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {item.seller && <span>Seller: {item.seller}</span>}
          {item.shippingRaw && (
            <span className="flex items-center gap-0.5">
              <Truck className="w-3 h-3" />{item.shippingRaw}
            </span>
          )}
          {item.watchersRaw && (
            <span className="flex items-center gap-0.5">
              <Eye className="w-3 h-3" />{item.watchersRaw}
            </span>
          )}
          {item.quantitySoldRaw && (
            <span className="flex items-center gap-0.5 text-emerald-600">
              <CheckCircle2 className="w-3 h-3" />{item.quantitySoldRaw}
            </span>
          )}
        </div>
        <a
          href={item.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />View on eBay
        </a>
      </div>
    </div>
  );
}

function EbaySoldResults({ loading, error, results, total, searchQuery, selectedItem, onSelectItem }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin" />
        <p className="text-sm">Searching eBay sold listings…</p>
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription className="text-sm">{error}</AlertDescription>
      </Alert>
    );
  }
  if (!searchQuery || searchQuery.trim().length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <DollarSign className="w-12 h-12 opacity-30" />
        <p className="font-medium">Search for sold eBay listings</p>
        <p className="text-sm">Enter a product name and click Search to see recent sold prices</p>
      </div>
    );
  }
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Package className="w-12 h-12 opacity-30" />
        <p className="font-medium">No sold listings found</p>
        <p className="text-sm">Try a different search term</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground pb-1">
        Showing {results.length}{total > results.length ? ` of ${total.toLocaleString()}` : ''} sold items
      </p>
      {results.map((item, idx) => (
        <SoldResultCardInline
          key={item.product_id || idx}
          item={item}
          isSelected={selectedItem?.product_id === item.product_id}
          onClick={() => onSelectItem(selectedItem?.product_id === item.product_id ? null : item)}
        />
      ))}
    </div>
  );
}

// ─── Sold Detail Panel helpers ─────────────────────────────────────────────────

function SoldDetailSection({ icon: Icon, title, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span>{title}</span>
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function SoldImageGallery({ images }) {
  const [active, setActive] = useState(0);
  if (!images || images.length === 0) return null;
  const mainSrc = typeof images[active] === 'string' ? images[active] : images[active]?.link;
  return (
    <div className="space-y-2">
      <div className="bg-muted rounded-lg overflow-hidden aspect-square w-full max-w-[220px] mx-auto">
        <img src={mainSrc} alt="Product" className="w-full h-full object-contain p-2" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 justify-center flex-wrap">
          {images.slice(0, 6).map((img, i) => {
            const src = typeof img === 'string' ? img : img?.link;
            return (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={cn(
                  'w-10 h-10 rounded border-2 overflow-hidden flex-shrink-0 transition-all',
                  active === i ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100',
                )}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SoldDetailPanel({ productId, listItem }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    setDetail(null);
    setError(null);
    setLoading(true);
    fetch(`/api/ebay/sold-search?product_id=${encodeURIComponent(productId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setDetail(data.product_results || null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [productId]);

  const pr = detail;
  const images = pr?.media
    ? pr.media.filter(m => m.type === 'image').flatMap(m => m.image || []).filter(img => img?.size?.width >= 400 || !img?.size).map(img => img.link)
    : listItem?.imageUrl ? [listItem.imageUrl] : [];
  const price = pr?.buy?.buy_it_now?.price?.amount ?? pr?.buy?.auction?.current_price?.amount ?? listItem?.price;
  const currency = pr?.buy?.buy_it_now?.price?.currency ?? 'USD';
  const shipping = pr?.shipping;
  const returns = pr?.returns?.[0]?.[0];
  const seller = pr?.seller;

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
          <Loader2 className="w-7 h-7 animate-spin" />
          <p className="text-sm">Loading product details…</p>
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>Could not load details: {error}</AlertDescription>
        </Alert>
      )}
      {images.length > 0 && <SoldImageGallery images={images} />}
      <div className="space-y-2">
        <p className="font-semibold text-base leading-snug">{pr?.title || listItem?.title}</p>
        {pr?.subtitle && <p className="text-xs text-muted-foreground">{pr.subtitle}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {price != null && (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-base px-3 py-1">
              {currency === 'USD' ? '$' : ''}{Number(price).toFixed(2)}
            </Badge>
          )}
        </div>
        {pr?.banner_status && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1.5">
            <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{pr.banner_status}</span>
          </div>
        )}
        {pr?.watch_count != null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="w-3.5 h-3.5" />
            <span>{pr.watch_count.toLocaleString()} watching</span>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {listItem?.watchersRaw && !pr?.watch_count && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="w-3.5 h-3.5" /><span>{listItem.watchersRaw}</span>
            </div>
          )}
          {(listItem?.quantitySoldRaw || pr?.quantity?.sold != null) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span>{listItem?.quantitySoldRaw || `${pr.quantity.sold} sold`}</span>
            </div>
          )}
          {listItem?.topRated && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Top Rated</Badge>
          )}
        </div>
      </div>
      <Separator />
      {(shipping?.options?.length > 0 || listItem?.shippingRaw) && (
        <SoldDetailSection icon={Truck} title="Shipping">
          {shipping?.options?.length > 0 ? (
            <div className="space-y-1 text-muted-foreground">
              {shipping.options.map((opt, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>
                    {opt.via && <span className="font-medium text-foreground">{opt.via} — </span>}
                    {opt.price?.amount != null ? (opt.price.amount === 0 ? 'Free' : `$${opt.price.amount.toFixed(2)}`) : ''}
                    {opt.dates?.list?.length > 0 && ` · Est. ${opt.dates.list.join(' – ')}`}
                  </span>
                </div>
              ))}
              {shipping.from && <p className="text-xs text-muted-foreground mt-1">Ships from: {shipping.from}</p>}
            </div>
          ) : (
            <span className="text-muted-foreground">{listItem?.shippingRaw}</span>
          )}
        </SoldDetailSection>
      )}
      {(returns || listItem?.returns) && (
        <SoldDetailSection icon={RotateCcw} title="Returns">
          {returns?.snippets ? (
            <div className="space-y-1 text-muted-foreground">
              {returns.snippets.map((s, i) => <p key={i} className="text-xs">{s.text}</p>)}
            </div>
          ) : (
            <span className="text-sm text-green-600 dark:text-green-400">{listItem?.returns}</span>
          )}
        </SoldDetailSection>
      )}
      {pr?.short_description && (
        <SoldDetailSection icon={Package} title="Description">
          <p className="text-sm text-muted-foreground leading-relaxed">{pr.short_description}</p>
        </SoldDetailSection>
      )}
      {(seller || listItem?.seller) && (
        <SoldDetailSection icon={Star} title="Seller">
          <div className="flex flex-wrap gap-3 text-muted-foreground">
            <span className="font-medium text-foreground">{seller?.name || listItem?.seller}</span>
            {(seller?.positive_feedback_percent ?? listItem?.sellerFeedback) != null && (
              <span className="flex items-center gap-0.5 text-xs">
                <Star className="w-3 h-3 text-amber-400" />
                {seller?.positive_feedback_percent ?? listItem?.sellerFeedback}% positive
              </span>
            )}
            {(seller?.feedback_score ?? listItem?.sellerReviews) != null && (
              <span className="text-xs">{(seller?.feedback_score ?? listItem?.sellerReviews)?.toLocaleString()} ratings</span>
            )}
          </div>
        </SoldDetailSection>
      )}
      {pr?.payment_methods?.payments?.length > 0 && (
        <SoldDetailSection icon={CreditCard} title="Payment">
          <div className="flex flex-wrap gap-1.5">
            {pr.payment_methods.payments.map((p, i) => (
              <Badge key={i} variant="outline" className="text-xs">{p.title}</Badge>
            ))}
          </div>
        </SoldDetailSection>
      )}
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => window.open(listItem?.productUrl || `https://www.ebay.com/itm/${productId}`, '_blank', 'noopener,noreferrer')}
      >
        <ExternalLink className="w-4 h-4" />
        View Full Listing on eBay
      </Button>
    </div>
  );
}

// ─── Active Listing Detail Panel ────────────────────────────────────────────────

function ActiveDetailPanel({ item, onClose }) {
  if (!item) return null;
  const imageUrl = item?.image?.imageUrl;
  const price = formatEbayPrice(item.price);
  const condition = item.condition ? formatEbayCondition(item.condition) : null;
  const buyingOption = item.buyingOptions?.length ? formatEbayBuyingOption(item.buyingOptions) : null;
  const sellerFeedback = item.seller?.feedbackPercentage ? `${item.seller.feedbackPercentage}%` : null;
  const location = item.itemLocation
    ? [item.itemLocation.city, item.itemLocation.stateOrProvince].filter(Boolean).join(', ')
    : null;
  const shipping = Array.isArray(item.shippingOptions) ? item.shippingOptions[0] : item.shippingOptions;
  const isAuction = item.buyingOptions?.includes('AUCTION');
  const listedAgo = formatRelativeDate(item.itemCreationDate || item.itemOriginDate);
  const timeLeft = isAuction && item.itemEndDate ? formatTimeLeft(item.itemEndDate) : null;
  const hasAuthGuarantee = item.qualifiedPrograms?.includes('AUTHENTICITY_GUARANTEE');

  return (
    <div className="space-y-4">
      <button
        onClick={onClose}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors lg:hidden"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to results
      </button>

      {imageUrl && (
        <div className="bg-muted rounded-lg overflow-hidden aspect-square w-full max-w-[220px] mx-auto">
          <img src={imageUrl} alt={item.title} className="w-full h-full object-contain p-2" />
        </div>
      )}

      <div className="space-y-2">
        <p className="font-semibold text-base leading-snug">{item.title}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary hover:bg-primary text-primary-foreground font-bold text-base px-3 py-1">
            {isAuction && item.currentBidPrice ? formatEbayPrice(item.currentBidPrice) : price}
          </Badge>
          {isAuction && item.currentBidPrice && (
            <span className="text-xs text-muted-foreground">current bid</span>
          )}
          {condition && <Badge variant="outline" className="text-xs">{condition}</Badge>}
          {buyingOption && <Badge variant="outline" className="text-xs">{buyingOption.text}</Badge>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {hasAuthGuarantee && (
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">✓ Authenticity Guarantee</Badge>
          )}
          {item.topRatedBuyingExperience && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Top Rated+</Badge>
          )}
          {item.availableCoupons && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-300">Coupon Available</Badge>
          )}
        </div>
        {isAuction && (
          <div className="flex items-center gap-3 text-sm">
            {item.bidCount != null && (
              <span className="text-muted-foreground">{item.bidCount} bid{item.bidCount !== 1 ? 's' : ''}</span>
            )}
            {timeLeft && (
              <span className={cn('font-medium', timeLeft === 'Ended' ? 'text-muted-foreground' : 'text-amber-600')}>
                ⏱ {timeLeft}
              </span>
            )}
          </div>
        )}
      </div>

      <Separator />

      {listedAgo && (
        <SoldDetailSection icon={CheckCircle2} title="Listed">
          <span className="text-muted-foreground">{listedAgo}</span>
        </SoldDetailSection>
      )}

      {shipping && (
        <SoldDetailSection icon={Truck} title="Shipping">
          <span className="text-muted-foreground">
            {shipping.shippingCostType === 'CALCULATED'
              ? 'Calculated (varies by location)'
              : shipping.shippingCost?.value != null
                ? (parseFloat(shipping.shippingCost.value) === 0 ? 'Free Shipping' : formatEbayPrice(shipping.shippingCost))
                : 'See listing'}
          </span>
        </SoldDetailSection>
      )}

      {(item.seller?.username || sellerFeedback) && (
        <SoldDetailSection icon={Star} title="Seller">
          <div className="flex flex-wrap gap-3 text-muted-foreground">
            {item.seller?.username && <span className="font-medium text-foreground">{item.seller.username}</span>}
            {sellerFeedback && (
              <span className="flex items-center gap-0.5 text-xs">
                <Star className="w-3 h-3 text-amber-400" />
                {sellerFeedback} positive
              </span>
            )}
            {item.seller?.feedbackScore != null && (
              <span className="text-xs">{item.seller.feedbackScore.toLocaleString()} ratings</span>
            )}
          </div>
        </SoldDetailSection>
      )}

      {location && (
        <SoldDetailSection icon={MapPin} title="Location">
          <span className="text-muted-foreground">{location}</span>
        </SoldDetailSection>
      )}

      {item.watchCount != null && item.watchCount > 0 && (
        <SoldDetailSection icon={Eye} title="Watchers">
          <span className="text-muted-foreground">{item.watchCount.toLocaleString()} watching</span>
        </SoldDetailSection>
      )}

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => window.open(getEbayItemUrl(item.itemId, item.itemWebUrl), '_blank', 'noopener,noreferrer')}
      >
        <ExternalLink className="w-4 h-4" />
        View on eBay
      </Button>
    </div>
  );
}

/**
 * Enhanced Product Search Dialog
 * Combines Universal Product Search (all marketplaces) + eBay-specific search
 */
export function EnhancedProductSearchDialog({ open, onOpenChange, initialQuery = '', onSelectItem }) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchMode, setSearchMode] = useState('all'); // 'all' or 'ebay'
  const [ebayView, setEbayView] = useState('active'); // 'active' or 'sold' (eBay tab sub-filter)
  const [soldResults, setSoldResults] = useState([]);
  const [soldTotal, setSoldTotal] = useState(0);
  const [soldLoading, setSoldLoading] = useState(false);
  const [soldError, setSoldError] = useState(null);
  const [soldSelectedItem, setSoldSelectedItem] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef(null);
  const universalScrollRef = useRef(null);

  // Universal Search (shared hook)
  const {
    products: universalProducts,
    loading: universalLoading,
    loadingMore: universalLoadingMore,
    hasMore: universalHasMore,
    stats: universalStats,
    search: universalSearch,
    loadMore: universalLoadMore,
    reset: universalReset,
  } = useProductSearch();

  // eBay Search State (using existing hook)
  const [selectedEbayItem, setSelectedEbayItem] = useState(null);
  
  // Image lightbox state
  const [lightboxImage, setLightboxImage] = useState(null);
  
  // Filters (universal)
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    minDiscount: 0,
    minRating: 0,
    sortBy: 'relevance',
    marketplace: 'all'
  });

  // eBay active listing filters (passed to Browse API)
  const [ebayActiveFilters, setEbayActiveFilters] = useState({
    condition: '',   // '' | '1000'=New | '3000'=Used | '2500'=Refurbished
    minPrice: '',
    maxPrice: '',
    sort: '',        // '' | 'price' | '-price' | 'newlyListed' | 'endingSoonest'
  });

  // Sold listing filters (client-side)
  const [soldFilters, setSoldFilters] = useState({
    minPrice: '',
    maxPrice: '',
    sort: 'default', // 'default' | 'price_low' | 'price_high'
  });

  // Debounce search query - 800ms like ProductSearch page
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 800); // Increased to 800ms to match ProductSearch page behavior
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // eBay Search Setup
  const trimmedQuery = debouncedQuery?.trim() || '';
  const hasValidQuery = trimmedQuery.length >= 2;

  // Build eBay Browse API filter string from active filters
  const ebayFilterString = useMemo(() => {
    const parts = [];
    if (ebayActiveFilters.condition) {
      parts.push(`conditions:{${ebayActiveFilters.condition}}`);
    }
    if (ebayActiveFilters.minPrice || ebayActiveFilters.maxPrice) {
      const min = ebayActiveFilters.minPrice || '0';
      const max = ebayActiveFilters.maxPrice || '*';
      parts.push(`price:[${min}..${max}]`);
      parts.push('priceCurrency:USD');
    }
    return parts.length ? parts.join(',') : undefined;
  }, [ebayActiveFilters]);

  const {
    data: ebaySearchResultsData,
    isLoading: ebayLoading,
    error: ebayError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEbaySearchInfinite(
    {
      q: trimmedQuery,
      limit: 100,
      filter: ebayFilterString,
      sort: ebayActiveFilters.sort || undefined,
    },
    {
      enabled: hasValidQuery && searchMode === 'ebay' && open,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  // Flatten eBay results
  const ebaySearchResults = useMemo(() => {
    if (!ebaySearchResultsData?.pages) return null;
    const allItems = ebaySearchResultsData.pages
      .flatMap((page) => page?.itemSummaries || [])
      .filter(Boolean);
    const total = ebaySearchResultsData.pages[0]?.total || 0;
    return { itemSummaries: allItems, total };
  }, [ebaySearchResultsData]);

  const ebayItems = useMemo(() => {
    if (!ebaySearchResults?.itemSummaries) return [];
    return ebaySearchResults.itemSummaries.filter(Boolean);
  }, [ebaySearchResults?.itemSummaries]);

  // Price stats for active eBay listings
  const ebayPriceStats = useMemo(() => {
    if (!ebayItems.length) return null;
    const prices = ebayItems
      .map(item => parseFloat(item.price?.value))
      .filter(p => !isNaN(p) && p > 0);
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    return { min, max, avg };
  }, [ebayItems]);

  // Set up infinite scroll for eBay
  useEffect(() => {
    if (!scrollAreaRef.current || !hasNextPage || isFetchingNextPage || searchMode !== 'ebay') return;

    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const handleScroll = () => {
      const scrollTop = viewport.scrollTop;
      const scrollHeight = viewport.scrollHeight;
      const clientHeight = viewport.clientHeight;
      
      if (scrollHeight - scrollTop - clientHeight < 200 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, searchMode]);

  // Set up infinite scroll for universal/all search
  useEffect(() => {
    if (!universalScrollRef.current || !universalHasMore || universalLoadingMore || searchMode !== 'all') return;

    const container = universalScrollRef.current;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 300 && universalHasMore && !universalLoadingMore) {
        universalLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [universalHasMore, universalLoadingMore, searchMode, universalProducts.length, universalLoadMore]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setDebouncedQuery('');
      universalReset();
      setSelectedEbayItem(null);
    } else if (initialQuery) {
      setSearchQuery(initialQuery);
      setDebouncedQuery(initialQuery);
    }
    
    if (open) {
      setTimeout(() => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
        }
      }, 50);
    }
  }, [open, initialQuery, universalReset]);

  // Auto-search for "All Marketplaces" mode when debouncedQuery changes
  useEffect(() => {
    if (searchMode === 'all' && debouncedQuery.trim().length >= 3 && open) {
      universalSearch(debouncedQuery);
    }
  }, [debouncedQuery, searchMode, open, universalSearch]);

  // Sold listings search (SerpAPI) - defined before handleSearch so it can be called from it
  const handleSoldSearch = async (overrideQuery) => {
    const q = (overrideQuery ?? searchQuery).trim();
    if (q.length < 2) return;
    setSoldLoading(true);
    setSoldError(null);
    setSoldResults([]);
    setSoldTotal(0);
    setSoldSelectedItem(null);
    try {
      const resp = await fetch(`/api/ebay/sold-search?q=${encodeURIComponent(q)}&num=50`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setSoldResults(data.results || []);
      setSoldTotal(data.total || data.results?.length || 0);
    } catch (err) {
      setSoldError(err.message || 'Search failed. Please try again.');
    } finally {
      setSoldLoading(false);
    }
  };

  // Client-side filtered + sorted sold results
  const filteredSoldResults = useMemo(() => {
    let results = soldResults;
    if (soldFilters.minPrice !== '' && !isNaN(Number(soldFilters.minPrice))) {
      results = results.filter(r => (r.price || 0) >= Number(soldFilters.minPrice));
    }
    if (soldFilters.maxPrice !== '' && !isNaN(Number(soldFilters.maxPrice))) {
      results = results.filter(r => (r.price || 0) <= Number(soldFilters.maxPrice));
    }
    if (soldFilters.sort === 'price_low') {
      results = [...results].sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (soldFilters.sort === 'price_high') {
      results = [...results].sort((a, b) => (b.price || 0) - (a.price || 0));
    }
    return results;
  }, [soldResults, soldFilters]);

  // Price stats for sold listings (using filtered results)
  const soldPriceStats = useMemo(() => {
    if (!filteredSoldResults.length) return null;
    const prices = filteredSoldResults
      .map(item => typeof item.price === 'number' ? item.price : parseFloat(item.price))
      .filter(p => !isNaN(p) && p > 0);
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    return { min, max, avg };
  }, [filteredSoldResults]);

  // Auto-trigger sold search when switching to sold view if there's already a query
  useEffect(() => {
    if (ebayView === 'sold' && searchMode === 'ebay' && searchQuery.trim().length >= 2) {
      handleSoldSearch(searchQuery.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ebayView]);

  // Handle search based on mode
  const handleSearch = () => {
    if (searchMode === 'all') {
      universalSearch(searchQuery.trim());
    } else if (ebayView === 'sold') {
      handleSoldSearch();
    } else {
      setDebouncedQuery(searchQuery.trim());
    }
  };

  // Handle eBay item selection
  const handleSelectEbayItem = (item) => {
    setSelectedEbayItem(item);
  };

  const handleConfirmEbaySelection = () => {
    if (selectedEbayItem && onSelectItem) {
      const inventoryData = ebayItemToInventory(selectedEbayItem);
      onSelectItem(inventoryData);
      onOpenChange(false);
    }
  };

  // Add to watchlist (universal products)
  const handleAddToWatchlist = async (product) => {
    try {
      const response = await fetch('/api/pulse/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: product.title,
          product_url: product.productUrl,
          product_image_url: product.imageUrl,
          marketplace: product.marketplace,
          initial_price: product.price,
          target_price: product.price * 0.85,
          notify_on_drop: true
        })
      });

      if (!response.ok) throw new Error('Failed to add to watchlist');

      toast({
        title: '⭐ Added to watchlist',
        description: `You'll be notified when price drops below $${(product.price * 0.85).toFixed(2)}`
      });
    } catch (error) {
      console.error('Watchlist error:', error);
      toast({
        title: '❌ Failed to add to watchlist',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Filtered + sorted universal products
  const filteredProducts = useMemo(() => {
    let filtered = universalProducts.map(p => ({
      ...p,
      discountPercentage: (p.originalPrice && p.originalPrice > p.price)
        ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
        : 0
    }));

    if (filters.marketplace !== 'all') {
      filtered = filtered.filter(p => p.marketplace === filters.marketplace);
    }
    if (filters.minPrice !== '' && !isNaN(Number(filters.minPrice))) {
      filtered = filtered.filter(p => p.price >= Number(filters.minPrice));
    }
    if (filters.maxPrice !== '' && !isNaN(Number(filters.maxPrice))) {
      filtered = filtered.filter(p => p.price <= Number(filters.maxPrice));
    }
    if (filters.minDiscount > 0) {
      filtered = filtered.filter(p => p.discountPercentage >= filters.minDiscount);
    }
    if (filters.minRating > 0) {
      filtered = filtered.filter(p => p.rating && p.rating >= filters.minRating);
    }

    if (filters.sortBy === 'price_low') {
      filtered = [...filtered].sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (filters.sortBy === 'price_high') {
      filtered = [...filtered].sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (filters.sortBy === 'discount') {
      filtered = [...filtered].sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0));
    } else if (filters.sortBy === 'rating') {
      filtered = [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return filtered;
  }, [universalProducts, filters]);

  // Get unique marketplaces from universal results
  const marketplaces = useMemo(() => {
    const unique = [...new Set(universalProducts.map(p => p.marketplace))];
    return unique.sort();
  }, [universalProducts]);

  // Build eBay sold listings URL
  const ebaySoldUrl = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      return "https://www.ebay.com/sch/i.html?_nkw=&LH_Sold=1&LH_Complete=1";
    }
    const query = debouncedQuery.trim();
    return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
  }, [debouncedQuery]);

  const isLoading = searchMode === 'all' ? universalLoading : ebayLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[92vw] max-w-[80rem] max-h-[90vh] flex flex-col p-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6" />
            Product Search
          </DialogTitle>
          <DialogDescription>
            Search all marketplaces or focus on eBay listings
          </DialogDescription>
        </DialogHeader>

        {/* Search Mode Selector */}
        <div className="px-6 pt-4 pb-2">
          <Tabs value={searchMode} onValueChange={setSearchMode} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                All Marketplaces
              </TabsTrigger>
              <TabsTrigger value="ebay" className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                eBay Only
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Search Bar */}
        <div className="px-6 pb-4 border-b bg-muted/20">
          {/* Mobile: Stack search bar and buttons, Desktop: Single row */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search Input - Full width on mobile, flex-1 on desktop */}
            <div className="w-full sm:flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchMode === 'all' ? 'Type to search all marketplaces...' : 'Search eBay listings...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchMode === 'ebay' && handleSearch()}
                className="pl-10 h-12 text-base"
                disabled={isLoading}
                autoFocus={false}
              />
            </div>
            
            {/* Buttons Row - Full width on mobile, auto width on desktop */}
            <div className="flex gap-2 w-full sm:w-auto">
              {/* Search button only shown for eBay mode, All Marketplaces is auto-search */}
              {searchMode === 'ebay' && (
                <Button
                  onClick={handleSearch}
                  disabled={
                    (ebayView === 'active' ? isLoading : soldLoading) ||
                    !searchQuery.trim() ||
                    searchQuery.trim().length < 2
                  }
                  size="lg"
                  className="flex-1 sm:flex-none sm:px-8"
                >
                  {(ebayView === 'active' ? isLoading : soldLoading) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    'Search'
                  )}
                </Button>
              )}
              {searchMode === 'all' && (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => universalSearch(searchQuery.trim())}
                    disabled={universalLoading || !searchQuery.trim()}
                    className="px-3"
                    title="Force refresh (bypass cache)"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(showFilters && 'bg-muted')}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* eBay sub-filter: Active / Sold toggle + filters */}
          {searchMode === 'ebay' && (
            <div className="mt-3 space-y-2">
              {/* Active / Sold pills */}
              <div className="flex rounded-lg border bg-muted p-0.5 gap-0.5 w-fit">
                <button
                  type="button"
                  onClick={() => setEbayView('active')}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                    ebayView === 'active'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Active Listings
                </button>
                <button
                  type="button"
                  onClick={() => setEbayView('sold')}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                    ebayView === 'sold'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <DollarSign className="w-3 h-3" />
                  Sold Listings
                </button>
              </div>

              {/* Active listing filters */}
              {ebayView === 'active' && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-7 text-xs border border-border rounded-md px-2 bg-background text-foreground"
                    value={ebayActiveFilters.condition}
                    onChange={e => setEbayActiveFilters(f => ({ ...f, condition: e.target.value }))}
                  >
                    <option value="">All Conditions</option>
                    <option value="1000">New</option>
                    <option value="3000">Used</option>
                    <option value="2500">Seller Refurbished</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="Min $"
                      className="h-7 w-20 text-xs px-2"
                      value={ebayActiveFilters.minPrice}
                      onChange={e => setEbayActiveFilters(f => ({ ...f, minPrice: e.target.value }))}
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input
                      type="number"
                      placeholder="Max $"
                      className="h-7 w-20 text-xs px-2"
                      value={ebayActiveFilters.maxPrice}
                      onChange={e => setEbayActiveFilters(f => ({ ...f, maxPrice: e.target.value }))}
                    />
                  </div>
                  <select
                    className="h-7 text-xs border border-border rounded-md px-2 bg-background text-foreground"
                    value={ebayActiveFilters.sort}
                    onChange={e => setEbayActiveFilters(f => ({ ...f, sort: e.target.value }))}
                  >
                    <option value="">Best Match</option>
                    <option value="price">Price: Low–High</option>
                    <option value="-price">Price: High–Low</option>
                    <option value="newlyListed">Newly Listed</option>
                    <option value="endingSoonest">Ending Soonest</option>
                  </select>
                  {(ebayActiveFilters.condition || ebayActiveFilters.minPrice || ebayActiveFilters.maxPrice || ebayActiveFilters.sort) && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                      onClick={() => setEbayActiveFilters({ condition: '', minPrice: '', maxPrice: '', sort: '' })}
                    >
                      <X className="w-3 h-3" />Clear
                    </button>
                  )}
                </div>
              )}

              {/* Sold listing filters */}
              {ebayView === 'sold' && soldResults.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="Min $"
                      className="h-7 w-20 text-xs px-2"
                      value={soldFilters.minPrice}
                      onChange={e => setSoldFilters(f => ({ ...f, minPrice: e.target.value }))}
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input
                      type="number"
                      placeholder="Max $"
                      className="h-7 w-20 text-xs px-2"
                      value={soldFilters.maxPrice}
                      onChange={e => setSoldFilters(f => ({ ...f, maxPrice: e.target.value }))}
                    />
                  </div>
                  <select
                    className="h-7 text-xs border border-border rounded-md px-2 bg-background text-foreground"
                    value={soldFilters.sort}
                    onChange={e => setSoldFilters(f => ({ ...f, sort: e.target.value }))}
                  >
                    <option value="default">Default Order</option>
                    <option value="price_low">Price: Low–High</option>
                    <option value="price_high">Price: High–Low</option>
                  </select>
                  {(soldFilters.minPrice || soldFilters.maxPrice || soldFilters.sort !== 'default') && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                      onClick={() => setSoldFilters({ minPrice: '', maxPrice: '', sort: 'default' })}
                    >
                      <X className="w-3 h-3" />Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Filters Panel (Universal only) */}
          {searchMode === 'all' && showFilters && (
            <div className="mt-4 p-4 bg-background border rounded-lg grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Min Price</label>
                <Input
                  type="number"
                  placeholder="$0"
                  value={filters.minPrice}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Max Price</label>
                <Input
                  type="number"
                  placeholder="$9999"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Min Discount</label>
                <select
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  value={filters.minDiscount}
                  onChange={(e) => setFilters({ ...filters, minDiscount: parseInt(e.target.value) })}
                >
                  <option value={0}>Any</option>
                  <option value={10}>10%+</option>
                  <option value={25}>25%+</option>
                  <option value={50}>50%+</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Marketplace</label>
                <select
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  value={filters.marketplace}
                  onChange={(e) => setFilters({ ...filters, marketplace: e.target.value })}
                >
                  <option value="all">All Marketplaces</option>
                  {marketplaces.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Sort By</label>
                <select
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                >
                  <option value="relevance">Relevance</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="discount">Biggest Discounts</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Stats Bars */}
        {searchMode === 'all' && universalStats && !universalLoading && (
          <div className="px-6 py-2 bg-muted/30 border-b text-sm flex items-center gap-6 flex-shrink-0">
            <span className="font-semibold">{filteredProducts.length} Results</span>
            {universalStats.priceStats.lowest !== Infinity && (
              <>
                <span className="text-muted-foreground">
                  ${universalStats.priceStats.lowest.toFixed(2)} – ${universalStats.priceStats.highest.toFixed(2)}
                </span>
                <span className="text-muted-foreground">Avg: ${universalStats.priceStats.average}</span>
              </>
            )}
          </div>
        )}
        {searchMode === 'ebay' && ebayView === 'active' && ebayItems.length > 0 && !ebayLoading && ebayPriceStats && (
          <div className="px-6 py-2 bg-muted/30 border-b text-sm flex items-center gap-6 flex-shrink-0">
            <span className="font-semibold">{ebayItems.length} Active Listings</span>
            <span className="text-muted-foreground">${ebayPriceStats.min.toFixed(2)} – ${ebayPriceStats.max.toFixed(2)}</span>
            <span className="text-muted-foreground">Avg: ${ebayPriceStats.avg.toFixed(2)}</span>
          </div>
        )}
        {searchMode === 'ebay' && ebayView === 'sold' && filteredSoldResults.length > 0 && !soldLoading && soldPriceStats && (
          <div className="px-6 py-2 bg-muted/30 border-b text-sm flex items-center gap-6 flex-shrink-0">
            <span className="font-semibold">{filteredSoldResults.length}{filteredSoldResults.length !== soldResults.length ? ` of ${soldResults.length}` : ''} Sold Listings</span>
            <span className="text-muted-foreground">${soldPriceStats.min.toFixed(2)} – ${soldPriceStats.max.toFixed(2)}</span>
            <span className="text-muted-foreground">Avg: ${soldPriceStats.avg.toFixed(2)}</span>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {searchMode === 'all' ? (
            <div ref={universalScrollRef} className="flex-1 overflow-auto px-6 py-4 min-h-0">
              <UniversalResults
                loading={universalLoading}
                products={filteredProducts}
                onAddToWatchlist={handleAddToWatchlist}
                onImageClick={setLightboxImage}
                loadingMore={universalLoadingMore}
                hasMore={universalHasMore}
              />
            </div>
          ) : ebayView === 'sold' ? (
            <>
              <div className={cn('flex-1 min-h-0 overflow-y-auto px-4 py-4', soldSelectedItem && 'lg:max-w-sm lg:border-r')}>
                <EbaySoldResults
                  loading={soldLoading}
                  error={soldError}
                  results={filteredSoldResults}
                  total={soldTotal}
                  searchQuery={searchQuery}
                  selectedItem={soldSelectedItem}
                  onSelectItem={setSoldSelectedItem}
                />
              </div>
              {soldSelectedItem && (
                <div className="lg:w-[400px] flex-shrink-0 border-t lg:border-t-0 overflow-y-auto">
                  <div className="p-4 space-y-4">
                    <button
                      onClick={() => setSoldSelectedItem(null)}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors lg:hidden"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back to results
                    </button>
                    <SoldDetailPanel productId={soldSelectedItem.product_id} listItem={soldSelectedItem} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={cn('flex-1 min-h-0', selectedEbayItem && 'lg:max-w-sm lg:border-r')}>
                <EbayResults
                  loading={ebayLoading}
                  error={ebayError}
                  items={ebayItems}
                  selectedItem={selectedEbayItem}
                  onSelectItem={handleSelectEbayItem}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  searchQuery={debouncedQuery}
                  scrollAreaRef={scrollAreaRef}
                  total={ebaySearchResults?.total}
                />
              </div>
              {selectedEbayItem && (
                <div className="lg:w-[400px] flex-shrink-0 border-t lg:border-t-0 overflow-y-auto">
                  <div className="p-4">
                    <ActiveDetailPanel
                      item={selectedEbayItem}
                      onClose={() => setSelectedEbayItem(null)}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer (eBay mode only) */}
        {searchMode === 'ebay' && ebayItems.length > 0 && onSelectItem && (
          <div className="px-6 py-4 border-t flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {selectedEbayItem ? 'Item selected - click "Use Selected" to add to inventory' : 'Select an item to continue'}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmEbaySelection}
                disabled={!selectedEbayItem}
              >
                Use Selected Item
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
      
      {/* Image Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxImage(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img 
            src={lightboxImage} 
            alt="Product" 
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Dialog>
  );
}

// Universal Results Component - Table on Desktop, Cards on Mobile
function UniversalResults({ loading, products, onAddToWatchlist, onImageClick, loadingMore, hasMore }) {
  if (loading) {
    return <LoadingState />;
  }

  if (products.length === 0) {
    return <UniversalEmptyState />;
  }

  return (
    <>
      {/* Mobile View - Card Layout */}
      <div className="md:hidden space-y-3">
        {products.map((product, idx) => {
          return (
            <ProductCardV1List 
              key={idx} 
              item={{
                ...product,
                image_url: product.imageUrl,
                link: product.productUrl,
                extracted_price: product.price,
                old_price: product.originalPrice,
                extracted_old_price: product.originalPrice,
                source: product.marketplace,
                reviews_count: product.reviewCount,
              }}
            />
          );
        })}
      </div>

      {/* Desktop View - Table Layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background z-10">
            <tr className="text-xs text-muted-foreground border-b">
              <th className="py-3 px-3 text-left w-16">Image</th>
              <th className="py-3 px-3 text-left">Product</th>
              <th className="py-3 px-3 text-center w-28">Marketplace</th>
              <th className="py-3 px-3 text-right w-24">Price</th>
              <th className="py-3 px-3 text-right w-24">Was</th>
              <th className="py-3 px-3 text-center w-20">Discount</th>
              <th className="py-3 px-3 text-center w-24">Rating</th>
              <th className="py-3 px-3 text-center w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, idx) => (
              <ProductRow
                key={idx}
                product={product}
                onAddToWatchlist={onAddToWatchlist}
                onImageClick={onImageClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {loadingMore && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading more products...</span>
        </div>
      )}

      {!hasMore && products.length > 0 && !loadingMore && (
        <div className="text-center py-3 text-xs text-muted-foreground">
          Showing all {products.length} results
        </div>
      )}
    </>
  );
}

// Product Row (Universal) with merchant offers and image lightbox
function ProductRow({ product, onAddToWatchlist, onImageClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [merchantOffers, setMerchantOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  const merchantInfo = getMerchantLogoOrColor(product.marketplace);
  
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const hasToken = product.immersive_product_page_token;

  // Fetch merchant offers when expanded
  const fetchMerchantOffers = async () => {
    if (loaded || !hasToken) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';
      const response = await fetch(`${ORBEN_API_URL}/v1/product/offers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          immersive_product_page_token: product.immersive_product_page_token
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMerchantOffers(data.offers || []);
      }
    } catch (error) {
      console.error('Error fetching merchant offers:', error);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  // Fetch when opened
  useEffect(() => {
    if (isOpen && hasToken && !loaded) {
      fetchMerchantOffers();
    }
  }, [isOpen]);

  return (
    <>
      <tr className="border-b last:border-b-0 hover:bg-muted/20">
        <td className="py-2 px-3">
          <div 
            className="w-14 h-14 rounded-md bg-muted overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => product.imageUrl && onImageClick(product.imageUrl)}
          >
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                No img
              </div>
            )}
          </div>
        </td>
        <td className="py-2 px-3">
          <div className="max-w-md">
            <div className="font-medium text-sm line-clamp-2 mb-1">{product.title}</div>
            {product.seller && (
              <div className="text-xs text-muted-foreground">by {product.seller}</div>
            )}
            {product.delivery && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Truck className="h-3 w-3" />
                {product.delivery}
              </div>
            )}
          </div>
        </td>
        <td className="py-2 px-3 text-center">
          <div className="flex items-center justify-center gap-2">
            {merchantInfo.hasLogo ? (
              <img 
                src={merchantInfo.logo} 
                alt={product.marketplace} 
                className="h-5 w-auto object-contain"
                onError={(e) => e.target.style.display = 'none'}
                title={product.marketplace}
              />
            ) : (
              <span className="text-xs font-medium capitalize">{product.marketplace}</span>
            )}
          </div>
        </td>
        <td className="py-2 px-3 text-right">
          <span className="text-lg font-bold text-primary">${product.price.toFixed(2)}</span>
        </td>
        <td className="py-2 px-3 text-right">
          {hasDiscount ? (
            <span className="text-sm text-muted-foreground line-through">${product.originalPrice.toFixed(2)}</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </td>
        <td className="py-2 px-3 text-center">
          {product.discountPercentage > 0 ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              -{product.discountPercentage}%
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="py-2 px-3 text-center">
          {product.rating ? (
            <div className="flex items-center justify-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{product.rating}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="py-2 px-3">
          <div className="flex items-center justify-center gap-1">
            {hasToken && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setIsOpen(!isOpen)}
                title="View other stores"
              >
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => onAddToWatchlist(product)}
              title="Add to Watchlist"
            >
              <Heart className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-8 px-3"
              onClick={() => window.open(product.productUrl, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>
      {isOpen && hasToken && (
        <tr className="border-b">
          <td colSpan="8" className="py-2 px-3 bg-muted/10">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Store className="h-3 w-3" />
                Other Stores & Prices
              </div>
              {loading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs text-muted-foreground">Loading offers...</span>
                </div>
              ) : merchantOffers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {merchantOffers.map((offer, idx) => (
                    <Card key={idx} className="border shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">{offer.merchant}</span>
                          <span className="text-lg font-bold text-primary">${offer.price.toFixed(2)}</span>
                        </div>
                        {offer.delivery && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                            <Truck className="h-3 w-3" />
                            {offer.delivery}
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => window.open(offer.link, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Shop at {offer.merchant}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-2">
                  No other merchant offers available for this product.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'Just listed' : `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return diffMonths === 1 ? '1mo ago' : `${diffMonths}mo ago`;
}

function formatTimeLeft(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date - now;
  if (diffMs <= 0) return 'Ended';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffDays > 0) return `${diffDays}d ${diffHours}h left`;
  if (diffHours > 0) return `${diffHours}h ${diffMins}m left`;
  return `${diffMins}m left`;
}

// eBay Results Component - Table Format with All Details
function EbayResults({ loading, error, items, selectedItem, onSelectItem, hasNextPage, isFetchingNextPage, searchQuery, scrollAreaRef, total }) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error.message || "Failed to search eBay. Please try again."}
        </AlertDescription>
      </Alert>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Searching eBay...</span>
      </div>
    );
  }

  if (!loading && !searchQuery && items.length === 0) {
    return <EbayEmptyState />;
  }

  if (!loading && searchQuery && items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No items found. Try a different search term.</p>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="h-full w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background z-10">
            <tr className="text-xs text-muted-foreground border-b">
              <th className="py-3 px-3 text-left w-16">Image</th>
              <th className="py-3 px-3 text-left">Item Title</th>
              <th className="py-3 px-3 text-center w-24">Condition</th>
              <th className="py-3 px-3 text-right w-24">Price</th>
              <th className="py-3 px-3 text-center w-24">Format</th>
              <th className="py-3 px-3 text-left w-32">Seller</th>
              <th className="py-3 px-3 text-right w-24">Shipping</th>
              <th className="py-3 px-3 text-left w-32">Listed</th>
              <th className="py-3 px-3 text-center w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelected = selectedItem?.itemId === item.itemId;
              const isAvailable = isEbayItemAvailable(item);
              
              return (
                <EbayTableRow
                  key={item.itemId}
                  item={item}
                  isSelected={isSelected}
                  isAvailable={isAvailable}
                  onSelectItem={onSelectItem}
                />
              );
            })}
          </tbody>
        </table>

        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Loading more items...</span>
          </div>
        )}

        {!hasNextPage && items.length > 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <p>Showing {items.length} {total && total > items.length ? `of ${total}` : ''} items</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// eBay Table Row Component
function EbayTableRow({ item, isSelected, isAvailable, onSelectItem }) {
  const imageUrl = item?.image?.imageUrl || null;
  const buyingOption = item.buyingOptions && item.buyingOptions.length > 0
    ? formatEbayBuyingOption(item.buyingOptions)
    : null;
  const sellerFeedback = item.seller?.feedbackPercentage
    ? `${item.seller.feedbackPercentage}%`
    : null;
  const itemLocation = item.itemLocation
    ? [item.itemLocation.city, item.itemLocation.stateOrProvince].filter(Boolean).join(', ')
    : null;
  const isAuction = item.buyingOptions?.includes('AUCTION');
  const listedAgo = formatRelativeDate(item.itemCreationDate || item.itemOriginDate);
  const timeLeft = isAuction && item.itemEndDate ? formatTimeLeft(item.itemEndDate) : null;
  const hasAuthGuarantee = item.qualifiedPrograms?.includes('AUTHENTICITY_GUARANTEE');

  return (
    <tr
      className={cn(
        "border-b last:border-b-0 cursor-pointer transition-all",
        isSelected && "bg-primary/10 ring-2 ring-primary ring-inset",
        !isSelected && "hover:bg-muted/20",
        !isAvailable && "opacity-60"
      )}
      onClick={() => isAvailable && onSelectItem(item)}
    >
      {/* Image */}
      <td className="py-2 px-3">
        <div className="w-14 h-14 rounded-md bg-muted overflow-hidden flex-shrink-0 relative">
          {imageUrl ? (
            <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No img
            </div>
          )}
          {isSelected && (
            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-primary" />
            </div>
          )}
        </div>
      </td>

      {/* Item Title */}
      <td className="py-2 px-3">
        <div className="max-w-md">
          <div className="font-medium text-sm line-clamp-2 mb-1">{item.title}</div>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {!isAvailable && <Badge variant="destructive" className="text-xs">Sold Out</Badge>}
            {hasAuthGuarantee && (
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 dark:border-blue-700">✓ Auth</Badge>
            )}
            {item.topRatedBuyingExperience && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:border-amber-700">Top Rated+</Badge>
            )}
            {item.availableCoupons && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-300">Coupon</Badge>
            )}
          </div>
          {isAuction && (
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {item.bidCount != null && (
                <span className="font-medium">{item.bidCount} bid{item.bidCount !== 1 ? 's' : ''}</span>
              )}
              {timeLeft && (
                <span className={cn('font-medium', timeLeft.includes('m left') && !timeLeft.includes('h') ? 'text-red-500' : 'text-amber-600')}>
                  ⏱ {timeLeft}
                </span>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Condition */}
      <td className="py-2 px-3 text-center">
        {item.condition ? (
          <Badge variant="outline" className="text-xs">
            {formatEbayCondition(item.condition)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Price */}
      <td className="py-2 px-3 text-right">
        <span className="text-lg font-bold text-primary">
          {formatEbayPrice(isAuction && item.currentBidPrice ? item.currentBidPrice : item.price)}
        </span>
        {isAuction && item.currentBidPrice && (
          <div className="text-xs text-muted-foreground">current bid</div>
        )}
      </td>

      {/* Format (Buying Option) */}
      <td className="py-2 px-3 text-center">
        {buyingOption ? (
          <Badge variant="outline" className="text-xs">
            {buyingOption.text}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Seller Info */}
      <td className="py-2 px-3">
        <div className="text-sm">
          {item.seller?.username && (
            <div className="font-medium truncate max-w-[100px]">{item.seller.username}</div>
          )}
          {sellerFeedback && (
            <div className="text-xs text-green-600 dark:text-green-400">
              ⭐ {sellerFeedback}
            </div>
          )}
          {item.seller?.feedbackScore != null && (
            <div className="text-xs text-muted-foreground">
              {item.seller.feedbackScore.toLocaleString()} ratings
            </div>
          )}
        </div>
      </td>

      {/* Shipping Cost */}
      <td className="py-2 px-3 text-right">
        {(() => {
          const shipping = Array.isArray(item.shippingOptions)
            ? item.shippingOptions[0]
            : item.shippingOptions;
          if (!shipping) return <span className="text-xs text-muted-foreground">—</span>;
          const costType = shipping.shippingCostType;
          if (costType === 'CALCULATED') {
            return <span className="text-xs text-muted-foreground italic">Calculated</span>;
          }
          const cost = shipping.shippingCost;
          if (!cost) return <span className="text-xs text-muted-foreground">—</span>;
          const val = parseFloat(cost.value);
          if (isNaN(val) || val === 0 || costType === 'FREE') {
            return <span className="text-emerald-600 font-medium text-xs">Free</span>;
          }
          return <div className="text-sm">{formatEbayPrice(cost)}</div>;
        })()}
      </td>

      {/* Listed (date + location + watchers) */}
      <td className="py-2 px-3">
        {listedAgo && (
          <div className="text-xs font-medium text-foreground">{listedAgo}</div>
        )}
        {itemLocation && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">{itemLocation}</div>
        )}
        {item.watchCount != null && item.watchCount > 0 && (
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-0.5">
            <Eye className="w-3 h-3" />{item.watchCount.toLocaleString()}
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="py-2 px-3">
        <div className="flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant="default"
            className="h-8 px-3"
            onClick={(e) => {
              e.stopPropagation();
              const ebayUrl = getEbayItemUrl(item.itemId, item.itemWebUrl);
              window.open(ebayUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View
          </Button>
        </div>
      </td>
    </tr>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3 items-center">
          <Skeleton className="w-14 h-14 rounded-md" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// Empty States
function UniversalEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12 px-6">
      <Globe className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">Search Products Across 100+ Marketplaces</h3>
      <p className="text-muted-foreground max-w-md">
        Enter any product name to search.
      </p>
    </div>
  );
}

function EbayEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12 px-6">
      <Store className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">Search eBay Listings</h3>
      <p className="text-muted-foreground max-w-md">
        Enter a search term to find live eBay listings. Perfect for sourcing inventory and price comparison.
      </p>
    </div>
  );
}

export default EnhancedProductSearchDialog;
