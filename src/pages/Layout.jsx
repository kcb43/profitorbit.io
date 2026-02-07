

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Plus, History, Package, BarChart3, GalleryHorizontal, Palette, Check, CalendarDays, Settings, FileText, TrendingUp, Shield, Sparkles, Activity, Zap } from "lucide-react";
import CrossSquareIcon from "@/components/icons/CrossSquareIcon";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/components/UserProfile";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

// Navigation categories matching stalk.fun design
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
      { title: "Pulse", url: createPageUrl("Pulse"), icon: TrendingUp },
      { title: "Add Sale", url: createPageUrl("PlatformPerformance"), icon: Plus },
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

export default function Layout({ children }) {
  const location = useLocation();
  const [theme, setTheme] = useState('stalkfun-dark');
  const [themeStyles, setThemeStyles] = useState('');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'stalkfun-dark';
    // Migrate old themes to new stalkfun themes
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

    // Remove old theme class, add new one
    root.classList.remove('light', 'dark');
    root.classList.add(themeConfig.isDark ? 'dark' : 'light');
    
    // Add data-theme attribute for specific theme targeting
    root.setAttribute('data-theme', theme);
    
    // Set CSS variables
    const cssString = themeConfig.isDark ? `.dark { ${themeConfig.css} }` : `:root { ${themeConfig.css} }`;
    setThemeStyles(cssString);

    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <SidebarProvider>
      <style>{themeStyles}</style>
      <div className="min-h-screen flex w-full bg-background">
        {/* Desktop Sidebar - StalkFun Inspired */}
        <Sidebar className="border-r border-sidebar-border bg-sidebar-background hidden md:flex">
          <SidebarContent className="flex flex-col flex-grow px-2 py-4">
            {/* Logo/Branding */}
            <div className="px-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-sidebar-foreground text-lg leading-tight">Orben</h2>
                  <p className="text-xs text-muted-foreground">Reselling Platform</p>
                </div>
              </div>
            </div>

            {/* Navigation Sections */}
            <div className="flex-grow overflow-auto pb-24">
              {navigationCategories.map((category, categoryIndex) => (
                <div key={category.title} className="mb-4">
                  {/* Section Header */}
                  <h4 className="text-muted-foreground text-xs font-semibold px-2 mb-2 uppercase tracking-wider">
                    {category.title}
                  </h4>

                  {/* Section Items */}
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

          {/* Sidebar Footer */}
          <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <UserProfile />
              
              <Link to={createPageUrl("Settings")} className="inline-flex">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-9 w-9">
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-9 w-9">
                    <Palette className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 mb-2">
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
            </div>

            <div className="pt-2 border-t border-sidebar-border">
              <Link
                to={createPageUrl("PrivacyPolicy")}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Shield className="w-3 h-3" />
                <span>Privacy Policy</span>
              </Link>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-h-screen">
          {/* Mobile Header */}
          <header className="bg-card border-b border-border px-6 py-4 md:hidden sticky top-0 z-40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-foreground">Orben</h1>
              </div>
              <div className="flex items-center gap-2">
                <UserProfile />
                <Link to={createPageUrl("Settings")} className="inline-flex">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Settings className="w-5 h-5" />
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                      <Palette className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 mb-2" align="end">
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
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto pb-24 md:pb-0">
            {children}
          </div>

          <MobileBottomNav />
        </main>
      </div>
    </SidebarProvider>
  );
}

