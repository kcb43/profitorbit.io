import React, { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const THIS_YEAR = new Date().getFullYear();

/**
 * Modern date-picker input.
 * value / onChange use "YYYY-MM-DD" strings (same API as <input type="date">).
 * Passing "" or null clears the selection.
 */
export default function DatePickerInput({
  id,
  label,
  value,           // "YYYY-MM-DD" string or ""
  onChange,        // (dateStr: string) => void
  placeholder = "Pick a date",
  required = false,
  disabled = false,
  className,
  fromYear = THIS_YEAR - 10,
  toYear   = THIS_YEAR + 5,
}) {
  const [open, setOpen] = useState(false);

  // Convert string → Date (for react-day-picker)
  const selected = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);

  // Convert Date → string (for parent)
  const handleSelect = (day) => {
    if (!day) {
      onChange?.("");
      setOpen(false);
      return;
    }
    onChange?.(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.("");
  };

  const handleToday = () => {
    onChange?.(format(new Date(), "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <div className={cn("space-y-2 min-w-0", className)}>
      {label && (
        <Label htmlFor={id} className="text-foreground break-words">
          {label}
          {required ? " *" : ""}
        </Label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            className={cn(
              // Match the height / border / radius of other form inputs
              "flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 h-10",
              "text-sm text-left transition-colors",
              "hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !selected && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <span className="flex-1 truncate">
              {selected ? format(selected, "MMM d, yyyy") : placeholder}
            </span>
            {selected && !disabled && (
              <span
                role="button"
                aria-label="Clear date"
                onClick={handleClear}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-auto p-0 shadow-lg border border-border rounded-xl overflow-hidden"
          align="start"
          sideOffset={6}
        >
          {/* Quick-nav strip */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">
              Select a date
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary hover:text-primary"
              onClick={handleToday}
            >
              Today
            </Button>
          </div>

          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected ?? new Date()}
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            initialFocus
            className="p-3"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
