"use client"

import { ClipboardList, Loader2, Search } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  formatQueryGridDate,
  formatQueryGridScalar,
  getQueryStatusLabel,
  getQueryStatusPillClass,
  queryDtoPick,
  queryGridTypeLabel,
} from "@/app/ecrf-data-entry/manually/lib/crfQueryReviewUi"
import { cn } from "@/lib/utils"

export default function EcrfPatientQueryManagementPanel({
  filteredCount = 0,
  pageRows = [],
  pageSize = 10,
  pageSafe = 1,
  totalPages = 1,
  search = "",
  onSearchChange,
  loading = false,
  onPageChange,
  visitNameByScheduleId = new Map(),
  crfNameByDesignId = new Map(),
  visitFilterLabel = null,
  onClearVisitFilter,
  onQueryRowClick,
  className,
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200/80 bg-white/92 shadow-sm shadow-slate-900/5 backdrop-blur-xl",
        className,
      )}
      role="region"
      aria-label="Query management"
      aria-busy={loading}
    >
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            Query management
            {filteredCount > 0 ? (
              <span className="ml-1 text-[11px] font-normal text-slate-500">({filteredCount} total)</span>
            ) : null}
          </h3>
          {visitFilterLabel ? (
            <button
              type="button"
              onClick={() => onClearVisitFilter?.()}
              className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/80 px-2.5 py-0.5 text-[10px] font-medium text-amber-900 transition hover:bg-amber-100/90"
              title="Show queries for all visits"
            >
              <span className="truncate">{visitFilterLabel}</span>
              <span className="shrink-0 text-amber-700/80" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search in queries…"
              className="h-8 w-48 rounded-full border border-slate-200/80 bg-white px-7 pr-3 text-[11px] text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
              Loading…
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        {filteredCount === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-16 text-center">
            <ClipboardList className="h-10 w-10 text-slate-300" aria-hidden />
            <p className="text-sm font-medium text-slate-600">No queries for this patient</p>
            <p className="text-xs text-slate-500">
              There are no CRF queries for this enrolment in the selected study and site.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-[11px] text-slate-800">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="sticky top-0 z-10 whitespace-nowrap px-2 py-2">Id</th>
                    <th className="sticky top-0 z-10 whitespace-nowrap px-2 py-2">Status</th>
                    <th className="sticky top-0 z-10 whitespace-nowrap px-2 py-2">Type</th>
                    <th className="sticky top-0 z-10 min-w-[120px] px-2 py-2">Field</th>
                    <th className="sticky top-0 z-10 min-w-[180px] px-2 py-2">Query</th>
                    <th className="sticky top-0 z-10 min-w-[100px] px-2 py-2">Expected</th>
                    <th className="sticky top-0 z-10 min-w-[100px] px-2 py-2">Actual</th>
                    <th className="sticky top-0 z-10 min-w-[120px] px-2 py-2">Visit name</th>
                    <th className="sticky top-0 z-10 min-w-[140px] px-2 py-2">CRF name</th>
                    <th className="sticky top-0 z-10 min-w-[100px] px-2 py-2">Raised by</th>
                    <th className="sticky top-0 z-10 min-w-[100px] px-2 py-2">Assigned</th>
                    <th className="sticky top-0 z-10 min-w-[100px] px-2 py-2">Approver</th>
                    <th className="sticky top-0 z-10 min-w-[100px] px-2 py-2">Reviewer cmt</th>
                    <th className="sticky top-0 z-10 min-w-[100px] px-2 py-2">Submitter cmt</th>
                    <th className="sticky top-0 z-10 whitespace-nowrap px-2 py-2">Created</th>
                    <th className="sticky top-0 z-10 whitespace-nowrap px-2 py-2">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && pageRows.length === 0
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={`sk-${i}`} className="border-b border-slate-100/90">
                          {Array.from({ length: 16 }).map((__, j) => (
                            <td key={j} className="px-2 py-2">
                              <div className="h-3 animate-pulse rounded bg-slate-200/80" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : pageRows.map((row, qIdx) => {
                        const id = row?.id ?? row?.queryId
                        const st = row?.status
                        const vsidRaw = queryDtoPick(row, "visitScheduleId", "VisitScheduleId")
                        const vsidStr = vsidRaw !== "" && vsidRaw != null ? String(vsidRaw) : ""
                        const visitNameCell =
                          vsidStr && visitNameByScheduleId.has(vsidStr)
                            ? visitNameByScheduleId.get(vsidStr)
                            : vsidStr
                              ? formatQueryGridScalar(vsidRaw)
                              : "—"
                        const didRaw = queryDtoPick(row, "crfDesignId", "CrfDesignId")
                        const didStr = didRaw !== "" && didRaw != null ? String(didRaw) : ""
                        const crfNameCell =
                          didStr && crfNameByDesignId.has(didStr)
                            ? crfNameByDesignId.get(didStr)
                            : didStr
                              ? formatQueryGridScalar(didRaw)
                              : "—"

                        return (
                          <tr
                            key={String(row?.guid ?? id ?? `q-${qIdx}`)}
                            className={cn(
                              "border-b border-slate-100/90",
                              onQueryRowClick
                                ? "cursor-pointer hover:bg-emerald-50/55"
                                : "hover:bg-emerald-50/40",
                            )}
                            onClick={
                              onQueryRowClick
                                ? () => onQueryRowClick(row)
                                : undefined
                            }
                            onKeyDown={
                              onQueryRowClick
                                ? (event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault()
                                      onQueryRowClick(row)
                                    }
                                  }
                                : undefined
                            }
                            tabIndex={onQueryRowClick ? 0 : undefined}
                            title={onQueryRowClick ? "Open queried field in CRF" : undefined}
                          >
                            <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px]">
                              {formatQueryGridScalar(id)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getQueryStatusPillClass(st)}`}
                              >
                                {getQueryStatusLabel(st)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5">{queryGridTypeLabel(row?.queryType)}</td>
                            <td className="max-w-[200px] px-2 py-1.5 align-top">
                              {formatQueryGridScalar(queryDtoPick(row, "fieldLabel", "FieldLabel"))}
                            </td>
                            <td className="w-[260px] max-w-[260px] px-2 py-1.5 align-top">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-full max-w-[260px] cursor-help truncate text-slate-700">
                                    {formatQueryGridScalar(queryDtoPick(row, "queryText", "QueryText"))}
                                  </div>
                                </TooltipTrigger>
                                {queryDtoPick(row, "queryText", "QueryText") ? (
                                  <TooltipContent className="max-w-xs break-words text-[11px] leading-snug">
                                    {String(queryDtoPick(row, "queryText", "QueryText"))}
                                  </TooltipContent>
                                ) : null}
                              </Tooltip>
                            </td>
                            <td className="w-[160px] max-w-[160px] px-2 py-1.5 align-top">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-full max-w-[160px] cursor-help truncate text-slate-600">
                                    {formatQueryGridScalar(
                                      queryDtoPick(row, "expectedCondition", "ExpectedCondition"),
                                    )}
                                  </div>
                                </TooltipTrigger>
                                {queryDtoPick(row, "expectedCondition", "ExpectedCondition") ? (
                                  <TooltipContent className="max-w-xs break-words text-[11px] leading-snug">
                                    {String(queryDtoPick(row, "expectedCondition", "ExpectedCondition"))}
                                  </TooltipContent>
                                ) : null}
                              </Tooltip>
                            </td>
                            <td className="max-w-[160px] px-2 py-1.5 align-top text-slate-600">
                              {formatQueryGridScalar(queryDtoPick(row, "actualValue", "ActualValue"))}
                            </td>
                            <td className="max-w-[160px] px-2 py-1.5 align-top text-slate-800">{visitNameCell}</td>
                            <td className="max-w-[200px] px-2 py-1.5 align-top text-slate-800">{crfNameCell}</td>
                            <td className="max-w-[140px] px-2 py-1.5 align-top">
                              {formatQueryGridScalar(
                                queryDtoPick(row, "queryRaisedByUserName", "QueryRaisedByUserName"),
                              )}
                            </td>
                            <td className="max-w-[140px] px-2 py-1.5 align-top">
                              {formatQueryGridScalar(
                                queryDtoPick(row, "queryAssignedToUserName", "QueryAssignedToUserName"),
                              )}
                            </td>
                            <td className="max-w-[140px] px-2 py-1.5 align-top">
                              {formatQueryGridScalar(
                                queryDtoPick(row, "queryApproverUserName", "QueryApproverUserName"),
                              )}
                            </td>
                            <td className="max-w-[160px] px-2 py-1.5 align-top text-slate-600">
                              {formatQueryGridScalar(
                                queryDtoPick(row, "queryApproverComment", "QueryApproverComment"),
                              )}
                            </td>
                            <td className="max-w-[160px] px-2 py-1.5 align-top text-slate-600">
                              {formatQueryGridScalar(
                                queryDtoPick(row, "crfSubmitterComment", "CrfSubmitterComment"),
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">
                              {formatQueryGridDate(queryDtoPick(row, "createdAt", "CreatedAt"))}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">
                              {formatQueryGridDate(queryDtoPick(row, "closedAt", "ClosedAt"))}
                            </td>
                          </tr>
                        )
                      })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-600">
              <span>
                {filteredCount === 0 ? (
                  "No queries to display"
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-semibold">{(pageSafe - 1) * pageSize + 1}</span> –
                    <span className="font-semibold">
                      {" "}
                      {Math.min(pageSafe * pageSize, filteredCount)}
                    </span>{" "}
                    of <span className="font-semibold">{filteredCount}</span> queries
                  </>
                )}
              </span>
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={pageSafe <= 1}
                  onClick={() => onPageChange?.(Math.max(1, pageSafe - 1))}
                  className="inline-flex h-7 items-center rounded-full border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-[11px] text-slate-500">
                  Page <span className="font-semibold">{pageSafe}</span> of{" "}
                  <span className="font-semibold">{totalPages}</span>
                </span>
                <button
                  type="button"
                  disabled={pageSafe >= totalPages}
                  onClick={() => onPageChange?.(Math.min(totalPages, pageSafe + 1))}
                  className="inline-flex h-7 items-center rounded-full border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
