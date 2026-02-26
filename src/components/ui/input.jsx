import * as React from "react"
import { ChevronUp, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, onFocus, ...props }, ref) => {
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
  const inputEl = (
    <input
      type={type}
      onFocus={handleFocus}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        type === "number" && "pr-9 rounded-r-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )

  if (type === "number") {
    const { value, onChange, min, max, step = 1 } = props
    const numVal = value === "" || value === undefined ? NaN : Number(value)
    const stepNum = typeof step === "string" ? parseFloat(step) : (step ?? 1)
    const minNum = min !== undefined ? Number(min) : -Infinity
    const maxNum = max !== undefined ? Number(max) : Infinity

    const clamp = (n) => Math.min(maxNum, Math.max(minNum, n))
    const roundStep = (n) => {
      if (stepNum >= 1) return Math.round(n)
      const decimals = String(stepNum).split(".")[1]?.length ?? 0
      return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals)
    }

    const handleStep = (dir) => {
      if (props.disabled || props.readOnly) return
      const current = Number.isNaN(numVal) ? (dir > 0 ? minNum : maxNum) : numVal
      const next = roundStep(current + dir * stepNum)
      const clamped = clamp(next)
      onChange?.({ target: { value: String(clamped) } })
    }

    return (
      <div className="relative flex w-full">
        {inputEl}
        <div className="absolute right-0 top-0 flex h-9 flex-col border-l border-input rounded-r-md [&>button]:flex [&>button]:flex-1 [&>button]:min-h-0 [&>button]:items-center [&>button]:justify-center [&>button]:text-muted-foreground hover:[&>button]:text-foreground [&>button]:transition-colors disabled:[&>button]:opacity-50 [&>button_svg]:block [&>button_svg]:shrink-0">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Increase value"
            disabled={props.disabled || props.readOnly || (numVal >= maxNum && !Number.isNaN(numVal))}
            className="w-7 shrink-0 rounded-tr-md hover:bg-muted/60"
            onClick={() => handleStep(1)}
          >
            <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Decrease value"
            disabled={props.disabled || props.readOnly || (numVal <= minNum && !Number.isNaN(numVal))}
            className="w-7 shrink-0 rounded-br-md hover:bg-muted/60"
            onClick={() => handleStep(-1)}
          >
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    )
  }

  return inputEl
})
Input.displayName = "Input"

export { Input }
