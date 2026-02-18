
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Plus, History, Package, BarChart3, GalleryHorizontal, Moon, Sun, CalendarDays, Settings, TrendingDown, Sparkles, Activity, Search, Shield, ChevronDown, User, LogOut } from "lucide-react";
import CrossSquareIcon from "@/components/icons/CrossSquareIcon";
import { EnhancedProductSearchDialog } from "@/components/EnhancedProductSearchDialog";
import { ProfileSettings, UserAvatar } from "@/components/ProfileSettings";
import NotificationCenter from "@/components/NotificationCenter";
import BannerNotifications from "@/components/BannerNotifications";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { supabase } from "@/api/supabaseClient";

// Navigation categories
const navigationCategories = [
  {
    title: "Core",
    items: [
      { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
      { title: "Inventory", url: createPageUrl("Inventory"), icon: Package },
    ]
  },
  {
    title: "Tools",
    items: [
      { title: "Crosslist", url: createPageUrl("Crosslist"), icon: CrossSquareIcon },
      { title: "Pro Tools", url: createPageUrl("Pro Tools"), icon: Sparkles },
      { title: "Import", url: createPageUrl("Import"), icon: Activity },
      { title: "Add Sale", url: createPageUrl("AddSale"), icon: Plus },
    ]
  },
  {
    title: "Orben Intelligence",
    items: [
      { title: "Deal Feed", url: "/deals", icon: TrendingDown },
      { title: "Product Search", url: "/product-search", icon: Search },
    ]
  },
  {
    title: "Analytics",
    items: [
      { title: "Sales History", url: createPageUrl("SalesHistory"), icon: History },
      { title: "Profit Calendar", url: createPageUrl("ProfitCalendar"), icon: CalendarDays },
      { title: "Showcase", url: createPageUrl("Gallery"), icon: GalleryHorizontal },
      { title: "Reports", url: createPageUrl("Reports"), icon: BarChart3 },
    ]
  }
];

const themes = {
  'stalkfun-dark': {
    name: "Dark",
    isDark: true,
    css: `
      --background: 0 0% 4%;
      --foreground: 0 0% 98.5%;
      --card: 0 0% 12%;
      --card-foreground: 0 0% 98.5%;
      --popover: 0 0% 12%;
      --popover-foreground: 0 0% 98.5%;
      --primary: 160 84% 39%;
      --primary-foreground: 0 0% 100%;
      --secondary: 240 4% 16%;
      --secondary-foreground: 0 0% 98%;
      --muted: 240 4% 16%;
      --muted-foreground: 0 0% 70.8%;
      --accent: 160 84% 39%;
      --accent-foreground: 0 0% 100%;
      --destructive: 0 62.8% 30.6%;
      --destructive-foreground: 0 0% 98%;
      --border: 0 0% 16%;
      --input: 0 0% 16%;
      --ring: 160 84% 39%;
      --sidebar-background: 0 0% 14.5%;
      --sidebar-foreground: 0 0% 98.5%;
      --sidebar-primary: 160 84% 39%;
      --sidebar-primary-foreground: 0 0% 100%;
      --sidebar-accent: 0 0% 19%;
      --sidebar-accent-foreground: 0 0% 98.5%;
      --sidebar-border: 0 0% 16%;
      --po-positive: 160 84% 39%;
      --po-info: 212 96% 55%;
      --po-warning: 38 92% 50%;
    `
  },
  'stalkfun-light': {
    name: "Light",
    isDark: false,
    css: `
      --background: 0 0% 100%;
      --foreground: 240 10% 3.9%;
      --card: 0 0% 100%;
      --card-foreground: 240 10% 3.9%;
      --popover: 0 0% 100%;
      --popover-foreground: 240 10% 3.9%;
      --primary: 160 84% 39%;
      --primary-foreground: 0 0% 98%;
      --secondary: 240 4.8% 95.9%;
      --secondary-foreground: 240 5.9% 10%;
      --muted: 240 4.8% 95.9%;
      --muted-foreground: 240 3.8% 46.1%;
      --accent: 240 4.8% 95.9%;
      --accent-foreground: 240 5.9% 10%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 0 0% 98%;
      --border: 240 5.9% 90%;
      --input: 240 5.9% 90%;
      --ring: 160 84% 39%;
      --sidebar-background: 0 0% 98%;
      --sidebar-foreground: 240 10% 3.9%;
      --sidebar-primary: 160 84% 39%;
      --sidebar-primary-foreground: 0 0% 98%;
      --sidebar-accent: 240 4.8% 95.9%;
      --sidebar-accent-foreground: 240 5.9% 10%;
      --sidebar-border: 240 5.9% 90%;
      --po-positive: 160 84% 39%;
      --po-info: 212 96% 55%;
      --po-warning: 38 92% 50%;
    `
  }
};

// Top bar user profile dropdown (desktop + mobile)
function TopBarUserProfile({ user, profile, onOpenProfileSettings }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const displayName = profile?.display_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <UserAvatar profile={profile} size="sm" />
          <span className="text-sm font-medium hidden lg:block max-w-[120px] truncate text-foreground">
            {displayName}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden lg:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenProfileSettings}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/Settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Theme selector dropdown (shared between desktop/mobile)
function ThemeSelector({ theme, setTheme, align = "end" }) {
  const isDark = themes[theme]?.isDark ?? true;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-9 w-9" title="Toggle theme">
          {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44" align={align}>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {Object.entries(themes).map(([id, { name }]) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const [theme, setTheme] = useState('stalkfun-dark');
  const [themeStyles, setThemeStyles] = useState('');
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const handleProductSearchClick = () => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      window.location.href = '/product-search';
    } else {
      setProductSearchOpen(true);
    }
  };

  // Keyboard shortcut: Cmd/Ctrl+K opens search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setProductSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Load user from Supabase auth
  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      }
    };
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load profile data from Supabase user metadata
  useEffect(() => {
    if (currentUser) {
      const meta = currentUser.user_metadata || {};
      setUserProfile({
        display_name: meta.display_name || meta.full_name || meta.name || currentUser.email?.split('@')[0],
        avatar_seed: meta.avatar_seed || 'Felix',
        avatar_style: meta.avatar_style || 'avataaars',
        avatar_type: meta.avatar_type || 'dicebear',
        avatar_url: meta.avatar_url || null,
      });
    }
  }, [currentUser]);

  // Refresh profile after settings dialog closes
  const handleProfileSettingsClose = async (open) => {
    setProfileSettingsOpen(open);
    if (!open && currentUser) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
      }
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'stalkfun-dark';
    const themeMap = {
      'default-light': 'stalkfun-light',
      'default-dark': 'stalkfun-dark',
      'money-green-dark': 'stalkfun-dark',
      'retro-console-light': 'stalkfun-light'
    };
    const themeToUse = themeMap[savedTheme] || savedTheme;
    if (themeToUse !== savedTheme) {
      localStorage.setItem('theme', themeToUse);
    }
    setTheme(themeToUse);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const themeConfig = themes[theme];
    if (!themeConfig) return;
    root.classList.remove('light', 'dark');
    root.classList.add(themeConfig.isDark ? 'dark' : 'light');
    root.setAttribute('data-theme', theme);
    const cssString = themeConfig.isDark ? `.dark { ${themeConfig.css} }` : `:root { ${themeConfig.css} }`;
    setThemeStyles(cssString);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <SidebarProvider>
      <BannerNotifications />
      <style>{themeStyles}</style>
      <div className="min-h-screen flex w-full bg-background">

        {/* Desktop Sidebar */}
        <Sidebar className="border-r border-sidebar-border bg-sidebar-background hidden md:flex">
          <SidebarContent className="flex flex-col flex-grow px-2 pt-0 pb-4">
            {/* Logo */}
            <div className="px-3 mb-6 flex justify-center pt-4">
              <h1 className="text-2xl font-bold text-primary">Orben</h1>
            </div>

            {/* Navigation */}
            <div className="flex-grow overflow-auto pb-4 -mt-3 po-scrollbar-hide">
              {navigationCategories.map((category) => (
                <div key={category.title} className="mb-4">
                  <h4 className="text-muted-foreground text-xs font-semibold px-2 mb-2 uppercase tracking-wider">
                    {category.title}
                  </h4>
                  <ul className="flex flex-col list-none gap-1 text-sm">
                    {category.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      const IconComponent = item.icon;
                      return (
                        <li key={item.title} className="list-item">
                          <Link
                            to={item.url}
                            className={`
                              flex items-center justify-start gap-2 p-2 rounded-lg transition-colors
                              ${isActive
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                              }
                            `}
                          >
                            <IconComponent className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                            <span className="cursor-pointer text-ellipsis truncate">{item.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </SidebarContent>

          {/* Minimal sidebar footer - just privacy policy */}
          <SidebarFooter className="border-t border-sidebar-border p-4">
            <Link
              to={createPageUrl("PrivacyPolicy")}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Shield className="w-3 h-3" />
              <span>Privacy Policy</span>
            </Link>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-h-screen">

          {/* ── Desktop Top Header ── */}
          <header className="hidden md:flex items-center justify-end gap-2 bg-gradient-to-r from-background via-background/95 to-background border-b border-border/40 backdrop-blur-sm shadow-md sticky top-0 z-10 px-6 py-3">

            {/* Search bar */}
            <button
              onClick={handleProductSearchClick}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground text-sm border border-border/50 w-52 transition-colors mr-2"
              title="Search products (⌘K)"
            >
              <Search className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">Search...</span>
            </button>

            {/* Notifications */}
            <NotificationCenter />

            {/* Settings */}
            <Link to={createPageUrl("Settings")} className="inline-flex">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-9 w-9" title="Settings">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>

            {/* Theme */}
            <ThemeSelector theme={theme} setTheme={setTheme} align="end" />

            {/* Divider */}
            <div className="w-px h-6 bg-border/60 mx-1" />

            {/* User profile dropdown */}
            <TopBarUserProfile
              user={currentUser}
              profile={userProfile}
              onOpenProfileSettings={() => setProfileSettingsOpen(true)}
            />
          </header>

          {/* ── Mobile Header ── */}
          <header className="bg-card border-b border-border px-4 py-3 md:hidden sticky top-0 z-40">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-primary">Orben</h1>
              <div className="flex items-center gap-1">
                {/* Mobile search */}
                <Button
                  onClick={handleProductSearchClick}
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  title="Search Products"
                >
                  <Search className="w-5 h-5" />
                </Button>

                {/* Mobile notifications */}
                <NotificationCenter />

                {/* Mobile settings */}
                <Link to={createPageUrl("Settings")} className="inline-flex">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Settings className="w-5 h-5" />
                  </Button>
                </Link>

                {/* Mobile theme */}
                <ThemeSelector theme={theme} setTheme={setTheme} align="end" />

                {/* Mobile user profile */}
                <TopBarUserProfile
                  user={currentUser}
                  profile={userProfile}
                  onOpenProfileSettings={() => setProfileSettingsOpen(true)}
                />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto pb-24 md:pb-0">
            {children}
          </div>

          {/* Product Search Dialog */}
          <EnhancedProductSearchDialog
            open={productSearchOpen}
            onOpenChange={setProductSearchOpen}
          />

          {/* Profile Settings Dialog */}
          <ProfileSettings
            open={profileSettingsOpen}
            onOpenChange={handleProfileSettingsClose}
            user={currentUser}
          />

          <MobileBottomNav />
        </main>
      </div>
    </SidebarProvider>
  );
}
