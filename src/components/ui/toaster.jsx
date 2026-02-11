import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastIcon,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  const handleClose = (id, onOpenChange) => {
    if (onOpenChange) {
      onOpenChange(false);
    } else {
      dismiss(id);
    }
  };

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, onOpenChange, variant, icon, ...props }) {
        const toastVariant = variant || "default";
        return (
          <Toast key={id} {...props} variant={toastVariant} onOpenChange={onOpenChange}>
            <div className="flex items-center w-full gap-3">
              {icon ? (
                <div className="flex-shrink-0">{icon}</div>
              ) : (
                <ToastIcon variant={toastVariant} />
              )}
              <div className="flex-1 min-w-0">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
              <ToastClose 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClose(id, onOpenChange);
                }} 
              />
            </div>
            {action}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
} 