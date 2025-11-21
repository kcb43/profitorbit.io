import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClearableDateInput({
  id,
  label,
  value,
  onChange,
  required = false,
}) {
  const inputRef = React.useRef(null);

  const openPicker = () => {
    if (inputRef.current) {
      inputRef.current.showPicker?.();
      inputRef.current.focus();
    }
  };

  return (
    <div className="space-y-2 min-w-0">
      {label && <Label htmlFor={id} className="dark:text-gray-200 break-words">{label}{required ? " *" : ""}</Label>}

      <div className="relative w-full max-w-full overflow-hidden min-w-0">
        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 dark:text-emerald-400 pointer-events-none z-10" />

        <Input
          ref={inputRef}
          id={id}
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              openPicker();
            }
          }}
          className="date-input pl-10 w-full max-w-full box-border cursor-pointer h-10 rounded-lg border border-border bg-background text-foreground focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden"
        />

        {value && (
          <Button
            type="button"
            aria-label="Clear date"
            title="Clear date"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            variant="ghost"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}