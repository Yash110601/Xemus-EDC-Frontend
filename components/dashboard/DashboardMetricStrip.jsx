"use client"

import DashboardGlowFrame from "@/components/dashboard/DashboardGlowFrame"
import { getDashboardMetricIcon } from "@/lib/dashboard/dashboardMetricIcons"
import { getDashboardMetricTheme } from "@/lib/dashboard/dashboardMetricThemes"
import { DASHBOARD_METRIC_GRID_CLASS } from "@/lib/ui/dashboardUi"
import { cn } from "@/lib/utils"

export default function DashboardMetricStrip({
  metrics = [],
  className,
  onMetricClick,
  activeLensKey = null,
  interactive = true,
}) {
  if (!metrics.length) return null

  return (
    <div className={cn(DASHBOARD_METRIC_GRID_CLASS, className)} role="list" aria-label="Dashboard metrics">
      {metrics.map((metric, index) => {
        const theme = getDashboardMetricTheme(metric.key)
        const Icon = getDashboardMetricIcon(metric.key)
        const isActive = interactive && activeLensKey === metric.key

        return (
          <DashboardGlowFrame
            key={metric.key}
            as={interactive ? "button" : "div"}
            type={interactive ? "button" : undefined}
            role="listitem"
            interactive={interactive}
            active={isActive}
            accent={theme.accent}
            onClick={interactive ? () => onMetricClick?.(metric.key) : undefined}
            className={cn("novera-dashboard-metric min-w-0 text-left")}
            innerClassName={cn(
              "border-[#E5EBE9] bg-white px-5 py-[18px]",
              "shadow-[0_1px_2px_rgba(15,27,23,.04),0_12px_32px_-12px_rgba(15,27,23,.10)]",
              isActive && theme.innerActive,
            )}
            style={{ animationDelay: `${index * 60}ms` }}
            aria-label={
              interactive
                ? `${metric.label}: ${metric.value}. Open command lens.`
                : `${metric.label}: ${metric.value}`
            }
            aria-pressed={interactive ? isActive : undefined}
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-[#7C8B85]">{metric.label}</span>
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[#F1FAF5] text-[#047857]">
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
            </div>
            <p className="text-[30px] font-bold leading-none tracking-tight text-[#0F1B17] tabular-nums">
              {metric.value}
            </p>
            {interactive && isActive ? (
              <p className={cn("mt-2 text-[10px] font-semibold", theme.hint)}>Lens open</p>
            ) : null}
          </DashboardGlowFrame>
        )
      })}
    </div>
  )
}
