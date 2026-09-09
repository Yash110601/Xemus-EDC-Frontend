"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { NOVERA_CHART, NOVERA_CHART_MARGIN } from "@/lib/ui/dashboardChartDesign"
import { NoveraChartEmpty } from "@/components/dashboard/NoveraChartPrimitives"
import { cn } from "@/lib/utils"

const STATUS_SERIES = [
  { key: "pending", name: "Pending", color: "#f59e0b", top: "#fcd34d", bottom: "#f59e0b" },
  { key: "inProgress", name: "In progress", color: "#0ea5e9", top: "#7dd3fc", bottom: "#0ea5e9" },
  { key: "completed", name: "Completed", color: "#10b981", top: "#6ee7b7", bottom: "#10b981" },
]

const AXIS = {
  tick: { fill: "#64748b", fontSize: 11, fontWeight: 500 },
  axisLine: { stroke: "rgba(148, 163, 184, 0.32)" },
}

function truncateLabel(label, max = 20) {
  const text = String(label || "").trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function RsdvChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const fullLabel = payload[0]?.payload?.fullLabel
  return (
    <div className="rounded-2xl border border-white/80 bg-white/95 px-3.5 py-2.5 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.45)] backdrop-blur-md">
      <p className="max-w-[220px] truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {fullLabel || label}
      </p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StackToggle({ stacked, onChange }) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
      role="group"
      aria-label="Bar layout"
    >
      <button
        type="button"
        onClick={() => onChange(true)}
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
        onClick={() => onChange(false)}
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
  )
}

function BarGradients({ idPrefix }) {
  return (
    <defs>
      {STATUS_SERIES.map(({ key, top, bottom }) => (
        <linearGradient key={key} id={`${idPrefix}-${key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} stopOpacity={0.95} />
          <stop offset="100%" stopColor={bottom} stopOpacity={1} />
        </linearGradient>
      ))}
    </defs>
  )
}

export function RsdvStatusDonutChart({ totals, loading = false }) {
  const items = useMemo(
    () =>
      STATUS_SERIES.map((s) => ({
        name: s.name,
        value: Number(totals?.[s.key] ?? 0),
        color: s.color,
      })).filter((row) => row.value > 0),
    [totals],
  )
  const total = items.reduce((sum, row) => sum + row.value, 0)

  if (loading) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">Loading chart…</div>
    )
  }

  if (total <= 0) {
    return (
      <NoveraChartEmpty
        message="No reviews yet"
        hint="Status breakdown appears when RSDV reviews exist."
        height={280}
      />
    )
  }

  return (
    <div className="flex min-h-[260px] flex-col items-stretch gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-[200px] w-[200px] shrink-0 sm:mx-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={2}
            >
              {items.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [value, name]}
              contentStyle={{
                backgroundColor: "rgba(255,255,255,0.95)",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold tabular-nums text-slate-900">{total}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Total reviews</p>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {STATUS_SERIES.map((s) => {
          const value = Number(totals?.[s.key] ?? 0)
          const pct = total > 0 ? Math.round((value / total) * 100) : 0
          return (
            <li
              key={s.key}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 sm:px-4 sm:py-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <span className="truncate text-sm font-medium text-slate-700">{s.name}</span>
              </div>
              <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-lg font-bold text-slate-900">{value}</span>
                <span className="text-xs font-semibold text-slate-500">{pct}%</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function RsdvStudyStatusBarChart({ studyStats = [], loading = false }) {
  const [stacked, setStacked] = useState(true)

  const chartData = useMemo(
    () =>
      studyStats.map((row) => ({
        study: truncateLabel(row.label),
        fullLabel: row.label,
        pending: row.pending ?? 0,
        inProgress: row.inProgress ?? 0,
        completed: row.completed ?? 0,
      })),
    [studyStats],
  )

  const hasData = chartData.some((row) => row.pending + row.inProgress + row.completed > 0)

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">Loading chart…</div>
    )
  }

  if (!chartData.length || !hasData) {
    return (
      <NoveraChartEmpty
        message="No study data"
        hint="Enable Remote SDV and create reviews to see charts."
        height={300}
      />
    )
  }

  const barCount = chartData.length
  const maxBarSize = Math.min(48, Math.round(320 / Math.max(barCount, 1)))

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Compare review status across studies</p>
        <StackToggle stacked={stacked} onChange={setStacked} />
      </div>
      <div className="h-[300px] w-full min-w-0 [&_.recharts-responsive-container]:outline-none [&_svg]:outline-none">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={chartData}
            margin={{ ...NOVERA_CHART_MARGIN, left: 4, right: 8, bottom: barCount > 4 ? 20 : 4 }}
            barGap={stacked ? 0 : 8}
            barCategoryGap={barCount > 3 ? "18%" : "28%"}
          >
            <BarGradients idPrefix="rsdv-status" />
            <CartesianGrid strokeDasharray="4 8" stroke={NOVERA_CHART.grid} vertical={false} />
            <XAxis
              dataKey="study"
              tick={AXIS.tick}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={barCount > 3 ? -24 : 0}
              textAnchor={barCount > 3 ? "end" : "middle"}
              height={barCount > 3 ? 56 : 32}
            />
            <YAxis tick={AXIS.tick} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
            <Tooltip content={<RsdvChartTooltip />} cursor={{ fill: "rgba(16, 185, 129, 0.06)", radius: 8 }} />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="circle"
              wrapperStyle={{ fontSize: 11, color: "#475569" }}
            />
            {STATUS_SERIES.map((s, index) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={`url(#rsdv-status-${s.key})`}
                stackId={stacked ? "rsdv" : undefined}
                maxBarSize={maxBarSize}
                radius={
                  stacked
                    ? index === STATUS_SERIES.length - 1
                      ? [8, 8, 0, 0]
                      : [0, 0, 0, 0]
                    : [8, 8, 0, 0]
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
