"use client"

import CrfProgressRing from "@/components/ecrf/data-entry/CrfProgressRing"
import CrfQuerySummaryBadges from "@/components/ecrf/CrfQuerySummaryBadges"
import GlassSheen from "@/components/ecrf/GlassSheen"
import { computeVisitInsights } from "@/lib/utils/ecrfPatientInsights"
import { getCrfProgressStatusLabel } from "@/lib/utils/crfProgress"
import { hasCrfQueryActivity } from "@/lib/utils/crfQuerySummary"
import { cn } from "@/lib/utils"
import { CheckCircle, ChevronDown, Clock, Loader2, XCircle } from "lucide-react"

const SUBMIT_STATUS = {
  completed: { label: "Submitted", pill: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle },
  inprocess: { label: "In Process", pill: "border-amber-200 bg-amber-50 text-amber-700", icon: Clock },
  pending: { label: "Pending", pill: "border-slate-200 bg-slate-50 text-slate-600", icon: XCircle },
}

/**
 * Dense visit card with ring gauge, field counts, queries, and form breakdown.
 */
export default function EcrfVisitMatrixCard({
  visit,
  visitData,
  visitProgress,
  visitQuerySummary,
  formsForVisit = [],
  isLoading,
  isDropdownOpen,
  isVisitLocked,
  isRecentlyAdded,
  onVisitClick,
  onFormSelect,
  children,
}) {
  const insights = computeVisitInsights({
    visitProgress,
    visitQuerySummary,
    visitData,
    formsForVisit,
  })

  const submitMeta = SUBMIT_STATUS[insights.submitStatus] || SUBMIT_STATUS.pending
  const SubmitIcon = submitMeta.icon
  const progressLabel = getCrfProgressStatusLabel(insights.progress.progressStatus)
  const showQueries = hasCrfQueryActivity(visitQuerySummary)

  return (
    <div
      data-manual-visit-row={visit.id}
      className={cn(
        "group relative visit-dropdown-container overflow-hidden rounded-2xl border border-slate-200/80 bg-white/88 backdrop-blur-md transition-all duration-200",
        isVisitLocked
          ? "cursor-not-allowed opacity-70"
          : "hover:border-emerald-300/90 hover:bg-white/95 hover:shadow-[0_14px_30px_-20px_rgba(15,23,42,0.35)]",
        isRecentlyAdded && "ring-2 ring-teal-300/80 shadow-[0_0_0_1px_rgba(167,139,250,0.5),0_18px_35px_-24px_rgba(109,40,217,0.6)]",
      )}
    >
      <GlassSheen />

      <div
        onClick={(e) => {
          if (isVisitLocked) return
          onVisitClick?.(visit.id, e)
        }}
        className={cn("relative p-3.5 sm:p-4", isVisitLocked ? "cursor-not-allowed" : "cursor-pointer")}
      >
        <div className="flex items-start gap-3">
          <CrfProgressRing progress={insights.progress} size="md" />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-emerald-700">
                  {visit.name}
                </h4>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      submitMeta.pill,
                    )}
                  >
                    <SubmitIcon className="h-3 w-3 shrink-0" aria-hidden />
                    {submitMeta.label}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">{progressLabel}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                {showQueries ? <CrfQuerySummaryBadges summary={visitQuerySummary} compact /> : null}
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-label="Loading forms" /> : null}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-slate-400 transition-all group-hover:text-emerald-600",
                    isDropdownOpen && "rotate-180",
                  )}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatPill label="Required fields" value={`${insights.fieldsCompleted}/${insights.fieldsTotal || "—"}`} />
              <StatPill label="Remaining" value={insights.fieldsTotal ? insights.fieldsRemaining : "—"} />
              <StatPill
                label="Forms"
                value={
                  insights.formCount
                    ? `${insights.completedForms}/${insights.formCount}`
                    : isLoading
                      ? "…"
                      : "—"
                }
                hint={
                  insights.inProgressForms > 0 ? `${insights.inProgressForms} in progress` : undefined
                }
              />
              <StatPill
                label="Open queries"
                value={insights.queries.open || 0}
                hint={insights.queries.total ? `${insights.queries.total} total` : undefined}
              />
            </div>

            {/* Slim progress track */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${insights.progress.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {children}

      {isDropdownOpen && formsForVisit.length > 0 ? (
        <div className="relative border-t border-slate-200/75 px-3.5 pb-3.5 pt-3 sm:px-4">
          <p className="mb-2 text-xs font-semibold text-slate-600">Select form</p>
          <div className="space-y-1.5">
            {formsForVisit.map((form) => {
              const formStatus = form.status || "notstarted"
              const statusConfig = {
                completed: { color: "bg-green-500", icon: CheckCircle, text: "Completed", textColor: "text-green-600" },
                inprogress: { color: "bg-orange-500", icon: Clock, text: "In Progress", textColor: "text-orange-600" },
                notstarted: { color: "bg-red-500", icon: XCircle, text: "Not Started", textColor: "text-red-600" },
              }
              const status = statusConfig[formStatus] || statusConfig.notstarted
              const StatusIcon = status.icon

              return (
                <button
                  key={form.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFormSelect?.(form, visit.id)
                  }}
                  className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-left text-xs transition-all hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-[0_8px_20px_-16px_rgba(79,70,229,0.5)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-900">{form.sectionName}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{form.crfDesignName}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", status.color)} />
                      <div className="flex items-center gap-1">
                        <StatusIcon className={cn("h-3 w-3", status.textColor)} />
                        <span className={cn("text-xs font-medium", status.textColor)}>{status.text}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {isDropdownOpen && formsForVisit.length === 0 && !isLoading ? (
        <div className="relative border-t border-slate-200/75 px-3.5 pb-3.5 pt-3 sm:px-4">
          {!visit?.isRepeatableGroup ? (
            <p className="py-2 text-center text-xs text-slate-500">No forms available</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function StatPill({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-slate-200/70 bg-slate-50/60 px-2 py-1.5">
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.05em] text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[9px] text-slate-500">{hint}</p> : null}
    </div>
  )
}
