"use client"

import DashboardGlowFrame from "@/components/dashboard/DashboardGlowFrame"
import {
  DASHBOARD_CHART_BODY_CLASS,
  DASHBOARD_CHART_SECTION_CLASS,
  DASHBOARD_CHART_HEADER_CLASS,
} from "@/lib/ui/dashboardUi"
import { cn } from "@/lib/utils"

export function DashboardChartSection({
  title,
  icon: Icon,
  children,
  badges,
  actions,
  subheader,
  className,
  bodyClassName,
  fill = false,
  hero = false,
}) {
  return (
    <DashboardGlowFrame
      as="section"
      className={cn(
        DASHBOARD_CHART_SECTION_CLASS,
        fill && "flex min-h-0 flex-1 flex-col",
        hero && "min-h-[320px] lg:min-h-[380px]",
        className
      )}
      innerClassName={cn(fill && "flex min-h-0 flex-1 flex-col", "overflow-hidden")}
    >
      <div className={DASHBOARD_CHART_HEADER_CLASS}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : null}
          {title}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {badges ? <div className="flex flex-wrap items-center gap-3">{badges}</div> : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {subheader ? <div className="shrink-0">{subheader}</div> : null}
      <div className={cn(DASHBOARD_CHART_BODY_CLASS, fill && "flex min-h-0 flex-1 flex-col", bodyClassName)}>
        {children}
      </div>
    </DashboardGlowFrame>
  )
}

export function DashboardChartBadge({ label, value, tone = "emerald" }) {
  const tones = {
    emerald: "text-emerald-800",
    amber: "text-amber-900",
    sky: "text-sky-900",
    slate: "text-slate-700",
    violet: "text-violet-900",
  }
  return (
    <span className={cn("text-xs tabular-nums", tones[tone] ?? tones.emerald)}>
      <span className="font-normal text-slate-500">{label}</span>{" "}
      <span className="font-semibold">{value}</span>
    </span>
  )
}

export default DashboardChartSection
