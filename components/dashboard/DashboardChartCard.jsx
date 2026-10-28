"use client"

import DashboardGlowFrame from "@/components/dashboard/DashboardGlowFrame"
import {
  DASHBOARD_CHART_BODY_CLASS,
  DASHBOARD_CHART_BODY_PANEL_CLASS,
  DASHBOARD_CHART_BODY_RAIL_CLASS,
  DASHBOARD_CHART_SECTION_CLASS,
  DASHBOARD_CHART_HEADER_CLASS,
  DASHBOARD_CHART_HEADER_PANEL_CLASS,
  DASHBOARD_CHART_HEADER_RAIL_CLASS,
} from "@/lib/ui/dashboardUi"
import { cn } from "@/lib/utils"

/**
 * @param {"default" | "panel" | "rail" | "embedded"} variant
 * - default: standalone glow card
 * - panel: denser studio panel (still own frame)
 * - rail: slim right-rail card
 * - embedded: no outer frame — for stacked group interiors (dividers only)
 */
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
  variant = "default",
}) {
  const isEmbedded = variant === "embedded"
  const isRail = variant === "rail"
  const isPanel = variant === "panel"

  const headerClass = isRail
    ? DASHBOARD_CHART_HEADER_RAIL_CLASS
    : isPanel || isEmbedded
      ? DASHBOARD_CHART_HEADER_PANEL_CLASS
      : DASHBOARD_CHART_HEADER_CLASS

  const bodyClass = isRail
    ? DASHBOARD_CHART_BODY_RAIL_CLASS
    : isPanel || isEmbedded
      ? DASHBOARD_CHART_BODY_PANEL_CLASS
      : DASHBOARD_CHART_BODY_CLASS

  const titleClass = cn(
    "flex items-center gap-2 font-semibold tracking-tight text-[#2D1C4E]",
    isRail ? "text-[12.5px]" : "text-[13.5px]",
    isEmbedded && "gap-2",
  )

  const content = (
    <>
      <div className={headerClass}>
        <h2 className={titleClass}>
          {Icon ? (
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#EDE7F6] to-[#DDD4F0] text-[#5B4B8A]",
                isRail ? "h-7 w-7" : "h-8 w-8",
              )}
            >
              <Icon className={isRail ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.1} aria-hidden />
            </span>
          ) : null}
          {title}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {badges ? <div className="flex flex-wrap items-center gap-3">{badges}</div> : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {subheader ? <div className="shrink-0">{subheader}</div> : null}
      <div className={cn(bodyClass, fill && "flex min-h-0 flex-1 flex-col", bodyClassName)}>
        {children}
      </div>
    </>
  )

  if (isEmbedded) {
    return (
      <section
        className={cn(
          DASHBOARD_CHART_SECTION_CLASS,
          fill && "flex min-h-0 flex-1 flex-col",
          className,
        )}
      >
        {content}
      </section>
    )
  }

  return (
    <DashboardGlowFrame
      as="section"
      className={cn(
        DASHBOARD_CHART_SECTION_CLASS,
        fill && "flex min-h-0 flex-1 flex-col",
        hero && "min-h-[320px] lg:min-h-[380px]",
        isRail && "rounded-[20px]",
        className,
      )}
      innerClassName={cn(
        fill && "flex min-h-0 flex-1 flex-col",
        "overflow-hidden border-[#E4DCF2]/95 bg-gradient-to-b from-white to-[#FCFBFE]",
        "shadow-[0_1px_0_rgba(255,255,255,.9)_inset,0_14px_36px_-22px_rgba(61,47,99,.2)]",
        isRail && "rounded-[calc(1.25rem-1px)]",
        isPanel && "rounded-[calc(1.375rem-1px)]",
      )}
    >
      {content}
    </DashboardGlowFrame>
  )
}

export function DashboardChartBadge({ label, value, tone = "violet" }) {
  const tones = {
    emerald: "text-[#5B4B8A]",
    amber: "text-amber-900",
    sky: "text-[#5B4B8A]",
    slate: "text-[#7C6F96]",
    violet: "text-[#3D2F63]",
  }
  return (
    <span className={cn("text-xs tabular-nums", tones[tone] ?? tones.violet)}>
      <span className="font-normal text-[#8B7BA8]">{label}</span>{" "}
      <span className="font-semibold">{value}</span>
    </span>
  )
}

export default DashboardChartSection
