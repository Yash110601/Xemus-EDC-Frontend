"use client"

import { useCallback, useMemo, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import AiEntryReportFilters from "@/components/reports/AiEntryReportFilters"
import ReportDenseCopyCell from "@/components/reports/ReportDenseCopyCell"
import { TruncTooltipCopyCell } from "@/components/reports/trunc-tooltip-copy-cell"
import { useAiEntryReportCascadingFilters } from "@/app/reports/_hooks/useAiEntryReportCascadingFilters"
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
  formatAiEntryAtUtc,
  formatAiEntryBooleanLabel,
  formatAiEntryTypeLabel,
  getAiEntryByLabel,
  getAiPatientIdDisplay,
} from "@/lib/reports/aiEntryReportDisplay"
import { validateReportPatientCascadeFilters } from "@/lib/reports/reportPatientCascadeFilters"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportExportGate from "@/components/reports/ReportExportGate"
import { pickDtoField, toReportDisplay } from "@/lib/reports/reportRowDisplay"
import aiEntryReportService from "@/lib/services/aiEntryReport.service"
import { useInlineDualExport } from "@/lib/hooks/useInlineDualExport"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { FileDown, Filter, Loader2, Search, Sparkles, X } from "lucide-react"
import { columnLabelWithTz } from "@/lib/utils/appDateTime"

const TAB_VISIT = "visit"
const TAB_FIELD = "field"

const VISIT_COLUMNS = [
  { key: "studyName", label: "Study", copyable: true, truncTooltip: true, colClass: "w-[8rem] max-w-[8rem]" },
  { key: "siteName", label: "Site", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "patientInitial", label: "Initial", copyable: true, fullDisplay: true, colClass: "w-[5.5rem] min-w-[5.5rem]" },
  { key: "visitName", label: "Visit", copyable: true, truncTooltip: true, colClass: "w-[8.5rem] max-w-[8.5rem]" },
  { key: "crfName", label: "CRF", copyable: true, truncTooltip: true, colClass: "w-[12rem] max-w-[12rem]" },
  { key: "totalFields", label: "Total Fields", colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "aiBasedFields", label: "AI Fields", colClass: "w-[5rem] max-w-[5rem]" },
  { key: "voiceToTextFields", label: "Voice", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "fileUploadFields", label: "File", colClass: "w-[4.5rem] max-w-[4.5rem]" },
]

const FIELD_COLUMNS = [
  { key: "siteName", label: "Site", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "patientEnrolmentId", label: "Patient ID", copyable: true, colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "patientInitial", label: "Initial", copyable: true, fullDisplay: true, colClass: "w-[5rem] max-w-[5rem]" },
  { key: "extraFieldValue", label: "Extra Field", copyable: true, truncTooltip: true, colClass: "w-[7rem] max-w-[7rem]" },
  { key: "gender", label: "Gender", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "visitName", label: "Visit", copyable: true, truncTooltip: true, colClass: "w-[6.5rem] max-w-[6.5rem]" },
  { key: "crfName", label: "CRF", copyable: true, truncTooltip: true, colClass: "w-[8rem] max-w-[8rem]" },
  { key: "rowNumber", label: "Row", colClass: "w-[3.5rem] max-w-[3.5rem]" },
  { key: "crfStatus", label: "Status", colClass: "w-[5rem] max-w-[5rem]" },
  { key: "sectionKey", label: "Section", copyable: true, truncTooltip: true, colClass: "w-[7rem] max-w-[7rem]" },
  { key: "fieldLabel", label: "Field", copyable: true, truncTooltip: true, colClass: "w-[9rem] max-w-[9rem]" },
  { key: "fieldValue", label: "Value", copyable: true, truncTooltip: true, colClass: "w-[8rem] max-w-[8rem]" },
  { key: "isAiBasedEntry", label: "AI Based", colClass: "w-[5rem] max-w-[5rem]" },
  { key: "aiEntryType", label: "AI Type", colClass: "w-[7rem] max-w-[7rem]" },
  { key: "aiEntryAt", label: columnLabelWithTz("AI At"), colClass: "w-[10rem] max-w-[10rem]" },
  { key: "aiEntryByName", label: "AI By", copyable: true, truncTooltip: true, colClass: "w-[8rem] max-w-[8rem]" },
]

function visitRowKey(row, index) {
  // Compose stable parts; always append index so duplicate API rows never collide.
  const crfDataId = pickDtoField(row, "crfDataId")
  const visitScheduleId = pickDtoField(row, "visitScheduleId")
  const patientEnrolmentId = pickDtoField(row, "patientEnrolmentId")
  const crfDesignId = pickDtoField(row, "crfDesignId")
  const rowNumber = pickDtoField(row, "rowNumber")
  return [
    "visit",
    crfDataId ?? "x",
    visitScheduleId ?? "x",
    patientEnrolmentId ?? "x",
    crfDesignId ?? "x",
    rowNumber ?? "x",
    index,
  ].join("-")
}

function fieldRowKey(row, index) {
  const controlId = pickDtoField(row, "controlId") ?? pickDtoField(row, "fieldId")
  const crfDataId = pickDtoField(row, "crfDataId")
  const fieldInstanceId = pickDtoField(row, "fieldInstanceId")
  return [
    "field",
    crfDataId ?? "x",
    controlId ?? "x",
    fieldInstanceId ?? "x",
    index,
  ].join("-")
}

function renderVisitCell(row, column) {
  switch (column.key) {
    case "patientEnrolmentId":
      return getAiPatientIdDisplay(row)
    default:
      return toReportDisplay(pickDtoField(row, column.key))
  }
}

function renderFieldCell(row, column) {
  switch (column.key) {
    case "patientEnrolmentId":
      return getAiPatientIdDisplay(row)
    case "isAiBasedEntry":
      return formatAiEntryBooleanLabel(pickDtoField(row, "isAiBasedEntry"))
    case "aiEntryType":
      return formatAiEntryTypeLabel(pickDtoField(row, "aiEntryType"))
    case "aiEntryAt":
      return formatAiEntryAtUtc(pickDtoField(row, "aiEntryAt"))
    case "aiEntryByName":
      return getAiEntryByLabel(row)
    default:
      return toReportDisplay(pickDtoField(row, column.key))
  }
}

function renderAiTableCell(row, column, tab) {
  const cellText = tab === TAB_VISIT ? renderVisitCell(row, column) : renderFieldCell(row, column)

  if (column.truncTooltip) {
    const raw =
      column.key === "aiEntryByName"
        ? getAiEntryByLabel(row)
        : pickDtoField(row, column.key)
    const value =
      raw === null || raw === undefined || String(raw).trim() === "" || String(raw) === "-"
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

export default function AiEntryReportPage() {
  const { canExport: canExportReport, assertCanExport, reportKey } = useReportExportAccess("AI_ENTRY_REPORT")
  const { exportingFormat, executeExport } = useInlineDualExport()
  const [activeTab, setActiveTab] = useState(TAB_VISIT)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [reportTotalPages, setReportTotalPages] = useState(0)

  const {
    filters,
    setFilters,
    visits,
    crfForms,
    loadingVisits,
    loadingCrfForms,
    loadingCascade,
    studyRequiredError,
    setStudyRequiredError,
    handleFilterChange,
    hasStudySelected,
    hasSiteSelected,
    hasPatientSelected,
    hasVisitSelected,
    hasActiveFilters,
    resetFilterUi,
    visitSearch,
    setVisitSearch,
    crfSearch,
    setCrfSearch,
  } = useAiEntryReportCascadingFilters()

  const clearGrid = useCallback(() => {
    setRows([])
    setTotalCount(0)
    setReportTotalPages(0)
  }, [])

  const handleFilterChangeWithGridReset = useCallback(
    (key, value) => {
      if (
        key === "studyId" ||
        key === "siteId" ||
        key === "patientEnrolmentId" ||
        key === "visitScheduleId" ||
        key === "crfDesignId"
      ) {
        clearGrid()
      }
      handleFilterChange(key, value)
    },
    [clearGrid, handleFilterChange],
  )

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
        const response =
          tab === TAB_FIELD
            ? await aiEntryReportService.getFieldReport(nextFilters)
            : await aiEntryReportService.getVisitSummary(nextFilters)
        const { items, totalCount: tc, totalPages: tp } = aiEntryReportService.normalizePage(response)
        setRows(items)
        setTotalCount(tc)
        setReportTotalPages(tp)
      } catch (error) {
        toast.error(error?.message || "Failed to load AI entry report")
        setRows([])
        setTotalCount(0)
        setReportTotalPages(0)
      } finally {
        setLoading(false)
      }
    },
    [activeTab],
  )

  const handleSearch = useCallback(async () => {
    if (!String(filters.studyId || "").trim()) {
      setStudyRequiredError(true)
      toast.error("Study is required.")
      return
    }
    const cascadeError = validateReportPatientCascadeFilters(filters)
    if (cascadeError) {
      toast.error(cascadeError)
      return
    }
    const next = { ...filters, pageNumber: 1 }
    setFilters(next)
    await loadReport(next, activeTab)
  }, [filters, activeTab, loadReport, setFilters, setStudyRequiredError])

  const handleClear = useCallback(() => {
    resetFilterUi()
    setRows([])
    setTotalCount(0)
    setReportTotalPages(0)
  }, [resetFilterUi])

  const handleTabChange = useCallback(
    (tab) => {
      if (tab === activeTab) return
      setActiveTab(tab)
      setRows([])
      setTotalCount(0)
      setReportTotalPages(0)
      if (hasStudySelected) {
        const next = { ...filters, pageNumber: 1 }
        loadReport(next, tab)
      }
    },
    [activeTab, filters, hasStudySelected, loadReport],
  )

  const handleExport = useCallback(
    async (format) => {
      if (!assertCanExport()) return
      if (!String(filters.studyId || "").trim()) {
        setStudyRequiredError(true)
        toast.error("Study is required.")
        return
      }
      const cascadeError = validateReportPatientCascadeFilters(filters)
      if (cascadeError) {
        toast.error(cascadeError)
        return
      }
      try {
        await executeExport(format, async () => {
          await aiEntryReportService.exportAiEntryReport(filters, format)
          toast.success(format === "pdf" ? "PDF exported successfully." : "CSV exported successfully.")
        })
      } catch (error) {
        toast.error(error?.message || "Export failed")
      }
    },
    [assertCanExport, filters, executeExport, setStudyRequiredError],
  )

  const resultsTitle =
    activeTab === TAB_FIELD ? "AI Field Detail Entries" : "AI Visit / CRF Summary"

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="flex items-center gap-3 mb-6">
          <div className={REPORT_HEADER_ICON_WRAP_CLASS}>
            <Sparkles className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">AI Entry Report</h1>
            <p className="text-slate-600 text-sm">View and export fields filled by AI (voice or file)</p>
          </div>
        </div>

        <div className={cn(REPORT_CARD_CLASS, "mb-6")}>
          <div className={REPORT_FILTER_HEADER_CLASS}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-indigo-600" />
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

          <AiEntryReportFilters
            filters={filters}
            onFilterChange={handleFilterChangeWithGridReset}
            visits={visits}
            crfForms={crfForms}
            loadingVisits={loadingVisits}
            loadingCrfForms={loadingCrfForms}
            studyRequiredError={studyRequiredError}
            visitSearch={visitSearch}
            onVisitSearchChange={setVisitSearch}
            crfSearch={crfSearch}
            onCrfSearchChange={setCrfSearch}
            hasStudySelected={hasStudySelected}
            hasSiteSelected={hasSiteSelected}
            hasPatientSelected={hasPatientSelected}
            hasVisitSelected={hasVisitSelected}
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
            <ReportExportGate canExport={canExportReport} reportKey={reportKey}>
              <Button
                onClick={() => handleExport("csv")}
                variant="outline"
                disabled={exportingFormat !== null || !hasStudySelected || loading}
                className="border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700"
              >
                {exportingFormat === "csv" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                Export CSV
              </Button>
              <Button
                onClick={() => handleExport("pdf")}
                variant="outline"
                disabled={exportingFormat !== null || !hasStudySelected || loading}
                className="border-red-600 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {exportingFormat === "pdf" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                Export PDF
              </Button>
            </ReportExportGate>
          </div>
        </div>

        <div className={REPORT_CARD_CLASS}>
          <div className={REPORT_RESULTS_HEADER_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">
                {resultsTitle}
                {totalCount > 0 && ` (${totalCount} total)`}
              </h2>
              <div className={REPORT_VIEW_SEGMENT_WRAP_CLASS} role="tablist" aria-label="AI entry report view">
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
            <SectionSkeleton title="Loading AI entry report..." rows={8} variant="audit" />
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No AI entry records found</p>
              <p className="text-slate-500 text-sm">
                {!hasStudySelected
                  ? "Select Study and click Search to view AI entry data."
                  : hasActiveFilters
                    ? "Try adjusting your filters."
                    : "No records are available at this time."}
              </p>
            </div>
          ) : (
            <>
              <div className={REPORT_TABLE_SCROLL_CLASS} role="region" aria-label="AI entry report results">
                <table
                  className={cn(
                    "w-full",
                    "table-fixed",
                    activeTab === TAB_FIELD ? "min-w-[1600px]" : "min-w-[1080px]",
                  )}
                >
                  <thead className={REPORT_TABLE_HEAD_ROW_CLASS}>
                    <tr>
                      {columns.map((column) => (
                        <th key={column.key} className={cn(REPORT_TABLE_TH_CLASS, column.colClass)}>
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
                            {renderAiTableCell(row, column, activeTab)}
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
