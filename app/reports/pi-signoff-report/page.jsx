"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import SdvReportFilters from "@/components/reports/SdvReportFilters"
import ReportDenseCopyCell from "@/components/reports/ReportDenseCopyCell"
import ReportMetricChip from "@/components/reports/ReportMetricChip"
import { TruncTooltipCopyCell } from "@/components/reports/trunc-tooltip-copy-cell"
import { usePiSignoffReportCascadingFilters } from "@/app/reports/_hooks/usePiSignoffReportCascadingFilters"
import {
  PI_SIGNOFF_REPORT_STATUS_OPTIONS,
  REPORT_CARD_CLASS,
  REPORT_FILTER_HEADER_CLASS,
  REPORT_HEADER_ICON_WRAP_CLASS,
  REPORT_PAGE_SHELL_CLASS,
  REPORT_PAGE_SIZE_OPTIONS,
  REPORT_PRIMARY_BTN_CLASS,
  REPORT_RESULTS_HEADER_CLASS,
  REPORT_SELECT_CONTENT_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  REPORT_SELECT_TRIGGER_CLASS,
  REPORT_TABLE_BODY_CLASS,
  REPORT_TABLE_HEAD_ROW_CLASS,
  REPORT_TABLE_SCROLL_CLASS,
  REPORT_TABLE_TD_CLASS,
  REPORT_TABLE_TH_CLASS,
  REPORT_TABLE_TR_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import { getPiSignoffPatientIdDisplay } from "@/lib/reports/piSignoffReportDisplay"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportDownloadActions, { REPORT_CSV_PDF_FORMATS } from "@/components/reports/ReportDownloadActions"
import { useInlineDualExport } from "@/lib/hooks/useInlineDualExport"
import { pickDtoField, toReportDisplay } from "@/lib/reports/reportRowDisplay"
import piSignoffReportService from "@/lib/services/piSignoffReport.service"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { FileCheck, Filter, Loader2, Search, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const COLUMNS = [
  { key: "siteName", label: "Site", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "patientEnrolmentId", label: "Patient ID", copyable: true, colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "patientInitial", label: "Initial", copyable: true, fullDisplay: true, colClass: "w-[5.5rem] min-w-[5.5rem]" },
  { key: "visitName", label: "Visit", copyable: true, truncTooltip: true, colClass: "w-[8.5rem] max-w-[8.5rem]" },
  { key: "crfName", label: "CRF", copyable: true, truncTooltip: true, colClass: "w-[12rem] max-w-[12rem]" },
  { key: "piSignoffStatus", label: "PI Status", colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "totalEligibleFields", label: "Eligible Fields", colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "piSignedFields", label: "PI Done", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "piPendingFields", label: "PI Pending", colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "piSignedBy", label: "Signed By", copyable: true, truncTooltip: true, colClass: "w-[8rem] max-w-[8rem]" },
  { key: "piSignedAt", label: "Signed At (UTC)", colClass: "w-[10rem] max-w-[10rem]" },
]

function renderCell(row, column) {
  switch (column.key) {
    case "patientEnrolmentId":
      return getPiSignoffPatientIdDisplay(row)
    default:
      return toReportDisplay(pickDtoField(row, column.key))
  }
}

export default function PiSignoffReportPage() {
  const { canExport: canExportReport, assertCanExport, reportKey, withWorkspace } =
    useReportExportAccess("PI_SIGNOFF_REPORT")
  const { exportingFormat, executeExport } = useInlineDualExport()
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [reportTotalPages, setReportTotalPages] = useState(0)

  const {
    filters,
    setFilters,
    studies,
    sites,
    patients,
    visits,
    crfForms,
    loadingStudies,
    loadingCascade,
    studyRequiredError,
    setStudyRequiredError,
    piSignoffEnabledForStudy,
    ensurePiSignoffEnabledForStudy,
    handleFilterChange,
    hasStudySelected,
    hasSiteSelected,
    hasPatientSelected,
    hasVisitSelected,
    hasActiveFilters,
    resetFilterUi,
    studySearch,
    setStudySearch,
    siteSearch,
    setSiteSearch,
    patientSearch,
    setPatientSearch,
    visitSearch,
    setVisitSearch,
    crfSearch,
    setCrfSearch,
  } = usePiSignoffReportCascadingFilters()

  const totalPages = useMemo(() => {
    const ps = Number(filters.pageSize) || 50
    const fromApi = Number(reportTotalPages) || 0
    if (fromApi > 0) return fromApi
    const ceil = Math.ceil((Number(totalCount) || 0) / ps)
    return ceil > 0 ? ceil : 0
  }, [reportTotalPages, totalCount, filters.pageSize])

  const loadReport = useCallback(
    async (nextFilters) => {
      const studyId = parseInt(String(nextFilters.studyId || ""), 10)
      if (!Number.isFinite(studyId) || studyId <= 0) return

      setLoading(true)
      try {
        await ensurePiSignoffEnabledForStudy(studyId)
        const response = await piSignoffReportService.getVisitSummary(withWorkspace(nextFilters))
        const { items, summary: nextSummary, totalCount: tc, totalPages: tp, pageNumber, pageSize } =
          piSignoffReportService.normalizeReportPage(response)
        setRows(items)
        setSummary(nextSummary)
        setTotalCount(tc)
        setReportTotalPages(tp)
        setFilters((prev) => {
          const nextPageNumber = Number(pageNumber) || prev.pageNumber || 1
          const nextPageSize = Number(pageSize) || prev.pageSize || 10
          if (prev.pageNumber === nextPageNumber && prev.pageSize === nextPageSize) return prev
          return { ...prev, pageNumber: nextPageNumber, pageSize: nextPageSize }
        })
      } catch (error) {
        toast.error(error?.message || "Failed to load PI sign-off report")
        setRows([])
        setSummary(null)
        setTotalCount(0)
        setReportTotalPages(0)
      } finally {
        setLoading(false)
      }
    },
    [ensurePiSignoffEnabledForStudy, setFilters],
  )

  const handleSearch = useCallback(async () => {
    if (!String(filters.studyId || "").trim()) {
      setStudyRequiredError(true)
      toast.error("Study is required.")
      return
    }
    const next = { ...filters, pageNumber: 1 }
    setFilters(next)
    await loadReport(next)
  }, [filters, loadReport, setFilters, setStudyRequiredError])

  const lastAutoSearchStudyRef = useRef("")

  useEffect(() => {
    const studyId = String(filters.studyId || "").trim()
    if (!studyId || studyId === lastAutoSearchStudyRef.current) return
    lastAutoSearchStudyRef.current = studyId
    setStudyRequiredError(false)
    void loadReport({ ...filters, pageNumber: 1 })
    // Auto-load when study is picked (header context or dropdown), not when site/patient filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: studyId gate only
  }, [filters.studyId])

  const handleClear = useCallback(() => {
    lastAutoSearchStudyRef.current = ""
    resetFilterUi()
    setRows([])
    setSummary(null)
    setTotalCount(0)
    setReportTotalPages(0)
  }, [resetFilterUi])

  const handleExport = useCallback(
    async (format) => {
      if (!assertCanExport()) return
      if (!String(filters.studyId || "").trim()) {
        setStudyRequiredError(true)
        toast.error("Study is required.")
        return
      }
      await executeExport(format, async () => {
        await piSignoffReportService.exportPiSignoffReport(withWorkspace(filters), format)
        toast.success(`PI sign-off report exported as ${format.toUpperCase()}.`)
      })
    },
    [assertCanExport, executeExport, filters, setStudyRequiredError],
  )

  const disabledBanner =
    piSignoffEnabledForStudy === false ? (
      <div className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
        PI sign-off is not enabled for the selected study. Turn on <strong>PI sign-off required</strong> in Study
        Settings.
      </div>
    ) : null

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className={REPORT_HEADER_ICON_WRAP_CLASS}>
                <FileCheck className="h-5 w-5 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">PI Sign-off Report</h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Select one study to view submitted CRF PI completion (overall sign-off and per-field progress when Field +
              CRF is enabled). Uses the study from the header when set.
            </p>
          </div>
        </div>

        {disabledBanner}

        <div className={cn(REPORT_CARD_CLASS, "mb-4")}>
          <div className={REPORT_FILTER_HEADER_CLASS}>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Filter className="h-4 w-4 text-indigo-600" />
              Filters
            </div>
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>

          <SdvReportFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            studies={studies}
            sites={sites}
            patients={patients}
            visits={visits}
            crfForms={crfForms}
            loadingStudies={loadingStudies}
            loadingCascade={loadingCascade}
            studyRequiredError={studyRequiredError}
            studySearch={studySearch}
            onStudySearchChange={setStudySearch}
            siteSearch={siteSearch}
            onSiteSearchChange={setSiteSearch}
            patientSearch={patientSearch}
            onPatientSearchChange={setPatientSearch}
            visitSearch={visitSearch}
            onVisitSearchChange={setVisitSearch}
            crfSearch={crfSearch}
            onCrfSearchChange={setCrfSearch}
            hasStudySelected={hasStudySelected}
            hasSiteSelected={hasSiteSelected}
            hasPatientSelected={hasPatientSelected}
            hasVisitSelected={hasVisitSelected}
            showFieldSdvFilter={false}
            studyAllOptionLabel={null}
          />

          <div className="grid grid-cols-1 gap-3 border-t border-slate-200/70 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-bold text-slate-700">PI sign-off status</label>
              <Select
                value={filters.piSignoffStatus || "all"}
                onValueChange={(v) => handleFilterChange("piSignoffStatus", v === "all" ? "" : v)}
              >
                <SelectTrigger className={REPORT_SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                  {PI_SIGNOFF_REPORT_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value || "all"} value={opt.value || "all"} className={REPORT_SELECT_ITEM_CLASS}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/70 px-4 py-3">
            <Button type="button" className={REPORT_PRIMARY_BTN_CLASS} onClick={() => void handleSearch()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </Button>
            <ReportDownloadActions
              canExport={canExportReport}
              reportKey={reportKey}
              assertCanExport={assertCanExport}
              defaultSubject="PI Sign-off Report"
              defaultFormat="pdf"
              enabledFormats={REPORT_CSV_PDF_FORMATS}
              disabled={!hasStudySelected || loading}
              busy={exportingFormat != null}
              onExport={async ({ format, pageSize, orientation }) => {
                await handleExport(format, { pageSize, orientation })
              }}
            />
          </div>
        </div>

        {summary ? (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
            <ReportMetricChip label="Submitted CRFs" value={summary.totalSubmittedCrfs} />
            <ReportMetricChip label="PI signed" value={summary.piSignedCrfs} tone="success" />
            <ReportMetricChip label="PI pending" value={summary.piPendingCrfs} tone="warning" />
            <ReportMetricChip label="PI voided" value={summary.piVoidedCrfs} tone="danger" />
            {summary.totalEligibleFields > 0 ? (
              <>
                <ReportMetricChip label="Eligible fields" value={summary.totalEligibleFields} tone="info" />
                <ReportMetricChip label="Field PI done" value={summary.piSignedFields} tone="success" />
                <ReportMetricChip label="Field PI pending" value={summary.piPendingFields} tone="warning" />
              </>
            ) : null}
          </div>
        ) : null}

        <div className={REPORT_CARD_CLASS}>
          <div className={REPORT_RESULTS_HEADER_CLASS}>
            <h2 className="text-sm font-bold text-slate-900">PI sign-off entries</h2>
            {totalCount > 0 ? (
              <span className="text-xs font-medium text-slate-500">{totalCount} total</span>
            ) : null}
          </div>

          {loading ? (
            <SectionSkeleton title="Loading PI sign-off report..." rows={8} variant="audit" />
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="font-medium text-slate-600">No PI sign-off records found</p>
              <p className="mt-1 text-sm text-slate-500">
                {hasStudySelected
                  ? "Adjust filters or confirm submitted CRFs exist for this study."
                  : "Select a study and click Search."}
              </p>
            </div>
          ) : (
            <>
              <div className={REPORT_TABLE_SCROLL_CLASS} role="region" aria-label="PI sign-off report results">
                <table className="w-full min-w-[960px] border-collapse text-left">
                  <thead>
                    <tr className={REPORT_TABLE_HEAD_ROW_CLASS}>
                      {COLUMNS.map((column) => (
                        <th key={column.key} className={cn(REPORT_TABLE_TH_CLASS, column.colClass)}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={REPORT_TABLE_BODY_CLASS}>
                    {rows.map((row, index) => (
                      <tr key={pickDtoField(row, "crfDataId") ?? index} className={REPORT_TABLE_TR_CLASS}>
                        {COLUMNS.map((column) => {
                          const cellText = renderCell(row, column)
                          return (
                            <td key={column.key} className={cn(REPORT_TABLE_TD_CLASS, column.colClass)}>
                              {column.truncTooltip ? (
                                <TruncTooltipCopyCell
                                  value={String(pickDtoField(row, column.key) ?? cellText === "-" ? "" : cellText)}
                                  textClassName="text-sm"
                                  disableCopy={!column.copyable}
                                />
                              ) : (
                                <ReportDenseCopyCell
                                  text={cellText}
                                  copyable={column.copyable}
                                  truncate={!column.fullDisplay}
                                />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 0 ? (
                <div className="border-t border-slate-200/70 px-4 py-3">
                  <DataPagination
                    currentPage={Number(filters.pageNumber) || 1}
                    pageSize={Number(filters.pageSize) || 10}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    onPageChange={(page) => {
                      setFilters((prev) => {
                        const next = { ...prev, pageNumber: page }
                        void loadReport(next)
                        return next
                      })
                    }}
                    onPageSizeChange={(size) => {
                      setFilters((prev) => {
                        const next = { ...prev, pageSize: size, pageNumber: 1 }
                        void loadReport(next)
                        return next
                      })
                    }}
                    itemName="rows"
                    showPageSizeSelector={true}
                    pageSizeOptions={REPORT_PAGE_SIZE_OPTIONS}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
