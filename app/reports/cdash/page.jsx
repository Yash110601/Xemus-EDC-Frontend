"use client"

import { useState, useCallback, useMemo } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileDown,
  FileArchive,
  Filter,
  X,
  Loader2,
  Database,
  Search,
} from "lucide-react"
import cdashService from "@/lib/services/cdash.service"
import {
  buildCdashFieldReportApiParams,
  buildCdashFieldReportExportParams,
  buildCdashReportApiParams,
  CDASH_REPORT_INITIAL_FILTERS,
  formatCdashMappedLabel,
  isStudyCdashEnabledOnDto,
  normalizeCdashFieldReportPage,
  normalizeCdashReportSummaryPayload,
  resolveCdashReportErrorMessage,
  toReportCell,
} from "@/lib/reports/cdashReportDisplay"
import { fetchIsCdashEnabledForStudy } from "@/lib/utils/studyCdashGate"
import { formatReportPatientOptionLabel } from "@/lib/reports/reportPatientCascadeFilters"
import { toast } from "sonner"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportExportGate from "@/components/reports/ReportExportGate"
import StudyPagedSelect from "@/components/ui/study-paged-select"
import SitePagedSelect from "@/components/ui/site-paged-select"
import PatientPagedSelect from "@/components/ui/patient-paged-select"
import VisitPagedSelect from "@/components/ui/visit-paged-select"
import CrfPagedSelect from "@/components/ui/crf-paged-select"
import { cn } from "@/lib/utils"
import ReportDenseCopyCell from "@/components/reports/ReportDenseCopyCell"
import { TruncTooltipCopyCell } from "@/components/reports/trunc-tooltip-copy-cell"
import {
  getStudyFilterDisplayName,
  REPORT_CARD_CLASS,
  REPORT_PAGE_SHELL_CLASS,
  REPORT_HEADER_ICON_WRAP_CLASS,
  REPORT_PAGE_SIZE_OPTIONS,
  REPORT_PRIMARY_BTN_CLASS,
  REPORT_RESULTS_HEADER_CLASS,
  REPORT_SELECT_TRIGGER_CLASS,
  REPORT_SELECT_CONTENT_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  REPORT_SELECT_SCROLL_LIST_CLASS,
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

const TAB_CRF = "crf"
const TAB_FIELD = "field"

const SUMMARY_COLUMNS = [
  {
    key: "crfDesignName",
    label: "CRF Design",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[12rem] max-w-[12rem]",
  },
  {
    key: "visitType",
    label: "Visit Type",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[8.5rem] max-w-[8.5rem]",
  },
  { key: "totalFields", label: "Total Fields", colClass: "w-[5.5rem] max-w-[5.5rem]" },
  { key: "mappedFields", label: "Mapped", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "pendingFields", label: "Pending", colClass: "w-[4.5rem] max-w-[4.5rem]" },
]

const FIELD_COLUMNS = [
  {
    key: "crfDesignName",
    label: "CRF Design",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[12rem] max-w-[12rem]",
  },
  {
    key: "visitTypeName",
    label: "Visit Type",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[8.5rem] max-w-[8.5rem]",
  },
  {
    key: "sectionName",
    label: "Section",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[10rem] max-w-[10rem]",
  },
  {
    key: "fieldDisplayName",
    label: "Field",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[16rem] max-w-[16rem]",
  },
  { key: "isMapped", label: "Mapped", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  { key: "domainCode", label: "Domain", colClass: "w-[4.5rem] max-w-[4.5rem]" },
  {
    key: "cdashVariableName",
    label: "CDASH Variable",
    copyable: true,
    truncTooltip: true,
    colClass: "w-[8rem] max-w-[8rem]",
  },
]

function renderGridCell(row, column, cellText) {
  const raw = row[column.key]

  if (column.truncTooltip) {
    const value =
      raw === null || raw === undefined || String(raw).trim() === ""
        ? cellText === "—"
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

function renderSummaryCell(row, column) {
  return renderGridCell(row, column, toReportCell(row[column.key]))
}

function renderFieldCell(row, column) {
  switch (column.key) {
    case "isMapped":
      return formatCdashMappedLabel(row.isMapped)
    case "domainCode":
    case "cdashVariableName":
      return toReportCell(row[column.key])
    default:
      return toReportCell(row[column.key])
  }
}

function fieldRowKey(row, index) {
  return `${row.crfDesignName || "crf"}-${row.fieldDisplayName || "field"}-${index}`
}

function GridEmptyPrompt({ title, hint }) {
  return (
    <div className="text-center py-16">
      <Database className="w-16 h-16 text-slate-400 mx-auto mb-4" />
      <p className="text-slate-600 font-medium mb-2">{title}</p>
      <p className="text-slate-500 text-sm">{hint}</p>
    </div>
  )
}

export default function CdashReportPage() {
  const { canExport, assertCanExport, reportKey } = useReportExportAccess("CDASH_REPORT")

  const [exportingFormat, setExportingFormat] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(TAB_CRF)
  const [hasSearched, setHasSearched] = useState(false)
  const [summaryRows, setSummaryRows] = useState([])
  const [summaryError, setSummaryError] = useState("")
  const [fieldRows, setFieldRows] = useState([])
  const [fieldError, setFieldError] = useState("")
  const [fieldTotalCount, setFieldTotalCount] = useState(0)
  const [fieldTotalPages, setFieldTotalPages] = useState(0)

  const [selectedStudyLabel, setSelectedStudyLabel] = useState("")
  const [selectedSiteLabel, setSelectedSiteLabel] = useState("")
  const [selectedPatientLabel, setSelectedPatientLabel] = useState("")
  const [selectedVisitLabel, setSelectedVisitLabel] = useState("")
  const [selectedCrfLabel, setSelectedCrfLabel] = useState("")

  const [filters, setFilters] = useState(CDASH_REPORT_INITIAL_FILTERS)

  const hasStudySelected = Boolean(filters.studyId)

  const clearGrids = useCallback(() => {
    setSummaryRows([])
    setSummaryError("")
    setFieldRows([])
    setFieldError("")
    setFieldTotalCount(0)
    setFieldTotalPages(0)
    setHasSearched(false)
  }, [])

  const loadReportSummary = useCallback(async (nextFilters) => {
    const params = buildCdashReportApiParams(nextFilters)
    if (!params.studyId) {
      setSummaryRows([])
      setSummaryError("")
      return
    }

    const res = await cdashService.getReportSummary(params)
    if (!res?.isSuccess) {
      setSummaryRows([])
      setSummaryError(resolveCdashReportErrorMessage(res, "Failed to load CDASH report summary."))
      return
    }
    const payload = res.data?.data ?? res.data
    const normalized = normalizeCdashReportSummaryPayload(payload)
    setSummaryRows(normalized.items)
    setSummaryError("")
  }, [])

  const loadFieldReport = useCallback(async (nextFilters) => {
    const params = buildCdashFieldReportApiParams(nextFilters)
    if (!params.studyId) {
      setFieldRows([])
      setFieldError("")
      setFieldTotalCount(0)
      setFieldTotalPages(0)
      return
    }

    const res = await cdashService.getFieldReport(params)
    if (!res?.isSuccess) {
      setFieldRows([])
      setFieldError(resolveCdashReportErrorMessage(res, "Failed to load CDASH field report."))
      setFieldTotalCount(0)
      setFieldTotalPages(0)
      return
    }
    const page = normalizeCdashFieldReportPage(res)
    setFieldRows(page.items)
    setFieldTotalCount(page.totalCount)
    setFieldTotalPages(page.totalPages)
    setFieldError("")
  }, [])

  const loadReport = useCallback(
    async (nextFilters, tab = activeTab) => {
      const studyIdNum = parseInt(String(nextFilters.studyId ?? ""), 10)
      if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) return

      setLoading(true)
      try {
        const enabled = await fetchIsCdashEnabledForStudy(studyIdNum)
        if (!enabled) {
          toast.error("CDASH is not enabled for this study.")
          clearGrids()
          return
        }
        if (tab === TAB_FIELD) {
          await loadFieldReport(nextFilters)
        } else {
          await loadReportSummary(nextFilters)
        }
        setHasSearched(true)
      } catch (err) {
        toast.error(err?.message || "Failed to load CDASH report")
        clearGrids()
      } finally {
        setLoading(false)
      }
    },
    [activeTab, clearGrids, loadFieldReport, loadReportSummary],
  )

  const handleSearch = useCallback(async () => {
    if (!String(filters.studyId || "").trim()) {
      toast.error("Study is required.")
      return
    }
    const next = { ...filters, pageNumber: 1 }
    setFilters(next)
    await loadReport(next, activeTab)
  }, [activeTab, filters, loadReport])

  const handleTabChange = useCallback(
    (tab) => {
      if (tab === activeTab) return
      setActiveTab(tab)
      if (!hasSearched || !filters.studyId) return
      const next = { ...filters, pageNumber: 1 }
      setFilters(next)
      void loadReport(next, tab)
    },
    [activeTab, filters, hasSearched, loadReport],
  )

  const resultsTitle =
    activeTab === TAB_FIELD ? "CDASH Field Mapping Detail Entries" : "CDASH CRF Mapping Summary Entries"

  const resultsTotal = activeTab === TAB_FIELD ? fieldTotalCount : summaryRows.length

  const fieldTotalPagesResolved = useMemo(() => {
    const ps = Number(filters.pageSize) || 50
    const fromApi = Number(fieldTotalPages) || 0
    if (fromApi > 0) return fromApi
    const ceil = Math.ceil((Number(fieldTotalCount) || 0) / ps)
    return ceil > 0 ? ceil : 0
  }, [fieldTotalPages, fieldTotalCount, filters.pageSize])

  const hasActiveFilters = useMemo(
    () =>
      filters.studyId !== "" ||
      filters.siteId !== "" ||
      filters.patientEnrolmentId !== "" ||
      filters.crfDesignId !== "" ||
      filters.visitScheduleId !== "" ||
      filters.search !== "" ||
      filters.isMapped !== "",
    [filters],
  )

  const validateStudyCdash = useCallback(async (studyId, studyItem) => {
    const fromItem = isStudyCdashEnabledOnDto(studyItem)
    if (fromItem === true) return true
    if (fromItem === false) {
      toast.error("CDASH is not enabled for this study. Enable it in Study Settings.")
      return false
    }
    const enabled = await fetchIsCdashEnabledForStudy(studyId)
    if (!enabled) {
      toast.error("CDASH is not enabled for this study. Enable it in Study Settings.")
      return false
    }
    return true
  }, [])

  const handleFilterChange = useCallback(
    (key, value) => {
      if (
        key === "studyId" ||
        key === "siteId" ||
        key === "patientEnrolmentId" ||
        key === "visitScheduleId" ||
        key === "crfDesignId" ||
        key === "isMapped"
      ) {
        clearGrids()
      }

      setFilters((prev) => {
        const newFilters = { ...prev, [key]: value }
        if (key === "studyId") {
          newFilters.siteId = ""
          newFilters.patientEnrolmentId = ""
          newFilters.crfDesignId = ""
          newFilters.visitScheduleId = ""
          newFilters.pageNumber = 1
        }
        if (key === "siteId") {
          newFilters.patientEnrolmentId = ""
          newFilters.pageNumber = 1
        }
        if (key === "isMapped" || key === "search") {
          newFilters.pageNumber = 1
        }
        return newFilters
      })
      if (key === "studyId") {
        setSelectedSiteLabel("")
        setSelectedPatientLabel("")
        setSelectedVisitLabel("")
        setSelectedCrfLabel("")
      }
      if (key === "siteId") {
        setSelectedPatientLabel("")
      }
    },
    [clearGrids],
  )

  const handleClearFilters = useCallback(() => {
    setFilters(CDASH_REPORT_INITIAL_FILTERS)
    setSelectedStudyLabel("")
    setSelectedSiteLabel("")
    setSelectedPatientLabel("")
    setSelectedVisitLabel("")
    setSelectedCrfLabel("")
    clearGrids()
  }, [clearGrids])

  const runExport = useCallback(
    async (format, exportFn, successLabel) => {
      if (!assertCanExport()) return
      if (exportingFormat) return

      const studyIdNum = filters.studyId ? parseInt(filters.studyId, 10) : NaN
      if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) {
        toast.error("Please select Study before exporting.")
        return
      }

      setExportingFormat(format)
      try {
        const enabled = await fetchIsCdashEnabledForStudy(studyIdNum)
        if (!enabled) {
          toast.error("CDASH is not enabled for this study.")
          return
        }
        const result = await exportFn()
        toast.success(`${successLabel} downloaded${result.filename ? `: ${result.filename}` : ""}.`)
      } catch (error) {
        console.error("CDASH export error:", error)
        toast.error(error.message || "Unable to export CDASH report. Please try again.")
      } finally {
        setExportingFormat(null)
      }
    },
    [assertCanExport, exportingFormat, filters.studyId],
  )

  const handleExportDetailCsv = useCallback(async () => {
    const params = buildCdashFieldReportExportParams(filters)
    await runExport(
      "detail",
      () => cdashService.exportFieldReportCsv(params),
      "Field detail CSV",
    )
  }, [filters, runExport])

  const handleExportZip = useCallback(async () => {
    const params = buildCdashReportApiParams(filters)
    const visitScheduleIdNum = parseInt(String(params.visitScheduleId ?? 0), 10)
    const isAllVisits = !Number.isFinite(visitScheduleIdNum) || visitScheduleIdNum === 0
    await runExport(
      "zip",
      () => cdashService.exportSubmittedData(params),
      isAllVisits ? "Submitted CDASH data ZIP" : "Submitted CDASH data CSV",
    )
  }, [filters, runExport])

  const selectTriggerClass = cn(
    REPORT_SELECT_TRIGGER_CLASS,
    "box-border flex h-10 min-h-10 max-h-10 w-full min-w-0 max-w-full items-center rounded-lg border-2 py-0 text-sm",
  )
  const filterFieldClass = "flex min-w-0 flex-col space-y-2"

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="flex items-center gap-3 mb-6">
          <div className={REPORT_HEADER_ICON_WRAP_CLASS}>
            <Database className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">CDASH Report</h1>
            <p className="text-slate-600 text-sm">
              Review CDASH mapping coverage and export submitted patient data (CDASH variable columns).
            </p>
          </div>
        </div>

        <div className={cn(REPORT_CARD_CLASS, "mb-6")}>
          <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-800">Filter Criteria</h2>
              </div>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6 grid grid-cols-1 items-end gap-5 md:grid-cols-2 lg:grid-cols-5">
              <div className={filterFieldClass}>
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Study
                  <span className="text-red-500">*</span>
                </label>
                <div className="w-full min-w-0">
                  <StudyPagedSelect
                    label=""
                    value={filters.studyId || ""}
                    selectedLabel={selectedStudyLabel}
                    onValueChange={async (v, item) => {
                      if (v) {
                        const ok = await validateStudyCdash(v, item)
                        if (!ok) return
                      }
                      handleFilterChange("studyId", v || "")
                      setSelectedStudyLabel(
                        item ? item.studyProtocolNumber || getStudyFilterDisplayName(item) : "",
                      )
                      setSelectedSiteLabel("")
                      setSelectedPatientLabel("")
                      setSelectedVisitLabel("")
                      setSelectedCrfLabel("")
                    }}
                    placeholder="Select Study"
                    searchPlaceholder="Search studies..."
                    emptyOptionLabel="All Studies"
                    prefetch
                    cdashEnabledOnly
                    reloadKey="cdash-report-study"
                    triggerClassName={selectTriggerClass}
                    className="!gap-0 w-full min-w-0"
                    emptyMessage="No CDASH-enabled studies found."
                  />
                </div>
              </div>

              <div className={filterFieldClass}>
                <VisitPagedSelect
                  label="Visit Schedule"
                  studyId={filters.studyId || null}
                  crfDesignId={filters.crfDesignId || null}
                  value={filters.visitScheduleId || ""}
                  selectedLabel={selectedVisitLabel}
                  onValueChange={(v, item) => {
                    handleFilterChange("visitScheduleId", v || "")
                    setSelectedVisitLabel(item?.name || item?.visitName || "")
                  }}
                  placeholder="All Visit Schedules"
                  searchPlaceholder="Search visits..."
                  emptyOptionLabel="All Visit Schedules"
                  prefetch
                  reloadKey="cdash-report-visit"
                  triggerClassName={selectTriggerClass}
                  className="!gap-0 w-full min-w-0"
                />
              </div>

              <div className={filterFieldClass}>
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">Site</label>
                <div className="w-full min-w-0">
                  <SitePagedSelect
                    label=""
                    studyId={filters.studyId || null}
                    value={filters.siteId || ""}
                    selectedLabel={selectedSiteLabel}
                    onValueChange={(v, item) => {
                      handleFilterChange("siteId", v || "")
                      setSelectedPatientLabel("")
                      if (!item) {
                        setSelectedSiteLabel("")
                        return
                      }
                      const id = item.siteId ?? item.id
                      const code = item.siteCode || item.code || ""
                      const name = item.siteName || item.name || ""
                      setSelectedSiteLabel(
                        code && name ? `${code} - ${name}` : name || code || (id ? `Site ${id}` : ""),
                      )
                    }}
                    placeholder="Select Site"
                    searchPlaceholder="Search sites..."
                    emptyOptionLabel="All Sites"
                    prefetch
                    reloadKey="cdash-report-site"
                    triggerClassName={selectTriggerClass}
                    className="!gap-0 w-full min-w-0"
                    emptyMessage="No sites found."
                  />
                </div>
              </div>

              <div className={filterFieldClass}>
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">Patient Enrolment</label>
                <div className="w-full min-w-0">
                  <PatientPagedSelect
                    label=""
                    studyId={filters.studyId || null}
                    siteId={filters.siteId || null}
                    value={filters.patientEnrolmentId || ""}
                    selectedLabel={selectedPatientLabel}
                    onValueChange={(v, item) => {
                      handleFilterChange("patientEnrolmentId", v || "")
                      setSelectedPatientLabel(item ? formatReportPatientOptionLabel(item) : "")
                    }}
                    placeholder="All Patients"
                    searchPlaceholder="Search patients..."
                    emptyOptionLabel="All Patients"
                    prefetch
                    reloadKey="cdash-report-patient"
                    triggerClassName={selectTriggerClass}
                    className="!gap-0 w-full min-w-0"
                    getOptionLabel={formatReportPatientOptionLabel}
                  />
                </div>
              </div>

              <div className={filterFieldClass}>
                <CrfPagedSelect
                  label="CRF Design"
                  studyId={filters.studyId || null}
                  value={filters.crfDesignId || ""}
                  selectedLabel={selectedCrfLabel}
                  onValueChange={(v, item) => {
                    handleFilterChange("crfDesignId", v || "")
                    setSelectedCrfLabel(
                      item?.crfName || item?.name || (item?.crfDesignId ? `CRF ${item.crfDesignId}` : ""),
                    )
                  }}
                  placeholder="All CRF Designs"
                  searchPlaceholder="Search CRF designs..."
                  emptyOptionLabel="All CRF Designs"
                  prefetch
                  reloadKey="cdash-report-crf"
                  triggerClassName={selectTriggerClass}
                  className="!gap-0 w-full min-w-0"
                />
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 items-end gap-5 md:grid-cols-2 lg:grid-cols-3">
              {activeTab === TAB_FIELD ? (
                <>
                  <div className={filterFieldClass}>
                    <label className="flex items-center gap-1 text-sm font-bold text-slate-700">Search</label>
                    <Input
                      type="text"
                      placeholder="Field label, section, or CDASH variable..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange("search", e.target.value)}
                      disabled={!filters.studyId}
                      className="h-10 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className={filterFieldClass}>
                    <label className="flex items-center gap-1 text-sm font-bold text-slate-700">Mapping Status</label>
                    <Select
                      value={filters.isMapped || "all"}
                      onValueChange={(value) => handleFilterChange("isMapped", value === "all" ? "" : value)}
                      disabled={!filters.studyId}
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="All fields" />
                      </SelectTrigger>
                      <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                        <div className={REPORT_SELECT_SCROLL_LIST_CLASS}>
                          <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                            All Fields
                          </SelectItem>
                          <SelectItem value="true" className={REPORT_SELECT_ITEM_CLASS}>
                            Mapped Only
                          </SelectItem>
                          <SelectItem value="false" className={REPORT_SELECT_ITEM_CLASS}>
                            Pending Only
                          </SelectItem>
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="px-6 pb-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void handleSearch()}
              disabled={loading || !filters.studyId}
              className={REPORT_PRIMARY_BTN_CLASS}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Search
            </Button>
            <Button
              onClick={handleClearFilters}
              variant="outline"
              disabled={loading || !hasActiveFilters}
              className="border-slate-300 hover:bg-blue-50"
            >
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <div className="flex-1" />
            <ReportExportGate canExport={canExport} reportKey={reportKey}>
              <Button
                onClick={() => void handleExportZip()}
                variant="outline"
                disabled={exportingFormat !== null || !filters.studyId || loading}
                className="border-red-600 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {exportingFormat === "zip" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileArchive className="w-4 h-4 mr-2" />
                )}
                Export ZIP
              </Button>
            </ReportExportGate>
          </div>
        </div>

        <div className={REPORT_CARD_CLASS} role="region" aria-label="CDASH mapping report results">
          <div className={REPORT_RESULTS_HEADER_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">
                {resultsTitle}
                {hasSearched && resultsTotal > 0 ? ` (${resultsTotal} total)` : ""}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <ReportExportGate canExport={canExport} reportKey={reportKey}>
                  {activeTab === TAB_FIELD ? (
                    <Button
                      onClick={() => void handleExportDetailCsv()}
                      variant="outline"
                      disabled={exportingFormat !== null || !filters.studyId || loading}
                      className="border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700"
                    >
                      {exportingFormat === "detail" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4 mr-2" />
                      )}
                      Export Detail CSV
                    </Button>
                  ) : null}
                </ReportExportGate>
                <div className={REPORT_VIEW_SEGMENT_WRAP_CLASS} role="tablist" aria-label="CDASH report view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === TAB_CRF}
                    onClick={() => handleTabChange(TAB_CRF)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold transition-all",
                      activeTab === TAB_CRF ? REPORT_VIEW_SEGMENT_ACTIVE_CLASS : REPORT_VIEW_SEGMENT_IDLE_CLASS,
                    )}
                  >
                    CRF summary
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
          </div>

          {!hasStudySelected ? (
            <div className="text-center py-16 px-6">
              <Database className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">Select a CDASH-enabled study</p>
              <p className="text-slate-500 text-sm">Choose Study above, then click Search to load mapping data.</p>
            </div>
          ) : !hasSearched ? (
              <GridEmptyPrompt
                title={activeTab === TAB_FIELD ? "Field detail grid ready" : "CRF summary grid ready"}
                hint={
                  activeTab === TAB_FIELD
                    ? 'Click "Search" to load mapped vs pending fields (paginated). Use Mapping Status or Search filters to narrow results.'
                    : 'Click the purple "Search" button above to load CRF-level mapping counts.'
                }
              />
            ) : loading ? (
              <SectionSkeleton
                title={activeTab === TAB_FIELD ? "Loading CDASH field detail..." : "Loading CDASH CRF summary..."}
                rows={8}
                variant="audit"
              />
            ) : activeTab === TAB_CRF ? (
              summaryError ? (
                <div className="mx-6 my-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {summaryError}
                </div>
              ) : summaryRows.length === 0 ? (
                <div className="text-center py-16">
                  <Database className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium mb-2">No CRF mapping summary rows found</p>
                  <p className="text-slate-500 text-sm">Try adjusting your filters.</p>
                </div>
              ) : (
                <div className={REPORT_TABLE_SCROLL_CLASS} role="region" aria-label="CDASH CRF mapping summary grid">
                  <table className={cn("w-full", "table-fixed", "min-w-[720px]")}>
                    <thead className={REPORT_TABLE_HEAD_ROW_CLASS}>
                      <tr>
                        {SUMMARY_COLUMNS.map((column) => (
                          <th key={column.key} className={cn(REPORT_TABLE_TH_CLASS, column.colClass)}>
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={REPORT_TABLE_BODY_CLASS}>
                      {summaryRows.map((row, index) => (
                        <tr
                          key={`${row.crfDesignId}-${row.visitType}-${index}`}
                          className={REPORT_TABLE_TR_CLASS}
                        >
                          {SUMMARY_COLUMNS.map((column) => (
                            <td
                              key={column.key}
                              className={cn(
                                REPORT_TABLE_TD_CLASS,
                                column.colClass && !column.fullDisplay && "max-w-0",
                                column.colClass,
                              )}
                            >
                              {renderSummaryCell(row, column)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : fieldError ? (
              <div className="mx-6 my-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {fieldError}
              </div>
            ) : fieldRows.length === 0 ? (
              <div className="text-center py-16">
                <Database className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 font-medium mb-2">No field mapping rows found</p>
                <p className="text-slate-500 text-sm">Try adjusting search or mapping status filters.</p>
              </div>
            ) : (
              <>
                <div className={REPORT_TABLE_SCROLL_CLASS} role="region" aria-label="CDASH field mapping grid">
                  <table className={cn("w-full", "table-fixed", "min-w-[1080px]")}>
                    <thead className={REPORT_TABLE_HEAD_ROW_CLASS}>
                      <tr>
                        {FIELD_COLUMNS.map((column) => (
                          <th key={column.key} className={cn(REPORT_TABLE_TH_CLASS, column.colClass)}>
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={REPORT_TABLE_BODY_CLASS}>
                      {fieldRows.map((row, index) => (
                        <tr key={fieldRowKey(row, index)} className={REPORT_TABLE_TR_CLASS}>
                          {FIELD_COLUMNS.map((column) => {
                            const cellText = renderFieldCell(row, column)
                            return (
                              <td
                                key={column.key}
                                className={cn(
                                  REPORT_TABLE_TD_CLASS,
                                  column.colClass && !column.fullDisplay && "max-w-0",
                                  column.colClass,
                                )}
                              >
                                {column.truncTooltip
                                  ? renderGridCell(row, column, cellText)
                                  : (
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
                {fieldTotalPagesResolved > 0 ? (
                  <div className="border-t border-slate-200 bg-white px-2">
                    <DataPagination
                      currentPage={filters.pageNumber}
                      pageSize={filters.pageSize}
                      totalPages={fieldTotalPagesResolved}
                      totalCount={fieldTotalCount}
                      pageSizeOptions={REPORT_PAGE_SIZE_OPTIONS}
                      onPageChange={(page) => {
                        const next = { ...filters, pageNumber: page }
                        setFilters(next)
                        void loadFieldReport(next)
                      }}
                      onPageSizeChange={(pageSize) => {
                        const next = { ...filters, pageSize, pageNumber: 1 }
                        setFilters(next)
                        void loadFieldReport(next)
                      }}
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
