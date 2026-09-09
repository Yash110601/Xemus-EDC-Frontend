'use client'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  CheckCircle2,
} from '@/components/ui/toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, duration, variant, ...props }) {
        const isErrorToast = variant === 'destructive'
        const isSuccessToast = variant === 'success'
        const resolvedDuration = isErrorToast
          ? Math.max(duration || 0, 4200)
          : isSuccessToast
            ? duration ?? 1200
            : duration ?? 1500
        return (
          <Toast key={id} duration={resolvedDuration} variant={variant} {...props}>
            <div className="flex items-start gap-3 flex-1">
              {variant === 'success' && (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden />
              )}
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
