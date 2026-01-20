/**
 * Market Intelligence Detail Page
 * Shows detailed insights for a specific marketplace
 */

import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft,
  MessageCircle,
  TrendingUp,
  ShoppingBag,
  Lightbulb,
  MapPin,
  Globe,
  Clock,
  DollarSign,
  Tag,
  Sparkles,
  Zap,
  ChevronRight,
  Package,
} from "lucide-react";

// Import marketplace logos
const EBAY_LOGO = "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg";
const AMAZON_LOGO = "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg";
const FACEBOOK_LOGO = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";

const MARKETPLACE_INFO = {
  ebay: {
    name: 'eBay',
    icon: EBAY_LOGO,
    iconType: 'image',
    color: 'blue',
    description: 'Tips, trends & insights for eBay sellers',
  },
  amazon: {
    name: 'Amazon',
    icon: AMAZON_LOGO,
    iconType: 'image',
    color: 'orange',
    description: 'Sourcing strategies & trends for Amazon resellers',
  },
  facebook: {
    name: 'Facebook Marketplace',
    icon: FACEBOOK_LOGO,
    iconType: 'image',
    color: 'indigo',
    description: 'Local & online insights for Facebook Marketplace',
  },
  'market-deals': {
    name: 'Market Deals',
    icon: Tag,
    iconType: 'component',
    color: 'emerald',
    description: 'Discounted items & money-making opportunities',
  },
};

const TABS = ['trending', 'items', 'tips'];

export default function MarketIntelligenceDetail() {
  const { marketplaceId } = useParams();
  const navigate = useNavigate();
  const marketplace = MARKETPLACE_INFO[marketplaceId] || MARKETPLACE_INFO.ebay;
  const Icon = marketplace.iconType === 'component' ? marketplace.icon : null;
  const iconSrc = marketplace.iconType === 'image' ? marketplace.icon : null;

  // Mock data - will be replaced with real API calls
  const [activeTab, setActiveTab] = useState('trending');

  // Swipe navigation for tabs
  const swipeRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const handleSwipeStart = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  };

  const handleSwipeMove = (e) => {
    const st = swipeRef.current;
    if (!st?.active || st.pointerId !== e.pointerId) return;

    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;

    const ACTIVATION_PX = 10;
    if (!st.moved && Math.abs(dx) > ACTIVATION_PX && Math.abs(dx) > Math.abs(dy)) {
      st.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleSwipeEnd = (e) => {
    const st = swipeRef.current;
    if (!st?.active || st.pointerId !== e.pointerId) return;

    const dx = e.clientX - st.startX;
    const SWIPE_THRESHOLD = 50;

    if (st.moved && Math.abs(dx) > SWIPE_THRESHOLD) {
      const currentIndex = TABS.indexOf(activeTab);
      if (dx > 0 && currentIndex > 0) {
        // Swipe right - previous tab
        setActiveTab(TABS[currentIndex - 1]);
      } else if (dx < 0 && currentIndex < TABS.length - 1) {
        // Swipe left - next tab
        setActiveTab(TABS[currentIndex + 1]);
      }
    }

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    swipeRef.current = { active: false, pointerId: null, startX: 0, startY: 0, moved: false };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden w-full max-w-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 w-full max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 w-full max-w-full box-border">
          <div className="flex items-center gap-2 sm:gap-4 w-full max-w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/pulse');
                }
              }}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              marketplace.color === 'blue' ? 'bg-blue-50 dark:bg-blue-950/20' :
              marketplace.color === 'orange' ? 'bg-orange-50 dark:bg-orange-950/20' :
              marketplace.color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-950/20' :
              'bg-emerald-50 dark:bg-emerald-950/20'
            }`}>
              {marketplace.iconType === 'image' && iconSrc ? (
                <img 
                  src={iconSrc} 
                  alt={marketplace.name} 
                  className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                />
              ) : Icon ? (
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  marketplace.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                  marketplace.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                  marketplace.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
                  'text-emerald-600 dark:text-emerald-400'
                }`} />
              ) : null}
            </div>
            <div className="flex-1 min-w-0 max-w-full">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white break-words">
                {marketplace.name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                {marketplace.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 w-full max-w-full overflow-x-hidden box-border">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-full">
          <div className="w-full max-w-full overflow-x-auto mb-3 sm:mb-4 md:mb-6 -mx-3 sm:-mx-4 md:mx-0 px-3 sm:px-4 md:px-0">
            <TabsList className="inline-flex w-full sm:grid sm:grid-cols-3 min-w-full sm:min-w-0 max-w-full">
              <TabsTrigger value="trending" className="flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 flex-1 min-w-0 text-xs sm:text-sm px-1.5 sm:px-2 md:px-3">
                <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                <span className="truncate">Trending</span>
              </TabsTrigger>
              <TabsTrigger value="items" className="flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 flex-1 min-w-0 text-xs sm:text-sm px-1.5 sm:px-2 md:px-3">
                <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                <span className="truncate">Items</span>
              </TabsTrigger>
              <TabsTrigger value="tips" className="flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 flex-1 min-w-0 text-xs sm:text-sm px-1.5 sm:px-2 md:px-3">
                <Lightbulb className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                <span className="truncate">Tips</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Swipeable content area */}
          <div
            onPointerDown={handleSwipeStart}
            onPointerMove={handleSwipeMove}
            onPointerUp={handleSwipeEnd}
            onPointerCancel={handleSwipeEnd}
            className="touch-none sm:touch-auto w-full max-w-full overflow-x-hidden"
          >

          {/* Trending Tab */}
          <TabsContent value="trending" className="space-y-3 sm:space-y-4 md:space-y-6 mt-0 w-full max-w-full overflow-x-hidden">
            {/* Top Categories */}
            <Card className="w-full max-w-full overflow-hidden box-border">
              <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
                <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base lg:text-lg break-words">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-emerald-600 flex-shrink-0" />
                  <span className="break-words">Top Categories Selling Now</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6 pt-0 w-full max-w-full overflow-x-hidden box-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 w-full max-w-full">
                  {[
                    { name: 'Electronics', items: '1,234', avgPrice: '$89', change: '+23%' },
                    { name: 'Clothing & Accessories', items: '987', avgPrice: '$45', change: '+18%' },
                    { name: 'Home & Garden', items: '756', avgPrice: '$67', change: '+15%' },
                    { name: 'Sports & Outdoors', items: '654', avgPrice: '$78', change: '+12%' },
                    { name: 'Toys & Games', items: '543', avgPrice: '$34', change: '+10%' },
                    { name: 'Books & Media', items: '432', avgPrice: '$22', change: '+8%' },
                  ].map((category, idx) => (
                    <div key={idx} className="p-2.5 sm:p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 w-full max-w-full overflow-hidden box-border">
                      <div className="flex items-start justify-between mb-1.5 sm:mb-2 gap-1.5 sm:gap-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm md:text-base break-words flex-1 min-w-0 max-w-full">{category.name}</h4>
                        <Badge className="bg-emerald-500 text-white text-xs flex-shrink-0">{category.change}</Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 break-words">
                        {category.items} active listings
                      </p>
                      <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white break-words">
                        Avg price: {category.avgPrice}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Trending Items */}
            <Card className="w-full max-w-full overflow-hidden box-border">
              <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
                <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base lg:text-lg break-words">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-yellow-500 flex-shrink-0" />
                  <span className="break-words">Trending Items This Week</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6 pt-0 w-full max-w-full overflow-x-hidden box-border">
                <div className="space-y-2 sm:space-y-3 w-full max-w-full">
                  {[
                    { name: 'Vintage Electronics', platform: marketplace.name, avgPrice: '$89', sales: '234', change: '+23%' },
                    { name: 'Designer Handbags', platform: marketplace.name, avgPrice: '$145', sales: '189', change: '+18%' },
                    { name: 'Home Fitness Equipment', platform: marketplace.name, avgPrice: '$67', sales: '156', change: '+15%' },
                    { name: 'Smart Home Devices', platform: marketplace.name, avgPrice: '$112', sales: '143', change: '+12%' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 sm:p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 w-full max-w-full overflow-hidden gap-1.5 sm:gap-2 box-border">
                      <div className="flex-1 min-w-0 max-w-full">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs sm:text-sm md:text-base break-words">{item.name}</h4>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
                          <span>Avg: {item.avgPrice}</span>
                          <span>•</span>
                          <span>{item.sales} sales</span>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500 text-white text-xs sm:text-sm flex-shrink-0">{item.change}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-3 sm:space-y-4 md:space-y-6 mt-0 w-full max-w-full overflow-x-hidden">
            {marketplaceId === 'facebook' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-6 w-full max-w-full">
                <Button variant="outline" className="h-auto p-2.5 sm:p-3 md:p-4 flex items-center gap-1.5 sm:gap-2 md:gap-3 w-full max-w-full overflow-hidden box-border">
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-indigo-600 flex-shrink-0" />
                  <div className="text-left flex-1 min-w-0 max-w-full">
                    <div className="font-semibold text-xs sm:text-sm md:text-base break-words">Local Items</div>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">Items near you</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto p-2.5 sm:p-3 md:p-4 flex items-center gap-1.5 sm:gap-2 md:gap-3 w-full max-w-full overflow-hidden box-border">
                  <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-indigo-600 flex-shrink-0" />
                  <div className="text-left flex-1 min-w-0 max-w-full">
                    <div className="font-semibold text-xs sm:text-sm md:text-base break-words">Online Items</div>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">Nationwide listings</div>
                  </div>
                </Button>
              </div>
            )}

            {marketplaceId === 'market-deals' && (
              <Card className="mb-3 sm:mb-4 md:mb-6 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200 dark:border-emerald-800 w-full max-w-full overflow-hidden box-border">
                <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
                  <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base lg:text-lg break-words">
                    <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-emerald-600 flex-shrink-0" />
                    <span className="break-words">Discounted Items Alert</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6 pt-0 w-full max-w-full overflow-x-hidden box-border">
                  <div className="space-y-2 sm:space-y-3 w-full max-w-full">
                    {[
                      { title: 'Nike Air Max 90 - 40% Off', price: '$59.99', originalPrice: '$99.99', source: 'Nike Outlet', timeAgo: '2 hours ago' },
                      { title: 'Apple AirPods Pro - $50 Off', price: '$199.99', originalPrice: '$249.99', source: 'Best Buy', timeAgo: '5 hours ago' },
                      { title: 'Levi\'s 501 Jeans - Buy 1 Get 1', price: '$39.99', originalPrice: '$79.98', source: 'Levi\'s Store', timeAgo: '1 day ago' },
                    ].map((deal, idx) => (
                      <div key={idx} className="p-2.5 sm:p-3 md:p-4 bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 dark:border-emerald-800 w-full max-w-full overflow-hidden box-border">
                        <div className="flex items-start justify-between mb-1.5 sm:mb-2 gap-1.5 sm:gap-2">
                          <div className="flex-1 min-w-0 max-w-full">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs sm:text-sm md:text-base break-words">{deal.title}</h4>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
                              <span className="font-medium text-emerald-600">{deal.price}</span>
                              <span className="line-through">{deal.originalPrice}</span>
                              <span>•</span>
                              <span className="break-words">{deal.source}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            <Clock className="w-3 h-3 mr-0.5 sm:mr-1" />
                            <span className="hidden sm:inline">{deal.timeAgo}</span>
                            <span className="sm:hidden">{deal.timeAgo.split(' ')[0]}</span>
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="w-full max-w-full overflow-hidden box-border">
              <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
                <CardTitle className="text-xs sm:text-sm md:text-base lg:text-lg break-words">Items Selling Well</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6 pt-0 w-full max-w-full overflow-x-hidden box-border">
                <div className="space-y-2 sm:space-y-3 w-full max-w-full">
                  {[
                    { name: 'iPhone 13 Pro Max', price: '$699', sales: '45', avgDays: '3', image: null },
                    { name: 'Nike Dunk Low', price: '$120', sales: '38', avgDays: '2', image: null },
                    { name: 'Dyson V15 Vacuum', price: '$549', sales: '32', avgDays: '4', image: null },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 sm:gap-2 md:gap-4 p-2.5 sm:p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 w-full max-w-full overflow-hidden box-border">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0 max-w-full">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs sm:text-sm md:text-base break-words">{item.name}</h4>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
                          <span>{item.price}</span>
                          <span>•</span>
                          <span>{item.sales} sales</span>
                          <span>•</span>
                          <span>Avg {item.avgDays} days</span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tips Tab */}
          <TabsContent value="tips" className="space-y-3 sm:space-y-4 md:space-y-6 mt-0 w-full max-w-full overflow-x-hidden">
            <Card className="w-full max-w-full overflow-hidden box-border">
              <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
                <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base lg:text-lg break-words">
                  <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-yellow-500 flex-shrink-0" />
                  <span className="break-words">Tips & Tricks for {marketplace.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6 pt-0 w-full max-w-full overflow-x-hidden box-border">
                <div className="space-y-2.5 sm:space-y-3 md:space-y-4 w-full max-w-full">
                  {[
                    {
                      title: 'Best Time to List',
                      description: marketplaceId === 'ebay' 
                        ? 'List items on Sunday evenings (6-9 PM) for maximum visibility. eBay traffic peaks during these hours.'
                        : marketplaceId === 'amazon'
                        ? 'Post new listings on weekday mornings (9-11 AM) when users are browsing during breaks.'
                        : 'Post on Thursday-Saturday mornings for best local engagement. Weekend shoppers are most active.',
                      category: 'Timing',
                    },
                    {
                      title: 'Photography Tips',
                      description: 'Use natural lighting, show all angles, and include lifestyle shots. Clear, bright photos get 3x more views.',
                      category: 'Photography',
                    },
                    {
                      title: marketplaceId === 'ebay' ? 'Auction vs Buy It Now' : 'Pricing Strategy',
                      description: marketplaceId === 'ebay'
                        ? 'Use Buy It Now for common items, auctions for rare/unique items. Research completed listings first.'
                        : marketplaceId === 'amazon'
                        ? 'Price competitively and monitor Amazon pricing trends. Use Amazon\'s FBA calculator for profitability.'
                        : 'Price competitively but leave room for negotiation. Research similar local listings first.',
                      category: 'Pricing',
                    },
                    {
                      title: 'Title Optimization',
                      description: 'Include brand, model, size, condition, and key features. Use all available characters.',
                      category: 'SEO',
                    },
                    {
                      title: 'Shipping Strategy',
                      description: marketplaceId === 'ebay'
                        ? 'Offer free shipping on items over $50. Use calculated shipping for heavy items.'
                        : 'Offer fast shipping when possible. Consider bundle deals to increase order value.',
                      category: 'Shipping',
                    },
                  ].map((tip, idx) => (
                    <div key={idx} className="p-2.5 sm:p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 w-full max-w-full overflow-hidden box-border">
                      <div className="flex items-start justify-between mb-1.5 sm:mb-2 gap-1.5 sm:gap-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm md:text-base break-words flex-1 min-w-0 max-w-full">{tip.title}</h4>
                        <Badge variant="outline" className="text-xs flex-shrink-0">{tip.category}</Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">{tip.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          </div>
        </Tabs>
      </div>
    </div>
  );
}
