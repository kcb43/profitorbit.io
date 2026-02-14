# Orben Feed Card Schema

Design spec for deal card components in the frontend.

---

## Card Data Structure

### TypeScript Interface

```typescript
interface DealCard {
  // Core fields
  id: string;                    // UUID
  title: string;                 // "PlayStation 5 Console - 50% Off"
  url: string;                   // Original deal URL
  
  // Pricing
  price?: number;                // 299.99
  currency?: string;             // "USD"
  original_price?: number;       // 599.99
  shipping_price?: number;       // 0 or null (free)
  coupon_code?: string;          // "SAVE50"
  
  // Metadata
  merchant?: string;             // "Best Buy"
  category?: string;             // "Electronics"
  description?: string;          // Short description
  image_url?: string;            // Product image
  
  // Orben-specific
  score: number;                 // 0-100 reseller value score
  roi_estimate?: number;         // Estimated profit margin %
  source_name: string;           // "Slickdeals"
  
  // Timestamps
  posted_at?: string;            // ISO8601
  created_at: string;            // ISO8601
  ends_at?: string;              // ISO8601 (expiration)
  
  // User state (computed)
  is_saved?: boolean;            // If user saved this deal
}
```

---

## Visual Layout

### Card Anatomy

```
┌─────────────────────────────────────┐
│  [IMAGE]                      [70]  │ ← Image + Score badge
│                             (score) │
│  [-30% OFF]                         │ ← Discount badge (if applicable)
├─────────────────────────────────────┤
│  PlayStation 5 Console Bundle       │ ← Title (2 lines max)
│                                     │
│  [Best Buy] [Electronics]           │ ← Merchant + Category badges
│                                     │
│  💲 $299.99  ̶$̶5̶9̶9̶.̶9̶9̶             │ ← Price (old price crossed out)
│                                     │
│  📋 Code: SAVE50                    │ ← Coupon (if exists)
│                                     │
│  [View Deal 🔗]  [💾 Save]          │ ← Action buttons
│                                     │
│  Posted 2h ago • Slickdeals         │ ← Timestamp + source
└─────────────────────────────────────┘
```

---

## React Component Props

### `<DealCard>` Component

```jsx
<DealCard
  deal={dealObject}
  isSaved={boolean}
  onSave={(dealId) => handleSave(dealId)}
  onUnsave={(dealId) => handleUnsave(dealId)}
  onView={(url) => window.open(url)}
/>
```

### Example Usage

```jsx
import { DealCard } from '@/components/deals/DealCard';

function DealFeed() {
  const deals = useDealFeed({ minScore: 50 });
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {deals.map(deal => (
        <DealCard 
          key={deal.id} 
          deal={deal}
          isSaved={savedDealIds.has(deal.id)}
          onSave={handleSave}
          onUnsave={handleUnsave}
        />
      ))}
    </div>
  );
}
```

---

## Visual Specs

### Card Dimensions

- **Width:** Responsive (grid-based)
  - Mobile: 100% (1 column)
  - Tablet: 50% (2 columns)
  - Desktop: 33% (3 columns)
  - Large: 25% (4 columns)

- **Height:** Auto (content-based)
- **Image aspect ratio:** 16:9 or 4:3
- **Image height:** 192px (12rem)

### Colors (Tailwind)

**Score badges:**
```javascript
score >= 70: 'bg-green-500 text-white'    // Hot deal
score >= 50: 'bg-yellow-500 text-white'   // Good deal
score < 50:  'bg-gray-400 text-white'     // Okay deal
```

**Discount badges:**
```javascript
discount >= 50: 'bg-red-600 text-white'
discount >= 30: 'bg-red-500 text-white'
discount < 30:  'bg-orange-500 text-white'
```

**Category badges:**
```css
border: 1px solid gray-300
background: gray-100
text: gray-700
```

**Merchant badges:**
```css
border: 1px solid blue-300
background: blue-50
text: blue-700
```

### Typography

- **Title:** `font-semibold text-lg` (18px), 2-line clamp
- **Price:** `font-bold text-2xl text-green-600`
- **Original price:** `text-sm text-gray-500 line-through`
- **Badges:** `text-xs uppercase`
- **Timestamp:** `text-xs text-gray-500`

---

## Computed Fields

### Discount Percentage

```javascript
function calculateDiscount(price, originalPrice) {
  if (!price || !originalPrice || originalPrice <= price) return null;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}
```

Display: `-30% OFF` badge in top-left corner

### Time Ago

```javascript
import { formatDistanceToNow } from 'date-fns';

function getTimeAgo(posted_at) {
  if (!posted_at) return null;
  return formatDistanceToNow(new Date(posted_at), { addSuffix: true });
}
```

Display: `Posted 2 hours ago`

### Savings Amount

```javascript
function getSavings(price, originalPrice) {
  if (!price || !originalPrice) return null;
  return originalPrice - price;
}
```

Display: `Save $300` (optional, could add to card)

---

## Interaction States

### Hover State

```css
hover:shadow-lg
hover:scale-[1.02]
transition-all duration-200
```

### Loading State (Skeleton)

```jsx
<Card className="animate-pulse">
  <div className="h-48 bg-gray-200" />
  <div className="p-4 space-y-3">
    <div className="h-4 bg-gray-200 rounded w-3/4" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
  </div>
</Card>
```

### Saved State

```jsx
<Button variant={isSaved ? 'default' : 'outline'}>
  <Bookmark className={isSaved ? 'fill-current' : ''} />
</Button>
```

---

## Feed Layout Patterns

### Grid View (Default)

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {deals.map(deal => <DealCard key={deal.id} deal={deal} />)}
</div>
```

### List View (Compact)

```jsx
<div className="space-y-4">
  {deals.map(deal => <DealCardCompact key={deal.id} deal={deal} />)}
</div>
```

### Masonry View (Pinterest-style)

```jsx
// Could use react-masonry-css or similar
<Masonry columns={3} gap={24}>
  {deals.map(deal => <DealCard key={deal.id} deal={deal} />)}
</Masonry>
```

---

## Sorting Options

```javascript
const sortOptions = [
  { value: 'score', label: 'Best Deals' },      // score DESC
  { value: 'newest', label: 'Newest' },         // posted_at DESC
  { value: 'price_low', label: 'Price: Low' },  // price ASC
  { value: 'price_high', label: 'Price: High' }, // price DESC
  { value: 'discount', label: 'Biggest Discount' } // (original_price - price) DESC
];
```

Backend would need to add `sort` param to feed endpoint.

---

## Filter Panel Schema

### Available Filters

```javascript
{
  search: string,           // Text search in title
  merchant: string,         // Exact or ILIKE match
  category: string,         // Exact or ILIKE match
  minScore: number,         // 0-100 slider
  minPrice: number,         // Price range
  maxPrice: number,         // Price range
  hasCoupon: boolean,       // Only deals with coupon codes
  freeShipping: boolean,    // Only free shipping
  sources: string[]         // Filter by source (e.g., ['Slickdeals', 'DealNews'])
}
```

### UI Components

```jsx
<Card>
  <CardContent>
    {/* Search */}
    <Input placeholder="Search deals..." />
    
    {/* Score slider */}
    <div>
      <Label>Min Score: {minScore}</Label>
      <Slider value={minScore} onChange={setMinScore} min={0} max={100} />
    </div>
    
    {/* Category dropdown */}
    <Select value={category} onChange={setCategory}>
      <option value="">All Categories</option>
      <option value="Electronics">Electronics</option>
      <option value="Home">Home & Garden</option>
      {/* ... */}
    </Select>
    
    {/* Toggles */}
    <Checkbox checked={freeShipping} onChange={setFreeShipping}>
      Free Shipping Only
    </Checkbox>
    <Checkbox checked={hasCoupon} onChange={setHasCoupon}>
      Has Coupon Code
    </Checkbox>
  </CardContent>
</Card>
```

---

## Empty States

### No Deals Found

```jsx
<Card className="p-12">
  <div className="text-center">
    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
    <h3 className="text-lg font-medium mb-2">No deals found</h3>
    <p className="text-gray-600">
      Try adjusting your filters or check back later
    </p>
  </div>
</Card>
```

### Loading State

```jsx
<div className="text-center py-12">
  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
  <p className="text-gray-600">Loading deals...</p>
</div>
```

---

## Deal Detail View (Optional)

Clicking a deal card could open a modal or navigate to `/deals/:id`:

```jsx
<Dialog>
  <DialogContent>
    <img src={deal.image_url} className="w-full h-64 object-cover mb-4" />
    <h2 className="text-2xl font-bold mb-2">{deal.title}</h2>
    
    <div className="flex gap-2 mb-4">
      <Badge>{deal.merchant}</Badge>
      <Badge variant="secondary">{deal.category}</Badge>
      <Badge className={getScoreColor(deal.score)}>{deal.score}</Badge>
    </div>
    
    <p className="text-gray-700 mb-4">{deal.description}</p>
    
    <div className="bg-green-50 p-4 rounded mb-4">
      <div className="text-3xl font-bold text-green-600">${deal.price}</div>
      {deal.original_price && (
        <div className="text-gray-500 line-through">${deal.original_price}</div>
      )}
    </div>
    
    {deal.coupon_code && (
      <Alert className="mb-4">
        <p>Use code: <code className="font-bold">{deal.coupon_code}</code></p>
      </Alert>
    )}
    
    <Button className="w-full" onClick={() => window.open(deal.url)}>
      View Deal on {deal.merchant}
    </Button>
  </DialogContent>
</Dialog>
```

---

## Accessibility

### ARIA Labels

```jsx
<Card role="article" aria-labelledby={`deal-${deal.id}`}>
  <h3 id={`deal-${deal.id}`}>{deal.title}</h3>
  <Button aria-label={`Save ${deal.title}`} onClick={handleSave}>
    <Bookmark />
  </Button>
  <a 
    href={deal.url} 
    target="_blank" 
    rel="noopener noreferrer"
    aria-label={`View ${deal.title} on ${deal.merchant}`}
  >
    View Deal
  </a>
</Card>
```

---

## Mobile Optimizations

### Touch Targets

- Minimum button size: 44x44px
- Adequate spacing between interactive elements
- Large tap areas for save/view buttons

### Responsive Images

```jsx
<img 
  src={deal.image_url} 
  alt={deal.title}
  loading="lazy"
  className="w-full h-48 object-cover"
  onError={(e) => {
    e.target.src = '/placeholder-deal.png'; // Fallback image
  }}
/>
```

### Swipe Actions (Future)

Could add swipe-to-save on mobile:

```jsx
import { useSwipeable } from 'react-swipeable';

const handlers = useSwipeable({
  onSwipedLeft: () => handleSave(deal.id),
  onSwipedRight: () => handleUnsave(deal.id)
});

<div {...handlers}>
  <DealCard deal={deal} />
</div>
```

---

## API Response Format

### Feed Endpoint Response

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "PlayStation 5 Console - Digital Edition",
      "url": "https://bestbuy.com/...",
      "price": 399.99,
      "currency": "USD",
      "original_price": 499.99,
      "shipping_price": 0,
      "coupon_code": null,
      "merchant": "Best Buy",
      "category": "Gaming",
      "description": "Digital edition PS5 with controller",
      "image_url": "https://...",
      "score": 85,
      "roi_estimate": null,
      "posted_at": "2026-02-13T10:30:00Z",
      "created_at": "2026-02-13T10:31:05Z",
      "ends_at": null
    }
  ],
  "count": 1,
  "has_more": true,
  "next_cursor": "page2"
}
```

---

## Performance Optimizations

### Lazy Loading Images

```jsx
import { useState } from 'react';

function DealImage({ src, alt }) {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div className="relative">
      {!loaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
      <img 
        src={src} 
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={loaded ? 'opacity-100' : 'opacity-0'}
      />
    </div>
  );
}
```

### Virtualization (for 1000+ deals)

```jsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedDealFeed({ deals }) {
  const parentRef = useRef();
  
  const virtualizer = useVirtualizer({
    count: deals.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400, // Estimated card height
  });
  
  return (
    <div ref={parentRef} style={{ height: '800px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <DealCard deal={deals[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Analytics Events (Optional)

Track user engagement:

```javascript
// Deal viewed
analytics.track('deal_viewed', {
  deal_id: deal.id,
  score: deal.score,
  merchant: deal.merchant,
  source: deal.source_name
});

// Deal clicked
analytics.track('deal_clicked', {
  deal_id: deal.id,
  url: deal.url,
  price: deal.price
});

// Deal saved
analytics.track('deal_saved', {
  deal_id: deal.id,
  score: deal.score
});
```

---

## Share Functionality (Future)

```jsx
function ShareDealButton({ deal }) {
  const shareUrl = `https://yourapp.com/deals/${deal.id}`;
  
  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: deal.title,
        text: `Check out this deal: ${deal.title} - $${deal.price}`,
        url: shareUrl
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied!' });
    }
  };
  
  return <Button onClick={handleShare}>Share</Button>;
}
```

---

## Feed Header Component

### Stats Bar

```jsx
<div className="grid grid-cols-4 gap-4 mb-6">
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm text-gray-600">Active Deals</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{totalDeals}</div>
    </CardContent>
  </Card>
  
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm text-gray-600">Avg Score</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{avgScore}</div>
    </CardContent>
  </Card>
  
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm text-gray-600">Hot Deals (70+)</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{hotDealsCount}</div>
    </CardContent>
  </Card>
  
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm text-gray-600">Saved</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{savedCount}</div>
    </CardContent>
  </Card>
</div>
```

---

## Category Icons (Optional)

```javascript
const categoryIcons = {
  'Electronics': <Smartphone className="w-4 h-4" />,
  'Gaming': <Gamepad2 className="w-4 h-4" />,
  'Home': <Home className="w-4 h-4" />,
  'Tools': <Wrench className="w-4 h-4" />,
  'Fashion': <Shirt className="w-4 h-4" />,
  'Sports': <Dumbbell className="w-4 h-4" />,
};
```

Display next to category badge for visual appeal.

---

## Real Example

### API Response (Single Deal)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "LEGO Star Wars Millennium Falcon - 40% Off",
  "url": "https://amazon.com/dp/B0CXXX",
  "price": 95.99,
  "currency": "USD",
  "original_price": 159.99,
  "shipping_price": 0,
  "coupon_code": null,
  "merchant": "Amazon",
  "category": "Toys",
  "description": "7,541 pieces, includes 7 minifigures",
  "image_url": "https://m.media-amazon.com/images/I/81example.jpg",
  "score": 88,
  "roi_estimate": null,
  "posted_at": "2026-02-13T14:30:00Z",
  "created_at": "2026-02-13T14:31:15Z",
  "ends_at": "2026-02-14T23:59:59Z"
}
```

### Rendered Card (Visual)

```
┌─────────────────────────────────┐
│ 🖼️  LEGO Image          [88]    │
│                      (green)    │
│ [-40% OFF] (red badge)          │
├─────────────────────────────────┤
│ LEGO Star Wars Millennium       │
│ Falcon - 40% Off                │
│                                 │
│ [Amazon] [Toys]                 │
│                                 │
│ 💲 $95.99  ̶$̶1̶5̶9̶.̶9̶9̶           │
│ 🚚 Free Shipping                │
│                                 │
│ [View Deal 🔗]  [💾 Save]       │
│                                 │
│ 🕐 Posted 2 hours ago           │
│ 📰 From Slickdeals              │
└─────────────────────────────────┘
```

**Score: 88** (green) = Hot deal!  
**Discount: 40%** = Major savings  
**Free Shipping** = Bonus indicator  

---

## Summary

✅ **Component:** `<DealCard>` (grid or list variants)  
✅ **Data structure:** 20 fields (price, score, timestamps, etc.)  
✅ **Visual hierarchy:** Image → Title → Price → Actions  
✅ **Responsive:** 1-4 columns based on screen size  
✅ **Interactive:** Hover effects, save/unsave, external links  
✅ **Accessible:** ARIA labels, keyboard navigation  
✅ **Performant:** Lazy loading, virtualization ready  

**Already implemented in:** `src/pages/Deals.jsx` (lines 80-180)

Use this as the spec for any future UI work or design reviews!
