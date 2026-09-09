"use client"

import { cn } from "@/lib/utils"
import {
  getCrfProgressStatusLabel,
  getCrfProgressTone,
  normalizeCrfProgress,
} from "@/lib/utils/crfProgress"

const TONE_STYLES = {
  completed: {
    bar: "bg-gradient-to-r from-green-500 to-green-600",
    text: "text-green-600",
  },
  inProgress: {
    bar: "bg-gradient-to-r from-orange-500 to-orange-600",
    text: "text-orange-600",
  },
  notStarted: {
    bar: "bg-gradient-to-r from-red-500 to-red-600",
    text: "text-red-600",
  },
}

/**
 * Required-field completion bar (0–100%) with optional status label.
 * @param {"default"|"compact"} size
 */
export default function CrfProgressBar({
  progress,
  size = "default",
  inverted = false,
  showStatus = true,
  showCounts = false,
  countsText = "",
  label = "CRF progress",
  className,
}) {
  const normalized = normalizeCrfProgress(progress)
  const tone = getCrfProgressTone(normalized)
  const styles = TONE_STYLES[tone]
  const compact = size === "compact"

  return (
    <div className={cn("space-y-1", className)}>
      <div className={cn("flex items-center justify-between", compact ? "text-[10px]" : "text-xs")}>
        <span className={cn("font-medium", inverted ? "text-white/85" : "text-slate-600")}>
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {showStatus ? (
            <span
              className={cn(
                "font-semibold",
                inverted ? "text-white/90" : "text-slate-500",
                compact && "hidden sm:inline",
              )}
            >
              {getCrfProgressStatusLabel(normalized.progressStatus)}
            </span>
          ) : null}
          <span className={cn("font-bold tabular-nums", inverted ? "text-white" : styles.text)}>
            {normalized.progressPercent}%
          </span>
        </div>
      </div>
      <div
        className={cn(
          "w-full overflow-hidden rounded-full",
          compact ? "h-1.5" : "h-2",
          inverted ? "bg-white/25" : "bg-slate-200/60",
        )}
      >
        <div
          className={cn("h-full transition-all duration-500", inverted ? "bg-white/90" : styles.bar)}
          style={{ width: `${normalized.progressPercent}%` }}
        />
      </div>
      {showCounts && (countsText || normalized.requiredFieldCount > 0) ? (
        <p className={cn("text-[10px]", inverted ? "text-white/75" : "text-slate-500")}>
          {countsText ||
            `${normalized.completedRequiredFieldCount} / ${normalized.requiredFieldCount} required fields`}
        </p>
      ) : null}
    </div>
  )
}
