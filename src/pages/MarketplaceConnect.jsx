/**
 * Marketplace Connect Center
 * 
 * Central hub for connecting and managing marketplace accounts.
 * Similar to Vendoo's connection management.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  Facebook, 
  ShoppingBag, 
  Package, 
  Shirt, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { crosslistingEngine } from '@/services/CrosslistingEngine';

const MARKETPLACES = [
  {
    id: 'facebook',
    name: 'Facebook Marketplace',
    icon: Facebook,
    color: 'bg-blue-600',
    description: 'List items on Facebook Marketplace',
    requiredPermissions: ['pages_manage_posts', 'business_management'],
    status: 'available',
  },
  {
    id: 'ebay',
    name: 'eBay',
    icon: ShoppingBag,
    color: 'bg-yellow-500',
    description: 'List items on eBay',
    requiredPermissions: ['Trading API access'],
    status: 'available',
  },
  {
    id: 'mercari',
    name: 'Mercari',
    icon: Package,
    color: 'bg-orange-500',
    description: 'List items on Mercari',
    requiredPermissions: ['API access'],
    status: 'coming_soon',
  },
  {
    id: 'poshmark',
    name: 'Poshmark',
    icon: Shirt,
    color: 'bg-pink-500',
    description: 'List items on Poshmark',
    requiredPermissions: ['API access'],
    status: 'coming_soon',
  },
];

export default function MarketplaceConnect() {
  const [accounts, setAccounts] = useState({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const userAccounts = await crosslistingEngine.getMarketplaceAccounts();
      setAccounts(userAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (marketplaceId) => {
    if (marketplaceId === 'facebook') {
      window.location.href = '/api/facebook/auth';
    } else if (marketplaceId === 'ebay') {
      window.location.href = '/api/ebay/auth';
    } else {
      toast({
        title: 'Coming Soon',
        description: `${MARKETPLACES.find(m => m.id === marketplaceId)?.name} integration is coming soon.`,
      });
    }
  };

  const handleDisconnect = async (marketplaceId) => {
    try {
      if (marketplaceId === 'facebook') {
        localStorage.removeItem('facebook_access_token');
      } else if (marketplaceId === 'ebay') {
        localStorage.removeItem('ebay_user_token');
        localStorage.removeItem('ebay_username');
      }

      await loadAccounts();
      toast({
        title: 'Disconnected',
        description: `Your ${MARKETPLACES.find(m => m.id === marketplaceId)?.name} account has been disconnected.`,
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect account.',
        variant: 'destructive',
      });
    }
  };

  const handleReconnect = (marketplaceId) => {
    handleConnect(marketplaceId);
  };

  const getAccountStatus = (marketplaceId) => {
    const account = accounts[marketplaceId];
    if (!account) {
      return { connected: false, expired: false };
    }

    const expired = account.expires_at && account.expires_at <= Date.now();
    return {
      connected: true,
      expired,
      accountName: account.accountName || account.marketplace,
    };
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Marketplace Connections
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your marketplace accounts to enable crosslisting
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MARKETPLACES.map((marketplace) => {
          const Icon = marketplace.icon;
          const status = getAccountStatus(marketplace.id);
          const isComingSoon = marketplace.status === 'coming_soon';

          return (
            <Card key={marketplace.id} className={isComingSoon ? 'opacity-75' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg ${marketplace.color} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{marketplace.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {marketplace.description}
                      </CardDescription>
                    </div>
                  </div>
                  {isComingSoon && (
                    <Badge variant="secondary">Coming Soon</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  {status.connected ? (
                    <>
                      {status.expired ? (
                        <>
                          <AlertCircle className="w-5 h-5 text-yellow-500" />
                          <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                            Token Expired
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            Connected
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">
                        Not Connected
                      </span>
                    </>
                  )}
                </div>

                {/* Account Info */}
                {status.connected && status.accountName && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Account: <span className="font-medium">{status.accountName}</span>
                  </div>
                )}

                {/* Required Permissions */}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <p className="font-medium mb-1">Required Permissions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {marketplace.requiredPermissions.map((perm, idx) => (
                      <li key={idx}>{perm}</li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {status.connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReconnect(marketplace.id)}
                        disabled={isComingSoon}
                        className="flex-1"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reconnect
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(marketplace.id)}
                        disabled={isComingSoon}
                        className="flex-1 text-destructive hover:text-destructive"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleConnect(marketplace.id)}
                      disabled={isComingSoon}
                      className="flex-1"
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      Connect {marketplace.name}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            About Marketplace Connections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            • Connecting your marketplace accounts allows you to crosslist items across multiple platforms
          </p>
          <p>
            • Your OAuth tokens are stored securely and automatically refreshed when needed
          </p>
          <p>
            • You can disconnect at any time from this page
          </p>
          <p>
            • Each marketplace requires specific permissions - you'll be prompted during connection
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

