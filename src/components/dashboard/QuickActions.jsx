import React from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { CalendarDays, Package, Layers, BarChart3 } from "lucide-react";

export default function QuickActions() {
  const actions = [
    {
      title: "Add Inventory",
      description: "Add new items",
      icon: Package,
      link: createPageUrl("AddInventoryItem"),
      gradient: "from-emerald-500 via-green-500 to-teal-600",
      shadow: "shadow-emerald-500/30"
    },
    {
      title: "Profit Calendar",
      description: "View daily profit",
      icon: CalendarDays,
      link: createPageUrl("ProfitCalendar"),
      gradient: "from-green-500 via-emerald-500 to-teal-600",
      shadow: "shadow-green-500/30"
    },
    {
      title: "Create Listing",
      description: "Cross-list items",
      icon: Layers,
      link: createPageUrl("Crosslist"),
      gradient: "from-cyan-500 via-sky-500 to-blue-600",
      shadow: "shadow-sky-500/30",
      hoverBorder: "hover:border-blue-500/40 dark:hover:border-blue-400/30"
    },
    {
      title: "View Reports",
      description: "See analytics",
      icon: BarChart3,
      link: createPageUrl("Reports"),
      gradient: "from-orange-500 via-amber-500 to-yellow-600",
      shadow: "shadow-orange-500/30",
      hoverBorder: "hover:border-orange-500/40 dark:hover:border-orange-400/30"
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-lg sm:text-xl font-bold text-foreground">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              to={action.link}
              className={`relative rounded-xl p-4 sm:p-8 lg:p-12 backdrop-blur-[10px] bg-card/60 border border-border/60 ${
                action.hoverBorder || "hover:border-emerald-500/30 dark:hover:border-emerald-400/25"
              } shadow-[rgba(0,0,0,0.06)_0px_4px_12px] dark:shadow-[rgba(0,0,0,0.18)_0px_8px_16px] hover:shadow-[rgba(0,0,0,0.10)_0px_6px_16px] dark:hover:shadow-[rgba(0,0,0,0.22)_0px_10px_20px] transition-all duration-200 text-center group hover:scale-[1.01] hover:-translate-y-0.5`}
            >
              {/* Icon with gradient background */}
              <div className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 mx-auto mb-2 sm:mb-3 lg:mb-4 rounded-xl flex items-center justify-center bg-gradient-to-br ${action.gradient} shadow-lg ${action.shadow}`}>
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-white" />
              </div>
              
              {/* Title */}
              <div
                className={[
                  "text-xs sm:text-sm font-semibold text-gray-900 dark:text-white transition-colors",
                  action.title === "Create Listing"
                    ? "group-hover:text-blue-600 dark:group-hover:text-blue-300"
                    : action.title === "View Reports"
                      ? "group-hover:text-orange-600 dark:group-hover:text-orange-300"
                      : "group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
                ].join(" ")}
              >
                {action.title}
              </div>
              
              {/* Description */}
              <div className="text-[10px] sm:text-xs text-gray-600 dark:text-slate-400 mt-0.5 sm:mt-1 hidden sm:block">
                {action.description}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
