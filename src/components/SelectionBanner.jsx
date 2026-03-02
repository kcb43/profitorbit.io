import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useRegisterSelectionBanner } from "@/hooks/useSelectionBanner";

export default function SelectionBanner({
  selectedCount,
  onClear,
  showAtTop = true,
  threshold = 100,
  children,
}) {
  // Register selection state into Layout's floating bar context
  useRegisterSelectionBanner({ selectedCount, onClear, children });

  // Mobile: still render a fixed banner (floating bar is hidden md:flex)
  const [showMobile, setShowMobile] = useState(false);

  useEffect(() => {
    if (selectedCount === 0) {
      setShowMobile(false);
      return;
    }

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const pastTop = scrollY > threshold;
      setShowMobile(showAtTop || pastTop);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [selectedCount, showAtTop, threshold]);

  if (selectedCount === 0 || !showMobile) return null;

  // On desktop, the floating bar in Layout handles this.
  // On mobile, render the standalone banner.
  return (
    <div
      className="fixed left-0 right-0 z-[60] md:hidden bg-emerald-500 dark:bg-emerald-600 text-white shadow-lg transition-all duration-200 top-0"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
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
