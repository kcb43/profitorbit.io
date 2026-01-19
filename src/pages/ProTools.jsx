import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Sparkles, Send, Repeat2, Share2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function ToolCard({ title, description, to, icon: Icon, statusLabel }) {
  return (
    <Link to={to} className="block">
      <Card className="border border-border/60 bg-card/60 hover:bg-muted/40 transition-colors shadow-sm overflow-hidden">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-emerald-500/15">
            <Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-foreground">{title}</div>
              {statusLabel ? (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{statusLabel}</Badge>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 break-words">{description}</div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ProTools() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 min-w-0">
        <Card className="border border-border/60 shadow-sm bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Pro Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Advanced automation to help you sell faster. These tools use your connected marketplace accounts and (where needed) the Profit Orbit extension.
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <ToolCard
            title="Send Offers"
            description="Send bulk offers to likers/watchers across marketplaces."
            to="/pro-tools/send-offers"
            icon={Send}
            statusLabel="Active"
          />
          <ToolCard
            title="Auto Offers"
            description="Create rules to automatically send offers to new likers/watchers."
            to="/pro-tools/auto-offers"
            icon={Repeat2}
            statusLabel="Active"
          />
          <ToolCard
            title="Marketplace Sharing"
            description="Automate Poshmark sharing, Depop refreshing, and Grailed bumping to increase visibility."
            to="/pro-tools/marketplace-sharing"
            icon={Share2}
            statusLabel="Beta"
          />
        </div>
      </div>
    </div>
  );
}

