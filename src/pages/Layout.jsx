

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Plus, History, Package, BarChart3, GalleryHorizontal, Palette, Check, CalendarDays, Settings, FileText, TrendingUp, Shield } from "lucide-react";
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

// Navigation categories matching the example design
const navigationCategories = [
  {
    title: "Core",
    icon: BarChart3,
    items: [
      { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
      { title: "Inventory", url: createPageUrl("Inventory"), icon: Package },
      { title: "Sales History", url: createPageUrl("SalesHistory"), icon: History },
    ]
  },
  {
    title: "Tools",
    icon: Settings,
    items: [
      { title: "Crosslist", url: createPageUrl("Crosslist"), icon: CrossSquareIcon },
      { title: "Add Sale", url: createPageUrl("AddSale"), icon: Plus },
      { title: "Market Intelligence", url: createPageUrl("MarketIntelligence"), icon: TrendingUp },
    ]
  },
  {
    title: "Analytics",
    icon: BarChart3,
    items: [
      { title: "Profit Calendar", url: createPageUrl("ProfitCalendar"), icon: CalendarDays },
      { title: "Showcase", url: createPageUrl("Gallery"), icon: GalleryHorizontal },
      { title: "Reports", url: createPageUrl("Reports"), icon: BarChart3 },
    ]
  }
];

const themes = {
  'default-light': {
    name: "Default Light",
    isDark: false,
    css: `
      --background: 0 0% 100%;
      --foreground: 240 10% 3.9%;
      --card: 0 0% 100%;
      --card-foreground: 240 10% 3.9%;
      --popover: 0 0% 100%;
      --popover-foreground: 240 10% 3.9%;
      --primary: 262.1 83.3% 57.8%;
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
      --ring: 240 10% 3.9%;
      --po-positive: 142 71% 45%;
      --po-info: 212 96% 55%;
      --po-warning: 38 92% 50%;
    `
  },
'default-dark': {
  name: "Default Dark",
  isDark: true,
  css: `
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 213 26% 22%;
    --input: 213 26% 22%;
    --ring: 240 4.9% 83.9%;
    --po-positive: 142 71% 45%;
    --po-info: 212 96% 55%;
    --po-warning: 38 92% 50%;
  `
},
  'money-green-dark': {
    name: "Money Green",
    isDark: true,
    css: `
      --background: 217 39% 11%;
      --foreground: 210 40% 98%;
      --card: 217 33% 17%;
      --card-foreground: 210 40% 98%;
      --popover: 217 33% 17%;
      --popover-foreground: 210 40% 98%;
      --primary: 142 71% 45%;
      --primary-foreground: 0 0% 100%;
      --secondary: 215 25% 27%;
      --secondary-foreground: 210 40% 98%;
      --muted: 215 25% 27%;
      --muted-foreground: 217 20% 70%;
      --accent: 142 71% 45%;
      --accent-foreground: 0 0% 100%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 0 0% 98%;
      --border: 213 26% 22%;
      --input: 213 26% 22%;
      --ring: 142 71% 50%;
      --po-positive: 142 71% 45%;
      --po-info: 212 96% 55%;
      --po-warning: 38 92% 50%;
    `
  }
};

export default function Layout({ children }) {
  const location = useLocation();
  const [theme, setTheme] = useState('default-light');
  const [themeStyles, setThemeStyles] = useState('');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'default-light';
    // Migrate retro-console-light to default-light if it exists
    const themeToUse = savedTheme === 'retro-console-light' ? 'default-light' : savedTheme;
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
      <div className="min-h-screen flex w-full bg-[#FAFAF9] dark:bg-gray-900/95">
        <Sidebar className="border-r border-border/60 bg-background w-[252px]">
          <SidebarHeader className="border-b border-border/60 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-foreground text-base leading-tight">Profit Orbit</h2>
                <p className="text-xs text-muted-foreground">Reselling Analytics</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="px-2 pt-3 pb-4">
            {navigationCategories.map((category, categoryIndex) => (
              <React.Fragment key={category.title}>
                {/* Category */}
                <div className={categoryIndex === navigationCategories.length - 1 ? "" : "mb-2"}>
                  {/* Category Header */}
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {category.title}
                    </span>
                  </div>

                  {/* Category Items */}
                  <ul className="flex flex-col gap-1 p-0 m-0 list-none">
                    {category.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      const IconComponent = item.icon;
                      return (
                        <li key={item.title} className="relative">
                          <Link
                            to={item.url}
                            className={`
                              flex items-center gap-3 h-10 px-3 mx-2 rounded-lg
                              transition-colors duration-150
                              ${isActive
                                ? 'bg-emerald-500/15 text-foreground'
                                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                              }
                            `}
                          >
                            {/* Icon */}
                            <IconComponent
                              className={`flex-shrink-0 ${item.title === "Crosslist" ? "w-4 h-4" : "w-4.5 h-4.5"}`}
                              strokeWidth={2}
                            />

                            {/* Text */}
                            <span className={`
                              text-sm font-medium flex-1
                            `}>
                              {item.title}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Category Divider (except for last category) */}
                {categoryIndex < navigationCategories.length - 1 && (
                  <div className="h-px bg-border/60 mx-4 my-1.5" />
                )}
              </React.Fragment>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
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
                <DropdownMenuContent className="w-56 mb-2">
                  <DropdownMenuLabel>Appearance</DropdownMenuLabel>
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
            <div className="pt-2 border-t border-border/60">
              <Link
                to={createPageUrl("PrivacyPolicy")}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                <Shield className="w-3 h-3" />
                <span>Privacy Policy</span>
              </Link>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Orben</h1>
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

