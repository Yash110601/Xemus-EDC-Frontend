"use client"

import { Input } from "@/components/ui/input"
import { SelectItem } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import ReportFilterSelect from "@/components/reports/ReportFilterSelect"
import { formatSdvCrfFormOptionLabel } from "@/lib/reports/sdvReportFilterOptions"
import {
  REPORT_FILTER_FIELD_CLASS,
  REPORT_FILTER_GRID_4_CLASS,
  REPORT_INPUT_CLASS,
  REPORT_SELECT_CONTENT_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  REPORT_SELECT_TRIGGER_CLASS,
  getStudyFilterDisplayName,
  SDV_REPORT_FIELD_APPROVED_OPTIONS,
} from "@/lib/reports/studySitePatientReportUi"
import {
  Select,
  SelectContent,
  SelectItem as SelectItemRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const selectTriggerClass = cn(REPORT_SELECT_TRIGGER_CLASS, "!w-full min-w-0 max-w-full")

export default function SdvReportFilters({
  filters,
  onFilterChange,
  studies,
  sites,
  patients,
  visits,
  crfForms,
  loadingStudies,
  loadingCascade,
  studyRequiredError,
  studySearch,
  onStudySearchChange,
  siteSearch,
  onSiteSearchChange,
  patientSearch,
  onPatientSearchChange,
  visitSearch,
  onVisitSearchChange,
  crfSearch,
  onCrfSearchChange,
  hasStudySelected,
  hasSiteSelected,
  hasPatientSelected,
  hasVisitSelected,
  showFieldSdvFilter = false,
  studyAllOptionLabel = "All Studies",
}) {
  const studySearchLower = studySearch.trim().toLowerCase()
  const siteSearchLower = siteSearch.trim().toLowerCase()
  const patientSearchLower = patientSearch.trim().toLowerCase()
  const visitSearchLower = visitSearch.trim().toLowerCase()
  const crfSearchLower = crfSearch.trim().toLowerCase()

  return (
    <div className="p-6 space-y-5">
      <div className={REPORT_FILTER_GRID_4_CLASS}>
        <ReportFilterSelect
          label="Study"
          required
          value={filters.studyId}
          onValueChange={(v) => {
            onFilterChange("studyId", v)
          }}
          disabled={loadingStudies}
          placeholder={loadingStudies ? "Loading studies..." : "Select Study"}
          searchValue={studySearch}
          onSearchChange={onStudySearchChange}
          searchPlaceholder="Search studies..."
          allOptionLabel={studyAllOptionLabel}
          showRequiredError={studyRequiredError}
        >
          {studies
            .filter((study) => {
              if (!studySearchLower) return true
              return getStudyFilterDisplayName(study).toLowerCase().includes(studySearchLower)
            })
            .map((study) => {
              const studyId = study.studyId || study.id
              if (!studyId) return null
              return (
                <SelectItem key={studyId} value={String(studyId)} className={REPORT_SELECT_ITEM_CLASS}>
                  {getStudyFilterDisplayName(study)}
                </SelectItem>
              )
            })}
        </ReportFilterSelect>

        <ReportFilterSelect
          label="Site"
          value={filters.siteId}
          onValueChange={(v) => onFilterChange("siteId", v)}
          disabled={!hasStudySelected || loadingCascade}
          placeholder={
            !hasStudySelected
              ? "Select Study first"
              : loadingCascade
                ? "Loading sites..."
                : "Select Site"
          }
          searchValue={siteSearch}
          onSearchChange={onSiteSearchChange}
          searchPlaceholder="Search sites..."
          allOptionLabel="All Sites"
        >
          {sites
            .filter((site) => {
              if (!siteSearchLower) return true
              const name = String(site.name || "").toLowerCase()
              return name.includes(siteSearchLower) || String(site.id).includes(siteSearchLower)
            })
            .map((site) => (
              <SelectItem key={site.id} value={String(site.id)} className={REPORT_SELECT_ITEM_CLASS}>
                {site.name}
              </SelectItem>
            ))}
        </ReportFilterSelect>

        <ReportFilterSelect
          label="Patient"
          value={filters.patientEnrolmentId}
          onValueChange={(v) => onFilterChange("patientEnrolmentId", v)}
          disabled={!hasStudySelected || !hasSiteSelected || loadingCascade}
          placeholder={
            !hasSiteSelected
              ? "Select Site first"
              : loadingCascade
                ? "Loading patients..."
                : "Select Patient"
          }
          searchValue={patientSearch}
          onSearchChange={onPatientSearchChange}
          searchPlaceholder="Search patients..."
          allOptionLabel="All Patients"
        >
          {patients
            .filter((p) => {
              if (!patientSearchLower) return true
              const name = String(p.name || "").toLowerCase()
              return name.includes(patientSearchLower) || String(p.id).includes(patientSearchLower)
            })
            .map((p) => (
              <SelectItem key={p.id} value={String(p.id)} className={REPORT_SELECT_ITEM_CLASS}>
                {p.name}
              </SelectItem>
            ))}
        </ReportFilterSelect>

        <ReportFilterSelect
          label="Visit"
          value={filters.visitScheduleId}
          onValueChange={(v) => onFilterChange("visitScheduleId", v)}
          disabled={!hasStudySelected || !hasSiteSelected || !hasPatientSelected || loadingCascade}
          placeholder={
            !hasPatientSelected
              ? "Select Patient first"
              : loadingCascade
                ? "Loading visits..."
                : "Select Visit"
          }
          searchValue={visitSearch}
          onSearchChange={onVisitSearchChange}
          searchPlaceholder="Search visits..."
          allOptionLabel="All Visits"
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
      </div>

      <div className={REPORT_FILTER_GRID_4_CLASS}>
        <ReportFilterSelect
          label="CRF Form"
          value={filters.crfDesignId}
          onValueChange={(v) => onFilterChange("crfDesignId", v)}
          disabled={!hasVisitSelected || loadingCascade}
          placeholder={
            !hasVisitSelected
              ? "Select Visit first"
              : loadingCascade
                ? "Loading CRF forms..."
                : crfForms.length === 0
                  ? "No CRF forms for visit"
                  : "Select CRF Form"
          }
          searchValue={crfSearch}
          onSearchChange={onCrfSearchChange}
          searchPlaceholder="Search CRF forms..."
          allOptionLabel="All CRF forms"
        >
          {crfForms
            .filter((c) => {
              if (!crfSearchLower) return true
              const label = formatSdvCrfFormOptionLabel(c).toLowerCase()
              return label.includes(crfSearchLower) || String(c.crfDesignId).includes(crfSearchLower)
            })
            .map((c) => (
              <SelectItem
                key={`${c.crfDesignId}-${c.rowNumber}-${c.crfDataId ?? ""}`}
                value={String(c.crfDesignId)}
                className={REPORT_SELECT_ITEM_CLASS}
              >
                {formatSdvCrfFormOptionLabel(c)}
              </SelectItem>
            ))}
        </ReportFilterSelect>

        <div className={REPORT_FILTER_FIELD_CLASS}>
          <label className="text-sm font-bold text-slate-700">Search</label>
          <Input
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            placeholder="Patient, site, visit, CRF..."
            className={cn(REPORT_INPUT_CLASS, "w-full min-w-0")}
            disabled={!hasStudySelected}
          />
        </div>

        {showFieldSdvFilter ? (
          <div className={REPORT_FILTER_FIELD_CLASS}>
            <label className="text-sm font-bold text-slate-700">Field SDV Approved</label>
            <Select
              value={filters.isSdvApproved || "all"}
              onValueChange={(v) => onFilterChange("isSdvApproved", v === "all" ? "" : v)}
              disabled={!hasStudySelected}
            >
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                {SDV_REPORT_FIELD_APPROVED_OPTIONS.map((opt) => (
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
        ) : (
          <div className={REPORT_FILTER_FIELD_CLASS} aria-hidden="true" />
        )}

        <div className={REPORT_FILTER_FIELD_CLASS} aria-hidden="true" />
      </div>
    </div>
  )
}
