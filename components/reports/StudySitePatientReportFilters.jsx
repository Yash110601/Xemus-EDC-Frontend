"use client"

import { Input } from "@/components/ui/input"
import DatePicker from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  REPORT_FILTER_FIELD_CLASS,
  REPORT_FILTER_GRID_CLASS,
  REPORT_INPUT_CLASS,
  REPORT_SELECT_CONTENT_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  REPORT_SELECT_SEARCH_INPUT_CLASS,
  REPORT_SELECT_TRIGGER_CLASS,
} from "@/lib/reports/studySitePatientReportUi"

/** Match DatePicker / Date To control size + design across report filters. */
export const REPORT_FILTER_CONTROL_CLASS = cn(
  "box-border flex h-10 min-h-10 max-h-10 w-full min-w-0 max-w-full items-center rounded-xl border-2 border-slate-200 bg-white px-4 py-0 text-sm shadow-sm",
  "hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all",
)

/**
 * Study → Site → Patient filters in a 5-column premium layout (lg), with optional second-row slot.
 */
export default function StudySitePatientReportFilters({
  filters,
  onFilterChange,
  studies,
  sites,
  patients,
  loadingStudies,
  loadingSites,
  loadingPatients,
  studySearch,
  onStudySearchChange,
  siteSearch,
  onSiteSearchChange,
  patientSearch,
  onPatientSearchChange,
  studyRequiredError,
  /** Rendered after Patient, before Search (e.g. Query age on row 1). */
  firstRowBeforeSearch = null,
  /** Rendered after Patient when `hideDefaultSearch` (e.g. SDV Visit on row 1). */
  firstRowAfterPatient = null,
  /** Hide row-1 Search (use with `secondRowContent` to place Search on row 2). */
  hideDefaultSearch = false,
  /** Override default 5-column grid (e.g. `REPORT_FILTER_GRID_4_CLASS`). */
  filterGridClass = REPORT_FILTER_GRID_CLASS,
  /** Replaces default Date From/To + `secondRowExtra` row. */
  secondRowContent = null,
  secondRowExtra = null,
}) {
  const selectTriggerClass = cn(REPORT_SELECT_TRIGGER_CLASS, "!w-full min-w-0 max-w-full")

  return (
    <div className="p-6 space-y-5">
      <div className={filterGridClass}>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">
            Study <span className="text-red-600">*</span>
          </label>
          <Select
            value={filters.studyId || "all"}
            onValueChange={(v) => onFilterChange("studyId", v === "all" ? "" : v)}
            disabled={loadingStudies}
          >
            <SelectTrigger
              className={cn(
                selectTriggerClass,
                !filters.studyId && "border-red-300 focus:border-red-500 focus:ring-red-100",
              )}
            >
              <SelectValue placeholder={loadingStudies ? "Loading studies..." : "Select Study"} />
            </SelectTrigger>
            <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
              <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    value={studySearch}
                    onChange={(e) => onStudySearchChange(e.target.value)}
                    placeholder="Search studies..."
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className={REPORT_SELECT_SEARCH_INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                  All Studies
                </SelectItem>
                {studies
                  .filter((st) => {
                    if (!studySearch.trim()) return true
                    const s = studySearch.toLowerCase()
                    const id = st.studyId || st.id
                    const protocol = st.studyProtocolNumber || st.protocolNumber || ""
                    const name = st.studyName || st.name || ""
                    return `${protocol} ${name} ${id || ""}`.toLowerCase().includes(s)
                  })
                  .map((st) => {
                    const id = st.studyId || st.id
                    if (!id) return null
                    const protocol = st.studyProtocolNumber || st.protocolNumber || ""
                    const name = st.studyName || st.name || ""
                    const label = protocol && name ? `${protocol} - ${name}` : protocol || name || `Study ${id}`
                    return (
                      <SelectItem key={id} value={String(id)} className={REPORT_SELECT_ITEM_CLASS}>
                        {label}
                      </SelectItem>
                    )
                  })}
              </div>
            </SelectContent>
          </Select>
          {studyRequiredError && !filters.studyId && (
            <p className="text-xs text-red-600 font-medium">Study is required.</p>
          )}
        </div>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">Site</label>
          <Select
            value={filters.siteId || "all"}
            onValueChange={(v) => onFilterChange("siteId", v === "all" ? "" : v)}
            disabled={loadingSites || !filters.studyId}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue
                placeholder={!filters.studyId ? "Select Study first" : loadingSites ? "Loading sites..." : "Select Site"}
              />
            </SelectTrigger>
            <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
              <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    value={siteSearch}
                    onChange={(e) => onSiteSearchChange(e.target.value)}
                    placeholder="Search sites..."
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className={REPORT_SELECT_SEARCH_INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                  All Sites
                </SelectItem>
                {sites
                  .filter((si) => {
                    if (!siteSearch.trim()) return true
                    const s = siteSearch.toLowerCase()
                    const id = si.siteId || si.id
                    const code = si.siteCode || si.code || ""
                    const name = si.siteName || si.name || ""
                    return `${code} ${name} ${id || ""}`.toLowerCase().includes(s)
                  })
                  .map((si) => {
                    const id = si.siteId || si.id
                    if (!id) return null
                    const code = si.siteCode || si.code || ""
                    const name = si.siteName || si.name || ""
                    const label = code && name ? `${code} - ${name}` : name || code || `Site ${id}`
                    return (
                      <SelectItem key={id} value={String(id)} className={REPORT_SELECT_ITEM_CLASS}>
                        {label}
                      </SelectItem>
                    )
                  })}
              </div>
            </SelectContent>
          </Select>
        </div>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">Patient</label>
          <Select
            value={filters.patientId || "all"}
            onValueChange={(v) => onFilterChange("patientId", v === "all" ? "" : v)}
            disabled={loadingPatients || !filters.studyId || !filters.siteId}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue
                placeholder={
                  !filters.studyId || !filters.siteId
                    ? "Select Study + Site first"
                    : loadingPatients
                      ? "Loading patients..."
                      : "Select Patient"
                }
              />
            </SelectTrigger>
            <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
              <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => onPatientSearchChange(e.target.value)}
                    placeholder="Search patients..."
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className={REPORT_SELECT_SEARCH_INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                  All Patients
                </SelectItem>
                {patients
                  .filter((p) => {
                    if (!patientSearch.trim()) return true
                    const s = patientSearch.toLowerCase()
                    const id = p.patientId || p.patientEnrolmentId || p.id
                    const code = p.patientCode || ""
                    const initial = p.initial || ""
                    const name = p.name || ""
                    return `${code} ${initial} ${name} ${id || ""}`.toLowerCase().includes(s)
                  })
                  .map((p) => {
                    const id = p.patientId || p.patientEnrolmentId || p.id
                    if (!id) return null
                    const label = p.initial || p.patientCode || p.name || `Patient ${id}`
                    return (
                      <SelectItem key={id} value={String(id)} className={REPORT_SELECT_ITEM_CLASS}>
                        {label}
                      </SelectItem>
                    )
                  })}
              </div>
            </SelectContent>
          </Select>
        </div>
        {firstRowAfterPatient}
        {firstRowBeforeSearch}
        {!hideDefaultSearch && (
          <div className={REPORT_FILTER_FIELD_CLASS}>
            <label className="text-sm font-bold text-slate-700">Search</label>
            <Input
              value={filters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
              placeholder="Search..."
              className={cn(REPORT_INPUT_CLASS, "w-full min-w-0")}
            />
          </div>
        )}
      </div>

      {secondRowContent ? (
        secondRowContent
      ) : (
        <div className={filterGridClass}>
          <div className={REPORT_FILTER_FIELD_CLASS}>
            <label className="text-sm font-bold text-slate-700">Date From</label>
            <DatePicker value={filters.dateFrom} onChange={(value) => onFilterChange("dateFrom", value || "")} />
          </div>
          <div className={REPORT_FILTER_FIELD_CLASS}>
            <label className="text-sm font-bold text-slate-700">Date To</label>
            <DatePicker value={filters.dateTo} onChange={(value) => onFilterChange("dateTo", value || "")} />
          </div>
          {secondRowExtra}
        </div>
      )}
    </div>
  )
}
