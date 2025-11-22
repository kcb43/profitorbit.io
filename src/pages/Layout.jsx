

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Plus, History, Package, BarChart3, GalleryHorizontal, Palette, Check, CalendarDays } from "lucide-react";
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

const navigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "Profit Calendar", url: createPageUrl("ProfitCalendar"), icon: CalendarDays },
  { title: "Sales History", url: createPageUrl("SalesHistory"), icon: History },
  { title: "Crosslist", url: createPageUrl("Crosslist"), icon: Palette },
  { title: "Inventory", url: createPageUrl("Inventory"), icon: Package },
  { title: "Reports", url: createPageUrl("Reports"), icon: BarChart3 },
  { title: "Showcase", url: createPageUrl("Gallery"), icon: GalleryHorizontal }, // Changed 'Gallery' to 'Showcase'
  { title: "Add Sale", url: createPageUrl("AddSale"), icon: Plus },
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
    `
  },
  'retro-console-light': {
    name: "Retro Console",
    isDark: false,
    css: `
      --background: 83 22% 91%;
      --foreground: 83 12% 21%;
      --card: 83 22% 88%;
      --card-foreground: 83 12% 21%;
      --popover: 83 22% 91%;
      --popover-foreground: 83 12% 21%;
      --primary: 158 52% 20%;
      --primary-foreground: 83 22% 91%;
      --secondary: 83 15% 85%;
      --secondary-foreground: 83 12% 21%;
      --muted: 83 15% 85%;
      --muted-foreground: 83 10% 45%;
      --accent: 158 52% 20%;
      --accent-foreground: 83 22% 91%;
      --destructive: 350 71% 40%;
      --destructive-foreground: 83 22% 91%;
      --border: 83 15% 80%;
      --input: 83 15% 80%;
      --ring: 158 52% 20%;
    `
  }
};

export default function Layout({ children }) {
  const location = useLocation();
  const [theme, setTheme] = useState('default-light');
  const [themeStyles, setThemeStyles] = useState('');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'default-light';
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const themeConfig = themes[theme];
    if (!themeConfig) return;

    // Remove old theme class, add new one
    root.classList.remove('light', 'dark');
    root.classList.add(themeConfig.isDark ? 'dark' : 'light');
    
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
        <Sidebar className="border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <SidebarHeader className="border-b border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 dark:text-gray-100 text-lg">ProfitPulse</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reselling Analytics</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          className={`rounded-lg mb-1 transition-all duration-200 ${
                            isActive 
                              ? 'bg-gray-100/50 dark:bg-green-500/10 text-gray-900 dark:text-green-400 border-l-2 border-green-500 dark:border-green-400' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 dark:hover:text-green-400'
                          }`}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} />
                            <span className="font-medium text-gray-800 dark:text-gray-200">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-100 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-gray-200 dark:from-gray-700 to-gray-300 dark:to-gray-800 rounded-full flex items-center justify-center">
                  <span className="text-gray-700 dark:text-gray-200 font-semibold text-sm">U</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">Reseller</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Track your profits</p>
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400">
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
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ProfitPulse</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

