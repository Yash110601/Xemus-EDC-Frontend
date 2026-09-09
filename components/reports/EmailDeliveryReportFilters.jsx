"use client"

/**
 * Email Delivery Report filters — Audit Log shell, 4 fields per row, Export CSV.
 * User DD uses AsyncLookupSelect (scroll loads next page). Controls match From (IST) DatePicker.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectItem } from "@/components/ui/select"
import DatePicker from "@/components/ui/date-picker"
import ReportFilterSelect from "@/components/reports/ReportFilterSelect"
import ReportExportGate from "@/components/reports/ReportExportGate"
import { REPORT_FILTER_CONTROL_CLASS } from "@/components/reports/StudySitePatientReportFilters"
import StudyPagedSelect from "@/components/ui/study-paged-select"
import SitePagedSelect from "@/components/ui/site-paged-select"
import AsyncLookupSelect from "@/components/ui/async-lookup-select"
import {
  REPORT_FILTER_FIELD_CLASS,
  REPORT_FILTER_GRID_4_CLASS,
  REPORT_PRIMARY_BTN_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  getStudyFilterDisplayName,
} from "@/lib/reports/studySitePatientReportUi"
import {
  DELIVERY_OUTCOME_OPTIONS,
  EMAIL_TYPE_OPTIONS,
  PROVIDER_OPTIONS,
  SUBMIT_STATUS_OPTIONS,
} from "@/lib/reports/emailDeliveryReportDisplay"
import { DROPDOWN_PAGE_SIZE } from "@/lib/api/lookupLimits"
import userService from "@/lib/services/user.service"
import { cn } from "@/lib/utils"
import { FileDown, Loader2, Search, X } from "lucide-react"
import { columnLabelWithTz } from "@/lib/utils/appDateTime"
import { useAppTime } from "@/context/AppTimeContext"

const FILTER_ROW_CLASS = cn(REPORT_FILTER_GRID_4_CLASS, "mb-5 gap-5")
const FIELD_LABEL_CLASS = "text-sm font-bold text-slate-800"

function filterBySearch(items, search, getLabel) {
  const q = String(search || "")
    .trim()
    .toLowerCase()
  if (!q) return items
  return items.filter((item) => String(getLabel(item) || "").toLowerCase().includes(q))
}

function userOptionLabel(u) {
  const id = u?.userId || u?.id
  const email = u?.email || u?.userEmail || ""
  const name =
    u?.userName ||
    u?.username ||
    `${u?.firstName || ""} ${u?.lastName || ""}`.trim() ||
    ""
  return email || name || (id ? `User ${id}` : "")
}

export default function EmailDeliveryReportFilters({
  filters,
  onFilterChange,
  onApply,
  onClear,
  onExportCsv,
  hasActiveFilters,
  canExport = false,
  reportKey = "EMAIL_DELIVERY_REPORT",
  applying = false,
  exportingCsv = false,
}) {
  const { displayName } = useAppTime()
  const [emailTypeSearch, setEmailTypeSearch] = useState("")
  const [statusSearch, setStatusSearch] = useState("")
  const [deliverySearch, setDeliverySearch] = useState("")
  const [providerSearch, setProviderSearch] = useState("")
  const [selectedStudyLabel, setSelectedStudyLabel] = useState("")
  const [selectedSiteLabel, setSelectedSiteLabel] = useState("")
  const [selectedUserLabel, setSelectedUserLabel] = useState("")

  useEffect(() => {
    if (!filters.studyId) setSelectedStudyLabel("")
  }, [filters.studyId])

  useEffect(() => {
    if (!filters.siteId) setSelectedSiteLabel("")
  }, [filters.siteId])

  useEffect(() => {
    if (!filters.userId) setSelectedUserLabel("")
  }, [filters.userId])

  const loadUserOptions = useCallback(async (q = "", { page = 1 } = {}) => {
    const res = await userService.lookupUsers({
      q: String(q || "").trim(),
      pageNumber: page,
      pageSize: DROPDOWN_PAGE_SIZE,
    })
    if (res?.isSuccess === false) {
      throw new Error(res?.message || "Failed to load users")
    }
    const items = res?.items || res?.data?.items || []
    const pageNumber = res?.pageNumber ?? res?.data?.pageNumber ?? page
    const totalPages = res?.totalPages ?? res?.data?.totalPages
    const truncated = Boolean(res?.truncated ?? res?.data?.truncated)
    const hasMore = Boolean(
      res?.hasMore ??
        res?.data?.hasMore ??
        (truncated || (totalPages != null && Number(pageNumber) < Number(totalPages))),
    )
    return { items, pageNumber, totalPages, truncated, hasMore }
  }, [])

  const filteredEmailTypes = useMemo(
    () => filterBySearch(EMAIL_TYPE_OPTIONS.filter((o) => o.value), emailTypeSearch, (o) => o.label),
    [emailTypeSearch],
  )
  const filteredStatuses = useMemo(
    () => filterBySearch(SUBMIT_STATUS_OPTIONS.filter((o) => o.value), statusSearch, (o) => o.label),
    [statusSearch],
  )
  const filteredDelivery = useMemo(
    () =>
      filterBySearch(
        DELIVERY_OUTCOME_OPTIONS.filter((o) => o.value),
        deliverySearch,
        (o) => o.label,
      ),
    [deliverySearch],
  )
  const filteredProviders = useMemo(
    () => filterBySearch(PROVIDER_OPTIONS.filter((o) => o.value), providerSearch, (o) => o.label),
    [providerSearch],
  )

  return (
    <div className="p-6">
      <div className={FILTER_ROW_CLASS}>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className={FIELD_LABEL_CLASS}>{columnLabelWithTz("From", displayName)}</label>
          <DatePicker
            value={filters.fromDate || ""}
            onChange={(value) => onFilterChange("fromDate", value || "")}
            placeholder="dd-mm-yyyy"
            maxDate={filters.toDate || undefined}
            className={REPORT_FILTER_CONTROL_CLASS}
          />
        </div>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className={FIELD_LABEL_CLASS}>{columnLabelWithTz("To", displayName)}</label>
          <DatePicker
            value={filters.toDate || ""}
            onChange={(value) => onFilterChange("toDate", value || "")}
            placeholder="dd-mm-yyyy"
            minDate={filters.fromDate || undefined}
            className={REPORT_FILTER_CONTROL_CLASS}
          />
        </div>
        <ReportFilterSelect
          label="Email type"
          value={filters.emailType}
          onValueChange={(v) => onFilterChange("emailType", v)}
          placeholder="All types"
          allOptionLabel="All types"
          searchValue={emailTypeSearch}
          onSearchChange={setEmailTypeSearch}
          searchPlaceholder="Search types..."
          triggerClassName={REPORT_FILTER_CONTROL_CLASS}
        >
          {filteredEmailTypes.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className={REPORT_SELECT_ITEM_CLASS}>
              {opt.label}
            </SelectItem>
          ))}
        </ReportFilterSelect>
        <ReportFilterSelect
          label="Submit status"
          value={filters.status}
          onValueChange={(v) => onFilterChange("status", v)}
          placeholder="All submit statuses"
          allOptionLabel="All submit statuses"
          searchValue={statusSearch}
          onSearchChange={setStatusSearch}
          searchPlaceholder="Search..."
          triggerClassName={REPORT_FILTER_CONTROL_CLASS}
        >
          {filteredStatuses.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className={REPORT_SELECT_ITEM_CLASS}>
              {opt.label}
            </SelectItem>
          ))}
        </ReportFilterSelect>
      </div>

      <div className={FILTER_ROW_CLASS}>
        <ReportFilterSelect
          label="Delivery outcome"
          value={filters.deliveryOutcome}
          onValueChange={(v) => onFilterChange("deliveryOutcome", v)}
          placeholder="All delivery outcomes"
          allOptionLabel="All delivery outcomes"
          searchValue={deliverySearch}
          onSearchChange={setDeliverySearch}
          searchPlaceholder="Search..."
          triggerClassName={REPORT_FILTER_CONTROL_CLASS}
        >
          {filteredDelivery.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className={REPORT_SELECT_ITEM_CLASS}>
              {opt.label}
            </SelectItem>
          ))}
        </ReportFilterSelect>
        <ReportFilterSelect
          label="Provider"
          value={filters.provider}
          onValueChange={(v) => onFilterChange("provider", v)}
          placeholder="All providers"
          allOptionLabel="All providers"
          searchValue={providerSearch}
          onSearchChange={setProviderSearch}
          searchPlaceholder="Search..."
          triggerClassName={REPORT_FILTER_CONTROL_CLASS}
        >
          {filteredProviders.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className={REPORT_SELECT_ITEM_CLASS}>
              {opt.label}
            </SelectItem>
          ))}
        </ReportFilterSelect>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className={FIELD_LABEL_CLASS}>Study</label>
          <div className="w-full min-w-0 max-w-full">
            <StudyPagedSelect
              label=""
              value={filters.studyId || ""}
              selectedLabel={selectedStudyLabel}
              onValueChange={(v, item) => {
                onFilterChange("studyId", v || "")
                onFilterChange("siteId", "")
                setSelectedStudyLabel(item ? item.studyProtocolNumber || getStudyFilterDisplayName(item) : "")
                setSelectedSiteLabel("")
              }}
              placeholder="All Studies"
              searchPlaceholder="Search studies..."
              emptyOptionLabel="All Studies"
              prefetch
              reloadKey="email-delivery-study"
              triggerClassName={REPORT_FILTER_CONTROL_CLASS}
              className="!gap-0 w-full min-w-0 max-w-full"
              emptyMessage="No studies found."
            />
          </div>
        </div>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className={FIELD_LABEL_CLASS}>Site</label>
          <div className="w-full min-w-0 max-w-full">
            <SitePagedSelect
              label=""
              studyId={filters.studyId || null}
              value={filters.siteId || ""}
              selectedLabel={selectedSiteLabel}
              onValueChange={(v, item) => {
                onFilterChange("siteId", v || "")
                if (!item) {
                  setSelectedSiteLabel("")
                  return
                }
                const id = item.siteId ?? item.id
                const code = item.siteCode || item.code || ""
                const name = item.siteName || item.name || ""
                setSelectedSiteLabel(code && name ? `${code} - ${name}` : name || code || (id ? `Site ${id}` : ""))
              }}
              placeholder={!filters.studyId ? "Select study first" : "All Sites"}
              searchPlaceholder="Search sites..."
              emptyOptionLabel="All Sites"
              prefetch
              reloadKey="email-delivery-site"
              triggerClassName={REPORT_FILTER_CONTROL_CLASS}
              className="!gap-0 w-full min-w-0 max-w-full"
              emptyMessage="No sites found."
            />
          </div>
        </div>
      </div>

      <div className={FILTER_ROW_CLASS}>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className={FIELD_LABEL_CLASS}>User</label>
          <div className="w-full min-w-0 max-w-full">
            <AsyncLookupSelect
              label=""
              value={filters.userId || ""}
              selectedLabel={selectedUserLabel}
              onValueChange={(v, item) => {
                onFilterChange("userId", v || "")
                if (!item) {
                  setSelectedUserLabel("")
                  return
                }
                setSelectedUserLabel(userOptionLabel(item))
              }}
              placeholder="All Users"
              searchPlaceholder="Search users..."
              emptyOptionLabel="All Users"
              loadOptions={loadUserOptions}
              getOptionValue={(u) => String(u.userId || u.id || "")}
              getOptionLabel={userOptionLabel}
              prefetch
              reloadKey="email-delivery-user"
              triggerClassName={REPORT_FILTER_CONTROL_CLASS}
              className="!gap-0 w-full min-w-0 max-w-full"
              emptyMessage="No users found."
            />
          </div>
        </div>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className={FIELD_LABEL_CLASS}>To contains</label>
          <Input
            value={filters.toContains || ""}
            onChange={(e) => onFilterChange("toContains", e.target.value)}
            placeholder="e.g. @company.com"
            className={REPORT_FILTER_CONTROL_CLASS}
          />
        </div>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className={FIELD_LABEL_CLASS}>Created by</label>
          <Input
            value={filters.createdByContains || ""}
            onChange={(e) => onFilterChange("createdByContains", e.target.value)}
            placeholder="Created by contains..."
            className={REPORT_FILTER_CONTROL_CLASS}
          />
        </div>
      </div>

      {/* Audit Log action bar — Search / Clear left, Export CSV right */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={onApply}
          disabled={applying || exportingCsv}
          className={REPORT_PRIMARY_BTN_CLASS}
        >
          {applying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Search
            </>
          )}
        </Button>

        <Button
          type="button"
          onClick={onClear}
          variant="outline"
          disabled={applying || exportingCsv || !hasActiveFilters}
          className="border-slate-300 hover:bg-blue-50"
        >
          <X className="w-4 h-4 mr-2" />
          Clear
        </Button>

        <div className="flex-1 min-w-[8px]" />

        <ReportExportGate canExport={canExport} reportKey={reportKey}>
          <Button
            type="button"
            onClick={onExportCsv}
            disabled={applying || exportingCsv}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700"
          >
            {exportingCsv ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            Export CSV
          </Button>
        </ReportExportGate>
      </div>
    </div>
  )
}
