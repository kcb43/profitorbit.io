import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { 
  Palette, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import facebookLogo from "@/assets/facebook-logo.svg";
// Using official eBay logo from Wikimedia Commons
const ebayLogo = "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg";
// Using official Mercari logo from brandfetch
const mercariLogo = "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B";
import poshmarkLogo from "@/assets/poshmark-logo.svg";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  getConnectionStatus, 
  clearToken, 
  storeToken,
  getUserPages 
} from "@/api/facebookClient";
import { crosslistingEngine } from '@/services/CrosslistingEngine';
import { useFacebookSDK } from '@/hooks/useFacebookSDK';

const themes = {
  'default-light': 'Default Light',
  'default-dark': 'Default Dark',
  'money-green-light': 'Money Green Light',
  'money-green-dark': 'Money Green Dark',
};

const MARKETPLACES = [
  {
    id: 'facebook',
    name: 'Facebook Marketplace',
    icon: facebookLogo,
    color: 'bg-blue-600',
    description: 'List items on Facebook Marketplace',
    requiredPermissions: ['pages_manage_posts', 'business_management'],
    status: 'available',
  },
  {
    id: 'ebay',
    name: 'eBay',
    icon: ebayLogo,
    color: 'bg-yellow-500',
    description: 'List items on eBay',
    requiredPermissions: ['Trading API access'],
    status: 'available',
  },
  {
    id: 'mercari',
    name: 'Mercari',
    icon: mercariLogo,
    color: 'bg-orange-500',
    description: 'List items on Mercari via browser extension',
    requiredPermissions: ['Browser extension required'],
    status: 'available',
  },
  {
    id: 'poshmark',
    name: 'Poshmark',
    icon: poshmarkLogo,
    color: 'bg-pink-500',
    description: 'List items on Poshmark',
    requiredPermissions: ['API access'],
    status: 'coming_soon',
  },
];

export default function Settings() {
  const [currentTheme, setCurrentTheme] = useState('default-light');
  const [facebookStatus, setFacebookStatus] = useState(null);
  const [facebookPages, setFacebookPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [marketplaceAccounts, setMarketplaceAccounts] = useState({});
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [facebookConfigId, setFacebookConfigId] = useState('');
  const [mercariSaleDetection, setMercariSaleDetection] = useState(() => {
    return localStorage.getItem('mercari_sale_detection') === 'true';
  });
  const [mercariEnhancedConnection, setMercariEnhancedConnection] = useState(() => {
    return localStorage.getItem('mercari_enhanced_connection') === 'true';
  });
  const [mercariConnected, setMercariConnected] = useState(false);
  const { sdkReady, fbInstance} = useFacebookSDK();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Load saved preferences
    const savedTheme = localStorage.getItem('theme') || 'default-light';
    
    setCurrentTheme(savedTheme);

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
    
    // Listen for extension marketplace status updates
    const handleMarketplaceUpdate = (event) => {
      console.log('Marketplace status update received:', event.detail);
      
      if (event.detail.marketplace === 'mercari' && event.detail.status.loggedIn) {
        setMercariConnected(true);
        // Update localStorage with user info
        if (event.detail.status.userName) {
          localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({
            userName: event.detail.status.userName,
            marketplace: 'mercari'
          }));
        }
        toast({
          title: 'Mercari Detected!',
          description: `Logged in as ${event.detail.status.userName}`,
        });
      }
    };
    
    window.addEventListener('marketplaceStatusUpdate', handleMarketplaceUpdate);
    
    // Also listen for extensionReady event from bridge script
    const handleExtensionReady = (event) => {
      console.log('Extension ready event:', event.detail);
      if (event.detail?.marketplaces?.mercari?.loggedIn) {
        setMercariConnected(true);
        const mercariData = event.detail.marketplaces.mercari;
        if (mercariData.userName) {
          localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({
            userName: mercariData.userName,
            marketplace: 'mercari'
          }));
        }
      }
    };
    window.addEventListener('extensionReady', handleExtensionReady);
    
    // Check if already connected on mount and get username
    const checkMercariStatus = () => {
      const mercariStatus = localStorage.getItem('profit_orbit_mercari_connected');
      if (mercariStatus === 'true') {
        setMercariConnected(true);
        // Try to get username from localStorage
        const userData = localStorage.getItem('profit_orbit_mercari_user');
        if (userData) {
          try {
            const parsed = JSON.parse(userData);
            if (parsed.userName) {
              // Username will be displayed via getMarketplaceAccountStatus
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    };
    
    // Check immediately
    checkMercariStatus();
    
    // Poll for Mercari connection status every 1 second (more frequent for better detection)
    const pollInterval = setInterval(() => {
      const currentStatus = localStorage.getItem('profit_orbit_mercari_connected');
      console.log('Profit Orbit: Polling Mercari status:', currentStatus, 'Current state:', mercariConnected);
      if (currentStatus === 'true' && !mercariConnected) {
        console.log('Profit Orbit: Detected Mercari connection change!');
        setMercariConnected(true);
        checkMercariStatus();
      } else if (currentStatus !== 'true' && mercariConnected) {
        console.log('Profit Orbit: Mercari disconnected');
        setMercariConnected(false);
      }
    }, 1000);
    
    // Also listen for storage events (in case extension updates localStorage from another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'profit_orbit_mercari_connected') {
        const isConnected = e.newValue === 'true';
        if (isConnected !== mercariConnected) {
          setMercariConnected(isConnected);
          checkMercariStatus();
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('marketplaceStatusUpdate', handleMarketplaceUpdate);
      window.removeEventListener('extensionReady', handleExtensionReady);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [searchParams, navigate, toast, mercariConnected]);

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
    // Use OAuth redirect method which has proper Marketplace scopes configured
    // This redirects to /auth/facebook/auth which has the correct scopes:
    // - pages_manage_metadata
    // - pages_manage_posts
    // - business_management
    // - pages_read_engagement
    
    // Save current theme before redirect
    const currentTheme = localStorage.getItem('theme') || 'default-light';
    sessionStorage.setItem('preserved_theme', currentTheme);
    
    // Redirect to OAuth endpoint
    window.location.href = '/auth/facebook/auth';
  };

  const handleMercariLogin = () => {
    // Open Mercari login in a small popup window (like Vendoo)
    const width = 500;
    const height = 650;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    window.open(
      'https://www.mercari.com/login/',
      'MercariLogin',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no`
    );
    
    toast({
      title: 'Mercari Login',
      description: 'Log into Mercari in the popup, then close it and click "Connect Mercari".',
      duration: 6000,
    });
  };

  const handleMercariConnect = async () => {
    try {
      console.log('Checking Mercari connection...');
      
      // First, force a check via the bridge script by triggering extension query
      // The bridge script should query the extension and update localStorage
      if (window.ProfitOrbitExtension && window.ProfitOrbitExtension.isAvailable()) {
        // Use bridge script API
        window.ProfitOrbitExtension.queryStatus();
        setTimeout(() => {
          checkMercariStatusFromStorage();
        }, 500);
      } else {
        // Try to trigger bridge script via custom event
        window.dispatchEvent(new CustomEvent('checkMercariStatus'));
        setTimeout(() => {
          checkMercariStatusFromStorage();
        }, 1000);
      }
      
      // Check localStorage immediately
      checkMercariStatusFromStorage();
      
    } catch (error) {
      console.error('Error connecting Mercari:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to detect Mercari login. Make sure the extension is installed.',
        variant: 'destructive',
      });
    }
  };

  const checkMercariStatusFromStorage = () => {
    console.log('Profit Orbit: Checking Mercari status from localStorage...');
    const mercariStatus = localStorage.getItem('profit_orbit_mercari_connected');
    console.log('Profit Orbit: Mercari status from localStorage:', mercariStatus);
    
    if (mercariStatus === 'true') {
      const userInfo = JSON.parse(localStorage.getItem('profit_orbit_mercari_user') || '{}');
      console.log('Profit Orbit: Mercari user info:', userInfo);
      
      if (!mercariConnected) {
        console.log('Profit Orbit: Setting Mercari connected to true');
        setMercariConnected(true);
      }
      
      toast({
        title: 'Mercari Connected!',
        description: userInfo.userName ? `Connected as ${userInfo.userName}` : 'Your Mercari account is connected.',
      });
      return true;
    } else {
      console.log('Profit Orbit: Mercari not connected in localStorage, querying extension...');
      // Check if we can query extension via bridge script
      if (window.ProfitOrbitExtension && window.ProfitOrbitExtension.isAvailable()) {
        try {
          window.ProfitOrbitExtension.getAllStatus((response) => {
            if (response.error) {
              console.log('Profit Orbit: Extension not available:', response.error);
              showMercariInstructions();
            } else if (response?.status?.mercari?.loggedIn) {
              console.log('Profit Orbit: Extension reports Mercari logged in:', response.status.mercari);
              setMercariConnected(true);
              localStorage.setItem('profit_orbit_mercari_connected', 'true');
              localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({
                userName: response.status.mercari.userName || response.status.mercari.name || 'Mercari User',
                marketplace: 'mercari'
              }));
              toast({
                title: 'Mercari Connected!',
                description: (response.status.mercari.userName || response.status.mercari.name) 
                  ? `Connected as ${response.status.mercari.userName || response.status.mercari.name}` 
                  : 'Your Mercari account is connected.',
              });
            } else {
              console.log('Profit Orbit: Extension reports Mercari not logged in');
              showMercariInstructions();
            }
          });
        } catch (e) {
          console.log('Profit Orbit: Extension communication failed:', e);
          showMercariInstructions();
        }
      } else {
        console.log('Profit Orbit: Extension bridge not available - bridge script may not be loaded');
        // Try to trigger bridge script via custom event
        window.dispatchEvent(new CustomEvent('checkMercariStatus'));
        // Wait a bit and check again
        setTimeout(() => {
          const status = localStorage.getItem('profit_orbit_mercari_connected');
          if (status === 'true') {
            checkMercariStatusFromStorage();
          } else {
            showMercariInstructions();
          }
        }, 1000);
      }
      return false;
    }
  };

  const showMercariInstructions = () => {
    toast({
      title: 'Mercari Not Detected',
      description: '1) Make sure the Profit Orbit extension is installed and enabled\n2) Open Mercari.com in a new tab and log in\n3) Come back here and click "Connect Mercari" again\n\nThe extension will detect your login automatically.',
      variant: 'destructive',
      duration: 10000,
    });
  };

  const handleMarketplaceConnect = (marketplaceId) => {
    console.log('handleMarketplaceConnect called with:', marketplaceId);
    if (marketplaceId === 'facebook') {
      console.log('Calling loginWithFacebook...');
      loginWithFacebook();
    } else if (marketplaceId === 'ebay') {
      window.location.href = '/api/ebay/auth';
    } else if (marketplaceId === 'mercari') {
      handleMercariConnect();
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
      } else if (marketplaceId === 'mercari') {
        // Clear Mercari connection
        setMercariConnected(false);
        localStorage.removeItem('profit_orbit_mercari_connected');
        localStorage.removeItem('profit_orbit_mercari_user');
        localStorage.removeItem('mercari_session_detected');
        localStorage.removeItem('mercari_user_info');
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
    // Special handling for Mercari (uses extension, not OAuth)
    if (marketplaceId === 'mercari') {
      return { 
        connected: mercariConnected,
        expired: false,
        accountName: mercariConnected ? JSON.parse(localStorage.getItem('profit_orbit_mercari_user') || '{}').userName : null
      };
    }
    
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

        {/* Marketplace Connections */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
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
                  
                  const iconSrc = marketplace.icon;
                  const status = getMarketplaceAccountStatus(marketplace.id);
                  const isComingSoon = marketplace.status === 'coming_soon';

                  return (
                    <Card key={marketplace.id} className={isComingSoon ? 'opacity-75' : ''}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center p-2 border border-gray-200 dark:border-gray-700">
                              <img src={iconSrc} alt={marketplace.name} className="w-full h-full object-contain" />
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

                        {/* Mercari-specific options */}
                        {marketplace.id === 'mercari' && (
                          <div className="space-y-3 pt-2">
                            {/* Sale Detection Toggle */}
                            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                              <div className="flex-1">
                                <Label htmlFor="mercari-sale-detection" className="text-xs font-medium cursor-pointer">
                                  Sale Detection
                                </Label>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Auto-delist from other marketplaces when sold on Mercari
                                </p>
                              </div>
                              <Switch
                                id="mercari-sale-detection"
                                checked={mercariSaleDetection}
                                onCheckedChange={(checked) => {
                                  setMercariSaleDetection(checked);
                                  localStorage.setItem('mercari_sale_detection', checked);
                                }}
                                disabled={!mercariConnected}
                              />
                            </div>

                            {/* Enhanced Connection Toggle */}
                            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                              <div className="flex-1">
                                <Label htmlFor="mercari-enhanced" className="text-xs font-medium cursor-pointer">
                                  Enhanced Connection
                                </Label>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Improves connection stability, helps prevent listing failures
                                </p>
                              </div>
                              <Switch
                                id="mercari-enhanced"
                                checked={mercariEnhancedConnection}
                                onCheckedChange={(checked) => {
                                  setMercariEnhancedConnection(checked);
                                  localStorage.setItem('mercari_enhanced_connection', checked);
                                }}
                                disabled={!mercariConnected}
                              />
                            </div>

                            {/* Account switch info */}
                            {mercariConnected && (
                              <p className="text-[10px] text-muted-foreground text-center px-2">
                                To switch accounts, log into the different account directly on mercari.com
                              </p>
                            )}
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
                          ) : marketplace.id === 'mercari' ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleMercariLogin}
                                className="flex-1 text-xs"
                              >
                                Open Login
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={handleMercariConnect}
                                className="flex-1 text-xs"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Connect
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={() => handleMarketplaceConnect(marketplace.id)}
                              disabled={isComingSoon || (marketplace.id === 'facebook' && !sdkReady)}
                              className="flex-1 text-xs"
                              size="sm"
                            >
                              <img src={iconSrc} alt={marketplace.name} className="w-3 h-3 mr-1 object-contain" />
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

