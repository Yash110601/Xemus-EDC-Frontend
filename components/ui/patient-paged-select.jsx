"use client"

/**
 * Paged Patient enrolment dropdown — scroll loads page 2+.
 */

import AsyncLookupSelect from "@/components/ui/async-lookup-select"
import patientEnrolmentService from "@/lib/services/patientEnrolment.service"
import { DROPDOWN_PAGE_SIZE, normalizeApiPagedResponse } from "@/lib/api/lookupLimits"
import { useCallback } from "react"

export default function PatientPagedSelect({
  studyId = null,
  siteId = null,
  value,
  onValueChange,
  selectedLabel = "",
  label = "Patient",
  required = false,
  disabled = false,
  placeholder = "Select Patient",
  searchPlaceholder = "Search patients...",
  emptyOptionLabel = "All Patients",
  emptyMessage = "No patients found.",
  showRequiredError = false,
  requiredErrorMessage = "Please select a patient.",
  prefetch = true,
  reloadKey = "patient-paged-select",
  triggerClassName,
  contentClassName,
  className,
  getOptionLabel: getOptionLabelProp,
}) {
  const studyNum = parseInt(String(studyId ?? ""), 10)
  const siteNum = parseInt(String(siteId ?? ""), 10)
  const scopeOk =
    Number.isFinite(studyNum) && studyNum > 0 && Number.isFinite(siteNum) && siteNum > 0

  const loadOptions = useCallback(
    async (q = "", { page = 1 } = {}) => {
      if (!scopeOk) return { items: [], hasMore: false }
      const res = await patientEnrolmentService.getPatientEnrolmentsForDropdown(
        studyNum,
        siteNum,
        {
          search: String(q || "").trim(),
          pageNumber: page,
          pageSize: DROPDOWN_PAGE_SIZE,
        },
      )
      if (res?.isSuccess === false) {
        throw new Error(res?.message || "Failed to load patients")
      }
      return normalizeApiPagedResponse(res, page)
    },
    [studyNum, siteNum, scopeOk],
  )

  return (
    <AsyncLookupSelect
      label={label}
      required={required}
      value={value}
      onValueChange={onValueChange}
      selectedLabel={selectedLabel}
      disabled={disabled || !scopeOk}
      placeholder={!scopeOk ? "Select Study + Site first" : placeholder}
      searchPlaceholder={searchPlaceholder}
      showRequiredError={showRequiredError}
      requiredErrorMessage={requiredErrorMessage}
      loadOptions={loadOptions}
      getOptionValue={(p) => String(p.patientId ?? p.patientEnrolmentId ?? p.id ?? "")}
      getOptionLabel={
        getOptionLabelProp ??
        ((p) => {
          const id = p.patientId ?? p.patientEnrolmentId ?? p.id
          return p.initial || p.patientCode || p.name || `Patient ${id}`
        })
      }
      prefetch={prefetch && scopeOk}
      reloadKey={`${reloadKey}|${scopeOk ? `${studyNum}|${siteNum}` : "none"}`}
      emptyMessage={emptyMessage}
      emptyOptionLabel={emptyOptionLabel}
      triggerClassName={triggerClassName}
      contentClassName={contentClassName}
      className={className}
    />
  )
}
