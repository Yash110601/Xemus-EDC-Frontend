"use client"

import { useEffect } from "react"
import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

const AUTO_DISMISS_MS = 3000

/**
 * Save/submit confirmation — top-right corner, auto-dismisses after 3 seconds.
 */
export default function CrfSaveSuccessPopup({ open, title, description, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(() => {
      onClose?.()
    }, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [open, onClose, title, description])

  if (!open) return null

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 top-4 z-[120] w-[min(100%,22rem)]",
        "pt-[max(0px,env(safe-area-inset-top))] animate-in fade-in slide-in-from-top-2 duration-300",
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={cn(
          "pointer-events-auto overflow-hidden rounded-2xl border border-emerald-200/90 bg-white shadow-2xl ring-1 ring-emerald-400/30",
          "animate-in slide-in-from-right-4 duration-300",
        )}
      >
        <div className="flex gap-3 bg-gradient-to-r from-emerald-50 via-white to-teal-50/80 px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 ring-2 ring-emerald-50">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">{title || "Success"}</p>
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{description}</p>
            ) : null}
            <p className="mt-1.5 text-[10px] font-medium text-emerald-700/80">Closing in 3 seconds</p>
          </div>
        </div>
      </div>
    </div>
  )
}
