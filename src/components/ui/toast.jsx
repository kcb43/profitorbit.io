import * as React from "react";
import { cva } from "class-variance-authority";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    className="fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-4"
    style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 1000,
      maxWidth: '384px',
    }}
    {...props}
  />
));
ToastProvider.displayName = "ToastProvider";

const ToastViewport = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    className="fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-4"
    style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 1000,
      maxWidth: '384px',
    }}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "destructive group border-destructive/30 bg-destructive text-destructive-foreground",
        success: "bg-background text-foreground",
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
        padding: '16px 24px',
        borderRadius: '8px',
        fontFamily: 'Avenir, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        fontSize: '14px',
        lineHeight: '22px',
        marginBottom: '16px',
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
      "absolute right-6 top-4 cursor-pointer text-muted-foreground transition-colors hover:text-foreground focus:outline-none",
      className
    )}
    style={{
      position: 'absolute',
      right: '22px',
      top: '16px',
      width: '16px',
      height: '16px',
      display: 'block',
      background: 'none',
      border: 'none',
      padding: 0,
    }}
    aria-label="Close"
    {...props}
  >
    <span className="inline-flex items-center justify-center" style={{ width: '16px', height: '16px' }}>
      <X className="h-4 w-4" />
    </span>
  </button>
));
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-medium text-foreground mb-1", className)}
    style={{
      fontSize: '14px',
      lineHeight: '24px',
      marginBottom: '4px',
      marginLeft: '48px',
      paddingRight: '24px',
    }}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    style={{
      fontSize: '14px',
      lineHeight: '22px',
      marginLeft: '48px',
    }}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

const ToastIcon = React.forwardRef(({ variant = "default", className, ...props }, ref) => {
  if (variant === "success") {
    return (
      <span
        ref={ref}
        className={cn("absolute flex items-center justify-center", className)}
        style={{
          position: 'absolute',
          left: '16px',
          top: '16px',
          width: '20px',
          height: '20px',
          color: 'rgb(82, 196, 26)',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        role="img"
        aria-label="check"
        {...props}
      >
        <Check className="w-5 h-5" style={{ strokeWidth: 3, width: '20px', height: '20px' }} />
      </span>
    );
  }
  return null;
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