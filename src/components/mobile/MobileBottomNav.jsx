import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { Home, Package, Wrench, BarChart3 } from "lucide-react";

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

export default function MobileBottomNav() {
  const location = useLocation();
  const path = location.pathname || "/";

  const isDashboard = path === "/" || path.toLowerCase().includes("/dashboard");
  const isInventory = path.toLowerCase().includes("/inventory");
  const isTools = path.toLowerCase().includes("/tools") || path.toLowerCase().includes("/crosslist") || path.toLowerCase().includes("/addsale") || path.toLowerCase().includes("/pulse") || path.toLowerCase().includes("/deals") || path.toLowerCase().includes("/product-search");
  const isAnalytics = path.toLowerCase().includes("/analytics") || path.toLowerCase().includes("/reports") || path.toLowerCase().includes("/profitcalendar") || path.toLowerCase().includes("/gallery") || path.toLowerCase().includes("/saleshistory");

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

            <NavIconButton icon={Wrench} label="Tools" active={isTools} to={createPageUrl("Tools")} />
            <NavIconButton icon={BarChart3} label="Analytics" active={isAnalytics} to={createPageUrl("Analytics")} />

            <NavIconButton icon={Package} label="Inventory" active={isInventory} to={createPageUrl("Inventory")} />
          </div>
        </div>
      </div>
    </div>
  );
}


