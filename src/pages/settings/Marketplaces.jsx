/**
 * Marketplace Connections section.
 *
 * All marketplace connection logic extracted from the original Settings.jsx.
 * State, event listeners, and handlers are preserved 100% intact.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import facebookLogo from '@/assets/facebook-logo.svg';
import poshmarkLogo from '@/assets/poshmark-logo.svg';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getConnectionStatus,
  clearToken,
  storeToken,
  getUserPages,
} from '@/api/facebookClient';
import { crosslistingEngine } from '@/services/CrosslistingEngine';
import { useFacebookSDK } from '@/hooks/useFacebookSDK';
import { getSectionById } from '@/modules/settingsRegistry';
import SettingsSectionLayout from '@/components/settings/SettingsSectionLayout';

const section = getSectionById('marketplaces');

const ebayLogo = 'https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg';
const mercariLogo = 'https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B';

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

export default function MarketplacesSettings() {
  const [facebookStatus, setFacebookStatus] = useState(null);
  const [facebookPages, setFacebookPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [marketplaceAccounts, setMarketplaceAccounts] = useState({});
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [facebookConfigId, setFacebookConfigId] = useState('');
  const [mercariSaleDetection, setMercariSaleDetection] = useState(
    () => localStorage.getItem('mercari_sale_detection') === 'true',
  );
  const [mercariEnhancedConnection, setMercariEnhancedConnection] = useState(
    () => localStorage.getItem('mercari_enhanced_connection') === 'true',
  );
  const [mercariConnected, setMercariConnected] = useState(
    () => localStorage.getItem('profit_orbit_mercari_connected') === 'true',
  );

  const mercariNotificationShown = useRef(false);
  const currentlyConnectingMarketplace = useRef(null);
  const mercariLoginPopup = useRef(null);
  const facebookLoginPopup = useRef(null);
  const { sdkReady, fbInstance } = useFacebookSDK();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // ── Diagnostic helper ──────────────────────────────────────────────────────
  function runExtensionDiagnostic() {
    console.group('🔍 Profit Orbit Extension Diagnostic');
    console.log('Bridge flag:', window.__PROFIT_ORBIT_BRIDGE_LOADED);
    console.log('Bridge API:', window.ProfitOrbitExtension ? '✅ EXISTS' : '❌ NOT FOUND');
    console.groupEnd();
  }

  // ── Mercari status check ───────────────────────────────────────────────────
  const checkMercariStatusFromStorage = () => {
    const mercariStatus = localStorage.getItem('profit_orbit_mercari_connected');
    if (mercariStatus === 'true') {
      setMercariConnected(true);
      return true;
    }
    if (window.ProfitOrbitExtension && window.ProfitOrbitExtension.isAvailable()) {
      try {
        window.ProfitOrbitExtension.getAllStatus((response) => {
          if (response.error) return;
          const mercariSt = response?.status?.mercari;
          if (mercariSt?.loggedIn) {
            setMercariConnected(true);
            localStorage.setItem('profit_orbit_mercari_connected', 'true');
            localStorage.setItem(
              'profit_orbit_mercari_user',
              JSON.stringify({
                userName:
                  response.status.mercari.userName ||
                  response.status.mercari.name ||
                  'Mercari User',
                marketplace: 'mercari',
              }),
            );
          }
        });
      } catch (e) {
        console.log('Profit Orbit: Extension communication failed:', e);
      }
    }
    return false;
  };

  // ── useEffect: OAuth callbacks + event listeners + polls ──────────────────
  useEffect(() => {
    const facebookAuthSuccess = searchParams.get('facebook_auth_success');
    const facebookAuthError   = searchParams.get('facebook_auth_error');
    const token               = searchParams.get('token');

    if (facebookAuthSuccess === '1' && token) {
      try {
        const tokenData = JSON.parse(decodeURIComponent(token));
        storeToken(tokenData);
        toast({ title: 'Facebook Connected', description: 'Your Facebook account has been successfully connected.' });
        navigate('/Settings/marketplaces', { replace: true });
        checkFacebookStatus();
      } catch (error) {
        console.error('Error storing Facebook token:', error);
        toast({ title: 'Error', description: 'Failed to store Facebook token. Please try again.', variant: 'destructive' });
      }
    }

    if (facebookAuthError) {
      toast({ title: 'Facebook Connection Failed', description: decodeURIComponent(facebookAuthError), variant: 'destructive' });
      navigate('/Settings/marketplaces', { replace: true });
    }

    checkFacebookStatus();
    loadMarketplaceAccounts();

    // Facebook embedded signup messages
    const handleMessage = (event) => {
      if (!event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') console.log('Facebook embedded signup message:', data);
      } catch {}
    };
    window.addEventListener('message', handleMessage);

    // Extension marketplace status updates
    const handleMarketplaceUpdate = (event) => {
      if (event.detail.marketplace === 'mercari' && event.detail.status.loggedIn) {
        const wasExplicitlyDisconnected = localStorage.getItem('profit_orbit_mercari_disconnected') === 'true';
        if (wasExplicitlyDisconnected) return;
        const userName = event.detail.status.userName || event.detail.status.name || 'Mercari User';
        localStorage.setItem('profit_orbit_mercari_connected', 'true');
        localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({ userName, marketplace: 'mercari' }));
        const wasConnected = mercariConnected;
        setMercariConnected(true);
        if (!wasConnected && !mercariNotificationShown.current) {
          mercariNotificationShown.current = true;
          toast({ title: 'Mercari Connected!', description: `Connected as ${userName}` });
        }
      }
      if (event.detail.marketplace === 'facebook' && !event.detail.status.loggedIn) {
        localStorage.removeItem('profit_orbit_facebook_connected');
        localStorage.removeItem('profit_orbit_facebook_user');
        localStorage.setItem('profit_orbit_facebook_disconnected', 'true');
        checkFacebookStatus();
        toast({ title: 'Facebook Session Expired', description: 'Please reconnect to Facebook', variant: 'destructive' });
      }
    };
    window.addEventListener('marketplaceStatusUpdate', handleMarketplaceUpdate);

    // Extension ready
    const handleExtensionReady = (event) => {
      if (event.detail?.marketplaces?.mercari?.loggedIn) {
        const wasExplicitlyDisconnected = localStorage.getItem('profit_orbit_mercari_disconnected') === 'true';
        if (wasExplicitlyDisconnected) return;
        const mercariData = event.detail.marketplaces.mercari;
        const userName = mercariData.userName || mercariData.name || 'Mercari User';
        localStorage.setItem('profit_orbit_mercari_connected', 'true');
        localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({ userName, marketplace: 'mercari' }));
        const wasConnected = mercariConnected;
        setMercariConnected(true);
        if (!wasConnected && !mercariNotificationShown.current) {
          mercariNotificationShown.current = true;
          toast({ title: 'Mercari Connected!', description: `Connected as ${userName}` });
        }
      }
    };
    window.addEventListener('extensionReady', handleExtensionReady);

    const handleBridgeScriptLoaded = () => setTimeout(() => checkMercariStatusFromStorage(), 500);
    const handleBridgeLoaded       = () => setTimeout(() => checkMercariStatusFromStorage(), 500);
    const handleBridgeReady        = () => setTimeout(() => checkMercariStatusFromStorage(), 500);
    window.addEventListener('profitOrbitBridgeScriptLoaded', handleBridgeScriptLoaded);
    window.addEventListener('profitOrbitBridgeLoaded', handleBridgeLoaded);
    window.addEventListener('profitOrbitBridgeReady', handleBridgeReady);

    const handleExtensionInvalidated = () => {
      toast({ title: 'Extension Reloaded', description: 'Please refresh this page to reconnect.', variant: 'destructive', duration: 10000 });
    };
    window.addEventListener('profitOrbitExtensionInvalidated', handleExtensionInvalidated);

    // Mercari + Facebook connection ready messages
    const handleMercariConnectionReady = (event) => {
      if (event.source !== window) return;
      if (event.data?.type === 'MERCARI_CONNECTION_READY') {
        const wasExplicitlyDisconnected = localStorage.getItem('profit_orbit_mercari_disconnected') === 'true';
        if (wasExplicitlyDisconnected) return;
        const userName = event.data.payload?.userName || 'Mercari User';
        localStorage.setItem('profit_orbit_mercari_connected', 'true');
        localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({ userName, marketplace: 'mercari' }));
        if (mercariLoginPopup.current && !mercariLoginPopup.current.closed) {
          try { mercariLoginPopup.current.close(); mercariLoginPopup.current = null; } catch {}
        }
        const wasConnected = mercariConnected;
        setMercariConnected(true);
        if (!wasConnected && !mercariNotificationShown.current) {
          mercariNotificationShown.current = true;
          toast({ title: 'Mercari Connected!', description: `Connected as ${userName}` });
        }
      }
      if (event.data?.type === 'FACEBOOK_CONNECTION_READY') {
        if (facebookLoginPopup.current && !facebookLoginPopup.current.closed) {
          try { facebookLoginPopup.current.close(); facebookLoginPopup.current = null; } catch {}
        }
        const userName = event.data.payload?.userName || 'Facebook User';
        localStorage.setItem('profit_orbit_facebook_connected', 'true');
        localStorage.setItem('profit_orbit_facebook_user', JSON.stringify({ userName, marketplace: 'facebook' }));
        toast({ title: 'Facebook Connected!', description: `Connected as ${userName}` });
        checkFacebookStatus();
      }
    };
    window.addEventListener('message', handleMercariConnectionReady);

    // Initial Mercari status check
    const checkMercariStatus = () => {
      const status = localStorage.getItem('profit_orbit_mercari_connected');
      if (status === 'true') {
        setMercariConnected(true);
        mercariNotificationShown.current = true;
      }
    };
    checkMercariStatus();

    const checkBridgeAvailability = () => {
      const bridgeLoaded = window.__PROFIT_ORBIT_BRIDGE_LOADED === true;
      const apiAvailable = window.ProfitOrbitExtension && window.ProfitOrbitExtension.isAvailable();
      if (bridgeLoaded || apiAvailable) {
        setTimeout(() => checkMercariStatusFromStorage(), 1000);
        return true;
      }
      return false;
    };

    if (!checkBridgeAvailability()) {
      setTimeout(() => runExtensionDiagnostic(), 2000);
      const bridgeCheckInterval = setInterval(() => {
        if (checkBridgeAvailability()) clearInterval(bridgeCheckInterval);
      }, 500);
      setTimeout(() => { clearInterval(bridgeCheckInterval); }, 10000);
    }

    // Poll localStorage for Mercari state sync
    const pollInterval = setInterval(() => {
      const currentStatus = localStorage.getItem('profit_orbit_mercari_connected');
      const isConnected = currentStatus === 'true';
      const wasExplicitlyDisconnected = localStorage.getItem('profit_orbit_mercari_disconnected') === 'true';
      if (wasExplicitlyDisconnected && isConnected) {
        localStorage.removeItem('profit_orbit_mercari_connected');
        localStorage.removeItem('profit_orbit_mercari_user');
        return;
      }
      if (isConnected !== mercariConnected) setMercariConnected(isConnected);
    }, 500);

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

  // ── Facebook helpers ───────────────────────────────────────────────────────
  const checkFacebookStatus = async () => {
    try {
      const status = await getConnectionStatus();
      setFacebookStatus(status);
      if (status.connected) loadFacebookPages();
    } catch (error) {
      setFacebookStatus({ connected: false, message: 'Error checking connection', error: error.message });
    }
  };

  const loadFacebookPages = async () => {
    setLoadingPages(true);
    try {
      const pages = await getUserPages();
      setFacebookPages(pages);
    } catch (error) {
      toast({ title: 'Error Loading Pages', description: error.message || 'Failed to load your Facebook pages.', variant: 'destructive' });
    } finally {
      setLoadingPages(false);
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

  // ── Mercari helpers ────────────────────────────────────────────────────────
  const handleMercariLogin = () => {
    const width = 500, height = 650;
    const left = (window.screen.width / 2) - (width / 2);
    const top  = (window.screen.height / 2) - (height / 2);
    const popup = window.open('https://www.mercari.com/login/', 'MercariLogin', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no`);
    if (popup) mercariLoginPopup.current = popup;
    toast({ title: 'Mercari Login', description: 'Log into Mercari in the popup. It will close automatically when connected.', duration: 6000 });
  };

  const waitForExtensionReady = async (timeout = 3000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (window.__PROFIT_ORBIT_BRIDGE_LOADED === true || (window.ProfitOrbitExtension && window.ProfitOrbitExtension.isAvailable())) return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  };

  const waitForMercariConnection = async (timeout = 5000) => {
    localStorage.removeItem('profit_orbit_mercari_disconnected');
    localStorage.setItem('profit_orbit_request_status', 'true');
    if (window.ProfitOrbitExtension && window.ProfitOrbitExtension.isAvailable()) {
      window.ProfitOrbitExtension.getAllStatus((response) => {
        const st = response?.status?.mercari;
        if (st?.loggedIn) {
          localStorage.setItem('profit_orbit_mercari_connected', 'true');
          localStorage.setItem('profit_orbit_mercari_user', JSON.stringify({ userName: st.userName || 'Mercari User', marketplace: 'mercari' }));
        }
      });
    }
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (localStorage.getItem('profit_orbit_mercari_connected') === 'true') return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  };

  const showMercariInstructions = (isExplicitUserAction = false) => {
    if (!isExplicitUserAction && currentlyConnectingMarketplace.current !== 'mercari') return;
    toast({
      title: 'Mercari Not Detected',
      description: (
        <div className="text-white">
          <span>1) Install &amp; enable the Orben extension</span><br />
          <span>2) Open Mercari.com in a new tab and log in</span><br />
          <span>3) Click &quot;Connect Mercari&quot; again — Orben will auto-detect your login</span>
        </div>
      ),
      variant: 'destructive',
      duration: 10000,
    });
  };

  const handleMercariConnect = async () => {
    currentlyConnectingMarketplace.current = 'mercari';
    try {
      toast({ title: 'Connecting to Mercari...', description: 'Checking extension and Mercari login status...' });
      const extensionReady = await waitForExtensionReady(3000);
      if (!extensionReady) {
        toast({ title: 'Extension Not Ready', description: 'The extension may still be loading. Please wait and try again.', variant: 'destructive', duration: 10000 });
        runExtensionDiagnostic();
        return;
      }
      const connected = await waitForMercariConnection(5000);
      if (connected) {
        const wasExplicitlyDisconnected = localStorage.getItem('profit_orbit_mercari_disconnected') === 'true';
        if (wasExplicitlyDisconnected) {
          localStorage.removeItem('profit_orbit_mercari_connected');
          localStorage.removeItem('profit_orbit_mercari_user');
          toast({ title: 'Connection Blocked', description: 'You previously disconnected Mercari. Please log in first, then try again.', variant: 'destructive' });
          return;
        }
        const wasConnected = mercariConnected;
        setMercariConnected(true);
        localStorage.removeItem('profit_orbit_mercari_disconnected');
        try { window.postMessage({ type: 'REQUEST_CONNECT_PLATFORM', payload: { platform: 'mercari' } }, '*'); } catch {}
        if (!wasConnected && !mercariNotificationShown.current) {
          mercariNotificationShown.current = true;
          const userData = JSON.parse(localStorage.getItem('profit_orbit_mercari_user') || '{}');
          toast({ title: 'Mercari Connected!', description: userData.userName ? `Connected as ${userData.userName}` : 'Your Mercari account is connected.' });
        }
      } else {
        toast({ title: 'Not Connected', description: 'Please log into Mercari in a new tab first, then try again.', variant: 'destructive' });
        showMercariInstructions(true);
      }
    } catch (error) {
      toast({ title: 'Connection Error', description: error.message || 'Failed to check Mercari connection.', variant: 'destructive' });
    } finally {
      currentlyConnectingMarketplace.current = null;
    }
  };

  // ── Facebook helpers ───────────────────────────────────────────────────────
  const handleFacebookLogin = () => {
    const width = 500, height = 650;
    const left = (window.screen.width / 2) - (width / 2);
    const top  = (window.screen.height / 2) - (height / 2);
    const popup = window.open('https://www.facebook.com/marketplace/', `FacebookLogin_${Date.now()}`, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no`);
    if (popup) facebookLoginPopup.current = popup;
    toast({ title: 'Facebook Login', description: 'Log into Facebook in the popup. It will close automatically when connected.', duration: 6000 });
  };

  const waitForFacebookConnection = async (timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (localStorage.getItem('profit_orbit_facebook_connected') === 'true') return true; } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  };

  const showFacebookInstructions = () => {
    toast({
      title: 'Facebook Not Connected',
      description: (
        <div className="text-white">
          <span>1) Install &amp; enable the Orben extension</span><br />
          <span>2) Log into Facebook (via your Settings → Select &apos;Login&apos;)</span><br />
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
      toast({ title: 'Connecting to Facebook...', description: 'Checking extension and Facebook login status...' });
      const extensionReady = await waitForExtensionReady(3000);
      if (!extensionReady) {
        toast({ title: 'Extension Not Ready', description: 'The extension may still be loading. Please refresh and try again.', variant: 'destructive', duration: 10000 });
        runExtensionDiagnostic();
        return;
      }
      try { window.ProfitOrbitExtension?.queryStatus?.(); } catch {}
      const connected = await waitForFacebookConnection(5000);
      if (connected) {
        try { localStorage.removeItem('profit_orbit_facebook_disconnected'); } catch {}
        try { window.postMessage({ type: 'REQUEST_CONNECT_PLATFORM', payload: { platform: 'facebook' } }, '*'); } catch {}
        toast({ title: 'Facebook Connected!', description: 'Your Facebook session was detected via the extension.' });
      } else {
        showFacebookInstructions();
      }
    } catch (error) {
      showFacebookInstructions();
    } finally {
      currentlyConnectingMarketplace.current = null;
    }
  };

  const handleMarketplaceConnect = (marketplaceId) => {
    if (marketplaceId === 'facebook') {
      handleFacebookConnect();
    } else if (marketplaceId === 'ebay') {
      sessionStorage.setItem('ebay_oauth_return', '/Settings/marketplaces');
      window.location.href = '/api/ebay/auth';
    } else if (marketplaceId === 'mercari') {
      handleMercariConnect();
    } else {
      toast({ title: 'Coming Soon', description: `${MARKETPLACES.find((m) => m.id === marketplaceId)?.name} integration is coming soon.` });
    }
  };

  const handleMarketplaceDisconnect = async (marketplaceId) => {
    try {
      if (marketplaceId === 'facebook') {
        clearToken();
        setFacebookStatus(null);
        setFacebookPages([]);
        try {
          localStorage.removeItem('profit_orbit_facebook_connected');
          localStorage.removeItem('profit_orbit_facebook_user');
          localStorage.setItem('profit_orbit_facebook_disconnected', 'true');
        } catch {}
      } else if (marketplaceId === 'ebay') {
        localStorage.removeItem('ebay_user_token');
        localStorage.removeItem('ebay_username');
      } else if (marketplaceId === 'mercari') {
        setMercariConnected(false);
        localStorage.removeItem('profit_orbit_mercari_connected');
        localStorage.removeItem('profit_orbit_mercari_user');
        localStorage.setItem('profit_orbit_mercari_disconnected', 'true');
        mercariNotificationShown.current = false;
        localStorage.removeItem('mercari_session_detected');
        localStorage.removeItem('mercari_user_info');
      }
      await loadMarketplaceAccounts();
      if (marketplaceId === 'facebook') await checkFacebookStatus();
      toast({ title: 'Disconnected', description: `Your ${MARKETPLACES.find((m) => m.id === marketplaceId)?.name} account has been disconnected.` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to disconnect account.', variant: 'destructive' });
    }
  };

  const handleMarketplaceReconnect = (marketplaceId) => handleMarketplaceConnect(marketplaceId);

  const getMarketplaceAccountStatus = (marketplaceId) => {
    if (marketplaceId === 'mercari') {
      return {
        connected: mercariConnected,
        expired: false,
        accountName: mercariConnected
          ? JSON.parse(localStorage.getItem('profit_orbit_mercari_user') || '{}').userName
          : null,
      };
    }
    if (marketplaceId === 'facebook') {
      const connected = (() => { try { return localStorage.getItem('profit_orbit_facebook_connected') === 'true'; } catch { return false; } })();
      const accountName = (() => { try { return connected ? JSON.parse(localStorage.getItem('profit_orbit_facebook_user') || '{}')?.userName : null; } catch { return null; } })();
      return { connected, expired: false, accountName };
    }
    const account = marketplaceAccounts[marketplaceId];
    if (!account) return { connected: false, expired: false };
    return { connected: true, expired: account.expires_at && account.expires_at <= Date.now(), accountName: account.accountName || account.marketplace };
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SettingsSectionLayout section={section}>
      {loadingAccounts ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-gray-100" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MARKETPLACES.map((marketplace) => {
            if (!marketplace || !marketplace.icon) return null;
            const status = getMarketplaceAccountStatus(marketplace.id);
            const isComingSoon = marketplace.status === 'coming_soon';

            return (
              <Card key={marketplace.id} className={isComingSoon ? 'opacity-75' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white dark:bg-card flex items-center justify-center p-2 border border-gray-200 dark:border-gray-700">
                        <img src={marketplace.icon} alt={marketplace.name} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{marketplace.name}</CardTitle>
                        <CardDescription className="text-xs">{marketplace.description}</CardDescription>
                      </div>
                    </div>
                    {isComingSoon && <Badge variant="secondary" className="text-xs">Coming Soon</Badge>}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Connection status indicator */}
                  <div className="flex items-center gap-2">
                    {status.connected ? (
                      status.expired ? (
                        <><AlertCircle className="w-4 h-4 text-yellow-500" /><span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Token Expired</span></>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-xs font-medium text-green-600 dark:text-green-400">Connected</span></>
                      )
                    ) : (
                      <><XCircle className="w-4 h-4 text-gray-400" /><span className="text-xs font-medium text-gray-500">Not Connected</span></>
                    )}
                  </div>

                  {status.connected && status.accountName && (
                    <div className="text-xs text-gray-600 dark:text-muted-foreground">
                      Account: <span className="font-medium">{status.accountName}</span>
                    </div>
                  )}

                  {marketplace.id === 'facebook' && facebookStatus?.connected && facebookPages.length > 0 && (
                    <div className="text-xs text-gray-600 dark:text-muted-foreground">Pages: {facebookPages.length}</div>
                  )}

                  {/* Mercari-specific toggles */}
                  {marketplace.id === 'mercari' && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                        <div className="flex-1">
                          <Label htmlFor="mercari-sale-detection" className="text-xs font-medium cursor-pointer">Sale Detection</Label>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Auto-delist from other marketplaces when sold on Mercari</p>
                        </div>
                        <Switch id="mercari-sale-detection" checked={mercariSaleDetection} onCheckedChange={(v) => { setMercariSaleDetection(v); localStorage.setItem('mercari_sale_detection', v); }} disabled={!mercariConnected} />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                        <div className="flex-1">
                          <Label htmlFor="mercari-enhanced" className="text-xs font-medium cursor-pointer">Enhanced Connection</Label>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Improves connection stability, helps prevent listing failures</p>
                        </div>
                        <Switch id="mercari-enhanced" checked={mercariEnhancedConnection} onCheckedChange={(v) => { setMercariEnhancedConnection(v); localStorage.setItem('mercari_enhanced_connection', v); }} disabled={!mercariConnected} />
                      </div>
                      {mercariConnected && (
                        <p className="text-[10px] text-muted-foreground text-center px-2">
                          To switch accounts, log into the different account directly on mercari.com
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {status.connected ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleMarketplaceReconnect(marketplace.id)} disabled={isComingSoon} className="flex-1 text-xs">
                          <RefreshCw className="w-3 h-3 mr-1" />Reconnect
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleMarketplaceDisconnect(marketplace.id)} disabled={isComingSoon} className="flex-1 text-xs text-destructive hover:text-destructive">
                          <XCircle className="w-3 h-3 mr-1" />Disconnect
                        </Button>
                      </>
                    ) : marketplace.id === 'mercari' ? (
                      <>
                        <Button variant="outline" size="sm" onClick={handleMercariLogin} className="flex-1 text-xs">Login</Button>
                        <Button variant="default" size="sm" onClick={handleMercariConnect} className="flex-1 text-xs">
                          <RefreshCw className="w-3 h-3 mr-1" />Connect
                        </Button>
                      </>
                    ) : marketplace.id === 'facebook' ? (
                      <>
                        <Button variant="outline" size="sm" onClick={handleFacebookLogin} className="flex-1 text-xs">Login</Button>
                        <Button variant="default" size="sm" onClick={handleFacebookConnect} className="flex-1 text-xs">
                          <RefreshCw className="w-3 h-3 mr-1" />Connect
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => handleMarketplaceConnect(marketplace.id)} disabled={isComingSoon} className="flex-1 text-xs" size="sm">
                        <img src={marketplace.icon} alt={marketplace.name} className="w-3 h-3 mr-1 object-contain" />Connect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Facebook Pages */}
      {facebookStatus?.connected && facebookPages.length > 0 && (
        <div className="mt-2">
          <Label className="text-sm font-medium mb-2 block">Your Facebook Pages</Label>
          <div className="space-y-2">
            {facebookPages.map((page) => (
              <div key={page.id} className="p-2 bg-gray-50 dark:bg-card rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-foreground">{page.name}</p>
                <p className="text-xs text-gray-600 dark:text-muted-foreground">Page ID: {page.id}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 p-4 bg-muted/30 rounded-xl text-xs text-muted-foreground">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>• Connecting your marketplace accounts allows you to crosslist items across multiple platforms</p>
          <p>• Your OAuth tokens are stored securely and automatically refreshed when needed</p>
          <p>• You can disconnect at any time from this page</p>
          <p>• Mercari and Facebook require the Orben browser extension to be installed and active</p>
        </div>
      </div>
    </SettingsSectionLayout>
  );
}
