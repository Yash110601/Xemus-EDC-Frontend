import { cn } from "@/lib/utils"

export const DASHBOARD_SHELL_CLASS = "novera-dashboard space-y-8"

export const DASHBOARD_BENTO_CLASS = "grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-10"

export const DASHBOARD_CRA_GRID_CLASS =
  "grid min-h-0 w-full flex-1 grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6"

/** CRC / PI: Planned vs Actual + Patient Status on one balanced row */
export const DASHBOARD_CRC_ENROLLMENT_GRID_CLASS =
  "grid grid-cols-1 items-stretch gap-5 xl:grid-cols-12 xl:gap-6"

export const DASHBOARD_CRC_PAIR_CHART_CLASS =
  "flex min-h-[clamp(300px,38vh,420px)] flex-col"

export const DASHBOARD_CHART_SECTION_CLASS = "novera-dashboard-chart-section min-w-0"

export const DASHBOARD_CHART_HEADER_CLASS =
  "flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/90 bg-slate-50/40 px-5 py-3.5"

export const DASHBOARD_CHART_BODY_CLASS = "relative min-h-0 p-5 sm:p-6"

/** @deprecated Hero is flat header now */
export const DASHBOARD_HERO_CLASS = "novera-dashboard-header"

export const DASHBOARD_METRIC_GRID_CLASS = cn(
  "grid gap-4",
  "grid-cols-2 md:grid-cols-4",
)

export const DASHBOARD_METRIC_STRIP_CLASS = DASHBOARD_METRIC_GRID_CLASS

/** @deprecated Use DASHBOARD_CHART_SECTION_CLASS */
export const DASHBOARD_CHART_CARD_CLASS = DASHBOARD_CHART_SECTION_CLASS
