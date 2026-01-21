import React from "react";
import { X, GalleryHorizontal, Archive, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ModeBanner({ mode, onClose, className }) {
  if (!mode) return null;

  const modeConfig = {
    gallery: {
      icon: GalleryHorizontal,
      label: "Gallery Mode",
      bgColor: "bg-blue-500/90 dark:bg-blue-600/90",
      textColor: "text-white",
    },
    deleted: {
      icon: Archive,
      label: "Showing Deleted Items",
      bgColor: "bg-orange-500/90 dark:bg-orange-600/90",
      textColor: "text-white",
    },
    favorites: {
      icon: Star,
      label: "Showing Favorites",
      bgColor: "bg-yellow-500/90 dark:bg-yellow-600/90",
      textColor: "text-white",
    },
  };

  const config = modeConfig[mode];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all",
        config.bgColor,
        config.textColor,
        className
      )}
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-semibold truncate">{config.label}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
