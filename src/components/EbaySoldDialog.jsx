import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  ExternalLink,
  Loader2,
  Package,
  ChevronLeft,
  Eye,
  ShoppingCart,
  Truck,
  RotateCcw,
  Star,
  TrendingUp,
  Clock,
  CreditCard,
  AlertCircle,
  DollarSign,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatPrice(value) {
  if (value == null) return null;
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
  return isNaN(num) ? null : `$${num.toFixed(2)}`;
}

function SoldBadge({ price, originalPrice }) {
  const formatted = formatPrice(price);
  const orig = formatPrice(originalPrice);
  if (!formatted) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-sm px-3 py-1">
        {formatted}
      </Badge>
      {orig && orig !== formatted && (
        <span className="text-xs text-muted-foreground line-through">{orig}</span>
      )}
    </div>
  );
}

function ConditionBadge({ condition }) {
  if (!condition) return null;
  const lower = condition.toLowerCase();
  const variant =
    lower.includes('new') ? 'default' :
    lower.includes('refurb') ? 'secondary' :
    'outline';
  return <Badge variant={variant} className="text-xs">{condition}</Badge>;
}

function TrendingBanner({ text }) {
  if (!text) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1.5">
      <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function WatchCount({ count }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Eye className="w-3.5 h-3.5" />
      <span>{count.toLocaleString()} watching</span>
    </div>
  );
}

// ─── Result Card (list view) ───────────────────────────────────────────────

function SoldResultCard({ item, isSelected, onClick }) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-150',
        isSelected
          ? 'ring-2 ring-primary border-primary shadow-md'
          : 'hover:border-primary/50 hover:shadow-sm',
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex gap-3 sm:gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-muted">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Package className="w-8 h-8 opacity-40" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <h3 className="font-medium text-sm leading-snug line-clamp-2">{item.title}</h3>

            <SoldBadge price={item.price} originalPrice={item.originalPrice} />

            <div className="flex flex-wrap items-center gap-1.5">
              <ConditionBadge condition={item.condition} />
              {item.topRated && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Top Rated</Badge>
              )}
              {item.buyingFormat && (
                <Badge variant="outline" className="text-xs">{item.buyingFormat}</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {item.seller && <span>Seller: {item.seller}</span>}
              {item.shippingRaw && (
                <span className="flex items-center gap-0.5">
                  <Truck className="w-3 h-3" />
                  {item.shippingRaw}
                </span>
              )}
              {item.returns && (
                <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                  <RotateCcw className="w-3 h-3" />
                  {item.returns}
                </span>
              )}
              {item.watchersRaw && (
                <span className="flex items-center gap-0.5">
                  <Eye className="w-3 h-3" />
                  {item.watchersRaw}
                </span>
              )}
              {item.quantitySoldRaw && (
                <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  {item.quantitySoldRaw}
                </span>
              )}
            </div>
            {item.promotion && (
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{item.promotion}</p>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-1 text-primary hover:text-primary mt-0.5"
              onClick={(e) => {
                e.stopPropagation();
                window.open(item.productUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View on eBay
            </Button>
          </div>

          {/* Expand indicator */}
          <div className="flex-shrink-0 flex items-center self-center text-muted-foreground">
            <ChevronRight className={cn('w-4 h-4 transition-transform', isSelected && 'rotate-90 text-primary')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailSection({ icon: Icon, title, children }) {
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

function ImageGallery({ images }) {
  const [active, setActive] = useState(0);
  if (!images || images.length === 0) return null;

  const main = images[active] || images[0];
  const mainSrc = typeof main === 'string' ? main : main?.link;

  return (
    <div className="space-y-2">
      <div className="relative bg-muted rounded-lg overflow-hidden aspect-square w-full max-w-[260px] mx-auto">
        <img src={mainSrc} alt="Product" className="w-full h-full object-contain p-2" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 justify-center flex-wrap">
          {images.slice(0, 6).map((img, i) => {
            const src = typeof img === 'string' ? img : img?.link;
            return (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={cn(
                  'w-12 h-12 rounded border-2 overflow-hidden flex-shrink-0 transition-all',
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

function DetailPanel({ productId, listItem }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    setDetail(null);
    setError(null);
    setLoading(true);

    fetch(`/api/ebay/sold-search?product_id=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setDetail(data.product_results || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [productId]);

  const pr = detail;

  // Build image list from product detail or fall back to list thumbnail
  const images = pr?.media
    ? pr.media
        .filter((m) => m.type === 'image')
        .flatMap((m) => m.image || [])
        .filter((img) => img?.size?.width >= 400 || !img?.size)
        .map((img) => img.link)
    : listItem?.imageUrl ? [listItem.imageUrl] : [];

  const price =
    pr?.buy?.buy_it_now?.price?.amount
    ?? pr?.buy?.auction?.current_price?.amount
    ?? listItem?.price;

  const currency = pr?.buy?.buy_it_now?.price?.currency ?? 'USD';

  const shipping = pr?.shipping;
  const returns = pr?.returns?.[0]?.[0];
  const seller = pr?.seller;

  return (
    <div className="space-y-4">
      {/* Loading overlay */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
          <Loader2 className="w-7 h-7 animate-spin" />
          <p className="text-sm">Loading product details…</p>
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-muted-foreground italic">Extended details unavailable for this listing.</p>
      )}

      {/* Gallery */}
      {images.length > 0 && <ImageGallery images={images} />}

      {/* Title & price */}
      <div className="space-y-2">
        <p className="font-semibold text-base leading-snug">
          {pr?.title || listItem?.title}
        </p>
        {pr?.subtitle && <p className="text-xs text-muted-foreground">{pr.subtitle}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {price != null && (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-base px-3 py-1">
              {currency === 'USD' ? '$' : ''}{Number(price).toFixed(2)}
            </Badge>
          )}
          {pr?.condition && <ConditionBadge condition={pr.condition} />}
        </div>

        {/* Trending / social proof from product detail */}
        {pr?.banner_status && <TrendingBanner text={pr.banner_status} />}
        {pr?.watch_count != null && <WatchCount count={pr.watch_count} />}

        {/* Social proof from list data */}
        <div className="flex flex-wrap gap-3">
          {listItem?.watchersRaw && !pr?.watch_count && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              <span>{listItem.watchersRaw}</span>
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
        {listItem?.promotion && (
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{listItem.promotion}</p>
        )}
      </div>

      <Separator />

      {/* Shipping */}
      {(shipping?.options?.length > 0 || listItem?.shippingRaw) && (
        <DetailSection icon={Truck} title="Shipping">
          {shipping?.options?.length > 0 ? (
            <div className="space-y-1 text-muted-foreground">
              {shipping.options.map((opt, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>
                    {opt.via && <span className="font-medium text-foreground">{opt.via} — </span>}
                    {opt.price?.amount != null
                      ? opt.price.amount === 0 ? 'Free' : `$${opt.price.amount.toFixed(2)}`
                      : ''}
                    {opt.dates?.list?.length > 0 && ` · Est. ${opt.dates.list.join(' – ')}`}
                  </span>
                </div>
              ))}
              {shipping.from && (
                <p className="text-xs text-muted-foreground mt-1">Ships from: {shipping.from}</p>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{listItem?.shippingRaw}</span>
          )}
        </DetailSection>
      )}

      {/* Returns */}
      {(returns || listItem?.returns) && (
        <DetailSection icon={RotateCcw} title="Returns">
          {returns?.snippets ? (
            <div className="space-y-1 text-muted-foreground">
              {returns.snippets.map((s, i) => (
                <p key={i} className="text-xs">{s.text}</p>
              ))}
            </div>
          ) : (
            <span className="text-sm text-green-600 dark:text-green-400">{listItem?.returns}</span>
          )}
        </DetailSection>
      )}

      {/* Description */}
      {pr?.short_description && (
        <DetailSection icon={Package} title="Description">
          <p className="text-sm text-muted-foreground leading-relaxed">{pr.short_description}</p>
        </DetailSection>
      )}

      {/* Seller */}
      {(seller || listItem?.seller) && (
        <DetailSection icon={Star} title="Seller">
          <div className="flex flex-wrap gap-3 text-muted-foreground">
            <span className="font-medium text-foreground">
              {seller?.name || listItem?.seller}
            </span>
            {(seller?.positive_feedback_percent ?? listItem?.sellerFeedback) != null && (
              <span className="flex items-center gap-0.5 text-xs">
                <Star className="w-3 h-3 text-amber-400" />
                {seller?.positive_feedback_percent ?? listItem?.sellerFeedback}% positive
              </span>
            )}
            {(seller?.feedback_score ?? listItem?.sellerReviews) != null && (
              <span className="text-xs">
                {(seller?.feedback_score ?? listItem?.sellerReviews)?.toLocaleString()} ratings
              </span>
            )}
          </div>
        </DetailSection>
      )}

      {/* Payment */}
      {pr?.payment_methods?.payments?.length > 0 && (
        <DetailSection icon={CreditCard} title="Payment">
          <div className="flex flex-wrap gap-1.5">
            {pr.payment_methods.payments.map((p, i) => (
              <Badge key={i} variant="outline" className="text-xs">{p.title}</Badge>
            ))}
          </div>
        </DetailSection>
      )}

      {/* View on eBay link */}
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

// ─── Main Dialog ──────────────────────────────────────────────────────────────

function EbaySoldDialogInner({ open, onOpenChange, initialQuery = '' }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const inputRef = useRef(null);

  // Seed from initialQuery when dialog opens
  useEffect(() => {
    if (open && initialQuery) {
      setSearchQuery(initialQuery);
    }
    if (!open) {
      setResults([]);
      setTotal(0);
      setSelectedItem(null);
      setShowDetail(false);
      setError(null);
    }
  }, [open, initialQuery]);

  // Auto-search when dialog opens with a pre-filled query
  useEffect(() => {
    if (open && initialQuery && initialQuery.trim().length >= 2) {
      handleSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSearch = useCallback(async (overrideQuery) => {
    const q = (overrideQuery ?? searchQuery).trim();
    if (q.length < 2) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setTotal(0);
    setSelectedItem(null);
    setShowDetail(false);

    try {
      const resp = await fetch(`/api/ebay/sold-search?q=${encodeURIComponent(q)}&num=40`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results || []);
      setTotal(data.total || data.results?.length || 0);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('SERPAPI_KEY') || msg.includes('not configured')) {
        setError('eBay sold search requires a SERPAPI_KEY. Add it to your Vercel environment variables at serpapi.com, then redeploy.');
      } else {
        setError(msg || 'Search failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleSelectItem = (item) => {
    if (selectedItem?.product_id === item.product_id && showDetail) {
      setShowDetail(false);
      setSelectedItem(null);
    } else {
      setSelectedItem(item);
      setShowDetail(true);
    }
  };

  const ebaySoldUrl = searchQuery.trim()
    ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery.trim())}&LH_Sold=1&LH_Complete=1`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[92vw] max-w-[80rem] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Search eBay Sold Listings
          </DialogTitle>
          <DialogDescription>
            View recently sold items on eBay to gauge market value and demand.
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="px-6 py-3 border-b flex-shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="e.g., Jordan 1 Retro High OG, PS5 console…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
              autoFocus
            />
            <Button
              onClick={() => handleSearch()}
              disabled={loading || searchQuery.trim().length < 2}
              className="gap-2 whitespace-nowrap"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </Button>
          </div>
          {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
            <p className="text-xs text-muted-foreground mt-1">Enter at least 2 characters to search</p>
          )}
        </div>

        {/* Body: two-panel layout on lg+ */}
        <div className={cn('flex-1 min-h-0 flex', showDetail ? 'flex-col lg:flex-row' : 'flex-col')}>
          {/* Results list */}
          <div className={cn('flex-1 min-h-0 overflow-y-auto', showDetail && 'lg:max-w-sm lg:border-r')}>
            <div className="p-4 space-y-3">
              {/* Idle state */}
              {!loading && !error && results.length === 0 && !searchQuery && (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Search for sold eBay items</p>
                  <p className="text-sm mt-1">Enter a product name above to see recent sold prices</p>
                </div>
              )}

              {/* No results */}
              {!loading && !error && results.length === 0 && searchQuery.trim().length >= 2 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No sold listings found</p>
                  <p className="text-sm mt-1">Try a different or shorter search term</p>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <p className="text-sm">Searching eBay sold listings…</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <Alert variant="destructive" className="mx-1">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription className="text-sm leading-snug">{error}</AlertDescription>
                </Alert>
              )}

              {/* Results */}
              {!loading && results.map((item, idx) => (
                <SoldResultCard
                  key={item.product_id || idx}
                  item={item}
                  isSelected={selectedItem?.product_id === item.product_id}
                  onClick={() => handleSelectItem(item)}
                />
              ))}
            </div>
          </div>

          {/* Detail panel */}
          {showDetail && selectedItem && (
            <div className="lg:w-[420px] flex-shrink-0 border-t lg:border-t-0 overflow-y-auto">
              <div className="p-4 space-y-4">
                <button
                  onClick={() => { setShowDetail(false); setSelectedItem(null); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors lg:hidden"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to results
                </button>
                <DetailPanel
                  productId={selectedItem.product_id}
                  listItem={selectedItem}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex-shrink-0 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {results.length > 0 && (
              <span className="text-sm text-muted-foreground">
                Showing {results.length}{total > results.length ? ` of ${total.toLocaleString()}` : ''} sold items
              </span>
            )}
            {ebaySoldUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary p-0 hover:text-primary/80"
                onClick={() => window.open(ebaySoldUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View all sold on eBay
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Only mount the heavy inner component when open (avoids stale hook state)
export default function EbaySoldDialog(props) {
  if (!props?.open) return null;
  return <EbaySoldDialogInner {...props} />;
}
