"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  NOVERA_CHART,
  NOVERA_CHART_MARGIN,
  NOVERA_SERIES,
  NOVERA_TOOLTIP_STYLE,
  normalizeChartColor,
  pickSeriesColor,
} from "@/lib/ui/dashboardChartDesign"
import { NoveraChartEmpty, NoveraSegmentBreakdown } from "@/components/dashboard/NoveraChartPrimitives"
import { cn } from "@/lib/utils"
import { resolveTotalSubjectsCounts } from "@/lib/utils/totalSubjectsExport"

const COLORS = {
  primary: [NOVERA_SERIES[3].main, NOVERA_SERIES[0].main, NOVERA_SERIES[1].main],
  success: [NOVERA_CHART.emerald, NOVERA_CHART.emeraldLight, "#6ee7b7"],
  warning: [NOVERA_CHART.amber, "#fbbf24", "#fcd34d"],
  danger: [NOVERA_CHART.rose, "#f87171", "#fda4af"],
  purple: [NOVERA_SERIES[1].main, NOVERA_SERIES[1].light, NOVERA_SERIES[2].light],
  cyan: [NOVERA_CHART.cyan, "#22d3ee", "#67e8f9"],
  gray: ["#64748b", "#94a3b8", "#cbd5e1"],
}

const MacGlassTooltipBox = {
  backgroundColor: "rgba(255, 255, 255, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.85)",
  borderRadius: "14px",
  padding: "10px 12px",
  boxShadow: "0 18px 40px -22px rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(12px)",
}

/** Estimated tooltip size — used when placing outside the donut ring */
const DONUT_TOOLTIP_EST_WIDTH = 112
const DONUT_TOOLTIP_EST_HEIGHT = 56

/** Place hover tooltip outside the ring on the active slice radial */
function donutChartTooltipOutsideRingPosition(
  coordinate,
  _activeIndex,
  _activePayload,
  _labelList,
  _nameKey,
  _dataKey,
  props
) {
  const viewBox = props?.viewBox
  if (!viewBox || typeof viewBox.width !== "number") {
    return { x: 12, y: 12 }
  }

  const cx = viewBox.x + viewBox.width / 2
  const cy = viewBox.y + viewBox.height / 2
  const minDim = Math.min(viewBox.width, viewBox.height)
  const half = minDim / 2

  let dx = (coordinate?.x ?? cx) - cx
  let dy = (coordinate?.y ?? cy) - cy
  if (Math.hypot(dx, dy) < 4) {
    dx = -0.65
    dy = -0.75
  }
  const angle = Math.atan2(dy, dx)
  const nx = Math.cos(angle)
  const ny = Math.sin(angle)

  const outerRadius = half * 0.82
  const gapPastRing = 18
  const placeRadius =
    outerRadius + gapPastRing + Math.max(DONUT_TOOLTIP_EST_WIDTH, DONUT_TOOLTIP_EST_HEIGHT) / 2

  const anchorX = cx + nx * placeRadius
  const anchorY = cy + ny * placeRadius

  let x = anchorX - DONUT_TOOLTIP_EST_WIDTH / 2
  let y = anchorY - DONUT_TOOLTIP_EST_HEIGHT / 2

  const maxX = viewBox.x + viewBox.width - DONUT_TOOLTIP_EST_WIDTH - 2
  const maxY = viewBox.y + viewBox.height - DONUT_TOOLTIP_EST_HEIGHT - 2
  if (x > maxX) x = maxX
  if (y > maxY) y = maxY

  return { x, y }
}

const donutChartTooltipProps = {
  position: donutChartTooltipOutsideRingPosition,
  allowEscapeViewBox: { x: true, y: true },
  wrapperStyle: { pointerEvents: "none", zIndex: 30, outline: "none" },
  cursor: { fill: "transparent" },
  isAnimationActive: false,
}

/** Plot margin — room for outside-ring tooltips without shrinking the donut too much */
const DONUT_CHART_PLOT_MARGIN = { top: 24, right: 24, left: 24, bottom: 20 }

function DonutSliceGlassTooltip({ active, payload, total, unitLabel, showPercent = false }) {
  if (!active || !payload?.length) return null
  const row = payload[0]
  const item = row?.payload
  if (!item) return null
  const value = Number(row.value ?? item.value ?? 0)
  const sliceColor = item.color || item.gradBottom || row.color || row.fill
  const percent =
    total > 0 ? ((value / total) * 100).toFixed(1) : value > 0 ? "100.0" : "0.0"

  return (
    <div className="w-[112px] rounded-2xl border border-white/85 bg-white/92 px-3 py-2 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.45)] backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
          style={{ backgroundColor: sliceColor }}
        />
        <span className="truncate text-sm font-semibold text-slate-800">{item.name ?? row.name}</span>
      </div>
      <p className="mt-1 text-lg font-bold leading-none tabular-nums tracking-tight text-slate-900">
        {value}
        {unitLabel ? (
          <span className="ml-1 text-xs font-medium text-slate-500">{unitLabel}</span>
        ) : null}
      </p>
      {showPercent ? <p className="mt-0.5 text-xs text-slate-500">{percent}%</p> : null}
    </div>
  )
}

function PlannedVsActualGlassTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-2xl border border-white/80 bg-white/90 px-3.5 py-2.5 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.45)] backdrop-blur-md"
      style={{ backdropFilter: "blur(12px)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const MAC_CHART_AXIS = {
  tick: { fill: "#64748b", fontSize: 12, fontWeight: 500 },
  axisLine: { stroke: "rgba(148, 163, 184, 0.32)" },
}

/** Soft inner plot area — no dark outline box */
const macChartPlotArea = "flex min-h-0 flex-1 flex-col rounded-xl bg-white/20 p-1 sm:p-2"

/** CRA fill charts: use full panel width (no narrow cap) */
const CRA_FILL_CHART_SHELL = "flex h-full w-full min-h-0 flex-1 flex-col"

function MacFixedLegend({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/40 pt-3">
      {items.map((item) => (
        <div
          key={item.name}
          className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-slate-600"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-white"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.name}</span>
        </div>
      ))}
    </div>
  )
}

function MacDotLegend({ payload, colorMap }) {
  if (colorMap && typeof colorMap === "object") {
    const items = Object.entries(colorMap).map(([name, color]) => ({ name, color }))
    return <MacFixedLegend items={items} />
  }
  if (!Array.isArray(payload) || payload.length === 0) return null
  return (
    <MacFixedLegend
      items={payload.map((entry) => ({
        name: entry.value,
        color: entry.payload?.color || entry.color,
      }))}
    />
  )
}

function MacBarGradients({ idPrefix, series }) {
  return (
    <defs>
      {series.map(({ key, top, bottom }) => (
        <linearGradient key={key} id={`${idPrefix}-${key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} stopOpacity={0.95} />
          <stop offset="100%" stopColor={bottom} stopOpacity={1} />
        </linearGradient>
      ))}
    </defs>
  )
}

// Planned vs Actual — smooth dual-area chart (replaces vertical bar pairs)
export function StudyCountsBarChart({ data, size = "default" }) {
  const isHero = size === "hero"
  const isFill = size === "fill"
  const chartHeight = isFill ? "100%" : isHero ? 380 : 280

  if (!data?.studiesByMonth?.length) {
    return (
      <NoveraChartEmpty
        message="No data available"
        hint="Enrollment trend will appear here for your study."
        height={isFill ? 240 : chartHeight}
      />
    )
  }

  const chartShellClass = isFill
    ? "flex min-h-0 w-full flex-1 flex-col"
    : "flex w-full flex-col"

  return (
    <div className={chartShellClass}>
      <ResponsiveContainer width="100%" height={chartHeight}>
      <ComposedChart data={data.studiesByMonth} margin={{ ...NOVERA_CHART_MARGIN, left: 4 }}>
        <defs>
          <linearGradient id="novera-planned-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NOVERA_SERIES[3].main} stopOpacity={0.35} />
            <stop offset="100%" stopColor={NOVERA_SERIES[3].main} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="novera-actual-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NOVERA_CHART.emerald} stopOpacity={0.4} />
            <stop offset="100%" stopColor={NOVERA_CHART.emerald} stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="novera-completed-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke={NOVERA_CHART.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fill: NOVERA_CHART.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: NOVERA_CHART.axis, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <Tooltip content={<PlannedVsActualGlassTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
        <Area type="monotone" dataKey="planned" name="Planned" stroke={NOVERA_SERIES[3].main} strokeWidth={2.5} fill="url(#novera-planned-fill)" dot={false} activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="actual" name="Actual" stroke={NOVERA_CHART.emerald} strokeWidth={2.5} fill="url(#novera-actual-fill)" dot={false} activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="completed" name="Completed" stroke="#7c3aed" strokeWidth={2.5} fill="url(#novera-completed-fill)" dot={false} activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  )
}

const SITE_PATIENT_CHART_SWIPE_THRESHOLD = 48

function orderSitesWithPreferredFirst(rows, preferredSiteId) {
  if (!preferredSiteId || rows.length <= 1) return rows
  const prefKey = String(preferredSiteId)
  const matchIndex = rows.findIndex((row) => String(row.siteId) === prefKey)
  if (matchIndex <= 0) return rows
  const reordered = [...rows]
  const [preferred] = reordered.splice(matchIndex, 1)
  reordered.unshift(preferred)
  return reordered
}

// CRA dashboard: patient enrollment by assigned site (planned / enrolled / pending)
export function SitePatientEnrollmentBarChart({
  sites = [],
  size = "default",
  sitesPerPage = 3,
  preferredSiteId = null,
  /** @type {"enrollment"|"totalSubjects"} */
  variant = "enrollment",
  stacked: stackedProp,
  onStackedChange,
  showStackToggle = false,
}) {
  const isFill = size === "fill"
  const isHero = size === "hero"
  const chartHeight = isFill ? "100%" : isHero ? 320 : 280
  const touchStartXRef = useRef(null)
  const [page, setPage] = useState(0)
  const [stackedInternal, setStackedInternal] = useState(false)
  const isTotalSubjects = variant === "totalSubjects"
  const stacked =
    typeof stackedProp === "boolean" ? stackedProp : stackedInternal
  const setStacked = (next) => {
    if (typeof onStackedChange === "function") onStackedChange(next)
    else setStackedInternal(next)
  }

  const allChartData = useMemo(
    () =>
      (Array.isArray(sites) ? sites : [])
        .map((site) => {
          const siteId = site?.siteId ?? site?.id ?? site?.SiteId ?? null
          const siteName =
            String(site?.siteName || site?.SiteName || site?.name || "Site").trim().slice(0, 18) ||
            "Site"
          if (isTotalSubjects) {
            const counts = resolveTotalSubjectsCounts(site)
            return {
              siteId,
              site: siteName,
              screened: counts.screened,
              screenFailed: counts.screenFailed,
              enrolled: counts.enrolled,
              discontinued: counts.discontinued,
              completed: counts.completed,
              planned: counts.planned,
              totalEnrolled: counts.totalEnrolled,
            }
          }
          return {
            siteId,
            site: siteName.slice(0, 14),
            planned: Number(site?.plannedPatients) || 0,
            enrolled: Number(site?.enrolledPatients) || 0,
            pending: Number(site?.pendingPatients) || 0,
            completed: Number(site?.completedPatients) || 0,
          }
        })
        .filter((row) => {
          // Total Subjects: keep every site returned by the API (empty bars beat a blank panel).
          if (isTotalSubjects) return true
          return row.planned > 0 || row.enrolled > 0 || row.pending > 0 || row.completed > 0
        }),
    [sites, isTotalSubjects],
  )

  const orderedChartData = useMemo(
    () => orderSitesWithPreferredFirst(allChartData, preferredSiteId),
    [allChartData, preferredSiteId],
  )

  const pageSize = Math.max(1, Number(sitesPerPage) || 3)
  const totalPages = Math.max(1, Math.ceil(orderedChartData.length / pageSize))

  useEffect(() => {
    setPage(0)
  }, [preferredSiteId, orderedChartData.length, pageSize])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1))
  }, [totalPages])

  const chartData = useMemo(() => {
    const start = page * pageSize
    return orderedChartData.slice(start, start + pageSize)
  }, [orderedChartData, page, pageSize])

  const goToPrevPage = () => setPage((current) => Math.max(0, current - 1))
  const goToNextPage = () => setPage((current) => Math.min(totalPages - 1, current + 1))

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (event) => {
    if (touchStartXRef.current == null) return
    const endX = event.changedTouches[0]?.clientX
    if (endX == null) return
    const delta = endX - touchStartXRef.current
    touchStartXRef.current = null
    if (Math.abs(delta) < SITE_PATIENT_CHART_SWIPE_THRESHOLD) return
    if (delta < 0) goToNextPage()
    else goToPrevPage()
  }

  if (orderedChartData.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center text-slate-500 ${
          isFill ? "h-full min-h-[240px]" : isHero ? "h-[320px]" : "h-[280px]"
        }`}
      >
        <p className="text-sm font-medium tracking-tight">No site enrollment data</p>
        <p className="mt-1 text-xs text-slate-400">
          {isTotalSubjects
            ? "Total subjects by site will appear here."
            : "Patient status by site will appear here."}
        </p>
      </div>
    )
  }

  const barSeries = isTotalSubjects
    ? [
        { key: "screened", top: "#93c5fd", bottom: "#3b82f6", name: "Screened", color: "#3b82f6" },
        { key: "screenFailed", top: "#86efac", bottom: "#22c55e", name: "Screen Failed", color: "#22c55e" },
        { key: "enrolled", top: "#fdba74", bottom: "#c2410c", name: "Enrolled", color: "#c2410c" },
        { key: "discontinued", top: "#fca5a5", bottom: "#b91c1c", name: "Discontinued", color: "#b91c1c" },
        { key: "completed", top: "#c4b5fd", bottom: "#7c3aed", name: "Completed", color: "#7c3aed" },
      ]
    : [
        { key: "planned", top: NOVERA_SERIES[3].light, bottom: NOVERA_SERIES[3].main, name: "Planned", color: NOVERA_SERIES[3].main },
        { key: "enrolled", top: NOVERA_CHART.emeraldLight, bottom: NOVERA_CHART.emerald, name: "Enrolled", color: NOVERA_CHART.emerald },
        { key: "pending", top: "#fcd34d", bottom: NOVERA_CHART.amber, name: "Pending", color: NOVERA_CHART.amber },
        { key: "completed", top: "#ddd6fe", bottom: "#7c3aed", name: "Completed", color: "#7c3aed" },
      ]
  const gradientPrefix = isTotalSubjects ? "total-subjects" : "site-patient"
  const siteCount = chartData.length
  const isWideFill = isFill && pageSize >= 5
  const fillMaxBarSize = Math.min(
    isTotalSubjects ? (isWideFill ? 72 : 80) : isWideFill ? 52 : 56,
    Math.round((isTotalSubjects ? (isWideFill ? 520 : 400) : isWideFill ? 420 : 300) / Math.max(siteCount, 1)),
  )
  const showPagination = totalPages > 1
  const pageStart = page * pageSize + 1
  const pageEnd = Math.min((page + 1) * pageSize, orderedChartData.length)
  const showToggle = showStackToggle || isTotalSubjects

  const chartShellClass = isFill
    ? CRA_FILL_CHART_SHELL
    : isHero
      ? "flex min-h-0 w-full flex-1 flex-col"
      : "flex w-full flex-col"

  return (
    <div
      className={
        isFill
          ? CRA_FILL_CHART_SHELL
          : isHero
            ? `h-full min-h-[240px] w-full ${macChartPlotArea}`
            : "flex h-full min-h-[240px] w-full flex-col"
      }
    >
      {showToggle ? (
        <div className="mb-2 flex shrink-0 items-center justify-end gap-1">
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="group"
            aria-label="Bar layout"
          >
            <button
              type="button"
              onClick={() => setStacked(true)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                stacked
                  ? "bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              Stack
            </button>
            <button
              type="button"
              onClick={() => setStacked(false)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                !stacked
                  ? "bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              Unstack
            </button>
          </div>
        </div>
      ) : null}
      <div className={chartShellClass}>
        <div
          className={`relative min-w-0 w-full outline-none ${
            isFill || isHero
              ? isTotalSubjects
                ? "min-h-[320px] flex-1"
                : "min-h-[200px] flex-1"
              : "h-[220px]"
          } [&_.recharts-responsive-container]:outline-none [&_.recharts-surface]:outline-none [&_svg]:outline-none`}
          onTouchStart={showPagination ? handleTouchStart : undefined}
          onTouchEnd={showPagination ? handleTouchEnd : undefined}
        >
          {showPagination ? (
            <>
              <button
                type="button"
                onClick={goToPrevPage}
                disabled={page === 0}
                aria-label="Previous sites"
                className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToNextPage}
                disabled={page >= totalPages - 1}
                aria-label="Next sites"
                className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
          <ResponsiveContainer
            width="100%"
            height={isFill || isHero ? "100%" : chartHeight}
            minWidth={0}
            minHeight={isFill || isHero ? (isTotalSubjects ? 320 : 200) : undefined}
          >
            <BarChart
              data={chartData}
              margin={
                isFill
                  ? { top: 16, right: showPagination ? 28 : 16, left: showPagination ? 28 : 2, bottom: 4 }
                  : { top: 12, right: showPagination ? 28 : 14, left: showPagination ? 28 : 0, bottom: 4 }
              }
              barGap={stacked ? 0 : 6}
              barCategoryGap={
                isWideFill ? "10%" : isFill ? (siteCount >= 4 ? "14%" : "20%") : "24%"
              }
              style={{ outline: "none" }}
            >
              <MacBarGradients idPrefix={gradientPrefix} series={barSeries} />
              <CartesianGrid strokeDasharray="4 8" stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
              <XAxis
                dataKey="site"
                tick={MAC_CHART_AXIS.tick}
                tickLine={false}
                axisLine={false}
                dy={6}
              />
              <YAxis
                tick={MAC_CHART_AXIS.tick}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={36}
              />
              <Tooltip content={<PlannedVsActualGlassTooltip />} cursor={{ fill: "rgba(16, 185, 129, 0.06)", radius: 10 }} />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="circle"
                wrapperStyle={{ fontSize: 11, color: "#475569" }}
              />
              {barSeries.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.name}
                  fill={`url(#${gradientPrefix}-${s.key})`}
                  stackId={stacked ? "totalSubjects" : undefined}
                  radius={stacked ? [0, 0, 0, 0] : [10, 10, 0, 0]}
                  maxBarSize={isFill ? fillMaxBarSize : 40}
                >
                  {isTotalSubjects && !stacked ? (
                    <LabelList
                      dataKey={s.key}
                      position="top"
                      className="fill-slate-600 text-[10px] font-semibold"
                      formatter={(value) => (Number(value) > 0 ? value : "")}
                    />
                  ) : null}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {showPagination ? (
          <div className="mt-1 flex shrink-0 items-center justify-center gap-2 px-1">
            <span className="text-[11px] font-medium tabular-nums text-slate-500">
              Sites {pageStart}-{pageEnd} of {orderedChartData.length}
            </span>
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Site chart pages">
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={`site-page-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={index === page}
                  aria-label={`Show sites page ${index + 1}`}
                  onClick={() => setPage(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === page ? "w-4 bg-sky-500" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : null}
        <MacFixedLegend items={barSeries.map((s) => ({ name: s.name, color: s.color }))} />
      </div>
    </div>
  )
}

// Multi-CRF Role Progress - exactly 4 bars (Planned, Enrolled, Endoscopist, Pathologist)
export function MultiCrfRoleProgressBarChart({
  planned = 0,
  enrolled = 0,
  endoscopist = 0,
  pathologist = 0,
}) {
  const plannedBase = Number(planned) || 0
  const chartData = [
    { name: "Planned", value: Number(planned) || 0, color: NOVERA_SERIES[3].main },
    { name: "Enrolled", value: Number(enrolled) || 0, color: NOVERA_CHART.emerald },
    { name: "Endoscopist", value: Number(endoscopist) || 0, color: NOVERA_CHART.cyan },
    { name: "Pathologist", value: Number(pathologist) || 0, color: NOVERA_CHART.rose },
  ]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart layout="vertical" data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 6" stroke={NOVERA_CHART.grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: NOVERA_CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={96} tick={{ fill: "#475569", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={NOVERA_TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22}>
          {chartData.map((entry, i) => (
            <Cell key={entry.name} fill={normalizeChartColor(entry.color, i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Multi-CRF Role Progress - Pie/Donut chart (Planned, Enrolled, Endoscopist, Pathologist)
export function MultiCrfRoleProgressPieChart({
  planned = 0,
  enrolled = 0,
  endoscopist = 0,
  pathologist = 0,
}) {
  const pieData = [
    { name: "Planned", value: Number(planned) || 0, color: "#6366f1" },
    { name: "Enrolled", value: Number(enrolled) || 0, color: "#10b981" },
    { name: "Endoscopist", value: Number(endoscopist) || 0, color: "#0ea5e9" },
    { name: "Pathologist", value: Number(pathologist) || 0, color: "#ef4444" },
  ]

  const total = pieData.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-slate-500">No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Tooltip
          content={<DonutSliceGlassTooltip total={total} showPercent />}
          {...donutChartTooltipProps}
        />
        <Legend />
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="48%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={2}
          stroke="#ffffff"
          strokeWidth={2}
        >
          {pieData.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}

// Query Management Pie Chart (backend counts)
// Expects either:
// - counts: { open, inProcess, closed, totalQueries? }
// - systemCounts: same shape (used as fallback if counts missing)
export function QueryManagementPieChart({ counts, systemCounts, size = "default" }) {
  const src = counts || systemCounts || {}
  const open = Number(src.open ?? 0)
  const inProcess = Number(src.inProcess ?? 0)
  const closed = Number(src.closed ?? 0)
  const total = Number(src.totalQueries ?? open + inProcess + closed)
  const isFill = size === "fill"

  const queryData = [
    { name: "Closed", value: closed, color: NOVERA_CHART.emerald },
    { name: "In Process", value: inProcess, color: NOVERA_CHART.cyan },
    { name: "Open", value: open, color: NOVERA_CHART.amber },
  ]

  if (total <= 0) {
    return (
      <NoveraChartEmpty
        message="No query data"
        hint="Query breakdown will appear here."
        height={isFill ? 240 : 320}
      />
    )
  }

  return (
    <div className={isFill ? CRA_FILL_CHART_SHELL : "w-full"}>
      <NoveraSegmentBreakdown
        items={queryData}
        total={total}
        centerLabel="Total Queries"
        height={isFill ? 280 : 320}
      />
    </div>
  )
}

export function StudyCountsPieChart({ data }) {
  if (!data?.studiesByStatus?.length) {
    return <NoveraChartEmpty message="No data available" height={280} />
  }

  const items = data.studiesByStatus.map((entry, i) => ({
    name: entry.name,
    value: entry.value,
    color: normalizeChartColor(entry.color, i),
  }))
  const total = items.reduce((sum, entry) => sum + entry.value, 0)

  return (
    <NoveraSegmentBreakdown
      items={items}
      total={total}
      unitLabel="studies"
      centerLabel="Total Studies"
      height={300}
    />
  )
}

// User Counts Bar Chart
export function UserCountsBarChart({ data }) {
  if (!data || !data.usersByMonth) return null

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data.usersByMonth}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
        <YAxis stroke="#64748b" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "8px",
          }}
        />
        <Legend />
        <Bar dataKey="count" fill="#06b6d4" radius={[8, 8, 0, 0]} name="Users" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function UserCountsPieChart({ data }) {
  if (!data?.usersByRole?.length) {
    return <NoveraChartEmpty message="No data available" height={280} />
  }

  const items = data.usersByRole.map((entry, i) => ({
    name: entry.name,
    value: entry.value,
    color: normalizeChartColor(entry.color, i),
  }))
  const total = data.totalUsers || items.reduce((sum, entry) => sum + entry.value, 0)

  return (
    <NoveraSegmentBreakdown
      items={items}
      total={total}
      unitLabel="users"
      centerLabel="Total Users"
      height={300}
    />
  )
}

// Study, Site & Patient Trends Line Chart
export function StudySitePatientTrendsChart({ data }) {
  if (!data || !data.trendsByMonth || data.trendsByMonth.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No data available
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 backdrop-blur-sm">
          <p className="text-sm font-semibold text-slate-900 mb-2">
            {payload[0]?.payload?.month || ""}
          </p>
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-slate-600">
                  <span className="font-semibold">{entry.name}:</span>{" "}
                  <span className="font-bold text-slate-900">{entry.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data.trendsByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="month" 
          stroke="#64748b" 
          fontSize={12}
          tick={{ fill: "#64748b" }}
        />
        <YAxis 
          stroke="#64748b" 
          fontSize={12}
          tick={{ fill: "#64748b" }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ paddingTop: "20px" }}
          iconType="line"
        />
        <Line
          type="monotone"
          dataKey="studies"
          stroke="#6366f1"
          strokeWidth={3}
          dot={{ fill: "#6366f1", r: 5 }}
          activeDot={{ r: 7 }}
          name="Studies"
        />
        <Line
          type="monotone"
          dataKey="sites"
          stroke="#8b5cf6"
          strokeWidth={3}
          dot={{ fill: "#8b5cf6", r: 5 }}
          activeDot={{ r: 7 }}
          name="Sites"
        />
        <Line
          type="monotone"
          dataKey="patients"
          stroke="#10b981"
          strokeWidth={3}
          dot={{ fill: "#10b981", r: 5 }}
          activeDot={{ r: 7 }}
          name="Patients"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// User Status Pie Chart
export function UserStatusPieChart({ data }) {
  if (!data || !data.usersByStatus) return null

  const total = data.usersByStatus.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0)

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data.usersByStatus}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {data.usersByStatus.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || COLORS.primary[index % COLORS.primary.length]} />
          ))}
        </Pie>
        <Tooltip
          content={<DonutSliceGlassTooltip total={total} unitLabel="users" showPercent />}
          {...donutChartTooltipProps}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span style={{ color: "#64748b", fontSize: "12px" }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Reports Exported Bar Chart
export function ReportsExportedChart({ data }) {
  if (!data || !data.reportsExported || data.reportsExported.length === 0) {
    // Generate dummy data if none available
    const currentDate = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      months.push({
        month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
        count: 15 + (5 - i) * 5,
      })
    }
    data = { reportsExported: months }
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data.reportsExported} margin={NOVERA_CHART_MARGIN}>
        <defs>
          <linearGradient id="novera-reports-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NOVERA_CHART.teal} stopOpacity={0.35} />
            <stop offset="100%" stopColor={NOVERA_CHART.teal} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke={NOVERA_CHART.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fill: NOVERA_CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: NOVERA_CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip contentStyle={NOVERA_TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="count" name="Reports Exported" stroke={NOVERA_CHART.teal} strokeWidth={2.5} fill="url(#novera-reports-fill)" dot={{ r: 3, fill: NOVERA_CHART.teal }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Visit Bar Chart – uses only API data (user-scoped); shows Visit only.
export function ScreeningBaselineVisitChart({ data }) {
  if (!data || !data.screeningBaselineVisit || data.screeningBaselineVisit.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-slate-500">
        <p className="text-sm font-medium">No data available</p>
        <p className="text-xs mt-1">Visit data will appear here for your studies.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data.screeningBaselineVisit} margin={NOVERA_CHART_MARGIN}>
        <defs>
          <linearGradient id="novera-visit-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NOVERA_CHART.emerald} stopOpacity={0.3} />
            <stop offset="100%" stopColor={NOVERA_CHART.emerald} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke={NOVERA_CHART.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fill: NOVERA_CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: NOVERA_CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip contentStyle={NOVERA_TOOLTIP_STYLE} />
        <Legend iconType="circle" iconSize={8} />
        <Area type="monotone" dataKey="visit" name="Visit" stroke={NOVERA_CHART.emerald} strokeWidth={2} fill="url(#novera-visit-fill)" />
        <Line type="monotone" dataKey="visit" stroke={NOVERA_SERIES[3].main} strokeWidth={2.5} dot={{ r: 4, fill: NOVERA_SERIES[3].main }} activeDot={{ r: 6 }} legendType="none" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// Study Open/Close Chart
export function StudyOpenCloseChart({ data }) {
  if (!data || !data.studyOpenClose || data.studyOpenClose.length === 0) {
    // Generate dummy data if none available
    const currentDate = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      months.push({
        month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
        opened: 3 + (5 - i),
        closed: 1 + Math.floor((5 - i) / 2),
      })
    }
    data = { studyOpenClose: months }
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data.studyOpenClose} margin={NOVERA_CHART_MARGIN} barGap={6} barCategoryGap="22%">
        <CartesianGrid strokeDasharray="3 6" stroke={NOVERA_CHART.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fill: NOVERA_CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: NOVERA_CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip content={<PlannedVsActualGlassTooltip />} />
        <Legend iconType="circle" iconSize={8} />
        <Bar dataKey="opened" name="Opened" fill={NOVERA_CHART.emerald} radius={[6, 6, 0, 0]} maxBarSize={36} />
        <Bar dataKey="closed" name="Closed" fill={NOVERA_CHART.rose} radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CRFDataEntryChart({ data }) {
  const rows =
    data?.crfDataEntry?.length > 0
      ? data.crfDataEntry
      : [
          { name: "Manual", value: 120, color: NOVERA_SERIES[3].main },
          { name: "AI", value: 85, color: NOVERA_CHART.teal },
          { name: "VoiceToText", value: 45, color: NOVERA_CHART.emerald },
        ]

  const items = rows.map((entry, i) => ({
    name: entry.name,
    value: entry.value,
    color: normalizeChartColor(entry.color, i),
  }))
  const total = items.reduce((sum, entry) => sum + entry.value, 0)

  return (
    <NoveraSegmentBreakdown
      items={items}
      total={total}
      unitLabel="entries"
      centerLabel="Total Entries"
      height={300}
    />
  )
}

