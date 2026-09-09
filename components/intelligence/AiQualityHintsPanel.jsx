"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AlertTriangle, ChevronDown, ChevronUp, Info, ShieldAlert, Sparkles } from "lucide-react"

function severityIcon(severity) {
  const s = String(severity ?? "").toLowerCase()
  if (s === "error") return ShieldAlert
  if (s === "warning") return AlertTriangle
  return Info
}

function severityClass(severity) {
  const s = String(severity ?? "").toLowerCase()
  if (s === "error") return "border-rose-200 bg-rose-50/80 text-rose-900"
  if (s === "warning") return "border-amber-200 bg-amber-50/80 text-amber-900"
  return "border-sky-200 bg-sky-50/80 text-sky-900"
}

/**
 * Pre-submit quality hints — non-blocking panel; user acknowledges or dismisses.
 */
export default function AiQualityHintsPanel({
  hints = [],
  loading = false,
  onDismiss,
  onAcknowledge,
  className,
}) {
  const [expanded, setExpanded] = useState(true)
  const [dismissedIds, setDismissedIds] = useState(() => new Set())

  const visible = (hints || []).filter((h, i) => !dismissedIds.has(h?.fieldId ?? h?.id ?? i))
  if (!loading && visible.length === 0) return null

  const handleDismissAll = () => {
    const next = new Set(dismissedIds)
    visible.forEach((h, i) => next.add(h?.fieldId ?? h?.id ?? i))
    setDismissedIds(next)
    onDismiss?.()
  }

  const handleAcknowledge = () => {
    onAcknowledge?.(visible)
    handleDismissAll()
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-violet-200/70 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
        className,
      )}
      role="status"
      aria-busy={loading}
      aria-label="AI quality hints"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-violet-900">
          <Sparkles className="h-4 w-4 text-violet-600" />
          Quality hints
          {!loading && visible.length > 0 ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
              {visible.length}
            </span>
          ) : null}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-slate-100 px-3 py-3">
          {loading ? (
            <div className="space-y-2" aria-hidden>
              {[1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : (
            visible.map((hint, index) => {
              const Icon = severityIcon(hint?.severity)
              return (
                <div
                  key={hint?.fieldId ?? hint?.id ?? index}
                  className={cn("rounded-lg border px-2.5 py-2 text-xs", severityClass(hint?.severity))}
                >
                  <p className="flex items-start gap-1.5 font-semibold">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {hint?.fieldLabel || hint?.fieldId || "Field"}
                  </p>
                  <p className="mt-1 pl-5 leading-relaxed">{hint?.message || hint?.rationale}</p>
                </div>
              )
            })
          )}

          {!loading && visible.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={handleDismissAll}>
                Dismiss
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-violet-700 text-white hover:bg-violet-800"
                onClick={handleAcknowledge}
              >
                Acknowledge & continue
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
