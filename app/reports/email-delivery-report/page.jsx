"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AppTooltip } from "@/components/ui/tooltip"
import EmailDeliveryReportFilters from "@/components/reports/EmailDeliveryReportFilters"
import { TruncTooltipCopyCell } from "@/components/reports/trunc-tooltip-copy-cell"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import { useReportExportJobs } from "@/context/ReportExportJobsContext"
import {
  EMAIL_DELIVERY_REPORT_INITIAL_FILTERS,
  REPORT_CARD_CLASS,
  REPORT_FILTER_HEADER_CLASS,
  REPORT_HEADER_ICON_WRAP_CLASS,
  REPORT_PAGE_SHELL_CLASS,
  REPORT_PAGE_SIZE_OPTIONS,
  REPORT_RESULTS_HEADER_CLASS,
  REPORT_TABLE_BODY_CLASS,
  REPORT_TABLE_HEAD_ROW_CLASS,
  REPORT_TABLE_SCROLL_CLASS,
  REPORT_TABLE_TD_CLASS,
  REPORT_TABLE_TH_CLASS,
  REPORT_TABLE_TR_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import {
  DELIVERY_STATUS_TOOLTIP,
  EMAIL_STATUS_TOOLTIP,
  NOTE_MESSAGE_TOOLTIP,
  formatAddressList,
  formatEmailTypeLabel,
  formatProviderLabel,
  getCreatedByDisplay,
  getDefaultEmailDeliveryDateRange,
  getDeliverySeverityBadgeClass,
  getEmailCreatedAtDisplay,
  getEmailDeliveryStatusDisplay,
  getEmailDeliveryUpdatedAtDisplay,
  hasAwaitingDeliveryRows,
  getSiteNameDisplay,
  getStudyNameDisplay,
  getSubmitLabelBadgeClass,
} from "@/lib/reports/emailDeliveryReportDisplay"
import { pickDtoField, toReportDisplay } from "@/lib/reports/reportRowDisplay"
import emailDeliveryReportService from "@/lib/services/emailDeliveryReport.service"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Filter, HelpCircle, Mail, X } from "lucide-react"
import { columnLabelWithTz, getAppTimeDisplayName } from "@/lib/utils/appDateTime"
import { useAppTime } from "@/context/AppTimeContext"

function buildDefaultFilters() {
  const range = getDefaultEmailDeliveryDateRange()
  return {
    ...EMAIL_DELIVERY_REPORT_INITIAL_FILTERS,
    fromDate: range.fromDate,
    toDate: range.toDate,
    pageNumber: 1,
    pageSize: 20,
  }
}

function isNonDefaultFilter(filters) {
  const defaults = buildDefaultFilters()
  return (
    filters.fromDate !== defaults.fromDate ||
    filters.toDate !== defaults.toDate ||
    Boolean(filters.emailType) ||
    Boolean(filters.status) ||
    Boolean(filters.deliveryOutcome) ||
    Boolean(filters.provider) ||
    Boolean(filters.studyId) ||
    Boolean(filters.siteId) ||
    Boolean(filters.userId) ||
    Boolean(String(filters.toContains || "").trim()) ||
    Boolean(String(filters.createdByContains || "").trim())
  )
}

function rowKey(row, index) {
  const id =
    pickDtoField(row, "id") ??
    pickDtoField(row, "emailLogId") ??
    pickDtoField(row, "providerMessageId") ??
    pickDtoField(row, "correlationId")
  if (id != null && String(id).trim() !== "") return String(id)
  return `email-row-${index}`
}

function DetailField({ label, value, mono = false, multiline = false }) {
  const text = value == null || String(value).trim() === "" ? "—" : String(value)
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 leading-none">
        {label}
      </p>
      <p
        className={cn(
          "text-sm text-slate-900 leading-relaxed",
          mono && "font-mono text-[13px] break-all",
          multiline ? "whitespace-pre-wrap break-words" : "break-words",
        )}
      >
        {text}
      </p>
    </div>
  )
}

function StatusHeader({ label, tooltip }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <AppTooltip content={tooltip} side="top">
        <button
          type="button"
          className="inline-flex text-slate-400 hover:text-emerald-600"
          aria-label={`${label} help`}
          onClick={(e) => e.stopPropagation()}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </AppTooltip>
    </span>
  )
}

/** SR grid: badge only (Failed→red else green; delivery from deliverySeverity). */
function StatusBadge({ label, className }) {
  return <Badge className={cn("w-fit max-w-full", className)}>{label}</Badge>
}

export default function EmailDeliveryReportPage() {
  const { columnLabel, displayName } = useAppTime()
  const { canExport, assertCanExport, reportKey } = useReportExportAccess("EMAIL_DELIVERY_REPORT")
  const { startReportExport, jobs } = useReportExportJobs()
  const csvRunning = jobs.some((j) => j.kind === "email-delivery-csv" && j.status === "running")

  const [filters, setFilters] = useState(buildDefaultFilters)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [selectedRow, setSelectedRow] = useState(null)

  const isLoadingRef = useRef(false)
  const loadRequestIdRef = useRef(0)
  const awaitingRefreshStartedRef = useRef(null)
  const hasActiveFilters = useMemo(() => isNonDefaultFilter(filters), [filters])

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const loadReport = useCallback(async (override = null, options = {}) => {
    const { silent = false } = options
    const active = override || filters

    if (active.fromDate && active.toDate && active.fromDate > active.toDate) {
      toast.error("From date cannot be after To date")
      return
    }

    const requestId = ++loadRequestIdRef.current
    isLoadingRef.current = true
    if (!silent) {
      setLoading(true)
      setLoadError("")
    }
    try {
      const response = await emailDeliveryReportService.getDeliveryReport(active)
      // Ignore stale responses when a newer load started
      if (requestId !== loadRequestIdRef.current) return

      const page = emailDeliveryReportService.normalizePage(response)
      setRows(page.items)
      setTotalCount(page.totalCount)
      setTotalPages(page.totalPages)
      if (!silent) setLoadError("")
      if (page.pageNumber && page.pageNumber !== active.pageNumber) {
        setFilters((prev) => ({ ...prev, pageNumber: page.pageNumber }))
      }
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return
      if (silent) return
      console.error("Email delivery report load failed", error)
      const message = error?.message || "Failed to load email delivery report"
      setLoadError(message)
      setRows([])
      setTotalCount(0)
      setTotalPages(0)
      toast.error(message)
    } finally {
      if (requestId === loadRequestIdRef.current) {
        if (!silent) setLoading(false)
        isLoadingRef.current = false
      }
    }
  }, [filters])

  const handleApplyFilters = useCallback(() => {
    const next = { ...filters, pageNumber: 1 }
    const alreadyOnPageOne = filters.pageNumber === 1
    setFilters(next)
    // If pageNumber does not change, the paging useEffect will not run — load once here.
    // If page resets 2+ → 1, the useEffect handles the single load (avoid double fetch).
    if (alreadyOnPageOne) {
      void loadReport(next)
    }
  }, [filters, loadReport])

  const handleClearFilters = useCallback(() => {
    const next = buildDefaultFilters()
    const alreadyOnPageOne = filters.pageNumber === 1
    setFilters(next)
    if (alreadyOnPageOne) {
      void loadReport(next)
    }
  }, [filters.pageNumber, loadReport])

  const handleExportCsv = useCallback(() => {
    if (!assertCanExport()) return
    if (csvRunning) return

    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      toast.error("From date cannot be after To date")
      return
    }

    startReportExport({
      kind: "email-delivery-csv",
      label: "Email delivery (CSV)",
      task: async (setDetail) => {
        setDetail("Requesting CSV…")
        // Same filters as grid; service omits pageNumber/pageSize
        const result = await emailDeliveryReportService.exportDeliveryReport(filters)
        setDetail(result?.filename ? `Saved ${result.filename}` : "Download started")
      },
    })
  }, [assertCanExport, csvRunning, filters, startReportExport])

  useEffect(() => {
    void loadReport()
    // Paging only — Search/Clear load themselves when pageNumber stays 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.pageNumber, filters.pageSize])

  const hasAwaitingRows = useMemo(() => hasAwaitingDeliveryRows(rows), [rows])

  useEffect(() => {
    if (!hasAwaitingRows) {
      awaitingRefreshStartedRef.current = null
      return undefined
    }

    if (!awaitingRefreshStartedRef.current) {
      awaitingRefreshStartedRef.current = Date.now()
    }

    const startedAt = awaitingRefreshStartedRef.current
    const maxMs = 15 * 60 * 1000
    const intervalMs = 60 * 1000

    const timer = setInterval(() => {
      if (Date.now() - startedAt >= maxMs) {
        clearInterval(timer)
        return
      }
      if (!isLoadingRef.current) {
        void loadReport(null, { silent: true })
      }
    }, intervalMs)

    return () => clearInterval(timer)
  }, [hasAwaitingRows, loadReport])

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        {/* Page header */}
        <div className="mb-6 flex items-center gap-3">
          <div className={REPORT_HEADER_ICON_WRAP_CLASS}>
            <Mail className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-800">Email Delivery Report</h1>
            <p className="text-sm text-slate-600">
              Track ACS/SMTP submit status and Event Grid delivery outcomes. Default: last 7 days ({displayName || getAppTimeDisplayName()}).
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Submit = handed to provider · Delivery outcome = mailbox result (only Delivered is success).
              Pending rows auto-refresh every 60s for up to 15 minutes.
            </p>
          </div>
        </div>

        <div className={cn(REPORT_CARD_CLASS, "mb-6")}>
          <div className={REPORT_FILTER_HEADER_CLASS}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-600" />
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

          <EmailDeliveryReportFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            onExportCsv={handleExportCsv}
            hasActiveFilters={hasActiveFilters}
            canExport={canExport}
            reportKey={reportKey}
            applying={loading}
            exportingCsv={csvRunning}
          />
        </div>

        <div className={REPORT_CARD_CLASS}>
          <div className={REPORT_RESULTS_HEADER_CLASS}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                Delivery results{totalCount > 0 ? ` (${totalCount} total)` : ""}
              </h2>
              {loadError ? (
                <Button type="button" variant="outline" size="sm" onClick={() => loadReport()}>
                  Retry
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div
              className="p-6"
              role="status"
              aria-busy="true"
              aria-label="Loading email delivery report"
            >
              <SectionSkeleton variant="emailDeliveryReport" rows={8} title="Loading delivery results" />
            </div>
          ) : loadError ? (
            <div className="text-center py-16">
              <p className="text-slate-600 font-medium mb-2 text-red-600">{loadError}</p>
              <p className="text-slate-500 text-sm">Adjust filters or retry.</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <Mail className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No email delivery records found</p>
              <p className="text-slate-500 text-sm">
                Try widening the date range or clearing filters.
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  REPORT_TABLE_SCROLL_CLASS,
                  // Ensure horizontal scrollbar is usable for wide SR columns
                  "overflow-x-auto overflow-y-auto overscroll-x-contain",
                )}
                role="region"
                aria-label="Email delivery report results"
              >
                <table className="w-max min-w-[1900px] border-collapse table-fixed">
                  <thead className={REPORT_TABLE_HEAD_ROW_CLASS}>
                    <tr>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[160px] w-[160px]")}>Study</th>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[140px] w-[140px]")}>Site</th>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[140px] w-[140px]")}>Type</th>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[200px] w-[200px]")}>To</th>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[220px] w-[220px]")}>
                        Subject
                      </th>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[120px] w-[120px]")}>
                        <StatusHeader label="Email status" tooltip={EMAIL_STATUS_TOOLTIP} />
                      </th>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[140px] w-[140px]")}>
                        <StatusHeader label="Delivery status" tooltip={DELIVERY_STATUS_TOOLTIP} />
                      </th>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[280px] w-[280px]")}>
                        <StatusHeader label="Note / Message" tooltip={NOTE_MESSAGE_TOOLTIP} />
                      </th>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[90px] w-[90px]")}>
                        Provider
                      </th>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[160px] w-[160px]")}>
                        Created by
                      </th>
                      <th className={cn(REPORT_TABLE_TH_CLASS, "min-w-[160px] w-[160px]")}>
                        {columnLabel("Created at")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className={REPORT_TABLE_BODY_CLASS}>
                    {rows.map((row, index) => {
                      const statusView = getEmailDeliveryStatusDisplay(row)
                      const toText = formatAddressList(
                        pickDtoField(row, "toAddresses") ?? pickDtoField(row, "to"),
                      )
                      const subject = toReportDisplay(pickDtoField(row, "subject"))
                      const note = statusView.noteMessage
                      const createdByDisplay = getCreatedByDisplay(row)
                      const studyName = getStudyNameDisplay(row)
                      const siteName = getSiteNameDisplay(row)
                      const sentAtDisplay = getEmailCreatedAtDisplay(row)

                      return (
                        <tr
                          key={rowKey(row, index)}
                          className={cn(REPORT_TABLE_TR_CLASS, "cursor-pointer")}
                          onClick={() => setSelectedRow(row)}
                        >
                          <td className={REPORT_TABLE_TD_CLASS}>
                            <TruncTooltipCopyCell
                              value={studyName === "—" ? "" : studyName}
                              textClassName="text-sm"
                            />
                          </td>
                          <td className={REPORT_TABLE_TD_CLASS}>
                            <TruncTooltipCopyCell
                              value={siteName === "—" ? "" : siteName}
                              textClassName="text-sm"
                            />
                          </td>
                          <td className={cn(REPORT_TABLE_TD_CLASS, "whitespace-nowrap")}>
                            {formatEmailTypeLabel(pickDtoField(row, "emailType"))}
                          </td>
                          <td className={REPORT_TABLE_TD_CLASS}>
                            <TruncTooltipCopyCell
                              value={toText === "—" ? "" : toText}
                              textClassName="text-sm"
                            />
                          </td>
                          <td className={REPORT_TABLE_TD_CLASS}>
                            <TruncTooltipCopyCell
                              value={subject === "-" ? "" : String(subject)}
                              textClassName="text-sm"
                            />
                          </td>
                          <td className={REPORT_TABLE_TD_CLASS}>
                            <StatusBadge
                              label={statusView.submitLabel}
                              className={getSubmitLabelBadgeClass(statusView.submitLabel)}
                            />
                          </td>
                          <td className={REPORT_TABLE_TD_CLASS}>
                            <StatusBadge
                              label={statusView.deliveryLabel}
                              className={getDeliverySeverityBadgeClass(
                                statusView.deliverySeverity,
                              )}
                            />
                          </td>
                          <td className={cn(REPORT_TABLE_TD_CLASS, "align-top")}>
                            {note ? (
                              <p
                                className="text-sm leading-snug text-slate-600 whitespace-normal break-words"
                                title={note}
                              >
                                {note}
                              </p>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className={cn(REPORT_TABLE_TD_CLASS, "whitespace-nowrap")}>
                            {formatProviderLabel(pickDtoField(row, "provider"))}
                          </td>
                          <td className={REPORT_TABLE_TD_CLASS}>
                            <TruncTooltipCopyCell
                              value={createdByDisplay === "—" ? "" : createdByDisplay}
                              textClassName="text-sm"
                            />
                          </td>
                          <td className={cn(REPORT_TABLE_TD_CLASS, "whitespace-nowrap font-medium")}>
                            {sentAtDisplay}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 bg-white px-2">
                <DataPagination
                  currentPage={filters.pageNumber}
                  totalPages={Math.max(totalPages, 1)}
                  totalCount={totalCount}
                  pageSize={filters.pageSize}
                  itemName="emails"
                  showPageSizeSelector={true}
                  pageSizeOptions={REPORT_PAGE_SIZE_OPTIONS}
                  onPageChange={(page) => setFilters((prev) => ({ ...prev, pageNumber: page }))}
                  onPageSizeChange={(size) =>
                    setFilters((prev) => ({
                      ...prev,
                      pageSize: Math.min(Number(size) || 20, 100),
                      pageNumber: 1,
                    }))
                  }
                />
              </div>
            </>
          )}
        </div>
      </div>

      <Sheet open={Boolean(selectedRow)} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent
          className={cn(
            // Sit above report filters/selects (also z-50) so drawer content never paints under them
            "!z-[200] gap-0 bg-white p-0 sm:max-w-lg",
            "flex h-full w-full flex-col overflow-hidden border-l border-slate-200 shadow-2xl",
          )}
        >
          <SheetHeader className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 pr-12 text-left">
            <SheetTitle className="text-base font-bold text-slate-900">
              Email delivery detail
            </SheetTitle>
          </SheetHeader>

          {selectedRow ? (
            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5">
              <div className="flex flex-col gap-5">
                {(() => {
                  const statusView = getEmailDeliveryStatusDisplay(selectedRow)
                  const updatedAtDisplay = getEmailDeliveryUpdatedAtDisplay(selectedRow)
                  return (
                    <>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <DetailField label="Study" value={getStudyNameDisplay(selectedRow)} />
                        <DetailField label="Site" value={getSiteNameDisplay(selectedRow)} />
                        <DetailField
                          label="Type"
                          value={formatEmailTypeLabel(pickDtoField(selectedRow, "emailType"))}
                        />
                        <DetailField
                          label="Provider"
                          value={formatProviderLabel(pickDtoField(selectedRow, "provider"))}
                        />
                      </div>

                      <DetailField
                        label="To"
                        value={formatAddressList(
                          pickDtoField(selectedRow, "toAddresses") ??
                            pickDtoField(selectedRow, "to"),
                        )}
                      />
                      <DetailField label="Subject" value={pickDtoField(selectedRow, "subject")} />

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Email status
                          </p>
                          <StatusBadge
                            label={statusView.submitLabel}
                            className={getSubmitLabelBadgeClass(statusView.submitLabel)}
                          />
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Delivery status
                          </p>
                          <StatusBadge
                            label={statusView.deliveryLabel}
                            className={getDeliverySeverityBadgeClass(statusView.deliverySeverity)}
                          />
                        </div>
                      </div>

                      <DetailField
                        label="Note / Message"
                        value={statusView.noteMessage || "—"}
                        multiline
                      />

                      <div className="h-px bg-slate-200" />

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <DetailField label="Created by" value={getCreatedByDisplay(selectedRow)} />
                        <DetailField
                          label={columnLabelWithTz("Sent at", displayName)}
                          value={getEmailCreatedAtDisplay(selectedRow)}
                        />
                        {updatedAtDisplay ? (
                          <DetailField
                            label={columnLabelWithTz("Last updated", displayName)}
                            value={updatedAtDisplay}
                          />
                        ) : null}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  )
}
