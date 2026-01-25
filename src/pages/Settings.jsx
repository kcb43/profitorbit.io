import React, { useState, useEffect, useRef } from 'react';
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
  'default-light': 'Light',
  'default-dark': 'Dark',
  'money-green-dark': 'Green',
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
  const [mercariConnected, setMercariConnected] = useState(() => {
    // Initialize from localStorage
    return localStorage.getItem('profit_orbit_mercari_connected') === 'true';
  });
  // Track if we've already shown the connection notification to prevent duplicates
  const mercariNotificationShown = useRef(false);
  const currentlyConnectingMarketplace = useRef(null);
  const mercariLoginPopup = useRef(null);
  const facebookLoginPopup = useRef(null);
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
      console.log('🟢 Profit Orbit: Marketplace status update received:', event.detail);
      
      if (event.detail.marketplace === 'mercari' && event.detail.status.loggedIn) {
        // Check if user explicitly disconnected - if so, ignore this update
        const wasExplicitlyDisconnected = localStorage.getItem('profit_orbit_mercari_disconnected') === 'true';
        if (wasExplicitlyDisconnected) {
          console.log('⚠️ Profit Orbit: Ignoring Mercari status update - user explicitly disconnected');
          return;
        }
        
        console.log('🟢 Profit Orbit: Mercari connection detected via event!');
        const userName = event.detail.status.userName || event.detail.status.name || 'Mercari User';
        
        // Update localStorage
        localStorage.setItem('profit_orbit_mercari_connected', 'true');
        localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({
          userName: userName,
          marketplace: 'mercari'
        }));
        
        // Only show toast if transitioning from disconnected to connected
        const wasConnected = mercariConnected;
        setMercariConnected(true);
        
        if (!wasConnected && !mercariNotificationShown.current) {
          mercariNotificationShown.current = true;
          toast({
            title: 'Mercari Connected!',
            description: `Connected as ${userName}`,
          });
        }
      }
    };
    
    window.addEventListener('marketplaceStatusUpdate', handleMarketplaceUpdate);
    
    // Also listen for extensionReady event from bridge script
    const handleExtensionReady = (event) => {
      console.log('🟢 Profit Orbit: Extension ready event:', event.detail);
      if (event.detail?.marketplaces?.mercari?.loggedIn) {
        // Check if user explicitly disconnected - if so, ignore this update
        const wasExplicitlyDisconnected = localStorage.getItem('profit_orbit_mercari_disconnected') === 'true';
        if (wasExplicitlyDisconnected) {
          console.log('⚠️ Profit Orbit: Ignoring extensionReady event - user explicitly disconnected');
          return;
        }
        
        console.log('🟢 Profit Orbit: Mercari connection detected via extensionReady event!');
        const mercariData = event.detail.marketplaces.mercari;
        const userName = mercariData.userName || mercariData.name || 'Mercari User';
        
        // Update localStorage
        localStorage.setItem('profit_orbit_mercari_connected', 'true');
        localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({
          userName: userName,
          marketplace: 'mercari'
        }));
        
        // Only show toast if transitioning from disconnected to connected
        const wasConnected = mercariConnected;
        setMercariConnected(true);
        
        if (!wasConnected && !mercariNotificationShown.current) {
          mercariNotificationShown.current = true;
          toast({
            title: 'Mercari Connected!',
            description: `Connected as ${userName}`,
          });
        }
      }
    };
    window.addEventListener('extensionReady', handleExtensionReady);
    
    // Listen for bridge script loaded event (from content script)
    const handleBridgeScriptLoaded = (event) => {
      console.log('Profit Orbit: Bridge script loaded event received:', event.detail);
      // Update bridge detection
      setTimeout(() => {
        checkMercariStatusFromStorage();
      }, 500);
    };
    window.addEventListener('profitOrbitBridgeScriptLoaded', handleBridgeScriptLoaded);
    
    // Listen for bridge loaded event (from injected script)
    const handleBridgeLoaded = () => {
      console.log('Profit Orbit: Bridge loaded event received - flag should be set');
      // Force check after a brief delay
      setTimeout(() => {
        checkMercariStatusFromStorage();
      }, 500);
    };
    window.addEventListener('profitOrbitBridgeLoaded', handleBridgeLoaded);
    
    // Listen for bridge ready event (from page script)
    const handleBridgeReady = () => {
      console.log('Profit Orbit: Bridge ready event received');
      // Try to check status once bridge is ready
      setTimeout(() => {
        checkMercariStatusFromStorage();
      }, 500);
    };
    window.addEventListener('profitOrbitBridgeReady', handleBridgeReady);
    
    // Listen for extension invalidation event (extension was reloaded)
    const handleExtensionInvalidated = () => {
      console.warn('⚠️ Profit Orbit: Extension context invalidated - extension was reloaded');
      toast({
        title: 'Extension Reloaded',
        description: 'The extension was reloaded. Please refresh this page to reconnect.',
        variant: 'destructive',
        duration: 10000,
      });
    };
    window.addEventListener('profitOrbitExtensionInvalidated', handleExtensionInvalidated);
    
    // Listen for Mercari logged-in notification from extension (immediate notification)
    const handleMercariConnectionReady = (event) => {
      // Only accept messages from same origin
      if (event.source !== window) return;
      
      if (event.data && event.data.type === 'MERCARI_CONNECTION_READY') {
        console.log('🟢 Profit Orbit: MERCARI_CONNECTION_READY received:', event.data.payload);
        
        // Check if user explicitly disconnected - if so, ignore this update
        const wasExplicitlyDisconnected = localStorage.getItem('profit_orbit_mercari_disconnected') === 'true';
        if (wasExplicitlyDisconnected) {
          console.log('⚠️ Profit Orbit: Ignoring MERCARI_CONNECTION_READY - user explicitly disconnected');
          return;
        }
        
        const userName = event.data.payload?.userName || 'Mercari User';
        
        // Update localStorage
        localStorage.setItem('profit_orbit_mercari_connected', 'true');
        localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({
          userName: userName,
          marketplace: 'mercari'
        }));
        
        // Close the login popup if it's open
        if (mercariLoginPopup.current && !mercariLoginPopup.current.closed) {
          try {
            console.log('🔒 Closing Mercari login popup');
            mercariLoginPopup.current.close();
            mercariLoginPopup.current = null;
          } catch (e) {
            console.error('Error closing Mercari popup:', e);
          }
        }
        
        // Only show toast if transitioning from disconnected to connected
        const wasConnected = mercariConnected;
        setMercariConnected(true);
        
        if (!wasConnected && !mercariNotificationShown.current) {
          mercariNotificationShown.current = true;
          toast({
            title: 'Mercari Connected!',
            description: `Connected as ${userName}`,
          });
        }
      }
      
      // Handle Facebook connection ready
      if (event.data && event.data.type === 'FACEBOOK_CONNECTION_READY') {
        console.log('🟢 Profit Orbit: FACEBOOK_CONNECTION_READY received:', event.data.payload);
        
        // Close the login popup if it's open
        if (facebookLoginPopup.current && !facebookLoginPopup.current.closed) {
          try {
            console.log('🔒 Closing Facebook login popup');
            facebookLoginPopup.current.close();
            facebookLoginPopup.current = null;
          } catch (e) {
            console.error('Error closing Facebook popup:', e);
          }
        }
        
        // Update connection state
        const userName = event.data.payload?.userName || 'Facebook User';
        localStorage.setItem('profit_orbit_facebook_connected', 'true');
        localStorage.setItem('profit_orbit_facebook_user', JSON.stringify({
          userName: userName,
          marketplace: 'facebook'
        }));
        
        toast({
          title: 'Facebook Connected!',
          description: `Connected as ${userName}`,
        });
        
        // Refresh Facebook status
        checkFacebookStatus();
      }
    };
    window.addEventListener('message', handleMercariConnectionReady);
    
    // Check if already connected on mount and get username
    const checkMercariStatus = () => {
      const mercariStatus = localStorage.getItem('profit_orbit_mercari_connected');
      if (mercariStatus === 'true') {
        setMercariConnected(true);
        // If already connected on mount, mark notification as shown to prevent duplicate toasts
        mercariNotificationShown.current = true;
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
    
    // Check if bridge is already available
    const checkBridgeAvailability = () => {
      const bridgeLoaded = window.__PROFIT_ORBIT_BRIDGE_LOADED === true;
      const apiAvailable = window.ProfitOrbitExtension && window.ProfitOrbitExtension.isAvailable();
      
      if (bridgeLoaded || apiAvailable) {
        console.log('Profit Orbit: Bridge detected - loaded:', bridgeLoaded, 'API available:', apiAvailable);
        setTimeout(() => {
          checkMercariStatusFromStorage();
        }, 1000);
        return true;
      }
      return false;
    };
    
    if (!checkBridgeAvailability()) {
      console.log('Profit Orbit: Bridge API not yet available, waiting for bridgeReady event...');
      
      // Run diagnostic after a short delay
      setTimeout(() => {
        runExtensionDiagnostic();
      }, 2000);
      
      // Poll for bridge availability (fallback)
      const bridgeCheckInterval = setInterval(() => {
        if (checkBridgeAvailability()) {
          console.log('Profit Orbit: Bridge detected via polling');
          clearInterval(bridgeCheckInterval);
        }
      }, 500);
      
      // Clear interval after 10 seconds and show final diagnostic
      setTimeout(() => {
        clearInterval(bridgeCheckInterval);
        if (!window.__PROFIT_ORBIT_BRIDGE_LOADED && !window.ProfitOrbitExtension) {
          console.warn('Profit Orbit: Bridge API still not available after 10 seconds');
          runExtensionDiagnostic();
        }
      }, 10000);
    }
    
    // Diagnostic function to help troubleshoot extension issues
    function runExtensionDiagnostic() {
      console.group('🔍 Profit Orbit Extension Diagnostic');
      console.log('Current URL:', window.location.href);
      console.log('Expected URLs:', [
        'https://profitorbit.io/*',
        'http://localhost:5173/*',
        'http://localhost:5174/*'
      ]);
      
      const currentUrl = window.location.href;
      const urlMatches = [
        'https://profitorbit.io',
        'http://localhost:5173',
        'http://localhost:5174'
      ].some(pattern => currentUrl.startsWith(pattern));
      
      console.log('URL matches expected pattern:', urlMatches ? '✅ YES' : '❌ NO');
      
      console.log('Bridge flag (window.__PROFIT_ORBIT_BRIDGE_LOADED):', window.__PROFIT_ORBIT_BRIDGE_LOADED);
      console.log('Bridge API (window.ProfitOrbitExtension):', window.ProfitOrbitExtension ? '✅ EXISTS' : '❌ NOT FOUND');
      
      // Check for bridge script logs
      console.log('');
      console.log('🔍 DIAGNOSIS:');
      if (!window.__PROFIT_ORBIT_BRIDGE_LOADED && !window.ProfitOrbitExtension) {
        console.error('❌ NO bridge script logs detected in console');
        console.error('❌ This means the content script is NOT loading');
        console.error('');
        console.error('📋 MOST LIKELY CAUSES:');
        console.error('   1. Extension is NOT installed');
        console.error('   2. Extension is DISABLED');
        console.error('   3. Extension has ERRORS preventing it from loading');
        console.error('');
        console.error('🔧 HOW TO FIX:');
        console.error('   1. Open chrome://extensions/ in a new tab');
        console.error('   2. Look for "Profit Orbit - Crosslisting Assistant"');
        console.error('   3. If NOT FOUND:');
        console.error('      - Enable "Developer mode" (top-right toggle)');
        console.error('      - Click "Load unpacked"');
        console.error('      - Select the extension/ folder from your project');
        console.error('   4. If FOUND but DISABLED:');
        console.error('      - Toggle it ON');
        console.error('   5. If FOUND but has ERRORS:');
        console.error('      - Click "Errors" button to see details');
        console.error('      - Check background script console');
        console.error('   6. After fixing, RELOAD the extension:');
        console.error('      - Click the circular arrow (reload) icon');
        console.error('   7. Then REFRESH this page (F5)');
        console.error('');
        console.error('💡 TIP: Check the browser console for logs starting with 🔵');
        console.error('   If you see NO 🔵 logs, the content script is not loading');
      }
      console.groupEnd();
    }
    
    // Poll for Mercari connection status every 500ms for faster updates
    const pollInterval = setInterval(() => {
      const currentStatus = localStorage.getItem('profit_orbit_mercari_connected');
      const isConnected = currentStatus === 'true';
      const wasExplicitlyDisconnected = localStorage.getItem('profit_orbit_mercari_disconnected') === 'true';
      
      // If user explicitly disconnected, don't auto-reconnect even if extension detects login
      if (wasExplicitlyDisconnected && isConnected && !mercariConnected) {
        console.log('⚠️ Profit Orbit: Mercari login detected but user explicitly disconnected - ignoring auto-reconnect');
        // Clear the connection status that extension set
        localStorage.removeItem('profit_orbit_mercari_connected');
        localStorage.removeItem('profit_orbit_mercari_user');
        return;
      }
      
      // Always sync state with localStorage - force update if different
      // But don't show toast here - only show on explicit connection actions
      if (isConnected !== mercariConnected) {
        console.log('🟢 Profit Orbit: State sync - updating from', mercariConnected, 'to', isConnected);
        setMercariConnected(isConnected);

        // Clear disconnect flag when explicitly reconnected
        if (isConnected) {
          localStorage.removeItem('profit_orbit_mercari_disconnected');
          // Get user info
          const userData = localStorage.getItem('profit_orbit_mercari_user');
          if (userData) {
            try {
              const parsed = JSON.parse(userData);
              console.log('🟢 Profit Orbit: Mercari user:', parsed.userName);
            } catch (e) {
              console.error('Error parsing user data:', e);
            }
          }
        } else {
          // Reset notification flag when disconnected
          mercariNotificationShown.current = false;
        }
      }
    }, 500);
    
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
      window.removeEventListener('message', handleMercariConnectionReady);
      window.removeEventListener('marketplaceStatusUpdate', handleMarketplaceUpdate);
      window.removeEventListener('extensionReady', handleExtensionReady);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profitOrbitBridgeReady', handleBridgeReady);
      window.removeEventListener('profitOrbitBridgeLoaded', handleBridgeLoaded);
      window.removeEventListener('profitOrbitBridgeScriptLoaded', handleBridgeScriptLoaded);
      window.removeEventListener('profitOrbitExtensionInvalidated', handleExtensionInvalidated);
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
    
    const popup = window.open(
      'https://www.mercari.com/login/',
      'MercariLogin',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no`
    );
    
    // Store popup reference for auto-close on connection
    if (popup) {
      mercariLoginPopup.current = popup;
    }
    
    toast({
      title: 'Mercari Login',
      description: 'Log into Mercari in the popup. It will close automatically when connected.',
      duration: 6000,
    });
  };

  // Wait for extension to be ready with retry logic
  const waitForExtensionReady = async (timeout = 3000) => {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const bridgeLoaded = window.__PROFIT_ORBIT_BRIDGE_LOADED === true;
      const apiAvailable = window.ProfitOrbitExtension && window.ProfitOrbitExtension.isAvailable();
      
      if (bridgeLoaded || apiAvailable) {
        console.log('✅ Profit Orbit: Extension ready');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return false;
  };

  // Wait for Mercari connection with retry logic
  const waitForMercariConnection = async (timeout = 5000) => {
    const start = Date.now();
    
    // Clear disconnect flag when user explicitly connects
    localStorage.removeItem('profit_orbit_mercari_disconnected');
    
    // Set request flag to wake up extension
    localStorage.setItem('profit_orbit_request_status', 'true');
    
    // Also try direct query if API is available
    if (window.ProfitOrbitExtension && window.ProfitOrbitExtension.isAvailable()) {
      console.log('🟢 Profit Orbit: Using bridge API to check connection');
      window.ProfitOrbitExtension.getAllStatus((response) => {
        console.log('🟢 Profit Orbit: getAllStatus response:', response);
        
        const mercariStatus = response?.status?.mercari;
        if (mercariStatus?.loggedIn) {
          const userName = mercariStatus.userName || 'Mercari User';
          localStorage.setItem('profit_orbit_mercari_connected', 'true');
          localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({
            userName: userName,
            marketplace: 'mercari'
          }));
        }
      });
    }
    
    while (Date.now() - start < timeout) {
      const status = localStorage.getItem('profit_orbit_mercari_connected');
      
      if (status === 'true') {
        console.log('✅ Profit Orbit: Mercari connection detected');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return false;
  };

  const handleMercariConnect = async () => {
    currentlyConnectingMarketplace.current = 'mercari';
    
    try {
      console.log('🟢🟢🟢 Profit Orbit: Starting Mercari connection... 🟢🟢🟢');
      
      // Show "connecting..." state immediately
      toast({
        title: 'Connecting to Mercari...',
        description: 'Checking extension and Mercari login status...',
      });
      
      // Step 1: Wait for extension to be ready (with retry)
      console.log('🟢 Profit Orbit: Waiting for extension to be ready...');
      const extensionReady = await waitForExtensionReady(3000);
      
      if (!extensionReady) {
        console.warn('⚠️ Profit Orbit: Extension not ready after timeout');
        
        // Check if URL matches expected patterns
        const currentUrl = window.location.href;
        const expectedPatterns = [
          'https://profitorbit.io',
          'http://localhost:5173',
          'http://localhost:5174'
        ];
        const urlMatches = expectedPatterns.some(pattern => currentUrl.startsWith(pattern));
        
        if (!urlMatches) {
          console.error('🔴 Profit Orbit: URL does not match expected patterns!');
          toast({
            title: 'Extension Not Detected',
            description: 'The extension only works on profitorbit.io or localhost. Please check your URL.',
            variant: 'destructive',
            duration: 10000,
          });
          return;
        }
        
        // Show helpful error message
        toast({
          title: 'Extension Not Ready',
          description: 'The extension may still be loading. Please wait a moment and try again, or refresh the page.',
          variant: 'destructive',
          duration: 10000,
        });
        
        // Run diagnostic
        runExtensionDiagnostic();
        return;
      }
      
      console.log('🟢 Profit Orbit: Extension ready, checking Mercari connection...');
      
      // Step 2: Wait for Mercari connection (with retry)
      const connected = await waitForMercariConnection(5000);
      
      if (connected) {
        // Check if user explicitly disconnected - if so, clear the status
        const wasExplicitlyDisconnected = localStorage.getItem('profit_orbit_mercari_disconnected') === 'true';
        if (wasExplicitlyDisconnected) {
          console.log('⚠️ Profit Orbit: User explicitly disconnected - clearing auto-detected connection');
          localStorage.removeItem('profit_orbit_mercari_connected');
          localStorage.removeItem('profit_orbit_mercari_user');
          toast({
            title: 'Connection Blocked',
            description: 'You previously disconnected Mercari. Please log into Mercari first, then try again.',
            variant: 'destructive',
          });
          return;
        }
        
        // Success!
        const wasConnected = mercariConnected;
        setMercariConnected(true);
        
        // Clear disconnect flag when user explicitly connects
        localStorage.removeItem('profit_orbit_mercari_disconnected');

        // Explicitly request the extension to save a server-side session (CONNECT_PLATFORM)
        try {
          window.postMessage({ type: 'REQUEST_CONNECT_PLATFORM', payload: { platform: 'mercari' } }, '*');
        } catch (_) {
          // ignore
        }
        
        // Only show success toast if transitioning from disconnected to connected
        if (!wasConnected && !mercariNotificationShown.current) {
          mercariNotificationShown.current = true;
          const userData = JSON.parse(localStorage.getItem('profit_orbit_mercari_user') || '{}');
          toast({
            title: 'Mercari Connected!',
            description: userData.userName ? `Connected as ${userData.userName}` : 'Your Mercari account is connected.',
          });
        }
      } else {
        // Connection not found after retries
        console.log('🔴 Profit Orbit: No connection found after retries');
        toast({
          title: 'Not Connected',
          description: 'Please log into Mercari in a new tab first, then try again.',
          variant: 'destructive',
        });
        showMercariInstructions(true); // true = explicit user action
      }
      
    } catch (error) {
      console.error('🔴 Profit Orbit: Error:', error);
      toast({
        title: 'Connection Error',
        description: error.message || 'Failed to check Mercari connection.',
        variant: 'destructive',
      });
    } finally {
      currentlyConnectingMarketplace.current = null;
    }
  };

  const checkMercariStatusFromStorage = () => {
    console.log('Profit Orbit: Checking Mercari status from localStorage...');
    const mercariStatus = localStorage.getItem('profit_orbit_mercari_connected');
    console.log('Profit Orbit: Mercari status from localStorage:', mercariStatus);
    console.log('Profit Orbit: Current mercariConnected state:', mercariConnected);
    
    if (mercariStatus === 'true') {
      const userInfo = JSON.parse(localStorage.getItem('profit_orbit_mercari_user') || '{}');
      console.log('Profit Orbit: Mercari user info:', userInfo);
      
      // Always update state if localStorage says connected, regardless of current state
      const wasConnected = mercariConnected;
      if (!wasConnected) {
        console.log('Profit Orbit: Setting Mercari connected to true (was false)');
        setMercariConnected(true);
      } else {
        console.log('Profit Orbit: Mercari already connected in state');
      }
      
      // Don't show toast here - this function is called from event handlers
      // Toast should only show on explicit user action (clicking connect button)
      return true;
    } else {
      console.log('Profit Orbit: Mercari not connected in localStorage, querying extension...');
      // Check if we can query extension via bridge script
      if (window.ProfitOrbitExtension && window.ProfitOrbitExtension.isAvailable()) {
        try {
          window.ProfitOrbitExtension.getAllStatus((response) => {
            if (response.error) {
              console.log('Profit Orbit: Extension not available:', response.error);
              // Don't show instructions - this is automatic background check, not user action
            } else if (response?.status?.mercari?.loggedIn) {
              console.log('Profit Orbit: Extension reports Mercari logged in:', response.status.mercari);
              const wasConnected = mercariConnected;
              setMercariConnected(true);
              localStorage.setItem('profit_orbit_mercari_connected', 'true');
              localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({
                userName: response.status.mercari.userName || response.status.mercari.name || 'Mercari User',
                marketplace: 'mercari'
              }));
              
              // Don't show toast here - this is called from checkMercariStatusFromStorage
              // which is triggered by events, not user action
            } else {
              console.log('Profit Orbit: Extension reports Mercari not logged in');
              // Don't show instructions - this is automatic background check, not user action
            }
          });
        } catch (e) {
          console.log('Profit Orbit: Extension communication failed:', e);
          // Don't show instructions - this is automatic background check, not user action
        }
      } else {
        console.log('Profit Orbit: Extension bridge not available - bridge script may not be loaded');
        console.log('Profit Orbit: Checking for extension...');
        
        // Try to detect if extension is installed by checking for chrome.runtime
        // Note: This only works if we can access chrome.runtime directly (which we can't from React)
        // But we can check if the bridge script has injected the API
        if (window.__ProfitOrbitBridgeReady) {
          console.log('Profit Orbit: Bridge ready flag detected, but API not available');
        }
        
        // Try to trigger bridge script via custom event
        window.dispatchEvent(new CustomEvent('checkMercariStatus'));
        
        // Also try to manually inject a check
        const checkExtensionInstalled = () => {
          // Check if extension files are accessible (this won't work due to CSP, but worth trying)
          const testScript = document.createElement('script');
          testScript.onerror = () => {
            console.log('Profit Orbit: Extension may not be installed or enabled');
            // Don't show instructions - this is automatic background check, not user action
          };
          testScript.src = chrome?.runtime?.getURL?.('profit-orbit-bridge.js') || '';
          if (testScript.src) {
            document.head.appendChild(testScript);
          }
        };
        
        // Wait a bit and check again
        setTimeout(() => {
          const status = localStorage.getItem('profit_orbit_mercari_connected');
          if (status === 'true') {
            checkMercariStatusFromStorage();
          } else if (!window.ProfitOrbitExtension) {
            console.warn('Profit Orbit: Extension bridge still not available after timeout');
            console.warn('Profit Orbit: Please ensure:');
            console.warn('  1. Extension is installed and enabled');
            console.warn('  2. Extension is reloaded after code changes');
            console.warn('  3. Page is refreshed after extension reload');
            // Don't show instructions - this is automatic background check, not user action
          }
        }, 2000);
      }
      return false;
    }
  };

  const showMercariInstructions = (isExplicitUserAction = false) => {
    // Only show Mercari instructions if:
    // 1. User explicitly clicked "Connect Mercari" (isExplicitUserAction = true), OR
    // 2. User is currently trying to connect Mercari (currentlyConnectingMarketplace = 'mercari')
    const shouldShow = isExplicitUserAction || currentlyConnectingMarketplace.current === 'mercari';
    
    if (!shouldShow) {
      console.log('⚠️ Skipping Mercari instructions - not an explicit user action and not currently connecting Mercari');
      return;
    }
    
    toast({
      title: 'Mercari Not Detected',
      description: (
        <div className="text-white">
          <span>1) Install & enable the Orben extension</span>
          <br />
          <span>2) Open Mercari.com in a new tab and log in</span>
          <br />
          <span>3) Click "Connect Mercari" again — Orben will auto-detect your login</span>
        </div>
      ),
      variant: 'destructive',
      duration: 10000,
    });
  };

  const handleFacebookLogin = () => {
    // Open Facebook Marketplace in a small popup window (like Mercari)
    const width = 500;
    const height = 650;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    // Use unique window name to avoid conflicts
    const windowName = `FacebookLogin_${Date.now()}`;
    
    const popup = window.open(
      'https://www.facebook.com/marketplace/',
      windowName,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no`
    );
    
    // Store popup reference for auto-close on connection
    if (popup) {
      facebookLoginPopup.current = popup;
    }
    
    toast({
      title: 'Facebook Login',
      description: 'Log into Facebook in the popup. It will close automatically when connected.',
      duration: 6000,
    });
  };

  const waitForFacebookConnection = async (timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const status = (() => {
        try {
          return localStorage.getItem('profit_orbit_facebook_connected');
        } catch (_) {
          return null;
        }
      })();

      if (status === 'true') return true;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return false;
  };

  const showFacebookInstructions = () => {
    toast({
      title: 'Facebook Not Connected',
      description: (
        <div className="text-white">
          <span>1) Install & enable the Orben extension</span>
          <br />
          <span>2) Log into Facebook (via your Settings → Select 'Login')</span>
          <br />
          <span>3) Click Connect again — Orben will auto-detect your login</span>
        </div>
      ),
      variant: 'destructive',
      duration: 10000,
    });
  };

  const handleFacebookConnect = async () => {
    currentlyConnectingMarketplace.current = 'facebook';
    
    try {
      toast({
        title: 'Connecting to Facebook...',
        description: 'Checking extension and Facebook login status...',
      });

      const extensionReady = await waitForExtensionReady(3000);
      if (!extensionReady) {
        toast({
          title: 'Extension Not Ready',
          description: 'The extension may still be loading. Please refresh the page and try again.',
          variant: 'destructive',
          duration: 10000,
        });
        runExtensionDiagnostic();
        currentlyConnectingMarketplace.current = null;
        return;
      }

      // Ask the bridge to query status if needed
      try {
        window.ProfitOrbitExtension?.queryStatus?.();
      } catch (_) {}

      const connected = await waitForFacebookConnection(5000);
      if (connected) {
        // Clear explicit disconnect flag
        try {
          localStorage.removeItem('profit_orbit_facebook_disconnected');
        } catch (_) {}

        // Ask extension to export cookies & save server-side session
        try {
          window.postMessage({ type: 'REQUEST_CONNECT_PLATFORM', payload: { platform: 'facebook' } }, '*');
        } catch (_) {}

        toast({
          title: 'Facebook Connected!',
          description: 'Your Facebook session was detected via the extension.',
        });
      } else {
        // Only show one error message
        showFacebookInstructions();
      }
    } catch (error) {
      console.error('🔴 Profit Orbit: Facebook connect error:', error);
      showFacebookInstructions();
    } finally {
      currentlyConnectingMarketplace.current = null;
    }
  };

  const handleMarketplaceConnect = (marketplaceId) => {
    console.log('handleMarketplaceConnect called with:', marketplaceId);
    if (marketplaceId === 'facebook') {
      console.log('Calling handleFacebookConnect (extension-based)...');
      handleFacebookConnect();
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
        // Also clear extension-based status (Vendoo-like cookie session)
        try {
          localStorage.removeItem('profit_orbit_facebook_connected');
          localStorage.removeItem('profit_orbit_facebook_user');
          localStorage.setItem('profit_orbit_facebook_disconnected', 'true');
        } catch (_) {}
      } else if (marketplaceId === 'ebay') {
        localStorage.removeItem('ebay_user_token');
        localStorage.removeItem('ebay_username');
      } else if (marketplaceId === 'mercari') {
        // Clear Mercari connection
        setMercariConnected(false);
        localStorage.removeItem('profit_orbit_mercari_connected');
        localStorage.removeItem('profit_orbit_mercari_user');
        // Set flag to prevent auto-reconnection after explicit disconnect
        localStorage.setItem('profit_orbit_mercari_disconnected', 'true');
        // Reset notification flag when disconnected
        mercariNotificationShown.current = false;
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
    // Special handling for Facebook Marketplace (uses extension cookies/session, not Graph API OAuth)
    if (marketplaceId === 'facebook') {
      const connected = (() => {
        try {
          return localStorage.getItem('profit_orbit_facebook_connected') === 'true';
        } catch (_) {
          return false;
        }
      })();
      const accountName = (() => {
        try {
          return connected ? JSON.parse(localStorage.getItem('profit_orbit_facebook_user') || '{}')?.userName : null;
        } catch (_) {
          return null;
        }
      })();
      return { connected, expired: false, accountName };
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
                                Login
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
                          ) : marketplace.id === 'facebook' ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleFacebookLogin}
                                className="flex-1 text-xs"
                              >
                                Login
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={handleFacebookConnect}
                                className="flex-1 text-xs"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Connect
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={() => handleMarketplaceConnect(marketplace.id)}
                              disabled={isComingSoon}
                              className="flex-1 text-xs"
                              size="sm"
                            >
                              <img src={iconSrc} alt={marketplace.name} className="w-3 h-3 mr-1 object-contain" />
                              Connect
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