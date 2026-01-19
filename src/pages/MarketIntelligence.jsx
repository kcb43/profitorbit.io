/**
 * Market Intelligence Page - Uber-style grid layout
 * Main selling point: Help users source and find items
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, 
  ShoppingBag,
  DollarSign,
  Sparkles,
  ArrowRight,
  AlertCircle,
  MessageCircle,
  Lightbulb,
  Zap,
  Tag,
  Clock,
  MapPin,
  Globe,
  ChevronRight,
} from "lucide-react";

// Marketplace data
const MARKETPLACES = [
  {
    id: 'ebay',
    name: 'eBay',
    icon: ShoppingBag,
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-600',
    description: 'Tips, trends & insights',
    badge: null,
  },
  {
    id: 'mercari',
    name: 'Mercari',
    icon: Sparkles,
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-50',
    iconColor: 'text-purple-600',
    description: 'Selling strategies & trends',
    badge: null,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: MessageCircle,
    color: 'from-indigo-500 to-indigo-600',
    bgColor: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    description: 'Local & online insights',
    badge: 'New',
  },
  {
    id: 'market-deals',
    name: 'Market Deals',
    icon: Tag,
    color: 'from-emerald-500 to-emerald-600',
    bgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    description: 'Discounted items & alerts',
    badge: 'Hot',
  },
];

// Mock data for discounted items alerts
const DISCOUNTED_ITEMS = [
  {
    id: 1,
    title: 'Nike Air Max 90 - 40% Off',
    price: '$59.99',
    originalPrice: '$99.99',
    source: 'Nike Outlet',
    timeAgo: '2 hours ago',
    category: 'Shoes',
  },
  {
    id: 2,
    title: 'Apple AirPods Pro - $50 Off',
    price: '$199.99',
    originalPrice: '$249.99',
    source: 'Best Buy',
    timeAgo: '5 hours ago',
    category: 'Electronics',
  },
  {
    id: 3,
    title: 'Levi\'s 501 Jeans - Buy 1 Get 1',
    price: '$39.99',
    originalPrice: '$79.98',
    source: 'Levi\'s Store',
    timeAgo: '1 day ago',
    category: 'Clothing',
  },
];

export default function MarketIntelligence() {
  const navigate = useNavigate();
  const [selectedMarketplace, setSelectedMarketplace] = useState(null);

  const handleMarketplaceClick = (marketplaceId) => {
    // Navigate to marketplace detail page
    navigate(`/market-intelligence/${marketplaceId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                Market Intelligence
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Source items, find deals, and learn platform strategies
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Discounted Items Alert Banner */}
        <div className="mb-6">
          <Alert className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200 dark:border-emerald-800">
            <AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <AlertDescription className="ml-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
                    Hot Deals Alert
                  </h3>
                  <div className="space-y-1">
                    {DISCOUNTED_ITEMS.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                        <Tag className="w-3 h-3" />
                        <span className="font-medium">{item.title}</span>
                        <span className="text-emerald-600 dark:text-emerald-300">{item.price}</span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">({item.timeAgo})</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleMarketplaceClick('market-deals')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  View All
                  <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        {/* Marketplace Grid - Uber Style */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Marketplace Insights
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {MARKETPLACES.map((marketplace) => {
              const Icon = marketplace.icon;
              return (
                <button
                  key={marketplace.id}
                  onClick={() => handleMarketplaceClick(marketplace.id)}
                  className="group relative bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-600 transition-all duration-200 hover:shadow-lg text-left"
                >
                  {/* Badge */}
                  {marketplace.badge && (
                    <Badge 
                      className={`absolute top-2 right-2 ${
                        marketplace.badge === 'New' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-emerald-500 text-white'
                      }`}
                    >
                      {marketplace.badge}
                    </Badge>
                  )}

                  {/* Icon */}
                  <div className={`w-16 h-16 ${marketplace.bgColor} dark:bg-opacity-20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className={`w-8 h-8 ${marketplace.iconColor} dark:text-opacity-80`} />
                  </div>

                  {/* Name */}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {marketplace.name}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {marketplace.description}
                  </p>

                  {/* Arrow */}
                  <div className="flex items-center text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm font-medium">Explore</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trending Categories</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">12</p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Deals</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{DISCOUNTED_ITEMS.length}</p>
                </div>
                <Tag className="w-10 h-10 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/20 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Community Tips</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">48</p>
                </div>
                <Lightbulb className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity / Insights Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trending Now */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-600" />
                  Trending Now
                </h3>
                <Button variant="ghost" size="sm" onClick={() => handleMarketplaceClick('ebay')}>
                  View All
                  <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Vintage Electronics', platform: 'eBay', change: '+23%' },
                  { name: 'Designer Handbags', platform: 'Mercari', change: '+18%' },
                  { name: 'Home Fitness Equipment', platform: 'Facebook', change: '+15%' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.platform}</p>
                    </div>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                      {item.change}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Categories */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                  Top Categories
                </h3>
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Electronics', items: '1,234', avgPrice: '$89' },
                  { name: 'Clothing & Accessories', items: '987', avgPrice: '$45' },
                  { name: 'Home & Garden', items: '756', avgPrice: '$67' },
                ].map((category, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{category.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {category.items} items • Avg: {category.avgPrice}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Community Tips Preview */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-purple-600" />
                Community Tips & Tricks
              </h3>
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  title: 'Best Time to List on eBay',
                  description: 'List items on Sunday evenings for maximum visibility',
                  platform: 'eBay',
                  likes: 24,
                },
                {
                  title: 'Facebook Marketplace Photography Tips',
                  description: 'Use natural lighting and show all angles for better sales',
                  platform: 'Facebook',
                  likes: 18,
                },
                {
                  title: 'Mercari Pricing Strategy',
                  description: 'Price competitively and use Mercari\'s offer feature',
                  platform: 'Mercari',
                  likes: 31,
                },
              ].map((tip, idx) => (
                <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{tip.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{tip.description}</p>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {tip.platform}
                        </Badge>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {tip.likes} likes
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
