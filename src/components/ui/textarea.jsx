import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, onFocus, ...props }, ref) => {
  const handleFocus = (e) => {
    onFocus?.(e);
    if (e.defaultPrevented) return;
    requestAnimationFrame(() => {
      const el = e.target;
      if (el && typeof el.setSelectionRange === 'function') {
        const len = String(el.value ?? '').length;
        el.setSelectionRange(len, len);
      }
    });
  };
  return (
    (<textarea
      onFocus={handleFocus}
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
