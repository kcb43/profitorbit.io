import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp, Bookmark, ExternalLink, DollarSign, Percent, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase';
import { useToast } from '@/components/ui/use-toast';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

export default function Deals() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    merchant: '',
    category: '',
    minScore: 0
  });
  const { toast } = useToast();

  // Fetch deals feed
  const { data: dealsData, isLoading } = useQuery({
    queryKey: ['deals', searchQuery, filters],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const params = new URLSearchParams({
        ...(searchQuery && { q: searchQuery }),
        ...(filters.merchant && { merchant: filters.merchant }),
        ...(filters.category && { category: filters.category }),
        min_score: filters.minScore.toString(),
        limit: '50'
      });

      const response = await fetch(`${ORBEN_API_URL}/v1/deals/feed?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error('Failed to fetch deals');
      }

      return response.json();
    },
    staleTime: 60_000
  });

  // Fetch user's saved deals
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

  const savedDealIds = new Set(savedDeals?.items?.map(d => d.id) || []);

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

      toast({
        title: isSaved ? 'Deal removed from watchlist' : 'Deal saved to watchlist',
        variant: 'default'
      });

      refetchSaved();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const calculateDiscount = (price, originalPrice) => {
    if (!price || !originalPrice || originalPrice <= price) return null;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deal Intelligence</h1>
          <p className="text-gray-600 mt-1">Curated deals for resellers</p>
        </div>
        <Button onClick={() => window.location.href = '/deals/submit'}>
          Submit Deal
        </Button>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Input
              placeholder="Filter by merchant"
              value={filters.merchant}
              onChange={(e) => setFilters({ ...filters, merchant: e.target.value })}
            />
            <Input
              placeholder="Filter by category"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-4 mt-4">
            <label className="text-sm font-medium">Min Score:</label>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={filters.minScore}
              onChange={(e) => setFilters({ ...filters, minScore: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12">{filters.minScore}</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dealsData?.items?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Saved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{savedDeals?.items?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dealsData?.items?.length
                ? Math.round(
                    dealsData.items.reduce((sum, d) => sum + (d.score || 0), 0) / dealsData.items.length
                  )
                : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Hot Deals (70+)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dealsData?.items?.filter(d => d.score >= 70).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deals Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading deals...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dealsData?.items?.map((deal) => {
            const isSaved = savedDealIds.has(deal.id);
            const discount = calculateDiscount(deal.price, deal.original_price);

            return (
              <Card key={deal.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Image */}
                {deal.image_url && (
                  <div className="relative h-48 bg-gray-100">
                    <img
                      src={deal.image_url}
                      alt={deal.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="absolute top-2 right-2">
                      <Badge className={`${getScoreColor(deal.score)} text-white`}>
                        {deal.score}
                      </Badge>
                    </div>
                    {discount && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-red-500 text-white">
                          <Percent className="w-3 h-3 mr-1" />
                          {discount}% off
                        </Badge>
                      </div>
                    )}
                  </div>
                )}

                <CardContent className="p-4">
                  {/* Title */}
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                    {deal.title}
                  </h3>

                  {/* Merchant & Category */}
                  <div className="flex items-center gap-2 mb-3">
                    {deal.merchant && (
                      <Badge variant="outline" className="text-xs">
                        {deal.merchant}
                      </Badge>
                    )}
                    {deal.category && (
                      <Badge variant="secondary" className="text-xs">
                        {deal.category}
                      </Badge>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-2 mb-3">
                    {deal.price && (
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="text-xl font-bold text-green-600">
                          {deal.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {deal.original_price && deal.original_price > deal.price && (
                      <span className="text-sm text-gray-500 line-through">
                        ${deal.original_price.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Coupon */}
                  {deal.coupon_code && (
                    <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs text-yellow-800">
                        Code: <span className="font-mono font-bold">{deal.coupon_code}</span>
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(deal.url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Deal
                    </Button>
                    <Button
                      variant={isSaved ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleSaveDeal(deal.id, isSaved)}
                    >
                      <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                    </Button>
                  </div>

                  {/* Posted date */}
                  {deal.posted_at && (
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(deal.posted_at).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {dealsData?.items?.length === 0 && !isLoading && (
        <Card className="p-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No deals found</h3>
            <p className="text-gray-600">Try adjusting your filters or search query</p>
          </div>
        </Card>
      )}
    </div>
  );
}
