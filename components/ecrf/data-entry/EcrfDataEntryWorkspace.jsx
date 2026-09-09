"use client"

import EcrfAddVisitTypeDropdown from "@/components/ecrf/data-entry/EcrfAddVisitTypeDropdown"
import EcrfPatientQueryManagementPanel from "@/components/ecrf/data-entry/EcrfPatientQueryManagementPanel"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { hasCrfProgressData } from "@/lib/utils/crfProgress"
import { normalizeCrfQuerySummary } from "@/lib/utils/crfQuerySummary"
import { MOBILE_SHELL_MEDIA_QUERY } from "@/lib/ui/useMobileShell"
import {
  ECRF_MATRIX_STATUS,
  isPatientReadyForBulkReview,
  resolveMatrixVisitCell,
  resolvePatientMatrixProgress,
  summarizePatientSdv,
} from "@/lib/utils/ecrfVisitMatrixStatus"
import { cn } from "@/lib/utils"
import {
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  FileSignature,
  Loader2,
  Lock,
  MessageSquare,
  Minus,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

const LIST_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "queries", label: "Queries" },
  { id: "done", label: "Done" },
]

function patientStatusTone(statusCode) {
  const code = Number(statusCode)
  if (code === 9) return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (code === 7 || code === 8) return "border-rose-200 bg-rose-50 text-rose-800"
  if (code === 5 || code === 6) return "border-rose-200 bg-rose-50 text-rose-700"
  if (code === 4) return "border-amber-200 bg-amber-50 text-amber-900"
  if (code === 1) return "border-amber-200 bg-amber-50 text-amber-800"
  if (code === 2) return "border-slate-200 bg-slate-100 text-slate-700"
  return "border-sky-200 bg-sky-50 text-sky-900"
}

function isPatientDone(patient, visitColumns) {
  const code = Number(patient?.currentStatusCode ?? patient?.patientStatusCode)
  if (code === 9) return true
  const progress = resolvePatientMatrixProgress(patient, visitColumns)
  return (
    hasCrfProgressData(progress) &&
    progress.requiredFieldCount > 0 &&
    progress.completedRequiredFieldCount >= progress.requiredFieldCount
  )
}

function patientOpenQueryCount(patient) {
  const qs = normalizeCrfQuerySummary(patient?.querySummary)
  return qs.open + qs.inProcess
}

function VisitStatusIcon({ status, locked, openQueries = 0 }) {
  if (locked) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200">
        <Lock className="h-4 w-4" aria-hidden />
      </span>
    )
  }
  if (openQueries > 0) {
    return (
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200/80">
        <MessageSquare className="h-4 w-4" aria-hidden />
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold leading-none text-white">
          {openQueries > 99 ? "99+" : openQueries}
        </span>
      </span>
    )
  }
  if (status === "completed") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="h-4 w-4" strokeWidth={2.75} aria-hidden />
      </span>
    )
  }
  if (status === "inprocess") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-200">
        <Minus className="h-4 w-4 rotate-90" aria-hidden />
      </span>
    )
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200">
      <Minus className="h-4 w-4" aria-hidden />
    </span>
  )
}

/** Prefer CRF design name when section label is generic ("Section 1"). */
function formPickerTitles(form) {
  const design = String(form?.crfDesignName || "").trim()
  const section = String(form?.sectionName || "").trim()
  const sectionIsGeneric = !section || /^section\s*\d+$/i.test(section) || section === "Form"
  if (design && sectionIsGeneric) {
    return { title: design, subtitle: section && section !== design ? section : null }
  }
  if (section && design && section !== design) {
    return { title: section, subtitle: design }
  }
  return { title: design || section || "Form", subtitle: null }
}

function patientCrfStatusMeta(status) {
  switch (String(status || "").toLowerCase()) {
    case "completed":
      return {
        dot: "bg-emerald-500",
        label: "Completed",
        Icon: CheckCircle,
        iconClass: "text-emerald-600",
      }
    case "inprocess":
    case "inprogress":
    case "in_progress":
      return {
        dot: "bg-orange-500",
        label: "In process",
        Icon: Clock,
        iconClass: "text-orange-600",
      }
    case "pending":
    default:
      return {
        dot: "bg-red-500",
        label: "Pending",
        Icon: XCircle,
        iconClass: "text-red-600",
      }
  }
}

function FormStatusMeta(formStatus) {
  const statusConfig = {
    completed: { color: "bg-emerald-500", icon: CheckCircle, text: "Completed", textClass: "text-emerald-600" },
    inprogress: { color: "bg-orange-500", icon: Clock, text: "In Progress", textClass: "text-orange-600" },
    notstarted: { color: "bg-red-500", icon: XCircle, text: "Not Started", textClass: "text-red-600" },
  }
  return statusConfig[formStatus] || statusConfig.notstarted
}

function StatPill({ label, value, tone = "neutral", onClick }) {
  const tones = {
    sky: "border-sky-200/90 bg-sky-50 text-sky-950",
    amber: "border-amber-200/90 bg-amber-50 text-amber-950",
    emerald: "border-emerald-200/90 bg-emerald-50 text-emerald-950",
    neutral: "border-slate-200 bg-white text-slate-900",
  }
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "min-w-0 rounded-xl border px-3.5 py-2.5 text-left",
        tones[tone] || tones.neutral,
        onClick && "transition hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
      )}
    >
      <p className="text-[11px] font-medium text-slate-600">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight">{value}</p>
    </Comp>
  )
}

export default function EcrfDataEntryWorkspace({
  patients = [],
  visitColumns = [],
  selectedPatient,
  selectedVisitId,
  searchQuery,
  onSearchChange,
  loadingPatients,
  loadingFormsByVisit = {},
  formsByVisit = {},
  expandedVisitId = null,
  getVisitLockReason,
  onPatientSelect,
  onClearPatient,
  onVisitClick,
  onFormSelect,
  onVisitQueryClick,
  onLockedTap,
  onRefresh,
  patientMainTab = "visits",
  onPatientMainTabChange,
  showAddVisitType,
  addVisitTypeLoading = false,
  supportsUnscheduledVisit = false,
  supportsAdverseVisit = false,
  onAddVisitType,
  canAllVisitsSdv = false,
  allVisitsSdvLoading = false,
  onAllVisitsSdv,
  canAllVisitsPi = false,
  allVisitsPiLoading = false,
  onAllVisitsPi,
  getVisitPiCounts,
  isPatientStatusEnabled = false,
  canChangePatientStatus,
  getPatientStatusChangeOptions,
  getPatientStatusOptionLabel,
  onPatientStatusChange,
  queryPanelProps,
  emptyMessage,
  className,
}) {
  const [listFilter, setListFilter] = useState("all")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_SHELL_MEDIA_QUERY)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const filteredList = useMemo(() => {
    return (Array.isArray(patients) ? patients : []).filter((patient) => {
      if (listFilter === "queries") return patientOpenQueryCount(patient) > 0
      if (listFilter === "done") return isPatientDone(patient, visitColumns)
      if (listFilter === "active") return !isPatientDone(patient, visitColumns)
      return true
    })
  }, [patients, listFilter, visitColumns])

  const patientProgress = useMemo(
    () => (selectedPatient ? resolvePatientMatrixProgress(selectedPatient, visitColumns) : null),
    [selectedPatient, visitColumns],
  )

  const patientSdv = useMemo(
    () => (selectedPatient ? summarizePatientSdv(selectedPatient) : { done: 0, pending: 0, total: 0 }),
    [selectedPatient],
  )

  const queryCounts = useMemo(() => {
    if (queryPanelProps?.queryCounts) return queryPanelProps.queryCounts
    return normalizeCrfQuerySummary(selectedPatient?.querySummary)
  }, [queryPanelProps?.queryCounts, selectedPatient?.querySummary])

  const piAwaiting = useMemo(() => {
    if (!selectedPatient?.id || typeof getVisitPiCounts !== "function") return 0
    let pending = 0
    for (const visit of visitColumns) {
      const counts = getVisitPiCounts(visit.visitScheduleId ?? visit.id, selectedPatient.id)
      pending += Number(counts?.pending ?? 0) || 0
    }
    return pending
  }, [selectedPatient, visitColumns, getVisitPiCounts])

  const bulkReady = selectedPatient
    ? isPatientReadyForBulkReview(selectedPatient, visitColumns).ready
    : false

  const showList = !isMobile || !selectedPatient
  const showDetail = !isMobile || Boolean(selectedPatient)

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:gap-0 lg:rounded-2xl lg:border lg:border-slate-200/80 lg:bg-white lg:shadow-sm lg:shadow-slate-900/5",
        className,
      )}
    >
      {/* Patient list */}
      <aside
        className={cn(
          "flex min-h-0 flex-col border-slate-200/80 bg-white lg:w-[20.5rem] lg:shrink-0 lg:border-r",
          showList ? "flex" : "hidden",
          isMobile && "min-h-[70dvh] rounded-2xl border shadow-sm",
        )}
      >
        <div className="shrink-0 space-y-3 border-b border-slate-100 px-3.5 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Patients</h2>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search patient ID or code"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Patient list filter">
            {LIST_FILTERS.map((filter) => {
              const active = listFilter === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setListFilter(filter.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold transition",
                    active
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/80",
                  )}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
          {loadingPatients ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[4.5rem] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filteredList.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-slate-500">
              {emptyMessage || "No patients match your filters."}
            </p>
          ) : (
            filteredList.map((patient) => {
              const selected = String(selectedPatient?.id) === String(patient.id)
              const progress = resolvePatientMatrixProgress(patient, visitColumns)
              const openQs = patientOpenQueryCount(patient)
              const hasOpenQueries = openQs > 0
              const statusName = patient.patientStatusName || patient.currentStatusName || ""
              const statusCode = patient.currentStatusCode ?? patient.patientStatusCode
              const crfStatus = patientCrfStatusMeta(patient.status)
              const CrfStatusIcon = crfStatus.Icon
              const canShowStatusAction =
                Boolean(isPatientStatusEnabled) &&
                (typeof canChangePatientStatus === "function"
                  ? canChangePatientStatus(patient)
                  : false)
              const statusOptions = canShowStatusAction
                ? (typeof getPatientStatusChangeOptions === "function"
                    ? getPatientStatusChangeOptions(patient)
                    : [])
                : []
              const showProgress =
                hasCrfProgressData(progress) && Number(progress.requiredFieldCount) > 0

              return (
                <div
                  key={patient.id}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 transition",
                    hasOpenQueries && !selected
                      ? "border-amber-300/90 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 hover:border-amber-400"
                      : selected
                        ? hasOpenQueries
                          ? "border-amber-400 bg-amber-50/90 shadow-sm ring-1 ring-amber-300/50"
                          : "border-emerald-500 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-400/40"
                        : "border-slate-200/90 bg-white hover:border-emerald-300 hover:bg-slate-50/80",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onPatientSelect?.(patient)}
                    aria-current={selected ? "true" : undefined}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm font-bold",
                            hasOpenQueries ? "text-amber-950" : "text-slate-900",
                          )}
                        >
                          {patient.screeningNo?.trim() || patient.patientId}
                        </p>
                        {patient.randomizationNumber?.trim() ? (
                          <p className="truncate text-[10px] font-semibold text-slate-500">
                            Rand: {patient.randomizationNumber.trim()}
                          </p>
                        ) : null}
                        <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                hasOpenQueries ? "bg-amber-500" : crfStatus.dot,
                              )}
                              title={hasOpenQueries ? "Open queries" : crfStatus.label}
                              aria-hidden
                            />
                            <p
                              className={cn(
                                "truncate text-[11px]",
                                hasOpenQueries ? "text-amber-800/90" : "text-slate-500",
                              )}
                            >
                              ({patient.initial || "—"})
                            </p>
                          </div>
                          {hasOpenQueries ? (
                            <span
                              className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200/80"
                              aria-label={`${openQs} open ${openQs === 1 ? "query" : "queries"}`}
                            >
                              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold leading-none text-white">
                                {openQs > 99 ? "99+" : openQs}
                              </span>
                            </span>
                          ) : (
                            <CrfStatusIcon
                              className={cn("h-4 w-4 shrink-0", crfStatus.iconClass)}
                              aria-label={crfStatus.label}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {showProgress ? (
                      <div className="mt-2">
                        <div
                          className={cn(
                            "mb-1 flex items-center justify-between gap-2 text-[10px] tabular-nums",
                            hasOpenQueries ? "text-amber-900/80" : "text-slate-500",
                          )}
                        >
                          <span>
                            {progress.completedRequiredFieldCount}/{progress.requiredFieldCount}
                            <span className={hasOpenQueries ? "text-amber-800/70" : "text-slate-400"}>
                              {" "}
                              · {progress.progressPercent}%
                            </span>
                          </span>
                          <span className="font-medium">
                            {hasOpenQueries
                              ? openQs === 1
                                ? "1 open query"
                                : `${openQs} open queries`
                              : crfStatus.label}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "h-1.5 overflow-hidden rounded-full",
                            hasOpenQueries ? "bg-amber-100" : "bg-slate-100",
                          )}
                        >
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              hasOpenQueries
                                ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                : "bg-emerald-500",
                            )}
                            style={{ width: `${Math.min(100, progress.progressPercent)}%` }}
                          />
                        </div>
                      </div>
                    ) : hasOpenQueries ? (
                      <p className="mt-1.5 text-[10px] font-semibold text-amber-800">
                        {openQs === 1 ? "1 open query" : `${openQs} open queries`}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[10px] font-medium text-slate-400">{crfStatus.label}</p>
                    )}
                  </button>

                  {(statusName || statusOptions.length > 0) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {statusName ? (
                        <span
                          className={cn(
                            "inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            patientStatusTone(statusCode),
                          )}
                          title={statusName}
                        >
                          {statusName}
                        </span>
                      ) : null}
                      {statusOptions.length > 0 ? (
                        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 transition hover:bg-emerald-100"
                              >
                                Change status
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[11rem]">
                              {statusOptions.map((code) => (
                                <DropdownMenuItem
                                  key={`${patient.id}-${code}`}
                                  onClick={() => void onPatientStatusChange?.(patient, code)}
                                >
                                  {typeof getPatientStatusOptionLabel === "function"
                                    ? getPatientStatusOptionLabel(code)
                                    : String(code)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </aside>

      {/* Patient detail */}
      <section
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50/40 lg:bg-white",
          showDetail ? "flex" : "hidden",
          isMobile && selectedPatient && "min-h-[70dvh] rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        )}
      >
        {!selectedPatient ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="text-base font-semibold text-slate-800">Select a patient</p>
            <p className="max-w-sm text-sm text-slate-500">
              Choose a patient from the list to review visits, SDV, PI sign-off, and queries.
            </p>
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-4 sm:px-5">
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => onClearPatient?.()}
                  className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Patients
                </button>
              ) : null}

              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                      {selectedPatient.screeningNo?.trim() || selectedPatient.patientId}
                    </h3>
                    {selectedPatient.randomizationNumber?.trim() ? (
                      <span className="text-sm font-semibold text-slate-500">
                        Rand: {selectedPatient.randomizationNumber.trim()}
                      </span>
                    ) : null}
                    <span className="text-sm font-semibold text-slate-500">
                      {selectedPatient.initial}
                      {selectedPatient.qaCode || selectedPatient.siteCode
                        ? ` · ${selectedPatient.qaCode || selectedPatient.siteCode}`
                        : ""}
                    </span>
                    {(selectedPatient.patientStatusName || selectedPatient.currentStatusName) && (
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                          patientStatusTone(
                            selectedPatient.currentStatusCode ?? selectedPatient.patientStatusCode,
                          ),
                        )}
                      >
                        {selectedPatient.patientStatusName || selectedPatient.currentStatusName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canAllVisitsSdv && bulkReady ? (
                    <button
                      type="button"
                      disabled={allVisitsSdvLoading || allVisitsPiLoading}
                      onClick={() => onAllVisitsSdv?.(selectedPatient)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-60"
                    >
                      {allVisitsSdvLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      )}
                      All visits SDV
                    </button>
                  ) : null}
                  {canAllVisitsPi && piAwaiting > 0 ? (
                    <button
                      type="button"
                      disabled={allVisitsPiLoading || allVisitsSdvLoading}
                      onClick={() => onAllVisitsPi?.(selectedPatient)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3 text-xs font-semibold text-sky-950 transition hover:bg-sky-100 disabled:opacity-60"
                      title="Sign all ready submitted CRFs for this patient (Study Settings: Site bulk sign-off)"
                    >
                      {allVisitsPiLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <FileSignature className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Sign all ready PI ({piAwaiting})
                    </button>
                  ) : null}
                  {showAddVisitType ? (
                    <EcrfAddVisitTypeDropdown
                      variant="toolbar"
                      visible
                      loading={addVisitTypeLoading}
                      selectedPatientLabel={`${selectedPatient.patientId} (${selectedPatient.initial})`}
                      supportsUnscheduled={supportsUnscheduledVisit}
                      supportsAdverse={supportsAdverseVisit}
                      onAddUnscheduled={() => onAddVisitType?.(selectedPatient, "unscheduled")}
                      onAddAdverse={() => onAddVisitType?.(selectedPatient, "adverse")}
                      className="!border-slate-200 !bg-white !text-slate-800 hover:!border-emerald-300 hover:!bg-emerald-50 hover:!text-emerald-900"
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatPill
                  label="required fields"
                  value={
                    hasCrfProgressData(patientProgress) && patientProgress.requiredFieldCount > 0
                      ? `${patientProgress.completedRequiredFieldCount}/${patientProgress.requiredFieldCount}`
                      : "—"
                  }
                  tone="sky"
                />
                <StatPill
                  label="open queries"
                  value={queryCounts.open ?? 0}
                  tone="amber"
                  onClick={() => onPatientMainTabChange?.("queries")}
                />
                <StatPill
                  label="closed queries"
                  value={queryCounts.closed ?? 0}
                  tone="neutral"
                  onClick={() => onPatientMainTabChange?.("queries")}
                />
                <StatPill
                  label={
                    patientSdv.total > 0
                      ? `SDV ${patientSdv.done}/${patientSdv.total} · PI awaiting`
                      : "awaiting PI sign-off"
                  }
                  value={piAwaiting}
                  tone={piAwaiting > 0 ? "amber" : "emerald"}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-transparent">
                <div className="flex gap-5" role="tablist">
                {[
                  { id: "visits", label: `Visits · ${visitColumns.length}` },
                  {
                    id: "queries",
                    label: `Query management · ${(queryCounts.open ?? 0) + (queryCounts.inProcess ?? 0) + (queryCounts.closed ?? 0)}`,
                  },
                ].map((tab) => {
                  const active = patientMainTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onPatientMainTabChange?.(tab.id)}
                      className={cn(
                        "relative pb-2.5 text-sm font-semibold transition",
                        active ? "text-emerald-900" : "text-slate-500 hover:text-slate-800",
                      )}
                    >
                      {tab.label}
                      {active ? (
                        <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-600" />
                      ) : null}
                    </button>
                  )
                })}
                </div>
                {patientMainTab === "visits" ? (
                  <div
                    className="mb-2 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"
                    aria-label="Visit status legend"
                  >
                    <span className="normal-case tracking-normal text-slate-400">Status</span>
                    {[
                      { id: "pending", label: "Pending" },
                      { id: "inprocess", label: "In process" },
                      { id: "completed", label: "Completed" },
                    ].map((item) => {
                      const meta = patientCrfStatusMeta(item.id)
                      return (
                        <span key={item.id} className="inline-flex items-center gap-1.5 normal-case tracking-normal text-slate-600">
                          <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden />
                          {item.label}
                        </span>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {patientMainTab === "queries" ? (
                queryPanelProps ? (
                  <EcrfPatientQueryManagementPanel
                    {...(() => {
                      const { queryCounts: _qc, ...panelProps } = queryPanelProps
                      return panelProps
                    })()}
                    className="min-h-0 border-0 bg-transparent shadow-none"
                  />
                ) : null
              ) : (
                <div className="space-y-2">
                  {visitColumns.length === 0 ? (
                    <p className="py-12 text-center text-sm text-slate-500">No visits configured for this study.</p>
                  ) : (
                    visitColumns.map((visit) => {
                      const cell = resolveMatrixVisitCell(selectedPatient, visit)
                      const lockReason = getVisitLockReason?.(selectedPatient, visit) || ""
                      const locked = Boolean(lockReason)
                      const theme = ECRF_MATRIX_STATUS[locked ? "locked" : cell.status] || ECRF_MATRIX_STATUS.pending
                      const isSelected = String(selectedVisitId) === String(visit.id)
                      const loading = Boolean(loadingFormsByVisit?.[visit.id])
                      const isExpanded = String(expandedVisitId) === String(visit.id)
                      const formsForVisit = Array.isArray(formsByVisit?.[visit.id]) ? formsByVisit[visit.id] : []
                      const piCounts =
                        typeof getVisitPiCounts === "function"
                          ? getVisitPiCounts(visit.visitScheduleId ?? visit.id, selectedPatient.id)
                          : { pending: 0, signed: 0 }
                      const fieldsCountLabel =
                        cell.hasFieldProgress && cell.requiredFieldCount > 0
                          ? `${cell.completedRequiredFieldCount}/${cell.requiredFieldCount}`
                          : "—"
                      const fieldsPercentLabel = `${cell.progressPercent || 0}%`
                      const showSdv = cell.sdvTotal > 0
                      const showPi = (piCounts.pending || 0) + (piCounts.signed || 0) > 0
                      const hasOpenQueries = Number(cell.openQueries) > 0
                      const statusLabel = locked
                        ? "Locked"
                        : hasOpenQueries
                          ? cell.openQueries === 1
                            ? "1 open query"
                            : `${cell.openQueries} open queries`
                          : theme.label
                      const Chevron = isExpanded ? ChevronUp : ChevronDown

                      return (
                        <div
                          key={visit.id}
                          className={cn(
                            "overflow-hidden rounded-2xl border transition",
                            locked
                              ? "border-slate-200 bg-slate-50/90 opacity-80"
                              : hasOpenQueries
                                ? "border-amber-300/90 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/50"
                                : "border-slate-200/90 bg-white",
                            (isSelected || isExpanded) &&
                              !locked &&
                              (hasOpenQueries
                                ? "ring-1 ring-amber-300/60"
                                : "border-emerald-400 ring-1 ring-emerald-300/50"),
                          )}
                        >
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              if (locked) {
                                onLockedTap?.(lockReason)
                                return
                              }
                              onVisitClick?.(selectedPatient, visit)
                            }}
                            className={cn(
                              "grid w-full items-center gap-x-3 gap-y-3 px-4 py-3.5 text-left transition",
                              "grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(10rem,12rem)_auto_auto_minmax(6.5rem,auto)_2rem]",
                              !locked &&
                                (hasOpenQueries ? "hover:bg-amber-50/40" : "hover:bg-emerald-50/25"),
                            )}
                          >
                          <div className="flex min-w-0 items-center gap-3">
                            <VisitStatusIcon
                              status={cell.status}
                              locked={locked}
                              openQueries={hasOpenQueries ? cell.openQueries : 0}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-sm font-bold",
                                  hasOpenQueries && !locked ? "text-amber-950" : "text-slate-900",
                                )}
                              >
                                {visit.name || "Visit"}
                                <span
                                  className={cn(
                                    "font-medium",
                                    hasOpenQueries && !locked ? "text-amber-800" : "text-slate-500",
                                  )}
                                >
                                  {" "}
                                  · {statusLabel}
                                </span>
                              </p>
                              {locked && lockReason ? (
                                <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{lockReason}</p>
                              ) : null}
                            </div>
                            {/* Mobile chevron — always visible beside title */}
                            {!locked ? (
                              <span
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border md:hidden",
                                  hasOpenQueries
                                    ? "border-amber-200 bg-amber-50 text-amber-800"
                                    : "border-slate-200 bg-slate-50 text-slate-600",
                                )}
                              >
                                <Chevron className="h-4 w-4" aria-hidden />
                              </span>
                            ) : null}
                          </div>

                          <div className="min-w-0 w-full md:w-auto">
                            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                              <span
                                className={cn(
                                  "text-[10px] font-semibold uppercase tracking-[0.08em]",
                                  hasOpenQueries && !locked ? "text-amber-700/80" : "text-slate-400",
                                )}
                              >
                                Progress
                              </span>
                              <span
                                className={cn(
                                  "text-[12px] font-semibold tabular-nums",
                                  hasOpenQueries && !locked
                                    ? "text-amber-900"
                                    : (cell.progressPercent || 0) === 0 && !locked
                                      ? "text-red-600"
                                      : "text-slate-700",
                                )}
                              >
                                {loading ? "…" : fieldsPercentLabel}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "h-2 overflow-hidden rounded-full",
                                hasOpenQueries && !locked ? "bg-amber-100" : "bg-slate-100",
                              )}
                            >
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  locked
                                    ? "bg-slate-300"
                                    : hasOpenQueries
                                      ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                      : "bg-emerald-500",
                                )}
                                style={{ width: `${Math.min(100, cell.progressPercent || 0)}%` }}
                              />
                            </div>
                            {fieldsCountLabel !== "—" ? (
                              <p
                                className={cn(
                                  "mt-1 text-[10px] tabular-nums",
                                  hasOpenQueries && !locked ? "text-amber-800/80" : "text-slate-400",
                                )}
                              >
                                Fields {fieldsCountLabel}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex justify-start">
                            {showSdv ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                                  cell.sdvPending > 0
                                    ? "border-sky-200 bg-sky-50 text-sky-900"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-800",
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white",
                                    cell.sdvPending > 0 ? "bg-sky-600" : "bg-emerald-600",
                                  )}
                                >
                                  S
                                </span>
                                SDV {cell.sdvDone}/{cell.sdvTotal}
                              </span>
                            ) : (
                              <span className="hidden text-[11px] text-slate-300 md:inline">—</span>
                            )}
                          </div>

                          <div className="flex justify-start">
                            {showPi ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                                  piCounts.pending > 0
                                    ? "border-amber-200 bg-amber-50 text-amber-950"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-800",
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white",
                                    piCounts.pending > 0 ? "bg-amber-500" : "bg-emerald-600",
                                  )}
                                >
                                  P
                                </span>
                                {piCounts.pending > 0 ? "PI pending" : "PI signed"}
                              </span>
                            ) : (
                              <span className="hidden text-[11px] text-slate-300 md:inline">—</span>
                            )}
                          </div>

                          <div className="flex justify-start md:justify-end">
                            {cell.openQueries > 0 ? (
                              <span
                                role="link"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onVisitQueryClick?.(selectedPatient, visit)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onVisitQueryClick?.(selectedPatient, visit)
                                  }
                                }}
                                className="cursor-pointer whitespace-nowrap text-[12px] font-semibold text-amber-700 underline decoration-amber-300 underline-offset-2"
                              >
                                {cell.openQueries} open {cell.openQueries === 1 ? "query" : "queries"}
                              </span>
                            ) : (
                              <span className="whitespace-nowrap text-[12px] font-medium text-slate-400">
                                No open queries
                              </span>
                            )}
                          </div>

                          {!locked ? (
                            <span
                              className={cn(
                                "hidden h-8 w-8 shrink-0 items-center justify-center justify-self-end rounded-lg border md:inline-flex",
                                hasOpenQueries
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-slate-200 bg-slate-50 text-slate-700",
                              )}
                              aria-hidden
                            >
                              <Chevron className="h-4 w-4" strokeWidth={2.25} />
                            </span>
                          ) : (
                            <span className="hidden md:block" aria-hidden />
                          )}
                          </button>

                          {isExpanded ? (
                            <div
                              className={cn(
                                "border-t px-4 pb-3.5 pt-3",
                                hasOpenQueries ? "border-amber-200/80" : "border-slate-200/75",
                              )}
                            >                              <p className="mb-2 text-xs font-semibold text-slate-600">Select Form:</p>
                              {loading ? (
                                <div
                                  className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500"
                                  role="status"
                                  aria-busy="true"
                                >
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                                  Loading forms…
                                </div>
                              ) : formsForVisit.length === 0 ? (
                                <p className="py-2 text-center text-xs text-slate-500">No forms available</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {formsForVisit.map((form) => {
                                    const formStatus = form.status || "notstarted"
                                    const status = FormStatusMeta(formStatus)
                                    const StatusIcon = status.icon
                                    const titles = formPickerTitles(form)
                                    const isSdvDone = Boolean(form.isSdvVerify ?? form.IsSdvVerify)

                                    return (
                                      <button
                                        key={form.id}
                                        type="button"
                                        disabled={form.canView === false}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onFormSelect?.(form, visit)
                                        }}
                                        className={cn(
                                          "w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-left text-xs transition-all hover:border-emerald-300 hover:bg-emerald-50/60",
                                          form.canView === false && "cursor-not-allowed opacity-50",
                                        )}
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <div className="truncate font-semibold text-slate-900">
                                              {titles.title}
                                            </div>
                                            {titles.subtitle ? (
                                              <div className="mt-0.5 truncate text-xs text-slate-500">
                                                {titles.subtitle}
                                              </div>
                                            ) : null}
                                          </div>
                                          <div className="ml-3 flex shrink-0 flex-col items-end gap-1">
                                            <div className="flex items-center gap-2">
                                              <div className={`h-2 w-2 rounded-full ${status.color}`} />
                                              <div className="flex items-center gap-1">
                                                <StatusIcon className={`h-3 w-3 ${status.textClass}`} />
                                                <span className={`text-xs font-medium ${status.textClass}`}>
                                                  {status.text}
                                                </span>
                                              </div>
                                            </div>
                                            {isSdvDone ? (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                                                <ShieldCheck className="h-3 w-3" aria-hidden />
                                                SDV done
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
