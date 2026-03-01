import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Wrench, Layers, Plus, TrendingUp, History, Settings, Sparkles, TrendingDown } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
        <Card className="border border-border/60 shadow-sm bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Tools
            </CardTitle>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <HubCard
            title="Deal Feed"
            description="Find profitable deals"
            to="/deals"
            icon={TrendingDown}
            gradient="from-orange-500 to-red-500"
          />
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
        </div>
      </div>
    </div>
  );
}


