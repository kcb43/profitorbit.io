/**
 * Market Intelligence Detail Page
 * Shows detailed insights for a specific marketplace
 */

import React, { useState } from 'react';
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
} from "lucide-react";

const MARKETPLACE_INFO = {
  ebay: {
    name: 'eBay',
    icon: ShoppingBag,
    color: 'blue',
    description: 'Tips, trends & insights for eBay sellers',
  },
  mercari: {
    name: 'Mercari',
    icon: Sparkles,
    color: 'purple',
    description: 'Selling strategies & trends for Mercari',
  },
  facebook: {
    name: 'Facebook Marketplace',
    icon: MessageCircle,
    color: 'indigo',
    description: 'Local & online insights for Facebook Marketplace',
  },
  'market-deals': {
    name: 'Market Deals',
    icon: Tag,
    color: 'emerald',
    description: 'Discounted items & money-making opportunities',
  },
};

export default function MarketIntelligenceDetail() {
  const { marketplaceId } = useParams();
  const navigate = useNavigate();
  const marketplace = MARKETPLACE_INFO[marketplaceId] || MARKETPLACE_INFO.ebay;
  const Icon = marketplace.icon;

  // Mock data - will be replaced with real API calls
  const [activeTab, setActiveTab] = useState('trending');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/market-intelligence')}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              marketplace.color === 'blue' ? 'bg-blue-50 dark:bg-blue-950/20' :
              marketplace.color === 'purple' ? 'bg-purple-50 dark:bg-purple-950/20' :
              marketplace.color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-950/20' :
              'bg-emerald-50 dark:bg-emerald-950/20'
            }`}>
              <Icon className={`w-6 h-6 ${
                marketplace.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                marketplace.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                marketplace.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
                'text-emerald-600 dark:text-emerald-400'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {marketplace.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {marketplace.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6">
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Trending</span>
            </TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Items</span>
            </TabsTrigger>
            <TabsTrigger value="tips" className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              <span className="hidden sm:inline">Tips</span>
            </TabsTrigger>
            <TabsTrigger value="community" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Community</span>
            </TabsTrigger>
          </TabsList>

          {/* Trending Tab */}
          <TabsContent value="trending" className="space-y-6">
            {/* Top Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Top Categories Selling Now
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: 'Electronics', items: '1,234', avgPrice: '$89', change: '+23%' },
                    { name: 'Clothing & Accessories', items: '987', avgPrice: '$45', change: '+18%' },
                    { name: 'Home & Garden', items: '756', avgPrice: '$67', change: '+15%' },
                    { name: 'Sports & Outdoors', items: '654', avgPrice: '$78', change: '+12%' },
                    { name: 'Toys & Games', items: '543', avgPrice: '$34', change: '+10%' },
                    { name: 'Books & Media', items: '432', avgPrice: '$22', change: '+8%' },
                  ].map((category, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{category.name}</h4>
                        <Badge className="bg-emerald-500 text-white">{category.change}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {category.items} active listings
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Avg price: {category.avgPrice}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Trending Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Trending Items This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Vintage Electronics', platform: marketplace.name, avgPrice: '$89', sales: '234', change: '+23%' },
                    { name: 'Designer Handbags', platform: marketplace.name, avgPrice: '$145', sales: '189', change: '+18%' },
                    { name: 'Home Fitness Equipment', platform: marketplace.name, avgPrice: '$67', sales: '156', change: '+15%' },
                    { name: 'Smart Home Devices', platform: marketplace.name, avgPrice: '$112', sales: '143', change: '+12%' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{item.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>Avg: {item.avgPrice}</span>
                          <span>•</span>
                          <span>{item.sales} sales</span>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500 text-white">{item.change}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-6">
            {marketplaceId === 'facebook' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Button variant="outline" className="h-auto p-4 flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                  <div className="text-left">
                    <div className="font-semibold">Local Items</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Items near you</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex items-center gap-3">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  <div className="text-left">
                    <div className="font-semibold">Online Items</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Nationwide listings</div>
                  </div>
                </Button>
              </div>
            )}

            {marketplaceId === 'market-deals' && (
              <Card className="mb-6 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200 dark:border-emerald-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-emerald-600" />
                    Discounted Items Alert
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { title: 'Nike Air Max 90 - 40% Off', price: '$59.99', originalPrice: '$99.99', source: 'Nike Outlet', timeAgo: '2 hours ago' },
                      { title: 'Apple AirPods Pro - $50 Off', price: '$199.99', originalPrice: '$249.99', source: 'Best Buy', timeAgo: '5 hours ago' },
                      { title: 'Levi\'s 501 Jeans - Buy 1 Get 1', price: '$39.99', originalPrice: '$79.98', source: 'Levi\'s Store', timeAgo: '1 day ago' },
                    ].map((deal, idx) => (
                      <div key={idx} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{deal.title}</h4>
                            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                              <span className="font-medium text-emerald-600">{deal.price}</span>
                              <span className="line-through">{deal.originalPrice}</span>
                              <span>•</span>
                              <span>{deal.source}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {deal.timeAgo}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Items Selling Well</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'iPhone 13 Pro Max', price: '$699', sales: '45', avgDays: '3', image: null },
                    { name: 'Nike Dunk Low', price: '$120', sales: '38', avgDays: '2', image: null },
                    { name: 'Dyson V15 Vacuum', price: '$549', sales: '32', avgDays: '4', image: null },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-8 h-8 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{item.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>{item.price}</span>
                          <span>•</span>
                          <span>{item.sales} sales</span>
                          <span>•</span>
                          <span>Avg {item.avgDays} days to sell</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tips Tab */}
          <TabsContent value="tips" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Tips & Tricks for {marketplace.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      title: 'Best Time to List',
                      description: marketplaceId === 'ebay' 
                        ? 'List items on Sunday evenings (6-9 PM) for maximum visibility. eBay traffic peaks during these hours.'
                        : marketplaceId === 'mercari'
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
                        : marketplaceId === 'mercari'
                        ? 'Price competitively and use Mercari\'s offer feature. Start 10-15% above your minimum.'
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
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{tip.title}</h4>
                        <Badge variant="outline">{tip.category}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{tip.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Community Tab */}
          <TabsContent value="community" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-purple-600" />
                  Community Chat & Discussions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      author: 'Sarah M.',
                      message: 'Just sold a vintage camera for $250! Listed it with detailed photos and it sold in 2 days.',
                      platform: marketplace.name,
                      likes: 24,
                      timeAgo: '2 hours ago',
                    },
                    {
                      author: 'Mike T.',
                      message: 'Pro tip: Refresh your listings every few days to bump them to the top of search results.',
                      platform: marketplace.name,
                      likes: 18,
                      timeAgo: '5 hours ago',
                    },
                    {
                      author: 'Jessica L.',
                      message: 'Bundle similar items together - sold 3 pairs of shoes as a bundle for more than individual prices!',
                      platform: marketplace.name,
                      likes: 31,
                      timeAgo: '1 day ago',
                    },
                  ].map((post, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-sm">{post.author[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 dark:text-white">{post.author}</span>
                            <Badge variant="outline" className="text-xs">{post.platform}</Badge>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{post.timeAgo}</span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{post.message}</p>
                          <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" className="h-7">
                              <span className="text-sm">👍 {post.likes}</span>
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7">
                              Reply
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <textarea
                    placeholder="Share your tips or ask a question..."
                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm resize-none"
                    rows={3}
                  />
                  <Button className="mt-3 w-full sm:w-auto">Post</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
