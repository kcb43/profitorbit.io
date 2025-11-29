import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Palette, Sparkles, Facebook, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  getConnectionStatus, 
  clearToken, 
  storeToken,
  getUserPages 
} from "@/api/facebookClient";
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

export default function Settings() {
  const [currentTheme, setCurrentTheme] = useState('default-light');
  const [selectedCharacter, setSelectedCharacter] = useState('naruto');
  const [facebookStatus, setFacebookStatus] = useState(null);
  const [facebookPages, setFacebookPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Load saved preferences
    const savedTheme = localStorage.getItem('theme') || 'default-light';
    const savedCharacter = localStorage.getItem('selectedCharacter') || 'default';
    
    setCurrentTheme(savedTheme);
    setSelectedCharacter(savedCharacter);

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

  const handleConnectFacebook = () => {
    window.location.href = '/api/facebook/auth';
  };

  const handleDisconnectFacebook = () => {
    clearToken();
    setFacebookStatus(null);
    setFacebookPages([]);
    toast({
      title: "Facebook Disconnected",
      description: "Your Facebook account has been disconnected.",
    });
    checkFacebookStatus();
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
          </CardContent>
        </Card>

        {/* Facebook Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Facebook className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Facebook Marketplace</CardTitle>
                <CardDescription>Connect your Facebook account to list items on Marketplace</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {facebookStatus === null ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : facebookStatus.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Connected to Facebook
                    </p>
                    {facebookStatus.daysUntilExpiry !== null && (
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Token expires in {facebookStatus.daysUntilExpiry} days
                      </p>
                    )}
                  </div>
                </div>

                {loadingPages ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-gray-100"></div>
                  </div>
                ) : facebookPages.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Your Facebook Pages</Label>
                    <div className="space-y-2">
                      {facebookPages.map((page) => (
                        <div
                          key={page.id}
                          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Listings will be posted on behalf of these pages. Make sure you have the necessary permissions.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-sm text-yellow-900 dark:text-yellow-100">
                      No pages found. You need to manage at least one Facebook Page to create Marketplace listings.
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleDisconnectFacebook}
                  className="w-full"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Disconnect Facebook
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <XCircle className="w-5 h-5 text-gray-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Not Connected
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {facebookStatus.message || 'Connect your Facebook account to enable Marketplace listings'}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleConnectFacebook}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Facebook className="w-4 h-4 mr-2" />
                  Connect Facebook Account
                </Button>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-900 dark:text-blue-100 font-medium mb-1">
                    Required Permissions:
                  </p>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 list-disc list-inside space-y-1">
                    <li>pages_manage_metadata - Manage page metadata</li>
                    <li>pages_manage_posts - Create and manage posts</li>
                    <li>business_management - Manage business assets</li>
                  </ul>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                    Note: Marketplace API requires app review and business verification.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

