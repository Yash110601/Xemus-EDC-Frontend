"use client"

import { useCallback, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import StudyPagedSelect from "@/components/ui/study-paged-select"
import SitePagedSelect from "@/components/ui/site-paged-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
} from "@/lib/reports/studySitePatientReportUi"
import { pickDtoField, toReportDisplay } from "@/lib/reports/reportRowDisplay"
import xemusAiService from "@/lib/services/xemusAi.service"
import { toast } from "sonner"
import { FileDown, Filter, Loader2, Search, Sparkles } from "lucide-react"
import { columnLabelWithTz } from "@/lib/utils/appDateTime"

const COLUMNS = [
  { key: "module", label: "Module", colClass: "w-[6rem]" },
  { key: "action", label: "Action", colClass: "w-[5rem]" },
  { key: "entityType", label: "Entity", colClass: "w-[6rem]" },
  { key: "confidence", label: "Confidence", colClass: "w-[5rem]" },
  { key: "accepted", label: "Accepted", colClass: "w-[5rem]" },
  { key: "userName", label: "User", colClass: "w-[8rem]" },
  { key: "siteName", label: "Site", colClass: "w-[5rem]" },
  { key: "createdAt", label: columnLabelWithTz("When"), colClass: "w-[9rem]" },
]

function formatAccepted(row) {
  const raw = pickDtoField(row, "accepted", "Accepted")
  if (raw === true || raw === "true" || raw === 1) return "Yes"
  if (raw === false || raw === "false" || raw === 0) return "No"
  return "—"
}

function formatConfidence(row) {
  const raw = pickDtoField(row, "confidence", "Confidence")
  const n = Number(raw)
  if (!Number.isFinite(n)) return "—"
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n)
  return `${pct}%`
}

function rowKey(row, index) {
  return [
    pickDtoField(row, "id", "Id") ?? "x",
    pickDtoField(row, "guid", "Guid") ?? "x",
    index,
  ].join("-")
}

export default function AiOversightReportPage() {
  const {
    filters,
    handleFilterChange,
    hasStudySelected,
    studyRequiredError,
    setStudyRequiredError,
  } = useAiEntryReportCascadingFilters()

  const [search, setSearch] = useState("")
  const [moduleFilter, setModuleFilter] = useState("all")
  const [acceptedFilter, setAcceptedFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)
  const [studyLabel, setStudyLabel] = useState("")
  const [siteLabel, setSiteLabel] = useState("")

  const runSearch = useCallback(async () => {
    const studyId = parseInt(String(filters.studyId || ""), 10)
    if (!Number.isFinite(studyId) || studyId <= 0) {
      setStudyRequiredError("Study is required.")
      toast.error("Select a study first.")
      return
    }
    setStudyRequiredError("")
    setLoading(true)
    setHasSearched(true)
    try {
      const res = await xemusAiService.getOversightReport({
        studyId,
        siteId: filters.siteId || undefined,
        module: moduleFilter !== "all" ? moduleFilter : undefined,
        accepted: acceptedFilter !== "all" ? acceptedFilter : undefined,
        search: search.trim() || undefined,
        pageNumber: filters.pageNumber,
        pageSize: filters.pageSize,
      })
      const page = xemusAiService.normalizeOversightPage(res)
      setRows(page.items ?? [])
      setTotalCount(page.totalCount ?? 0)
      setTotalPages(page.totalPages ?? 0)
    } catch (error) {
      toast.error(error?.message || "Failed to load AI oversight report")
      setRows([])
      setTotalCount(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [
    filters.studyId,
    filters.siteId,
    filters.pageNumber,
    filters.pageSize,
    moduleFilter,
    acceptedFilter,
    search,
    setStudyRequiredError,
  ])

  const handleExport = async () => {
    const studyId = parseInt(String(filters.studyId || ""), 10)
    if (!Number.isFinite(studyId) || studyId <= 0) return
    setExporting(true)
    try {
      await xemusAiService.exportOversightReport(
        {
          studyId,
          siteId: filters.siteId || undefined,
          module: moduleFilter !== "all" ? moduleFilter : undefined,
          accepted: acceptedFilter !== "all" ? acceptedFilter : undefined,
          search: search.trim() || undefined,
        },
        "csv",
      )
      toast.success("Export started")
    } catch (error) {
      toast.error(error?.message || "Export failed")
    } finally {
      setExporting(false)
    }
  }

  const showSkeleton = loading && !hasSearched

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className={REPORT_HEADER_ICON_WRAP_CLASS}>
            <Sparkles className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">AI Oversight Report</h1>
            <p className="text-sm text-slate-500">
              YP Intelligence suggestions — accept and reject rates across modules.
            </p>
          </div>
        </div>

        <div className={`${REPORT_CARD_CLASS} mb-4`}>
          <div className={REPORT_FILTER_HEADER_CLASS}>
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">Filters</span>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Study <span className="text-red-600">*</span>
              </label>
              <StudyPagedSelect
                value={filters.studyId || ""}
                selectedLabel={studyLabel}
                onValueChange={(v, item) => {
                  handleFilterChange("studyId", v)
                  setStudyLabel(item?.label ?? "")
                  setRows([])
                }}
              />
              {studyRequiredError ? (
                <p className="mt-1 text-xs text-red-600">{studyRequiredError}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Site</label>
              <SitePagedSelect
                studyId={filters.studyId || ""}
                value={filters.siteId || ""}
                selectedLabel={siteLabel}
                disabled={!hasStudySelected}
                onValueChange={(v, item) => {
                  handleFilterChange("siteId", v)
                  setSiteLabel(item?.label ?? "")
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Module</label>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">All modules</option>
                <option value="capture">Capture</option>
                <option value="verify">Verify</option>
                <option value="studio">Studio</option>
                <option value="guard">Guard</option>
                <option value="insight">Insight</option>
                <option value="consent">Consent</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Accepted</label>
              <select
                value={acceptedFilter}
                onChange={(e) => setAcceptedFilter(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">All</option>
                <option value="true">Accepted</option>
                <option value="false">Rejected</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="User, entity, action…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              <Button
                type="button"
                className={REPORT_PRIMARY_BTN_CLASS}
                disabled={loading}
                onClick={() => void runSearch()}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Search
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!hasStudySelected || exporting}
                onClick={() => void handleExport()}
              >
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        <div className={REPORT_CARD_CLASS}>
          <div className={REPORT_RESULTS_HEADER_CLASS}>
            <span>Results</span>
            {hasSearched ? (
              <span className="text-xs font-normal text-slate-500">{totalCount} suggestion(s)</span>
            ) : null}
          </div>

          {showSkeleton ? (
            <SectionSkeleton rows={8} className="p-4" />
          ) : (
            <>
              <div className={REPORT_TABLE_SCROLL_CLASS}>
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className={REPORT_TABLE_HEAD_ROW_CLASS}>
                      {COLUMNS.map((col) => (
                        <th key={col.key} className={`${REPORT_TABLE_TH_CLASS} ${col.colClass}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={REPORT_TABLE_BODY_CLASS}>
                    {!hasSearched ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                          Select a study and run search.
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                          No AI suggestion logs found.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, index) => (
                        <tr key={rowKey(row, index)} className={REPORT_TABLE_TR_CLASS}>
                          {COLUMNS.map((col) => (
                            <td key={col.key} className={`${REPORT_TABLE_TD_CLASS} ${col.colClass}`}>
                              {col.key === "accepted"
                                ? formatAccepted(row)
                                : col.key === "confidence"
                                  ? formatConfidence(row)
                                  : toReportDisplay(pickDtoField(row, col.key))}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {hasSearched && totalPages > 1 ? (
                <div className="border-t border-slate-100 p-3">
                  <DataPagination
                    currentPage={filters.pageNumber}
                    pageSize={filters.pageSize}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    onPageChange={(page) => handleFilterChange("pageNumber", page)}
                    onPageSizeChange={(size) => {
                      handleFilterChange("pageSize", size)
                      handleFilterChange("pageNumber", 1)
                    }}
                    showPageSizeSelector
                    pageSizeOptions={REPORT_PAGE_SIZE_OPTIONS}
                    itemName="suggestions"
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
