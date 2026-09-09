"use client"

import { normalizeChartColor } from "@/lib/ui/dashboardChartDesign"
import { cn } from "@/lib/utils"

/** Horizontal segment breakdown with stacked bar + legend rows. */
export function NoveraSegmentBreakdown({
  items = [],
  total: totalProp,
  unitLabel = "",
  centerLabel,
  className,
  height = 280,
}) {
  const rows = items.filter((d) => Number(d.value) > 0)
  const total =
    totalProp ?? rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0)

  if (rows.length === 0 || total <= 0) {
    return (
      <div
        className={cn("flex flex-col items-center justify-center text-slate-500", className)}
        style={{ minHeight: height }}
      >
        <p className="text-sm font-medium">No data available</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} style={{ minHeight: height }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-4xl font-semibold tabular-nums tracking-tight text-slate-900">{total}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {centerLabel || unitLabel || "Total"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 sm:justify-end">
          {rows.map((row, i) => {
            const value = Number(row.value) || 0
            const pct = total > 0 ? Math.round((value / total) * 100) : 0
            const color = normalizeChartColor(row.color, i)
            return (
              <div key={row.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-medium text-slate-600">{row.name}</span>
                <span className="font-semibold tabular-nums text-slate-900">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner ring-1 ring-slate-200/50">
        {rows.map((row, i) => {
          const pct = (Number(row.value) / total) * 100
          const color = normalizeChartColor(row.color, i)
          return (
            <div
              key={row.name}
              className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${pct}%`, backgroundColor: color }}
              title={`${row.name}: ${row.value}`}
            />
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row, i) => {
          const value = Number(row.value) || 0
          const pct = total > 0 ? (value / total) * 100 : 0
          const color = normalizeChartColor(row.color, i)
          return (
            <div
              key={row.name}
              className="group rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-3 transition-colors hover:border-slate-200 hover:bg-white"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {row.name}
                </span>
                <span className="text-xs font-medium tabular-nums text-slate-500">
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg font-semibold tabular-nums text-slate-900">{value}</p>
                {unitLabel ? (
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {unitLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200/60">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function NoveraChartEmpty({ message = "No data available", hint, height = 280 }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-500"
      style={{ minHeight: height }}
    >
      <p className="text-sm font-medium tracking-tight">{message}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}
