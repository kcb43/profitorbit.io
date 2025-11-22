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
import { Search, Plus, X } from "lucide-react";

// Comprehensive color palette with hex codes for clothing and shoes
const COMMON_COLORS = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Gray", hex: "#808080" },
  { name: "Navy", hex: "#000080" },
  { name: "Brown", hex: "#8B4513" },
  { name: "Tan", hex: "#D2B48C" },
  { name: "Beige", hex: "#F5F5DC" },
  { name: "Khaki", hex: "#C3B091" },
  { name: "Camel", hex: "#C19A6B" },
  { name: "Olive", hex: "#808000" },
  { name: "Forest Green", hex: "#228B22" },
  { name: "Burgundy", hex: "#800020" },
  { name: "Maroon", hex: "#800000" },
  { name: "Red", hex: "#FF0000" },
  { name: "Pink", hex: "#FFC0CB" },
  { name: "Rose", hex: "#FF007F" },
  { name: "Purple", hex: "#800080" },
  { name: "Lavender", hex: "#E6E6FA" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Royal Blue", hex: "#4169E1" },
  { name: "Sky Blue", hex: "#87CEEB" },
  { name: "Teal", hex: "#008080" },
  { name: "Turquoise", hex: "#40E0D0" },
  { name: "Green", hex: "#008000" },
  { name: "Lime", hex: "#00FF00" },
  { name: "Yellow", hex: "#FFFF00" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Orange", hex: "#FFA500" },
  { name: "Coral", hex: "#FF7F50" },
  { name: "Salmon", hex: "#FA8072" },
  { name: "Ivory", hex: "#FFFFF0" },
  { name: "Cream", hex: "#FFFDD0" },
  { name: "Champagne", hex: "#F7E7CE" },
  { name: "Blush", hex: "#DE5D83" },
  { name: "Dusty Rose", hex: "#B76E79" },
  { name: "Mauve", hex: "#E0B0FF" },
  { name: "Plum", hex: "#8E4585" },
  { name: "Indigo", hex: "#4B0082" },
  { name: "Electric Blue", hex: "#7DF9FF" },
  { name: "Sapphire", hex: "#0F52BA" },
  { name: "Mint", hex: "#98FB98" },
  { name: "Emerald", hex: "#50C878" },
  { name: "Chartreuse", hex: "#7FFF00" },
  { name: "Amber", hex: "#FFBF00" },
  { name: "Rust", hex: "#B7410E" },
  { name: "Brick", hex: "#CB4154" },
  { name: "Charcoal", hex: "#36454F" },
  { name: "Slate", hex: "#708090" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Platinum", hex: "#E5E4E2" },
  { name: "Bronze", hex: "#CD7F32" },
  { name: "Copper", hex: "#B87333" },
];

export default function ColorPickerDialog({
  open,
  onOpenChange,
  currentColor,
  onSelectColor,
  fieldLabel,
}) {
  const [customHex, setCustomHex] = useState("");
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
    setCustomHex("");
    onOpenChange(false);
  };

  const handleCustomColor = () => {
    if (!customHex.trim()) return;
    
    // Validate hex color format
    const hexPattern = /^#?[0-9A-Fa-f]{6}$/;
    const hexValue = customHex.startsWith("#") ? customHex : `#${customHex}`;
    
    if (hexPattern.test(hexValue)) {
      // For custom colors, pass hex as name so it can be stored as hex
      handleColorSelect(hexValue, hexValue);
    }
  };

  const handleClose = (openState) => {
    if (!openState) {
      setSearchQuery("");
      setCustomHex("");
    }
    onOpenChange(openState);
  };

  const isValidHex = useMemo(() => {
    if (!customHex.trim()) return false;
    const hexPattern = /^#?[0-9A-Fa-f]{6}$/;
    const hexValue = customHex.startsWith("#") ? customHex : `#${customHex}`;
    return hexPattern.test(hexValue);
  }, [customHex]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select {fieldLabel}</DialogTitle>
          <DialogDescription>
            Choose a color from the palette or enter a custom hex code
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

          {/* Custom color input */}
          <div className="border-t pt-4 space-y-2">
            <Label htmlFor="custom-hex" className="text-sm font-medium">
              Custom Color (Hex Code)
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground font-mono">
                  #
                </span>
                <Input
                  id="custom-hex"
                  placeholder="FFFFFF"
                  value={customHex}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
                    setCustomHex(value);
                  }}
                  className="pl-8 font-mono"
                  maxLength={6}
                />
              </div>
              {customHex && (
                <div
                  className="w-12 h-12 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0"
                  style={{
                    backgroundColor: isValidHex
                      ? `#${customHex}`
                      : "transparent",
                  }}
                />
              )}
              <Button
                type="button"
                onClick={handleCustomColor}
                disabled={!isValidHex}
                className="flex-shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {customHex && !isValidHex && (
              <p className="text-xs text-destructive">
                Please enter a valid 6-digit hex code (0-9, A-F)
              </p>
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

