
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Plus, History, Package, BarChart3, GalleryHorizontal, Moon, Sun, CalendarDays, Settings, TrendingDown, Sparkles, Search, Shield, ChevronDown, User, LogOut, Home, ChevronRight, HelpCircle, Gift, FileText, GraduationCap, Newspaper, Truck, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getNewsBadge } from "@/api/newsApi";
// CrossSquareIcon import removed - Crosslist merged into Inventory
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { supabase } from "@/api/supabaseClient";
import { SelectionBannerProvider, useSelectionBannerState } from "@/hooks/useSelectionBanner";
import { X } from "lucide-react";

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
      { title: "Pro Tools", url: createPageUrl("Pro Tools"), icon: Sparkles },
      { title: "Add Sale", url: createPageUrl("AddSale"), icon: Plus },
      { title: "Shipping", url: "/shipping", icon: Truck },
    ]
  },
  {
    title: "Analytics",
    items: [
      { title: "Sales", url: createPageUrl("Sales"), icon: History },
      { title: "Profit Calendar", url: createPageUrl("ProfitCalendar"), icon: CalendarDays },
      { title: "Showcase", url: createPageUrl("Gallery"), icon: GalleryHorizontal },
      { title: "Reports", url: createPageUrl("Reports"), icon: BarChart3 },
    ]
  },
  {
    title: "Orben Intelligence",
    items: [
      { title: "Deal Feed", url: "/deals", icon: TrendingDown },
      { title: "Deal Curator", url: "/admin/deals", icon: Wand2, adminOnly: true },
      { title: "News", url: "/news", icon: Newspaper, badgeKey: "news" },
      { title: "Training Center", url: "/training", icon: GraduationCap },
    ]
  }
];

// ─── Page breadcrumb ─────────────────────────────────────────────────────────

const ROUTE_MAP = [
  // Exact matches first, then prefix matches
  { path: '/dashboard',                    label: 'Dashboard',           icon: LayoutDashboard },
  { path: '/Dashboard',                    label: 'Dashboard',           icon: LayoutDashboard },
  { path: '/Inventory',                    label: 'Inventory',           icon: Package },
  { path: '/AddInventoryItem',             label: 'Add Inventory',       icon: Package },
  { path: '/AddSale',                      label: 'Add Sale',            icon: Plus },
  { path: '/sales',                        label: 'Sales',               icon: History },
  { path: '/Sales',                        label: 'Sales',               icon: History },
  { path: '/ProfitCalendar',               label: 'Profit Calendar',     icon: CalendarDays },
  { path: '/Gallery',                      label: 'Showcase',            icon: GalleryHorizontal },
  { path: '/Reports',                      label: 'Reports',             icon: BarChart3 },
  { path: '/platformperformance',          label: 'Platform Performance',icon: BarChart3 },
  { path: '/CrosslistComposer',            label: 'Crosslist Composer',  icon: Sparkles },
  { path: '/Crosslisting',                 label: 'Crosslisting',        icon: Sparkles },
  { path: '/crosslisting',                 label: 'Crosslisting',        icon: Sparkles },
  { path: '/Crosslist',                    label: 'Crosslist',           icon: Sparkles },
  { path: '/Import',                       label: 'Sales',               icon: History },
  { path: '/Settings/account',             label: 'Account',             icon: Settings, parent: { label: 'Settings', path: '/Settings', icon: Settings } },
  { path: '/Settings/security',            label: 'Security',            icon: Settings, parent: { label: 'Settings', path: '/Settings', icon: Settings } },
  { path: '/Settings/notifications',       label: 'Notifications',       icon: Settings, parent: { label: 'Settings', path: '/Settings', icon: Settings } },
  { path: '/Settings/appearance',          label: 'Appearance',          icon: Settings, parent: { label: 'Settings', path: '/Settings', icon: Settings } },
  { path: '/Settings/marketplaces',        label: 'Marketplace Connections', icon: Settings, parent: { label: 'Settings', path: '/Settings', icon: Settings } },
  { path: '/Settings/reports',             label: 'Reports & Exports',   icon: Settings, parent: { label: 'Settings', path: '/Settings', icon: Settings } },
  { path: '/Settings',                     label: 'Settings',            icon: Settings },
  { path: '/Analytics',                    label: 'Analytics',           icon: BarChart3 },
  { path: '/deals',                        label: 'Deal Feed',           icon: TrendingDown },
  { path: '/admin/deals',                  label: 'Deal Curator',        icon: Wand2, parent: { label: 'Orben Intelligence', path: '/deals', icon: TrendingDown } },
  { path: '/pro-tools/send-offers',        label: 'Send Offers',         icon: Sparkles, parent: { label: 'Pro Tools', path: '/pro-tools', icon: Sparkles } },
  { path: '/pro-tools/auto-offers',        label: 'Auto Offers',         icon: Sparkles, parent: { label: 'Pro Tools', path: '/pro-tools', icon: Sparkles } },
  { path: '/pro-tools/marketplace-sharing',label: 'Marketplace Sharing', icon: Sparkles, parent: { label: 'Pro Tools', path: '/pro-tools', icon: Sparkles } },
  { path: '/Pro%20Tools',                  label: 'Pro Tools',           icon: Sparkles },
  { path: '/pro-tools',                    label: 'Pro Tools',           icon: Sparkles },
  { path: '/PrivacyPolicy',                label: 'Privacy Policy',      icon: Shield },
  { path: '/FAQ',                          label: 'FAQ',                 icon: HelpCircle },
  { path: '/Rewards',                      label: 'Rewards',             icon: Gift },
  { path: '/rewards',                      label: 'Rewards',             icon: Gift },
  { path: '/MigrateData',                  label: 'Migrate Data',        icon: FileText },
  { path: '/training/playbooks',           label: 'Playbooks',           icon: GraduationCap, parent: { label: 'Training Center', path: '/training', icon: GraduationCap } },
  { path: '/training',                     label: 'Training Center',     icon: GraduationCap },
  { path: '/news',                         label: 'News',                icon: Newspaper },
  { path: '/shipping',                     label: 'Shipping',            icon: Truck },
];

function PageBreadcrumb({ pathname }) {
  const entry = ROUTE_MAP.find(r => pathname === r.path || pathname.startsWith(r.path + '/'));
  if (!entry) return null;

  const segments = [];
  if (entry.parent) {
    segments.push(entry.parent);
  }
  segments.push(entry);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 px-4 md:px-6 lg:px-8 pt-4 pb-0 text-xs text-muted-foreground select-none"
    >
      {/* Home */}
      <Link
        to="/dashboard"
        className="flex items-center hover:text-foreground transition-colors rounded p-0.5"
        title="Dashboard"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {segments.map((seg, i) => {
        const Icon = seg.icon;
        const isLast = i === segments.length - 1;
        return (
          <React.Fragment key={seg.label}>
            <ChevronRight className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
            {isLast ? (
              <span className="flex items-center gap-1 font-medium text-foreground/80">
                {Icon && <Icon className="w-3 h-3" />}
                {seg.label}
              </span>
            ) : (
              <Link
                to={seg.path}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {Icon && <Icon className="w-3 h-3" />}
                {seg.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
function ThemeSelector({ theme, setTheme }) {
  const isDark = themes[theme]?.isDark ?? true;

  const toggle = () => {
    setTheme(isDark ? 'stalkfun-light' : 'stalkfun-dark');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
      className="relative text-muted-foreground hover:text-foreground h-9 w-9 overflow-hidden"
    >
      {/* Moon icon — visible in dark mode, slides out in light */}
      <Moon
        className={`absolute w-5 h-5 transition-all duration-300 ease-in-out ${
          isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'
        }`}
      />
      {/* Sun icon — visible in light mode, slides out in dark */}
      <Sun
        className={`absolute w-5 h-5 transition-all duration-300 ease-in-out ${
          isDark ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'
        }`}
      />
    </Button>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const [theme, setTheme] = useState('stalkfun-dark');
  const [themeStyles, setThemeStyles] = useState('');
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('orben_user_profile');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [isScrolled, setIsScrolled] = useState(false);

  // Admin check for sidebar filtering
  const adminIds = (import.meta.env.VITE_ADMIN_USER_IDS || '82bdb1aa-b2d2-4001-80ef-1196e5563cb9').split(',').map(s => s.trim());
  const isAdmin = currentUser?.id && adminIds.includes(currentUser.id);

  // News badge — poll every 10 min; disable when on /news (already marked seen)
  const { data: newsBadgeData } = useQuery({
    queryKey: ['newsBadge'],
    queryFn: getNewsBadge,
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    enabled: location.pathname !== '/news',
  });
  const hasNewNews = newsBadgeData?.hasNew ?? false;

  const badges = { news: hasNewNews };

  const handleProductSearchClick = () => {
    setProductSearchOpen(true);
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

  // Scroll detection for enhanced search bar
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 80);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Derive profile from a Supabase user object and cache it
  const deriveProfile = (user) => {
    if (!user) return;
    const meta = user.user_metadata || {};
    const profile = {
      display_name: meta.display_name || meta.full_name || meta.name || user.email?.split('@')[0],
      avatar_seed: meta.avatar_seed || 'Felix',
      avatar_style: meta.avatar_style || 'avataaars',
      avatar_type: meta.avatar_type || 'dicebear',
      avatar_url: meta.avatar_url || null,
    };
    setUserProfile(profile);
    try { localStorage.setItem('orben_user_profile', JSON.stringify(profile)); } catch {}
  };

  // Load user from Supabase auth + derive profile in one pass
  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        deriveProfile(session.user);
      }
    };
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
      if (session?.user) deriveProfile(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Refresh profile after settings dialog closes
  const handleProfileSettingsClose = async (open) => {
    setProfileSettingsOpen(open);
    if (!open && currentUser) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        deriveProfile(user);
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
    <SelectionBannerProvider>
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
                    {category.items.filter(item => !item.adminOnly || isAdmin).map((item) => {
                      const isActive = location.pathname === item.url;
                      const IconComponent = item.icon;
                      const showBadge = item.badgeKey && badges[item.badgeKey];
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
                            <span className="cursor-pointer text-ellipsis truncate flex-1">{item.title}</span>
                            {showBadge && (
                              <span className="relative flex h-2 w-2 flex-shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </SidebarContent>

          {/* Minimal sidebar footer */}
          <SidebarFooter className="border-t border-sidebar-border p-4">
            <div className="flex items-center justify-between">
              <Link
                to={createPageUrl("PrivacyPolicy")}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Shield className="w-3 h-3" />
                <span>Privacy Policy</span>
              </Link>
              <button
                onClick={handleProductSearchClick}
                className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Product Search (⌘K)"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-h-screen">

          {/* ── Desktop Top Header ── */}
          <header className="hidden md:flex items-center justify-end gap-2 bg-background border-b border-border/40 backdrop-blur-sm shadow-md sticky top-0 z-10 px-6 py-3">

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
            <PageBreadcrumb pathname={location.pathname} />
            {children}
          </div>

          {/* Floating search bar — appears on scroll */}
          <FloatingBar isScrolled={isScrolled} onSearchClick={handleProductSearchClick} pathname={location.pathname} />

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
    </SelectionBannerProvider>
  );
}

function FloatingBar({ isScrolled, onSearchClick, pathname }) {
  const selectionState = useSelectionBannerState();
  const hasSelection = selectionState && selectionState.selectedCount > 0;

  // On Inventory/Sales pages, the floating bar becomes a local search input
  const isInventory = pathname === '/Inventory';
  const isSales = pathname === '/SalesHistory';
  const isLocalSearch = isInventory || isSales;
  const localPlaceholder = isInventory ? 'Search Inventory...' : isSales ? 'Search Sales...' : '';

  const [localQuery, setLocalQuery] = React.useState('');

  // Reset local query when navigating away
  React.useEffect(() => {
    setLocalQuery('');
    window.dispatchEvent(new CustomEvent('floating-search', { detail: '' }));
  }, [pathname]);

  // Dispatch search events as user types
  const handleLocalSearch = (value) => {
    setLocalQuery(value);
    window.dispatchEvent(new CustomEvent('floating-search', { detail: value }));
  };

  return (
    <div
      className={`fixed top-0 right-0 z-50 hidden md:flex flex-col transition-all duration-300 ease-out bg-background/95 backdrop-blur-md border-b border-border/40 shadow-md ${
        isScrolled
          ? "translate-y-0 opacity-100"
          : "-translate-y-full opacity-0 pointer-events-none"
      }`}
      style={{ left: 'var(--sidebar-width, 16rem)' }}
    >
      <div className="flex items-center gap-3 px-6 py-2.5">
        {isLocalSearch ? (
          /* Local search input for Inventory/Sales */
          <div className={`flex items-center gap-2.5 px-4 py-1 rounded-xl bg-muted/60 text-sm border border-border/50 transition-all ${
            hasSelection ? "w-auto flex-shrink-0" : "flex-1"
          }`}>
            <Search className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={localQuery}
              onChange={(e) => handleLocalSearch(e.target.value)}
              placeholder={localPlaceholder}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground py-1.5"
              autoComplete="off"
            />
            {localQuery && (
              <button
                onClick={() => handleLocalSearch('')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          /* Product search button for all other pages */
          <button
            onClick={onSearchClick}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground text-sm border border-border/50 transition-all ${
              hasSelection ? "w-auto flex-shrink-0" : "flex-1"
            }`}
            title="Search products (⌘K)"
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            {!hasSelection && <span className="flex-1 text-left">Search products...</span>}
            <kbd className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border/50">⌘K</kbd>
          </button>
        )}

        {/* Selection info — appears on the same line */}
        {hasSelection && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                {selectionState.selectedCount} item{selectionState.selectedCount === 1 ? "" : "s"} selected
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
              {selectionState.children}
              <Button
                variant="ghost"
                size="sm"
                onClick={selectionState.onClear}
                className="text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
