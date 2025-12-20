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
      {toasts.map(function ({ id, title, description, action, onOpenChange, variant, ...props }) {
        const toastVariant = variant || "success";
        return (
          <Toast key={id} {...props} variant={toastVariant} onOpenChange={onOpenChange}>
            <div className="relative" style={{ width: '100%', minHeight: '50px', position: 'relative' }}>
              <ToastIcon variant={toastVariant} />
              <div className="flex flex-col" style={{ marginLeft: '48px', paddingRight: '24px', paddingTop: '2px' }}>
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClose(id, onOpenChange);
              }} 
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
} 