"use client"

import { RefreshCw, Search } from "lucide-react"
import EcrfDataEntryStatusLegend from "@/components/ecrf/data-entry/EcrfDataEntryStatusLegend"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = [
  { value: "all", label: "All status" },
  { value: "pending", label: "Pending" },
  { value: "inprocess", label: "In process" },
  { value: "completed", label: "Completed" },
]

export default function EcrfDataEntryMatrixToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  visitFilter,
  onVisitFilterChange,
  visitOptions = [],
  onRefresh,
  className,
}) {
  return (
    <div
      className={cn(
        "shrink-0 space-y-3 rounded-2xl border border-slate-200/80 bg-white/92 px-4 py-4 shadow-sm shadow-slate-900/5 backdrop-blur-xl sm:px-5",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">CRF data entry workspace</h2>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Review patient progress across visits and open any CRF in one click.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search patient ID or initial"
            className="h-10 w-full rounded-xl border border-slate-200/90 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="h-10 rounded-xl border border-slate-200/90 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          aria-label="Filter by visit status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={visitFilter}
          onChange={(e) => onVisitFilterChange(e.target.value)}
          className="h-10 rounded-xl border border-slate-200/90 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          aria-label="Filter by visit"
        >
          <option value="all">All visits</option>
          {visitOptions.map((visit) => (
            <option key={visit.id} value={String(visit.visitScheduleId ?? visit.id)}>
              {visit.name}
            </option>
          ))}
        </select>
      </div>

      <EcrfDataEntryStatusLegend />
    </div>
  )
}
