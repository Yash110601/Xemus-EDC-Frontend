"use client"

import { useCallback, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import StudySitePatientReportFilters from "@/components/reports/StudySitePatientReportFilters"
import { useStudySitePatientFilters } from "@/app/reports/_hooks/useStudySitePatientFilters"
import {
  CRF_QUERY_AGE_FILTER_OPTIONS,
  CRF_QUERY_REPORT_INITIAL_FILTERS,
  REPORT_FILTER_FIELD_CLASS,
  REPORT_PAGE_SIZE_OPTIONS,
  REPORT_SELECT_CONTENT_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  REPORT_SELECT_TRIGGER_CLASS,
  REPORT_PAGE_SHELL_WITH_BG_CLASS,
  REPORT_PREMIUM_TABLE_SCROLL_CLASS,
  REPORT_MOBILE_TABLE_HINT,
} from "@/lib/reports/studySitePatientReportUi"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import crfQueryManagementService from "@/lib/services/crfQueryManagement.service"
import { toast } from "sonner"
import { ClipboardList, Filter, Loader2, Search, X } from "lucide-react"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportDownloadActions from "@/components/reports/ReportDownloadActions"
import { TruncTooltipCopyCell } from "@/components/reports/trunc-tooltip-copy-cell"
import {
  decodeHtmlEntities,
  formatQueryGridDateUtcWithSeconds,
  formatQueryGridScalar,
  getQueryStatusLabel,
  getQueryStatusPillClass,
  queryDtoPick,
  queryGridTypeLabel,
  rowMatchesQuerySearch,
} from "@/lib/reports/crmQueryTableDisplay"

const parseIsoDate = (value) => {
  if (!value) return null
  const [year, month, day] = String(value).split("-").map((part) => Number(part))
  if (!year || !month || !day) return null
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default function QueryManagementReportPage() {
  const pathname = usePathname()
  const { canExport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [reportTotalPages, setReportTotalPages] = useState(0)
  const [tableSearch, setTableSearch] = useState("")

  const {
    filters,
    setFilters,
    studies,
    sites,
    patients,
    loadingStudies,
    loadingSites,
    loadingPatients,
    studySearch,
    setStudySearch,
    siteSearch,
    setSiteSearch,
    patientSearch,
    setPatientSearch,
    studyRequiredError,
    setStudyRequiredError,
    handleFilterChange,
    hasStudySelected,
    hasActiveFilters,
    activeFilterCount,
    resetFilterUi,
  } = useStudySitePatientFilters({ initialFilters: CRF_QUERY_REPORT_INITIAL_FILTERS })

  const pageInfo = useMemo(() => {
    return {
      title: "Query Management Report",
      description: "Review manual and system queries with study, site, and patient context.",
    }
  }, [pathname])

  const displayedRows = useMemo(() => {
    if (!tableSearch.trim()) return rows
    return rows.filter((row) => rowMatchesQuerySearch(row, tableSearch))
  }, [rows, tableSearch])

  const totalPages = useMemo(() => {
    const ps = Number(filters.pageSize) || 10
    const fromApi = Number(reportTotalPages) || 0
    if (fromApi > 0) return fromApi
    const ceil = Math.ceil((Number(totalCount) || 0) / ps)
    return ceil > 0 ? ceil : 0
  }, [reportTotalPages, totalCount, filters.pageSize])

  const loadReport = useCallback(async (nextFilters) => {
    setLoading(true)
    try {
      const response = await crfQueryManagementService.getCrfQueryReport(withWorkspace(nextFilters))
      const { items, totalCount: tc, totalPages: tp } = crfQueryManagementService.normalizeCrfQueryReportPage(response)
      setRows(items)
      setTotalCount(tc)
      setReportTotalPages(tp)
    } catch (error) {
      const message = error?.message || "Failed to load report"
      toast.error(message)
      setRows([])
      setTotalCount(0)
      setReportTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = useCallback(() => {
    if (!String(filters.studyId || "").trim()) {
      setStudyRequiredError(true)
      toast.error("Study is required.")
      return
    }
    const fromDate = parseIsoDate(filters.dateFrom)
    const toDate = parseIsoDate(filters.dateTo)
    if (fromDate && toDate && fromDate > toDate) {
      toast.error("Date From cannot be after Date To.")
      return
    }
    const next = { ...filters, pageNumber: 1 }
    setFilters(next)
    loadReport(next)
  }, [filters, loadReport, setFilters, setStudyRequiredError])

  const handleClear = useCallback(() => {
    resetFilterUi()
    setTableSearch("")
    setRows([])
    setTotalCount(0)
    setReportTotalPages(0)
  }, [resetFilterUi])

  const handleExport = useCallback(async () => {
    if (!assertCanExport()) return
    if (isExporting) return
    if (!String(filters.studyId || "").trim()) {
      setStudyRequiredError(true)
      toast.error("Study is required.")
      return
    }
    const fromDate = parseIsoDate(filters.dateFrom)
    const toDate = parseIsoDate(filters.dateTo)
    if (fromDate && toDate && fromDate > toDate) {
      toast.error("Date From cannot be after Date To.")
      return
    }
    setIsExporting(true)
    try {
      await crfQueryManagementService.exportCrfQueryReport(withWorkspace(filters))
      toast.success("CSV exported successfully.")
    } catch (error) {
      toast.error(error?.message || "Export failed")
    } finally {
      setIsExporting(false)
    }
  }, [assertCanExport, filters, isExporting, setStudyRequiredError])

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_WITH_BG_CLASS}>
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br btn-brand-gradient rounded-xl shadow-lg">
              <ClipboardList className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-1">{pageInfo.title}</h1>
              <p className="text-slate-600">{pageInfo.description}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-800">Filter Criteria</h2>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-xs font-semibold">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          <StudySitePatientReportFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            studies={studies}
            sites={sites}
            patients={patients}
            loadingStudies={loadingStudies}
            loadingSites={loadingSites}
            loadingPatients={loadingPatients}
            studySearch={studySearch}
            onStudySearchChange={setStudySearch}
            siteSearch={siteSearch}
            onSiteSearchChange={setSiteSearch}
            patientSearch={patientSearch}
            onPatientSearchChange={setPatientSearch}
            studyRequiredError={studyRequiredError}
            firstRowBeforeSearch={
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Query age</label>
                <Select
                  value={filters.queryAgeFilter || "All"}
                  onValueChange={(value) => handleFilterChange("queryAgeFilter", value)}
                >
                  <SelectTrigger className={cn(REPORT_SELECT_TRIGGER_CLASS, "!w-full min-w-0 max-w-full")}>
                    <SelectValue placeholder="All ages" />
                  </SelectTrigger>
                  <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                    {CRF_QUERY_AGE_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className={REPORT_SELECT_ITEM_CLASS}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          />

          <div className="px-6 pb-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleSearch}
              disabled={loading || !hasStudySelected}
              className="bg-gradient-to-r btn-brand-gradient  text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Search
            </Button>
            <Button type="button" onClick={handleClear} variant="outline" disabled={!hasStudySelected || !hasActiveFilters || loading}>
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <div className="flex-1" />
            <ReportDownloadActions
              canExport={canExport}
              reportKey={reportKey}
              assertCanExport={assertCanExport}
              defaultSubject="Query Management Report"
              defaultFormat="csv"
              enabledFormats={["csv"]}
              disabled={!hasStudySelected}
              busy={isExporting}
              onExport={async ({ format, pageSize, orientation }) => {
                await handleExport(format, { pageSize, orientation })
              }}
            />
          </div>
          {!hasStudySelected && (
            <p className="text-xs text-slate-500 px-6 pb-4">
              Select Study first to enable Search, Clear, and Export actions.
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/75 shadow-[0_8px_36px_-18px_rgba(15,23,42,0.18)] backdrop-blur-md ring-1 ring-white/60">
          <div className="border-b border-slate-200/70 bg-gradient-to-r from-slate-50/95 via-white/90 to-emerald-50/30 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                Query management
                {totalCount > 0 && (
                  <span className="ml-1.5 text-[11px] font-normal text-slate-500">({totalCount} total)</span>
                )}
              </h2>
              {rows.length > 0 ? (
                <p className="w-full text-xs text-slate-500 md:hidden">{REPORT_MOBILE_TABLE_HINT}</p>
              ) : null}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search in queries…"
                  disabled={rows.length === 0}
                  className="h-9 w-52 rounded-full border border-slate-200/90 bg-white/90 px-9 pr-3 text-[12px] text-slate-800 shadow-sm outline-none ring-0 backdrop-blur-sm placeholder:text-slate-400 focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50 sm:w-64"
                  aria-label="Search in queries on this page"
                />
              </div>
            </div>
            {tableSearch.trim() && rows.length > 0 && (
              <p className="mt-2 text-[10px] text-slate-500">
                Filtering <span className="font-semibold text-slate-600">{displayedRows.length}</span> of{" "}
                <span className="font-semibold text-slate-600">{rows.length}</span> rows on this page.
              </p>
            )}
          </div>

          {loading ? (
            <div className="p-4">
              <SectionSkeleton title="Loading report..." rows={7} variant="audit" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No rows found</p>
              <p className="text-slate-500 text-sm">
                {!hasStudySelected
                  ? "Select Study and click Search to view report data."
                  : hasActiveFilters
                    ? "Try adjusting your filters to see more results."
                    : "No records are available at this time."}
              </p>
            </div>
          ) : (
            <>
              <div
                className={REPORT_PREMIUM_TABLE_SCROLL_CLASS}
                role="region"
                aria-label="Query management results"
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left">
                    <thead>
                      <tr>
                        <th className="sticky top-0 z-20 h-10 whitespace-nowrap border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] backdrop-blur-md">
                          Id
                        </th>
                        <th className="sticky top-0 z-20 h-10 whitespace-nowrap border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Study
                        </th>
                        <th className="sticky top-0 z-20 h-10 whitespace-nowrap border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Site
                        </th>
                        <th className="sticky top-0 z-20 h-10 whitespace-nowrap border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Patient
                        </th>
                        <th className="sticky top-0 z-20 h-10 whitespace-nowrap border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Status
                        </th>
                        <th className="sticky top-0 z-20 h-10 whitespace-nowrap border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Type
                        </th>
                        <th className="sticky top-0 z-20 h-10 border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Field
                        </th>
                        <th className="sticky top-0 z-20 h-10 whitespace-nowrap border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Query age (days)
                        </th>
                        <th className="sticky top-0 z-20 h-10 border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Query
                        </th>
                        <th className="sticky top-0 z-20 h-10 border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Current value
                        </th>
                        <th className="sticky top-0 z-20 h-10 border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Visit name
                        </th>
                        <th className="sticky top-0 z-20 h-10 border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          CRF name
                        </th>
                        <th className="sticky top-0 z-20 h-10 border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Raised by
                        </th>
                        <th className="sticky top-0 z-20 h-10 border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Assigned
                        </th>
                        <th className="sticky top-0 z-20 h-10 border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Approver
                        </th>
                        <th className="sticky top-0 z-20 h-10 border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Reviewer cmt
                        </th>
                        <th className="sticky top-0 z-20 h-10 border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Submitter cmt
                        </th>
                        <th className="sticky top-0 z-20 h-10 whitespace-nowrap border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Created At (UTC)
                        </th>
                        <th className="sticky top-0 z-20 h-10 whitespace-nowrap border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md">
                          Closed At (UTC)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/90">
                      {displayedRows.map((row, qIdx) => {
                        const id = row?.id ?? row?.queryId
                        const st = row?.status
                        const visitRaw =
                          queryDtoPick(row, "visitName", "VisitName") || queryDtoPick(row, "visitScheduleId", "VisitScheduleId")
                        const crfRaw =
                          queryDtoPick(row, "crfDesignName", "CrfDesignName", "crfName", "CrfName") ||
                          queryDtoPick(row, "crfDesignId", "CrfDesignId")
                        const currentValRaw = queryDtoPick(
                          row,
                          "currentValue",
                          "CurrentValue",
                          "actualValue",
                          "ActualValue",
                          "actual",
                          "Actual",
                        )
                        const currentValueDisplay = formatQueryGridScalar(currentValRaw === "" ? null : currentValRaw)
                        return (
                          <tr
                            key={String(row?.guid ?? id ?? `q-${qIdx}`)}
                            className="group/row h-11 max-h-11 border-b border-slate-100/95 transition-colors hover:bg-slate-50/90"
                          >
                            <td className="h-11 max-h-11 overflow-hidden whitespace-nowrap px-3 align-middle font-mono text-[10px] text-slate-700">
                              {formatQueryGridScalar(id)}
                            </td>
                            <td className="h-11 max-h-11 w-[148px] min-w-[148px] max-w-[148px] overflow-hidden px-3 align-middle">
                              <TruncTooltipCopyCell
                                value={queryDtoPick(
                                  row,
                                  "studyName",
                                  "StudyName",
                                  "studyProtocolNumber",
                                  "StudyProtocolNumber",
                                )}
                              />
                            </td>
                            <td className="h-11 max-h-11 w-[120px] min-w-[120px] max-w-[120px] overflow-hidden px-3 align-middle">
                              <TruncTooltipCopyCell value={queryDtoPick(row, "siteName", "SiteName")} />
                            </td>
                            <td className="h-11 max-h-11 w-[72px] max-w-[72px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell
                                value={queryDtoPick(
                                  row,
                                  "patientInitials",
                                  "PatientInitials",
                                  "patientInitial",
                                  "PatientInitial",
                                )}
                              />
                            </td>
                            <td className="h-11 max-h-11 whitespace-nowrap px-2 align-middle">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getQueryStatusPillClass(st)}`}
                              >
                                {getQueryStatusLabel(st)}
                              </span>
                            </td>
                            <td className="h-11 max-h-11 w-[76px] max-w-[76px] overflow-hidden whitespace-nowrap px-2 align-middle text-[11px] text-slate-800">
                              {queryGridTypeLabel(row?.queryType)}
                            </td>
                            <td className="h-11 max-h-11 w-[280px] max-w-[280px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell
                                value={decodeHtmlEntities(
                                  queryDtoPick(row, "field", "Field", "fieldLabel", "FieldLabel"),
                                )}
                              />
                            </td>
                            <td className="h-11 max-h-11 whitespace-nowrap px-3 align-middle text-center text-[11px] font-medium text-slate-700 tabular-nums">
                              {formatQueryGridScalar(queryDtoPick(row, "queryAgeDays", "QueryAgeDays"))}
                            </td>
                            <td className="h-11 max-h-11 w-[300px] max-w-[300px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell value={queryDtoPick(row, "queryText", "QueryText")} />
                            </td>
                            <td className="h-11 max-h-11 w-[120px] max-w-[120px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell value={currentValueDisplay} textClassName="text-slate-600" />
                            </td>
                            <td className="h-11 max-h-11 w-[128px] max-w-[128px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell value={visitRaw} />
                            </td>
                            <td className="h-11 max-h-11 w-[160px] max-w-[160px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell value={crfRaw} />
                            </td>
                            <td className="h-11 max-h-11 w-[124px] max-w-[124px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell
                                value={queryDtoPick(
                                  row,
                                  "raisedBy",
                                  "RaisedBy",
                                  "queryRaisedByUserName",
                                  "QueryRaisedByUserName",
                                )}
                              />
                            </td>
                            <td className="h-11 max-h-11 w-[124px] max-w-[124px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell
                                value={queryDtoPick(
                                  row,
                                  "assigned",
                                  "Assigned",
                                  "queryAssignedToUserName",
                                  "QueryAssignedToUserName",
                                )}
                              />
                            </td>
                            <td className="h-11 max-h-11 w-[124px] max-w-[124px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell
                                value={queryDtoPick(
                                  row,
                                  "approver",
                                  "Approver",
                                  "queryApproverUserName",
                                  "QueryApproverUserName",
                                )}
                              />
                            </td>
                            <td className="h-11 max-h-11 w-[140px] max-w-[140px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell
                                value={queryDtoPick(
                                  row,
                                  "reviewerComment",
                                  "ReviewerComment",
                                  "queryApproverComment",
                                  "QueryApproverComment",
                                )}
                                textClassName="text-slate-600"
                              />
                            </td>
                            <td className="h-11 max-h-11 w-[150px] max-w-[150px] overflow-hidden px-2 align-middle">
                              <TruncTooltipCopyCell
                                value={queryDtoPick(
                                  row,
                                  "submitterComment",
                                  "SubmitterComment",
                                  "crfSubmitterComment",
                                  "CrfSubmitterComment",
                                )}
                                textClassName="text-slate-600"
                              />
                            </td>
                            <td className="h-11 max-h-11 whitespace-nowrap px-3 align-middle text-[11px] text-slate-600 tabular-nums">
                              {formatQueryGridDateUtcWithSeconds(queryDtoPick(row, "createdAt", "CreatedAt"))}
                            </td>
                            <td className="h-11 max-h-11 whitespace-nowrap px-3 align-middle text-[11px] text-slate-600 tabular-nums">
                              {formatQueryGridDateUtcWithSeconds(queryDtoPick(row, "closedAt", "ClosedAt"))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {displayedRows.length === 0 && tableSearch.trim() && (
                <p className="border-t border-slate-100 px-4 py-3 text-center text-sm text-slate-500">
                  No queries match &quot;{tableSearch.trim()}&quot; on this page. Clear the box or change filters and Search again.
                </p>
              )}
              {totalPages > 0 && (
                <div className="border-t border-slate-200/80 bg-white/80">
                  <DataPagination
                    currentPage={filters.pageNumber}
                    pageSize={filters.pageSize}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    onPageChange={(page) => {
                      setFilters((prev) => {
                        const next = { ...prev, pageNumber: page }
                        loadReport(next)
                        return next
                      })
                    }}
                    onPageSizeChange={(size) => {
                      setFilters((prev) => {
                        const next = { ...prev, pageSize: size, pageNumber: 1 }
                        loadReport(next)
                        return next
                      })
                    }}
                    itemName="rows"
                    showPageSizeSelector={true}
                    pageSizeOptions={REPORT_PAGE_SIZE_OPTIONS}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
