"use client"

import { cn } from "@/lib/utils"
import { hasCrfQueryActivity, normalizeCrfQuerySummary } from "@/lib/utils/crfQuerySummary"

const BADGE_STYLES = {
  open: "border-amber-200/90 bg-amber-50/95 text-amber-800",
  inProcess: "border-sky-200/90 bg-sky-50/95 text-sky-800",
  closed: "border-emerald-200/90 bg-emerald-50/95 text-emerald-800",
  manual: "border-violet-200/90 bg-violet-50/95 text-violet-800",
  auto: "border-slate-200/90 bg-slate-100/95 text-slate-700",
  total: "border-slate-200/90 bg-white/95 text-slate-800",
}

function QueryBadge({ label, count, tone, compact, inverted }) {
  if (!count || count <= 0) return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        inverted ? "border-white/35 bg-white/15 text-white" : BADGE_STYLES[tone],
      )}
      title={`${label}: ${count}`}
    >
      <span className="opacity-80">{label}</span>
      <span>{count}</span>
    </span>
  )
}

/**
 * Compact query count chips for patient rows, visit cards, and headers.
 * @param {"open"|"inProcess"|"closed"|"all"|"openOnly"|"detail"} variant
 */
export default function CrfQuerySummaryBadges({
  summary,
  variant = "all",
  compact = false,
  inverted = false,
  className,
}) {
  const counts = normalizeCrfQuerySummary(summary)
  if (!hasCrfQueryActivity(counts)) return null

  if (variant === "openOnly") {
    return counts.open > 0 ? (
      <span
        className={cn(
          "inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold",
          inverted ? "bg-amber-300/90 text-amber-950" : "bg-amber-100 text-amber-800 ring-1 ring-amber-200/80",
          className,
        )}
        title={`${counts.open} open ${counts.open === 1 ? "query" : "queries"}`}
      >
        {counts.open}
      </span>
    ) : null
  }

  if (variant === "detail") {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <QueryBadge label="Total" count={counts.total} tone="total" compact={compact} inverted={inverted} />
        <QueryBadge label="Open" count={counts.open} tone="open" compact={compact} inverted={inverted} />
        <QueryBadge label="In proc." count={counts.inProcess} tone="inProcess" compact={compact} inverted={inverted} />
        <QueryBadge label="Closed" count={counts.closed} tone="closed" compact={compact} inverted={inverted} />
        <QueryBadge label="Manual" count={counts.manual} tone="manual" compact={compact} inverted={inverted} />
        <QueryBadge label="Auto" count={counts.auto} tone="auto" compact={compact} inverted={inverted} />
      </div>
    )
  }

  const showOpen = variant === "all" || variant === "open"
  const showInProcess = variant === "all" || variant === "inProcess"
  const showClosed = variant === "all" || variant === "closed"

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {showOpen ? <QueryBadge label="Open" count={counts.open} tone="open" compact={compact} inverted={inverted} /> : null}
      {showInProcess ? (
        <QueryBadge label="In proc." count={counts.inProcess} tone="inProcess" compact={compact} inverted={inverted} />
      ) : null}
      {showClosed ? (
        <QueryBadge label="Closed" count={counts.closed} tone="closed" compact={compact} inverted={inverted} />
      ) : null}
    </div>
  )
}
