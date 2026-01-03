import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { Home, Package, Wrench, BarChart3 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

function NavIconButton({ icon: Icon, label, active, to, onClick }) {
  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <div
        className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center",
          active ? "bg-emerald-500/15" : "bg-transparent"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-[11px] font-medium leading-none">{label}</div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="flex-1 min-w-0">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="flex-1 min-w-0">
      {content}
    </button>
  );
}

function SheetLink({ to, title, description }) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 hover:bg-muted/40 transition-colors px-4 py-3"
    >
      <div className="min-w-0">
        <div className="font-semibold text-foreground">{title}</div>
        {description ? <div className="text-xs text-muted-foreground mt-0.5">{description}</div> : null}
      </div>
    </Link>
  );
}

export default function MobileBottomNav() {
  const location = useLocation();
  const path = location.pathname || "/";

  const isDashboard = path === "/" || path.toLowerCase().includes("/dashboard");
  const isInventory = path.toLowerCase().includes("/inventory");
  const isTools = path.toLowerCase().includes("/crosslist") || path.toLowerCase().includes("/addsale") || path.toLowerCase().includes("/marketintelligence");
  const isAnalytics = path.toLowerCase().includes("/reports") || path.toLowerCase().includes("/profitcalendar") || path.toLowerCase().includes("/gallery");

  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto max-w-7xl px-3">
        <div
          className={cn(
            "border border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70",
            "rounded-2xl shadow-lg",
            "px-2 py-1"
          )}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)" }}
        >
          <div className="flex items-stretch">
            <NavIconButton icon={Home} label="Home" active={isDashboard} to={createPageUrl("Dashboard")} />

            <Sheet>
              <SheetTrigger asChild>
                <button type="button" className="flex-1 min-w-0">
                  <div className={cn("flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors", isTools ? "text-foreground" : "text-muted-foreground")}>
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", isTools ? "bg-emerald-500/15" : "bg-transparent")}>
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div className="text-[11px] font-medium leading-none">Tools</div>
                  </div>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6">
                <SheetTitle className="text-base">Tools</SheetTitle>
                <div className="mt-4 grid gap-3">
                  <SheetLink to={createPageUrl("Crosslist")} title="Crosslist" description="List inventory across platforms" />
                  <SheetLink to={createPageUrl("AddSale")} title="Add Sale" description="Record a sale" />
                  <SheetLink to={createPageUrl("MarketIntelligence")} title="Market Intelligence" description="Research comps and trends" />
                  <SheetLink to={createPageUrl("SalesHistory")} title="Sales History" description="View all sales" />
                  <SheetLink to={createPageUrl("Settings")} title="Settings" description="Connections and preferences" />
                </div>
                <div className="mt-4">
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={createPageUrl("Dashboard")}>Close</Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <Sheet>
              <SheetTrigger asChild>
                <button type="button" className="flex-1 min-w-0">
                  <div className={cn("flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors", isAnalytics ? "text-foreground" : "text-muted-foreground")}>
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", isAnalytics ? "bg-emerald-500/15" : "bg-transparent")}>
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div className="text-[11px] font-medium leading-none">Analytics</div>
                  </div>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6">
                <SheetTitle className="text-base">Analytics</SheetTitle>
                <div className="mt-4 grid gap-3">
                  <SheetLink to={createPageUrl("Reports")} title="Reports" description="Category + tax + summaries" />
                  <SheetLink to={createPageUrl("ProfitCalendar")} title="Profit Calendar" description="Calendar view of profit" />
                  <SheetLink to={createPageUrl("Gallery")} title="Showcase" description="Your top flips and highlights" />
                </div>
                <div className="mt-4">
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={createPageUrl("Dashboard")}>Close</Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <NavIconButton icon={Package} label="Inventory" active={isInventory} to={createPageUrl("Inventory")} />
          </div>
        </div>
      </div>
    </div>
  );
}


