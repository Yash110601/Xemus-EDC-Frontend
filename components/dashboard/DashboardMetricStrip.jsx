"use client"

import { getDashboardMetricIcon } from "@/lib/dashboard/dashboardMetricIcons"
import { getDashboardMetricTheme } from "@/lib/dashboard/dashboardMetricThemes"
import { DASHBOARD_METRIC_TICKER_CLASS } from "@/lib/ui/dashboardUi"
import { cn } from "@/lib/utils"

/**
 * Compact horizontal KPI ticker (studio bento) — not a tall equal card grid.
 */
export default function DashboardMetricStrip({
  metrics = [],
  className,
  onMetricClick,
  activeLensKey = null,
  interactive = true,
}) {
  if (!metrics.length) return null

  return (
    <div
      className={cn(DASHBOARD_METRIC_TICKER_CLASS, className)}
      role="list"
      aria-label="Dashboard metrics"
    >
      {metrics.map((metric) => {
        const theme = getDashboardMetricTheme(metric.key)
        const Icon = getDashboardMetricIcon(metric.key)
        const isActive = interactive && activeLensKey === metric.key
        const Comp = interactive ? "button" : "div"

        return (
          <Comp
            key={metric.key}
            type={interactive ? "button" : undefined}
            role="listitem"
            onClick={interactive ? () => onMetricClick?.(metric.key) : undefined}
            aria-label={
              interactive
                ? `${metric.label}: ${metric.value}. Open command lens.`
                : `${metric.label}: ${metric.value}`
            }
            aria-pressed={interactive ? isActive : undefined}
            className={cn(
              "group relative flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200",
              "border-[#E4DCF2]/95 bg-white/80 shadow-[0_1px_0_rgba(255,255,255,.9)_inset]",
              interactive && "cursor-pointer hover:-translate-y-px hover:border-[#D9CFEC] hover:bg-[#FCFBFE] hover:shadow-[0_10px_24px_-18px_rgba(61,47,99,.28)]",
              interactive && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70",
              isActive && "border-[#C4B5E0] bg-gradient-to-br from-violet-50/95 via-white to-[#F7F4FC] shadow-[0_12px_28px_-16px_rgba(124,107,181,.35)]",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#5B4B8A]",
                isActive
                  ? "bg-gradient-to-br from-[#7C6BB5] to-[#3D2F63] text-white"
                  : "bg-gradient-to-br from-[#EDE7F6] to-[#DDD4F0]",
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8B7BA8]">
                {metric.label}
              </span>
              <span className="mt-0.5 block text-[20px] font-bold leading-none tracking-tight text-[#2D1C4E] tabular-nums">
                {metric.value}
              </span>
            </span>
            {interactive && isActive ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  theme.portalBadge,
                )}
              >
                Lens
              </span>
            ) : null}
          </Comp>
        )
      })}
    </div>
  )
}
