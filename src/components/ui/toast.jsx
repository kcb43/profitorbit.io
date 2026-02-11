import * as React from "react";
import { cva } from "class-variance-authority";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    className="fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-3"
    style={{
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: 1000,
      maxWidth: '420px',
    }}
    {...props}
  />
));
ToastProvider.displayName = "ToastProvider";

const ToastViewport = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    className="fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-3"
    style={{
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: 1000,
      maxWidth: '420px',
    }}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center overflow-hidden rounded-2xl shadow-xl transition-all duration-300 data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "bg-background border border-border/40",
        destructive: "bg-background border border-red-200/40",
        success: "bg-background border border-green-200/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Toast = React.forwardRef(({ className, variant, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      style={{
        padding: '16px 20px',
        borderRadius: '16px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '14px',
        lineHeight: '20px',
      }}
      {...props}
    />
  );
});
Toast.displayName = "Toast";

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

const ToastClose = React.forwardRef(({ className, onClick, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className={cn(
      "ml-auto flex-shrink-0 rounded-full p-1 transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring",
      className
    )}
    style={{
      width: '28px',
      height: '28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
    }}
    aria-label="Close"
    {...props}
  >
    <X className="h-4 w-4 text-muted-foreground" />
  </button>
));
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    style={{
      fontSize: '14px',
      fontWeight: 600,
      lineHeight: '20px',
    }}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs text-muted-foreground mt-0.5", className)}
    style={{
      fontSize: '12px',
      lineHeight: '16px',
      marginTop: '2px',
    }}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

const ToastIcon = React.forwardRef(({ variant = "default", className, ...props }, ref) => {
  let IconComponent = Info;
  let iconBgColor = "bg-blue-100";
  let iconColor = "text-blue-600";
  
  if (variant === "success") {
    IconComponent = CheckCircle2;
    iconBgColor = "bg-green-100";
    iconColor = "text-green-600";
  } else if (variant === "destructive") {
    IconComponent = AlertCircle;
    iconBgColor = "bg-red-100";
    iconColor = "text-red-600";
  }
  
  return (
    <div
      ref={ref}
      className={cn("flex-shrink-0 flex items-center justify-center rounded-full", iconBgColor, iconColor, className)}
      style={{
        width: '40px',
        height: '40px',
        marginRight: '12px',
      }}
      role="img"
      aria-label={variant}
      {...props}
    >
      <IconComponent className="w-5 h-5" />
    </div>
  );
});
ToastIcon.displayName = "ToastIcon";

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastIcon,
}; 