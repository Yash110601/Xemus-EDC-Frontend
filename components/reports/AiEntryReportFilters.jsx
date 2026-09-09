"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { SelectItem } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import ReportFilterSelect from "@/components/reports/ReportFilterSelect"
import { REPORT_FILTER_CONTROL_CLASS } from "@/components/reports/StudySitePatientReportFilters"
import StudyPagedSelect from "@/components/ui/study-paged-select"
import SitePagedSelect from "@/components/ui/site-paged-select"
import PatientPagedSelect from "@/components/ui/patient-paged-select"
import { formatReportCrfDesignOptionLabel, formatReportPatientOptionLabel } from "@/lib/reports/reportPatientCascadeFilters"
import {
  AI_ENTRY_REPORT_CRF_STATUS_OPTIONS,
  AI_ENTRY_REPORT_TYPE_OPTIONS,
  REPORT_FILTER_FIELD_CLASS,
  REPORT_FILTER_GRID_CLASS,
  REPORT_SELECT_CONTENT_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  getStudyFilterDisplayName,
} from "@/lib/reports/studySitePatientReportUi"
import {
  Select,
  SelectContent,
  SelectItem as SelectItemRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function AiEntryReportFilters({
  filters,
  onFilterChange,
  visits,
  crfForms,
  loadingVisits = false,
  loadingCrfForms = false,
  studyRequiredError,
  visitSearch,
  onVisitSearchChange,
  crfSearch,
  onCrfSearchChange,
  hasStudySelected,
  hasSiteSelected,
  hasPatientSelected,
  hasVisitSelected,
}) {
  const visitSearchLower = visitSearch.trim().toLowerCase()
  const crfSearchLower = crfSearch.trim().toLowerCase()

  const [selectedStudyLabel, setSelectedStudyLabel] = useState("")
  const [selectedSiteLabel, setSelectedSiteLabel] = useState("")
  const [selectedPatientLabel, setSelectedPatientLabel] = useState("")

  const typeOptions = useMemo(() => AI_ENTRY_REPORT_TYPE_OPTIONS, [])

  useEffect(() => {
    if (!filters.studyId) setSelectedStudyLabel("")
  }, [filters.studyId])

  useEffect(() => {
    if (!filters.siteId) setSelectedSiteLabel("")
  }, [filters.siteId])

  useEffect(() => {
    if (!filters.patientEnrolmentId) setSelectedPatientLabel("")
  }, [filters.patientEnrolmentId])

  return (
    <div className="p-6 space-y-5">
      <div className={REPORT_FILTER_GRID_CLASS}>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">
            Study <span className="text-red-600">*</span>
          </label>
          <div className="w-full min-w-0 max-w-full">
            <StudyPagedSelect
              label=""
              value={filters.studyId || ""}
              selectedLabel={selectedStudyLabel}
              onValueChange={(v, item) => {
                onFilterChange("studyId", v || "")
                setSelectedStudyLabel(item ? item.studyProtocolNumber || getStudyFilterDisplayName(item) : "")
                setSelectedSiteLabel("")
                setSelectedPatientLabel("")
              }}
              placeholder="Select Study"
              searchPlaceholder="Search studies..."
              emptyOptionLabel="All Studies"
              prefetch
              reloadKey="ai-entry-study"
              triggerClassName={cn(
                REPORT_FILTER_CONTROL_CLASS,
                studyRequiredError && !filters.studyId && "border-red-300 focus:border-red-500 focus:ring-red-100",
              )}
              className="!gap-0 w-full min-w-0 max-w-full"
              emptyMessage="No studies found."
            />
          </div>
          {studyRequiredError && !filters.studyId && (
            <p className="text-xs text-red-600 font-medium">Study is required.</p>
          )}
        </div>

        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">Site</label>
          <div className="w-full min-w-0 max-w-full">
            <SitePagedSelect
              label=""
              studyId={filters.studyId || null}
              value={filters.siteId || ""}
              selectedLabel={selectedSiteLabel}
              onValueChange={(v, item) => {
                onFilterChange("siteId", v || "")
                setSelectedPatientLabel("")
                if (!item) {
                  setSelectedSiteLabel("")
                  return
                }
                const id = item.siteId ?? item.id
                const name = item.siteName || item.name || ""
                setSelectedSiteLabel(name || (id ? `Site ${id}` : ""))
              }}
              disabled={!hasStudySelected}
              placeholder={!hasStudySelected ? "Select Study first" : "Select Site"}
              searchPlaceholder="Search sites..."
              emptyOptionLabel="All Sites"
              prefetch
              reloadKey="ai-entry-site"
              triggerClassName={REPORT_FILTER_CONTROL_CLASS}
              className="!gap-0 w-full min-w-0 max-w-full"
              emptyMessage="No sites found."
            />
          </div>
        </div>

        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">Patient</label>
          <div className="w-full min-w-0 max-w-full">
            <PatientPagedSelect
              label=""
              studyId={filters.studyId || null}
              siteId={filters.siteId || null}
              value={filters.patientEnrolmentId || ""}
              selectedLabel={selectedPatientLabel}
              onValueChange={(v, item) => {
                onFilterChange("patientEnrolmentId", v || "")
                if (!item) {
                  setSelectedPatientLabel("")
                  return
                }
                setSelectedPatientLabel(formatReportPatientOptionLabel(item))
              }}
              disabled={!hasStudySelected || !hasSiteSelected}
              placeholder={!hasSiteSelected ? "Select Site first" : "Select Patient"}
              searchPlaceholder="Search patients..."
              emptyOptionLabel="All Patients"
              prefetch
              reloadKey="ai-entry-patient"
              triggerClassName={REPORT_FILTER_CONTROL_CLASS}
              className="!gap-0 w-full min-w-0 max-w-full"
              emptyMessage="No patients found."
              getOptionLabel={formatReportPatientOptionLabel}
            />
          </div>
        </div>

        <ReportFilterSelect
          label="Visit"
          value={filters.visitScheduleId}
          onValueChange={(v) => onFilterChange("visitScheduleId", v)}
          disabled={!hasStudySelected || loadingVisits}
          placeholder={
            !hasStudySelected
              ? "Select Study first"
              : loadingVisits
                ? "Loading visits..."
                : "Select Visit"
          }
          searchValue={visitSearch}
          onSearchChange={onVisitSearchChange}
          searchPlaceholder="Search visits..."
          allOptionLabel="All Visits"
          triggerClassName={REPORT_FILTER_CONTROL_CLASS}
        >
          {visits
            .filter((v) => {
              if (!visitSearchLower) return true
              const name = String(v.name || "").toLowerCase()
              return name.includes(visitSearchLower) || String(v.id).includes(visitSearchLower)
            })
            .map((v) => (
              <SelectItem key={v.id} value={String(v.id)} className={REPORT_SELECT_ITEM_CLASS}>
                {v.name}
              </SelectItem>
            ))}
        </ReportFilterSelect>

        <ReportFilterSelect
          label="CRF Form"
          value={filters.crfDesignId}
          onValueChange={(v) => onFilterChange("crfDesignId", v)}
          disabled={!hasStudySelected || loadingCrfForms}
          placeholder={
            !hasStudySelected
              ? "Select Study first"
              : loadingCrfForms
                ? "Loading CRF forms..."
                : crfForms.length === 0
                  ? "No CRF forms for study"
                  : "Select CRF Form"
          }
          searchValue={crfSearch}
          onSearchChange={onCrfSearchChange}
          searchPlaceholder="Search CRF forms..."
          allOptionLabel="All CRF forms"
          triggerClassName={REPORT_FILTER_CONTROL_CLASS}
        >
          {crfForms
            .filter((c) => {
              if (!crfSearchLower) return true
              const label = formatReportCrfDesignOptionLabel(c).toLowerCase()
              return label.includes(crfSearchLower) || String(c.crfDesignId).includes(crfSearchLower)
            })
            .map((c) => (
              <SelectItem
                key={String(c.crfDesignId)}
                value={String(c.crfDesignId)}
                className={REPORT_SELECT_ITEM_CLASS}
              >
                {formatReportCrfDesignOptionLabel(c)}
              </SelectItem>
            ))}
        </ReportFilterSelect>
      </div>

      <div className={cn(REPORT_FILTER_GRID_CLASS, "mb-0")}>
        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">CRF Status</label>
          <Select
            value={filters.crfStatus || "all"}
            onValueChange={(v) => onFilterChange("crfStatus", v === "all" ? "" : v)}
            disabled={!hasStudySelected}
          >
            <SelectTrigger className={REPORT_FILTER_CONTROL_CLASS}>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
              {AI_ENTRY_REPORT_CRF_STATUS_OPTIONS.map((opt) => (
                <SelectItemRoot
                  key={opt.value || "all"}
                  value={opt.value || "all"}
                  className={REPORT_SELECT_ITEM_CLASS}
                >
                  {opt.label}
                </SelectItemRoot>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">AI Entry Type</label>
          <Select
            value={filters.aiEntryType || "all"}
            onValueChange={(v) => onFilterChange("aiEntryType", v === "all" ? "" : v)}
            disabled={!hasStudySelected}
          >
            <SelectTrigger className={REPORT_FILTER_CONTROL_CLASS}>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
              {typeOptions.map((opt) => (
                <SelectItemRoot
                  key={opt.value || "all"}
                  value={opt.value || "all"}
                  className={REPORT_SELECT_ITEM_CLASS}
                >
                  {opt.label}
                </SelectItemRoot>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">Search</label>
          <Input
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            placeholder="Patient, site, visit, CRF..."
            className={REPORT_FILTER_CONTROL_CLASS}
            disabled={!hasStudySelected}
          />
        </div>

        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">Date From</label>
          <Input
            type="date"
            value={String(filters.aiEntryFromUtc || "").slice(0, 10)}
            onChange={(e) => onFilterChange("aiEntryFromUtc", e.target.value)}
            className={REPORT_FILTER_CONTROL_CLASS}
            disabled={!hasStudySelected}
          />
        </div>

        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">Date To</label>
          <Input
            type="date"
            value={String(filters.aiEntryToUtc || "").slice(0, 10)}
            onChange={(e) => onFilterChange("aiEntryToUtc", e.target.value)}
            className={REPORT_FILTER_CONTROL_CLASS}
            disabled={!hasStudySelected}
          />
        </div>
      </div>
    </div>
  )
}
