import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Database, 
  Bell, 
  Download,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function MarketIntelligence() {
  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden w-full max-w-full">
      <div className="max-w-7xl mx-auto min-w-0 w-full">
        <div className="mb-8 min-w-0">
          <h1 className="text-3xl font-bold text-foreground break-words">Market Intelligence</h1>
          <p className="text-muted-foreground mt-1 break-words">Discover new inventory opportunities using eBay Feed APIs</p>
        </div>

        <Card className="border-2 border-dashed border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 min-w-0">
          <CardHeader className="min-w-0">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-2 min-w-0">
              <div className="flex-1 min-w-0">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg break-words">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <span className="break-words">Market Intelligence</span>
                </CardTitle>
                <CardDescription className="mt-1 break-words text-sm">
                  Discover new inventory opportunities using eBay Feed APIs
                </CardDescription>
              </div>
              <Badge variant="secondary" className="ml-0 sm:ml-2 flex-shrink-0">
                Coming Soon
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 min-w-0">
            {/* Feed Beta API */}
            <div className="p-3 bg-white/60 dark:bg-gray-800/40 rounded-lg border border-purple-200 dark:border-purple-800 min-w-0">
              <div className="flex items-start justify-between mb-2 min-w-0 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <h4 className="font-semibold text-sm break-words">Feed Beta API</h4>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Download daily/weekly/hourly files of newly listed items or bootstrap files for categories</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Download daily files of new listings or weekly bootstrap files for entire categories
              </p>
              <div className="flex gap-2 flex-wrap min-w-0">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs"
                  disabled
                >
                  <Download className="w-3 h-3 mr-1" />
                  Daily Feed
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs"
                  disabled
                >
                  <Download className="w-3 h-3 mr-1" />
                  Weekly Bootstrap
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs"
                  disabled
                >
                  <Download className="w-3 h-3 mr-1" />
                  Hourly Updates
                </Button>
              </div>
            </div>

            {/* Browse & Download */}
            <div className="p-3 bg-white/60 dark:bg-gray-800/40 rounded-lg border border-purple-200 dark:border-purple-800 min-w-0">
              <div className="flex items-start justify-between mb-2 min-w-0 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <h4 className="font-semibold text-sm break-words">Browse Feeds</h4>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Browse available feeds by category and download them directly</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Browse available feeds by category and download them directly
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs"
                disabled
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Browse & Download Feeds
              </Button>
            </div>

            {/* Inventory Refresh - Notification API */}
            <div className="p-3 bg-white/60 dark:bg-gray-800/40 rounded-lg border border-purple-200 dark:border-purple-800 min-w-0">
              <div className="flex items-start justify-between mb-2 min-w-0 gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h4 className="font-semibold text-sm">Notifications API</h4>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Subscribe to and process eBay notifications for inventory changes</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Get real-time notifications about inventory changes
              </p>
              <div className="flex gap-2 flex-wrap min-w-0">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs flex-1"
                  disabled
                >
                  <Bell className="w-3 h-3 mr-1" />
                  Subscribe
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs flex-1"
                  disabled
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Manage
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
              <p className="text-xs text-muted-foreground text-center">
                These features will help you discover profitable inventory opportunities automatically
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

