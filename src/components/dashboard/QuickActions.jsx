import React from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Package, Layers, BarChart3 } from "lucide-react";

export default function QuickActions() {
  const actions = [
    {
      title: "Add Inventory",
      description: "Add new items",
      icon: Package,
      link: createPageUrl("AddInventoryItem"),
      gradient: "from-blue-500 via-indigo-500 to-purple-600",
      shadow: "shadow-blue-500/30"
    },
    {
      title: "Add Sale",
      description: "Record a sale",
      icon: Plus,
      link: createPageUrl("AddSale"),
      gradient: "from-green-500 via-emerald-500 to-teal-600",
      shadow: "shadow-green-500/30"
    },
    {
      title: "Create Listing",
      description: "Cross-list items",
      icon: Layers,
      link: createPageUrl("Crosslist"),
      gradient: "from-purple-500 via-indigo-500 to-pink-600",
      shadow: "shadow-purple-500/30"
    },
    {
      title: "View Reports",
      description: "See analytics",
      icon: BarChart3,
      link: createPageUrl("Reports"),
      gradient: "from-orange-500 via-amber-500 to-yellow-600",
      shadow: "shadow-orange-500/30"
    }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              to={action.link}
              className="relative rounded-xl p-12 backdrop-blur-[10px] bg-gray-50/50 dark:bg-slate-800/80 border border-indigo-500/30 dark:border-indigo-500/50 hover:border-indigo-500/50 dark:hover:border-indigo-500/70 shadow-[rgba(0,0,0,0.08)_0px_4px_12px] dark:shadow-[rgba(0,0,0,0.15)_0px_8px_16px] hover:shadow-[rgba(0,0,0,0.12)_0px_6px_16px] dark:hover:shadow-[rgba(0,0,0,0.2)_0px_10px_20px] transition-all duration-300 text-center group"
            >
              {/* Icon with gradient background */}
              <div className={`w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center bg-gradient-to-br ${action.gradient} shadow-lg ${action.shadow}`}>
                <Icon className="w-8 h-8 text-white" />
              </div>
              
              {/* Title */}
              <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                {action.title}
              </div>
              
              {/* Description */}
              <div className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                {action.description}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
