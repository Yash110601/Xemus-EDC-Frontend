"use client"

import { Button } from "@/components/ui/button"
import { confidenceBadgeClass, formatCdashVariableOption } from "@/lib/cdash/normalizeVariable"
import { cn } from "@/lib/utils"
import { Info, Lock } from "lucide-react"

export default function CdashSuggestionRow({
  suggestion,
  disabled = false,
  onUse,
  compact = false,
}) {
  if (!suggestion?.variable) return null
  const { variable, confidence, reasons = [], isAvailable, unavailableReason } = suggestion
  const unavailable = isAvailable === false
  const badgeClass = confidenceBadgeClass(confidence)
  const rowDisabled = disabled || unavailable

  return (
    <div
      className={cn(
        "rounded-xl border px-2.5 py-2 backdrop-blur-sm",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        unavailable
          ? "border-slate-200/50 bg-slate-100/70 opacity-80"
          : "border-slate-200/70 bg-white/80",
        compact ? "space-y-1.5" : "space-y-2",
      )}
      title={unavailable ? unavailableReason ?? "Unavailable" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[11px] font-medium truncate",
              unavailable ? "text-slate-500" : "text-slate-800",
            )}
          >
            {variable.domainCode} / {variable.variableName}
          </p>
          <p className="text-[10px] text-slate-500 truncate">
            {formatCdashVariableOption(variable)}
          </p>
        </div>
        {unavailable ? (
          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" aria-hidden="true" />
        ) : (
          <span
            className={cn(
              "shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              badgeClass,
            )}
            title={reasons.join(" · ") || "Confidence"}
          >
            {confidence}%
          </span>
        )}
      </div>

      {unavailable && unavailableReason ? (
        <p className="text-[10px] text-amber-700 flex items-start gap-1">
          <Info className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{unavailableReason}</span>
        </p>
      ) : null}

      {!unavailable && reasons.length > 0 ? (
        <p className="text-[10px] text-slate-400 flex items-start gap-1">
          <Info className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{reasons.slice(0, 2).join(" · ")}</span>
        </p>
      ) : null}

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={rowDisabled}
        onClick={() => {
          if (rowDisabled) return
          onUse?.(suggestion)
        }}
        className={cn(
          "h-7 w-full text-[10px] rounded-lg",
          unavailable
            ? "cursor-not-allowed opacity-60"
            : "hover:bg-indigo-50/90 hover:border-indigo-200/80",
        )}
      >
        {unavailable ? "Unavailable" : "Use this"}
      </Button>
    </div>
  )
}
