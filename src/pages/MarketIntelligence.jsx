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
        {/* Discounted Items Alert Banner - Uber style card */}
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Tag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-base md:text-lg">
                    Hot Deals Alert
                  </h3>
                  <div className="space-y-2">
                    {DISCOUNTED_ITEMS.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-900 dark:text-white">{item.title}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{item.price}</span>
                            <span className="text-gray-400 dark:text-gray-500 line-through text-xs">{item.originalPrice}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">• {item.timeAgo}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleMarketplaceClick('market-deals')}
                className="bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 text-white flex-shrink-0"
              >
                View All
                <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Marketplace Grid - Uber Style */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Marketplace Insights
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {MARKETPLACES.map((marketplace) => {
              const Icon = marketplace.icon;
              return (
                <button
                  key={marketplace.id}
                  onClick={() => handleMarketplaceClick(marketplace.id)}
                  className="group relative bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-600 transition-all duration-200 hover:shadow-xl active:scale-95 text-center flex flex-col items-center justify-center min-h-[140px] md:min-h-[160px]"
                >
                  {/* Badge - Top Left (Uber style) */}
                  {marketplace.badge && (
                    <Badge 
                      className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 ${
                        marketplace.badge === 'New' 
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      }`}
                    >
                      {marketplace.badge}
                    </Badge>
                  )}

                  {/* Icon - Larger and more prominent */}
                  <div className={`w-16 h-16 md:w-20 md:h-20 ${marketplace.bgColor} dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className={`w-10 h-10 md:w-12 md:h-12 ${marketplace.iconColor} dark:text-gray-300`} />
                  </div>

                  {/* Name */}
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {marketplace.name}
                  </h3>

                  {/* Description */}
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 leading-tight">
                    {marketplace.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Stats Section - Uber style cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-1">Trending Categories</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">12</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-1">Active Deals</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{DISCOUNTED_ITEMS.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <Tag className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-1">Community Tips</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">48</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity / Insights Preview - Uber style cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Trending Now */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                Trending Now
              </h3>
              <Button variant="ghost" size="sm" onClick={() => handleMarketplaceClick('ebay')} className="text-xs md:text-sm">
                View All
                <ArrowRight className="ml-1 w-3 h-3 md:w-4 md:h-4" />
              </Button>
            </div>
            <div className="space-y-2 md:space-y-3">
              {[
                { name: 'Vintage Electronics', platform: 'eBay', change: '+23%' },
                { name: 'Designer Handbags', platform: 'Mercari', change: '+18%' },
                { name: 'Home Fitness Equipment', platform: 'Facebook', change: '+15%' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm md:text-base truncate">{item.name}</p>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{item.platform}</p>
                  </div>
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs md:text-sm ml-2 flex-shrink-0">
                    {item.change}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Top Categories */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                Top Categories
              </h3>
              <Button variant="ghost" size="sm" className="text-xs md:text-sm">
                View All
                <ArrowRight className="ml-1 w-3 h-3 md:w-4 md:h-4" />
              </Button>
            </div>
            <div className="space-y-2 md:space-y-3">
              {[
                { name: 'Electronics', items: '1,234', avgPrice: '$89' },
                { name: 'Clothing & Accessories', items: '987', avgPrice: '$45' },
                { name: 'Home & Garden', items: '756', avgPrice: '$67' },
              ].map((category, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm md:text-base truncate">{category.name}</p>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                      {category.items} items • Avg: {category.avgPrice}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-400 flex-shrink-0 ml-2" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Community Tips Preview - Uber style */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              Community Tips & Tricks
            </h3>
            <Button variant="ghost" size="sm" className="text-xs md:text-sm">
              View All
              <ArrowRight className="ml-1 w-3 h-3 md:w-4 md:h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
              <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm md:text-base">{tip.title}</h4>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-2">{tip.description}</p>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
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
        </div>
      </div>
    </div>
  );
}
