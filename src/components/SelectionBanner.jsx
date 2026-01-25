import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SelectionBanner({
  selectedCount,
  onClear,
  showAtTop = true, // Whether to show banner when at top of page
  threshold = 100, // Scroll threshold in pixels
  children, // Action buttons/content
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolledPastTop, setIsScrolledPastTop] = useState(false);

  useEffect(() => {
    if (selectedCount === 0) {
      setIsVisible(false);
      return;
    }

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const pastTop = scrollY > threshold;
      setIsScrolledPastTop(pastTop);
      
      // Show banner if:
      // 1. We're at the top and showAtTop is true, OR
      // 2. We've scrolled past the top
      setIsVisible(showAtTop || pastTop);
    };

    handleScroll(); // Check initial state
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [selectedCount, showAtTop, threshold]);

  if (selectedCount === 0 || !isVisible) return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 bg-emerald-500 dark:bg-emerald-600 text-white shadow-lg transition-all duration-200",
        isScrolledPastTop ? "top-0" : "top-0"
      )}
      style={{
        paddingTop: isScrolledPastTop ? "calc(env(safe-area-inset-top, 0px) + 8px)" : "8px",
        paddingBottom: "8px",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse flex-shrink-0" />
          <span className="text-sm font-semibold truncate">
            {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {children}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-white hover:bg-white/20 h-8 px-3"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
