"use client"

import CrfProgressBar from "@/components/ecrf/CrfProgressBar"
import CrfQuerySummaryBadges from "@/components/ecrf/CrfQuerySummaryBadges"
import EcrfAddVisitTypeDropdown from "@/components/ecrf/data-entry/EcrfAddVisitTypeDropdown"
import EcrfMatrixVisitCell from "@/components/ecrf/data-entry/EcrfMatrixVisitCell"
import { hasCrfQueryActivity } from "@/lib/utils/crfQuerySummary"
import { hasCrfProgressData } from "@/lib/utils/crfProgress"
import {
  isPatientReadyForBulkReview,
  resolveMatrixVisitCell,
  resolvePatientMatrixProgress,
} from "@/lib/utils/ecrfVisitMatrixStatus"
import { MOBILE_SHELL_MEDIA_QUERY } from "@/lib/ui/useMobileShell"
import { cn } from "@/lib/utils"
import { FileSignature, Loader2, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"

const PATIENT_COL = "15.5rem"
const PATIENT_COL_MOBILE = "10.5rem"
const ADD_VISIT_COL = "3rem"
const VISIT_COL = "9.5rem"
const VISIT_COL_MOBILE = "8.5rem"

function buildMatrixGridColumns(showAddVisitType, visitCount, isMobileViewport) {
  const patientCol = isMobileViewport ? PATIENT_COL_MOBILE : PATIENT_COL
  const visitCol = isMobileViewport ? VISIT_COL_MOBILE : VISIT_COL
  return [patientCol, ...(showAddVisitType ? [ADD_VISIT_COL] : []), ...Array(visitCount).fill(visitCol)].join(" ")
}

export default function EcrfPatientVisitMatrix({
  patients,
  visitColumns,
  selectedPatientId,
  selectedVisitId,
  statusFilter = "all",
  visitFilter = "all",
  loadingPatients,
  loadingFormsByVisit = {},
  getVisitLockReason,
  onPatientSelect,
  onCellClick,
  onCellQueryClick,
  onLockedTap,
  onAddVisitType,
  showAddVisitType,
  addVisitTypeLoading = false,
  supportsUnscheduledVisit = false,
  supportsAdverseVisit = false,
  canAllVisitsSdv = false,
  allVisitsSdvLoading = false,
  onAllVisitsSdv,
  canAllVisitsPi = false,
  allVisitsPiLoading = false,
  onAllVisitsPi,
  getVisitPiCounts,
  patientStatusBadgeClass,
  emptyMessage,
  className,
}) {
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_SHELL_MEDIA_QUERY)
    const onChange = () => setIsMobileViewport(mq.matches)
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const visibleColumns =
    visitFilter === "all"
      ? visitColumns
      : visitColumns.filter((v) => String(v.visitScheduleId ?? v.id) === String(visitFilter))

  const gridTemplateColumns = buildMatrixGridColumns(showAddVisitType, visibleColumns.length, isMobileViewport)

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-slate-200/80 bg-white/85 shadow-sm shadow-slate-900/5",
        isMobileViewport
          ? "min-h-0 flex-none overflow-visible"
          : "min-h-0 flex-1 overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "custom-scrollbar [-webkit-overflow-scrolling:touch]",
          isMobileViewport
            ? "overflow-x-auto overflow-y-visible touch-pan-x"
            : "min-h-0 flex-1 overflow-auto overscroll-x-contain overscroll-y-contain touch-pan-x touch-pan-y",
        )}
        role="region"
        aria-label="Patient visit matrix"
      >
        {isMobileViewport && visibleColumns.length > 1 ? (
          <p className="border-b border-slate-100 bg-slate-50/90 px-3 py-2 text-[11px] font-medium leading-snug text-slate-500 lg:hidden">
            Swipe left for more visits, then tap a cell to open the CRF.
          </p>
        ) : null}
        <div className="min-w-max">
          {/* Header row — same grid tracks as body rows for column alignment */}
          <div
            className="sticky top-0 z-20 grid border-b border-slate-200/80 bg-slate-50/95 backdrop-blur-md max-lg:static"
            style={{ gridTemplateColumns }}
          >
            <div className="border-r border-slate-200/80 bg-slate-50/98 px-3 py-3 lg:sticky lg:left-0 lg:z-30 lg:px-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Patient</p>
            </div>
            {showAddVisitType ? (
              <div className="flex items-center justify-center border-r border-slate-200/60">
                <span className="sr-only">Add visit</span>
              </div>
            ) : null}
            {visibleColumns.map((visit, index) => {
              const isActiveVisitColumn =
                selectedVisitId != null && String(selectedVisitId) === String(visit.id)

              return (
              <div
                key={visit.id}
                className={cn(
                  "flex min-w-0 items-end border-r border-slate-200/50 p-2 transition-colors",
                  index === visibleColumns.length - 1 && "border-r-0",
                  isActiveVisitColumn && "border-b-2 border-b-emerald-500 bg-emerald-100/70",
                )}
              >
                <div className="min-w-0 w-full">
                  <p
                    className={cn(
                      "truncate text-[11px] font-bold uppercase tracking-[0.05em]",
                      isActiveVisitColumn ? "text-emerald-800" : "text-slate-700",
                    )}
                  >
                    {visit.name}
                  </p>
                  {visit.visitNo != null ? (
                    <p
                      className={cn(
                        "truncate text-[10px]",
                        isActiveVisitColumn ? "font-medium text-emerald-700/90" : "text-slate-400",
                      )}
                    >
                      Visit {visit.visitNo}
                    </p>
                  ) : null}
                </div>
              </div>
            )})}
          </div>

          {/* Body */}
          {loadingPatients ? (
            <MatrixSkeletonRows
              columns={visibleColumns.length}
              showAddVisitType={showAddVisitType}
              isMobileViewport={isMobileViewport}
            />
          ) : patients.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              {emptyMessage || "No patients match your filters."}
            </div>
          ) : (
            patients.map((patient) => {
              const isSelectedPatient = String(selectedPatientId) === String(patient.id)
              const patientMatchesStatus = patientMatchesStatusFilter(patient, visibleColumns, statusFilter)
              const patientProgress = resolvePatientMatrixProgress(patient, visibleColumns)

              if (statusFilter !== "all" && !patientMatchesStatus) return null

              const bulkReviewReady = isSelectedPatient
                ? isPatientReadyForBulkReview(patient, visitColumns).ready
                : false
              const showAllVisitsSdv = canAllVisitsSdv && isSelectedPatient && bulkReviewReady
              let piAwaitingCount = 0
              if (isSelectedPatient && typeof getVisitPiCounts === "function") {
                for (const visit of visitColumns) {
                  const counts = getVisitPiCounts(visit.visitScheduleId ?? visit.id, patient.id)
                  piAwaitingCount += Number(counts?.pending ?? 0) || 0
                }
              }
              const showAllVisitsPi = canAllVisitsPi && isSelectedPatient && piAwaitingCount > 0

              return (
                <div
                  key={patient.id}
                  className={cn(
                    "grid border-b border-slate-100/90 transition-colors",
                    isSelectedPatient
                      ? "border-l-4 border-l-emerald-600 bg-emerald-50/50"
                      : "border-l-4 border-l-emerald-300/60 hover:bg-slate-50/60",
                  )}
                  style={{ gridTemplateColumns }}
                >
                  <div
                    className={cn(
                      "border-r border-slate-200/80 bg-white/98 p-2 lg:sticky lg:left-0 lg:z-10 lg:p-3",
                      isSelectedPatient && "bg-emerald-50/95",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onPatientSelect?.(patient)}
                      aria-current={isSelectedPatient ? "true" : undefined}
                      className={cn(
                        "relative w-full overflow-hidden rounded-xl border-2 bg-white p-3 text-left shadow-sm transition-all duration-200",
                        isSelectedPatient
                          ? "border-emerald-600 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/50 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/35"
                          : "border-emerald-300/80 bg-gradient-to-br from-white to-emerald-50/25 hover:border-emerald-400 hover:shadow-md",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full",
                          isSelectedPatient ? "bg-emerald-600" : "bg-emerald-400/70",
                        )}
                        aria-hidden
                      />
                      <div className="pl-2">
                      <p className="truncate text-sm font-bold text-slate-900">{patient.patientId}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">({patient.initial})</p>

                      {patient.patientStatusName ? (
                        <span
                          className={cn(
                            "mt-2 inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            patientStatusBadgeClass?.(patient, isSelectedPatient) ||
                              "border-emerald-200 bg-emerald-50 text-emerald-800",
                          )}
                        >
                          {patient.patientStatusName}
                        </span>
                      ) : null}

                      {hasCrfQueryActivity(patient.querySummary) ? (
                        <div className="mt-2 flex justify-end">
                          <CrfQuerySummaryBadges summary={patient.querySummary} variant="openOnly" compact />
                        </div>
                      ) : null}

                      {hasCrfProgressData(patientProgress) ? (
                        <div className="mt-2">
                          <CrfProgressBar progress={patientProgress} size="compact" showCounts />
                        </div>
                      ) : null}

                      {showAllVisitsSdv ? (
                        <button
                          type="button"
                          disabled={allVisitsSdvLoading || allVisitsPiLoading}
                          onClick={(e) => {
                            e.stopPropagation()
                            onAllVisitsSdv?.(patient)
                          }}
                          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300/80 bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Mark SDV done for all Saved/Submitted CRFs across this patient’s visits (same rules as per-CRF SDV)"
                        >
                          {allVisitsSdvLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                          )}
                          All visits SDV
                        </button>
                      ) : null}

                      {showAllVisitsPi ? (
                        <button
                          type="button"
                          disabled={allVisitsPiLoading || allVisitsSdvLoading}
                          onClick={(e) => {
                            e.stopPropagation()
                            onAllVisitsPi?.(patient)
                          }}
                          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-300/80 bg-sky-50 px-2 py-1.5 text-[11px] font-semibold text-sky-900 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Sign all ready submitted CRFs for this patient (Study Settings: Site bulk sign-off)"
                        >
                          {allVisitsPiLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <FileSignature className="h-3.5 w-3.5" aria-hidden />
                          )}
                          Sign all ready PI ({piAwaitingCount})
                        </button>
                      ) : null}
                      </div>
                    </button>
                  </div>

                  {showAddVisitType ? (
                    <div className="flex items-center justify-center border-r border-slate-200/50">
                      <EcrfAddVisitTypeDropdown
                        variant="matrix"
                        visible
                        loading={Boolean(addVisitTypeLoading && isSelectedPatient)}
                        selectedPatientLabel={`${patient.patientId} (${patient.initial})`}
                        supportsUnscheduled={supportsUnscheduledVisit}
                        supportsAdverse={supportsAdverseVisit}
                        onAddUnscheduled={() => onAddVisitType?.(patient, "unscheduled")}
                        onAddAdverse={() => onAddVisitType?.(patient, "adverse")}
                      />
                    </div>
                  ) : null}

                  {visibleColumns.map((visit, index) => {
                    const cell = resolveMatrixVisitCell(patient, visit)
                    if (statusFilter !== "all" && cell.status !== statusFilter) {
                      return (
                        <div
                          key={`${patient.id}-${visit.id}`}
                          className={cn(
                            "flex min-w-0 items-center border-r border-slate-100/80 p-2",
                            index === visibleColumns.length - 1 && "border-r-0",
                          )}
                        >
                          <div className="h-[6.75rem] w-full rounded-2xl border border-dashed border-slate-200/70 bg-slate-50/40" />
                        </div>
                      )
                    }

                    const lockReason = getVisitLockReason?.(patient, visit) || ""
                    const isLocked = Boolean(lockReason)
                    const isSelectedCell =
                      isSelectedPatient && String(selectedVisitId) === String(visit.id)
                    const isLoading = Boolean(loadingFormsByVisit?.[visit.id])

                    return (
                      <div
                        key={`${patient.id}-${visit.id}`}
                        className={cn(
                          "relative flex min-w-0 items-center border-r border-slate-100/80 p-2 transition-colors",
                          index === visibleColumns.length - 1 && "border-r-0",
                          isSelectedCell && "bg-emerald-50/50",
                          selectedVisitId != null &&
                            String(selectedVisitId) === String(visit.id) &&
                            "bg-emerald-50/25",
                        )}
                      >
                        <EcrfMatrixVisitCell
                          visit={visit}
                          cell={cell}
                          isSelected={isSelectedCell}
                          isLoading={isLoading}
                          isLocked={isLocked}
                          lockReason={lockReason}
                          onClick={() => onCellClick?.(patient, visit)}
                          onQueryClick={
                            cell?.openQueries > 0
                              ? () => onCellQueryClick?.(patient, visit)
                              : undefined
                          }
                          onLockedTap={onLockedTap}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function patientMatchesStatusFilter(patient, visitColumns, statusFilter) {
  if (statusFilter === "all") return true
  return visitColumns.some((visit) => resolveMatrixVisitCell(patient, visit).status === statusFilter)
}

function MatrixSkeletonRows({ columns, showAddVisitType, isMobileViewport }) {
  const colCount = Math.max(columns, 3)
  const skeletonGrid = buildMatrixGridColumns(showAddVisitType, colCount, isMobileViewport)

  return (
    <div className="space-y-0" role="status" aria-busy="true" aria-label="Loading patient matrix">
      {Array.from({ length: 5 }).map((_, row) => (
        <div
          key={row}
          className="grid border-b border-slate-100/90"
          style={{ gridTemplateColumns: skeletonGrid }}
        >
          <div className="border-r border-slate-200/80 p-3">
            <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
          </div>
          {showAddVisitType ? (
            <div className="flex items-center justify-center border-r border-slate-200/50">
              <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/60" />
            </div>
          ) : null}
          {Array.from({ length: colCount }).map((__, col) => (
            <div
              key={col}
              className={cn("p-2", col === colCount - 1 && "border-r-0")}
            >
              <div className="h-[6.75rem] animate-pulse rounded-2xl bg-slate-200/60" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
