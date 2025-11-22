import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

// Limited color palette - only these colors are available
const COMMON_COLORS = [
  { name: "Black", hex: "#000000" },
  { name: "Beige", hex: "#F5F5DC" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Brown", hex: "#8B4513" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Grey", hex: "#808080" },
  { name: "Green", hex: "#008000" },
  { name: "Orange", hex: "#FFA500" },
  { name: "Pink", hex: "#FFC0CB" },
  { name: "Purple", hex: "#800080" },
  { name: "Red", hex: "#FF0000" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Yellow", hex: "#FFFF00" },
  { name: "White", hex: "#FFFFFF" },
];

export default function ColorPickerDialog({
  open,
  onOpenChange,
  currentColor,
  onSelectColor,
  fieldLabel,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredColors = useMemo(() => {
    if (!searchQuery.trim()) return COMMON_COLORS;
    const query = searchQuery.toLowerCase();
    return COMMON_COLORS.filter(
      (color) =>
        color.name.toLowerCase().includes(query) ||
        color.hex.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleColorSelect = (colorName, colorHex) => {
    onSelectColor(colorName, colorHex);
    setSearchQuery("");
    onOpenChange(false);
  };

  const handleClose = (openState) => {
    if (!openState) {
      setSearchQuery("");
    }
    onOpenChange(openState);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select {fieldLabel}</DialogTitle>
          <DialogDescription>
            Choose a color from the available palette
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search colors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Color grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 pb-2">
              {filteredColors.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => handleColorSelect(color.name, color.hex)}
                  className="group relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-transparent hover:border-primary transition-all hover:shadow-md"
                  style={{
                    backgroundColor: color.hex === "#FFFFFF" ? "#F5F5F5" : "transparent",
                  }}
                >
                  <div
                    className="w-full h-12 sm:h-14 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm transition-transform group-hover:scale-105"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-xs font-medium text-center text-foreground leading-tight">
                    {color.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {color.hex}
                  </span>
                </button>
              ))}
            </div>

            {filteredColors.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No colors found. Try a different search term.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

