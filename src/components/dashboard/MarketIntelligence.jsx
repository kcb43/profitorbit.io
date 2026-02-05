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
    <Card className="border-2 border-dashed border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Pulse
            </CardTitle>
            <CardDescription className="mt-1">
              Discover new inventory opportunities using eBay Feed APIs
            </CardDescription>
          </div>
          <Badge variant="secondary" className="ml-2">
            Coming Soon
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Feed Beta API */}
        <div className="p-3 bg-white/60 dark:bg-card rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h4 className="font-semibold text-sm">Feed Beta API</h4>
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
          <div className="flex gap-2 flex-wrap">
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

        {/* Feed API */}
        <div className="p-3 bg-white/60 dark:bg-card rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="font-semibold text-sm">Feed API</h4>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Use metadata methods to see available feed types and download feed files</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Browse available feed types and download custom feed files
          </p>
          <Button 
            size="sm" 
            variant="outline" 
            className="text-xs w-full"
            disabled
          >
            <Database className="w-3 h-3 mr-1" />
            Browse & Download Feeds
          </Button>
        </div>

        {/* Inventory Refresh - Notification API */}
        <div className="p-3 bg-white/60 dark:bg-card rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-start justify-between mb-2">
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
          <div className="flex gap-2">
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
  );
}

