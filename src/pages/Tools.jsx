import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Wrench, Layers, Plus, TrendingUp, History, Settings, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function HubCard({ title, description, to, icon: Icon, gradient }) {
  return (
    <Link to={to} className="block">
      <Card className="border border-border/60 bg-card/60 hover:bg-muted/40 transition-colors shadow-sm">
        <CardContent className="p-4 flex items-start gap-3">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} shadow-md`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Tools() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
        <Card className="border border-border/60 shadow-sm bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Quick access to your most-used workflows.
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <HubCard
            title="Crosslist"
            description="List inventory across platforms"
            to={createPageUrl("Crosslist")}
            icon={Layers}
            gradient="from-cyan-500 via-sky-500 to-blue-600"
          />
          <HubCard
            title="Pro Tools"
            description="Offers + auto offers + sharing"
            to={createPageUrl("Pro Tools")}
            icon={Sparkles}
            gradient="from-emerald-500 to-green-500"
          />
          <HubCard
            title="Add Sale"
            description="Record a sale"
            to={createPageUrl("AddSale")}
            icon={Plus}
            gradient="from-emerald-500 to-green-500"
          />
          <HubCard
            title="Market Intelligence"
            description="Research comps and trends"
            to={createPageUrl("MarketIntelligence")}
            icon={TrendingUp}
            gradient="from-indigo-500 to-violet-600"
          />
          <HubCard
            title="Sales History"
            description="View and manage all sales"
            to={createPageUrl("SalesHistory")}
            icon={History}
            gradient="from-blue-500 to-indigo-600"
          />
          <HubCard
            title="Settings"
            description="Connections and preferences"
            to={createPageUrl("Settings")}
            icon={Settings}
            gradient="from-gray-600 to-gray-800"
          />
        </div>
      </div>
    </div>
  );
}


