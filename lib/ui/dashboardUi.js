import { cn } from "@/lib/utils"

export const DASHBOARD_SHELL_CLASS =
  "novera-dashboard space-y-7 rounded-[28px] border border-[#e4dcf2]/85 bg-[radial-gradient(ellipse_80%_55%_at_0%_0%,rgba(167,139,250,0.12),transparent_55%),radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(124,107,181,0.08),transparent_50%),linear-gradient(180deg,#fcfbfe_0%,#f5f1fb_100%)] p-4 sm:p-6"

export const DASHBOARD_BENTO_CLASS = "grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-7"

/** Admin studio: hero Total Subjects + CRF side panel */
export const DASHBOARD_STUDIO_HERO_CLASS =
  "grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12 lg:gap-6"

export const DASHBOARD_STUDIO_HERO_MAIN_CLASS =
  "flex min-h-[clamp(420px,58vh,760px)] flex-col lg:col-span-8"

export const DASHBOARD_STUDIO_HERO_SIDE_CLASS =
  "flex min-h-[clamp(280px,40vh,760px)] flex-col lg:col-span-4"

/** Admin studio: stacked analytics (8) + slim rail (4) */
export const DASHBOARD_STUDIO_BODY_CLASS =
  "grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6"

export const DASHBOARD_STUDIO_STACK_CLASS =
  "flex min-w-0 flex-col gap-5 lg:col-span-8"

export const DASHBOARD_STUDIO_RAIL_CLASS =
  "flex min-w-0 flex-col gap-4 lg:col-span-4"

export const DASHBOARD_STUDIO_GROUP_CLASS =
  "overflow-hidden rounded-[24px] border border-[#E4DCF2]/95 bg-gradient-to-b from-white via-[#FCFBFE] to-[#F7F4FC]/80 shadow-[0_1px_0_rgba(255,255,255,.9)_inset,0_16px_40px_-24px_rgba(61,47,99,.22)]"

export const DASHBOARD_STUDIO_GROUP_DIVIDER_CLASS = "border-t border-[#EEE8F6]"

export const DASHBOARD_CRA_GRID_CLASS =
  "grid min-h-0 w-full flex-1 grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6"

/** CRC / PI: Planned vs Actual + Patient Status on one balanced row */
export const DASHBOARD_CRC_ENROLLMENT_GRID_CLASS =
  "grid grid-cols-1 items-stretch gap-5 xl:grid-cols-12 xl:gap-6"

export const DASHBOARD_CRC_PAIR_CHART_CLASS =
  "flex min-h-[clamp(300px,38vh,420px)] flex-col"

export const DASHBOARD_CHART_SECTION_CLASS = "novera-dashboard-chart-section min-w-0"

export const DASHBOARD_CHART_HEADER_CLASS =
  "flex flex-wrap items-center justify-between gap-3 border-b border-[#EEE8F6] bg-gradient-to-r from-[#F7F4FC]/90 via-white/60 to-[#F3EEF9]/70 px-5 py-3.5"

export const DASHBOARD_CHART_HEADER_PANEL_CLASS =
  "flex flex-wrap items-center justify-between gap-2 border-b border-[#EEE8F6]/90 px-4 py-3"

export const DASHBOARD_CHART_HEADER_RAIL_CLASS =
  "flex flex-wrap items-center justify-between gap-2 border-b border-[#EEE8F6]/80 px-3.5 py-2.5"

export const DASHBOARD_CHART_BODY_CLASS = "relative min-h-0 bg-white/70 p-5 sm:p-6"

export const DASHBOARD_CHART_BODY_PANEL_CLASS = "relative min-h-0 bg-transparent p-4 sm:p-5"

export const DASHBOARD_CHART_BODY_RAIL_CLASS = "relative min-h-0 bg-transparent p-3.5 sm:p-4"

/** @deprecated Hero is flat header now */
export const DASHBOARD_HERO_CLASS = "novera-dashboard-header"

/** Compact KPI ticker — horizontal wrap of inline chips */
export const DASHBOARD_METRIC_TICKER_CLASS = cn(
  "flex flex-wrap gap-2.5 rounded-[22px] border border-[#E4DCF2]/90 bg-[#F7F4FC]/55 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.75)]",
  "sm:flex-nowrap sm:overflow-x-auto sm:gap-2",
)

/** @deprecated Prefer DASHBOARD_METRIC_TICKER_CLASS */
export const DASHBOARD_METRIC_GRID_CLASS = DASHBOARD_METRIC_TICKER_CLASS

export const DASHBOARD_METRIC_STRIP_CLASS = DASHBOARD_METRIC_TICKER_CLASS

/** @deprecated Use DASHBOARD_CHART_SECTION_CLASS */
export const DASHBOARD_CHART_CARD_CLASS = DASHBOARD_CHART_SECTION_CLASS
