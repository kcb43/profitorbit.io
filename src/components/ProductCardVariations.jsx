import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Star, TrendingUp, ShoppingCart, ExternalLink, Package, Truck, Award, ChevronDown, ChevronUp, Store } from 'lucide-react';

// Shared utility functions
const getMerchantColor = (merchant) => {
  const colors = {
    'Walmart': 'bg-blue-600 text-white',
    'Best Buy': 'bg-yellow-600 text-white',
    'Target': 'bg-red-600 text-white',
    'Amazon': 'bg-orange-600 text-white',
    'eBay': 'bg-purple-600 text-white',
    'T-Mobile': 'bg-pink-600 text-white',
    'Home Depot': 'bg-orange-700 text-white',
    'Lowe\'s': 'bg-blue-700 text-white',
    'GameStop': 'bg-red-700 text-white',
    'Chewy': 'bg-blue-500 text-white',
    'PetSmart': 'bg-blue-600 text-white',
    'Petco': 'bg-blue-700 text-white'
  };
  return colors[merchant] || 'bg-gray-700 text-white';
};

const extractItemData = (item) => ({
  title: item.title || '',
  imageUrl: item.image_url || item.thumbnail || '',
  price: item.price || item.extracted_price || 0,
  oldPrice: item.old_price || item.extracted_old_price || null,
  merchant: item.merchant || item.source || 'Unknown',
  productLink: item.link || item.url || '', // Prioritize direct merchant link
  rating: item.rating || null,
  reviews: item.reviews || item.reviews_count || null,
  snippet: item.snippet || '',
  extensions: item.extensions || [],
  tag: item.tag || '',
  badge: item.badge || '',
  delivery: item.delivery || '',
  condition: item.condition || item.second_hand_condition || '',
  position: item.position || null,
  sourceIcon: item.source_icon || '',
  productId: item.product_id || '',
  installment: item.installment || '',
  alternativePrice: item.alternative_price || '',
  currency: item.currency || 'USD',
  merchantOffers: item.merchantOffers || [],
  merchantOffersLoaded: item.merchantOffersLoaded || false,
  hasDirectLink: item.link && item.link.includes('http'), // Check if we have a real direct link
  multipleStores: item.multiple_sources || false
});

// ========================================
// V1: MODERN MINIMAL - Clean, spacious, professional (Dark mode compatible)
// ========================================
export function ProductCardV1Grid({ item }) {
  const data = extractItemData(item);
  const primaryOffer = data.merchantOffers?.[0];
  const viewLink = primaryOffer?.link || data.productLink;
  const savings = data.oldPrice && data.oldPrice > data.price ? data.oldPrice - data.price : null;
  const [showMoreStores, setShowMoreStores] = useState(false);

  // Sort merchant offers by price (low to high)
  const sortedOffers = [...(data.merchantOffers || [])].sort((a, b) => 
    (a.extracted_price || 0) - (b.extracted_price || 0)
  );

  return (
    <Card className="group overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-2xl transition-all duration-300 bg-white dark:bg-gray-900">
      {/* Image Section */}
      <div className="relative h-56 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 overflow-hidden">
        {data.tag && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-red-500 text-white font-bold px-3 py-1 shadow-lg">
              {data.tag}
            </Badge>
          </div>
        )}
        <img
          src={data.imageUrl}
          alt={data.title}
          className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500"
          onError={(e) => e.target.style.display = 'none'}
        />
      </div>

      <CardContent className="p-5 space-y-4">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base line-clamp-2 min-h-[3rem] leading-tight">
          {data.title}
        </h3>

        {/* Price Section */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              ${data.price.toFixed(2)}
            </span>
            {savings && (
              <div className="flex flex-col">
                <span className="text-sm text-gray-400 dark:text-gray-500 line-through">${data.oldPrice.toFixed(2)}</span>
                <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Save ${savings.toFixed(2)}</span>
              </div>
            )}
          </div>
          {data.installment && (
            <p className="text-xs text-gray-500 dark:text-gray-400">or {data.installment}</p>
          )}
        </div>

        {/* Rating & Reviews */}
        {data.rating && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{data.rating}</span>
            </div>
            {data.reviews && (
              <span className="text-xs text-gray-500 dark:text-gray-400">({data.reviews.toLocaleString()} reviews)</span>
            )}
          </div>
        )}

        {/* Merchant */}
        <div className="flex items-center gap-2">
          <Badge className={`${getMerchantColor(data.merchant)} px-3 py-1`}>
            {data.merchant}
          </Badge>
        </div>

        {/* Delivery Info */}
        {data.delivery && (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Truck className="w-4 h-4" />
            <span>{data.delivery}</span>
          </div>
        )}

        {/* Action Button - Fixed height container */}
        <div className="pt-2">
          <Button 
            asChild 
            className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-semibold"
          >
            <a href={viewLink} target="_blank" rel="noopener noreferrer">
              View Item
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>
      </CardContent>

      {/* Other Stores - Collapsible Section at Bottom */}
      {sortedOffers.length > 1 && (
        <Collapsible open={showMoreStores} onOpenChange={setShowMoreStores}>
          <CollapsibleTrigger className="w-full border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Store className="w-4 h-4" />
              +{sortedOffers.length - 1} other store{sortedOffers.length > 2 ? 's' : ''}
            </span>
            {showMoreStores ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="p-4 space-y-2">
              {sortedOffers.map((offer, idx) => (
                <a
                  key={idx}
                  href={offer.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {offer.name || offer.merchant || 'Store'}
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                    ${(offer.extracted_price || offer.price || 0).toFixed(2)}
                  </span>
                </a>
              ))}
              
              {/* Close button at bottom */}
              <button
                onClick={() => setShowMoreStores(false)}
                className="w-full mt-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center justify-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-3"
              >
                <ChevronUp className="w-4 h-4" />
                Close
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}

export function ProductCardV1List({ item }) {
  const data = extractItemData(item);
  const primaryOffer = data.merchantOffers?.[0];
  const viewLink = primaryOffer?.link || data.productLink;
  const savings = data.oldPrice && data.oldPrice > data.price ? data.oldPrice - data.price : null;
  const [showMoreStores, setShowMoreStores] = useState(false);

  // Sort merchant offers by price (low to high)
  const sortedOffers = [...(data.merchantOffers || [])].sort((a, b) => 
    (a.extracted_price || 0) - (b.extracted_price || 0)
  );

  return (
    <Card className="group overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xl transition-all duration-300 bg-white dark:bg-gray-900">
      <div className="flex gap-5 p-5">
        {/* Image Section - Left */}
        <div className="relative w-40 h-40 flex-shrink-0 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-hidden">
          {data.tag && (
            <div className="absolute top-2 right-2 z-10">
              <Badge className="bg-red-500 text-white text-xs px-2 py-0.5">{data.tag}</Badge>
            </div>
          )}
          <img
            src={data.imageUrl}
            alt={data.title}
            className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500"
            onError={(e) => e.target.style.display = 'none'}
          />
        </div>

        {/* Content - Middle */}
        <div className="flex-1 min-w-0 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg line-clamp-2 leading-tight">
            {data.title}
          </h3>

          <div className="flex items-center gap-3">
            <Badge className={`${getMerchantColor(data.merchant)} px-3 py-1`}>
              {data.merchant}
            </Badge>
          </div>

          {data.rating && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-semibold text-sm dark:text-gray-100">{data.rating}</span>
              </div>
              {data.reviews && (
                <span className="text-sm text-gray-500 dark:text-gray-400">({data.reviews.toLocaleString()})</span>
              )}
            </div>
          )}

          {data.snippet && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{data.snippet}</p>
          )}

          {data.delivery && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Truck className="w-4 h-4" />
              <span>{data.delivery}</span>
            </div>
          )}
        </div>

        {/* Price & Action - Right */}
        <div className="flex flex-col justify-between items-end w-48 flex-shrink-0">
          <div className="text-right space-y-1">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              ${data.price.toFixed(2)}
            </div>
            {savings ? (
              <>
                <div className="text-sm text-gray-400 dark:text-gray-500 line-through">${data.oldPrice.toFixed(2)}</div>
                <div className="text-sm text-green-600 dark:text-green-400 font-semibold">Save ${savings.toFixed(2)}</div>
              </>
            ) : (
              <div className="h-10"></div>
            )}
            {data.installment && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{data.installment}</p>
            )}
          </div>

          <Button 
            asChild 
            className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-semibold mt-auto"
          >
            <a href={viewLink} target="_blank" rel="noopener noreferrer">
              View Item
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>
      </div>

      {/* Other Stores - Collapsible Section at Bottom */}
      {sortedOffers.length > 1 && (
        <Collapsible open={showMoreStores} onOpenChange={setShowMoreStores}>
          <CollapsibleTrigger className="w-full border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Store className="w-4 h-4" />
              +{sortedOffers.length - 1} other store{sortedOffers.length > 2 ? 's' : ''}
            </span>
            {showMoreStores ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="p-4 space-y-2">
              {sortedOffers.map((offer, idx) => (
                <a
                  key={idx}
                  href={offer.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {offer.name || offer.merchant || 'Store'}
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                    ${(offer.extracted_price || offer.price || 0).toFixed(2)}
                  </span>
                </a>
              ))}
              
              {/* Close button at bottom */}
              <button
                onClick={() => setShowMoreStores(false)}
                className="w-full mt-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center justify-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-3"
              >
                <ChevronUp className="w-4 h-4" />
                Close
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}

// ========================================
// V2: BOLD & VIBRANT - Colorful, energetic, attention-grabbing
// ========================================
export function ProductCardV2Grid({ item }) {
  const data = extractItemData(item);
  const primaryOffer = data.merchantOffers?.[0];
  const viewLink = primaryOffer?.link || data.productLink;
  const savings = data.oldPrice && data.oldPrice > data.price ? data.oldPrice - data.price : null;

  return (
    <Card className="group overflow-hidden border-2 border-purple-200 hover:border-purple-500 hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Image with Overlay */}
      <div className="relative h-52 bg-gradient-to-br from-purple-100 to-pink-100 overflow-hidden">
        {/* Decorative corner */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-purple-500 to-transparent opacity-20"></div>
        
        {data.tag && (
          <div className="absolute top-3 right-3 z-10 animate-bounce">
            <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold px-3 py-1.5 shadow-lg border-2 border-white">
              {data.tag}
            </Badge>
          </div>
        )}
        {data.position && (
          <div className="absolute top-3 left-3 z-10">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold px-3 py-1.5 rounded-full shadow-lg">
              #{data.position}
            </div>
          </div>
        )}
        <img
          src={data.imageUrl}
          alt={data.title}
          className="w-full h-full object-contain p-3 group-hover:scale-110 group-hover:rotate-2 transition-all duration-500"
          onError={(e) => e.target.style.display = 'none'}
        />
      </div>

      <CardContent className="p-5 space-y-3">
        {/* Merchant Badge - Prominent */}
        <div className="flex items-center justify-between">
          <Badge className={`${getMerchantColor(data.merchant)} px-4 py-1.5 text-sm font-bold shadow-md`}>
            {data.merchant}
          </Badge>
          {data.merchantOffers?.length > 1 && (
            <Badge variant="outline" className="text-purple-600 border-purple-300 font-semibold">
              +{data.merchantOffers.length - 1}
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-gray-900 text-base line-clamp-2 min-h-[3rem] leading-snug">
          {data.title}
        </h3>

        {/* Rating */}
        {data.rating && (
          <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 rounded-lg">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-3.5 h-3.5 ${i < Math.floor(data.rating) ? 'text-amber-400 fill-current' : 'text-gray-300'}`} 
                />
              ))}
            </div>
            <span className="font-bold text-sm text-gray-900">{data.rating}</span>
            {data.reviews && (
              <span className="text-xs text-gray-600">({data.reviews.toLocaleString()})</span>
            )}
          </div>
        )}

        {/* Price - Bold and Colorful */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-xl shadow-lg">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-black">${data.price.toFixed(2)}</div>
              {data.installment && (
                <p className="text-xs opacity-90 mt-1">{data.installment}</p>
              )}
            </div>
            {savings && (
              <div className="text-right">
                <div className="text-sm line-through opacity-75">${data.oldPrice.toFixed(2)}</div>
                <div className="text-lg font-bold bg-white text-purple-600 px-2 py-0.5 rounded-full mt-1">
                  -${savings.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delivery */}
        {data.delivery && (
          <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 px-3 py-2 rounded-lg">
            <Truck className="w-4 h-4" />
            <span className="font-semibold">{data.delivery}</span>
          </div>
        )}

        {/* Action Button */}
        <Button 
          asChild 
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold shadow-lg text-base py-6"
        >
          <a href={viewLink} target="_blank" rel="noopener noreferrer">
            <ShoppingCart className="w-5 h-5 mr-2" />
            {primaryOffer ? `Shop ${primaryOffer.name}` : 'Shop Now'}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProductCardV2List({ item }) {
  const data = extractItemData(item);
  const primaryOffer = data.merchantOffers?.[0];
  const viewLink = primaryOffer?.link || data.productLink;
  const savings = data.oldPrice && data.oldPrice > data.price ? data.oldPrice - data.price : null;

  return (
    <Card className="group overflow-hidden border-2 border-purple-200 hover:border-purple-500 hover:shadow-2xl transition-all duration-300 bg-gradient-to-r from-purple-50 via-white to-pink-50">
      <div className="flex gap-6 p-5">
        {/* Image - Left */}
        <div className="relative w-44 h-44 flex-shrink-0 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-purple-500 to-transparent opacity-20"></div>
          {data.position && (
            <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold px-3 py-1 rounded-full text-sm">
              #{data.position}
            </div>
          )}
          {data.tag && (
            <div className="absolute top-2 right-2 z-10">
              <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold shadow-lg animate-pulse">
                {data.tag}
              </Badge>
            </div>
          )}
          <img
            src={data.imageUrl}
            alt={data.title}
            className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500"
            onError={(e) => e.target.style.display = 'none'}
          />
        </div>

        {/* Content - Middle */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-gray-900 text-xl line-clamp-2 leading-tight flex-1">
              {data.title}
            </h3>
            <Badge className={`${getMerchantColor(data.merchant)} px-4 py-1.5 text-sm font-bold shadow-md flex-shrink-0`}>
              {data.merchant}
            </Badge>
          </div>

          {data.rating && (
            <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2 rounded-lg inline-flex">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-4 h-4 ${i < Math.floor(data.rating) ? 'text-amber-400 fill-current' : 'text-gray-300'}`} 
                  />
                ))}
              </div>
              <span className="font-bold text-base">{data.rating}</span>
              {data.reviews && (
                <span className="text-sm text-gray-600">({data.reviews.toLocaleString()} reviews)</span>
              )}
            </div>
          )}

          {data.snippet && (
            <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{data.snippet}</p>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            {data.delivery && (
              <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full">
                <Truck className="w-4 h-4" />
                <span className="font-semibold">{data.delivery}</span>
              </div>
            )}
            {data.merchantOffers?.length > 1 && (
              <Badge variant="outline" className="text-purple-600 border-purple-300 font-semibold">
                Available at {data.merchantOffers.length} stores
              </Badge>
            )}
          </div>
        </div>

        {/* Price & Action - Right */}
        <div className="flex flex-col justify-between w-56 flex-shrink-0 gap-3">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 text-white p-5 rounded-xl shadow-xl">
            <div className="space-y-2">
              <div className="text-4xl font-black">${data.price.toFixed(2)}</div>
              {savings && (
                <div className="flex items-center justify-between">
                  <span className="text-sm line-through opacity-75">${data.oldPrice.toFixed(2)}</span>
                  <div className="bg-white text-purple-600 px-3 py-1 rounded-full font-bold text-sm">
                    -${savings.toFixed(2)}
                  </div>
                </div>
              )}
              {data.installment && (
                <p className="text-xs opacity-90 border-t border-white/20 pt-2 mt-2">{data.installment}</p>
              )}
            </div>
          </div>

          <Button 
            asChild 
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold shadow-lg py-6"
          >
            <a href={viewLink} target="_blank" rel="noopener noreferrer">
              <ShoppingCart className="w-5 h-5 mr-2" />
              {primaryOffer ? 'Buy Now' : 'Shop Now'}
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ========================================
// V3: ELEGANT PREMIUM - Sophisticated, luxury, high-end
// ========================================
export function ProductCardV3Grid({ item }) {
  const data = extractItemData(item);
  const primaryOffer = data.merchantOffers?.[0];
  const viewLink = primaryOffer?.link || data.productLink;
  const savings = data.oldPrice && data.oldPrice > data.price ? data.oldPrice - data.price : null;

  return (
    <Card className="group overflow-hidden border border-gray-300 hover:border-amber-600 hover:shadow-2xl transition-all duration-500 bg-gradient-to-b from-slate-50 to-white">
      {/* Image Section with Elegant Overlay */}
      <div className="relative h-60 bg-gradient-to-b from-slate-100 to-slate-50 overflow-hidden">
        {/* Premium corner accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600"></div>
        
        {data.position && (
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-slate-900 text-amber-400 font-serif font-bold px-3 py-1.5 rounded border border-amber-600 shadow-lg">
              #{data.position}
            </div>
          </div>
        )}
        {data.tag && (
          <div className="absolute top-4 right-4 z-10">
            <Badge className="bg-amber-600 text-white font-serif font-semibold px-3 py-1.5 shadow-xl border border-amber-700">
              {data.tag}
            </Badge>
          </div>
        )}
        <img
          src={data.imageUrl}
          alt={data.title}
          className="w-full h-full object-contain p-5 group-hover:scale-105 transition-transform duration-700 ease-out"
          onError={(e) => e.target.style.display = 'none'}
        />
        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-900/10 to-transparent"></div>
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Title - Elegant Typography */}
        <h3 className="font-serif font-semibold text-slate-900 text-lg line-clamp-2 min-h-[3.5rem] leading-snug">
          {data.title}
        </h3>

        {/* Merchant - Sophisticated Badge */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-amber-600 to-amber-500"></div>
            <span className="font-semibold text-slate-700 uppercase tracking-wider text-xs">
              {data.merchant}
            </span>
          </div>
          {data.merchantOffers?.length > 1 && (
            <span className="text-xs text-amber-700 font-medium">+{data.merchantOffers.length - 1} retailers</span>
          )}
        </div>

        {/* Rating - Premium Style */}
        {data.rating && (
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 text-amber-500 fill-current" />
              <span className="font-bold text-slate-900 text-base">{data.rating}</span>
            </div>
            {data.reviews && (
              <span className="text-sm text-slate-600">
                {data.reviews.toLocaleString()} reviews
              </span>
            )}
          </div>
        )}

        {/* Price - Elegant and Clear */}
        <div className="space-y-2 pt-2">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-slate-900 font-serif">
              ${data.price.toFixed(2)}
            </span>
            {savings && (
              <div className="flex flex-col">
                <span className="text-sm text-slate-400 line-through font-serif">
                  ${data.oldPrice.toFixed(2)}
                </span>
                <span className="text-xs text-amber-700 font-semibold uppercase tracking-wide">
                  Save ${savings.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          {data.installment && (
            <p className="text-xs text-slate-500 italic">{data.installment}</p>
          )}
        </div>

        {/* Delivery - Premium Detail */}
        {data.delivery && (
          <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-4 py-2 rounded border border-slate-200">
            <Truck className="w-4 h-4 text-amber-600" />
            <span className="font-medium">{data.delivery}</span>
          </div>
        )}

        {/* Action Button - Sophisticated */}
        <Button 
          asChild 
          className="w-full bg-slate-900 hover:bg-amber-600 text-white font-semibold transition-colors duration-300 border border-slate-700 shadow-lg py-6"
        >
          <a href={viewLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
            <Award className="w-5 h-5" />
            {primaryOffer ? `Purchase at ${primaryOffer.name}` : 'View Details'}
            <ExternalLink className="w-4 h-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProductCardV3List({ item }) {
  const data = extractItemData(item);
  const primaryOffer = data.merchantOffers?.[0];
  const viewLink = primaryOffer?.link || data.productLink;
  const savings = data.oldPrice && data.oldPrice > data.price ? data.oldPrice - data.price : null;

  return (
    <Card className="group overflow-hidden border border-gray-300 hover:border-amber-600 hover:shadow-2xl transition-all duration-500 bg-gradient-to-r from-slate-50 to-white">
      {/* Top accent line */}
      <div className="h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600"></div>
      
      <div className="flex gap-6 p-6">
        {/* Image - Left */}
        <div className="relative w-48 h-48 flex-shrink-0 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg overflow-hidden border border-slate-200">
          {data.position && (
            <div className="absolute top-3 left-3 z-10 bg-slate-900 text-amber-400 font-serif font-bold px-3 py-1 rounded text-sm border border-amber-600">
              #{data.position}
            </div>
          )}
          {data.tag && (
            <div className="absolute top-3 right-3 z-10">
              <Badge className="bg-amber-600 text-white font-serif font-semibold shadow-xl">
                {data.tag}
              </Badge>
            </div>
          )}
          <img
            src={data.imageUrl}
            alt={data.title}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-700"
            onError={(e) => e.target.style.display = 'none'}
          />
        </div>

        {/* Content - Middle */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h3 className="font-serif font-bold text-slate-900 text-2xl line-clamp-2 leading-tight mb-3">
              {data.title}
            </h3>
            <div className="flex items-center gap-2 border-l-4 border-amber-600 pl-3">
              <span className="font-semibold text-slate-700 uppercase tracking-wider text-sm">
                {data.merchant}
              </span>
              {data.merchantOffers?.length > 1 && (
                <span className="text-xs text-amber-700 font-medium">
                  • Available at {data.merchantOffers.length} premium retailers
                </span>
              )}
            </div>
          </div>

          {data.rating && (
            <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-lg border border-slate-200 inline-flex">
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 text-amber-500 fill-current" />
                <span className="font-bold text-slate-900 text-lg">{data.rating}</span>
              </div>
              {data.reviews && (
                <span className="text-sm text-slate-600 border-l border-slate-300 pl-3">
                  {data.reviews.toLocaleString()} verified reviews
                </span>
              )}
            </div>
          )}

          {data.snippet && (
            <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed italic border-l-2 border-slate-200 pl-4">
              "{data.snippet}"
            </p>
          )}

          {data.delivery && (
            <div className="flex items-center gap-3 text-sm text-slate-700 bg-slate-50 px-4 py-2 rounded border border-slate-200 inline-flex">
              <Truck className="w-4 h-4 text-amber-600" />
              <span className="font-medium">{data.delivery}</span>
            </div>
          )}
        </div>

        {/* Price & Action - Right */}
        <div className="flex flex-col justify-between w-64 flex-shrink-0 gap-4">
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-lg shadow-xl border border-amber-600/50">
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold font-serif">${data.price.toFixed(2)}</span>
                  {savings && (
                    <div className="flex flex-col">
                      <span className="text-sm line-through opacity-60">${data.oldPrice.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {savings && (
                  <div className="bg-amber-600 text-white px-3 py-1 rounded-full inline-block text-sm font-bold">
                    SAVE ${savings.toFixed(2)}
                  </div>
                )}
                {data.installment && (
                  <p className="text-xs opacity-75 border-t border-white/20 pt-2 italic">
                    {data.installment}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Button 
            asChild 
            className="w-full bg-slate-900 hover:bg-amber-600 text-white font-semibold transition-colors duration-300 shadow-lg py-6 border border-slate-700"
          >
            <a href={viewLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
              <Award className="w-5 h-5" />
              {primaryOffer ? 'Purchase' : 'View Details'}
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
