"use client"

import { useCallback, useMemo, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import SdvReportFilters from "@/components/reports/SdvReportFilters"
import ReportDenseCopyCell from "@/components/reports/ReportDenseCopyCell"
import { TruncTooltipCopyCell } from "@/components/reports/trunc-tooltip-copy-cell"
import { useSdvReportCascadingFilters } from "@/app/reports/_hooks/useSdvReportCascadingFilters"
import {
  REPORT_CARD_CLASS,
  REPORT_FILTER_HEADER_CLASS,
  REPORT_HEADER_ICON_WRAP_CLASS,
  REPORT_PAGE_SHELL_CLASS,
  REPORT_PAGE_SIZE_OPTIONS,
  REPORT_PRIMARY_BTN_CLASS,
  REPORT_RESULTS_HEADER_CLASS,
  REPORT_TABLE_BODY_CLASS,
  REPORT_TABLE_HEAD_ROW_CLASS,
  REPORT_TABLE_SCROLL_CLASS,
  REPORT_TABLE_TD_CLASS,
  REPORT_TABLE_TH_CLASS,
  REPORT_TABLE_TR_CLASS,
  REPORT_VIEW_SEGMENT_ACTIVE_CLASS,
  REPORT_VIEW_SEGMENT_IDLE_CLASS,
  REPORT_VIEW_SEGMENT_WRAP_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import {
  formatSdvApprovedAtUtc,
  formatSdvYesNo,
  getSdvApprovedByLabel,
  getSdvPatientIdDisplay,
} from "@/lib/reports/sdvReportDisplay"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportDownloadActions, { REPORT_CSV_PDF_FORMATS } from "@/components/reports/ReportDownloadActions"
import { pickDtoField, toReportDisplay } from "@/lib/reports/reportRowDisplay"
import sdvReportService from "@/lib/services/sdvReport.service"
import { useInlineDualExport } from "@/lib/hooks/useInlineDualExport"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { FileCheck, Filter, Loader2, Search, X } from "lucide-react"
import ReportMetricChip from "@/components/reports/ReportMetricChip"
import piSignoffReportService from "@/lib/services/piSignoffReport.service"

const TAB_VISIT = "visit"
const TAB_FIELD = "field"

const VISIT_COLUMNS = [
  { key: "siteName", label: "Site", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "patientEnrolmentId", label: "Patient ID", copyable: true, colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "patientInitial", label: "Initial", copyable: true, fullDisplay: true, colClass: "w-[5.5rem] min-w-[5.5rem]" },
  {
    key: "visitName",
    label: "Visit",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[8.5rem] max-w-[8.5rem]",
  },
  {
    key: "crfName",
    label: "CRF",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[12rem] max-w-[12rem]",
  },
  { key: "crfStatus", label: "CRF Status", colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "isSdvVerify", label: "Form SDV Verified", colClass: "w-[7rem] max-w-[7rem]" },
  { key: "rsdvReviewSessionId", label: "RSDV Session", colClass: "w-[5.5rem] max-w-[5.5rem]" },
  {
    key: "rsdvCompletedAtUtc",
    label: "RSDV Completed (UTC)",
    colClass: "w-[10.5rem] max-w-[10.5rem]",
  },
  { key: "totalFields", label: "Total Fields", colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "sdvApprovedFields", label: "SDV Done", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "sdvPendingFields", label: "SDV Pending", colClass: "w-[5.5rem] max-w-[5.5rem]" },
]

const FIELD_COLUMNS = [
  { key: "siteName", label: "Site", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "patientEnrolmentId", label: "Patient ID", copyable: true, colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "patientInitial", label: "Initial", copyable: true, fullDisplay: true, colClass: "w-[5.5rem] min-w-[5.5rem]" },
  {
    key: "visitName",
    label: "Visit",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[6.5rem] max-w-[6.5rem]",
  },
  { key: "crfName", label: "CRF", copyable: true, truncTooltip: true, colClass: "w-[9rem] max-w-[9rem]" },
  {
    key: "fieldLabel",
    label: "Field",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[12rem] max-w-[12rem]",
  },
  {
    key: "fieldValue",
    label: "Value",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[8rem] max-w-[8rem]",
  },
  { key: "crfStatus", label: "CRF Status", colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "isSdvVerify", label: "Form SDV Verified", colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "rsdvReviewSessionId", label: "RSDV Session", colClass: "w-[5rem] max-w-[5rem]" },
  {
    key: "rsdvCompletedAtUtc",
    label: "RSDV Completed (UTC)",
    colClass: "w-[10rem] max-w-[10rem]",
  },
  { key: "isSdvApproved", label: "Field SDV", colClass: "w-[5rem] max-w-[5rem]" },
  { key: "sdvApprovedAt", label: "Approved At(UTC)", colClass: "w-[10.5rem] max-w-[10.5rem]" },
  {
    key: "sdvApprovedBy",
    label: "Approved By",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[9rem] max-w-[9rem]",
  },
]

function visitRowKey(row, index) {
  const crfDataId = pickDtoField(row, "crfDataId")
  if (crfDataId !== undefined && crfDataId !== null) return `visit-${crfDataId}`
  return `visit-${index}`
}

function fieldRowKey(row, index) {
  const controlId = pickDtoField(row, "controlId")
  const crfDataId = pickDtoField(row, "crfDataId")
  if (controlId && crfDataId) return `field-${crfDataId}-${controlId}`
  return `field-${index}`
}

function renderVisitCell(row, column) {
  switch (column.key) {
    case "patientEnrolmentId":
      return getSdvPatientIdDisplay(row)
    case "isSdvVerify":
      return formatSdvYesNo(pickDtoField(row, "isSdvVerify"))
    case "rsdvCompletedAtUtc":
      return formatSdvApprovedAtUtc(pickDtoField(row, "rsdvCompletedAtUtc"))
    default:
      return toReportDisplay(pickDtoField(row, column.key))
  }
}

function renderSdvTableCell(row, column, tab) {
  const cellText = tab === TAB_VISIT ? renderVisitCell(row, column) : renderFieldCell(row, column)

  if (column.truncTooltip) {
    const raw = pickDtoField(row, column.key)
    const value =
      raw === null || raw === undefined || String(raw).trim() === ""
        ? cellText === "-"
          ? ""
          : String(cellText)
        : String(raw)
    return (
      <TruncTooltipCopyCell
        value={value}
        textClassName="text-sm"
        disableCopy={!column.copyable}
      />
    )
  }

  return <ReportDenseCopyCell text={cellText} copyable={column.copyable} truncate={!column.fullDisplay} />
}

function renderFieldCell(row, column) {
  switch (column.key) {
    case "patientEnrolmentId":
      return getSdvPatientIdDisplay(row)
    case "isSdvApproved":
      return formatSdvYesNo(pickDtoField(row, "isSdvApproved"))
    case "isSdvVerify":
      return formatSdvYesNo(pickDtoField(row, "isSdvVerify"))
    case "rsdvCompletedAtUtc":
      return formatSdvApprovedAtUtc(pickDtoField(row, "rsdvCompletedAtUtc"))
    case "sdvApprovedAt":
      return formatSdvApprovedAtUtc(pickDtoField(row, "sdvApprovedAt"))
    case "sdvApprovedBy":
      return getSdvApprovedByLabel(row)
    default:
      return toReportDisplay(pickDtoField(row, column.key))
  }
}

export default function SdvReportPage() {
  const { canExport: canExportReport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess("SDV_REPORT")
  const { exportingFormat, executeExport } = useInlineDualExport()
  const [activeTab, setActiveTab] = useState(TAB_VISIT)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [piSummary, setPiSummary] = useState(null)
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
    sdvConfiguredForStudy,
    ensureSdvConfiguredForStudy,
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
  } = useSdvReportCascadingFilters()

  const columns = activeTab === TAB_VISIT ? VISIT_COLUMNS : FIELD_COLUMNS

  const totalPages = useMemo(() => {
    const ps = Number(filters.pageSize) || 50
    const fromApi = Number(reportTotalPages) || 0
    if (fromApi > 0) return fromApi
    const ceil = Math.ceil((Number(totalCount) || 0) / ps)
    return ceil > 0 ? ceil : 0
  }, [reportTotalPages, totalCount, filters.pageSize])

  const loadReport = useCallback(
    async (nextFilters, tab = activeTab) => {
      const studyId = parseInt(String(nextFilters.studyId || ""), 10)
      if (!Number.isFinite(studyId) || studyId <= 0) return

      setLoading(true)
      try {
        await ensureSdvConfiguredForStudy(studyId)
        const response =
          tab === TAB_FIELD
            ? await sdvReportService.getFieldReport(withWorkspace(nextFilters))
            : await sdvReportService.getVisitSummary(withWorkspace(nextFilters))
        const { items, summary: nextSummary, totalCount: tc, totalPages: tp } =
          sdvReportService.normalizeSdvReportPage(response)
        setRows(items)
        setSummary(tab === TAB_VISIT ? nextSummary : null)
        setTotalCount(tc)
        setReportTotalPages(tp)
        if (tab === TAB_VISIT) {
          try {
            const piRes = await piSignoffReportService.getVisitSummary({
              ...nextFilters,
              pageNumber: 1,
              pageSize: 1,
            })
            const { summary: ps } = piSignoffReportService.normalizeReportPage(piRes)
            setPiSummary(ps)
          } catch {
            setPiSummary(null)
          }
        } else {
          setPiSummary(null)
        }
      } catch (error) {
        toast.error(error?.message || "Failed to load SDV report")
        setRows([])
        setSummary(null)
        setPiSummary(null)
        setTotalCount(0)
        setReportTotalPages(0)
      } finally {
        setLoading(false)
      }
    },
    [activeTab, ensureSdvConfiguredForStudy],
  )

  const handleSearch = useCallback(async () => {
    if (!String(filters.studyId || "").trim()) {
      setStudyRequiredError(true)
      toast.error("Study is required.")
      return
    }
    const next = { ...filters, pageNumber: 1 }
    setFilters(next)
    await loadReport(next, activeTab)
  }, [filters, activeTab, loadReport, setFilters, setStudyRequiredError])

  const handleClear = useCallback(() => {
    resetFilterUi()
    setRows([])
    setSummary(null)
    setPiSummary(null)
    setTotalCount(0)
    setReportTotalPages(0)
  }, [resetFilterUi])

  const handleTabChange = useCallback(
    (tab) => {
      if (tab === activeTab) return
      setActiveTab(tab)
      setRows([])
      setSummary(null)
      setPiSummary(null)
      setTotalCount(0)
      setReportTotalPages(0)
      if (hasStudySelected && sdvConfiguredForStudy) {
        const next = { ...filters, pageNumber: 1 }
        loadReport(next, tab)
      }
    },
    [activeTab, filters, hasStudySelected, loadReport, sdvConfiguredForStudy],
  )

  const handleExport = useCallback(
    async (format) => {
      if (!assertCanExport()) return
      if (!String(filters.studyId || "").trim()) {
        setStudyRequiredError(true)
        toast.error("Study is required.")
        return
      }
      try {
        const studyId = parseInt(String(filters.studyId || ""), 10)
        await ensureSdvConfiguredForStudy(studyId)
        await executeExport(format, async () => {
          await sdvReportService.exportSdvReport(withWorkspace(filters), format)
          toast.success(format === "pdf" ? "PDF exported successfully." : "CSV exported successfully.")
        })
      } catch (error) {
        toast.error(error?.message || "Export failed")
      }
    },
    [assertCanExport, filters, executeExport, ensureSdvConfiguredForStudy, setStudyRequiredError],
  )

  const sdvDisabledBanner =
    sdvConfiguredForStudy === false ? (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
        SDV roles are not configured for the selected study. Add SDV roles in Study Settings to use this report.
      </p>
    ) : null

  const resultsTitle =
    activeTab === TAB_FIELD ? "SDV Field Detail Entries" : "SDV Visit Summary Entries"

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="flex items-center gap-3 mb-6">
          <div className={REPORT_HEADER_ICON_WRAP_CLASS}>
            <FileCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">SDV Report</h1>
            <p className="text-slate-600 text-sm">View and export source data verification records</p>
          </div>
        </div>

        {sdvDisabledBanner}

        <div className={cn(REPORT_CARD_CLASS, "mb-6")}>
          <div className={REPORT_FILTER_HEADER_CLASS}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-800">Filter Criteria</h2>
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
            showFieldSdvFilter={activeTab === TAB_FIELD}
          />

          <div className="px-6 pb-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSearch}
              disabled={loading || !hasStudySelected || loadingCascade}
              className={REPORT_PRIMARY_BTN_CLASS}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Search
            </Button>
            <Button
              onClick={handleClear}
              variant="outline"
              disabled={loading || !hasActiveFilters}
              className="border-slate-300 hover:bg-blue-50"
            >
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <div className="flex-1" />
            <ReportDownloadActions
              canExport={canExportReport}
              reportKey={reportKey}
              assertCanExport={assertCanExport}
              defaultSubject="SDV Report"
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

        {activeTab === TAB_VISIT && summary ? (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <ReportMetricChip label="CRFs" value={summary.totalCrfs} />
            <ReportMetricChip label="Total fields" value={summary.totalFields} tone="info" />
            <ReportMetricChip label="SDV done" value={summary.sdvApprovedFields} tone="success" />
            <ReportMetricChip label="SDV pending" value={summary.sdvPendingFields} tone="warning" />
            <ReportMetricChip label="Forms fully SDV'd" value={summary.formSdvVerifiedCount} tone="success" />
            {piSummary ? (
              <>
                <ReportMetricChip label="PI signed CRFs" value={piSummary.piSignedCrfs} tone="success" />
                <ReportMetricChip label="PI pending CRFs" value={piSummary.piPendingCrfs} tone="warning" />
              </>
            ) : null}
          </div>
        ) : null}

        <div className={REPORT_CARD_CLASS}>
          <div className={REPORT_RESULTS_HEADER_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">
                {resultsTitle}
                {totalCount > 0 && ` (${totalCount} total)`}
              </h2>
              <div className={REPORT_VIEW_SEGMENT_WRAP_CLASS} role="tablist" aria-label="SDV report view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === TAB_VISIT}
                  onClick={() => handleTabChange(TAB_VISIT)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-all",
                    activeTab === TAB_VISIT ? REPORT_VIEW_SEGMENT_ACTIVE_CLASS : REPORT_VIEW_SEGMENT_IDLE_CLASS,
                  )}
                >
                  Visit summary
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === TAB_FIELD}
                  onClick={() => handleTabChange(TAB_FIELD)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-all",
                    activeTab === TAB_FIELD ? REPORT_VIEW_SEGMENT_ACTIVE_CLASS : REPORT_VIEW_SEGMENT_IDLE_CLASS,
                  )}
                >
                  Field detail
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <SectionSkeleton title="Loading SDV report..." rows={8} variant="audit" />
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <FileCheck className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No SDV records found</p>
              <p className="text-slate-500 text-sm">
                {!hasStudySelected
                  ? "Select Study and click Search to view SDV data."
                  : hasActiveFilters
                    ? "Try adjusting your filters."
                    : "No records are available at this time."}
              </p>
            </div>
          ) : (
            <>
              <div className={REPORT_TABLE_SCROLL_CLASS} role="region" aria-label="SDV report results">
                <table
                  className={cn(
                    "w-full",
                    "table-fixed",
                    activeTab === TAB_FIELD ? "min-w-[1180px]" : "min-w-[1000px]",
                  )}
                >
                  <thead className={REPORT_TABLE_HEAD_ROW_CLASS}>
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column.key}
                          className={cn(REPORT_TABLE_TH_CLASS, column.colClass)}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={REPORT_TABLE_BODY_CLASS}>
                    {rows.map((row, index) => (
                      <tr
                        key={activeTab === TAB_VISIT ? visitRowKey(row, index) : fieldRowKey(row, index)}
                        className={REPORT_TABLE_TR_CLASS}
                      >
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={cn(
                              REPORT_TABLE_TD_CLASS,
                              column.colClass && !column.fullDisplay && "max-w-0",
                              column.colClass,
                            )}
                          >
                            {renderSdvTableCell(row, column, activeTab)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 0 && (
                <div className="border-t border-slate-200 bg-white px-2">
                  <DataPagination
                    currentPage={filters.pageNumber}
                    pageSize={filters.pageSize}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    onPageChange={(page) => {
                      setFilters((prev) => {
                        const next = { ...prev, pageNumber: page }
                        loadReport(next, activeTab)
                        return next
                      })
                    }}
                    onPageSizeChange={(size) => {
                      setFilters((prev) => {
                        const next = { ...prev, pageSize: size, pageNumber: 1 }
                        loadReport(next, activeTab)
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
