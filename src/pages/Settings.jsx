import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  Palette, 
  Sparkles, 
  Facebook, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ShoppingBag,
  Package,
  Shirt,
  RefreshCw,
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  getConnectionStatus, 
  clearToken, 
  storeToken,
  getUserPages 
} from "@/api/facebookClient";
import { crosslistingEngine } from '@/services/CrosslistingEngine';
import { useFacebookSDK } from '@/hooks/useFacebookSDK';
import narutoIcon from "@/assets/naruto-icon.svg?url";
import sakuraIcon from "@/assets/sakura-icon.svg?url";
import kakashiIcon from "@/assets/kakashi-icon.svg?url";

const themes = {
  'default-light': 'Default Light',
  'default-dark': 'Default Dark',
  'money-green-light': 'Money Green Light',
  'money-green-dark': 'Money Green Dark',
};

const animeCharacters = {
  'naruto': {
    name: 'Naruto',
    icon: narutoIcon,
  },
  'sakura': {
    name: 'Sakura',
    icon: sakuraIcon,
  },
  'kakashi': {
    name: 'Kakashi',
    icon: kakashiIcon,
  },
};

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

export default function Settings() {
  const [currentTheme, setCurrentTheme] = useState('default-light');
  const [selectedCharacter, setSelectedCharacter] = useState('naruto');
  const [facebookStatus, setFacebookStatus] = useState(null);
  const [facebookPages, setFacebookPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [marketplaceAccounts, setMarketplaceAccounts] = useState({});
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [facebookConfigId, setFacebookConfigId] = useState('');
  const { sdkReady, fbInstance } = useFacebookSDK();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Load saved preferences
    const savedTheme = localStorage.getItem('theme') || 'default-light';
    const savedCharacter = localStorage.getItem('selectedCharacter') || 'naruto';
    
    // Ensure savedCharacter exists in animeCharacters
    const validCharacter = animeCharacters[savedCharacter] ? savedCharacter : 'naruto';
    
    setCurrentTheme(savedTheme);
    setSelectedCharacter(validCharacter);

    // Check Facebook OAuth callback
    const facebookAuthSuccess = searchParams.get('facebook_auth_success');
    const facebookAuthError = searchParams.get('facebook_auth_error');
    const token = searchParams.get('token');

    if (facebookAuthSuccess === '1' && token) {
      try {
        const tokenData = JSON.parse(decodeURIComponent(token));
        storeToken(tokenData);
        toast({
          title: "Facebook Connected",
          description: "Your Facebook account has been successfully connected.",
        });
        // Clear URL params
        navigate('/Settings', { replace: true });
        // Refresh status
        checkFacebookStatus();
      } catch (error) {
        console.error('Error storing Facebook token:', error);
        toast({
          title: "Error",
          description: "Failed to store Facebook token. Please try again.",
          variant: "destructive",
        });
      }
    }

    if (facebookAuthError) {
      toast({
        title: "Facebook Connection Failed",
        description: decodeURIComponent(facebookAuthError),
        variant: "destructive",
      });
      navigate('/Settings', { replace: true });
    }

    // Check Facebook connection status
    checkFacebookStatus();
    
    // Load marketplace accounts
    loadMarketplaceAccounts();
    
    // Listen for embedded signup messages
    const handleMessage = (event) => {
      if (!event.origin.endsWith('facebook.com')) return;
      
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('Facebook embedded signup message:', data);
        }
      } catch (error) {
        console.log('Facebook message event:', event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [searchParams, navigate, toast]);

  const checkFacebookStatus = async () => {
    try {
      const status = await getConnectionStatus();
      setFacebookStatus(status);
      
      // If connected, fetch pages
      if (status.connected) {
        loadFacebookPages();
      }
    } catch (error) {
      console.error('Error checking Facebook status:', error);
      setFacebookStatus({
        connected: false,
        message: 'Error checking connection',
        error: error.message,
      });
    }
  };

  const loadFacebookPages = async () => {
    setLoadingPages(true);
    try {
      const pages = await getUserPages();
      setFacebookPages(pages);
    } catch (error) {
      console.error('Error loading Facebook pages:', error);
      toast({
        title: "Error Loading Pages",
        description: error.message || "Failed to load your Facebook pages.",
        variant: "destructive",
      });
    } finally {
      setLoadingPages(false);
    }
  };


  const handleThemeChange = (theme) => {
    setCurrentTheme(theme);
    localStorage.setItem('theme', theme);
    
    // Apply theme immediately
    document.documentElement.setAttribute('data-theme', theme);
    const themeObj = themes[theme];
    if (themeObj) {
      const root = document.documentElement;
      root.className = theme.includes('dark') ? 'dark' : '';
    }
  };

  const handleCharacterChange = (character) => {
    setSelectedCharacter(character);
    if (character === 'default') {
      localStorage.removeItem('selectedCharacter'); // Clear it so Gamification uses wizard
    } else {
      localStorage.setItem('selectedCharacter', character);
    }
    
    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent('characterChanged', { detail: { character } }));
  };

  const loadMarketplaceAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const accounts = await crosslistingEngine.getMarketplaceAccounts();
      setMarketplaceAccounts(accounts);
    } catch (error) {
      console.error('Error loading marketplace accounts:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loginWithFacebook = () => {
    console.log('loginWithFacebook called', { sdkReady, hasFB: !!window.FB, fbInstance });
    
    // Wait a bit if SDK isn't ready yet
    if (!sdkReady) {
      if (!window.FB) {
        toast({
          title: 'Facebook SDK Not Ready',
          description: 'Please wait for Facebook SDK to load...',
          variant: 'destructive',
        });
        return;
      }
      // If window.FB exists but hook says not ready, initialize it
      try {
        if (!window.FB.getAuthResponse) {
          window.FB.init({
            appId: '1855278678430851',
            cookie: true,
            xfbml: true,
            version: 'v17.0'
          });
        }
      } catch (e) {
        console.error('Error initializing FB:', e);
      }
    }

    // Use fbInstance from hook if available, otherwise try window.FB
    const FB = fbInstance || window.FB;

    if (!FB) {
      toast({
        title: 'Facebook SDK Not Loaded',
        description: 'Facebook SDK failed to load. Please refresh the page and try again.',
        variant: 'destructive',
      });
      console.error('Facebook SDK (FB) is not available');
      return;
    }

    try {
      console.log('Calling FB.login...', FB);
      FB.login(function(response) {
        console.log('FB.login response:', response);
        
        if (response.authResponse) {
          console.log('Logged in!', response.authResponse);
          // Save response.authResponse.accessToken to your server if needed
          const accessToken = response.authResponse.accessToken;
          
          // Store token locally
          const tokenData = {
            access_token: accessToken,
            expires_at: Date.now() + (response.authResponse.expiresIn * 1000),
            expires_in: response.authResponse.expiresIn,
          };
          localStorage.setItem('facebook_access_token', JSON.stringify(tokenData));
          
          // Reload accounts and check status
          loadMarketplaceAccounts();
          checkFacebookStatus();
          
          toast({
            title: 'Facebook Connected',
            description: 'Your Facebook account has been successfully connected.',
          });
        } else {
          console.log('User cancelled login or did not fully authorize.', response);
          toast({
            title: 'Login Cancelled',
            description: 'Facebook login was cancelled.',
            variant: 'destructive',
          });
        }
      }, {scope: 'public_profile,email'});
    } catch (error) {
      console.error('Error calling FB.login:', error);
      toast({
        title: 'Login Error',
        description: error.message || 'An error occurred during Facebook login.',
        variant: 'destructive',
      });
    }
  };

  const handleMarketplaceConnect = (marketplaceId) => {
    console.log('handleMarketplaceConnect called with:', marketplaceId);
    if (marketplaceId === 'facebook') {
      console.log('Calling loginWithFacebook...');
      loginWithFacebook();
    } else if (marketplaceId === 'ebay') {
      window.location.href = '/api/ebay/auth';
    } else {
      toast({
        title: 'Coming Soon',
        description: `${MARKETPLACES.find(m => m.id === marketplaceId)?.name} integration is coming soon.`,
      });
    }
  };

  const handleMarketplaceDisconnect = async (marketplaceId) => {
    try {
      if (marketplaceId === 'facebook') {
        localStorage.removeItem('facebook_access_token');
        clearToken();
        setFacebookStatus(null);
        setFacebookPages([]);
      } else if (marketplaceId === 'ebay') {
        localStorage.removeItem('ebay_user_token');
        localStorage.removeItem('ebay_username');
      }

      await loadMarketplaceAccounts();
      if (marketplaceId === 'facebook') {
        await checkFacebookStatus();
      }
      
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

  const handleMarketplaceReconnect = (marketplaceId) => {
    handleMarketplaceConnect(marketplaceId);
  };

  const getMarketplaceAccountStatus = (marketplaceId) => {
    const account = marketplaceAccounts[marketplaceId];
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

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Customize your app appearance and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Theme Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Choose your preferred color theme</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme-select">App Theme</Label>
              <Select value={currentTheme} onValueChange={handleThemeChange}>
                <SelectTrigger id="theme-select" className="w-full">
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(themes).map(([key, name]) => (
                    <SelectItem key={key} value={key}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Anime Character Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Anime Character</CardTitle>
                <CardDescription>Select your favorite Naruto character for level icons</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="anime-theme">Theme Category</Label>
              <Select value="naruto" disabled>
                <SelectTrigger id="anime-theme" className="w-full">
                  <SelectValue>Anime → Naruto</SelectValue>
                </SelectTrigger>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Naruto theme selected (more anime themes coming soon)
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="character-select">Character</Label>
              <Select value={selectedCharacter} onValueChange={handleCharacterChange}>
                <SelectTrigger id="character-select" className="w-full">
                  <SelectValue placeholder="Select a character" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Default
                      </div>
                      <span>Default (Wizard)</span>
                    </div>
                  </SelectItem>
                  {Object.entries(animeCharacters).map(([key, character]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-3">
                        <img 
                          src={character.icon} 
                          alt={character.name}
                          className="w-8 h-8 object-contain"
                        />
                        <span>{character.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Character Preview */}
            {selectedCharacter && selectedCharacter !== 'default' && animeCharacters[selectedCharacter] && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Preview</p>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center p-2">
                    <img 
                      src={animeCharacters[selectedCharacter].icon} 
                      alt={animeCharacters[selectedCharacter].name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {animeCharacters[selectedCharacter].name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This character will appear as your level icon
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Marketplace Connections */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Marketplace Connections</CardTitle>
                <CardDescription>Connect your marketplace accounts to enable crosslisting</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingAccounts ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MARKETPLACES.map((marketplace) => {
                  if (!marketplace || !marketplace.icon) return null;
                  
                  const Icon = marketplace.icon;
                  const status = getMarketplaceAccountStatus(marketplace.id);
                  const isComingSoon = marketplace.status === 'coming_soon';

                  return (
                    <Card key={marketplace.id} className={isComingSoon ? 'opacity-75' : ''}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${marketplace.color || 'bg-gray-500'} flex items-center justify-center`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{marketplace.name}</CardTitle>
                              <CardDescription className="text-xs">
                                {marketplace.description}
                              </CardDescription>
                            </div>
                          </div>
                          {isComingSoon && (
                            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        <div className="flex items-center gap-2">
                          {status.connected ? (
                            <>
                              {status.expired ? (
                                <>
                                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                                  <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                                    Token Expired
                                  </span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                    Connected
                                  </span>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-gray-400" />
                              <span className="text-xs font-medium text-gray-500">
                                Not Connected
                              </span>
                            </>
                          )}
                        </div>

                        {status.connected && status.accountName && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Account: <span className="font-medium">{status.accountName}</span>
                          </div>
                        )}

                        {marketplace.id === 'facebook' && facebookStatus?.connected && facebookPages.length > 0 && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Pages: {facebookPages.length}
                          </div>
                        )}

                        <div className="flex gap-2">
                          {status.connected ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarketplaceReconnect(marketplace.id)}
                                disabled={isComingSoon}
                                className="flex-1 text-xs"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Reconnect
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarketplaceDisconnect(marketplace.id)}
                                disabled={isComingSoon}
                                className="flex-1 text-xs text-destructive hover:text-destructive"
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Disconnect
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={() => handleMarketplaceConnect(marketplace.id)}
                              disabled={isComingSoon || (marketplace.id === 'facebook' && !sdkReady)}
                              className="flex-1 text-xs"
                              size="sm"
                            >
                              <Icon className="w-3 h-3 mr-1" />
                              {marketplace.id === 'facebook' 
                                ? (!sdkReady ? 'Loading...' : 'Login with Facebook')
                                : 'Connect'}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Facebook Pages (shown when Facebook is connected) */}
            {facebookStatus?.connected && facebookPages.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Label className="text-sm font-medium mb-2">Your Facebook Pages</Label>
                <div className="space-y-2">
                  {facebookPages.map((page) => (
                    <div
                      key={page.id}
                      className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {page.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Page ID: {page.id}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Card */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-gray-500" />
                <Label className="text-sm font-medium">About Marketplace Connections</Label>
              </div>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <p>• Connecting your marketplace accounts allows you to crosslist items across multiple platforms</p>
                <p>• Your OAuth tokens are stored securely and automatically refreshed when needed</p>
                <p>• You can disconnect at any time from this page</p>
                <p>• Each marketplace requires specific permissions - you'll be prompted during connection</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

